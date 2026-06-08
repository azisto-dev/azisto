"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { subscribeBadgeCounts } from "@/lib/badgeCounts";

export default function NotificationBell({
  className = "",
}: {
  className?: string;
}) {
  const [notificationBadgeCount, setNotificationBadgeCount] = useState(0);
  const [href, setHref] = useState("/notifications");

  useEffect(() => {
    let unsubscribeBadges: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeBadges?.();
      unsubscribeBadges = null;

      if (!user) {
        setHref("/login");
        setNotificationBadgeCount(0);
        return;
      }

      setHref("/notifications");
      unsubscribeBadges = subscribeBadgeCounts(
        user,
        (counts) => setNotificationBadgeCount(counts.notifications),
        "NotificationBell",
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeBadges?.();
    };
  }, []);

  return (
    <Link
      href={href}
      aria-label={
        notificationBadgeCount > 0
          ? `Notifications, ${notificationBadgeCount} unread`
          : "Notifications"
      }
      className={`relative flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 ${className}`}
    >
      <Bell aria-hidden="true" className="h-5 w-5" />
      {notificationBadgeCount > 0 ? (
        <span className="absolute right-0 top-0 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-azisto-danger px-1 text-[10px] font-black leading-none text-white shadow-md shadow-red-200 ring-2 ring-white">
          {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
        </span>
      ) : null}
    </Link>
  );
}
