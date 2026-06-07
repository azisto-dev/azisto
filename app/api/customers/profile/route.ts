import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import { ensureUniqueReadableId } from "@/lib/readableIds";

export const runtime = "nodejs";

type CustomerProfileBody = {
  fullName?: unknown;
  phoneNumber?: unknown;
  address?: unknown;
  city?: unknown;
  province?: unknown;
  postalCode?: unknown;
  preferredContactMethod?: unknown;
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

function getErrorDetails(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";
  const message = error instanceof Error ? error.message : "Unknown error";

  return { code, message };
}

async function findExistingCustomerProfile(firebaseUid: string) {
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

    const body = (await request.json()) as CustomerProfileBody;
    const existingCustomerSnapshot = await findExistingCustomerProfile(
      decodedToken.uid,
    );
    const existingCustomerId = existingCustomerSnapshot?.get("customerId");
    const customerId =
      typeof existingCustomerId === "string" && existingCustomerId
        ? existingCustomerId
        : await ensureUniqueReadableId("customers", "customerId", "C");
    const customerDocument = adminDb.collection("customers").doc(customerId);
    const customerDocumentSnapshot = await customerDocument.get();
    const existingPhoneVerified =
      customerDocumentSnapshot.exists &&
      customerDocumentSnapshot.get("phoneVerified") === true;
    const existingRiskScore = customerDocumentSnapshot.get("riskScore");
    const existingAccountStatus = customerDocumentSnapshot.get("accountStatus");
    const existingOpenJobLimit = customerDocumentSnapshot.get("openJobLimit");
    const existingCompletedJobsCount =
      customerDocumentSnapshot.get("completedJobsCount");
    const existingReportsCount = customerDocumentSnapshot.get("reportsCount");

    const customerProfile = {
      customerId,
      firebaseUid: decodedToken.uid,
      userId: customerId,
      authUid: decodedToken.uid,
      emailVerified: decodedToken.email_verified === true,
      // TODO: Replace this placeholder with Firebase Phone Auth before production.
      phoneVerified: existingPhoneVerified,
      riskScore:
        typeof existingRiskScore === "number" ? existingRiskScore : 0,
      accountStatus:
        typeof existingAccountStatus === "string"
          ? existingAccountStatus
          : "active",
      openJobLimit:
        typeof existingOpenJobLimit === "number" ? existingOpenJobLimit : 2,
      completedJobsCount:
        typeof existingCompletedJobsCount === "number"
          ? existingCompletedJobsCount
          : 0,
      reportsCount:
        typeof existingReportsCount === "number" ? existingReportsCount : 0,
      fullName: readText(body.fullName),
      phoneNumber: readText(body.phoneNumber),
      address: readText(body.address),
      city: readText(body.city),
      province: readText(body.province),
      postalCode: readText(body.postalCode),
      preferredContactMethod: readText(body.preferredContactMethod),
      role: "customer",
      updatedAt: FieldValue.serverTimestamp(),
      ...(customerDocumentSnapshot.exists
        ? {}
        : { createdAt: FieldValue.serverTimestamp() }),
    };

    await customerDocument.set(customerProfile, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Customer profile API save failed:", {
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
