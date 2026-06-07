"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  fetchSessionProfile,
  getDefaultRouteForSession,
} from "@/lib/sessionProfile";

const accountTypes = [
  {
    title: "User",
    description:
      "Find trusted help for home, car, pet, garden, moving, and roadside services.",
    buttonText: "Sign up as User",
    href: "/signup?role=user",
  },
  {
    title: "Contractor",
    description:
      "Offer your services, receive job requests, and manage your AZISTO subscription.",
    buttonText: "Sign up as Contractor",
    href: "/signup?role=contractor",
  },
];

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

export default function AccountTypePage() {
  const router = useRouter();
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Account type auth state loaded");
      setAuthLoaded(true);

      if (!user) {
        return;
      }

      console.log("Account type current uid:", user.uid);

      try {
        const profile = await fetchSessionProfile(user);
        console.log("Account type role API result:", profile);

        if (profile.role !== "unknown") {
          const nextRoute = getDefaultRouteForSession(profile);
          console.log("Account type redirect reason:", `role:${profile.role}`);
          router.replace(nextRoute);
        }
      } catch (error) {
        console.error("Account type role lookup failed:", error);
      }
    });

    return unsubscribe;
  }, [router]);

  return (
    <main className="min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <div className="flex-1 px-5 pb-6 pt-5">
          <StatusBar />

          <header className="mt-3 flex justify-center">
            <img
              src="/azisto-logo-cropped.png"
              alt="AZISTO - Your on-demand assistant"
              className="w-full max-w-[175px] object-contain"
            />
          </header>

          <section className="mt-10">
            <p className="text-xs font-bold uppercase tracking-[0.14em] az-kicker">
              Sign up
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
              Create your AZISTO account
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {authLoaded
                ? "Choose the account type that fits what you want to do."
                : "Checking account..."}
            </p>
          </section>

          <section className="mt-7 space-y-4">
            {accountTypes.map((accountType) => (
              <article
                key={accountType.title}
                className="rounded-xl border border-azisto-border bg-white p-5 shadow-sm"
              >
                <h2 className="text-xl font-bold text-black">
                  {accountType.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {accountType.description}
                </p>
                <Link
                  href={accountType.href}
                  className={`mt-5 flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold ${
                    accountType.title === "User"
                      ? "az-btn-primary"
                      : "az-btn-secondary"
                  }`}
                >
                  {accountType.buttonText}
                </Link>
              </article>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
