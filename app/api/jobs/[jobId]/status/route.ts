import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

type StatusRequestBody = {
  status?: unknown;
  taskId?: unknown;
};

const lifecycleStatuses = new Set([
  "open",
  "hired",
  "in_progress",
  "completed",
  "cancelled",
  "review_required",
]);

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return "";
  }

  return authorizationHeader.slice("Bearer ".length).trim();
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getErrorDetails(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";
  const message = error instanceof Error ? error.message : "Unknown error";

  return { code, message };
}

function isAllowedTransition(
  fromStatus: string,
  toStatus: string,
  changedByRole: "customer" | "contractor",
) {
  if (fromStatus === "hired" && toStatus === "in_progress") {
    return true;
  }

  if (
    fromStatus === "in_progress" &&
    toStatus === "completed" &&
    changedByRole === "customer"
  ) {
    return true;
  }

  if (
    fromStatus === "hired" &&
    toStatus === "cancelled" &&
    changedByRole === "customer"
  ) {
    return true;
  }

  if (
    fromStatus === "open" &&
    toStatus === "cancelled" &&
    changedByRole === "customer"
  ) {
    return true;
  }

  return false;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertFirebaseAdminConfig();

    const token = getBearerToken(request.headers.get("authorization"));

    if (!token) {
      return NextResponse.json(
        {
          code: "missing-token",
          message: "Please sign in again.",
        },
        { status: 401 },
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const { jobId } = await context.params;
    const body = (await request.json()) as StatusRequestBody;
    const nextStatus = readText(body.status);
    const taskId = readText(body.taskId);

    if (!lifecycleStatuses.has(nextStatus)) {
      return NextResponse.json(
        {
          code: "invalid-status",
          message: "Please choose a valid job status.",
        },
        { status: 400 },
      );
    }

    const jobDocument = adminDb.collection("jobs").doc(jobId);
    let changedByRole: "customer" | "contractor" = "customer";
    let notificationRecipientAuthUid = "";
    let notificationRecipientRole: "customer" | "contractor" = "contractor";
    let notificationTitle = "";
    let notificationMessage = "";

    await adminDb.runTransaction(async (transaction) => {
      const jobSnapshot = await transaction.get(jobDocument);

      if (!jobSnapshot.exists) {
        throw Object.assign(new Error("This job could not be found."), {
          code: "job-not-found",
        });
      }

      const currentStatus = readText(jobSnapshot.get("status"));
      const callerIsCustomer = jobSnapshot.get("customerAuthUid") === decodedToken.uid;
      const taskDocument = taskId ? jobDocument.collection("tasks").doc(taskId) : null;
      const taskSnapshot = taskDocument ? await transaction.get(taskDocument) : null;
      const allTasksSnapshot = taskDocument
        ? await transaction.get(jobDocument.collection("tasks"))
        : null;
      const currentTaskStatus = taskSnapshot?.exists
        ? readText(taskSnapshot.get("status"))
        : "";
      const callerIsHiredContractor = taskSnapshot?.exists
        ? taskSnapshot.get("hiredContractorAuthUid") === decodedToken.uid
        : jobSnapshot.get("hiredContractorAuthUid") === decodedToken.uid;

      if (!callerIsCustomer && !callerIsHiredContractor) {
        throw Object.assign(
          new Error("You can only update jobs assigned to you."),
          { code: "job-access-denied" },
        );
      }

      changedByRole = callerIsCustomer ? "customer" : "contractor";
      const transitionFromStatus = currentTaskStatus || currentStatus;

      if (!isAllowedTransition(transitionFromStatus, nextStatus, changedByRole)) {
        throw Object.assign(
          new Error("That job status change is not allowed."),
          { code: "invalid-status-transition" },
        );
      }

      const statusUpdate: Record<string, unknown> = {
        status: nextStatus,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (nextStatus === "in_progress") {
        statusUpdate.startedAt = FieldValue.serverTimestamp();
      }

      if (nextStatus === "completed") {
        statusUpdate.completedAt = FieldValue.serverTimestamp();
        statusUpdate.matchingStatus = "closed";
        const customerId = readText(jobSnapshot.get("customerId"));

        if (customerId) {
          transaction.set(
            adminDb.collection("customers").doc(customerId),
            {
              completedJobsCount: FieldValue.increment(1),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }

        const hiredContractorId = readText(jobSnapshot.get("hiredContractorId"));

        if (hiredContractorId) {
          transaction.set(
            adminDb.collection("contractors").doc(hiredContractorId),
            {
              completedJobsCount: FieldValue.increment(1),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }

        notificationRecipientAuthUid = readText(
          jobSnapshot.get("hiredContractorAuthUid"),
        );
        notificationRecipientRole = "contractor";
        notificationTitle = "Job completed";
        notificationMessage = `Job ${jobId} was marked completed.`;
      }

      if (nextStatus === "cancelled") {
        statusUpdate.cancelledAt = FieldValue.serverTimestamp();
        statusUpdate.matchingStatus = "closed";
      }

      if (taskDocument && taskSnapshot?.exists) {
        transaction.set(taskDocument, statusUpdate, { merge: true });

        const taskStatuses = (allTasksSnapshot?.docs ?? []).map((snapshot) => {
          const snapshotTaskId = readText(snapshot.get("taskId")) || snapshot.id;

          return snapshotTaskId === taskId
            ? nextStatus
            : readText(snapshot.get("status"));
        });
        const hasOpenTasks = taskStatuses.some((status) => status === "open");
        const allCompleted = taskStatuses.every((status) => status === "completed");
        const anyInProgress = taskStatuses.some((status) => status === "in_progress");
        const parentStatus = allCompleted
          ? "completed"
          : anyInProgress
            ? "in_progress"
            : hasOpenTasks
              ? "open"
              : "hired";
        const parentOverallStatus = hasOpenTasks
          ? "partially_hired"
          : parentStatus;

        transaction.set(
          jobDocument,
          {
            status: parentStatus,
            overallStatus: parentOverallStatus,
            ...(allCompleted || nextStatus === "cancelled"
              ? { matchingStatus: "closed" }
              : {}),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      } else {
        transaction.set(jobDocument, statusUpdate, { merge: true });
      }
      transaction.set(jobDocument.collection("statusHistory").doc(), {
        fromStatus: transitionFromStatus,
        toStatus: nextStatus,
        changedByRole,
        note: taskId
          ? `Task ${taskId} status changed to ${nextStatus}`
          : `Status changed to ${nextStatus}`,
        ...(taskId ? { taskId } : {}),
        changedAt: FieldValue.serverTimestamp(),
      });
    });

    if (notificationRecipientAuthUid) {
      await createNotification({
        recipientAuthUid: notificationRecipientAuthUid,
        recipientRole: notificationRecipientRole,
        type: nextStatus === "completed" ? "job_completed" : "job_status",
        title: notificationTitle,
        message: notificationMessage,
        jobId,
      });
    }

    return NextResponse.json({ ok: true, status: nextStatus, changedByRole });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Job status API failed:", {
      code,
      message,
      error,
    });

    return NextResponse.json(
      {
        code,
        message,
      },
      {
        status:
          code === "missing-token"
            ? 401
            : code === "job-not-found"
              ? 404
              : code === "job-access-denied"
                ? 403
                : 500,
      },
    );
  }
}
