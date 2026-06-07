"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ChevronLeft, Bell, Trash2, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { fetchSessionProfile } from "@/lib/sessionProfile";
import BottomNav from "@/app/components/BottomNav";

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

function StatusBar() {
  return (
    <div className="mb-5 flex items-center justify-between text-xs font-bold">
      <span>9:41</span>
      <div className="flex items-center gap-1">
        <span className="h-2.5 w-3 rounded-sm bg-black" />
        <span className="h-2.5 w-3 rounded-sm border border-black" />
        <span className="h-2.5 w-5 rounded-sm bg-black" />
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return value
    ? new Intl.DateTimeFormat("en-CA", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Recently";
}

async function fetchNotifications(user: User) {
  const token = await user.getIdToken();
  const response = await fetch("/api/notifications", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json().catch(() => null)) as {
    notifications?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(
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
  const token = await user.getIdToken();

  await fetch("/api/notifications", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(notificationId ? { notificationId } : {}),
  });
}

async function clearNotifications(user: User) {
  const token = await user.getIdToken();
  const response = await fetch("/api/notifications", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
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
    ? `/contractor/jobs/${encodeURIComponent(notification.jobId)}`
    : "/customer/jobs";
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [role, setRole] = useState<"customer" | "contractor" | "unknown">(
    "unknown",
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
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
    ? "text-[#0F172A]"
    : "text-[var(--azisto-contractor-text)]";
  const mutedTextClass = isCustomer
    ? "text-[#64748B]"
    : "text-[var(--azisto-contractor-muted)]";
  const accentTextClass = isCustomer
    ? "text-azisto-accent"
    : "text-[var(--azisto-contractor-burgundy)]";
  const notificationChipClass = isCustomer
    ? "border-blue-100 bg-blue-50 text-azisto-accent"
    : "border-[rgb(138_15_77_/_0.14)] bg-[rgb(138_15_77_/_0.08)] text-[var(--azisto-contractor-burgundy)]";

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
        const userNotifications = await fetchNotifications(user);
        setNotifications(
          userNotifications.filter((notification) => !notification.read),
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load notifications.");
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

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
      window.dispatchEvent(new Event("azisto:badges-refresh"));
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

  return (
    <main className={shellClass}>
      <div
        className={frameClass.replace(
          "min-h-screen",
          "h-screen min-h-0 md:h-[780px]",
        )}
      >
        <div className="azisto-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-24 pt-5">
          <StatusBar />
          <header className="mt-3 grid grid-cols-[40px_1fr_40px] items-center">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-10 w-10 items-center justify-center rounded-full text-black"
              aria-label="Go back"
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            </button>
            <Link href="/home" className="flex justify-center">
              <img
                src="/azisto-logo-cropped.png"
                alt="AZISTO - Your on-demand assistant"
                className="w-full max-w-[165px] object-contain"
              />
            </Link>
            <span aria-hidden="true" />
          </header>
          <section className="mt-8 flex items-end justify-between gap-4">
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.14em] ${accentTextClass}`}>
                Notifications
              </p>
              <h1 className={`mt-1 text-3xl font-normal leading-tight ${primaryTextClass}`}>
                Updates
              </h1>
            </div>
            {notifications.length > 0 ? (
              <button
                type="button"
                onClick={() => setIsClearModalOpen(true)}
                className="flex items-center gap-2 rounded-full border border-[var(--azisto-contractor-burgundy)] bg-white px-4 py-2 text-xs font-bold text-[var(--azisto-contractor-burgundy)] shadow-sm"
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                Clear all
              </button>
            ) : null}
          </section>
          {isLoading ? (
            <p className={`${compactCardClass} mt-6 px-4 py-3 text-sm ${mutedTextClass}`}>
              Loading notifications...
            </p>
          ) : null}
          {errorMessage ? (
            <p className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
          {!isLoading && notifications.length === 0 ? (
            <section className={`${cardClass} mt-6 p-5 text-center`}>
              <Bell aria-hidden="true" className={`mx-auto h-8 w-8 ${accentTextClass}`} />
              <p className={`mt-3 text-sm font-bold ${primaryTextClass}`}>No notifications yet</p>
            </section>
          ) : null}
          <section className="mt-6 space-y-3">
            {notifications.map((notification) => (
              <button
                key={notification.notificationId}
                type="button"
                onClick={() => void handleNotificationClick(notification)}
                className={`${compactCardClass} block w-full p-4 text-left transition hover:-translate-y-0.5`}
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
                <p className={`mt-2 text-xs font-semibold ${mutedTextClass}`}>
                  <span className={accentTextClass}>{notification.jobId}</span> ·{" "}
                  {formatDate(notification.createdAt)}
                </p>
              </button>
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
