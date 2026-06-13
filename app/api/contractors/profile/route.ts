import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import { ensureUniqueReadableId } from "@/lib/readableIds";
import {
  getStarterTrialDates,
  getSubscriptionMonthKey,
} from "@/lib/subscriptions";

export const runtime = "nodejs";

type ContractorProfileBody = {
  businessName?: unknown;
  contactName?: unknown;
  phoneNumber?: unknown;
  email?: unknown;
  address?: unknown;
  city?: unknown;
  province?: unknown;
  postalCode?: unknown;
  selectedServices?: unknown;
  selectedSubcategoriesByService?: unknown;
  additionalServices?: unknown;
  yearsOfExperience?: unknown;
  aboutYourself?: unknown;
  serviceRadiusKm?: unknown;
  insuranceProvider?: unknown;
  insurancePolicyNumber?: unknown;
  businessLicenceNumber?: unknown;
  documents?: unknown;
  documentsVerificationStatus?: unknown;
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

function readStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number.parseFloat(value);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  return 0;
}

function readRecord(value: unknown) {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function readSelectedSubcategoriesByService(value: unknown) {
  const record = readRecord(value);
  const result: Record<string, string[]> = {};

  Object.entries(record).forEach(([service, subcategories]) => {
    const cleanService = service.trim();
    const cleanSubcategories = readStringList(subcategories);

    if (cleanService && cleanSubcategories.length > 0) {
      result[cleanService] = cleanSubcategories;
    }
  });

  return result;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function readDocumentStatus(value: unknown, fallback: string) {
  const status = readText(value);

  return ["uploaded", "not_uploaded", "not_required"].includes(status)
    ? status
    : fallback;
}

function readUploadSize(value: unknown) {
  const size = readNumber(value);

  return size > 0 ? size : 0;
}

function readOptionalDocument(value: unknown) {
  const document = readRecord(value);

  return {
    status: readDocumentStatus(document.status, "not_uploaded"),
    fileName: readText(document.fileName),
    fileUrl: readText(document.fileUrl),
    storagePath: readText(document.storagePath),
    contentType: readText(document.contentType),
    size: readUploadSize(document.size),
    uploadedAt: readText(document.uploadedAt),
    reviewedAt: null,
    rejectionReason: readText(document.rejectionReason),
  };
}

function readTradeLicences(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    const tradeLicence = readRecord(item);

    return {
      category: readText(tradeLicence.category),
      documentName: readText(tradeLicence.documentName),
      status: readDocumentStatus(tradeLicence.status, "not_uploaded"),
      fileName: readText(tradeLicence.fileName),
      fileUrl: readText(tradeLicence.fileUrl),
      storagePath: readText(tradeLicence.storagePath),
      contentType: readText(tradeLicence.contentType),
      size: readUploadSize(tradeLicence.size),
      uploadedAt: readText(tradeLicence.uploadedAt),
      reviewedAt: null,
      rejectionReason: readText(tradeLicence.rejectionReason),
    };
  });
}

