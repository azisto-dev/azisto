import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const activeStatuses = new Set([
  "hired_pending_contractor",
  "accepted",
  "hired",
  "on_the_way",
  "in_progress",
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

async function findContractorId(firebaseUid: string) {
  const contractorsCollection = adminDb.collection("contractors");
  const snapshot = await contractorsCollection
    .where("authUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    return readText(snapshot.docs[0].get("contractorId")) || snapshot.docs[0].id;
  }

  const legacySnapshot = await contractorsCollection
    .where("firebaseUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!legacySnapshot.empty) {
    return readText(legacySnapshot.docs[0].get("contractorId")) || legacySnapshot.docs[0].id;
  }

  return "";
}

function serializeJob(data: Record<string, unknown>) {
  return {
    jobId: readText(data.jobId),
    parentJobId: readText(data.parentJobId),
    taskId: readText(data.taskId),
    customerId: readText(data.customerId),
    selectedServiceCategory: readText(data.selectedServiceCategory),
    selectedSubcategories: readStringList(data.selectedSubcategories),
    city: readText(data.city),
    province: readText(data.province),
    status: readText(data.status),
    scheduleMode: readText(data.scheduleMode),
    preferredDate: readText(data.preferredDate),
    preferredTime: readText(data.preferredTime),
    preferredTimeWindow: readText(data.preferredTimeWindow),
    urgency: readText(data.urgency),
    schedule: readSchedule(data.schedule),
    createdAt: serializeTimestamp(data.createdAt),
  };
}

function serializeTaskJob(
  parentData: Record<string, unknown>,
  taskData: Record<string, unknown>,
) {
  const parentJobId =
    readText(taskData.parentJobId) || readText(parentData.jobId);
  const taskId = readText(taskData.taskId);
  const subcategory = readText(taskData.subcategory);

  return serializeJob({
    ...parentData,
    jobId: taskId || parentJobId,
    parentJobId,
    taskId,
    selectedServiceCategory:
      readText(taskData.category) ||
      readText(parentData.selectedServiceCategory),
    selectedSubcategories: subcategory ? [subcategory] : [],
    city: readText(taskData.city) || readText(parentData.city),
    province: readText(taskData.province) || readText(parentData.province),
    status: readText(taskData.status) || readText(parentData.status),
    scheduleMode:
      readText(taskData.scheduleMode) || readText(parentData.scheduleMode),
    preferredDate:
      readText(taskData.preferredDate) || readText(parentData.preferredDate),
    preferredTime:
      readText(taskData.preferredTime) || readText(parentData.preferredTime),
    preferredTimeWindow:
      readText(taskData.preferredTimeWindow) ||
      readText(parentData.preferredTimeWindow),
    urgency: readText(taskData.urgency) || readText(parentData.urgency),
    schedule: readSchedule(taskData.schedule) || readSchedule(parentData.schedule),
    createdAt: taskData.createdAt ?? parentData.createdAt,
  });
}

export async function GET(request: NextRequest) {
  try {
    assertFirebaseAdminConfig();
    const token = getBearerToken(request.headers.get("authorization"));

    if (!token) {
      return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const contractorId = await findContractorId(decodedToken.uid);

    if (!contractorId) {
      return NextResponse.json(
        { message: "Please use a contractor account." },
        { status: 403 },
      );
    }

    const jobsSnapshot = await adminDb
      .collection("jobs")
      .where("hiredContractorId", "==", contractorId)
      .get();
    const taskParentsSnapshot = await adminDb
      .collection("jobs")
      .where("hiredContractorIds", "array-contains", contractorId)
      .get();
    const jobsById = new Map<string, ReturnType<typeof serializeJob>>();

    jobsSnapshot.docs
      .filter((documentSnapshot) =>
        activeStatuses.has(readText(documentSnapshot.get("status"))),
      )
      .forEach((documentSnapshot) => {
        jobsById.set(
          documentSnapshot.id,
          serializeJob(documentSnapshot.data()),
        );
      });

    for (const parentSnapshot of taskParentsSnapshot.docs) {
      const tasksSnapshot = await parentSnapshot.ref.collection("tasks").get();

      tasksSnapshot.docs
        .filter(
          (taskSnapshot) =>
            readText(taskSnapshot.get("hiredContractorId")) === contractorId &&
            activeStatuses.has(readText(taskSnapshot.get("status"))),
        )
        .forEach((taskSnapshot) => {
          jobsById.set(
            taskSnapshot.id,
            serializeTaskJob(
              parentSnapshot.data() ?? {},
              taskSnapshot.data() ?? {},
            ),
          );
        });
    }

    const jobs = Array.from(jobsById.values()).sort((firstJob, secondJob) =>
      secondJob.createdAt.localeCompare(firstJob.createdAt),
    );

    return NextResponse.json({ ok: true, jobs });
  } catch (error) {
    console.error("Contractor active jobs API failed:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to load jobs." },
      { status: 500 },
    );
  }
}
