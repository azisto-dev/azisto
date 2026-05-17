import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import { ensureUniqueReadableId } from "@/lib/readableIds";

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

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function readDocumentStatus(value: unknown, fallback: string) {
  return readText(value) || fallback;
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
      fileUrl: readText(tradeLicence.fileUrl),
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
      fileUrl: readText(governmentId.fileUrl),
      expiryDate: readText(governmentId.expiryDate),
      reviewedAt: null,
      rejectionReason: readText(governmentId.rejectionReason),
    },
    businessLicence: {
      status: readDocumentStatus(businessLicence.status, "not_uploaded"),
      fileUrl: readText(businessLicence.fileUrl),
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
      fileUrl: readText(commercialGeneralLiability.fileUrl),
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
      clearanceLetterUrl: readText(worksafeBC.clearanceLetterUrl),
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
      vehicleRegistrationUrl: readText(vehicleDocuments.vehicleRegistrationUrl),
      commercialVehicleInsuranceUrl: readText(
        vehicleDocuments.commercialVehicleInsuranceUrl,
      ),
      cargoInsuranceUrl: readText(vehicleDocuments.cargoInsuranceUrl),
      towingInsuranceUrl: readText(vehicleDocuments.towingInsuranceUrl),
      garageKeepersLiabilityUrl: readText(
        vehicleDocuments.garageKeepersLiabilityUrl,
      ),
      vehicleType: readText(vehicleDocuments.vehicleType),
      licencePlate: readText(vehicleDocuments.licencePlate),
      insuranceExpiryDate: readText(vehicleDocuments.insuranceExpiryDate),
      reviewedAt: null,
      rejectionReason: readText(vehicleDocuments.rejectionReason),
    },
    drivingAbstract: {
      status: readDocumentStatus(drivingAbstract.status, "not_required"),
      fileUrl: readText(drivingAbstract.fileUrl),
      issueDate: readText(drivingAbstract.issueDate),
      licenceClass: readText(drivingAbstract.licenceClass),
      licenceExpiryDate: readText(drivingAbstract.licenceExpiryDate),
      reviewedAt: null,
      rejectionReason: readText(drivingAbstract.rejectionReason),
      confirmedDrivingRecord: readBoolean(
        drivingAbstract.confirmedDrivingRecord,
      ),
    },
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
        : { createdAt: FieldValue.serverTimestamp() }),
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
