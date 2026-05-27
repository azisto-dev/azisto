"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ChevronLeft, Send } from "lucide-react";
import { auth } from "@/lib/firebase";
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
  currentUserRole: "customer" | "contractor" | string;
  status: string;
  jobStatus: string;
};

type MessageItem = {
  messageId: string;
  senderRole: "customer" | "contractor" | string;
  text: string;
  createdAt: string;
  readBy: string[];
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

  return "Unable to load this conversation.";
}

function formatMessageTime(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeStyle: "short",
  }).format(new Date(value));
}

async function fetchMessages(user: User, threadId: string) {
  const token = await user.getIdToken();
  const response = await fetch(
    `/api/messages/threads/${encodeURIComponent(threadId)}/messages`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
    thread?: unknown;
    messages?: unknown;
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

  return {
    thread: responseBody?.thread as MessageThread,
    messages: Array.isArray(responseBody?.messages)
      ? (responseBody.messages as MessageItem[])
      : [],
  };
}

async function sendMessage(user: User, threadId: string, text: string) {
  const token = await user.getIdToken();
  const response = await fetch(
    `/api/messages/threads/${encodeURIComponent(threadId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    },
  );
  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
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
}

async function updateJobStatus(user: User, jobId: string, status: string) {
  const token = await user.getIdToken();
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
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
}

export default function MessageThreadPage() {
  const router = useRouter();
  const params = useParams<{ threadId: string }>();
  const threadId = params.threadId;
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const isLeavingForReviewRef = useRef(false);

  async function loadMessages(user: User) {
    const conversation = await fetchMessages(user, threadId);
    setThread(conversation.thread);
    setMessages(conversation.messages);
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
        await loadMessages(user);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [router, threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!currentUser || isLeavingForReviewRef.current) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      if (isLeavingForReviewRef.current) {
        return;
      }

      try {
        await loadMessages(currentUser);
      } catch (error) {
        console.error("Message polling failed:", error);
      }
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [currentUser, threadId]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser || isSending || !draft.trim()) {
      return;
    }

    try {
      setIsSending(true);
      setErrorMessage("");
      await sendMessage(currentUser, threadId, draft);
      setDraft("");
      await loadMessages(currentUser);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  }

  async function handleMarkCompleted() {
    if (!currentUser || !thread?.jobId || isUpdatingStatus) {
      return;
    }

    try {
      setIsUpdatingStatus(true);
      setErrorMessage("");
      await updateJobStatus(currentUser, thread.jobId, "completed");
      isLeavingForReviewRef.current = true;
      router.replace(`/customer/jobs/${encodeURIComponent(thread.jobId)}/review`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      isLeavingForReviewRef.current = false;
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  return (
    <main className="min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <div className="flex min-h-screen flex-1 flex-col px-5 pb-5 pt-5 md:min-h-[780px]">
          <StatusBar />

          <header className="mt-3 grid grid-cols-[40px_1fr_40px] items-center">
            <Link
              href="/messages"
              className="flex h-10 w-10 items-center justify-center rounded-full text-black"
              aria-label="Back to messages"
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            </Link>

            <Link href="/home" className="flex justify-center">
              <img
                src="/azisto-logo-cropped.png"
                alt="AZISTO - Your on-demand assistant"
                className="w-full max-w-[150px] object-contain"
              />
            </Link>

            <span aria-hidden="true" />
          </header>

          <section className="mt-5 rounded-xl border border-azisto-border bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] az-job-id">
              {thread?.jobId ?? "Conversation"}
            </p>
            <h1 className="mt-1 text-xl font-bold leading-tight text-black">
              {thread?.displayName || "Messages"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {thread?.status ? `Status: ${thread.status}` : "Open thread"}
            </p>
            {thread?.jobStatus ? (
              <span className={`mt-3 inline-flex ${getStatusChipClass(thread.jobStatus)}`}>
                Job: {thread.jobStatus.replaceAll("_", " ")}
              </span>
            ) : null}
            <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
              Keep communication inside AZISTO until booking is confirmed.
            </p>
            {thread?.currentUserRole === "customer" &&
            thread.jobStatus === "in_progress" ? (
              <button
                type="button"
                onClick={handleMarkCompleted}
                disabled={isUpdatingStatus}
                className="az-btn-primary mt-3 flex h-11 w-full items-center justify-center rounded-xl text-sm font-bold"
              >
                {isUpdatingStatus ? "Completing..." : "Mark job completed"}
              </button>
            ) : null}
          </section>

          {isLoading ? (
            <p className="mt-5 rounded-xl border border-azisto-border bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              Loading conversation...
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-5 whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <section className="mt-5 flex flex-1 flex-col gap-3 overflow-y-auto pb-4">
            {!isLoading && messages.length === 0 ? (
              <p className="rounded-xl border border-azisto-border bg-slate-50 px-4 py-3 text-center text-sm leading-6 text-slate-600">
                No messages yet. Send the first note.
              </p>
            ) : null}

            {messages.map((message) => {
              const isOwnMessage =
                Boolean(thread?.currentUserRole) &&
                message.senderRole === thread?.currentUserRole;

              return (
                <div
                  key={message.messageId}
                  className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                      isOwnMessage
                        ? "rounded-br-md border border-azisto-gold bg-white text-azisto-text"
                        : "rounded-bl-md bg-slate-100 text-slate-900"
                    }`}
                  >
                    <p>{message.text}</p>
                    {message.createdAt ? (
                      <p
                        className={`mt-1 text-[11px] font-semibold ${
                          isOwnMessage ? "text-azisto-muted" : "text-slate-400"
                        }`}
                      >
                        {formatMessageTime(message.createdAt)}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </section>

          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a message..."
              className="h-12 min-w-0 flex-1 rounded-xl border border-azisto-border bg-white px-4 text-sm outline-none placeholder:text-slate-400 az-focus-field"
            />
            <button
              type="submit"
              disabled={isSending || !draft.trim()}
              className="az-btn-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
              aria-label="Send message"
            >
              <Send aria-hidden="true" className="h-5 w-5" />
            </button>
          </form>
        </div>
        <BottomNav
          role={
            thread?.currentUserRole === "customer" ||
            thread?.currentUserRole === "contractor"
              ? thread.currentUserRole
              : "unknown"
          }
        />
      </div>
    </main>
  );
}
