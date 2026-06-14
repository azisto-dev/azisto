"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import NotificationBell from "@/app/components/NotificationBell";

export default function AppHeader({
  leftControl,
  rightControl,
  logoClassName = "w-full max-w-[150px] object-contain",
}: {
  leftControl?: ReactNode;
  rightControl?: ReactNode;
  logoClassName?: string;
}) {
  return (
    <header className="mt-1">
      <Link href="/home" className="flex justify-center">
        <img
          src="/azisto-logo-cropped.png"
          alt="AZISTO - Your on-demand assistant"
          className={logoClassName}
        />
      </Link>
      <div className="mt-2 grid grid-cols-[40px_1fr_40px] items-center">
        <div className="flex h-10 w-10 items-center justify-center justify-self-start">
          {leftControl}
        </div>
        <span aria-hidden="true" />
        <div className="flex h-10 w-10 items-center justify-center justify-self-end">
          {rightControl ?? <NotificationBell />}
        </div>
      </div>
    </header>
  );
}