function readContractorDocuments(value: unknown) {
  const documents = readRecord(value);
  const governmentId = readRecord(documents.governmentId);
  const businessLicence = readRecord(documents.businessLicence);
  const commercialGeneralLiability = readRecord(
    documents.commercialGeneralLiability,
  );
  const worksafeBC = readRecord(documents.worksafeBC);
  const vehicleDocuments = readRecord(documents.vehicleDocuments);
  const drivingAbstract = readRecord(documents.drivingAbstract);

  return {
    governmentId: {
      status: readDocumentStatus(governmentId.status, "not_uploaded"),
      fileName: readText(governmentId.fileName),
      fileUrl: readText(governmentId.fileUrl),
      storagePath: readText(governmentId.storagePath),
      contentType: readText(governmentId.contentType),
      size: readUploadSize(governmentId.size),
      uploadedAt: readText(governmentId.uploadedAt),
      expiryDate: readText(governmentId.expiryDate),
      reviewedAt: null,
      rejectionReason: readText(governmentId.rejectionReason),
    },
    businessLicence: {
      status: readDocumentStatus(businessLicence.status, "not_uploaded"),
      fileName: readText(businessLicence.fileName),
      fileUrl: readText(businessLicence.fileUrl),
      storagePath: readText(businessLicence.storagePath),
      contentType: readText(businessLicence.contentType),
      size: readUploadSize(businessLicence.size),
      uploadedAt: readText(businessLicence.uploadedAt),
      licenceNumber: readText(businessLicence.licenceNumber),
      municipality: readText(businessLicence.municipality),
      expiryDate: readText(businessLicence.expiryDate),
      reviewedAt: null,
      rejectionReason: readText(businessLicence.rejectionReason),
    },
    commercialGeneralLiability: {
      status: readDocumentStatus(
        commercialGeneralLiability.status,
        "not_uploaded",
      ),
      fileName: readText(commercialGeneralLiability.fileName),
      fileUrl: readText(commercialGeneralLiability.fileUrl),
      storagePath: readText(commercialGeneralLiability.storagePath),
      contentType: readText(commercialGeneralLiability.contentType),
      size: readUploadSize(commercialGeneralLiability.size),
      uploadedAt: readText(commercialGeneralLiability.uploadedAt),
      provider: readText(commercialGeneralLiability.provider),
      policyNumber: readText(commercialGeneralLiability.policyNumber),
      coverageAmount: readText(commercialGeneralLiability.coverageAmount),
      expiryDate: readText(commercialGeneralLiability.expiryDate),
      reviewedAt: null,
      rejectionReason: readText(commercialGeneralLiability.rejectionReason),
    },
    worksafeBC: {
      status: readDocumentStatus(worksafeBC.status, "not_uploaded"),
      accountNumber: readText(worksafeBC.accountNumber),
      fileName: readText(worksafeBC.fileName),
      clearanceLetterUrl: readText(worksafeBC.clearanceLetterUrl),
      storagePath: readText(worksafeBC.storagePath),
      contentType: readText(worksafeBC.contentType),
      size: readUploadSize(worksafeBC.size),
      uploadedAt: readText(worksafeBC.uploadedAt),
      expiryDate: readText(worksafeBC.expiryDate),
      reviewedAt: null,
      rejectionReason: readText(worksafeBC.rejectionReason),
      confirmedCoverageResponsibility: readBoolean(
        worksafeBC.confirmedCoverageResponsibility,
      ),
    },
    tradeLicences: readTradeLicences(documents.tradeLicences),
    vehicleDocuments: {
      status: readDocumentStatus(vehicleDocuments.status, "not_required"),
      driverLicenceUrl: readText(vehicleDocuments.driverLicenceUrl),
      driverLicenceFileName: readText(vehicleDocuments.driverLicenceFileName),
      driverLicenceStoragePath: readText(
        vehicleDocuments.driverLicenceStoragePath,
      ),
      driverLicenceContentType: readText(
        vehicleDocuments.driverLicenceContentType,
      ),
      driverLicenceSize: readUploadSize(vehicleDocuments.driverLicenceSize),
      driverLicenceUploadedAt: readText(
        vehicleDocuments.driverLicenceUploadedAt,
      ),
      vehicleRegistrationUrl: readText(vehicleDocuments.vehicleRegistrationUrl),
      vehicleRegistrationFileName: readText(
        vehicleDocuments.vehicleRegistrationFileName,
      ),
      vehicleRegistrationStoragePath: readText(
        vehicleDocuments.vehicleRegistrationStoragePath,
      ),
      vehicleRegistrationContentType: readText(
        vehicleDocuments.vehicleRegistrationContentType,
      ),
      vehicleRegistrationSize: readUploadSize(
        vehicleDocuments.vehicleRegistrationSize,
      ),
      vehicleRegistrationUploadedAt: readText(
        vehicleDocuments.vehicleRegistrationUploadedAt,
      ),
      commercialVehicleInsuranceUrl: readText(
        vehicleDocuments.commercialVehicleInsuranceUrl,
      ),
      commercialVehicleInsuranceFileName: readText(
        vehicleDocuments.commercialVehicleInsuranceFileName,
      ),
      commercialVehicleInsuranceStoragePath: readText(
        vehicleDocuments.commercialVehicleInsuranceStoragePath,
      ),
      commercialVehicleInsuranceContentType: readText(
        vehicleDocuments.commercialVehicleInsuranceContentType,
      ),
      commercialVehicleInsuranceSize: readUploadSize(
        vehicleDocuments.commercialVehicleInsuranceSize,
      ),
      commercialVehicleInsuranceUploadedAt: readText(
        vehicleDocuments.commercialVehicleInsuranceUploadedAt,
      ),
      cargoInsuranceUrl: readText(vehicleDocuments.cargoInsuranceUrl),
      cargoInsuranceFileName: readText(vehicleDocuments.cargoInsuranceFileName),
      cargoInsuranceStoragePath: readText(
        vehicleDocuments.cargoInsuranceStoragePath,
      ),
      cargoInsuranceContentType: readText(
        vehicleDocuments.cargoInsuranceContentType,
      ),
      cargoInsuranceSize: readUploadSize(vehicleDocuments.cargoInsuranceSize),
      cargoInsuranceUploadedAt: readText(
        vehicleDocuments.cargoInsuranceUploadedAt,
      ),
      towingInsuranceUrl: readText(vehicleDocuments.towingInsuranceUrl),
      towingInsuranceFileName: readText(
        vehicleDocuments.towingInsuranceFileName,
      ),
      towingInsuranceStoragePath: readText(
        vehicleDocuments.towingInsuranceStoragePath,
      ),
      towingInsuranceContentType: readText(
        vehicleDocuments.towingInsuranceContentType,
      ),
      towingInsuranceSize: readUploadSize(
        vehicleDocuments.towingInsuranceSize,
      ),
      towingInsuranceUploadedAt: readText(
        vehicleDocuments.towingInsuranceUploadedAt,
      ),
      garageKeepersLiabilityUrl: readText(
        vehicleDocuments.garageKeepersLiabilityUrl,
      ),
      garageKeepersLiabilityFileName: readText(
        vehicleDocuments.garageKeepersLiabilityFileName,
      ),
      garageKeepersLiabilityStoragePath: readText(
        vehicleDocuments.garageKeepersLiabilityStoragePath,
      ),
      garageKeepersLiabilityContentType: readText(
        vehicleDocuments.garageKeepersLiabilityContentType,
      ),
      garageKeepersLiabilitySize: readUploadSize(
        vehicleDocuments.garageKeepersLiabilitySize,
      ),
      garageKeepersLiabilityUploadedAt: readText(
        vehicleDocuments.garageKeepersLiabilityUploadedAt,
      ),
      vehicleType: readText(vehicleDocuments.vehicleType),
      licencePlate: readText(vehicleDocuments.licencePlate),
      insuranceExpiryDate: readText(vehicleDocuments.insuranceExpiryDate),
      reviewedAt: null,
      rejectionReason: readText(vehicleDocuments.rejectionReason),
    },
    drivingAbstract: {
      status: readDocumentStatus(drivingAbstract.status, "not_required"),
      fileName: readText(drivingAbstract.fileName),
      fileUrl: readText(drivingAbstract.fileUrl),
      storagePath: readText(drivingAbstract.storagePath),
      contentType: readText(drivingAbstract.contentType),
      size: readUploadSize(drivingAbstract.size),
      uploadedAt: readText(drivingAbstract.uploadedAt),
      issueDate: readText(drivingAbstract.issueDate),
      licenceClass: readText(drivingAbstract.licenceClass),
      licenceExpiryDate: readText(drivingAbstract.licenceExpiryDate),
      reviewedAt: null,
      rejectionReason: readText(drivingAbstract.rejectionReason),
      confirmedDrivingRecord: readBoolean(
        drivingAbstract.confirmedDrivingRecord,
      ),
    },
    backgroundCheck: readOptionalDocument(documents.backgroundCheck),
    otherSupporting: readOptionalDocument(documents.otherSupporting),
  };
}

