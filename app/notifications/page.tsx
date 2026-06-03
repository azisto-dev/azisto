"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ChevronLeft, Bell } from "lucide-react";
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

function getNotificationHref(notification: NotificationItem) {
  if (notification.type === "new_message") {
    return notification.threadId
      ? `/messages/${encodeURIComponent(notification.threadId)}`
      : "/messages";
  }

  return notification.jobId ? `/customer/jobs` : "/notifications";
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [role, setRole] = useState<"customer" | "contractor" | "unknown">(
    "unknown",
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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
    let href = getNotificationHref(notification);

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

  return (
    <main className="az-contractor-shell min-h-screen md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-[var(--azisto-contractor-bg)] shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-[var(--azisto-contractor-border)]">
        <div className="flex-1 px-5 pb-6 pt-5">
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
          <section className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--azisto-contractor-burgundy)]">
              Notifications
            </p>
            <h1 className="mt-1 text-3xl font-normal leading-tight text-[var(--azisto-contractor-text)]">
              Updates
            </h1>
          </section>
          {isLoading ? (
            <p className="az-contractor-card-compact mt-6 px-4 py-3 text-sm text-[var(--azisto-contractor-muted)]">
              Loading notifications...
            </p>
          ) : null}
          {errorMessage ? (
            <p className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
          {!isLoading && notifications.length === 0 ? (
            <section className="az-contractor-card mt-6 p-5 text-center">
              <Bell aria-hidden="true" className="mx-auto h-8 w-8 text-[var(--azisto-contractor-burgundy)]" />
              <p className="mt-3 text-sm font-bold text-[var(--azisto-contractor-text)]">No notifications yet</p>
            </section>
          ) : null}
          <section className="mt-6 space-y-3">
            {notifications.map((notification) => (
              <button
                key={notification.notificationId}
                type="button"
                onClick={() => void handleNotificationClick(notification)}
                className="az-contractor-card-compact block w-full p-4 text-left transition hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-bold text-[var(--azisto-contractor-text)]">
                    {notification.title}
                  </h2>
                  <span className="rounded-full border border-[rgb(138_15_77_/_0.14)] bg-[rgb(138_15_77_/_0.08)] px-3 py-1 text-xs font-bold text-[var(--azisto-contractor-burgundy)]">
                    {notification.read ? "Read" : "Unread"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
                  {notification.message}
                </p>
                <p className="mt-2 text-xs font-semibold text-[var(--azisto-contractor-muted)]">
                  <span className="text-[var(--azisto-contractor-burgundy)]">{notification.jobId}</span> ·{" "}
                  {formatDate(notification.createdAt)}
                </p>
              </button>
            ))}
          </section>
        </div>
        <BottomNav role={role} />
      </div>
    </main>
  );
}
