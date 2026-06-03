"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { auth } from "@/lib/firebase";
import { fetchSessionProfile } from "@/lib/sessionProfile";
import { getStatusChipClass } from "@/lib/theme";
import BottomNav from "@/app/components/BottomNav";

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

async function fetchThreads(user: User) {
  const token = await user.getIdToken();
  const response = await fetch("/api/messages/threads", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
    threads?: unknown;
  } | null;

  if (!response.ok) {
    throw createApiError(
      typeof responseBody?.code === "string"
        ? responseBody.code
        : `api/${response.status}`,
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
        const messageThreads = await fetchThreads(user);
        setThreads(messageThreads);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

  return (
    <main className="az-contractor-shell min-h-screen md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-[var(--azisto-contractor-bg)] shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-[var(--azisto-contractor-border)]">
        <div className="flex-1 px-5 pb-6 pt-5">
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

            <span aria-hidden="true" />
          </header>

          <section className="az-contractor-soft-hero mt-8 p-5">
            <div className="relative z-10">
              <p className="text-lg font-normal leading-6 text-[var(--azisto-contractor-muted)]">
                AZISTO inbox
              </p>
              <h1 className="mt-2 text-4xl font-normal uppercase leading-none tracking-[0.04em] text-[var(--azisto-contractor-text)]">
                Messages
              </h1>
              <p className="mt-12 text-sm font-semibold leading-6 text-[var(--azisto-contractor-muted)]">
                Conversations about your AZISTO job requests will appear here.
              </p>
              <span className="mt-4 inline-flex rounded-full border border-[var(--azisto-contractor-border)] bg-white/80 px-3 py-1 text-xs font-bold text-[var(--azisto-contractor-burgundy)]">
                {threads.length} thread{threads.length === 1 ? "" : "s"}
              </span>
            </div>
          </section>

          {isLoading ? (
            <p className="az-contractor-card-compact mt-6 px-4 py-3 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
              Loading messages...
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-6 whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {!isLoading && !errorMessage && threads.length === 0 ? (
            <section className="az-contractor-card mt-6 p-5 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(138_15_77_/_0.07)] text-[var(--azisto-contractor-burgundy)]">
                <MessageCircle aria-hidden="true" className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-bold text-[var(--azisto-contractor-text)]">
                No messages yet
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
                Start a conversation from an interested contractor or job page.
              </p>
            </section>
          ) : null}

          <section className="mt-6 space-y-3">
            {threads.map((thread) => (
              <Link
                key={thread.threadId}
                href={`/messages/${encodeURIComponent(thread.threadId)}`}
                className="az-contractor-card-compact block p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--azisto-contractor-burgundy)]">
                      {thread.jobId}
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-[var(--azisto-contractor-text)]">
                      {thread.displayName ||
                        thread.businessName ||
                        thread.contractorName ||
                        thread.contractorId ||
                        "Conversation"}
                    </h2>
                    <p className="mt-1 text-xs font-bold text-[var(--azisto-contractor-text)]">
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
                  <span className="rounded-full border border-[var(--azisto-contractor-border)] bg-white/80 px-2.5 py-1 text-[11px] font-bold text-[var(--azisto-contractor-burgundy)]">
                    {formatTaskSummary(thread.selectedTaskLabels ?? [])}
                  </span>
                  <span className="rounded-full bg-[rgb(248_247_252_/_0.9)] px-2.5 py-1 text-[11px] font-semibold text-[var(--azisto-contractor-muted)]">
                    {thread.jobId}
                  </span>
                </div>

                <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
                  {thread.lastMessage || "No messages yet."}
                </p>

                <div className="mt-2 flex items-center justify-between gap-3">
                  {thread.lastMessageAt ? (
                    <p className="text-xs font-semibold text-[var(--azisto-contractor-muted)]/70">
                      {formatDateTime(thread.lastMessageAt)}
                    </p>
                  ) : (
                    <span />
                  )}

                  <span className="rounded-full bg-[rgb(138_15_77_/_0.07)] px-2.5 py-1 text-[11px] font-bold text-[var(--azisto-contractor-burgundy)]">
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
