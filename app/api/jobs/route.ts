import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import { ensureUniqueReadableId } from "@/lib/readableIds";
import { calculateRiskScore, hasBlockedSpamText } from "@/lib/riskScore";

export const runtime = "nodejs";

type JobRequestBody = {
  selectedServiceCategory?: unknown;
  selectedSubcategories?: unknown;
  jobDescription?: unknown;
  photos?: unknown;
  photoPlaceholders?: unknown;
  address?: unknown;
  city?: unknown;
  province?: unknown;
  postalCode?: unknown;
  preferredDate?: unknown;
  preferredTime?: unknown;
  urgency?: unknown;
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
    const preferredDate = readText(body.preferredDate);

    if (!address || !city || !province || !postalCode) {
      return NextResponse.json(
        {
          code: "service-address-required",
          message:
            "Please enter the service address, city, province, and postal code.",
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

    if (isPastDate(preferredDate)) {
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
    const taskSubcategories =
      selectedSubcategories.length > 0
        ? selectedSubcategories
        : [selectedServiceCategory || "General task"];
    const preferredTime = readText(body.preferredTime);
    const urgency = readText(body.urgency) || "Flexible";
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
      jobDescription,
      photos: readPhotoList(body.photos),
      photoPlaceholders: readStringList(body.photoPlaceholders),
      address,
      city,
      province,
      postalCode,
      preferredDate,
      preferredTime,
      urgency,
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

      batch.set(jobDocument.collection("tasks").doc(taskId), {
        taskId,
        parentJobId: jobId,
        category: selectedServiceCategory,
        subcategory,
        jobDescription,
        city,
        province,
        postalCode,
        preferredDate,
        preferredTime,
        urgency,
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
    await customerProfile.ref.set(
      {
        emailVerified,
        phoneVerified,
        riskScore,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

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
