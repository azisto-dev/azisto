import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import { ensureUniqueReadableId } from "@/lib/readableIds";
import { calculateRiskScore, hasBlockedSpamText } from "@/lib/riskScore";
import { createNotification } from "@/lib/notifications";
import {
  getMatchingContractorSubcategories,
  hasActiveContractorSubscription,
  isContractorEligibleForJobNotifications,
} from "@/lib/contractorJobMatching";
import {
  matchesServiceCity,
  sanitizeServiceCities,
} from "@/lib/serviceAreas";

export const runtime = "nodejs";

type JobRequestBody = {
  selectedServiceCategory?: unknown;
  selectedSubcategories?: unknown;
  selectedSubcategoryGroups?: unknown;
  jobDescription?: unknown;
  photos?: unknown;
  photoPlaceholders?: unknown;
  address?: unknown;
  city?: unknown;
  province?: unknown;
  postalCode?: unknown;
  locationMode?: unknown;
  location?: unknown;
  scheduleMode?: unknown;
  preferredDate?: unknown;
  preferredTime?: unknown;
  preferredTimeWindow?: unknown;
  urgency?: unknown;
  schedule?: unknown;
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

function readBoolean(value: unknown) {
  return value === true;
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" ? value : fallback;
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

function readStringRecord(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

function getContractorAuthUid(data: Record<string, unknown>) {
  return readText(data.authUid) || readText(data.firebaseUid);
}

async function notifyMatchingContractors(input: {
  jobId: string;
  jobCity: string;
  serviceCategory: string;
  taskSubcategories: string[];
}) {
  const contractorsSnapshot = await adminDb.collection("contractors").get();
  const matches = contractorsSnapshot.docs.flatMap((contractorSnapshot) => {
    const contractorData = contractorSnapshot.data() ?? {};
    const recipientAuthUid = getContractorAuthUid(contractorData);
    const contractorId =
      readText(contractorData.contractorId) || contractorSnapshot.id;
    const matchingSubcategories = getMatchingContractorSubcategories(
      contractorData,
      input.serviceCategory,
      input.taskSubcategories,
    );
    const filterPreferences = readStringRecord(
      contractorData.jobFilterPreferences,
    );
    const serviceCities = sanitizeServiceCities(
      filterPreferences.serviceCities ?? filterPreferences.cities,
    );

    if (
      !recipientAuthUid ||
      !isContractorEligibleForJobNotifications(contractorData) ||
      !hasActiveContractorSubscription(contractorData) ||
      matchingSubcategories.length === 0 ||
      !matchesServiceCity(input.jobCity, serviceCities)
    ) {
      return [];
    }

    const matchingTaskIds = input.taskSubcategories.flatMap(
      (subcategory, index) =>
        matchingSubcategories.includes(subcategory)
          ? [`${input.jobId}-${index + 1}`]
          : [],
    );
    return [
      {
        contractorId,
        recipientAuthUid,
        matchingSubcategories,
        matchingTaskIds,
      },
    ];
  });

  console.log("MATCHING CONTRACTORS FOUND", {
    jobId: input.jobId,
    count: matches.length,
  });

  await Promise.all(
    matches.map(async (match) => {
      const created = await createNotification({
        dedupeKey: `new_matching_job_${input.jobId}_${match.contractorId}`,
        recipientAuthUid: match.recipientAuthUid,
        recipientRole: "contractor",
        type: "new_matching_job",
        title: "New matching job",
        message: `${input.serviceCategory} job posted near your service area.`,
        jobId: input.jobId,
        data: {
          taskIds: match.matchingTaskIds,
          serviceCategory: input.serviceCategory,
          subcategories: match.matchingSubcategories,
        },
      });

      console.log("CONTRACTOR ID", match.contractorId);
      if (created) {
        console.log("NOTIFICATION CREATED", {
          jobId: input.jobId,
          contractorId: match.contractorId,
        });
      }
    }),
  );
}

function readSubcategoryGroups(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const data =
        typeof item === "object" && item !== null
          ? (item as Record<string, unknown>)
          : {};
      const subcategory = readText(data.subcategory);
      const group = readText(data.group);

      return subcategory && group ? { subcategory, group } : null;
    })
    .filter((item): item is { subcategory: string; group: string } =>
      Boolean(item),
    );
}

function readPhotoList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => typeof item === "object" && item !== null);
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function isPastDate(dateValue: string) {
  return Boolean(dateValue) && dateValue < getTodayDateString();
}

function readScheduleMode(value: unknown) {
  return value === "specific" ? "specific" : "urgency";
}

function readLocationMode(value: unknown) {
  return value === "live" ? "live" : "manual";
}

