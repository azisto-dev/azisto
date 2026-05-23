"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchBadgeCounts } from "@/lib/badgeCounts";
import { fetchSessionProfile } from "@/lib/sessionProfile";
import BottomNav from "@/app/components/BottomNav";

const services = [
  {
    name: "Home Care",
    slug: "home-care",
    image: "/service-icons/home-care.png",
    imageAlt: "Premium home care icon",
    imageClassName: "rounded-[18px]",
  },
  {
    name: "Car Care",
    slug: "car-care",
    image: "/service-icons/car-care.png",
    imageAlt: "Premium car care icon",
    imageClassName: "rounded-[18px]",
  },
  {
    name: "Pet Care",
    slug: "pet-care",
    image: "/service-icons/pet-care.png",
    imageAlt: "Premium pet care icon",
    imageClassName: "rounded-[18px]",
  },
  {
    name: "Garden Care",
    slug: "garden-care",
    image: "/service-icons/garden-care-direct.png",
    imageAlt: "Premium garden care icon",
  },
  {
    name: "Moving",
    slug: "moving",
    image: "/service-icons/moving-direct.png",
    imageAlt: "Premium moving icon",
  },
  {
    name: "Roadside & Emergency",
    slug: "roadside-emergency",
    image: "/service-icons/towing.png",
    imageAlt: "Tow truck carrying a car icon",
  },
];

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17H9m9-1V11a6 6 0 1 0-12 0v5l-2 2h16l-2-2ZM10 21h4"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 text-black"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z"
      />
    </svg>
  );
}

function getFirstName(name: string) {
  return name.trim().split(" ").filter(Boolean)[0] ?? "";
}

