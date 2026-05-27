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
  displayName: string;
  customerId: string;
  contractorId: string;
  contractorName: string;
  businessName: string;
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

function createApiError(code: string, message: string) {
  return new Error(`${message}\n\nCode: ${code}`);
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
    <main className="min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
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

          <section className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] az-kicker">
              Inbox
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
              Messages
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Conversations about your AZISTO job requests will appear here.
            </p>
          </section>

          {isLoading ? (
            <p className="mt-6 rounded-xl border border-azisto-border bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              Loading messages...
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-6 whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {!isLoading && !errorMessage && threads.length === 0 ? (
            <section className="mt-6 rounded-xl border border-azisto-border bg-white p-5 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-azisto-text">
                <MessageCircle aria-hidden="true" className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-bold text-black">
                No messages yet
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Start a conversation from an interested contractor or job page.
              </p>
            </section>
          ) : null}

          <section className="mt-6 space-y-3">
            {threads.map((thread) => (
              <Link
                key={thread.threadId}
                href={`/messages/${encodeURIComponent(thread.threadId)}`}
                className="block rounded-xl border border-azisto-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] az-job-id">
                      {thread.jobId}
                    </p>
                    <h2 className="mt-1 text-base font-bold text-black">
                      {thread.displayName ||
                        thread.businessName ||
                        thread.contractorName ||
                        thread.contractorId ||
                        "Conversation"}
                    </h2>
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

                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                  {thread.lastMessage || "No messages yet."}
                </p>

                <div className="mt-2 flex items-center justify-between gap-3">
                  {thread.lastMessageAt ? (
                    <p className="text-xs font-semibold text-slate-400">
                      {formatDateTime(thread.lastMessageAt)}
                    </p>
                  ) : (
                    <span />
                  )}

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
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
