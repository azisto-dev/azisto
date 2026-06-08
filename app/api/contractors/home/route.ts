import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import {
  firebaseQuotaMessage,
  isQuotaExceededMessage,
} from "@/lib/apiErrors";
import { getServiceFilterOptions } from "@/lib/serviceCatalog";
import {
  matchesServiceCity,
  sanitizeServiceCities,
  serviceAreaCities,
} from "@/lib/serviceAreas";
import { createNotification } from "@/lib/notifications";
import {
  getMatchingContractorSubcategories,
  hasActiveContractorSubscription,
  isContractorEligibleForJobNotifications,
} from "@/lib/contractorJobMatching";

export const runtime = "nodejs";

type FilterPreferences = {
  categories: string[];
  subcategories: string[];
  serviceCities: string[];
  urgency: "any" | "flexible" | "this_week" | "urgent";
  sort: "newest" | "urgent";
};

const defaultFilterPreferences: FilterPreferences = {
  categories: [],
  subcategories: [],
  serviceCities: [],
  urgency: "any",
  sort: "newest",
};

const urgencyRank: Record<string, number> = {
  urgent: 3,
  "this week": 2,
  this_week: 2,
  flexible: 1,
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

function readBoolean(value: unknown) {
  return value === true;
}

function readNumber(value: unknown) {
  return typeof value === "number" ? value : 0;
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

function readLimitedStringList(value: unknown) {
  return readStringList(value).slice(0, 30);
}

function readUrgency(value: unknown): FilterPreferences["urgency"] {
  return value === "flexible" || value === "this_week" || value === "urgent"
    ? value
    : "any";
}

function readSort(value: unknown): FilterPreferences["sort"] {
  return value === "urgent" ? "urgent" : "newest";
}

function normalizePreferences(value: unknown): FilterPreferences {
  if (typeof value !== "object" || value === null) {
    return defaultFilterPreferences;
  }

  const data = value as Record<string, unknown>;

  return {
    categories: readLimitedStringList(data.categories),
    subcategories: readLimitedStringList(data.subcategories),
    serviceCities: sanitizeServiceCities(data.serviceCities ?? data.cities),
    urgency: readUrgency(data.urgency),
    sort: readSort(data.sort),
  };
}

function parseCsv(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 60);
}

function readQueryPreferences(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const hasQueryFilters = [
    "filterOverride",
    "categories",
    "subcategories",
    "serviceCities",
    "cities",
    "urgency",
    "sort",
  ].some((key) => searchParams.has(key));

  if (!hasQueryFilters) {
    return null;
  }

  return {
    categories: parseCsv(searchParams.get("categories")),
    subcategories: parseCsv(searchParams.get("subcategories")),
    serviceCities: sanitizeServiceCities(
      parseCsv(
        searchParams.get("serviceCities") ?? searchParams.get("cities"),
      ),
    ),
    urgency: readUrgency(searchParams.get("urgency")),
    sort: readSort(searchParams.get("sort")),
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

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getSafetyBadges(data: Record<string, unknown>) {
  const badges = [];

  if (readBoolean(data.customerEmailVerified)) {
    badges.push("Email verified");
  }

  if (readBoolean(data.customerPhoneVerified)) {
    badges.push("Phone verified");
  }

  const completedJobsCount = readNumber(data.customerCompletedJobsCount);
  const reportsCount = readNumber(data.customerReportsCount);

  if (completedJobsCount > 0) {
    badges.push(`${completedJobsCount} completed`);
  }

  if (reportsCount === 0) {
    badges.push("No reports");
  }

  return badges;
}

async function getCustomerFirstName(
  data: Record<string, unknown>,
  customerFirstNames: Map<string, string>,
) {
  const savedFirstName = getFirstName(readText(data.customerFirstName));

  if (savedFirstName) {
    return savedFirstName;
  }

  const customerId = readText(data.customerId);

  if (!customerId) {
    return "Customer";
  }

  const cachedFirstName = customerFirstNames.get(customerId);

  if (cachedFirstName) {
    return cachedFirstName;
  }

  const customerSnapshot = await adminDb.collection("customers").doc(customerId).get();

  if (!customerSnapshot.exists) {
    return "Customer";
  }

  const firstName =
    getFirstName(readText(customerSnapshot.get("fullName"))) || "Customer";

  customerFirstNames.set(customerId, firstName);

  return firstName;
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

async function serializeAvailableJob(
  data: Record<string, unknown>,
  customerFirstNames = new Map<string, string>(),
) {
  return {
    jobId: readText(data.jobId),
    parentJobId: readText(data.parentJobId),
    taskId: readText(data.taskId),
    customerFirstName: await getCustomerFirstName(data, customerFirstNames),
    customerSafetyBadges: getSafetyBadges(data),
    selectedServiceCategory: readText(data.selectedServiceCategory),
    selectedSubcategories: readStringList(data.selectedSubcategories),
    interestedContractorIds: readStringList(data.interestedContractorIds),
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
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
}

async function serializeAvailableTask(
  parentData: Record<string, unknown>,
  taskData: Record<string, unknown>,
  customerFirstNames: Map<string, string>,
) {
  const parentJobId = readText(taskData.parentJobId) || readText(parentData.jobId);
  const taskId = readText(taskData.taskId);
  const category =
    readText(taskData.category) || readText(parentData.selectedServiceCategory);
  const subcategory = readText(taskData.subcategory);

  return serializeAvailableJob(
    {
      ...parentData,
      jobId: taskId || parentJobId,
      parentJobId,
      taskId,
      selectedServiceCategory: category,
      selectedSubcategories: subcategory ? [subcategory] : [],
      interestedContractorIds:
        readStringList(taskData.interestedContractorIds).length > 0
          ? readStringList(taskData.interestedContractorIds)
          : readStringList(parentData.interestedContractorIds),
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
      createdAt: taskData.createdAt ?? parentData.createdAt,
      updatedAt: taskData.updatedAt ?? parentData.updatedAt,
    },
    customerFirstNames,
  );
}

function isBaseAvailableJob(data: Record<string, unknown>) {
  return (
    readText(data.status) === "open" &&
    readText(data.matchingStatus) !== "paused" &&
    !readText(data.hiredContractorId)
  );
}

function matchesPreferences(
  job: Awaited<ReturnType<typeof serializeAvailableJob>>,
  preferences: FilterPreferences,
) {
  if (
    preferences.categories.length > 0 &&
    !preferences.categories.includes(job.selectedServiceCategory)
  ) {
    return false;
  }

  if (
    preferences.subcategories.length > 0 &&
    !job.selectedSubcategories.some((subcategory) =>
      preferences.subcategories.includes(subcategory),
    )
  ) {
    return false;
  }

  if (!matchesServiceCity(job.city, preferences.serviceCities)) {
    return false;
  }

  if (
    preferences.urgency !== "any" &&
    preferences.urgency !== job.urgency.toLowerCase().replaceAll(" ", "_")
  ) {
    return false;
  }

  return true;
}

function sortJobs(
  jobs: Array<Awaited<ReturnType<typeof serializeAvailableJob>>>,
  sort: FilterPreferences["sort"],
) {
  return [...jobs].sort((firstJob, secondJob) => {
    if (sort === "urgent") {
      const urgencyDifference =
        (urgencyRank[secondJob.urgency.toLowerCase()] ?? 0) -
        (urgencyRank[firstJob.urgency.toLowerCase()] ?? 0);

      if (urgencyDifference !== 0) {
        return urgencyDifference;
      }
    }

    return secondJob.createdAt.localeCompare(firstJob.createdAt);
  });
}

function buildFilterOptions(
  jobs: Array<Awaited<ReturnType<typeof serializeAvailableJob>>>,
) {
  const catalogFilterOptions = getServiceFilterOptions();
  const categorySet = new Set(catalogFilterOptions.categories);
  const subcategoriesByCategory: Record<string, string[]> = {
    ...catalogFilterOptions.subcategoriesByCategory,
  };

  jobs.forEach((job) => {
    if (job.selectedServiceCategory) {
      categorySet.add(job.selectedServiceCategory);
    }

    if (!subcategoriesByCategory[job.selectedServiceCategory]) {
      subcategoriesByCategory[job.selectedServiceCategory] = [];
    }

    job.selectedSubcategories.forEach((subcategory) => {
      if (!subcategoriesByCategory[job.selectedServiceCategory].includes(subcategory)) {
        subcategoriesByCategory[job.selectedServiceCategory].push(subcategory);
      }
    });
  });

  Object.keys(subcategoriesByCategory).forEach((category) => {
    subcategoriesByCategory[category].sort((first, second) =>
      first.localeCompare(second),
    );
  });

  return {
    categories: Array.from(categorySet).sort((first, second) =>
      first.localeCompare(second),
    ),
    subcategoriesByCategory,
    cities: serviceAreaCities,
  };
}

async function backfillRecentMatchingJobNotifications(input: {
  contractorProfile: FirebaseFirestore.DocumentSnapshot;
  contractorId: string;
  recipientAuthUid: string;
  availableJobs: Array<Awaited<ReturnType<typeof serializeAvailableJob>>>;
  serviceCities: string[];
}) {
  const contractorData = input.contractorProfile.data() ?? {};

  if (
    !input.recipientAuthUid ||
    !isContractorEligibleForJobNotifications(contractorData) ||
    !hasActiveContractorSubscription(contractorData)
  ) {
    return 0;
  }

  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const lastBackfilledJobId = readText(
    contractorData.lastMatchingNotificationBackfillJobId,
  );
  const matchingJobs = new Map<
    string,
    {
      jobId: string;
      createdAt: string;
      serviceCategory: string;
      subcategories: Set<string>;
      taskIds: Set<string>;
    }
  >();

  input.availableJobs.forEach((job) => {
    const createdAtTime = Date.parse(job.createdAt);

    if (!Number.isFinite(createdAtTime) || createdAtTime < oneDayAgo) {
      return;
    }

    if (!matchesServiceCity(job.city, input.serviceCities)) {
      return;
    }

    const matchingSubcategories = getMatchingContractorSubcategories(
      contractorData,
      job.selectedServiceCategory,
      job.selectedSubcategories,
    );

    if (matchingSubcategories.length === 0) {
      return;
    }

    const parentJobId = job.parentJobId || job.jobId;
    const existingJob =
      matchingJobs.get(parentJobId) ??
      {
        jobId: parentJobId,
        createdAt: job.createdAt,
        serviceCategory: job.selectedServiceCategory,
        subcategories: new Set<string>(),
        taskIds: new Set<string>(),
      };

    matchingSubcategories.forEach((subcategory) =>
      existingJob.subcategories.add(subcategory),
    );

    if (job.taskId) {
      existingJob.taskIds.add(job.taskId);
    }

    if (job.createdAt > existingJob.createdAt) {
      existingJob.createdAt = job.createdAt;
    }

    matchingJobs.set(parentJobId, existingJob);
  });

  const sortedMatchingJobs = Array.from(matchingJobs.values()).sort(
    (firstJob, secondJob) =>
      secondJob.createdAt.localeCompare(firstJob.createdAt),
  );
  const lastBackfilledIndex = lastBackfilledJobId
    ? sortedMatchingJobs.findIndex((job) => job.jobId === lastBackfilledJobId)
    : -1;
  const jobsToBackfill = (
    lastBackfilledIndex >= 0
      ? sortedMatchingJobs.slice(0, lastBackfilledIndex)
      : sortedMatchingJobs
  ).slice(0, 5);

  if (jobsToBackfill.length === 0) {
    return 0;
  }

  let createdCount = 0;

  for (const job of jobsToBackfill) {
    const created = await createNotification({
      dedupeKey: `new_matching_job_${job.jobId}_${input.contractorId}`,
      recipientAuthUid: input.recipientAuthUid,
      recipientRole: "contractor",
      type: "new_matching_job",
      title: "New matching job",
      message: `${job.serviceCategory} job posted near your service area.`,
      jobId: job.jobId,
      data: {
        taskIds: Array.from(job.taskIds),
        serviceCategory: job.serviceCategory,
        subcategories: Array.from(job.subcategories),
      },
    });

    console.log("CONTRACTOR ID", input.contractorId);
    if (created) {
      createdCount += 1;
      console.log("NOTIFICATION CREATED", {
        jobId: job.jobId,
        contractorId: input.contractorId,
        source: "contractor-home-backfill",
      });
    }
  }

  await input.contractorProfile.ref.set(
    {
      lastMatchingNotificationBackfillJobId: jobsToBackfill[0].jobId,
      lastMatchingNotificationBackfillAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return createdCount;
}

async function getUnreadMessagesCount(firebaseUid: string) {
  const threadsSnapshot = await adminDb
    .collection("messages")
    .where("unreadBy", "array-contains", firebaseUid)
    .get();

  return threadsSnapshot.size;
}

export async function GET(request: NextRequest) {
  try {
    assertFirebaseAdminConfig();
    console.log(
      `[${new Date().toISOString()}] HOME API FETCH`,
      request.headers.get("x-azisto-trigger") || "unknown",
    );

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
          message: "Please use a contractor account to view your workspace.",
        },
        { status: 403 },
      );
    }

    const contractorId =
      readText(contractorProfile.get("contractorId")) || contractorProfile.id;
    const savedPreferences = normalizePreferences(
      contractorProfile.get("jobFilterPreferences"),
    );
    const activePreferenceOverride = readQueryPreferences(request);
    const activePreferences = activePreferenceOverride ?? savedPreferences;
    const [
      openJobsSnapshot,
      hiredJobsSnapshot,
      hiredTaskParentsSnapshot,
      unreadMessagesCount,
    ] =
      await Promise.all([
        adminDb
          .collection("jobs")
          .where("status", "==", "open")
          .limit(20)
          .get(),
        adminDb
          .collection("jobs")
          .where("hiredContractorId", "==", contractorId)
          .limit(10)
          .get(),
        adminDb
          .collection("jobs")
          .where("hiredContractorIds", "array-contains", contractorId)
          .limit(10)
          .get(),
        getUnreadMessagesCount(decodedToken.uid),
      ]);

    const customerFirstNames = new Map<string, string>();
    const baseAvailableJobs = (
      await Promise.all(
        openJobsSnapshot.docs
          .filter((jobSnapshot) => isBaseAvailableJob(jobSnapshot.data()))
          .map(async (jobSnapshot) => {
            const parentData = jobSnapshot.data();
            await getCustomerFirstName(parentData, customerFirstNames);
            const tasksSnapshot = await jobSnapshot.ref
              .collection("tasks")
              .where("status", "==", "open")
              .limit(10)
              .get();

            if (tasksSnapshot.empty) {
              return [
                await serializeAvailableJob(parentData, customerFirstNames),
              ];
            }

            return Promise.all(
              tasksSnapshot.docs
                .filter((taskSnapshot) => !readText(taskSnapshot.get("hiredContractorId")))
                .map((taskSnapshot) =>
                  serializeAvailableTask(
                    parentData,
                    taskSnapshot.data(),
                    customerFirstNames,
                  ),
                ),
            );
          }),
      )
    ).flat();
    const filterOptions = buildFilterOptions(baseAvailableJobs);
    const filteredJobs = baseAvailableJobs.filter((job) =>
      matchesPreferences(job, activePreferences),
    );
    const availableJobs = sortJobs(filteredJobs, activePreferences.sort).slice(
      0,
      10,
    );
    let matchingNotificationsCreated = 0;

    try {
      matchingNotificationsCreated = await backfillRecentMatchingJobNotifications(
        {
          contractorProfile,
          contractorId,
          recipientAuthUid: decodedToken.uid,
          availableJobs: baseAvailableJobs,
          serviceCities: savedPreferences.serviceCities,
        },
      );
    } catch (error) {
      console.error("Matching notification backfill failed:", error);
    }

    const interestedJobsCount = new Set(
      baseAvailableJobs
        .filter((job) => job.interestedContractorIds.includes(contractorId))
        .map((job) => job.parentJobId || job.jobId),
    ).size;
    const today = getTodayDateString();
    const directActiveJob = hiredJobsSnapshot.docs
      .map((jobSnapshot) => jobSnapshot.data())
      .find((job) =>
        [
          "hired_pending_contractor",
          "accepted",
          "hired",
          "on_the_way",
          "in_progress",
        ].includes(readText(job.status)),
      );
    let taskActiveJob: Record<string, unknown> | undefined;

    if (!directActiveJob) {
      for (const parentSnapshot of hiredTaskParentsSnapshot.docs) {
        const tasksSnapshot = await parentSnapshot.ref.collection("tasks").get();
        const activeTask = tasksSnapshot.docs.find(
          (taskSnapshot) =>
            readText(taskSnapshot.get("hiredContractorId")) === contractorId &&
            [
              "hired_pending_contractor",
              "accepted",
              "hired",
              "on_the_way",
              "in_progress",
            ].includes(readText(taskSnapshot.get("status"))),
        );

        if (activeTask) {
          taskActiveJob = {
            ...parentSnapshot.data(),
            status: activeTask.get("status"),
          };
          break;
        }
      }
    }

    const activeJob = directActiveJob ?? taskActiveJob;
    const serializedActiveJob = activeJob
      ? {
          jobId: readText(activeJob.jobId),
          serviceCategory: readText(activeJob.selectedServiceCategory),
          status: readText(activeJob.status),
          city: readText(activeJob.city),
          province: readText(activeJob.province),
        }
      : null;

    return NextResponse.json({
      ok: true,
      contractorName:
        readText(contractorProfile.get("contactName")) ||
        readText(contractorProfile.get("businessName")) ||
        "Contractor",
      contractorId,
      verificationStatus: readText(contractorProfile.get("verificationStatus")),
      completedJobsCount: readNumber(contractorProfile.get("completedJobsCount")),
      averageRating: readNumber(contractorProfile.get("averageRating")),
      reviewCount: readNumber(contractorProfile.get("reviewCount")),
      unreadMessagesCount,
      activeJob: serializedActiveJob,
      activeJobBlockingNewInterest: Boolean(serializedActiveJob),
      availableJobsCount: filteredJobs.length,
      totalAvailableJobsCount: baseAvailableJobs.length,
      newTodayCount: baseAvailableJobs.filter((job) =>
        job.createdAt.startsWith(today),
      ).length,
      interestedJobsCount,
      availableJobs,
      filters: activePreferences,
      savedFilters: savedPreferences,
      filterOptions,
      matchingNotificationsCreated,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Contractor home API failed:", { code, message, error });

    if (isQuotaExceededMessage(`${code} ${message}`)) {
      return NextResponse.json(
        {
          code: "resource-exhausted",
          message: firebaseQuotaMessage,
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { code, message },
      { status: code === "missing-token" ? 401 : 500 },
    );
  }
}
