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

async function findCustomerId(firebaseUid: string) {
  const customersCollection = adminDb.collection("customers");
  const authUidSnapshot = await customersCollection
    .where("authUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!authUidSnapshot.empty) {
    return readText(authUidSnapshot.docs[0].get("customerId")) || authUidSnapshot.docs[0].id;
  }

  const legacyFirebaseUidSnapshot = await customersCollection
    .where("firebaseUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!legacyFirebaseUidSnapshot.empty) {
    return (
      readText(legacyFirebaseUidSnapshot.docs[0].get("customerId")) ||
      legacyFirebaseUidSnapshot.docs[0].id
    );
  }

  const legacyDocumentSnapshot = await customersCollection.doc(firebaseUid).get();

  return legacyDocumentSnapshot.exists
    ? readText(legacyDocumentSnapshot.get("customerId")) ||
        legacyDocumentSnapshot.id
    : "";
}

function serializeJob(data: Record<string, unknown>) {
  return {
    jobId: readText(data.jobId),
    customerId: readText(data.customerId),
    selectedServiceCategory: readText(data.selectedServiceCategory),
    selectedSubcategories: readStringList(data.selectedSubcategories),
    city: readText(data.city),
    province: readText(data.province),
    preferredDate: readText(data.preferredDate),
    preferredTime: readText(data.preferredTime),
    urgency: readText(data.urgency),
    status: readText(data.status),
    matchingStatus: readText(data.matchingStatus),
    hiredContractorId: readText(data.hiredContractorId),
    hiredContractorName: readText(data.hiredContractorName),
    hiredBusinessName: readText(data.hiredBusinessName),
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
}

function serializeTask(data: Record<string, unknown>) {
  return {
    taskId: readText(data.taskId),
    parentJobId: readText(data.parentJobId),
    category: readText(data.category),
    subcategory: readText(data.subcategory),
    status: readText(data.status),
    hiredContractorId: readText(data.hiredContractorId),
    hiredContractorAuthUid: readText(data.hiredContractorAuthUid),
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
    const customerId = await findCustomerId(decodedToken.uid);

    if (!customerId) {
      return NextResponse.json(
        {
          code: "customer-profile-required",
          message: "Please use a customer account to view your jobs.",
        },
        { status: 403 },
      );
    }

    const jobsSnapshot = await adminDb
      .collection("jobs")
      .where("customerAuthUid", "==", decodedToken.uid)
      .get();
    const jobs = (
      await Promise.all(
        jobsSnapshot.docs.map(async (documentSnapshot) => {
          const tasksSnapshot = await documentSnapshot.ref.collection("tasks").get();
          const tasks = tasksSnapshot.docs
            .map((taskSnapshot) => serializeTask(taskSnapshot.data()))
            .sort((firstTask, secondTask) =>
              firstTask.taskId.localeCompare(secondTask.taskId),
            );

          return {
            ...serializeJob(documentSnapshot.data()),
            overallStatus: readText(documentSnapshot.get("overallStatus")),
            requiresMultipleContractors:
              documentSnapshot.get("requiresMultipleContractors") === true,
            taskCount:
              typeof documentSnapshot.get("taskCount") === "number"
                ? documentSnapshot.get("taskCount")
                : tasks.length,
            tasks,
          };
        }),
      )
    )
      .sort((firstJob, secondJob) =>
        secondJob.createdAt.localeCompare(firstJob.createdAt),
      );

    return NextResponse.json({ ok: true, jobs });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Customer jobs API failed:", {
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
