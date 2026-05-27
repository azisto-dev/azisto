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
        .where("unreadBy", "array-contains", decodedToken.uid)
        .get(),
      adminDb
        .collection("notifications")
        .where("recipientAuthUid", "==", decodedToken.uid)
        .where("read", "==", false)
        .get(),
    ]);
    const unreadMessagesCount = threadsSnapshot.size;
    const unreadNotificationsCount = notificationsSnapshot.size;

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
