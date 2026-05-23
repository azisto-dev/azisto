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

function serializeNotification(data: Record<string, unknown>) {
  return {
    notificationId: readText(data.notificationId),
    type: readText(data.type),
    title: readText(data.title),
    message: readText(data.message),
    jobId: readText(data.jobId),
    read: data.read === true,
    createdAt: serializeTimestamp(data.createdAt),
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
    const notificationsSnapshot = await adminDb
      .collection("notifications")
      .where("recipientAuthUid", "==", decodedToken.uid)
      .get();
    const notifications = notificationsSnapshot.docs
      .map((documentSnapshot) =>
        serializeNotification(documentSnapshot.data()),
      )
      .sort((firstNotification, secondNotification) =>
        secondNotification.createdAt.localeCompare(firstNotification.createdAt),
      );

    return NextResponse.json({ ok: true, notifications });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Notifications API failed:", {
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
    const notificationsSnapshot = await adminDb
      .collection("notifications")
      .where("recipientAuthUid", "==", decodedToken.uid)
      .get();
    const batch = adminDb.batch();
    const unreadNotifications = notificationsSnapshot.docs.filter(
      (notificationSnapshot) => notificationSnapshot.get("read") !== true,
    );

    unreadNotifications.forEach((notificationSnapshot) => {
      batch.set(
        notificationSnapshot.ref,
        {
          read: true,
          readAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });

    await batch.commit();

    return NextResponse.json({
      ok: true,
      updated: unreadNotifications.length,
    });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Notifications mark-read API failed:", {
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
