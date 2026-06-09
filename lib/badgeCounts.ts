import type { User } from "firebase/auth";
import {
  getRetryBackoffMs,
  isAuthenticationError,
  isNetworkError,
  isQuotaExceededMessage,
} from "@/lib/apiErrors";
import {
  authenticatedFetch,
  throwApiResponseError,
} from "@/lib/authenticatedFetch";

export type BadgeCounts = {
  messages: number;
  notifications: number;
};

function readCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

const emptyBadgeCounts: BadgeCounts = {
  messages: 0,
  notifications: 0,
};
const badgeCacheTtlMs = 120_000;
const badgePollingIntervalMs = 120_000;
const badgeQuotaBackoffMs = 10 * 60_000;
type BadgeSubscriber = (counts: BadgeCounts) => void;
type BadgeSession = {
  intervalId: ReturnType<typeof setInterval>;
  refreshListener: () => void;
  visibilityListener: () => void;
  subscribers: Set<BadgeSubscriber>;
  user: User;
};
type BadgeRuntime = {
  cache: Map<
    string,
    {
      counts: BadgeCounts;
      expiresAt: number;
    }
  >;
  requests: Map<string, Promise<BadgeCounts>>;
  retryAfter: Map<string, number>;
  sessions: Map<string, BadgeSession>;
};

const badgeRuntimeKey = "__azistoBadgeRuntime";
const badgeRuntimeScope = globalThis as typeof globalThis & {
  [badgeRuntimeKey]?: BadgeRuntime;
};
const badgeRuntime: BadgeRuntime =
  badgeRuntimeScope[badgeRuntimeKey] ??
  {
    cache: new Map<
      string,
      {
        counts: BadgeCounts;
        expiresAt: number;
      }
    >(),
    requests: new Map<string, Promise<BadgeCounts>>(),
    retryAfter: new Map<string, number>(),
    sessions: new Map<string, BadgeSession>(),
  };

badgeRuntimeScope[badgeRuntimeKey] = badgeRuntime;

const badgeCache = badgeRuntime.cache;
const badgeRequests = badgeRuntime.requests;
const badgeRetryAfter = badgeRuntime.retryAfter;
const badgeSessions = badgeRuntime.sessions;

export async function fetchBadgeCounts(
  user: User,
  source = "unknown",
  forceRefresh = false,
): Promise<BadgeCounts> {
  const cachedCounts = badgeCache.get(user.uid);
  const now = Date.now();

  if (!forceRefresh && cachedCounts && cachedCounts.expiresAt > now) {
    return cachedCounts.counts;
  }

  if ((badgeRetryAfter.get(user.uid) ?? 0) > now) {
    return cachedCounts?.counts ?? emptyBadgeCounts;
  }

  const pendingRequest = badgeRequests.get(user.uid);

  if (pendingRequest) {
    return pendingRequest;
  }

  const nextRequest = (async () => {
    try {
      console.log(
        `[${new Date().toISOString()}] BADGE API FETCH source: global-service`,
        source,
      );
      const response = await authenticatedFetch(user, "/api/badges", {
        headers: {
          "X-Azisto-Trigger": "global-service",
          "X-Azisto-Force-Refresh": forceRefresh ? "true" : "false",
        },
      });
      const responseBody = (await response.json().catch(() => null)) as {
        messages?: unknown;
        notifications?: unknown;
        message?: unknown;
      } | null;

      if (!response.ok) {
        const message =
          typeof responseBody?.message === "string"
            ? responseBody.message
            : "Unable to load badge counts.";

        if (response.status === 429 || isQuotaExceededMessage(message)) {
          badgeRetryAfter.set(user.uid, Date.now() + badgeQuotaBackoffMs);
          console.warn(
            "Badge polling paused due to quota. Retrying in 10 minutes.",
          );
          return cachedCounts?.counts ?? emptyBadgeCounts;
        }

        await throwApiResponseError(response, message);
      }

      const counts = {
        messages: readCount(responseBody?.messages),
        notifications: readCount(responseBody?.notifications),
      };

      badgeCache.set(user.uid, {
        counts,
        expiresAt: Date.now() + badgeCacheTtlMs,
      });
      badgeRetryAfter.delete(user.uid);

      return counts;
    } catch (error) {
      const quotaExceeded = isQuotaExceededMessage(
        error instanceof Error ? error.message : String(error),
      );
      const backoffMs = quotaExceeded
        ? badgeQuotaBackoffMs
        : getRetryBackoffMs(error, 2 * 60_000);

      if (
        backoffMs > 0 ||
        isAuthenticationError(error) ||
        isNetworkError(error)
      ) {
        badgeRetryAfter.set(user.uid, Date.now() + Math.max(backoffMs, 2 * 60_000));

        if (quotaExceeded) {
          console.warn(
            "Badge polling paused due to quota. Retrying in 10 minutes.",
          );
        }

        return cachedCounts?.counts ?? emptyBadgeCounts;
      }

      throw error;
    } finally {
      badgeRequests.delete(user.uid);
    }
  })();

  badgeRequests.set(user.uid, nextRequest);

  return nextRequest;
}

async function refreshBadgeSession(
  user: User,
  source: string,
  forceRefresh = false,
) {
  const counts = await fetchBadgeCounts(user, source, forceRefresh);
  const session = badgeSessions.get(user.uid);

  session?.subscribers.forEach((subscriber) => subscriber(counts));
}

export async function refreshBadgeCountsNow(user: User, source: string) {
  badgeCache.delete(user.uid);
  await refreshBadgeSession(user, source, true);
}

export function subscribeBadgeCounts(
  user: User,
  subscriber: BadgeSubscriber,
  source: string,
) {
  let session = badgeSessions.get(user.uid);

  if (!session) {
    const subscribers = new Set<BadgeSubscriber>([subscriber]);
    console.log(`[${new Date().toISOString()}] BADGE_INTERVAL_CREATED`);
    console.count("BADGE_INTERVAL_CREATED");
    const intervalId = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }

      void refreshBadgeSession(user, "shared badge interval");
    }, badgePollingIntervalMs);
    const refreshListener = () => {
      void refreshBadgeCountsNow(user, "badge refresh event");
    };
    const visibilityListener = () => {
      if (!document.hidden) {
        void refreshBadgeCountsNow(user, "tab visible");
      }
    };

    window.addEventListener("azisto:badges-refresh", refreshListener);
    document.addEventListener("visibilitychange", visibilityListener);

    session = {
      intervalId,
      refreshListener,
      visibilityListener,
      subscribers,
      user,
    };
    badgeSessions.set(user.uid, session);
    void refreshBadgeSession(user, source);
  } else {
    const cachedCounts = badgeCache.get(user.uid);

    if (cachedCounts) {
      subscriber(cachedCounts.counts);
    }
  }

  session.subscribers.add(subscriber);

  return () => {
    const currentSession = badgeSessions.get(user.uid);

    if (!currentSession) {
      return;
    }

    currentSession.subscribers.delete(subscriber);

    if (currentSession.subscribers.size === 0) {
      clearInterval(currentSession.intervalId);
      window.removeEventListener(
        "azisto:badges-refresh",
        currentSession.refreshListener,
      );
      document.removeEventListener(
        "visibilitychange",
        currentSession.visibilityListener,
      );
      badgeSessions.delete(user.uid);
    }
  };
}
