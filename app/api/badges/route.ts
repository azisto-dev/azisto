import { NextRequest, NextResponse } from "next/server";
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

function readStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getErrorDetails(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";
  const message = error instanceof Error ? error.message : "Unknown error";

  return { code, message };
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
    const [threadsSnapshot, notificationsSnapshot] = await Promise.all([
      adminDb
        .collection("messages")
        .where("participants", "array-contains", decodedToken.uid)
        .get(),
      adminDb
        .collection("notifications")
        .where("recipientAuthUid", "==", decodedToken.uid)
        .get(),
    ]);
    const unreadMessagesCount = threadsSnapshot.docs.filter((threadSnapshot) =>
      readStringList(threadSnapshot.get("unreadBy")).includes(decodedToken.uid),
    ).length;
    const unreadNotificationsCount = notificationsSnapshot.docs.filter(
      (notificationSnapshot) => notificationSnapshot.get("read") !== true,
    ).length;

    return NextResponse.json({
      ok: true,
      messages: unreadMessagesCount,
      notifications: unreadNotificationsCount,
    });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Badge counts API failed:", {
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
