import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";

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

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function DELETE(request: NextRequest) {
  try {
    assertFirebaseAdminConfig();

    const token = getBearerToken(request.headers.get("authorization"));

    if (!token) {
      return NextResponse.json(
        { code: "missing-token", message: "Please sign in again." },
        { status: 401 },
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const fcmToken = readText(body?.token);

    if (!fcmToken) {
      return NextResponse.json(
        { code: "missing-token", message: "Push token is required." },
        { status: 400 },
      );
    }

    const tokenDocument = adminDb.collection("pushTokens").doc(hashToken(fcmToken));
    const tokenSnapshot = await tokenDocument.get();

    if (
      tokenSnapshot.exists &&
      tokenSnapshot.get("authUid") !== decodedToken.uid
    ) {
      return NextResponse.json(
        { code: "forbidden", message: "You can only disable your own push token." },
        { status: 403 },
      );
    }

    await tokenDocument.set(
      {
        authUid: decodedToken.uid,
        disabledAt: FieldValue.serverTimestamp(),
        disabledReason: "user_disabled",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    console.error("Push token unregister failed:", { message, error });

    return NextResponse.json(
      { code: "push-unregister-failed", message },
      { status: 500 },
    );
  }
}
