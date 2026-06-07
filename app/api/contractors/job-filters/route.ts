import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import { sanitizeServiceCities } from "@/lib/serviceAreas";

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
    .filter(Boolean)
    .slice(0, 30);
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
    categories: readStringList(data.categories),
    subcategories: readStringList(data.subcategories),
    serviceCities: sanitizeServiceCities(data.serviceCities ?? data.cities),
    urgency: readUrgency(data.urgency),
    sort: readSort(data.sort),
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

async function getContractorProfile(request: NextRequest) {
  const token = getBearerToken(request.headers.get("authorization"));

  if (!token) {
    throw Object.assign(new Error("Please sign in again."), {
      code: "missing-token",
    });
  }

  const decodedToken = await adminAuth.verifyIdToken(token);
  const contractorProfile = await findContractorProfile(decodedToken.uid);

  if (!contractorProfile) {
    throw Object.assign(
      new Error("Please use a contractor account to manage job filters."),
      { code: "contractor-profile-required" },
    );
  }

  return contractorProfile;
}

export async function GET(request: NextRequest) {
  try {
    assertFirebaseAdminConfig();

    const contractorProfile = await getContractorProfile(request);
    const preferences = normalizePreferences(
      contractorProfile.get("jobFilterPreferences"),
    );

    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Contractor job filters GET failed:", { code, message, error });

    return NextResponse.json(
      { code, message },
      {
        status:
          code === "missing-token"
            ? 401
            : code === "contractor-profile-required"
              ? 403
              : 500,
      },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertFirebaseAdminConfig();

    const contractorProfile = await getContractorProfile(request);
    const body = (await request.json().catch(() => null)) as unknown;
    const preferences = normalizePreferences(body);

    await contractorProfile.ref.set(
      {
        jobFilterPreferences: {
          ...preferences,
          updatedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Contractor job filters PATCH failed:", {
      code,
      message,
      error,
    });

    return NextResponse.json(
      { code, message },
      {
        status:
          code === "missing-token"
            ? 401
            : code === "contractor-profile-required"
              ? 403
              : 500,
      },
    );
  }
}
