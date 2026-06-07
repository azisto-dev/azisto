import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type QueryDocumentSnapshot } from "firebase-admin/firestore";
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
};

const lifecycleStatuses = new Set([
  "open",
  "hired_pending_contractor",
  "accepted",
  "on_the_way",
  "in_progress",
  "completed",
  "cancelled",
  "hired",
]);

const acceptedStatuses = new Set([
  "accepted",
  "hired",
  "on_the_way",
  "in_progress",
  "completed",
]);

const acceptedCancellationMessage =
  "This contractor has already accepted your job. Please contact the contractor directly to discuss cancellation.";

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

function isAcceptedStatus(status: string) {
  return acceptedStatuses.has(getCompatibleLifecycleStatus(status));
}

function ensureCustomerCanCancel(status: string) {
  if (isAcceptedStatus(status)) {
    throw Object.assign(new Error(acceptedCancellationMessage), {
      code: "contractor-already-accepted",
    });
  }

  if (!["open", "hired_pending_contractor"].includes(status)) {
    throw Object.assign(new Error("This job can no longer be cancelled."), {
      code: "invalid-status-transition",
    });
  }
}

function isAllowedContractorTransition(fromStatus: string, toStatus: string) {
  const compatibleStatus = getCompatibleLifecycleStatus(fromStatus);

  return (
    (compatibleStatus === "accepted" && toStatus === "on_the_way") ||
    (compatibleStatus === "on_the_way" && toStatus === "in_progress") ||
    (compatibleStatus === "in_progress" && toStatus === "completed")
  );
}

function getStatusUpdate(status: string, changedByUid: string) {
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
    update.cancelledByUid = changedByUid;
    update.matchingStatus = "closed";
  }

  return update;
}

function getParentStatus(taskStatuses: string[]) {
  if (taskStatuses.length === 0) {
    return { status: "open", overallStatus: "open", matchingStatus: "open" };
  }

  if (taskStatuses.every((status) => status === "cancelled")) {
    return {
      status: "cancelled",
      overallStatus: "cancelled",
      matchingStatus: "closed",
    };
  }

  if (
    taskStatuses.every(
      (status) => status === "completed" || status === "cancelled",
    )
  ) {
    return {
      status: "completed",
      overallStatus: "completed",
      matchingStatus: "closed",
    };
  }

  if (taskStatuses.includes("open")) {
    const hasAssignedTask = taskStatuses.some(
      (status) => status !== "open" && status !== "cancelled",
    );

    return {
      status: "open",
      overallStatus: hasAssignedTask ? "partially_hired" : "open",
      matchingStatus: "open",
    };
  }

  if (taskStatuses.includes("in_progress")) {
    return {
      status: "in_progress",
      overallStatus: "in_progress",
      matchingStatus: "closed",
    };
  }

  if (taskStatuses.includes("on_the_way")) {
    return {
      status: "on_the_way",
      overallStatus: "on_the_way",
      matchingStatus: "closed",
    };
  }

  if (
    taskStatuses.some(
      (status) => status === "accepted" || status === "hired",
    )
  ) {
    return {
      status: "accepted",
      overallStatus: "accepted",
      matchingStatus: "closed",
    };
  }

  if (taskStatuses.includes("hired_pending_contractor")) {
    return {
      status: "hired_pending_contractor",
      overallStatus: "hired_pending_contractor",
      matchingStatus: "closed",
    };
  }

  return { status: "open", overallStatus: "open", matchingStatus: "open" };
}

