import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import {
  matchesServiceCity,
  sanitizeServiceCities,
} from "@/lib/serviceAreas";
import { isJobExpired } from "@/lib/jobExpiry";
import { isCancellationVisible } from "@/lib/jobCancellation";

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

  const legacyDocumentSnapshot = await contractorsCollection
    .doc(firebaseUid)
    .get();

  return legacyDocumentSnapshot.exists ? legacyDocumentSnapshot : null;
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
    scheduleMode: readText(data.scheduleMode),
    postalCode: typeof data.postalCode === "string" ? data.postalCode : "",
    preferredDate:
      typeof data.preferredDate === "string" ? data.preferredDate : "",
    preferredTime:
      typeof data.preferredTime === "string" ? data.preferredTime : "",
    preferredTimeWindow: readText(data.preferredTimeWindow),
    urgency: typeof data.urgency === "string" ? data.urgency : "",
    schedule: readSchedule(data.schedule),
    status: typeof data.status === "string" ? data.status : "",
    matchingStatus:
      typeof data.matchingStatus === "string" ? data.matchingStatus : "",
    hiredContractorId: readText(data.hiredContractorId),
    cancelledAt: serializeTimestamp(data.cancelledAt),
    cancelledVisibleUntil: serializeTimestamp(data.cancelledVisibleUntil),
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
    preferredTimeWindow:
      readText(taskData.preferredTimeWindow) ||
      readText(parentData.preferredTimeWindow),
    urgency: readText(taskData.urgency) || readText(parentData.urgency),
    scheduleMode: readText(taskData.scheduleMode) || readText(parentData.scheduleMode),
    schedule: readSchedule(taskData.schedule) || readSchedule(parentData.schedule),
    status: readText(taskData.status) || readText(parentData.status),
    hiredContractorId: readText(taskData.hiredContractorId),
    cancelledAt: taskData.cancelledAt ?? parentData.cancelledAt,
    cancelledVisibleUntil:
      taskData.cancelledVisibleUntil ?? parentData.cancelledVisibleUntil,
    createdAt: taskData.createdAt ?? parentData.createdAt,
    updatedAt: taskData.updatedAt ?? parentData.updatedAt,
  });
}

function isAvailableParent(data: Record<string, unknown>) {
  if (readText(data.status) === "cancelled") {
    return isCancellationVisible(data);
  }

  return (
    readText(data.status) === "open" &&
    readText(data.matchingStatus) !== "paused" &&
    !readText(data.hiredContractorId) &&
    !isJobExpired(data)
  );
}

function isAvailableTask(
  parentData: Record<string, unknown>,
  taskData: Record<string, unknown>,
) {
  if (readText(taskData.status) === "cancelled") {
    return isCancellationVisible(taskData);
  }

  return (
    readText(taskData.status) === "open" &&
    !readText(taskData.hiredContractorId) &&
    !isJobExpired({ ...parentData, ...taskData })
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
          message: "Please use a contractor account to view available jobs.",
        },
        { status: 403 },
      );
    }

    const savedPreferences = contractorProfile.get("jobFilterPreferences");
    const preferencesData =
      typeof savedPreferences === "object" && savedPreferences !== null
        ? (savedPreferences as Record<string, unknown>)
        : {};
    const serviceCities = sanitizeServiceCities(
      preferencesData.serviceCities ?? preferencesData.cities,
    );
    const [openJobsSnapshot, cancelledJobsSnapshot] = await Promise.all([
      adminDb.collection("jobs").where("status", "==", "open").get(),
      adminDb.collection("jobs").where("status", "==", "cancelled").get(),
    ]);
    const filteredJobDocs = [
      ...openJobsSnapshot.docs,
      ...cancelledJobsSnapshot.docs,
    ].filter((documentSnapshot) =>
      isAvailableParent(documentSnapshot.data()),
    );
    const jobs = (
      await Promise.all(
        filteredJobDocs.map(async (documentSnapshot) => {
          const parentData = documentSnapshot.data();
          const tasksSnapshot = await documentSnapshot.ref
            .collection("tasks")
            .get();

          if (tasksSnapshot.empty) {
            return [await serializeJob(parentData)];
          }

          return Promise.all(
            tasksSnapshot.docs
              .filter((taskSnapshot) =>
                isAvailableTask(parentData, taskSnapshot.data()),
              )
              .map((taskSnapshot) =>
                serializeTaskCard(parentData, taskSnapshot.data()),
              ),
          );
        }),
      )
    )
      .flat()
      .filter((job) => matchesServiceCity(job.city, serviceCities))
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
