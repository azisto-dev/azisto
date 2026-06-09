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

type BadgeApiResult = {
  ok: true;
  messages: number;
  notifications: number;
};

type BadgeApiRuntime = {
  cache: Map<string, { expiresAt: number; result: BadgeApiResult }>;
  requests: Map<string, Promise<BadgeApiResult>>;
};

const badgeApiRuntimeKey = "__azistoBadgeApiRuntime";
const badgeApiRuntimeScope = globalThis as typeof globalThis & {
  [badgeApiRuntimeKey]?: BadgeApiRuntime;
};
const badgeApiRuntime =
  badgeApiRuntimeScope[badgeApiRuntimeKey] ??
  {
    cache: new Map<string, { expiresAt: number; result: BadgeApiResult }>(),
    requests: new Map<string, Promise<BadgeApiResult>>(),
  };

badgeApiRuntimeScope[badgeApiRuntimeKey] = badgeApiRuntime;

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
    const cachedResult = badgeApiRuntime.cache.get(decodedToken.uid);
    const forceRefresh =
      request.headers.get("x-azisto-force-refresh") === "true";

    if (!forceRefresh && cachedResult && cachedResult.expiresAt > Date.now()) {
      return NextResponse.json(cachedResult.result);
    }

    let requestPromise = badgeApiRuntime.requests.get(decodedToken.uid);

    if (!requestPromise) {
      requestPromise = (async () => {
        console.log(
          `[${new Date().toISOString()}] BADGE API FETCH source:`,
          request.headers.get("x-azisto-trigger") || "global-service",
        );
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
        const result: BadgeApiResult = {
          ok: true,
          messages: threadsSnapshot.size,
          notifications: notificationsSnapshot.docs.filter(
            (notificationSnapshot) => !notificationSnapshot.get("clearedAt"),
          ).length,
        };

        badgeApiRuntime.cache.set(decodedToken.uid, {
          expiresAt: Date.now() + 60_000,
          result,
        });

        return result;
      })().finally(() => {
        badgeApiRuntime.requests.delete(decodedToken.uid);
      });
      badgeApiRuntime.requests.set(decodedToken.uid, requestPromise);
    }

    return NextResponse.json(await requestPromise);
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
