"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { subscribeBadgeCounts } from "@/lib/badgeCounts";
import { azistoUi } from "@/lib/theme";

type UserRole = "customer" | "contractor" | "unknown";

type NavItem = {
  label: string;
  href: string;
  path: string;
  matchPaths: string[];
};

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      className="mx-auto h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

function getNavItems(role: UserRole): NavItem[] {
  const secondTab =
    role === "contractor"
      ? {
          label: "Dashboard",
          href: "/contractor/dashboard",
          path: "M4 13h7V4H4v9ZM13 20h7V4h-7v16ZM4 20h7v-5H4v5Z",
          matchPaths: ["/contractor/dashboard"],
        }
      : {
          label: "Bookings",
          href: role === "customer" ? "/customer/jobs" : "/login",
          path: "M7 3v3M17 3v3M4 8h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
          matchPaths: ["/customer/jobs", "/customer/active-jobs"],
        };

  return [
    {
      label: "Home",
      href: "/home",
      path: "M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10.5Z",
      matchPaths: ["/home"],
    },
    secondTab,
    {
      label: "Messages",
      href: role === "unknown" ? "/login" : "/messages",
      path: "M4 5h16v11H8l-4 4V5ZM8 9h8M8 13h5",
      matchPaths: ["/messages"],
    },
    {
      label: "Profile",
      href: role === "unknown" ? "/login" : "/profile",
      path: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
      matchPaths: ["/profile"],
    },
  ];
}

export default function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const navItems = getNavItems(role);
  const [messageBadgeCount, setMessageBadgeCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let unsubscribeBadges: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribeBadges?.();
      unsubscribeBadges = null;

      if (!user || role === "unknown") {
        setMessageBadgeCount(0);
        return;
      }

      unsubscribeBadges = subscribeBadgeCounts(
        user,
        (counts) => {
          if (isMounted) {
            setMessageBadgeCount(counts.messages);
          }
        },
        "BottomNav",
      );
    });

    return () => {
      isMounted = false;
      unsubscribe();
      unsubscribeBadges?.();
    };
  }, [role]);

  const isContractor = role === "contractor";

  return (
    <nav
      className={`border-t px-3 py-2 ${
        isContractor
          ? "border-[var(--azisto-contractor-border)] bg-white/95"
          : "border-azisto-border bg-white"
      }`}
    >
      <div className="grid grid-cols-4">
        {navItems.map((item) => {
          const isActive = item.matchPaths.some((matchPath) =>
            pathname === matchPath || pathname.startsWith(`${matchPath}/`),
          );

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`relative rounded-lg px-2 py-2 text-center text-[11px] font-semibold ${
                isActive
                  ? isContractor
                    ? "text-[var(--azisto-contractor-burgundy)]"
                    : "text-azisto-accent"
                  : isContractor
                    ? "text-[var(--azisto-contractor-muted)]"
                    : "text-azisto-muted"
              }`}
            >
              {item.label === "Messages" && messageBadgeCount > 0 ? (
                <span className="absolute right-5 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-azisto-danger px-1 text-[10px] font-black leading-none text-white shadow-md shadow-red-200 ring-2 ring-white">
                  {messageBadgeCount > 9 ? "9+" : messageBadgeCount}
                </span>
              ) : null}
              <NavIcon path={item.path} />
              <span
                className={`mt-1 block ${
                  isActive && !isContractor ? azistoUi.kicker : ""
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