function getErrorDetails(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";
  const message = error instanceof Error ? error.message : "Unknown error";

  return { code, message };
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

async function findExistingContractorProfile(firebaseUid: string) {
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

export async function GET(request: NextRequest) {
  try {
    assertFirebaseAdminConfig();
    const token = getBearerToken(request.headers.get("authorization"));

    if (!token) {
      return NextResponse.json(
        { message: "Please sign in again." },
        { status: 401 },
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const contractorSnapshot = await findExistingContractorProfile(
      decodedToken.uid,
    );

    if (!contractorSnapshot) {
      return NextResponse.json(
        { message: "Contractor profile not found." },
        { status: 404 },
      );
    }

    const contractorData = contractorSnapshot.data() ?? {};
    const contractorId =
      readText(contractorData.contractorId) || contractorSnapshot.id;
    const reviewsSnapshot = await adminDb
      .collection("reviews")
      .where("contractorId", "==", contractorId)
      .get();
    const recentReviews = reviewsSnapshot.docs
      .map((reviewSnapshot) => ({
        reviewId: reviewSnapshot.id,
        jobId: readText(reviewSnapshot.get("jobId")),
        taskId: readText(reviewSnapshot.get("taskId")),
        rating: readNumber(reviewSnapshot.get("rating")),
        reviewText: readText(reviewSnapshot.get("reviewText")),
        tags: readStringList(reviewSnapshot.get("tags")),
        serviceCategory: readText(reviewSnapshot.get("serviceCategory")),
        subcategory: readText(reviewSnapshot.get("subcategory")),
        city: readText(reviewSnapshot.get("city")),
        createdAt: serializeTimestamp(reviewSnapshot.get("createdAt")),
      }))
      .sort((firstReview, secondReview) =>
        secondReview.createdAt.localeCompare(firstReview.createdAt),
      )
      .slice(0, 10);

    return NextResponse.json({
      ok: true,
      contractorId,
      contractorName:
        readText(contractorData.businessName) ||
        readText(contractorData.contactName) ||
        "Contractor",
      ratingAverage:
        readNumber(contractorData.ratingAverage) ||
        readNumber(contractorData.averageRating),
      ratingCount:
        readNumber(contractorData.ratingCount) ||
        readNumber(contractorData.reviewCount),
      completedJobs: Math.max(
        readNumber(contractorData.completedJobs),
        readNumber(contractorData.completedJobsCount),
      ),
      recentReviews,
    });
  } catch (error) {
    const { code, message } = getErrorDetails(error);
    console.error("Contractor profile API GET failed:", { code, message, error });
    return NextResponse.json(
      { code, message },
      { status: code === "missing-token" ? 401 : 500 },
    );
  }
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

    if (decodedToken.email_verified !== true) {
      return NextResponse.json(
        {
          code: "email-not-verified",
          message: "Please verify your email before creating your profile.",
        },
        { status: 403 },
      );
    }

    const body = (await request.json()) as ContractorProfileBody;
    const existingContractorSnapshot = await findExistingContractorProfile(
      decodedToken.uid,
    );
    const existingContractorId = existingContractorSnapshot?.get("contractorId");
    const contractorId =
      typeof existingContractorId === "string" && existingContractorId
        ? existingContractorId
        : await ensureUniqueReadableId("contractors", "contractorId", "P");
    const contractorDocument = adminDb
      .collection("contractors")
      .doc(contractorId);
    const contractorDocumentSnapshot = await contractorDocument.get();
    const subscriptionStartedAt = new Date();
    const { trialStartedAt, trialEndsAt } =
      getStarterTrialDates(subscriptionStartedAt);

    const contractorProfile = {
      contractorId,
      firebaseUid: decodedToken.uid,
      userId: contractorId,
      authUid: decodedToken.uid,
      businessName: readText(body.businessName),
      contactName: readText(body.contactName),
      phoneNumber: readText(body.phoneNumber),
      email: readText(body.email) || decodedToken.email || "",
      address: readText(body.address),
      city: readText(body.city),
      province: readText(body.province),
      postalCode: readText(body.postalCode),
      selectedServices: readStringList(body.selectedServices),
      selectedSubcategoriesByService: readSelectedSubcategoriesByService(
        body.selectedSubcategoriesByService,
      ),
      additionalServices: readText(body.additionalServices),
      yearsOfExperience: readText(body.yearsOfExperience),
      aboutYourself: readText(body.aboutYourself),
      serviceRadiusKm: readNumber(body.serviceRadiusKm),
      insuranceProvider: readText(body.insuranceProvider),
      insurancePolicyNumber: readText(body.insurancePolicyNumber),
      businessLicenceNumber: readText(body.businessLicenceNumber),
      verificationStatus: "pending",
      documentsVerificationStatus: "pending",
      documents: readContractorDocuments(body.documents),
      role: "contractor",
      updatedAt: FieldValue.serverTimestamp(),
      ...(contractorDocumentSnapshot.exists
        ? {}
        : {
            createdAt: FieldValue.serverTimestamp(),
            subscriptionPlan: "starter",
            subscriptionStatus: "trialing",
            subscriptionStartedAt,
            subscriptionTrialStartedAt: trialStartedAt,
            subscriptionTrialEndsAt: trialEndsAt,
            subscriptionAcceptedJobsMonth:
              getSubscriptionMonthKey(subscriptionStartedAt),
            subscriptionAcceptedJobsCount: 0,
          }),
    };

    await contractorDocument.set(contractorProfile, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Contractor profile API save failed:", {
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