function readLiveLocation(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const data = value as Record<string, unknown>;
  const lat = typeof data.lat === "number" ? data.lat : Number(data.lat);
  const lng = typeof data.lng === "number" ? data.lng : Number(data.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function getFirstName(name: string) {
  return name.trim().split(" ").filter(Boolean)[0] ?? "";
}

function getErrorDetails(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";
  const message = error instanceof Error ? error.message : "Unknown error";

  return { code, message };
}

async function findCustomerProfile(firebaseUid: string) {
  const customersCollection = adminDb.collection("customers");
  const authUidSnapshot = await customersCollection
    .where("authUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!authUidSnapshot.empty) {
    return authUidSnapshot.docs[0];
  }

  const legacyFirebaseUidSnapshot = await customersCollection
    .where("firebaseUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!legacyFirebaseUidSnapshot.empty) {
    return legacyFirebaseUidSnapshot.docs[0];
  }

  const legacyDocumentSnapshot = await customersCollection.doc(firebaseUid).get();

  return legacyDocumentSnapshot.exists ? legacyDocumentSnapshot : null;
}

async function countOpenCustomerJobs(firebaseUid: string) {
  const jobsSnapshot = await adminDb
    .collection("jobs")
    .where("customerAuthUid", "==", firebaseUid)
    .get();

  return jobsSnapshot.docs.filter(
    (documentSnapshot) => documentSnapshot.get("status") === "open",
  ).length;
}

export async function POST(request: NextRequest) {
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
    const body = (await request.json()) as JobRequestBody;
    const customerProfile = await findCustomerProfile(decodedToken.uid);

    if (!customerProfile) {
      return NextResponse.json(
        {
          code: "customer-profile-required",
          message:
            "Please sign in or create a customer account before posting a job.",
        },
        { status: 403 },
      );
    }

    const customerId = readText(customerProfile.get("customerId")) || customerProfile.id;
    const customerFirstName =
      getFirstName(readText(customerProfile.get("fullName"))) || "Customer";
    const accountStatus =
      readText(customerProfile.get("accountStatus")) || "active";
    const emailVerified =
      readBoolean(customerProfile.get("emailVerified")) ||
      decodedToken.email_verified === true;
    const phoneVerified = readBoolean(customerProfile.get("phoneVerified"));
    const openJobLimit = readNumber(customerProfile.get("openJobLimit"), 2);
    const completedJobsCount = readNumber(
      customerProfile.get("completedJobsCount"),
      0,
    );
    const customerReportsCount = readNumber(
      customerProfile.get("reportsCount"),
      0,
    );

    if (accountStatus !== "active") {
      return NextResponse.json(
        {
          code: "customer-account-not-active",
          message: "Your account is not active. Please contact AZISTO support.",
        },
        { status: 403 },
      );
    }

    const openJobsCount = await countOpenCustomerJobs(decodedToken.uid);

    if (openJobsCount >= openJobLimit) {
      return NextResponse.json(
        {
          code: "open-job-limit-reached",
          message:
            "You already have the maximum number of open jobs. Please complete or close an existing job before posting another one.",
        },
        { status: 429 },
      );
    }

    const jobDescription = readText(body.jobDescription);
    const address = readText(body.address);
    const city = readText(body.city);
    const province = readText(body.province);
    const postalCode = readText(body.postalCode);
    const locationMode = readLocationMode(body.locationMode);
    const liveLocation = readLiveLocation(body.location);
    const scheduleMode = readScheduleMode(body.scheduleMode);
    const preferredDate =
      scheduleMode === "specific" ? readText(body.preferredDate) : "";
    const preferredTimeWindow =
      scheduleMode === "specific" ? readText(body.preferredTimeWindow) : "";
    const urgency =
      scheduleMode === "urgency" ? readText(body.urgency) || "Flexible" : "";

    if (
      locationMode === "manual" &&
      (!address || !city || !province || !postalCode)
    ) {
      return NextResponse.json(
        {
          code: "service-address-required",
          message:
            "Please enter the service address, city, province, and postal code.",
        },
        { status: 400 },
      );
    }

    if (locationMode === "live" && !liveLocation) {
      return NextResponse.json(
        {
          code: "live-location-required",
          message: "Please capture your live location before submitting.",
        },
        { status: 400 },
      );
    }

    if (jobDescription.length < 20) {
      return NextResponse.json(
        {
          code: "job-description-too-short",
          message: "Please describe the job in at least 20 characters.",
        },
        { status: 400 },
      );
    }

    if (
      hasBlockedSpamText(
        [jobDescription, address, city, province, postalCode].join(" "),
      )
    ) {
      return NextResponse.json(
        {
          code: "suspicious-job-text",
          message:
            "Please remove links, off-platform contact details, or suspicious text before posting.",
        },
        { status: 400 },
      );
    }

    if (scheduleMode === "specific" && !preferredDate) {
      return NextResponse.json(
        {
          code: "preferred-date-required",
          message: "Please choose a preferred date.",
        },
        { status: 400 },
      );
    }

    if (scheduleMode === "specific" && !preferredTimeWindow) {
      return NextResponse.json(
        {
          code: "preferred-time-window-required",
          message: "Please choose a preferred time window.",
        },
        { status: 400 },
      );
    }

    if (scheduleMode === "specific" && isPastDate(preferredDate)) {
      return NextResponse.json(
        {
          code: "past-date-not-allowed",
          message: "Please choose today or a future date.",
        },
        { status: 400 },
      );
    }

    const { score: riskScore, reasons: riskReasons } = calculateRiskScore({
      accountCreatedAt: customerProfile.get("createdAt"),
      phoneVerified,
      openJobsCount,
      openJobLimit,
      jobDescription,
      reportsCount: customerReportsCount,
    });
    const needsReview = riskScore >= 50;
    const jobId = await ensureUniqueReadableId("jobs", "jobId", "J");
    const jobDocument = adminDb.collection("jobs").doc(jobId);

    const selectedServiceCategory = readText(body.selectedServiceCategory);
    const selectedSubcategories = readStringList(body.selectedSubcategories);
    const selectedSubcategoryGroups = readSubcategoryGroups(
      body.selectedSubcategoryGroups,
    );
    const taskSubcategories =
      selectedSubcategories.length > 0
        ? selectedSubcategories
        : [selectedServiceCategory || "General task"];
    const preferredTime = "";
    const locationCapturedAt =
      locationMode === "live" ? FieldValue.serverTimestamp() : null;
    const schedule =
      scheduleMode === "specific"
        ? {
            mode: "specific",
            date: preferredDate,
            timeWindow: preferredTimeWindow,
          }
        : {
            mode: "urgency",
            urgency,
          };
    const jobRequest = {
      jobId,
      customerAuthUid: decodedToken.uid,
      customerId,
      customerFirstName,
      customerEmailVerified: emailVerified,
      customerPhoneVerified: phoneVerified,
      customerCompletedJobsCount: completedJobsCount,
      customerReportsCount,
      selectedServiceCategory,
      selectedSubcategories,
      selectedSubcategoryGroups,
      jobDescription,
      photos: readPhotoList(body.photos),
      photoPlaceholders: readStringList(body.photoPlaceholders),
      address: locationMode === "manual" ? address : null,
      city: locationMode === "manual" ? city : null,
      province: locationMode === "manual" ? province : null,
      postalCode: locationMode === "manual" ? postalCode : null,
      locationMode,
      location: locationMode === "live" ? liveLocation : null,
      locationCapturedAt,
      scheduleMode,
      preferredDate: scheduleMode === "specific" ? preferredDate : null,
      preferredTime,
      preferredTimeWindow:
        scheduleMode === "specific" ? preferredTimeWindow : null,
      urgency: scheduleMode === "urgency" ? urgency : null,
      schedule,
      riskScore,
      riskReasons,
      reportsCount: 0,
      overallStatus: "open",
      requiresMultipleContractors: taskSubcategories.length > 1,
      taskCount: taskSubcategories.length,
      status: needsReview ? "review_required" : "open",
      matchingStatus: needsReview ? "paused" : "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const batch = adminDb.batch();

    batch.set(jobDocument, jobRequest);
    taskSubcategories.forEach((subcategory, index) => {
      const taskId = `${jobId}-${index + 1}`;
      const subcategoryGroup =
        selectedSubcategoryGroups.find((item) => item.subcategory === subcategory)
          ?.group ?? "";

      batch.set(jobDocument.collection("tasks").doc(taskId), {
        taskId,
        parentJobId: jobId,
        category: selectedServiceCategory,
        subcategory,
        subcategoryGroup,
        jobDescription,
        address: locationMode === "manual" ? address : null,
        city: locationMode === "manual" ? city : null,
        province: locationMode === "manual" ? province : null,
        postalCode: locationMode === "manual" ? postalCode : null,
        locationMode,
        location: locationMode === "live" ? liveLocation : null,
        locationCapturedAt,
        scheduleMode,
        preferredDate: scheduleMode === "specific" ? preferredDate : null,
        preferredTime,
        preferredTimeWindow:
          scheduleMode === "specific" ? preferredTimeWindow : null,
        urgency: scheduleMode === "urgency" ? urgency : null,
        schedule,
        status: "open",
        interestedContractorIds: [],
        interestedContractorAuthUids: [],
        hiredContractorId: null,
        hiredContractorAuthUid: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log("JOB CREATED", {
      jobId,
      category: selectedServiceCategory,
      subcategories: taskSubcategories,
      city: locationMode === "manual" ? city : "",
    });
    await customerProfile.ref.set(
      {
        emailVerified,
        phoneVerified,
        riskScore,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    if (!needsReview && selectedServiceCategory) {
      try {
        await notifyMatchingContractors({
          jobId,
          jobCity: locationMode === "manual" ? city : "",
          serviceCategory: selectedServiceCategory,
          taskSubcategories,
        });
      } catch (notificationError) {
        console.error("Matching contractor notifications failed:", {
          jobId,
          notificationError,
        });

        try {
          await notifyMatchingContractors({
            jobId,
            jobCity: locationMode === "manual" ? city : "",
            serviceCategory: selectedServiceCategory,
            taskSubcategories,
          });
        } catch (retryError) {
          console.error("Matching contractor notification retry failed:", {
            jobId,
            retryError,
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      jobId,
      status: jobRequest.status,
      matchingStatus: jobRequest.matchingStatus,
    });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Job request API save failed:", {
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
