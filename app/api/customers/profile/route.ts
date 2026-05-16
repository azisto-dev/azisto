import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";

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
    const body = (await request.json()) as CustomerProfileBody;

    const customerProfile = {
      userId: decodedToken.uid,
      fullName: readText(body.fullName),
      phoneNumber: readText(body.phoneNumber),
      address: readText(body.address),
      city: readText(body.city),
      province: readText(body.province),
      postalCode: readText(body.postalCode),
      preferredContactMethod: readText(body.preferredContactMethod),
      role: "customer",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb
      .collection("customers")
      .doc(decodedToken.uid)
      .set(customerProfile, { merge: true });

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
