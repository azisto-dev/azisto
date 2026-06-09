"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ChevronLeft, MessageCircle, RefreshCw } from "lucide-react";
import { auth } from "@/lib/firebase";
import { fetchSessionProfile } from "@/lib/sessionProfile";
import {
  isQuotaExceededError,
  isQuotaExceededMessage,
} from "@/lib/apiErrors";
import {
  authenticatedFetch,
  throwApiResponseError,
} from "@/lib/authenticatedFetch";
import { getStatusChipClass } from "@/lib/theme";
import BottomNav from "@/app/components/BottomNav";
import NotificationBell from "@/app/components/NotificationBell";

type MessageThread = {
  threadId: string;
  jobId: string;
  jobTitle: string;
  displayName: string;
  customerId: string;
  contractorId: string;
  contractorName: string;
  businessName: string;
  selectedTaskLabels: string[];
  lastMessage: string;
  lastMessageAt: string;
  status: string;
  jobStatus: string;
  unreadCount: number;
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

function createApiError(_code: string, message: string) {
  return new Error(message);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load messages.";
}

function formatDateTime(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTaskSummary(tasks: string[]) {
  if (tasks.length === 0) {
    return "Task details";
  }

  if (tasks.length === 1) {
    return tasks[0];
  }

  return `${tasks[0]} +${tasks.length - 1} more`;
}

async function fetchThreads(
  user: User,
  source: "page-open" | "interval" | "manual",
) {
  console.log(
    `[${new Date().toISOString()}] MESSAGE INBOX FETCH source: ${source}`,
  );
  const response = await authenticatedFetch(user, "/api/messages/threads");
  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
    threads?: unknown;
  } | null;

  if (!response.ok) {
    await throwApiResponseError(
      response,
      typeof responseBody?.message === "string"
        ? responseBody.message
        : response.statusText,
    );
  }

  return Array.isArray(responseBody?.threads)
    ? (responseBody.threads as MessageThread[])
    : [];
}

export default function MessagesPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [role, setRole] = useState<"customer" | "contractor" | "unknown">(
    "unknown",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const threadsRequestInFlightRef = useRef(false);
  const threadsRetryAfterRef = useRef(0);
  const isCustomer = role !== "contractor";
  const shellClass = isCustomer
    ? "az-customer-shell min-h-screen md:px-6 md:py-8"
    : "az-contractor-shell min-h-screen md:px-6 md:py-8";
  const frameClass = isCustomer
    ? "mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border"
    : "mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-[var(--azisto-contractor-bg)] shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-[var(--azisto-contractor-border)]";
  const heroClass = isCustomer
    ? "az-customer-card mt-8 bg-gradient-to-br from-white via-blue-50 to-white p-5"
    : "az-contractor-soft-hero mt-6 p-4";
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
  const softChipClass = isCustomer
    ? "border-blue-100 bg-blue-50 text-azisto-accent"
    : "border-[var(--azisto-contractor-border)] bg-white/80 text-[var(--azisto-contractor-burgundy)]";
  const mutedChipClass = isCustomer
    ? "bg-slate-100 text-slate-500"
    : "bg-[rgb(248_247_252_/_0.9)] text-[var(--azisto-contractor-muted)]";
  const unreadChipClass = isCustomer
    ? "bg-blue-50 text-azisto-accent"
    : "bg-[rgb(138_15_77_/_0.07)] text-[var(--azisto-contractor-burgundy)]";

  async function loadThreads(
    user: User,
    source: "page-open" | "interval" | "manual",
  ) {
    if (
      threadsRequestInFlightRef.current ||
      threadsRetryAfterRef.current > Date.now()
    ) {
      return;
    }

    threadsRequestInFlightRef.current = true;

    try {
      setThreads(await fetchThreads(user, source));
      threadsRetryAfterRef.current = 0;
      setErrorMessage("");
    } catch (error) {
      if (
        isQuotaExceededError(error) ||
        isQuotaExceededMessage(
          error instanceof Error ? error.message : String(error),
        )
      ) {
        threadsRetryAfterRef.current = Date.now() + 10 * 60_000;
      }

      if (source !== "interval") {
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      threadsRequestInFlightRef.current = false;
    }
  }

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
        await loadThreads(user, "page-open");
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        void loadThreads(currentUser, "interval");
      }
    }, 120_000);

    return () => window.clearInterval(intervalId);
  }, [currentUser]);

  async function handleRefresh() {
    if (!currentUser || isRefreshing) {
      return;
    }

    try {
      setIsRefreshing(true);
      await loadThreads(currentUser, "manual");
    } finally {
      setIsRefreshing(false);
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
            <Link
              href="/home"
              className="flex h-10 w-10 items-center justify-center rounded-full text-black"
              aria-label="Back to home"
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            </Link>

            <Link href="/home" className="flex justify-center">
              <img
                src="/azisto-logo-cropped.png"
                alt="AZISTO - Your on-demand assistant"
                className="w-full max-w-[165px] object-contain"
              />
            </Link>

            <NotificationBell />
          </header>

          <section className={heroClass}>
            <div className="relative z-10">
              <p className={`text-sm font-normal leading-5 ${mutedTextClass}`}>
                AZISTO inbox
              </p>
              <h1
                className={`mt-1 text-3xl font-normal uppercase leading-none tracking-[0.04em] ${primaryTextClass}`}
              >
                Messages
              </h1>
              <p className={`mt-5 text-sm font-semibold leading-5 ${mutedTextClass}`}>
                Conversations about your AZISTO job requests will appear here.
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${softChipClass}`}
                >
                  {threads.length} thread{threads.length === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={() => void handleRefresh()}
                  disabled={isRefreshing}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm disabled:opacity-50 ${softChipClass}`}
                  aria-label="Refresh messages"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
            </div>
          </section>

          {isLoading ? (
            <p
              className={`${compactCardClass} mt-6 px-4 py-3 text-sm leading-6 ${mutedTextClass}`}
            >
              Loading messages...
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-6 whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {!isLoading && !errorMessage && threads.length === 0 ? (
            <section className={`${cardClass} mt-6 p-5 text-center`}>
              <div
                className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
                  isCustomer
                    ? "bg-blue-50 text-azisto-accent"
                    : "bg-[rgb(138_15_77_/_0.07)] text-[var(--azisto-contractor-burgundy)]"
                }`}
              >
                <MessageCircle aria-hidden="true" className="h-6 w-6" />
              </div>
              <p className={`mt-4 text-sm font-bold ${primaryTextClass}`}>
                No messages yet
              </p>
              <p className={`mt-2 text-sm leading-6 ${mutedTextClass}`}>
                Start a conversation from an interested contractor or job page.
              </p>
            </section>
          ) : null}

          <section className="mt-6 space-y-3">
            {threads.map((thread) => (
              <Link
                key={thread.threadId}
                href={`/messages/${encodeURIComponent(thread.threadId)}`}
                className={`${compactCardClass} block p-4`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-[0.12em] ${accentTextClass}`}>
                      {thread.jobId}
                    </p>
                    <h2 className={`mt-1 text-base font-semibold ${primaryTextClass}`}>
                      {thread.displayName ||
                        thread.businessName ||
                        thread.contractorName ||
                        thread.contractorId ||
                        "Conversation"}
                    </h2>
                    <p className={`mt-1 text-xs font-bold ${primaryTextClass}`}>
                      {thread.jobTitle || "Service request"}
                    </p>
                  </div>
                  <span
                    className={getStatusChipClass(
                      thread.jobStatus || thread.status || "open",
                    )}
                  >
                    {(thread.jobStatus || thread.status || "open").replaceAll(
                      "_",
                      " ",
                    )}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${softChipClass}`}
                  >
                    {formatTaskSummary(thread.selectedTaskLabels ?? [])}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${mutedChipClass}`}
                  >
                    {thread.jobId}
                  </span>
                </div>

                <p className={`mt-3 line-clamp-2 text-sm leading-6 ${mutedTextClass}`}>
                  {thread.lastMessage || "No messages yet."}
                </p>

                <div className="mt-2 flex items-center justify-between gap-3">
                  {thread.lastMessageAt ? (
                    <p className={`text-xs font-semibold ${mutedTextClass}`}>
                      {formatDateTime(thread.lastMessageAt)}
                    </p>
                  ) : (
                    <span />
                  )}

                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${unreadChipClass}`}>
                    {thread.unreadCount || 0} unread
                  </span>
                </div>
              </Link>
            ))}
          </section>
        </div>
        <BottomNav role={role} />
      </div>
    </main>
  );
}
