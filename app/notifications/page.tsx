"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ChevronLeft, Bell, RefreshCw, Trash2, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { fetchSessionProfile } from "@/lib/sessionProfile";
import {
  isQuotaExceededError,
  isQuotaExceededMessage,
} from "@/lib/apiErrors";
import {
  authenticatedFetch,
  throwApiResponseError,
} from "@/lib/authenticatedFetch";
import { refreshBadgeCountsNow } from "@/lib/badgeCounts";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushNotificationStatus,
  type PushNotificationStatus,
} from "@/lib/pushNotifications";
import BottomNav from "@/app/components/BottomNav";
import AppHeader from "@/app/components/AppHeader";
import AppShimmer from "@/app/components/AppShimmer";
import ContractorHeader from "@/app/components/ContractorHeader";
import { getContractorJobHref } from "@/lib/contractorJobHref";

type NotificationItem = {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  jobId: string;
  threadId: string;
  read: boolean;
  createdAt: string;
};

type NotificationThreadLink = {
  threadId: string;
  jobId: string;
};

function formatDate(value: string) {
  return value
    ? new Intl.DateTimeFormat("en-CA", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Recently";
}

async function fetchNotifications(
  user: User,
  source: "page-open" | "interval" | "manual",
) {
  console.log(
    `[${new Date().toISOString()}] NOTIFICATIONS FETCH source: ${source}`,
  );
  const response = await authenticatedFetch(user, "/api/notifications");
  const body = (await response.json().catch(() => null)) as {
    code?: unknown;
    notifications?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok) {
    await throwApiResponseError(
      response,
      typeof body?.message === "string"
        ? body.message
        : "Unable to load notifications.",
    );
  }

  return Array.isArray(body?.notifications)
    ? (body.notifications as NotificationItem[])
    : [];
}

async function markNotificationsRead(user: User, notificationId?: string) {
  await authenticatedFetch(user, "/api/notifications", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(notificationId ? { notificationId } : {}),
  });
}

async function clearNotifications(user: User) {
  const response = await authenticatedFetch(user, "/api/notifications", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "clear-all" }),
  });
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Unable to clear notifications.",
    );
  }
}

async function clearNotification(user: User, notificationId: string) {
  const response = await authenticatedFetch(user, "/api/notifications", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "clear", notificationId }),
  });
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Unable to clear this notification.",
    );
  }
}

async function fetchMessageThreadLinks(user: User) {
  const token = await user.getIdToken();
  const response = await fetch("/api/messages/threads", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json().catch(() => null)) as {
    threads?: unknown;
  } | null;

  if (!response.ok || !Array.isArray(body?.threads)) {
    return [];
  }

  return body.threads
    .map((thread) => {
      const data =
        typeof thread === "object" && thread !== null
          ? (thread as Record<string, unknown>)
          : {};

      return {
        threadId: typeof data.threadId === "string" ? data.threadId : "",
        jobId: typeof data.jobId === "string" ? data.jobId : "",
      };
    })
    .filter((thread): thread is NotificationThreadLink =>
      Boolean(thread.threadId && thread.jobId),
    );
}

function getNotificationHref(
  notification: NotificationItem,
  role: "customer" | "contractor" | "unknown",
) {
  if (notification.type === "new_message") {
    return notification.threadId
      ? `/messages/${encodeURIComponent(notification.threadId)}`
      : "/messages";
  }

  if (!notification.jobId) {
    return "/notifications";
  }

  return role === "contractor"
    ? getContractorJobHref(notification.jobId)
    : "/customer/jobs";
}

