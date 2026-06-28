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

async function findProfile(collectionName: "customers" | "contractors", uid: string) {
  const collection = adminDb.collection(collectionName);
  const authUidSnapshot = await collection.where("authUid", "==", uid).limit(1).get();

  if (!authUidSnapshot.empty) {
    return authUidSnapshot.docs[0];
  }

  const firebaseUidSnapshot = await collection
    .where("firebaseUid", "==", uid)
    .limit(1)
    .get();

  if (!firebaseUidSnapshot.empty) {
    return firebaseUidSnapshot.docs[0];
  }

  const legacySnapshot = await collection.doc(uid).get();

  return legacySnapshot.exists ? legacySnapshot : null;
}

async function resolveUserProfile(uid: string) {
  const contractorProfile = await findProfile("contractors", uid);

  if (contractorProfile) {
    return {
      role: "contractor" as const,
      profileId: readText(contractorProfile.get("contractorId")) || contractorProfile.id,
    };
  }

  const customerProfile = await findProfile("customers", uid);

  if (customerProfile) {
    return {
      role: "customer" as const,
      profileId: readText(customerProfile.get("customerId")) || customerProfile.id,
    };
  }

  return {
    role: "unknown" as const,
    profileId: uid,
  };
}

export async function POST(request: NextRequest) {
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

    const profile = await resolveUserProfile(decodedToken.uid);
    const tokenId = hashToken(fcmToken);

    await adminDb.collection("pushTokens").doc(tokenId).set(
      {
        token: fcmToken,
        authUid: decodedToken.uid,
        role: profile.role,
        profileId: profile.profileId,
        platform: "web",
        userAgent: request.headers.get("user-agent") ?? "",
        disabledAt: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastUsedAt: null,
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, tokenId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    console.error("Push token register failed:", { message, error });

    return NextResponse.json(
      { code: "push-register-failed", message },
      { status: 500 },
    );
  }
}