function getTaskStatus(
  taskSnapshot: QueryDocumentSnapshot,
  fallbackStatus: string,
) {
  return readText(taskSnapshot.get("status")) || fallbackStatus;
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
          if (taskId && !selectedTask) {
            throw Object.assign(new Error("This task could not be found."), {
              code: "task-not-found",
            });
          }

          const cancellationTargets = selectedTask ? [selectedTask] : allTasks;

          if (cancellationTargets.length > 0) {
            cancellationTargets.forEach((taskSnapshot) => {
              ensureCustomerCanCancel(
                getTaskStatus(taskSnapshot, currentStatus),
              );
            });

            cancellationTargets.forEach((taskSnapshot) => {
              transaction.set(
                taskSnapshot.ref,
                getStatusUpdate("cancelled", decodedToken.uid),
                { merge: true },
              );
            });

            const targetIds = new Set(
              cancellationTargets.map((taskSnapshot) => taskSnapshot.id),
            );
            const updatedTaskStatuses = allTasks.map((taskSnapshot) =>
              targetIds.has(taskSnapshot.id)
                ? "cancelled"
                : getTaskStatus(taskSnapshot, currentStatus),
            );
            const parentStatus = getParentStatus(updatedTaskStatuses);

            transaction.set(
              jobDocument,
              {
                ...parentStatus,
                ...(parentStatus.status === "cancelled"
                  ? getStatusUpdate("cancelled", decodedToken.uid)
                  : { updatedAt: FieldValue.serverTimestamp() }),
              },
              { merge: true },
            );

            notificationRecipientAuthUids = Array.from(
              new Set(
                cancellationTargets
                  .map((taskSnapshot) =>
                    readText(taskSnapshot.get("hiredContractorAuthUid")),
                  )
                  .filter(Boolean),
              ),
            );
          } else {
            ensureCustomerCanCancel(currentStatus);
            transaction.set(
              jobDocument,
              {
                ...getStatusUpdate("cancelled", decodedToken.uid),
                overallStatus: "cancelled",
              },
              { merge: true },
            );
            notificationRecipientAuthUids = [
              readText(jobSnapshot.get("hiredContractorAuthUid")),
            ].filter(Boolean);
          }

          historyFromStatus = selectedTask
            ? getTaskStatus(selectedTask, currentStatus)
            : currentStatus;
          appliedStatus = "cancelled";
          notificationRecipientRole = "contractor";
        } else if (
          requestedStatus === "completed" &&
          getCompatibleLifecycleStatus(currentStatus) === "in_progress"
        ) {
          historyFromStatus = currentStatus;
          appliedStatus = "completed";
          transaction.set(
            jobDocument,
            {
              ...getStatusUpdate("completed", decodedToken.uid),
              overallStatus: "completed",
            },
            { merge: true },
          );
          allTasks
            .filter(
              (taskSnapshot) =>
                getTaskStatus(taskSnapshot, currentStatus) === "in_progress",
            )
            .forEach((taskSnapshot) => {
              transaction.set(
                taskSnapshot.ref,
                getStatusUpdate("completed", decodedToken.uid),
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
          completedParentJob = true;
        } else {
          throw Object.assign(
            new Error("That job status change is not allowed."),
            { code: "invalid-status-transition" },
          );
        }
      } else {
        const targetTasks = selectedTask ? [selectedTask] : hiredTasksForCaller;
        const includesUnassignedTask = targetTasks.some(
          (taskSnapshot) =>
            taskSnapshot.get("hiredContractorAuthUid") !== decodedToken.uid,
        );
        const isLegacyParentAssignment =
          allTasks.length === 0 &&
          jobSnapshot.get("hiredContractorAuthUid") === decodedToken.uid;

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
            getStatusUpdate(requestedStatus, decodedToken.uid),
            { merge: true },
          );
        });

        if (allTasks.length > 0) {
          const targetIds = new Set(
            targetTasks.map((taskSnapshot) => taskSnapshot.id),
          );
          const updatedTaskStatuses = allTasks.map((taskSnapshot) =>
            targetIds.has(taskSnapshot.id)
              ? requestedStatus
              : getTaskStatus(taskSnapshot, currentStatus),
          );
          const parentStatus = getParentStatus(updatedTaskStatuses);
          completedParentJob = parentStatus.status === "completed";

          transaction.set(
            jobDocument,
            {
              ...parentStatus,
              ...(completedParentJob
                ? getStatusUpdate("completed", decodedToken.uid)
                : { updatedAt: FieldValue.serverTimestamp() }),
            },
            { merge: true },
          );
        } else {
          completedParentJob = requestedStatus === "completed";
          transaction.set(
            jobDocument,
            {
              ...getStatusUpdate(requestedStatus, decodedToken.uid),
              overallStatus: requestedStatus,
            },
            { merge: true },
          );
        }

        notificationRecipientAuthUids = [
          readText(jobSnapshot.get("customerAuthUid")),
        ].filter(Boolean);
        notificationRecipientRole = "customer";
      }

      if (appliedStatus === "completed" && completedParentJob) {
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
        note: taskId
          ? `Task ${taskId} status changed to ${appliedStatus}`
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
      taskId: taskId || null,
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
            : code === "job-not-found" || code === "task-not-found"
              ? 404
              : code === "job-access-denied"
                ? 403
                : code === "contractor-already-accepted" ||
                    code === "invalid-status-transition"
                  ? 409
                  : 500,
      },
    );
  }
}