function SwipeNotificationCard({
  notification,
  compactCardClass,
  primaryTextClass,
  mutedTextClass,
  accentTextClass,
  notificationChipClass,
  onOpen,
  onClear,
}: {
  notification: NotificationItem;
  compactCardClass: string;
  primaryTextClass: string;
  mutedTextClass: string;
  accentTextClass: string;
  notificationChipClass: string;
  onOpen: () => void;
  onClear: () => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointerStartXRef = useRef(0);
  const offsetXRef = useRef(0);
  const draggedRef = useRef(false);
  const clearThreshold = 92;

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointerStartXRef.current = event.clientX - offsetX;
    draggedRef.current = false;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) {
      return;
    }

    const nextOffset = Math.max(
      0,
      Math.min(120, event.clientX - pointerStartXRef.current),
    );

    if (nextOffset > 6) {
      draggedRef.current = true;
    }

    offsetXRef.current = nextOffset;
    setOffsetX(nextOffset);
  }

  function handlePointerEnd() {
    if (!isDragging) {
      return;
    }

    setIsDragging(false);

    if (offsetXRef.current >= clearThreshold) {
      offsetXRef.current = 140;
      setOffsetX(140);
      onClear();
      return;
    }

    offsetXRef.current = 0;
    setOffsetX(0);
  }

  return (
    <div className="relative overflow-hidden rounded-[20px] bg-red-50">
      <button
        type="button"
        onClick={onClear}
        className="absolute inset-y-0 left-0 flex w-24 items-center justify-center bg-red-50 text-xs font-bold text-red-700"
      >
        Clear
      </button>
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!draggedRef.current) {
            onOpen();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            onOpen();
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{ transform: `translateX(${offsetX}px)` }}
        className={`${compactCardClass} relative block w-full touch-pan-y p-4 text-left hover:-translate-y-0.5 ${
          isDragging ? "" : "transition-transform duration-200 ease-out"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className={`text-sm font-bold ${primaryTextClass}`}>
            {notification.title}
          </h2>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold ${notificationChipClass}`}
          >
            {notification.read ? "Read" : "Unread"}
          </span>
        </div>
        <p className={`mt-2 text-sm leading-6 ${mutedTextClass}`}>
          {notification.message}
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className={`text-xs font-semibold ${mutedTextClass}`}>
            <span className={accentTextClass}>{notification.jobId}</span> ·{" "}
            {formatDate(notification.createdAt)}
          </p>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            className="hidden text-xs font-bold text-red-600 sm:inline-flex"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [role, setRole] = useState<"customer" | "contractor" | "unknown">(
    "unknown",
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [pushStatus, setPushStatus] =
    useState<PushNotificationStatus>("not_enabled");
  const [isUpdatingPush, setIsUpdatingPush] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const notificationRequestInFlightRef = useRef(false);
  const notificationRetryAfterRef = useRef(0);
  const isCustomer = role !== "contractor";
  const shellClass = isCustomer
    ? "az-customer-shell min-h-screen md:px-6 md:py-8"
    : "az-contractor-shell min-h-screen md:px-6 md:py-8";
  const frameClass = isCustomer
    ? "mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border"
    : "mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-[var(--azisto-contractor-bg)] shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-[var(--azisto-contractor-border)]";
  const cardClass = isCustomer ? "az-customer-card" : "az-contractor-card";
  const compactCardClass = isCustomer
    ? "az-customer-card"
    : "az-contractor-card-compact";
  const primaryTextClass = isCustomer
    ? "text-[#1F1F1F]"
    : "text-[var(--azisto-contractor-text)]";
  const mutedTextClass = isCustomer
    ? "text-[#64748B]"
    : "text-[var(--azisto-contractor-muted)]";
  const accentTextClass = isCustomer
    ? "text-azisto-accent"
    : "text-[var(--azisto-contractor-burgundy)]";
  const notificationChipClass = isCustomer
    ? "az-customer-unread-badge"
    : "border-[rgb(138_15_77_/_0.14)] bg-[rgb(138_15_77_/_0.08)] text-[var(--azisto-contractor-burgundy)]";
  const pushStatusLabel: Record<PushNotificationStatus, string> = {
    enabled: "Enabled",
    not_enabled: "Not enabled",
    blocked: "Blocked by browser",
    not_supported: "Not supported on this browser",
  };

  async function loadNotifications(
    user: User,
    source: "page-open" | "interval" | "manual",
  ) {
    if (
      notificationRequestInFlightRef.current ||
      notificationRetryAfterRef.current > Date.now()
    ) {
      return;
    }

    notificationRequestInFlightRef.current = true;

    try {
      const userNotifications = await fetchNotifications(user, source);
      setNotifications(
        userNotifications.filter((notification) => !notification.read),
      );
      notificationRetryAfterRef.current = 0;
      setErrorMessage("");
    } catch (error) {
      if (
        isQuotaExceededError(error) ||
        isQuotaExceededMessage(
          error instanceof Error ? error.message : String(error),
        )
      ) {
        notificationRetryAfterRef.current = Date.now() + 10 * 60_000;
      }

      if (source !== "interval") {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load notifications.",
        );
      }
    } finally {
      notificationRequestInFlightRef.current = false;
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setCurrentUser(user);

      try {
        setIsLoading(true);
        setErrorMessage("");
        const profile = await fetchSessionProfile(user);
        setRole(profile.role);
        setPushStatus(await getPushNotificationStatus());
        await loadNotifications(user, "page-open");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load notifications.");
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        void loadNotifications(currentUser, "interval");
      }
    }, 120_000);

    return () => window.clearInterval(intervalId);
  }, [currentUser]);

  async function handleRefresh() {
    if (!currentUser || isRefreshing) {
      return;
    }

    try {
      setIsRefreshing(true);
      await loadNotifications(currentUser, "manual");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleEnablePush() {
    if (!currentUser || isUpdatingPush) {
      return;
    }

    try {
      setIsUpdatingPush(true);
      setPushMessage("");
      const nextStatus = await enablePushNotifications(currentUser);
      setPushStatus(nextStatus);
      setPushMessage(
        nextStatus === "enabled"
          ? "Push notifications enabled."
          : nextStatus === "blocked"
            ? "Browser permission is blocked. Update your browser site settings to enable push notifications."
            : nextStatus === "not_supported"
              ? "This browser does not support web push notifications."
              : "Push notifications were not enabled.",
      );
    } catch (error) {
      setPushMessage(
        error instanceof Error
          ? error.message
          : "Unable to enable push notifications.",
      );
      setPushStatus(await getPushNotificationStatus());
    } finally {
      setIsUpdatingPush(false);
    }
  }

  async function handleDisablePush() {
    if (!currentUser || isUpdatingPush) {
      return;
    }

    try {
      setIsUpdatingPush(true);
      setPushMessage("");
      const nextStatus = await disablePushNotifications(currentUser);
      setPushStatus(nextStatus === "enabled" ? "not_enabled" : nextStatus);
      setPushMessage("Push notifications disabled.");
    } catch (error) {
      setPushMessage(
        error instanceof Error
          ? error.message
          : "Unable to disable push notifications.",
      );
      setPushStatus(await getPushNotificationStatus());
    } finally {
      setIsUpdatingPush(false);
    }
  }

  async function handleNotificationClick(notification: NotificationItem) {
    let href = getNotificationHref(notification, role);

    if (
      notification.type === "new_message" &&
      !notification.threadId &&
      notification.jobId &&
      currentUser
    ) {
      const matchingThread = (await fetchMessageThreadLinks(currentUser)).find(
        (thread) => thread.jobId === notification.jobId,
      );

      if (matchingThread) {
        href = `/messages/${encodeURIComponent(matchingThread.threadId)}`;
      }
    }

    setNotifications((currentNotifications) =>
      currentNotifications.filter(
        (currentNotification) =>
          currentNotification.notificationId !== notification.notificationId,
      ),
    );

    if (currentUser) {
      try {
        await markNotificationsRead(currentUser, notification.notificationId);
        await refreshBadgeCountsNow(currentUser, "notification read");
      } catch (error) {
        console.error("Mark notification read failed:", error);
      }
    }

    router.push(href);
  }

  async function handleClearAll() {
    if (!currentUser) {
      return;
    }

    try {
      setIsClearing(true);
      setErrorMessage("");
      await clearNotifications(currentUser);
      setNotifications([]);
      setIsClearModalOpen(false);
      await refreshBadgeCountsNow(currentUser, "notifications cleared");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to clear notifications.",
      );
    } finally {
      setIsClearing(false);
    }
  }

  async function handleClearNotification(notification: NotificationItem) {
    if (!currentUser) {
      return;
    }

    const originalIndex = notifications.findIndex(
      (item) => item.notificationId === notification.notificationId,
    );
    setNotifications((currentNotifications) =>
      currentNotifications.filter(
        (item) => item.notificationId !== notification.notificationId,
      ),
    );

    try {
      await clearNotification(currentUser, notification.notificationId);
      await refreshBadgeCountsNow(currentUser, "notification cleared");
    } catch (error) {
      setNotifications((currentNotifications) => {
        const restoredNotifications = [...currentNotifications];
        restoredNotifications.splice(
          Math.max(0, originalIndex),
          0,
          notification,
        );
        return restoredNotifications;
      });
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to clear this notification.",
      );
    }
  }

  return (
    <main className={shellClass}>
      <div
        className={frameClass.replace(
          "min-h-screen",
          "h-screen min-h-0 md:h-[780px]",
        )}
      >
        <div className="azisto-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-24 pt-5">
          {isCustomer ? (
            <AppHeader
              leftControl={
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-black"
                  aria-label="Go back"
                >
                  <ChevronLeft aria-hidden="true" className="h-5 w-5" />
                </button>
              }
            />
          ) : (
            <ContractorHeader
              leftControl={
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-black"
                  aria-label="Go back"
                >
                  <ChevronLeft aria-hidden="true" className="h-5 w-5" />
                </button>
              }
            />
          )}
          <section className="mt-8 flex items-end justify-between gap-4">
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.14em] ${accentTextClass}`}>
                Notifications
              </p>
              <h1 className={`mt-1 text-3xl font-normal leading-tight ${primaryTextClass}`}>
                Updates
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={isRefreshing}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-azisto-border bg-white text-[#64748B] shadow-sm disabled:opacity-50"
                aria-label="Refresh notifications"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </button>
            {notifications.length > 0 ? (
              <button
                type="button"
                onClick={() => setIsClearModalOpen(true)}
                className={`flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-xs font-bold shadow-sm ${
                  isCustomer
                    ? "border-[#1E3A8A] text-[#1E3A8A]"
                    : "border-[var(--azisto-contractor-burgundy)] text-[var(--azisto-contractor-burgundy)]"
                }`}
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                Clear all
              </button>
            ) : null}
            </div>
          </section>
          {isLoading ? (
            <AppShimmer className="mt-6" rows={3} />
          ) : null}
          {errorMessage ? (
            <p className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
          <section className={`${cardClass} mt-6 p-4`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-sm font-bold ${primaryTextClass}`}>
                  Push notifications
                </p>
                <p className={`mt-1 text-xs font-semibold ${mutedTextClass}`}>
                  {pushStatusLabel[pushStatus]}
                </p>
              </div>
              {pushStatus === "enabled" ? (
                <button
                  type="button"
                  onClick={() => void handleDisablePush()}
                  disabled={isUpdatingPush}
                  className="rounded-full border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-60"
                >
                  {isUpdatingPush ? "Updating..." : "Disable push notifications"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleEnablePush()}
                  disabled={
                    isUpdatingPush ||
                    pushStatus === "blocked" ||
                    pushStatus === "not_supported"
                  }
                  className={`rounded-full px-3 py-2 text-xs font-bold text-white disabled:opacity-60 ${
                    isCustomer
                      ? "bg-[#1E3A8A]"
                      : "bg-[var(--azisto-contractor-burgundy)]"
                  }`}
                >
                  {isUpdatingPush ? "Updating..." : "Enable push notifications"}
                </button>
              )}
            </div>
            <p className={`mt-3 text-xs leading-5 ${mutedTextClass}`}>
              Push notifications may require HTTPS outside localhost. Some
              browsers may not support web push.
            </p>
            {pushMessage ? (
              <p className={`mt-3 text-xs font-semibold ${accentTextClass}`}>
                {pushMessage}
              </p>
            ) : null}
          </section>
          {!isLoading && notifications.length === 0 ? (
            <section className={`${cardClass} mt-6 p-5 text-center`}>
              <Bell aria-hidden="true" className={`mx-auto h-8 w-8 ${accentTextClass}`} />
              <p className={`mt-3 text-sm font-bold ${primaryTextClass}`}>No notifications yet</p>
            </section>
          ) : null}
          <section className="mt-6 space-y-3">
            {notifications.map((notification) => (
              <SwipeNotificationCard
                key={notification.notificationId}
                notification={notification}
                compactCardClass={compactCardClass}
                primaryTextClass={primaryTextClass}
                mutedTextClass={mutedTextClass}
                accentTextClass={accentTextClass}
                notificationChipClass={notificationChipClass}
                onOpen={() => void handleNotificationClick(notification)}
                onClear={() => void handleClearNotification(notification)}
              />
            ))}
          </section>
        </div>
        <BottomNav role={role} />
      </div>
      {isClearModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-5">
          <section className="w-full max-w-sm rounded-2xl border border-azisto-border bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#111827]">
                  Clear all notifications?
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#64748B]">
                  These updates will be removed from your notification list.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64748B]"
                aria-label="Close"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="h-12 rounded-full border border-azisto-border bg-white text-sm font-bold text-[#111827]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={() => void handleClearAll()}
                className="h-12 rounded-full bg-[linear-gradient(135deg,#5C0032,#8A0F45)] text-sm font-bold text-white shadow-[0_6px_18px_rgba(122,0,60,0.25)] disabled:opacity-60"
              >
                {isClearing ? "Clearing..." : "Clear"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
