import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import { createNotification } from "@/lib/notifications";
import { getSubscriptionSummary } from "@/lib/subscriptions";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

type DecisionBody = {
  decision?: unknown;
  reason?: unknown;
};

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

async function findContractorProfile(firebaseUid: string) {
  const contractors = adminDb.collection("contractors");
  const authUidSnapshot = await contractors
    .where("authUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!authUidSnapshot.empty) {
    return authUidSnapshot.docs[0];
  }

  const legacyUidSnapshot = await contractors
    .where("firebaseUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!legacyUidSnapshot.empty) {
    return legacyUidSnapshot.docs[0];
  }

  const legacyDocument = await contractors.doc(firebaseUid).get();
  return legacyDocument.exists ? legacyDocument : null;
}

function getParentStatus(taskStatuses: string[]) {
  if (taskStatuses.some((status) => status === "open")) {
    return { status: "open", overallStatus: "partially_hired" };
  }

  if (taskStatuses.some((status) => status === "hired_pending_contractor")) {
    return {
      status: "hired_pending_contractor",
      overallStatus: "hired_pending_contractor",
    };
  }

  if (taskStatuses.some((status) => status === "in_progress")) {
    return { status: "in_progress", overallStatus: "in_progress" };
  }

  if (taskStatuses.some((status) => status === "on_the_way")) {
    return { status: "on_the_way", overallStatus: "on_the_way" };
  }

  if (
    taskStatuses.some(
      (status) => status === "accepted" || status === "hired",
    )
  ) {
    return { status: "accepted", overallStatus: "accepted" };
  }

  return { status: "open", overallStatus: "open" };
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
    const contractorProfile = await findContractorProfile(decodedToken.uid);

    if (!contractorProfile) {
      return NextResponse.json(
        {
          code: "contractor-profile-required",
          message: "Please use a contractor account.",
        },
        { status: 403 },
      );
    }

    const contractorId =
      readText(contractorProfile.get("contractorId")) || contractorProfile.id;
    const { jobId } = await context.params;
    const body = (await request.json()) as DecisionBody;
    const decision = readText(body.decision);
    const reason = readText(body.reason);

    if (decision !== "accepted" && decision !== "rejected") {
      return NextResponse.json(
        {
          code: "invalid-decision",
          message: "Please accept or reject this job.",
        },
        { status: 400 },
      );
    }

    const jobDocument = adminDb.collection("jobs").doc(jobId);
    let customerAuthUid = "";

    await adminDb.runTransaction(async (transaction) => {
      const jobSnapshot = await transaction.get(jobDocument);

      if (!jobSnapshot.exists) {
        throw Object.assign(new Error("This job could not be found."), {
          code: "job-not-found",
        });
      }

      customerAuthUid = readText(jobSnapshot.get("customerAuthUid"));
      const tasksSnapshot = await transaction.get(
        jobDocument.collection("tasks"),
      );
      const currentContractorProfile = await transaction.get(
        contractorProfile.ref,
      );
      const assignedPendingTasks = tasksSnapshot.docs.filter(
        (taskSnapshot) =>
          taskSnapshot.get("status") === "hired_pending_contractor" &&
          (taskSnapshot.get("hiredContractorAuthUid") === decodedToken.uid ||
            readText(taskSnapshot.get("hiredContractorId")) === contractorId),
      );
      const callerOwnsParent =
        jobSnapshot.get("hiredContractorAuthUid") === decodedToken.uid ||
        readText(jobSnapshot.get("hiredContractorId")) === contractorId;

      if (assignedPendingTasks.length === 0 && !callerOwnsParent) {
        throw Object.assign(
          new Error("Only the selected contractor can decide this job."),
          { code: "job-access-denied" },
        );
      }

      if (
        assignedPendingTasks.length === 0 &&
        readText(jobSnapshot.get("status")) !== "hired_pending_contractor"
      ) {
        throw Object.assign(
          new Error("This job is no longer waiting for your decision."),
          { code: "decision-not-pending" },
        );
      }

      const changedAt = FieldValue.serverTimestamp();

      if (decision === "accepted") {
        const subscription = getSubscriptionSummary(
          currentContractorProfile.data() ?? {},
        );

        if (
          subscription.plan.acceptedJobsLimit !== null &&
          subscription.acceptedJobsThisMonth >=
            subscription.plan.acceptedJobsLimit
        ) {
          throw Object.assign(
            new Error(
              `Your ${subscription.plan.name} plan has reached its ${subscription.plan.acceptedJobsLimit}-job monthly limit. Visit Subscription settings to review your plan.`,
            ),
            { code: "subscription-job-limit-reached" },
          );
        }

        transaction.set(
          contractorProfile.ref,
          {
            subscriptionPlan: subscription.plan.id,
            subscriptionStatus: subscription.status,
            subscriptionTrialStartedAt: subscription.trialStartedAt,
            subscriptionTrialEndsAt: subscription.trialEndsAt,
            subscriptionAcceptedJobsMonth: subscription.usageMonth,
            subscriptionAcceptedJobsCount:
              subscription.acceptedJobsThisMonth + 1,
            subscriptionUpdatedAt: changedAt,
          },
          { merge: true },
        );

        assignedPendingTasks.forEach((taskSnapshot) => {
          transaction.set(
            taskSnapshot.ref,
            {
              status: "accepted",
              contractorDecisionStatus: "accepted",
              acceptedAt: changedAt,
              updatedAt: changedAt,
            },
            { merge: true },
          );
        });

        const nextTaskStatuses = tasksSnapshot.docs.map((taskSnapshot) =>
          assignedPendingTasks.some(
            (assignedTask) => assignedTask.id === taskSnapshot.id,
          )
            ? "accepted"
            : readText(taskSnapshot.get("status")),
        );
        const parentStatus =
          nextTaskStatuses.length > 0
            ? getParentStatus(nextTaskStatuses)
            : { status: "accepted", overallStatus: "accepted" };

        transaction.set(
          jobDocument,
          {
            ...parentStatus,
            contractorDecisionStatus: "accepted",
            acceptedAt: changedAt,
            updatedAt: changedAt,
          },
          { merge: true },
        );
      } else {
        assignedPendingTasks.forEach((taskSnapshot) => {
          transaction.set(
            taskSnapshot.ref,
            {
              status: "open",
              matchingStatus: "open",
              contractorDecisionStatus: "rejected",
              rejectedAt: changedAt,
              rejectionReason: reason,
              rejectedContractorIds: FieldValue.arrayUnion(contractorId),
              hiredContractorId: FieldValue.delete(),
              hiredContractorAuthUid: FieldValue.delete(),
              hiredContractorName: FieldValue.delete(),
              hiredBusinessName: FieldValue.delete(),
              updatedAt: changedAt,
            },
            { merge: true },
          );
        });

        const nextTaskStatuses = tasksSnapshot.docs.map((taskSnapshot) =>
          assignedPendingTasks.some(
            (assignedTask) => assignedTask.id === taskSnapshot.id,
          )
            ? "open"
            : readText(taskSnapshot.get("status")),
        );
        const parentStatus =
          nextTaskStatuses.length > 0
            ? getParentStatus(nextTaskStatuses)
            : { status: "open", overallStatus: "open" };
        const clearParentAssignment =
          readText(jobSnapshot.get("hiredContractorId")) === contractorId;

        transaction.set(
          jobDocument,
          {
            ...parentStatus,
            matchingStatus: "open",
            contractorDecisionStatus: "rejected",
            rejectedAt: changedAt,
            rejectionReason: reason,
            rejectedContractorIds: FieldValue.arrayUnion(contractorId),
            hiredContractorIds: FieldValue.arrayRemove(contractorId),
            hiredContractorAuthUids: FieldValue.arrayRemove(decodedToken.uid),
            ...(clearParentAssignment
              ? {
                  hiredContractorId: FieldValue.delete(),
                  hiredContractorAuthUid: FieldValue.delete(),
                  hiredContractorName: FieldValue.delete(),
                  hiredBusinessName: FieldValue.delete(),
                }
              : {}),
            updatedAt: changedAt,
          },
          { merge: true },
        );
      }

      transaction.set(jobDocument.collection("statusHistory").doc(), {
        fromStatus: "hired_pending_contractor",
        toStatus: decision === "accepted" ? "accepted" : "open",
        status: decision === "accepted" ? "accepted" : "open",
        changedAt,
        changedByRole: "contractor",
        changedByUid: decodedToken.uid,
        contractorId,
        note:
          decision === "accepted"
            ? "Contractor accepted the job"
            : `Contractor rejected the job${reason ? `: ${reason}` : ""}`,
      });
    });

    if (customerAuthUid) {
      await createNotification({
        recipientAuthUid: customerAuthUid,
        recipientRole: "customer",
        type:
          decision === "accepted"
            ? "contractor_accepted"
            : "contractor_rejected",
        title:
          decision === "accepted"
            ? "Contractor accepted"
            : "Contractor declined",
        message:
          decision === "accepted"
            ? "Your contractor accepted the job."
            : "The contractor declined. Your job is open again.",
        jobId,
      });
    }

    return NextResponse.json({ ok: true, decision });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Contractor decision API failed:", { code, message, error });

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
              : code === "decision-not-pending"
                  ? 409
                  : code === "subscription-job-limit-reached"
                    ? 403
                  : 500,
      },
    );
  }
}
