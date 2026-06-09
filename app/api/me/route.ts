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

type SessionApiResult = {
  ok: true;
  role: "customer" | "contractor" | "unknown";
  customerId?: string;
  contractorId?: string;
  verificationStatus: string;
  authUid: string;
  displayName: string;
};

type SessionApiRuntime = {
  cache: Map<string, { expiresAt: number; result: SessionApiResult }>;
  requests: Map<string, Promise<SessionApiResult>>;
};

const sessionApiRuntimeKey = "__azistoSessionApiRuntime";
const sessionApiRuntimeScope = globalThis as typeof globalThis & {
  [sessionApiRuntimeKey]?: SessionApiRuntime;
};
const sessionApiRuntime =
  sessionApiRuntimeScope[sessionApiRuntimeKey] ??
  {
    cache: new Map<string, { expiresAt: number; result: SessionApiResult }>(),
    requests: new Map<string, Promise<SessionApiResult>>(),
  };

sessionApiRuntimeScope[sessionApiRuntimeKey] = sessionApiRuntime;

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

async function resolveSessionProfile(firebaseUid: string): Promise<SessionApiResult> {
  const contractorProfile = await findContractorProfile(firebaseUid);

  if (contractorProfile) {
    const contractorData = contractorProfile.data() ?? {};

    return {
      ok: true,
      role: "contractor",
      contractorId:
        readText(contractorProfile.get("contractorId")) ||
        contractorProfile.id,
      verificationStatus: readText(
        contractorProfile.get("verificationStatus"),
      ),
      authUid: firebaseUid,
      displayName:
        readText(contractorData.contactName) ||
        readText(contractorData.businessName),
    };
  }

  const customerProfile = await findCustomerProfile(firebaseUid);

  if (customerProfile) {
    const customerData = customerProfile.data() ?? {};

    return {
      ok: true,
      role: "customer",
      customerId:
        readText(customerProfile.get("customerId")) || customerProfile.id,
      verificationStatus: "",
      authUid: firebaseUid,
      displayName: readText(customerData.fullName),
    };
  }

  return {
    ok: true,
    role: "unknown",
    customerId: "",
    contractorId: "",
    verificationStatus: "",
    authUid: firebaseUid,
    displayName: "",
  };
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
    const cachedResult = sessionApiRuntime.cache.get(decodedToken.uid);

    if (cachedResult && cachedResult.expiresAt > Date.now()) {
      return NextResponse.json(cachedResult.result);
    }

    let requestPromise = sessionApiRuntime.requests.get(decodedToken.uid);

    if (!requestPromise) {
      requestPromise = resolveSessionProfile(decodedToken.uid)
        .then((result) => {
          sessionApiRuntime.cache.set(decodedToken.uid, {
            expiresAt: Date.now() + 60_000,
            result,
          });
          return result;
        })
        .finally(() => {
          sessionApiRuntime.requests.delete(decodedToken.uid);
        });
      sessionApiRuntime.requests.set(decodedToken.uid, requestPromise);
    }

    return NextResponse.json(await requestPromise);
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
