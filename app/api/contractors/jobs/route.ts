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

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

async function serializeJob(data: Record<string, unknown>) {
  return {
    jobId: typeof data.jobId === "string" ? data.jobId : "",
    parentJobId: readText(data.parentJobId),
    taskId: readText(data.taskId),
    customerId: typeof data.customerId === "string" ? data.customerId : "",
    customerFirstName: await getCustomerFirstName(data),
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
    hiredContractorId: readText(data.hiredContractorId),
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
}

async function serializeTaskCard(
  parentData: Record<string, unknown>,
  taskData: Record<string, unknown>,
) {
  const taskId = readText(taskData.taskId);
  const parentJobId = readText(taskData.parentJobId) || readText(parentData.jobId);
  const subcategory = readText(taskData.subcategory);
  const category =
    readText(taskData.category) || readText(parentData.selectedServiceCategory);

  return serializeJob({
    ...parentData,
    jobId: taskId || parentJobId,
    parentJobId,
    taskId,
    selectedServiceCategory: category,
    selectedSubcategories: subcategory ? [subcategory] : [],
    jobDescription:
      readText(taskData.jobDescription) || readText(parentData.jobDescription),
    city: readText(taskData.city) || readText(parentData.city),
    province: readText(taskData.province) || readText(parentData.province),
    postalCode: readText(taskData.postalCode) || readText(parentData.postalCode),
    preferredDate:
      readText(taskData.preferredDate) || readText(parentData.preferredDate),
    preferredTime:
      readText(taskData.preferredTime) || readText(parentData.preferredTime),
    urgency: readText(taskData.urgency) || readText(parentData.urgency),
    status: readText(taskData.status) || readText(parentData.status),
    hiredContractorId: readText(taskData.hiredContractorId),
    createdAt: taskData.createdAt ?? parentData.createdAt,
    updatedAt: taskData.updatedAt ?? parentData.updatedAt,
  });
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
    const filteredJobDocs = openJobsSnapshot.docs.filter((documentSnapshot) => {
        const data = documentSnapshot.data();

        return (
          readText(data.matchingStatus) !== "paused" &&
          !readText(data.hiredContractorId)
        );
      });
    const jobs = (
      await Promise.all(
        filteredJobDocs.map(async (documentSnapshot) => {
          const parentData = documentSnapshot.data();
          const tasksSnapshot = await documentSnapshot.ref
            .collection("tasks")
            .where("status", "==", "open")
            .get();

          if (tasksSnapshot.empty) {
            return [await serializeJob(parentData)];
          }

          return Promise.all(
            tasksSnapshot.docs
              .filter((taskSnapshot) => !readText(taskSnapshot.get("hiredContractorId")))
              .map((taskSnapshot) =>
                serializeTaskCard(parentData, taskSnapshot.data()),
              ),
          );
        }),
      )
    ).flat().sort((firstJob, secondJob) =>
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
