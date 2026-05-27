import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import {
  firebaseQuotaMessage,
  isQuotaExceededMessage,
} from "@/lib/apiErrors";

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

    if (contractorProfile) {
      const contractorData = contractorProfile.data() ?? {};

      return NextResponse.json({
        ok: true,
        role: "contractor",
        contractorId:
          readText(contractorProfile.get("contractorId")) ||
          contractorProfile.id,
        verificationStatus: readText(
          contractorProfile.get("verificationStatus"),
        ),
        authUid: decodedToken.uid,
        displayName:
          readText(contractorData.contactName) ||
          readText(contractorData.businessName),
      });
    }

    const customerProfile = await findCustomerProfile(decodedToken.uid);

    if (customerProfile) {
      const customerData = customerProfile.data() ?? {};

      return NextResponse.json({
        ok: true,
        role: "customer",
        customerId:
          readText(customerProfile.get("customerId")) || customerProfile.id,
        verificationStatus: "",
        authUid: decodedToken.uid,
        displayName: readText(customerData.fullName),
      });
    }

    return NextResponse.json({
      ok: true,
      role: "unknown",
      customerId: "",
      contractorId: "",
      verificationStatus: "",
      authUid: decodedToken.uid,
      displayName: "",
    });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Current user role API failed:", {
      code,
      message,
      error,
    });

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
      {
        code,
        message,
      },
      { status: code === "missing-token" ? 401 : 500 },
    );
  }
}
