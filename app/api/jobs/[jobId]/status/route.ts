import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import { createNotification } from "@/lib/notifications";
import { getCompatibleLifecycleStatus } from "@/lib/jobStatus";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

type StatusRequestBody = {
  status?: unknown;
  taskId?: unknown;
  cancelReason?: unknown;
};

const lifecycleStatuses = new Set([
  "open",
  "hired_pending_contractor",
  "accepted",
  "on_the_way",
  "in_progress",
  "completed",
  "cancelled",
  "cancel_requested",
  "disputed",
  "hired",
]);

function getBearerToken(authorizationHeader: string | null) {
  return authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : "";
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getErrorDetails(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";

  return {
    code,
    message: error instanceof Error ? error.message : "Unknown error",
  };
}

function resolveCustomerCancellationStatus(currentStatus: string) {
  const compatibleStatus = getCompatibleLifecycleStatus(currentStatus);

  if (compatibleStatus === "completed") {
    throw Object.assign(
      new Error(
        "Completed jobs cannot be cancelled. You can leave a review or contact support.",
      ),
      { code: "completed-job-cannot-cancel" },
    );
  }

  if (compatibleStatus === "on_the_way") {
    return "cancel_requested";
  }

  if (compatibleStatus === "in_progress") {
    return "disputed";
  }

  if (
    ["open", "hired_pending_contractor", "accepted"].includes(
      compatibleStatus,
    )
  ) {
    return "cancelled";
  }

  throw Object.assign(new Error("This job can no longer be cancelled."), {
    code: "invalid-status-transition",
  });
}

function isAllowedContractorTransition(fromStatus: string, toStatus: string) {
  const compatibleStatus = getCompatibleLifecycleStatus(fromStatus);

  return (
    (compatibleStatus === "accepted" && toStatus === "on_the_way") ||
    (compatibleStatus === "on_the_way" && toStatus === "in_progress") ||
    (compatibleStatus === "in_progress" && toStatus === "completed")
  );
}

function isTerminalCancellationStatus(status: string) {
  return ["completed", "cancelled", "cancel_requested", "disputed"].includes(
    getCompatibleLifecycleStatus(status),
  );
}

function getStatusUpdate(status: string, changedByUid: string, reason: string) {
  const update: Record<string, unknown> = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (status === "on_the_way") {
    update.onTheWayAt = FieldValue.serverTimestamp();
  }

  if (status === "in_progress") {
    update.startedAt = FieldValue.serverTimestamp();
  }

  if (status === "completed") {
    update.completedAt = FieldValue.serverTimestamp();
    update.matchingStatus = "closed";
  }

  if (status === "cancelled") {
    update.cancelledAt = FieldValue.serverTimestamp();
    update.cancelReason = reason;
    update.cancelledByUid = changedByUid;
    update.matchingStatus = "closed";
  }

  if (status === "cancel_requested") {
    update.cancelRequestedAt = FieldValue.serverTimestamp();
    update.cancelRequestedBy = "customer";
    update.cancelReason = reason;
  }

  if (status === "disputed") {
    update.cancelRequestedAt = FieldValue.serverTimestamp();
    update.cancelRequestedBy = "customer";
    update.disputeReason = reason;
    update.matchingStatus = "closed";
  }

  return update;
}

function getNotificationCopy(status: string, jobId: string) {
  if (status === "on_the_way") {
    return {
      type: "contractor_on_the_way",
      title: "Contractor on the way",
      message: `Your contractor is on the way for job ${jobId}.`,
    };
  }

  if (status === "in_progress") {
    return {
      type: "job_started",
      title: "Job started",
      message: `Work has started on job ${jobId}.`,
    };
  }

  if (status === "completed") {
    return {
      type: "job_completed",
      title: "Job completed",
      message: `Job ${jobId} was marked completed.`,
    };
  }

  if (status === "cancel_requested") {
    return {
      type: "customer_cancellation_requested",
      title: "Cancellation requested",
      message: "Customer requested cancellation while you were on the way.",
    };
  }

  if (status === "disputed") {
    return {
      type: "job_disputed",
      title: "Job under review",
      message: "Customer requested cancellation during an active job.",
    };
  }

  if (status === "cancelled") {
    return {
      type: "job_cancelled",
      title: "Job cancelled",
      message: `Job ${jobId} was cancelled.`,
    };
  }

  return {
    type: "job_status",
    title: "Job updated",
    message: `Job ${jobId} is now ${status.replaceAll("_", " ")}.`,
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertFirebaseAdminConfig();
    const token = getBearerToken(request.headers.get("authorization"));

    if (!token) {
      return NextResponse.json(
        { code: "missing-token", message: "Please sign in again." },
        { status: 401 },
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const { jobId } = await context.params;
    const body = (await request.json()) as StatusRequestBody;
    const requestedStatus = readText(body.status);
    const taskId = readText(body.taskId);
    const cancelReason = readText(body.cancelReason);

    if (!lifecycleStatuses.has(requestedStatus)) {
      return NextResponse.json(
        { code: "invalid-status", message: "Please choose a valid job status." },
        { status: 400 },
      );
    }

    const jobDocument = adminDb.collection("jobs").doc(jobId);
    let changedByRole: "customer" | "contractor" = "customer";
    let appliedStatus = requestedStatus;
    let notificationRecipientAuthUids: string[] = [];
    let notificationRecipientRole: "customer" | "contractor" = "contractor";
    let historyFromStatus = "";
    let completedParentJob = false;
    let completionContractorId = "";

    await adminDb.runTransaction(async (transaction) => {
      const jobSnapshot = await transaction.get(jobDocument);

      if (!jobSnapshot.exists) {
        throw Object.assign(new Error("This job could not be found."), {
          code: "job-not-found",
        });
      }

      const currentStatus = readText(jobSnapshot.get("status")) || "open";
      const callerIsCustomer =
        jobSnapshot.get("customerAuthUid") === decodedToken.uid;
      const tasksSnapshot = await transaction.get(
        jobDocument.collection("tasks"),
      );
      const allTasks = tasksSnapshot.docs;
      const selectedTask = taskId
        ? allTasks.find(
            (taskSnapshot) =>
              (readText(taskSnapshot.get("taskId")) || taskSnapshot.id) ===
              taskId,
          )
        : null;
      const hiredTasksForCaller = allTasks.filter(
        (taskSnapshot) =>
          taskSnapshot.get("hiredContractorAuthUid") === decodedToken.uid,
      );
      const callerIsHiredContractor =
        jobSnapshot.get("hiredContractorAuthUid") === decodedToken.uid ||
        hiredTasksForCaller.length > 0;

      if (!callerIsCustomer && !callerIsHiredContractor) {
        throw Object.assign(
          new Error("You can only update jobs assigned to you."),
          { code: "job-access-denied" },
        );
      }

      changedByRole = callerIsCustomer ? "customer" : "contractor";

      if (callerIsCustomer) {
        if (requestedStatus === "cancelled") {
          const taskStatuses = allTasks.map(
            (taskSnapshot) =>
              readText(taskSnapshot.get("status")) || currentStatus,
          );

          if (
            getCompatibleLifecycleStatus(currentStatus) === "completed" ||
            (taskStatuses.length > 0 &&
              taskStatuses.every(
                (status) =>
                  getCompatibleLifecycleStatus(status) === "completed",
              ))
          ) {
            resolveCustomerCancellationStatus("completed");
          }

          appliedStatus = taskStatuses.some(
            (status) =>
              getCompatibleLifecycleStatus(status) === "in_progress",
          )
            ? "disputed"
            : taskStatuses.some(
                  (status) =>
                    getCompatibleLifecycleStatus(status) === "on_the_way",
                )
              ? "cancel_requested"
              : resolveCustomerCancellationStatus(currentStatus);

          if (
            ["cancel_requested", "disputed"].includes(appliedStatus) &&
            !cancelReason
          ) {
            throw Object.assign(
              new Error("Please provide a reason for this cancellation request."),
              { code: "missing-cancel-reason" },
            );
          }
        } else if (
          !(
            requestedStatus === "completed" &&
            getCompatibleLifecycleStatus(currentStatus) === "in_progress"
          )
        ) {
          throw Object.assign(
            new Error("That job status change is not allowed."),
            { code: "invalid-status-transition" },
          );
        }

        historyFromStatus = currentStatus;
        transaction.set(
          jobDocument,
          {
            ...getStatusUpdate(appliedStatus, decodedToken.uid, cancelReason),
            previousStatus:
              appliedStatus === "cancel_requested" ||
              appliedStatus === "disputed"
                ? currentStatus
                : FieldValue.delete(),
            overallStatus: appliedStatus,
          },
          { merge: true },
        );

        allTasks.forEach((taskSnapshot) => {
            const taskCurrentStatus =
              readText(taskSnapshot.get("status")) || currentStatus;
            if (
              requestedStatus === "cancelled" &&
              isTerminalCancellationStatus(taskCurrentStatus)
            ) {
              return;
            }

            const taskStatus =
              requestedStatus === "cancelled"
                ? resolveCustomerCancellationStatus(taskCurrentStatus)
                : appliedStatus;

            transaction.set(
              taskSnapshot.ref,
              {
                ...getStatusUpdate(
                  taskStatus,
                  decodedToken.uid,
                  cancelReason,
                ),
                previousStatus:
                  taskStatus === "cancel_requested" ||
                  taskStatus === "disputed"
                    ? taskCurrentStatus
                    : FieldValue.delete(),
              },
              { merge: true },
            );
          });

        notificationRecipientAuthUids = Array.from(
          new Set(
            [
              readText(jobSnapshot.get("hiredContractorAuthUid")),
              ...allTasks.map((taskSnapshot) =>
                readText(taskSnapshot.get("hiredContractorAuthUid")),
              ),
            ].filter(Boolean),
          ),
        );
        notificationRecipientRole = "contractor";
      } else {
        const targetTasks = selectedTask
          ? [selectedTask]
          : hiredTasksForCaller;
        const includesUnassignedTask = targetTasks.some(
          (taskSnapshot) =>
            taskSnapshot.get("hiredContractorAuthUid") !== decodedToken.uid,
        );
        const isLegacyParentAssignment =
          allTasks.length === 0 &&
          (jobSnapshot.get("hiredContractorAuthUid") === decodedToken.uid ||
            callerIsHiredContractor);

        if (
          (targetTasks.length === 0 && !isLegacyParentAssignment) ||
          includesUnassignedTask
        ) {
          throw Object.assign(
            new Error("You can only update tasks assigned to you."),
            { code: "job-access-denied" },
          );
        }

        const transitionFromStatus =
          readText(targetTasks[0]?.get("status")) || currentStatus;

        if (
          !isAllowedContractorTransition(
            transitionFromStatus,
            requestedStatus,
          )
        ) {
          throw Object.assign(
            new Error("That job status change is not allowed."),
            { code: "invalid-status-transition" },
          );
        }

        historyFromStatus = transitionFromStatus;
        completionContractorId =
          readText(targetTasks[0]?.get("hiredContractorId")) ||
          readText(jobSnapshot.get("hiredContractorId"));
        targetTasks.forEach((taskSnapshot) => {
          transaction.set(
            taskSnapshot.ref,
            getStatusUpdate(requestedStatus, decodedToken.uid, ""),
            { merge: true },
          );
        });

        const updatedTaskStatuses = allTasks.map((taskSnapshot) =>
          targetTasks.some((targetTask) => targetTask.id === taskSnapshot.id)
            ? requestedStatus
            : readText(taskSnapshot.get("status")),
        );
        const hasOpenTasks = updatedTaskStatuses.some(
          (status) => status === "open",
        );
        const allCompleted =
          updatedTaskStatuses.length > 0 &&
          updatedTaskStatuses.every(
            (status) => status === "completed" || status === "cancelled",
          );
        const parentStatus = hasOpenTasks
          ? "open"
          : allCompleted
            ? "completed"
            : requestedStatus;
        completedParentJob = parentStatus === "completed";

        transaction.set(
          jobDocument,
          {
            ...getStatusUpdate(parentStatus, decodedToken.uid, ""),
            overallStatus: hasOpenTasks ? "partially_hired" : parentStatus,
          },
          { merge: true },
        );

        notificationRecipientAuthUids = [
          readText(jobSnapshot.get("customerAuthUid")),
        ].filter(Boolean);
        notificationRecipientRole = "customer";
      }

      if (
        appliedStatus === "completed" &&
        (changedByRole === "customer" || completedParentJob)
      ) {
        const customerId = readText(jobSnapshot.get("customerId"));
        const hiredContractorId =
          completionContractorId ||
          readText(jobSnapshot.get("hiredContractorId"));

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
      }

      transaction.set(jobDocument.collection("statusHistory").doc(), {
        fromStatus: historyFromStatus,
        toStatus: appliedStatus,
        status: appliedStatus,
        changedAt: FieldValue.serverTimestamp(),
        changedByRole,
        changedByUid: decodedToken.uid,
        note:
          appliedStatus === "cancel_requested"
            ? `Customer requested cancellation${cancelReason ? `: ${cancelReason}` : ""}`
            : appliedStatus === "disputed"
              ? `Customer requested cancellation during active work${cancelReason ? `: ${cancelReason}` : ""}`
              : `Status changed to ${appliedStatus}`,
        ...(taskId ? { taskId } : {}),
      });
    });

    if (notificationRecipientAuthUids.length > 0) {
      const notification = getNotificationCopy(appliedStatus, jobId);
      await Promise.all(
        notificationRecipientAuthUids.map((recipientAuthUid) =>
          createNotification({
            recipientAuthUid,
            recipientRole: notificationRecipientRole,
            ...notification,
            jobId,
          }),
        ),
      );
    }

    return NextResponse.json({
      ok: true,
      status: appliedStatus,
      changedByRole,
      underReview: appliedStatus === "disputed",
    });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Job status API failed:", { code, message, error });

    return NextResponse.json(
      { code, message },
      {
        status:
          code === "missing-token"
            ? 401
            : code === "job-not-found"
              ? 404
                : code === "job-access-denied"
                  ? 403
                  : code === "missing-cancel-reason"
                    ? 400
                : code === "completed-job-cannot-cancel" ||
                    code === "invalid-status-transition"
                  ? 409
                  : 500,
      },
    );
  }
}
