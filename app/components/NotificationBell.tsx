"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

export default function NotificationBell({
  className = "",
}: {
  className?: string;
}) {
  return (
    <Link
      href="/notifications"
      aria-label="Notifications"
      className={`flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 ${className}`}
    >
      <Bell aria-hidden="true" className="h-5 w-5" />
    </Link>
  );
}
