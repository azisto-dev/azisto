"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentType } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "firebase/auth";
import {
  BookOpen,
  CreditCard,
  LogOut,
  Mail,
  Menu,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { auth } from "@/lib/firebase";

type UserRole = "customer" | "contractor" | "unknown";
type Language = "EN" | "FR";

type MenuLink = {
  href: string;
  label: string;
  subtext: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

function LanguageFlag({ language }: { language: Language }) {
  if (language === "FR") {
    return (
      <span
        aria-hidden={true}
        className="flex h-4 w-6 overflow-hidden rounded-[3px] border border-slate-200 shadow-sm"
      >
        <span className="h-full flex-1 bg-[#1F4E9D]" />
        <span className="h-full flex-1 bg-white" />
        <span className="h-full flex-1 bg-[#EF4444]" />
      </span>
    );
  }

  return (
    <span
      aria-hidden={true}
      className="relative h-4 w-6 overflow-hidden rounded-[3px] border border-slate-200 bg-white shadow-sm"
    >
      <span className="absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 bg-[#EF4444]" />
      <span className="absolute left-0 top-1/2 h-[3px] w-full -translate-y-1/2 bg-[#EF4444]" />
    </span>
  );
}

export default function AppMenu({ role }: { role: UserRole }) {
  const router = useRouter();
  const panelRef = useRef<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState<Language>("EN");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("preferredLanguage");

    if (storedLanguage === "EN" || storedLanguage === "FR") {
      setLanguage(storedLanguage);
    }

    window.localStorage.removeItem("theme");
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        panelRef.current &&
        event.target instanceof Node &&
        !panelRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function updateLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("preferredLanguage", nextLanguage);
  }

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    try {
      setIsLoggingOut(true);
      await signOut(auth);
      setIsOpen(false);
      router.push("/login");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const accountLinks: MenuLink[] =
    role === "contractor"
      ? [
          {
            href: "/profile",
            label: "Profile",
            subtext: "Contractor account",
            icon: UserRound,
          },
          {
            href: "/contractor/subscription",
            label: "Subscription settings",
            subtext: "Plan and billing",
            icon: CreditCard,
          },
        ]
      : [
          {
            href: role === "unknown" ? "/login" : "/profile",
            label: role === "unknown" ? "Account" : "Account",
            subtext: role === "unknown" ? "Sign in" : "Profile",
            icon: UserRound,
          },
        ];

  const supportLinks: MenuLink[] = [
    {
      href: "/contact",
      label: "Contact AZISTO",
      subtext: "",
      icon: Mail,
    },
    {
      href: "/help-safety",
      label: "Help & Safety",
      subtext: "",
      icon: ShieldCheck,
    },
    {
      href: "/legal",
      label: "Terms & Privacy",
      subtext: "",
      icon: BookOpen,
    },
  ];

  return (
    <div className="relative z-30">
      <button
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="az-menu-trigger flex h-10 w-10 items-center justify-center rounded-full text-black"
        aria-label={isOpen ? "Close app menu" : "Open app menu"}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X aria-hidden="true" className="h-5 w-5" />
        ) : (
          <Menu aria-hidden="true" className="h-5 w-5" />
        )}
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
        <div className="fixed inset-0 z-[100] overflow-hidden bg-black/5 md:left-1/2 md:right-auto md:top-8 md:h-[min(780px,calc(100vh-4rem))] md:w-full md:max-w-[390px] md:-translate-x-1/2 md:rounded-[28px]">
          <aside
            ref={panelRef}
            className="az-app-menu-panel az-contractor-shell flex h-fit w-[50%] min-w-[190px] max-w-[220px] flex-col rounded-r-3xl border border-l-0 border-[var(--azisto-contractor-border)] bg-[var(--azisto-contractor-bg)] p-3 text-[var(--azisto-contractor-text)] shadow-[0_16px_40px_rgba(92,0,50,0.18)]"
          >
            <div className="rounded-2xl border border-[var(--azisto-contractor-border)] bg-white/80 p-3 shadow-lg shadow-black/5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-[var(--azisto-contractor-text)]">Menu</h2>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--azisto-contractor-border)] bg-[var(--azisto-contractor-bg)] text-[var(--azisto-contractor-text)]"
                  aria-label="Close app menu"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["EN", "FR"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateLanguage(option)}
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition ${
                      language === option
                        ? "border-[var(--azisto-contractor-burgundy)] bg-white text-[#111111] shadow-sm shadow-[rgb(138_15_77_/_0.12)]"
                        : "border-[var(--azisto-contractor-border)] bg-white/80 text-[var(--azisto-contractor-text)]"
                    }`}
                  >
                    <LanguageFlag language={option} />
                    {option}
                  </button>
                ))}
              </div>

              {language === "FR" ? (
                <p className="mt-3 rounded-xl border border-[var(--azisto-contractor-border)] bg-[var(--azisto-contractor-soft)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--azisto-contractor-text)]">
                  French language support coming soon.
                </p>
              ) : null}

            </div>

            <nav className="mt-4 space-y-4 pb-1">
              <section>
                <p className="px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--azisto-contractor-muted)]">
                  Account
                </p>
                <div className="mt-2 space-y-2">
                  {accountLinks.map((item) => {
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 rounded-2xl border border-[var(--azisto-contractor-border)] bg-white/90 px-2.5 py-2.5 text-[var(--azisto-contractor-text)] shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:bg-white"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--azisto-contractor-soft)] text-[var(--azisto-contractor-burgundy)]">
                          <Icon aria-hidden={true} className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-bold">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-[var(--azisto-contractor-muted)]">
                            {item.subtext}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>

              <section>
                <p className="px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--azisto-contractor-muted)]">
                  Support
                </p>
                <div className="mt-2 space-y-2">
                  {supportLinks.map((item) => {
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 rounded-2xl border border-[var(--azisto-contractor-border)] bg-white/90 px-2.5 py-2.5 text-[var(--azisto-contractor-text)] shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:bg-white"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--azisto-contractor-soft)] text-[var(--azisto-contractor-text)]">
                          <Icon aria-hidden={true} className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-bold">
                            {item.label}
                          </span>
                          {item.subtext ? (
                            <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-[var(--azisto-contractor-muted)]">
                              {item.subtext}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            </nav>

            {role !== "unknown" ? (
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="az-btn-contractor mt-3 flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-2xl text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            ) : null}
          </aside>
        </div>,
        document.body,
      )
        : null}
    </div>
  );
}
