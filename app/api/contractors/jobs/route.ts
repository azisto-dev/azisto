import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return "";
  }

  return authorizationHeader.slice("Bearer ".length).trim();
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

function readBoolean(value: unknown) {
  return value === true;
}

function readNumber(value: unknown) {
  return typeof value === "number" ? value : 0;
}

function serializeTimestamp(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return "";
}

function getErrorDetails(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";
  const message = error instanceof Error ? error.message : "Unknown error";

  return { code, message };
}

async function hasContractorProfile(firebaseUid: string) {
  const contractorsCollection = adminDb.collection("contractors");
  const authUidSnapshot = await contractorsCollection
    .where("authUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!authUidSnapshot.empty) {
    return true;
  }

  const legacyFirebaseUidSnapshot = await contractorsCollection
    .where("firebaseUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!legacyFirebaseUidSnapshot.empty) {
    return true;
  }

  const legacyDocumentSnapshot = await contractorsCollection
    .doc(firebaseUid)
    .get();

  return legacyDocumentSnapshot.exists;
}

function serializeJob(data: Record<string, unknown>) {
  return {
    jobId: typeof data.jobId === "string" ? data.jobId : "",
    customerId: typeof data.customerId === "string" ? data.customerId : "",
    customerEmailVerified: readBoolean(data.customerEmailVerified),
    customerPhoneVerified: readBoolean(data.customerPhoneVerified),
    customerCompletedJobsCount: readNumber(data.customerCompletedJobsCount),
    customerReportsCount: readNumber(data.customerReportsCount),
    selectedServiceCategory:
      typeof data.selectedServiceCategory === "string"
        ? data.selectedServiceCategory
        : "",
    selectedSubcategories: readStringList(data.selectedSubcategories),
    jobDescription:
      typeof data.jobDescription === "string" ? data.jobDescription : "",
    photos: Array.isArray(data.photos) ? data.photos : [],
    photoPlaceholders: readStringList(data.photoPlaceholders),
    address: typeof data.address === "string" ? data.address : "",
    city: typeof data.city === "string" ? data.city : "",
    province: typeof data.province === "string" ? data.province : "",
    postalCode: typeof data.postalCode === "string" ? data.postalCode : "",
    preferredDate:
      typeof data.preferredDate === "string" ? data.preferredDate : "",
    preferredTime:
      typeof data.preferredTime === "string" ? data.preferredTime : "",
    urgency: typeof data.urgency === "string" ? data.urgency : "",
    status: typeof data.status === "string" ? data.status : "",
    matchingStatus:
      typeof data.matchingStatus === "string" ? data.matchingStatus : "",
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
}

export async function GET(request: NextRequest) {
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
    const isContractor = await hasContractorProfile(decodedToken.uid);

    if (!isContractor) {
      return NextResponse.json(
        {
          code: "contractor-profile-required",
          message: "Please use a contractor account to view available jobs.",
        },
        { status: 403 },
      );
    }

    const openJobsSnapshot = await adminDb
      .collection("jobs")
      .where("status", "==", "open")
      .get();
    const jobs = openJobsSnapshot.docs
      .map((documentSnapshot) => serializeJob(documentSnapshot.data()))
      .sort((firstJob, secondJob) =>
        secondJob.createdAt.localeCompare(firstJob.createdAt),
      );

    return NextResponse.json({ ok: true, jobs });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Contractor jobs API failed:", {
      code,
      message,
      error,
    });

    return NextResponse.json(
      {
        code,
        message,
      },
      { status: code === "missing-token" ? 401 : 500 },
    );
  }
}
