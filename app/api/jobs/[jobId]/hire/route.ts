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

type HireRequestBody = {
  contractorId?: unknown;
  taskIds?: unknown;
};

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return "";
  }

  return authorizationHeader.slice("Bearer ".length).trim();
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getErrorDetails(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";
  const message = error instanceof Error ? error.message : "Unknown error";

  return { code, message };
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
    const body = (await request.json()) as HireRequestBody;
    const contractorId = readText(body.contractorId);
    const requestedTaskIds = readStringList(body.taskIds);

    if (!contractorId) {
      return NextResponse.json(
        {
          code: "missing-contractor-id",
          message: "Please choose a contractor to hire.",
        },
        { status: 400 },
      );
    }

    const jobDocument = adminDb.collection("jobs").doc(jobId);
    const interestedSnapshot = await jobDocument
      .collection("interestedContractors")
      .where("contractorId", "==", contractorId)
      .limit(1)
      .get();

    if (interestedSnapshot.empty) {
      return NextResponse.json(
        {
          code: "contractor-not-interested",
          message: "This contractor has not expressed interest in the job.",
        },
        { status: 400 },
      );
    }

    const interestedContractor = interestedSnapshot.docs[0];
    const hiredContractorAuthUid =
      readText(interestedContractor.get("contractorUid")) ||
      interestedContractor.id;
    const hiredContractorName =
      readText(interestedContractor.get("contractorName")) ||
      readText(interestedContractor.get("businessName")) ||
      contractorId;
    const hiredBusinessName = readText(
      interestedContractor.get("businessName"),
    );
    const savedInterestedTaskIds = readStringList(
      interestedContractor.get("selectedTaskIds"),
    );
    const taskIds =
      requestedTaskIds.length > 0 ? requestedTaskIds : savedInterestedTaskIds;

    await adminDb.runTransaction(async (transaction) => {
      const jobSnapshot = await transaction.get(jobDocument);

      if (!jobSnapshot.exists) {
        throw Object.assign(new Error("This job could not be found."), {
          code: "job-not-found",
        });
      }

      if (jobSnapshot.get("customerAuthUid") !== decodedToken.uid) {
        throw Object.assign(
          new Error("You can only hire contractors for your own jobs."),
          { code: "job-access-denied" },
        );
      }

      if (
        jobSnapshot.get("status") !== "open" &&
        jobSnapshot.get("overallStatus") !== "partially_hired"
      ) {
        throw Object.assign(new Error("Only open jobs can be hired."), {
          code: "job-not-open",
        });
      }

      const tasksSnapshot = await transaction.get(jobDocument.collection("tasks"));

      if (!tasksSnapshot.empty && taskIds.length === 0) {
        throw Object.assign(
          new Error("Please select at least one task to hire for."),
          { code: "missing-task-selection" },
        );
      }

      if (!tasksSnapshot.empty) {
        const selectedTaskSnapshots = tasksSnapshot.docs.filter((taskSnapshot) =>
          taskIds.includes(readText(taskSnapshot.get("taskId")) || taskSnapshot.id),
        );

        if (selectedTaskSnapshots.length !== taskIds.length) {
          throw Object.assign(new Error("One or more selected tasks were not found."), {
            code: "task-not-found",
          });
        }

        for (const taskSnapshot of selectedTaskSnapshots) {
          if (taskSnapshot.get("status") !== "open") {
            throw Object.assign(
              new Error("One or more selected tasks are no longer open."),
              { code: "task-not-open" },
            );
          }

          const taskInterestSnapshot = await transaction.get(
            taskSnapshot.ref.collection("interestedContractors").doc(contractorId),
          );

          if (!taskInterestSnapshot.exists) {
            throw Object.assign(
              new Error("This contractor has not expressed interest in every selected task."),
              { code: "contractor-not-interested" },
            );
          }
        }

        selectedTaskSnapshots.forEach((taskSnapshot) => {
          transaction.set(
            taskSnapshot.ref,
            {
              status: "hired_pending_contractor",
              hiredContractorId: contractorId,
              hiredContractorAuthUid,
              hiredContractorName,
              hiredBusinessName,
              hiredAt: FieldValue.serverTimestamp(),
              contractorDecisionStatus: "pending",
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        });

        const remainingOpenTaskCount = tasksSnapshot.docs.filter((taskSnapshot) => {
          const taskId = readText(taskSnapshot.get("taskId")) || taskSnapshot.id;

          return taskSnapshot.get("status") === "open" && !taskIds.includes(taskId);
        }).length;
        const nextOverallStatus =
          remainingOpenTaskCount > 0
            ? "partially_hired"
            : "hired_pending_contractor";

        transaction.set(
          jobDocument,
          {
            status:
              remainingOpenTaskCount > 0
                ? "open"
                : "hired_pending_contractor",
            overallStatus: nextOverallStatus,
            matchingStatus: remainingOpenTaskCount > 0 ? "open" : "closed",
            ...(remainingOpenTaskCount === 0
              ? {
                  hiredContractorId: contractorId,
                  hiredContractorAuthUid,
                  hiredContractorName,
                  hiredBusinessName,
                }
              : {}),
            hiredContractorIds: FieldValue.arrayUnion(contractorId),
            hiredContractorAuthUids: FieldValue.arrayUnion(hiredContractorAuthUid),
            hiredAt: FieldValue.serverTimestamp(),
            contractorDecisionStatus: "pending",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        transaction.set(jobDocument.collection("statusHistory").doc(), {
          fromStatus: readText(jobSnapshot.get("overallStatus")) || "open",
          toStatus: nextOverallStatus,
          status: nextOverallStatus,
          changedByRole: "customer",
          changedByUid: decodedToken.uid,
          note: `Customer selected contractor for ${selectedTaskSnapshots.length} task(s); contractor confirmation pending`,
          selectedTaskIds: taskIds,
          changedAt: FieldValue.serverTimestamp(),
        });

        return;
      }

      transaction.set(
        jobDocument,
        {
          status: "hired_pending_contractor",
          overallStatus: "hired_pending_contractor",
          matchingStatus: "closed",
          hiredContractorId: contractorId,
          hiredContractorAuthUid,
          hiredContractorName,
          hiredBusinessName,
          hiredAt: FieldValue.serverTimestamp(),
          contractorDecisionStatus: "pending",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      transaction.set(jobDocument.collection("statusHistory").doc(), {
        fromStatus: "open",
        toStatus: "hired_pending_contractor",
        status: "hired_pending_contractor",
        changedByRole: "customer",
        changedByUid: decodedToken.uid,
        note: "Customer selected contractor; awaiting contractor decision",
        changedAt: FieldValue.serverTimestamp(),
      });
    });
    await createNotification({
      recipientAuthUid: hiredContractorAuthUid,
      recipientRole: "contractor",
      type: "contractor_selected",
      title: "You were selected",
      message: "You have been selected for a job. Please accept or decline.",
      jobId,
    });

    return NextResponse.json({ ok: true, selectedTaskIds: taskIds });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Job hire API failed:", {
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