async function fetchHomeProfile(user: User) {
  const token = await user.getIdToken();
  const response = await fetch("/api/profile", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const responseBody = (await response.json().catch(() => null)) as {
    role?: unknown;
    profile?: unknown;
  } | null;

  if (!response.ok || typeof responseBody?.profile !== "object") {
    return {
      role: "unknown" as const,
      displayName: "",
    };
  }

  const profile = responseBody.profile as Record<string, unknown>;
  const role: "customer" | "contractor" | "unknown" =
    responseBody.role === "customer" || responseBody.role === "contractor"
      ? responseBody.role
      : "unknown";
  const displayName =
    typeof profile.fullName === "string"
      ? profile.fullName
      : typeof profile.contactName === "string" && profile.contactName
        ? profile.contactName
        : typeof profile.businessName === "string"
          ? profile.businessName
          : "";

  return {
    role,
    displayName,
  };
}

export default function HomePage() {
  const router = useRouter();
  const [role, setRole] = useState<"customer" | "contractor" | "unknown">(
    "unknown",
  );
  const [greetingName, setGreetingName] = useState("");
  const [notificationBadgeCount, setNotificationBadgeCount] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const notificationsHref = role === "unknown" ? "/login" : "/notifications";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Home auth state loaded");

      if (!user) {
        console.log("Home current uid: none");
        console.log("Home redirect reason: none, public home");
        setRole("unknown");
        setGreetingName("");
        setNotificationBadgeCount(0);
        return;
      }

      console.log("Home current uid:", user.uid);

      try {
        const profile = await fetchSessionProfile(user);
        console.log("Home role API result:", profile);
        setRole(profile.role);
        const homeProfile = await fetchHomeProfile(user);
        setGreetingName(getFirstName(homeProfile.displayName));
        if (homeProfile.role !== "unknown") {
          setRole(homeProfile.role);
        }
      } catch (error) {
        console.error("Home role lookup failed:", error);
        setRole("unknown");
        setGreetingName("");
        setNotificationBadgeCount(0);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let currentUser: User | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function loadNotificationBadge(user: User) {
      try {
        const counts = await fetchBadgeCounts(user);
        setNotificationBadgeCount(counts.notifications);
      } catch (error) {
        console.error("Home notification badge lookup failed:", error);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      currentUser = user;

      if (!user) {
        setNotificationBadgeCount(0);
        return;
      }

      void loadNotificationBadge(user);
    });

    intervalId = setInterval(() => {
      if (currentUser) {
        void loadNotificationBadge(currentUser);
      }
    }, 10000);

    return () => {
      unsubscribe();

      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    try {
      setIsLoggingOut(true);
      console.log("Home logout: user clicked logout");
      await signOut(auth);
      setRole("unknown");
      setGreetingName("");
      setNotificationBadgeCount(0);
      setIsMenuOpen(false);
      router.push("/login");
    } catch (error) {
      console.error("Home logout failed:", error);
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black md:bg-slate-50 md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-slate-200">
        <div className="flex-1 px-5 pb-6 pt-5">
          <div className="mb-5 flex items-center justify-between text-xs font-bold">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-3 rounded-sm bg-black" />
              <span className="h-2.5 w-3 rounded-sm border border-black" />
              <span className="h-2.5 w-5 rounded-sm bg-black" />
            </div>
          </div>

          <header className="relative mt-3 grid grid-cols-[40px_1fr_40px] items-center">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-black"
                aria-label="Open menu"
                aria-expanded={isMenuOpen}
              >
                <MenuIcon />
              </button>

              {isMenuOpen ? (
                <div className="absolute left-0 top-12 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70">
                  <Link
                    href={
                      role === "contractor"
                        ? "/contractor/my-jobs"
                        : role === "customer"
                          ? "/customer/jobs"
                          : "/login"
                    }
                    onClick={() => setIsMenuOpen(false)}
                    className="block rounded-xl px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50"
                  >
                    My jobs
                  </Link>
                  <Link
                    href={role === "unknown" ? "/login" : "/messages"}
                    onClick={() => setIsMenuOpen(false)}
                    className="block rounded-xl px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50"
                  >
                    Messages
                  </Link>
                  <Link
                    href={role === "unknown" ? "/login" : "/profile"}
                    onClick={() => setIsMenuOpen(false)}
                    className="block rounded-xl px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50"
                  >
                    Profile
                  </Link>
                  {role === "unknown" ? (
                    <Link
                      href="/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="block rounded-xl px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50"
                    >
                      Sign in
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="block w-full rounded-xl px-4 py-3 text-left text-sm font-bold text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      {isLoggingOut ? "Logging out..." : "Logout"}
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            <Link href="/home" className="flex justify-center">
              <img
                src="/azisto-logo-cropped.png"
                alt="AZISTO - Your on-demand assistant"
                className="w-full max-w-[165px] object-contain"
              />
            </Link>

            <Link
              href={notificationsHref}
              className="relative flex h-10 w-10 items-center justify-center justify-self-end rounded-full text-black"
              aria-label="Notifications"
            >
              <BellIcon />
              {notificationBadgeCount > 0 ? (
                <span className="absolute right-0 top-0 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black leading-none text-white shadow-md shadow-red-200 ring-2 ring-white">
                  {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
                </span>
              ) : null}
            </Link>
          </header>

          <section className="mt-6">
            <h1 className="text-3xl font-bold leading-tight text-black">
              {greetingName ? `Hello, ${greetingName}` : "Hello"}
            </h1>
          </section>

          <div className="mt-5 flex h-14 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-500 shadow-sm">
            <Link
              href={role === "unknown" ? "/login" : "/service/home-care"}
              className="flex min-w-0 flex-1 items-center justify-between gap-3"
            >
              <span className="truncate">What do you need help with?</span>
              <SearchIcon />
            </Link>

            <Link
              href="/ai-assistant"
              className="azisto-ai-glow flex h-9 shrink-0 items-center justify-center rounded-full border border-red-100 bg-white/80 px-3 text-xs font-bold text-red-500 shadow-lg shadow-red-100/70 backdrop-blur"
              aria-label="Open AZISTO AI assistant"
            >
              ✨ AI
            </Link>
          </div>

          <section className="mt-6 grid grid-cols-3 gap-3">
            {services.map((service) => (
              <Link
                key={service.name}
                href={`/service/${service.slug}`}
                className="flex min-h-[86px] flex-col items-center justify-start text-center"
              >
                <img
                  src={service.image}
                  alt={service.imageAlt}
                  className={`h-16 w-16 object-contain ${
                    service.imageClassName ?? ""
                  }`}
                />
                <span className="mt-2 text-xs font-bold leading-tight text-black">
                  {service.name}
                </span>
              </Link>
            ))}
          </section>

          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-black">
              Trusted professionals
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Verified. Rated. Reliable.
            </p>

            <div className="mt-5 flex items-center justify-between">
              <div className="flex -space-x-2">
                {["AJ", "MK", "SR"].map((initials) => (
                  <div
                    key={initials}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-[10px] font-bold text-white"
                  >
                    {initials}
                  </div>
                ))}
              </div>

              <p className="text-sm font-semibold text-black">
                <span className="text-yellow-400">★</span> 4.9{" "}
                <span className="font-normal text-slate-500">
                  (2.3k reviews)
                </span>
              </p>
            </div>
          </section>
        </div>

        <BottomNav role={role} />
      </div>
    </main>
  );
}
