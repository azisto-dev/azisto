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

function getFirstName(name: string) {
  return name.trim().split(" ").filter(Boolean)[0] ?? "";
}

async function getCustomerFirstName(data: Record<string, unknown>) {
  const savedFirstName = getFirstName(readText(data.customerFirstName));

  if (savedFirstName) {
    return savedFirstName;
  }

  const customerId = readText(data.customerId);

  if (!customerId) {
    return "Customer";
  }

  const customerSnapshot = await adminDb.collection("customers").doc(customerId).get();

  if (!customerSnapshot.exists) {
    return "Customer";
  }

  return getFirstName(readText(customerSnapshot.get("fullName"))) || "Customer";
}

function getErrorDetails(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";
  const message = error instanceof Error ? error.message : "Unknown error";

  return { code, message };
}

async function findContractorProfile(firebaseUid: string) {
  const contractorsCollection = adminDb.collection("contractors");
  const authUidSnapshot = await contractorsCollection
    .where("authUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!authUidSnapshot.empty) {
    return authUidSnapshot.docs[0];
  }

  const legacyFirebaseUidSnapshot = await contractorsCollection
    .where("firebaseUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!legacyFirebaseUidSnapshot.empty) {
    return legacyFirebaseUidSnapshot.docs[0];
  }

  const legacyDocumentSnapshot = await contractorsCollection.doc(firebaseUid).get();

  return legacyDocumentSnapshot.exists ? legacyDocumentSnapshot : null;
}

async function serializeJob(data: Record<string, unknown>, relationship: string) {
  return {
    jobId: readText(data.jobId),
    parentJobId: readText(data.parentJobId),
    taskId: readText(data.taskId),
    customerId: readText(data.customerId),
    customerFirstName: await getCustomerFirstName(data),
    selectedServiceCategory: readText(data.selectedServiceCategory),
    selectedSubcategories: readStringList(data.selectedSubcategories),
    city: readText(data.city),
    province: readText(data.province),
    scheduleMode: readText(data.scheduleMode),
    preferredDate: readText(data.preferredDate),
    preferredTime: readText(data.preferredTime),
    preferredTimeWindow: readText(data.preferredTimeWindow),
    urgency: readText(data.urgency),
    schedule: readSchedule(data.schedule),
    status: readText(data.status),
    matchingStatus: readText(data.matchingStatus),
    hiredContractorId: readText(data.hiredContractorId),
    hiredBusinessName: readText(data.hiredBusinessName),
    relationship,
    completedAt: serializeTimestamp(data.completedAt),
    cancelledAt: serializeTimestamp(data.cancelledAt),
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
}

async function serializeTaskJob(
  parentData: Record<string, unknown>,
  taskData: Record<string, unknown>,
  relationship: string,
) {
  const parentJobId = readText(taskData.parentJobId) || readText(parentData.jobId);
  const taskId = readText(taskData.taskId);
  const subcategory = readText(taskData.subcategory);
  const category =
    readText(taskData.category) || readText(parentData.selectedServiceCategory);

  return serializeJob(
    {
      ...parentData,
      jobId: taskId || parentJobId,
      parentJobId,
      taskId,
      selectedServiceCategory: category,
      selectedSubcategories: subcategory ? [subcategory] : [],
      city: readText(taskData.city) || readText(parentData.city),
      province: readText(taskData.province) || readText(parentData.province),
      preferredDate:
        readText(taskData.preferredDate) || readText(parentData.preferredDate),
      preferredTime:
        readText(taskData.preferredTime) || readText(parentData.preferredTime),
      preferredTimeWindow:
        readText(taskData.preferredTimeWindow) ||
        readText(parentData.preferredTimeWindow),
      urgency: readText(taskData.urgency) || readText(parentData.urgency),
      scheduleMode:
        readText(taskData.scheduleMode) || readText(parentData.scheduleMode),
      schedule: readSchedule(taskData.schedule) || readSchedule(parentData.schedule),
      status: readText(taskData.status) || readText(parentData.status),
      hiredContractorId: readText(taskData.hiredContractorId),
      createdAt: taskData.createdAt ?? parentData.createdAt,
      updatedAt: taskData.updatedAt ?? parentData.updatedAt,
    },
    relationship,
  );
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
    const contractorProfile = await findContractorProfile(decodedToken.uid);

    if (!contractorProfile) {
      return NextResponse.json(
        {
          code: "contractor-profile-required",
          message: "Please use a contractor account to view your jobs.",
        },
        { status: 403 },
      );
    }

    const contractorId =
      readText(contractorProfile.get("contractorId")) || contractorProfile.id;
    const hiredJobsSnapshot = await adminDb
      .collection("jobs")
      .where("hiredContractorId", "==", contractorId)
      .get();
    const interestedSnapshot = await adminDb
      .collection("jobs")
      .where("interestedContractorIds", "array-contains", contractorId)
      .get();
    const hiredTaskParentsSnapshot = await adminDb
      .collection("jobs")
      .where("hiredContractorIds", "array-contains", contractorId)
      .get();
    const jobsById = new Map<string, Awaited<ReturnType<typeof serializeJob>>>();

    for (const documentSnapshot of hiredJobsSnapshot.docs) {
      jobsById.set(
        documentSnapshot.id,
        await serializeJob(documentSnapshot.data(), "hired"),
      );
    }

    for (const parentSnapshot of hiredTaskParentsSnapshot.docs) {
      const tasksSnapshot = await parentSnapshot.ref.collection("tasks").get();

      for (const taskSnapshot of tasksSnapshot.docs) {
        if (readText(taskSnapshot.get("hiredContractorId")) !== contractorId) {
          continue;
        }

        if (jobsById.has(taskSnapshot.id)) {
          continue;
        }

        jobsById.set(
          taskSnapshot.id,
          await serializeTaskJob(
            parentSnapshot.data() ?? {},
            taskSnapshot.data() ?? {},
            "hired",
          ),
        );
      }
    }

    for (const jobSnapshot of interestedSnapshot.docs) {
      if (jobsById.has(jobSnapshot.id)) {
        continue;
      }

      const jobStatus = readText(jobSnapshot.get("status"));

      if (jobStatus !== "open") {
        continue;
      }

      jobsById.set(
        jobSnapshot.id,
        await serializeJob(jobSnapshot.data() ?? {}, "interested"),
      );
    }

    // Older interest records without interestedContractorIds are intentionally not backfilled here.
    // New interest submissions write this array field and avoid Firestore collection-group indexes.

    const jobs = Array.from(jobsById.values()).sort((firstJob, secondJob) =>
      secondJob.createdAt.localeCompare(firstJob.createdAt),
    );

    return NextResponse.json({ ok: true, jobs });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Contractor my jobs API failed:", {
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
