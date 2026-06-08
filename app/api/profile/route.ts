import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type ProfileRole = "customer" | "contractor";

type EditableProfileBody = Record<string, unknown>;

const customerEditableFields = [
  "fullName",
  "phoneNumber",
  "address",
  "city",
  "province",
  "postalCode",
  "preferredContactMethod",
] as const;

const contractorEditableFields = [
  "contactName",
  "businessName",
  "phoneNumber",
  "address",
  "city",
  "province",
  "postalCode",
  "serviceRadiusKm",
] as const;

const profilePhotoFields = [
  "profilePhotoUrl",
  "profilePhotoStoragePath",
  "profilePhotoFileName",
  "profilePhotoContentType",
  "profilePhotoSize",
  "profilePhotoUploadedAt",
] as const;

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return "";
  }

  return authorizationHeader.slice("Bearer ".length).trim();
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function readStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readRecord(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function readStringListMap(value: unknown) {
  const data = readRecord(value);
  return Object.fromEntries(
    Object.entries(data).map(([key, list]) => [key, readStringList(list)]),
  );
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

async function findProfile(collectionName: string, firebaseUid: string) {
  const collection = adminDb.collection(collectionName);
  const authUidSnapshot = await collection
    .where("authUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!authUidSnapshot.empty) {
    return authUidSnapshot.docs[0];
  }

  const firebaseUidSnapshot = await collection
    .where("firebaseUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!firebaseUidSnapshot.empty) {
    return firebaseUidSnapshot.docs[0];
  }

  const legacyDocumentSnapshot = await collection.doc(firebaseUid).get();

  return legacyDocumentSnapshot.exists ? legacyDocumentSnapshot : null;
}

async function findUserProfile(firebaseUid: string) {
  const contractorProfile = await findProfile("contractors", firebaseUid);

  if (contractorProfile) {
    return {
      role: "contractor" as ProfileRole,
      snapshot: contractorProfile,
    };
  }

  const customerProfile = await findProfile("customers", firebaseUid);

  if (customerProfile) {
    return {
      role: "customer" as ProfileRole,
      snapshot: customerProfile,
    };
  }

  return null;
}

function serializeCustomerProfile(data: Record<string, unknown>, email: string) {
  return {
    customerId: readText(data.customerId),
    role: "customer",
    fullName: readText(data.fullName),
    email,
    phoneNumber: readText(data.phoneNumber),
    address: readText(data.address),
    city: readText(data.city),
    province: readText(data.province),
    postalCode: readText(data.postalCode),
    preferredContactMethod: readText(data.preferredContactMethod),
    profilePhotoUrl: readText(data.profilePhotoUrl),
    profilePhotoStoragePath: readText(data.profilePhotoStoragePath),
    profilePhotoFileName: readText(data.profilePhotoFileName),
  };
}

function serializeContractorProfile(
  data: Record<string, unknown>,
  email: string,
) {
  return {
    contractorId: readText(data.contractorId),
    role: "contractor",
    contactName: readText(data.contactName),
    businessName: readText(data.businessName),
    email: readText(data.email) || email,
    phoneNumber: readText(data.phoneNumber),
    address: readText(data.address),
    city: readText(data.city),
    province: readText(data.province),
    postalCode: readText(data.postalCode),
    serviceRadiusKm: readNumber(data.serviceRadiusKm),
    selectedServices: readStringList(data.selectedServices),
    selectedSubcategoriesByService: readStringListMap(
      data.selectedSubcategoriesByService,
    ),
    insuranceProvider: readText(data.insuranceProvider),
    insurancePolicyNumber: readText(data.insurancePolicyNumber),
    businessLicenceNumber: readText(data.businessLicenceNumber),
    documentsVerificationStatus: readText(data.documentsVerificationStatus),
    documents: readRecord(data.documents),
    verificationStatus: readText(data.verificationStatus),
    profilePhotoUrl: readText(data.profilePhotoUrl),
    profilePhotoStoragePath: readText(data.profilePhotoStoragePath),
    profilePhotoFileName: readText(data.profilePhotoFileName),
  };
}

function serializeProfile(
  role: ProfileRole,
  data: Record<string, unknown>,
  email: string,
) {
  return role === "customer"
    ? serializeCustomerProfile(data, email)
    : serializeContractorProfile(data, email);
}

function getSafeUpdate(role: ProfileRole, body: EditableProfileBody) {
  const update: Record<string, unknown> = {};

  if (role === "customer") {
    customerEditableFields.forEach((fieldName) => {
      if (fieldName in body) {
        update[fieldName] = readText(body[fieldName]);
      }
    });
  } else {
    contractorEditableFields.forEach((fieldName) => {
      if (fieldName === "serviceRadiusKm") {
        if (fieldName in body) {
          update[fieldName] = readNumber(body[fieldName]);
        }

        return;
      }

      if (fieldName in body) {
        update[fieldName] = readText(body[fieldName]);
      }
    });

    if ("selectedServices" in body) {
      update.selectedServices = readStringList(body.selectedServices);
    }

    if ("selectedSubcategoriesByService" in body) {
      update.selectedSubcategoriesByService = readStringListMap(
        body.selectedSubcategoriesByService,
      );
    }

    if ("insuranceProvider" in body) {
      update.insuranceProvider = readText(body.insuranceProvider);
    }

    if ("insurancePolicyNumber" in body) {
      update.insurancePolicyNumber = readText(body.insurancePolicyNumber);
    }

    if ("businessLicenceNumber" in body) {
      update.businessLicenceNumber = readText(body.businessLicenceNumber);
    }

    if ("documents" in body) {
      update.documents = readRecord(body.documents);
      update.documentsVerificationStatus = "pending";
    }
  }

  profilePhotoFields.forEach((fieldName) => {
    if (!(fieldName in body)) {
      return;
    }

    update[fieldName] =
      fieldName === "profilePhotoSize"
        ? readNumber(body[fieldName])
        : readText(body[fieldName]);
  });

  if (role === "contractor" && Object.keys(update).length > 0) {
    update.verificationStatus = "pending";
  }

  return update;
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
    const userProfile = await findUserProfile(decodedToken.uid);

    if (!userProfile) {
      return NextResponse.json(
        {
          code: "profile-not-found",
          message: "Profile not found.",
        },
        { status: 404 },
      );
    }

    let serializedProfile: Record<string, unknown> = serializeProfile(
      userProfile.role,
      userProfile.snapshot.data() ?? {},
      decodedToken.email ?? "",
    );

    if (userProfile.role === "contractor") {
      const contractorData = userProfile.snapshot.data() ?? {};
      const contractorId =
        readText(contractorData.contractorId) || userProfile.snapshot.id;
      const reviewsSnapshot = await adminDb
        .collection("reviews")
        .where("contractorId", "==", contractorId)
        .get();
      const recentReviews = reviewsSnapshot.docs
        .map((reviewSnapshot) => ({
          reviewId: reviewSnapshot.id,
          jobId: readText(reviewSnapshot.get("jobId")),
          rating: readNumber(reviewSnapshot.get("rating")),
          reviewText: readText(reviewSnapshot.get("reviewText")),
          tags: readStringList(reviewSnapshot.get("tags")),
          subcategory: readText(reviewSnapshot.get("subcategory")),
          createdAt: serializeTimestamp(reviewSnapshot.get("createdAt")),
        }))
        .sort((firstReview, secondReview) =>
          secondReview.createdAt.localeCompare(firstReview.createdAt),
        )
        .slice(0, 3);

      serializedProfile = {
        ...serializedProfile,
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
      };
    }

    return NextResponse.json({
      ok: true,
      role: userProfile.role,
      profile: serializedProfile,
    });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Profile API GET failed:", {
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

export async function PATCH(request: NextRequest) {
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
    const userProfile = await findUserProfile(decodedToken.uid);

    if (!userProfile) {
      return NextResponse.json(
        {
          code: "profile-not-found",
          message: "Profile not found.",
        },
        { status: 404 },
      );
    }

    const body = (await request.json()) as EditableProfileBody;
    const safeUpdate = getSafeUpdate(userProfile.role, body);

    await userProfile.snapshot.ref.set(
      {
        ...safeUpdate,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const updatedSnapshot = await userProfile.snapshot.ref.get();

    return NextResponse.json({
      ok: true,
      role: userProfile.role,
      profile: serializeProfile(
        userProfile.role,
        updatedSnapshot.data() ?? {},
        decodedToken.email ?? "",
      ),
    });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Profile API PATCH failed:", {
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
