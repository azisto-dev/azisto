import { NextRequest, NextResponse } from "next/server";
import {
  FieldValue,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import { getParentJobStatus } from "@/lib/jobLifecycle";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

type CompletionDecisionBody = {
  taskId?: unknown;
  decision?: unknown;
};

function getBearerToken(authorizationHeader: string | null) {
  return authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : "";
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getTaskStatus(
  taskSnapshot: QueryDocumentSnapshot,
  fallbackStatus: string,
) {
  return readText(taskSnapshot.get("status")) || fallbackStatus;
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
    const body = (await request.json()) as CompletionDecisionBody;
    const taskId = readText(body.taskId);
    const decision = readText(body.decision);

    if (decision !== "confirm" && decision !== "reject") {
      return NextResponse.json(
        {
          code: "invalid-decision",
          message: "Please confirm or reject the completion request.",
        },
        { status: 400 },
      );
    }

    const jobDocument = adminDb.collection("jobs").doc(jobId);
    let contractorAuthUids: string[] = [];
    let parentStatus = "";
    let affectedTaskIds: string[] = [];

    await adminDb.runTransaction(async (transaction) => {
      const jobSnapshot = await transaction.get(jobDocument);

      if (!jobSnapshot.exists) {
        throw Object.assign(new Error("This job could not be found."), {
          code: "job-not-found",
        });
      }

      if (jobSnapshot.get("customerAuthUid") !== decodedToken.uid) {
        throw Object.assign(
          new Error("Only the customer can confirm completed work."),
          { code: "job-access-denied" },
        );
      }

      const currentParentStatus =
        readText(jobSnapshot.get("status")) || "open";
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

      if (taskId && !selectedTask) {
        throw Object.assign(new Error("This task could not be found."), {
          code: "task-not-found",
        });
      }

      const pendingTargets =
        allTasks.length > 0
          ? selectedTask
            ? [selectedTask]
            : allTasks.filter(
                (taskSnapshot) =>
                  getTaskStatus(taskSnapshot, currentParentStatus) ===
                  "completion_pending_customer",
              )
          : [];

      if (
        (allTasks.length > 0 && pendingTargets.length === 0) ||
        (allTasks.length === 0 &&
          currentParentStatus !== "completion_pending_customer")
      ) {
        throw Object.assign(
          new Error("This completion request is no longer pending."),
          { code: "completion-not-pending" },
        );
      }

      const nextTargetStatus = decision === "confirm" ? "completed" : "in_progress";
      const decisionUpdate =
        decision === "confirm"
          ? {
              status: nextTargetStatus,
              completedAt: FieldValue.serverTimestamp(),
              completionConfirmedAt: FieldValue.serverTimestamp(),
              completionConfirmedByUid: decodedToken.uid,
              completionRejectedAt: FieldValue.delete(),
              completionRequestedAt: FieldValue.delete(),
              completionRequestedByUid: FieldValue.delete(),
              matchingStatus: "closed",
              updatedAt: FieldValue.serverTimestamp(),
            }
          : {
              status: nextTargetStatus,
              completionRejectedAt: FieldValue.serverTimestamp(),
              completionRejectedByUid: decodedToken.uid,
              completionRequestedAt: FieldValue.delete(),
              completionRequestedByUid: FieldValue.delete(),
              completedAt: FieldValue.delete(),
              matchingStatus: "closed",
              updatedAt: FieldValue.serverTimestamp(),
            };

      if (allTasks.length > 0) {
        pendingTargets.forEach((taskSnapshot) => {
          transaction.set(taskSnapshot.ref, decisionUpdate, { merge: true });
        });

        const targetIds = new Set(
          pendingTargets.map((taskSnapshot) => taskSnapshot.id),
        );
        const updatedTaskStatuses = allTasks.map((taskSnapshot) =>
          targetIds.has(taskSnapshot.id)
            ? nextTargetStatus
            : getTaskStatus(taskSnapshot, currentParentStatus),
        );
        const nextParent = getParentJobStatus(updatedTaskStatuses);
        parentStatus = nextParent.status;

        transaction.set(
          jobDocument,
          {
            ...nextParent,
            ...(nextParent.status === "completed"
              ? {
                  completedAt: FieldValue.serverTimestamp(),
                  completionConfirmedAt: FieldValue.serverTimestamp(),
                }
              : {
                  completedAt: FieldValue.delete(),
                }),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        affectedTaskIds = pendingTargets.map(
          (taskSnapshot) =>
            readText(taskSnapshot.get("taskId")) || taskSnapshot.id,
        );
        contractorAuthUids = Array.from(
          new Set(
            pendingTargets
              .map((taskSnapshot) =>
                readText(taskSnapshot.get("hiredContractorAuthUid")),
              )
              .filter(Boolean),
          ),
        );

        if (
          nextParent.status === "completed" &&
          currentParentStatus !== "completed"
        ) {
          const customerId = readText(jobSnapshot.get("customerId"));
          const contractorIds = Array.from(
            new Set(
              allTasks
                .filter((taskSnapshot) =>
                  targetIds.has(taskSnapshot.id)
                    ? nextTargetStatus === "completed"
                    : getTaskStatus(taskSnapshot, currentParentStatus) ===
                      "completed",
                )
                .map((taskSnapshot) =>
                  readText(taskSnapshot.get("hiredContractorId")),
                )
                .filter(Boolean),
            ),
          );

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

          contractorIds.forEach((contractorId) => {
            transaction.set(
              adminDb.collection("contractors").doc(contractorId),
              {
                completedJobsCount: FieldValue.increment(1),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true },
            );
          });
        }
      } else {
        parentStatus = nextTargetStatus;
        transaction.set(
          jobDocument,
          {
            ...decisionUpdate,
            overallStatus: nextTargetStatus,
          },
          { merge: true },
        );
        contractorAuthUids = [
          readText(jobSnapshot.get("hiredContractorAuthUid")),
        ].filter(Boolean);

        if (decision === "confirm") {
          const customerId = readText(jobSnapshot.get("customerId"));
          const contractorId = readText(jobSnapshot.get("hiredContractorId"));

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

          if (contractorId) {
            transaction.set(
              adminDb.collection("contractors").doc(contractorId),
              {
                completedJobsCount: FieldValue.increment(1),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true },
            );
          }
        }
      }

      transaction.set(jobDocument.collection("statusHistory").doc(), {
        fromStatus: "completion_pending_customer",
        toStatus: nextTargetStatus,
        status: nextTargetStatus,
        changedAt: FieldValue.serverTimestamp(),
        changedByRole: "customer",
        changedByUid: decodedToken.uid,
        decision,
        ...(taskId ? { taskId } : {}),
        note:
          decision === "confirm"
            ? "Customer confirmed completed work"
            : "Customer rejected completion",
      });
    });

    await Promise.all(
      contractorAuthUids.map((recipientAuthUid) =>
        createNotification({
          recipientAuthUid,
          recipientRole: "contractor",
          type:
            decision === "confirm"
              ? "completion_confirmed"
              : "completion_rejected",
          title:
            decision === "confirm"
              ? "Completion confirmed"
              : "Completion rejected",
          message:
            decision === "confirm"
              ? "Customer confirmed the completed work."
              : "Customer rejected completion. Please contact the customer.",
          jobId,
          pushPayload:
            decision === "reject"
              ? {
                  body: "Customer asked you to review the job again.",
                }
              : undefined,
          data: {
            taskIds: affectedTaskIds,
          },
        }),
      ),
    );

    return NextResponse.json({
      ok: true,
      decision,
      status: parentStatus,
      taskIds: affectedTaskIds,
    });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Completion confirmation API failed:", {
      code,
      message,
      error,
    });

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
                : code === "invalid-decision" ||
                    code === "completion-not-pending"
                  ? 409
                  : 500,
      },
    );
  }
}
