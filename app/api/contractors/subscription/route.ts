import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import { getSubscriptionSummary } from "@/lib/subscriptions";

export const runtime = "nodejs";

function getBearerToken(authorizationHeader: string | null) {
  return authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : "";
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

export async function GET(request: NextRequest) {
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
          message: "Please complete your contractor profile first.",
        },
        { status: 403 },
      );
    }

    const data = contractorProfile.data() ?? {};
    const summary = getSubscriptionSummary(data);

    return NextResponse.json({
      ok: true,
      subscription: {
        planId: summary.plan.id,
        planName: summary.plan.name,
        status: summary.status,
        trialDaysRemaining: summary.trialDaysRemaining,
        trialStartedAt: summary.trialStartedAt.toISOString(),
        trialEndsAt: summary.trialEndsAt.toISOString(),
        acceptedJobsThisMonth: summary.acceptedJobsThisMonth,
        jobsRemaining: summary.jobsRemaining,
        acceptedJobsLimit: summary.plan.acceptedJobsLimit,
        usageMonth: summary.usageMonth,
        billingCycleStart: summary.billingCycleStart.toISOString(),
        billingCycleEnd: summary.billingCycleEnd.toISOString(),
      },
    });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Contractor subscription API failed:", {
      code,
      message,
      error,
    });

    return NextResponse.json(
      { code, message },
      { status: code === "missing-token" ? 401 : 500 },
    );
  }
}

