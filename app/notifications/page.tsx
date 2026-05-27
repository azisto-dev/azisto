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
  title: string;
  message: string;
  jobId: string;
  read: boolean;
  createdAt: string;
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

async function markNotificationsRead(user: User) {
  const token = await user.getIdToken();

  await fetch("/api/notifications", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [role, setRole] = useState<"customer" | "contractor" | "unknown">(
    "unknown",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        const profile = await fetchSessionProfile(user);
        setRole(profile.role);
        const userNotifications = await fetchNotifications(user);
        setNotifications(userNotifications);
        try {
          await markNotificationsRead(user);
          setNotifications(
            userNotifications.map((notification) => ({
              ...notification,
              read: true,
            })),
          );
        } catch (error) {
          console.error("Mark notifications read failed:", error);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load notifications.");
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

  return (
    <main className="min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
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
            <p className="text-xs font-bold uppercase tracking-[0.14em] az-kicker">
              Notifications
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
              Updates
            </h1>
          </section>
          {isLoading ? (
            <p className="mt-6 rounded-xl border border-azisto-border bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Loading notifications...
            </p>
          ) : null}
          {errorMessage ? (
            <p className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
          {!isLoading && notifications.length === 0 ? (
            <section className="mt-6 rounded-xl border border-azisto-border bg-white p-5 text-center shadow-sm">
              <Bell aria-hidden="true" className="mx-auto h-8 w-8 text-azisto-text" />
              <p className="mt-3 text-sm font-bold">No notifications yet</p>
            </section>
          ) : null}
          <section className="mt-6 space-y-3">
            {notifications.map((notification) => (
              <article
                key={notification.notificationId}
                className="rounded-xl border border-azisto-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-bold text-black">
                    {notification.title}
                  </h2>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                    {notification.read ? "Read" : "Unread"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {notification.message}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-400">
                  <span className="az-job-id">{notification.jobId}</span> ·{" "}
                  {formatDate(notification.createdAt)}
                </p>
              </article>
            ))}
          </section>
        </div>
        <BottomNav role={role} />
      </div>
    </main>
  );
}
