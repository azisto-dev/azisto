import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import { readJobProofPhotos } from "@/lib/jobProofPhotos";

export const runtime = "nodejs";

const activeStatuses = new Set([
  "hired_pending_contractor",
  "accepted",
  "hired",
  "on_the_way",
  "in_progress",
  "completion_pending_customer",
  "completed",
]);

function getBearerToken(authorizationHeader: string | null) {
  return authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : "";
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readSchedule(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const data = value as Record<string, unknown>;

  return {
    mode: readText(data.mode),
    date: readText(data.date),
    timeWindow: readText(data.timeWindow),
    urgency: readText(data.urgency),
  };
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

function serializeJob(data: Record<string, unknown>) {
  return {
    jobId: readText(data.jobId),
    selectedServiceCategory: readText(data.selectedServiceCategory),
    selectedSubcategories: readStringList(data.selectedSubcategories),
    hiredContractorId: readText(data.hiredContractorId),
    hiredContractorName: readText(data.hiredContractorName),
    hiredBusinessName: readText(data.hiredBusinessName),
    status: readText(data.status),
    scheduleMode: readText(data.scheduleMode),
    preferredDate: readText(data.preferredDate),
    preferredTime: readText(data.preferredTime),
    preferredTimeWindow: readText(data.preferredTimeWindow),
    urgency: readText(data.urgency),
    schedule: readSchedule(data.schedule),
    beforePhotos: readJobProofPhotos(data.beforePhotos),
    afterPhotos: readJobProofPhotos(data.afterPhotos),
    createdAt: serializeTimestamp(data.createdAt),
  };
}

export async function GET(request: NextRequest) {
  try {
    assertFirebaseAdminConfig();
    const token = getBearerToken(request.headers.get("authorization"));

    if (!token) {
      return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const jobsSnapshot = await adminDb
      .collection("jobs")
      .where("customerAuthUid", "==", decodedToken.uid)
      .get();
    const jobs = jobsSnapshot.docs
      .filter((documentSnapshot) =>
        activeStatuses.has(readText(documentSnapshot.get("status"))),
      )
      .map((documentSnapshot) => serializeJob(documentSnapshot.data()))
      .sort((firstJob, secondJob) =>
        secondJob.createdAt.localeCompare(firstJob.createdAt),
      );

    return NextResponse.json({ ok: true, jobs });
  } catch (error) {
    console.error("Customer active jobs API failed:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to load jobs." },
      { status: 500 },
    );
  }
}
