"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Camera,
  Check,
  CheckCheck,
  ChevronLeft,
  Image as ImageIcon,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, storage } from "@/lib/firebase";
import {
  connectionInterruptedMessage,
  getRetryBackoffMs,
  isNetworkError,
  isQuotaExceededError,
  isTransientApiError,
} from "@/lib/apiErrors";
import {
  authenticatedFetch,
  throwApiResponseError,
} from "@/lib/authenticatedFetch";
import { refreshBadgeCountsNow } from "@/lib/badgeCounts";
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
  selectedTaskIds: string[];
  selectedTaskLabels: string[];
  currentUserRole: "customer" | "contractor" | string;
  status: string;
  jobStatus: string;
};

type MessageItem = {
  messageId: string;
  senderRole: "customer" | "contractor" | string;
  text: string;
  attachments?: MessageAttachment[];
  createdAt: string;
  readBy: string[];
};

type MessageAttachment = {
  type: "image";
  url: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  size: number;
};

const userMessageSuggestions = [
  "Hi, are you available for this job?",
  "Can you please confirm the estimated arrival time?",
  "Can you share an approximate quote?",
  "Please message me before arriving.",
  "Thank you.",
];

const contractorMessageSuggestions = [
  "Hi, I’m available for this job.",
  "I can come today.",
  "Can you please share more details?",
  "I’m on my way.",
  "I have completed the job.",
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

function getErrorMessage(error: unknown) {
  if (isTransientApiError(error)) {
    return connectionInterruptedMessage;
  }

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

function getMessageReceipt(message: MessageItem) {
  if (!message.createdAt) {
    return { label: "Sent", state: "sent" as const };
  }

  if (message.readBy.length > 1) {
    return { label: "Read", state: "read" as const };
  }

  return { label: "Delivered", state: "delivered" as const };
}

function MessageReceipt({
  message,
  isCustomerThread,
}: {
  message: MessageItem;
  isCustomerThread: boolean;
}) {
  const receipt = getMessageReceipt(message);
  const className =
    receipt.state === "read"
      ? "text-[#2563EB]"
      : isCustomerThread
        ? "text-white/75"
        : "text-[#5C0032]/60";

  return (
    <span
      className={`inline-flex items-center ${className}`}
      aria-label={receipt.label}
      title={receipt.label}
    >
      {receipt.state === "sent" ? (
        <Check aria-hidden="true" className="h-3.5 w-3.5" />
      ) : (
        <CheckCheck aria-hidden="true" className="h-3.5 w-3.5" />
      )}
    </span>
  );
}

type MessageFetchSource = "initial" | "interval" | "send-message" | "focus";
type MessageConversation = {
  thread: MessageThread;
  messages: MessageItem[];
};

type MessageFetchRuntime = {
  badgeRefreshAt: Map<string, number>;
  initialCache: Map<
    string,
    {
      expiresAt: number;
      conversation: MessageConversation;
    }
  >;
  requests: Map<string, Promise<MessageConversation>>;
};

const messageFetchRuntimeKey = "__azistoMessageFetchRuntime";
const messageFetchRuntimeScope = globalThis as typeof globalThis & {
  [messageFetchRuntimeKey]?: MessageFetchRuntime;
};
const messageFetchRuntime =
  messageFetchRuntimeScope[messageFetchRuntimeKey] ??
  {
    badgeRefreshAt: new Map(),
    initialCache: new Map(),
    requests: new Map(),
  };

messageFetchRuntime.badgeRefreshAt ??= new Map();
messageFetchRuntimeScope[messageFetchRuntimeKey] = messageFetchRuntime;

async function fetchMessages(
  user: User,
  threadId: string,
  source: MessageFetchSource,
  markRead = false,
) {
  const requestKey = `${user.uid}:${threadId}:${markRead ? "read" : "list"}`;
  const cachedConversation = messageFetchRuntime.initialCache.get(requestKey);

  if (
    source === "initial" &&
    cachedConversation &&
    cachedConversation.expiresAt > Date.now()
  ) {
    return cachedConversation.conversation;
  }

  const pendingRequest = messageFetchRuntime.requests.get(requestKey);

  if (pendingRequest) {
    return pendingRequest;
  }

  console.log(
    `[${new Date().toISOString()}] MESSAGE THREAD FETCH source: ${source}`,
  );
  const request = (async () => {
    const response = await authenticatedFetch(
      user,
      `/api/messages/threads/${encodeURIComponent(threadId)}/messages${
        markRead ? "?markRead=1" : ""
      }`,
    );
    const responseBody = (await response.json().catch(() => null)) as {
      code?: unknown;
      message?: unknown;
      thread?: unknown;
      messages?: unknown;
    } | null;

    if (!response.ok) {
      await throwApiResponseError(
        response,
        typeof responseBody?.message === "string"
          ? responseBody.message
          : response.statusText,
      );
    }

    const conversation = {
      thread: responseBody?.thread as MessageThread,
      messages: Array.isArray(responseBody?.messages)
        ? (responseBody.messages as MessageItem[])
        : [],
    };

    if (source === "initial") {
      messageFetchRuntime.initialCache.set(requestKey, {
        expiresAt: Date.now() + 2_000,
        conversation,
      });
    }

    return conversation;
  })().finally(() => {
    messageFetchRuntime.requests.delete(requestKey);
  });

  messageFetchRuntime.requests.set(requestKey, request);
  return request;
}

function createSafeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function uploadMessagePhoto(
  user: User,
  threadId: string,
  file: File,
): Promise<MessageAttachment> {
  const timestamp = Date.now();
  const safeFileName = createSafeFileName(file.name || "message-photo.jpg");
  const storagePath = `message-attachments/${threadId}/${user.uid}/${timestamp}-${safeFileName}`;
  const storageReference = ref(storage, storagePath);

  await uploadBytes(storageReference, file, {
    contentType: file.type || "image/jpeg",
  });

  const url = await getDownloadURL(storageReference);

  return {
    type: "image",
    url,
    fileName: file.name || "Photo",
    storagePath,
    contentType: file.type || "image/jpeg",
    size: file.size,
  };
}

async function sendMessage(
  user: User,
  threadId: string,
  text: string,
  attachments: MessageAttachment[],
) {
  const response = await authenticatedFetch(
    user,
    `/api/messages/threads/${encodeURIComponent(threadId)}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, attachments }),
    },
  );
  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok) {
    await throwApiResponseError(
      response,
      typeof responseBody?.message === "string"
        ? responseBody.message
        : response.statusText,
    );
  }
}

async function updateJobStatus(user: User, jobId: string, status: string) {
  const response = await authenticatedFetch(user, `/api/jobs/${encodeURIComponent(jobId)}/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok) {
    await throwApiResponseError(
      response,
      typeof responseBody?.message === "string"
        ? responseBody.message
        : response.statusText,
    );
  }
}

async function fetchProfilePhoneNumber(user: User) {
  const response = await authenticatedFetch(user, "/api/profile");
  const responseBody = (await response.json().catch(() => null)) as {
    profile?: unknown;
  } | null;

  if (!response.ok) {
    return "";
  }

  const profile =
    typeof responseBody?.profile === "object" && responseBody.profile !== null
      ? (responseBody.profile as Record<string, unknown>)
      : {};

  return typeof profile.phoneNumber === "string" ? profile.phoneNumber.trim() : "";
}

async function hireContractorForThread(
  user: User,
  jobId: string,
  contractorId: string,
  taskIds: string[],
) {
  const response = await authenticatedFetch(user, `/api/jobs/${encodeURIComponent(jobId)}/hire`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contractorId, taskIds }),
  });
  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok) {
    await throwApiResponseError(
      response,
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
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [selectedPhotoPreviewUrl, setSelectedPhotoPreviewUrl] = useState("");
  const [customerPhoneNumber, setCustomerPhoneNumber] = useState("");
  const [hirePhoneNumber, setHirePhoneNumber] = useState("");
  const [isHirePromptOpen, setIsHirePromptOpen] = useState(false);
  const [isUsingAlternatePhone, setIsUsingAlternatePhone] = useState(false);
  const [isHiringContractor, setIsHiringContractor] = useState(false);
  const [hireStatusMessage, setHireStatusMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const takePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const uploadPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const isLeavingForReviewRef = useRef(false);
  const isMessageRequestInFlightRef = useRef(false);
  const messageRetryAfterRef = useRef(0);
  const lastSuccessfulMessageFetchAtRef = useRef(0);
  const hasRefreshedBadgesForThreadRef = useRef(false);
  const hasMarkedThreadReadRef = useRef(false);
  const currentUserRef = useRef<User | null>(null);
  const loadMessagesRef = useRef<
    (
      user: User,
      source: MessageFetchSource,
      markRead?: boolean,
    ) => Promise<void>
  >(async () => {});
  const hasComposerContent = Boolean(draft.trim() || selectedPhoto);
  const canHireContractor =
    thread?.currentUserRole === "customer" &&
    Boolean(thread.jobId && thread.contractorId) &&
    (thread.jobStatus === "open" ||
      thread.jobStatus === "partially_hired" ||
      !thread.jobStatus);
  const isCustomerThread = thread?.currentUserRole !== "contractor";
  const shellClass = isCustomerThread
    ? "az-customer-shell min-h-screen md:px-6 md:py-8"
    : "az-contractor-shell min-h-screen md:px-6 md:py-8";
  const frameClass = isCustomerThread
    ? "mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border"
    : "mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-[var(--azisto-contractor-bg)] shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-[var(--azisto-contractor-border)]";
  const heroClass = isCustomerThread
    ? "az-customer-card mt-5 bg-gradient-to-br from-white via-blue-50 to-white p-4"
    : "az-contractor-soft-hero mt-4 p-3";
  const compactCardClass = isCustomerThread
    ? "az-customer-card"
    : "az-contractor-card-compact";
  const modalCardClass = isCustomerThread
    ? "az-customer-card"
    : "az-contractor-card";
  const primaryTextClass = isCustomerThread
    ? "text-[#0F172A]"
    : "text-[var(--azisto-contractor-text)]";
  const mutedTextClass = isCustomerThread
    ? "text-[#64748B]"
    : "text-[var(--azisto-contractor-muted)]";
  const accentTextClass = isCustomerThread
    ? "text-azisto-accent"
    : "text-[var(--azisto-contractor-burgundy)]";
  const detailPanelClass = isCustomerThread
    ? "border-azisto-border bg-white/80 text-[#64748B]"
    : "border-[var(--azisto-contractor-border)] bg-white/70 text-[var(--azisto-contractor-muted)]";
  const composerClass = isCustomerThread
    ? "relative flex items-center gap-2 rounded-[22px] border border-azisto-border bg-white/90 p-2 shadow-[0_-4px_18px_rgba(15,23,42,0.06)] backdrop-blur"
    : "az-contractor-action-bar relative flex items-center gap-2 rounded-[22px] p-2";
  const attachAccentClass = isCustomerThread
    ? "text-azisto-accent"
    : "text-[var(--azisto-contractor-burgundy)]";
  const attachButtonClass = isCustomerThread
    ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-azisto-border bg-white text-azisto-accent"
    : "flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-[var(--azisto-contractor-border)] bg-white text-[var(--azisto-contractor-burgundy)]";
  const inputClass = isCustomerThread
    ? "h-12 min-w-0 flex-1 rounded-[18px] border border-azisto-border bg-white px-4 text-sm outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-blue-100"
    : "h-12 min-w-0 flex-1 rounded-[18px] border border-[var(--azisto-contractor-border)] bg-white px-4 text-sm outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-[rgb(138_15_77_/_0.14)]";
  const activeSendClass = isCustomerThread
    ? "border-azisto-accent bg-azisto-accent text-white shadow-sm shadow-blue-200"
    : "border-[var(--azisto-contractor-burgundy)] bg-[var(--azisto-contractor-burgundy)] text-white shadow-sm shadow-[rgb(138_15_77_/_0.18)]";
  const outlineButtonClass = isCustomerThread
    ? "border-azisto-accent bg-white text-azisto-accent"
    : "border-[var(--azisto-contractor-burgundy)] bg-white text-[var(--azisto-contractor-burgundy)]";
  const primaryButtonClass = isCustomerThread ? "az-btn-primary" : "az-btn-contractor";
  const messageSuggestions = isCustomerThread
    ? userMessageSuggestions
    : contractorMessageSuggestions;

  async function loadMessages(
    user: User,
    source: MessageFetchSource,
    markRead = false,
  ) {
    if (
      (source === "interval" || source === "focus") &&
      Date.now() - lastSuccessfulMessageFetchAtRef.current < 40_000
    ) {
      return;
    }

    if (
      isMessageRequestInFlightRef.current ||
      messageRetryAfterRef.current > Date.now()
    ) {
      return;
    }

    isMessageRequestInFlightRef.current = true;

    try {
      const conversation = await fetchMessages(
        user,
        threadId,
        source,
        markRead,
      );
      setThread(conversation.thread);
      setMessages(conversation.messages);
      lastSuccessfulMessageFetchAtRef.current = Date.now();
      messageRetryAfterRef.current = 0;
      setErrorMessage((currentValue) =>
        currentValue === connectionInterruptedMessage ? "" : currentValue,
      );
    } catch (error) {
      const backoffMs =
        isQuotaExceededError(error) || isNetworkError(error)
          ? 2 * 60_000
          : getRetryBackoffMs(error);

      if (backoffMs > 0) {
        messageRetryAfterRef.current = Date.now() + backoffMs;
      }

      throw error;
    } finally {
      isMessageRequestInFlightRef.current = false;
    }
  }

  loadMessagesRef.current = loadMessages;

  useEffect(() => {
    hasMarkedThreadReadRef.current = false;
    hasRefreshedBadgesForThreadRef.current = false;
    messageRetryAfterRef.current = 0;
    lastSuccessfulMessageFetchAtRef.current = 0;
  }, [threadId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        currentUserRef.current = null;
        router.replace("/login");
        return;
      }

      currentUserRef.current = user;
      setCurrentUser(user);

      try {
        setIsLoading(true);
        setErrorMessage("");
        const shouldMarkRead = !hasMarkedThreadReadRef.current;
        hasMarkedThreadReadRef.current = true;
        await loadMessagesRef.current(user, "initial", shouldMarkRead);
        const badgeRefreshKey = `${user.uid}:${threadId}`;
        const lastBadgeRefreshAt =
          messageFetchRuntime.badgeRefreshAt.get(badgeRefreshKey) ?? 0;

        if (
          !hasRefreshedBadgesForThreadRef.current &&
          Date.now() - lastBadgeRefreshAt > 2_000
        ) {
          hasRefreshedBadgesForThreadRef.current = true;
          messageFetchRuntime.badgeRefreshAt.set(
            badgeRefreshKey,
            Date.now(),
          );
          await refreshBadgeCountsNow(user, "message thread opened");
        }
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      currentUserRef.current = null;
      unsubscribe();
    };
  }, [router, threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedPhoto) {
      setSelectedPhotoPreviewUrl("");
      return;
    }

    const previewUrl = URL.createObjectURL(selectedPhoto);
    setSelectedPhotoPreviewUrl(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedPhoto]);

  useEffect(() => {
    if (
      !currentUser ||
      thread?.currentUserRole !== "customer" ||
      customerPhoneNumber
    ) {
      return;
    }

    let isMounted = true;

    fetchProfilePhoneNumber(currentUser)
      .then((phoneNumber) => {
        if (!isMounted || !phoneNumber) {
          return;
        }

        setCustomerPhoneNumber(phoneNumber);
        setHirePhoneNumber((currentValue) => currentValue || phoneNumber);
      })
      .catch((error) => {
        console.error("Unable to load customer phone number:", error);
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser, thread?.currentUserRole, customerPhoneNumber]);

  useEffect(() => {
    const runtimeWindow = window as typeof window & {
      __azistoMessageThreadIntervals?: Map<
        string,
        ReturnType<typeof window.setInterval>
      >;
    };
    const intervals =
      runtimeWindow.__azistoMessageThreadIntervals ?? new Map();
    runtimeWindow.__azistoMessageThreadIntervals = intervals;
    const existingInterval = intervals.get(threadId);

    if (existingInterval) {
      window.clearInterval(existingInterval);
    }

    const refreshThread = async (source: "interval" | "focus") => {
      const user = currentUserRef.current;

      if (
        !user ||
        isLeavingForReviewRef.current ||
        document.hidden
      ) {
        return;
      }

      try {
        await loadMessagesRef.current(user, source);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));

        if (!isTransientApiError(error)) {
          console.error("Message polling failed:", error);
        }
      }
    };
    const intervalId = window.setInterval(
      () => void refreshThread("interval"),
      40_000,
    );
    const handleFocus = () => void refreshThread("focus");

    intervals.set(threadId, intervalId);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);

      if (intervals.get(threadId) === intervalId) {
        intervals.delete(threadId);
      }
    };
  }, [threadId]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser || isSending || !hasComposerContent) {
      return;
    }

    try {
      setIsSending(true);
      setErrorMessage("");
      const attachments = selectedPhoto
        ? [await uploadMessagePhoto(currentUser, threadId, selectedPhoto)]
        : [];

      await sendMessage(currentUser, threadId, draft.trim(), attachments);
      setDraft("");
      setSelectedPhoto(null);
      setIsAttachMenuOpen(false);
      await loadMessagesRef.current(currentUser, "send-message");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  }

  function handlePhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please choose a photo file.");
      return;
    }

    setSelectedPhoto(file);
    setIsAttachMenuOpen(false);
    setErrorMessage("");
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

  function handleOpenHirePrompt() {
    setHireStatusMessage("");
    setErrorMessage("");
    setIsUsingAlternatePhone(!customerPhoneNumber);
    setHirePhoneNumber((currentValue) => currentValue || customerPhoneNumber);
    setIsHirePromptOpen(true);
  }

  async function handleHireContractor() {
    if (!currentUser || !thread?.jobId || !thread.contractorId) {
      return;
    }

    const phoneNumber = hirePhoneNumber.trim();

    if (!phoneNumber) {
      setHireStatusMessage("Please enter a phone no. before sharing.");
      return;
    }

    try {
      setIsHiringContractor(true);
      setHireStatusMessage("");
      setErrorMessage("");
      await hireContractorForThread(
        currentUser,
        thread.jobId,
        thread.contractorId,
        thread.selectedTaskIds ?? [],
      );
      await sendMessage(
        currentUser,
        threadId,
        `My phone no. is ${phoneNumber}.`,
        [],
      );
      setIsHirePromptOpen(false);
      setHireStatusMessage(
        "Contractor selected. Your phone no. was shared while you wait for their decision.",
      );
      await loadMessagesRef.current(currentUser, "send-message");
    } catch (error) {
      setHireStatusMessage(getErrorMessage(error));
    } finally {
      setIsHiringContractor(false);
    }
  }

  return (
    <main className={shellClass}>
      <div className={frameClass}>
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

            <NotificationBell />
          </header>

          <section className={heroClass}>
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${mutedTextClass}`}>Messages</p>
                <h1 className={`mt-0.5 text-xl font-normal leading-6 ${primaryTextClass}`}>
                  {thread?.displayName || "Messages"}
                </h1>
                <p className={`mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold ${mutedTextClass}`}>
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Active recently
                </p>
              </div>
              <span className={`shrink-0 rounded-full border bg-white/80 px-2 py-0.5 text-right text-[13px] font-bold capitalize leading-5 ${isCustomerThread ? "border-azisto-border text-[#0F172A]" : "border-[var(--azisto-contractor-border)] text-[var(--azisto-contractor-text)]"}`}>
                {thread?.jobStatus
                  ? thread.jobStatus.replaceAll("_", " ")
                  : thread?.status || "Open"}
              </span>
            </div>
            <div className={`relative z-10 mt-2.5 rounded-xl border px-3 py-2 text-[11px] font-semibold ${detailPanelClass}`}>
              <p className={`truncate ${primaryTextClass}`}>
                {thread?.jobTitle || "Service request"}
              </p>
              <p className="mt-1 truncate">
                {thread?.jobId ?? "Conversation"}
              </p>
              {thread?.selectedTaskLabels &&
              thread.selectedTaskLabels.length > 0 ? (
                <p className={`mt-1 truncate ${mutedTextClass}`}>
                  Tasks: {thread.selectedTaskLabels.join(", ")}
                </p>
              ) : null}
            </div>
            <p className="relative z-10 mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-600">
              Keep communication inside AZISTO until booking is confirmed.
            </p>
            {thread?.currentUserRole === "customer" &&
            thread.jobStatus === "in_progress" ? (
              <button
                type="button"
                onClick={handleMarkCompleted}
                disabled={isUpdatingStatus}
                className={`relative z-10 mt-3 flex h-10 w-full items-center justify-center rounded-full border text-xs font-bold ${outlineButtonClass}`}
              >
                {isUpdatingStatus ? "Completing..." : "Mark job completed"}
              </button>
            ) : null}
          </section>

          {isLoading ? (
            <p className={`${compactCardClass} mt-5 px-4 py-3 text-sm leading-6 ${mutedTextClass}`}>
              Loading conversation...
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-5 whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <section className="azisto-scroll mt-5 flex flex-1 flex-col gap-3 overflow-y-auto pb-4">
            {!isLoading && messages.length === 0 ? (
              <p className={`${compactCardClass} px-4 py-3 text-center text-sm leading-6 ${mutedTextClass}`}>
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
                    className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      isOwnMessage
                        ? isCustomerThread
                          ? "rounded-br-md border border-blue-700 bg-azisto-accent text-white shadow-[0_6px_16px_rgba(37,99,235,0.18)]"
                          : "az-message-bubble-outgoing rounded-br-md"
                        : isCustomerThread
                          ? "rounded-bl-md border border-azisto-border bg-white text-[#0F172A] shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
                          : "az-message-bubble-incoming rounded-bl-md"
                    }`}
                  >
                    {message.text ? <p>{message.text}</p> : null}
                    {message.attachments && message.attachments.length > 0 ? (
                      <div className={message.text ? "mt-2 space-y-2" : "space-y-2"}>
                        {message.attachments.map((attachment) => (
                          <a
                            key={attachment.storagePath || attachment.url}
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-xl border border-slate-200 bg-white"
                          >
                            <img
                              src={attachment.url}
                              alt={attachment.fileName || "Message photo"}
                              className="max-h-56 w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}
                    <div
                      className={`mt-1 flex items-center gap-1.5 text-[11px] font-semibold ${
                        isOwnMessage
                          ? isCustomerThread
                            ? "justify-end text-white/75"
                            : "justify-end text-[#5C0032]/60"
                          : "justify-start text-slate-400"
                      }`}
                    >
                      {message.createdAt ? (
                        <span>{formatMessageTime(message.createdAt)}</span>
                      ) : null}
                      {isOwnMessage ? (
                        <MessageReceipt
                          message={message}
                          isCustomerThread={isCustomerThread}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </section>

          {selectedPhoto ? (
            <div className={`mb-2 flex items-center gap-3 rounded-[18px] border bg-white p-2 ${isCustomerThread ? "border-azisto-border" : "border-[var(--azisto-contractor-border)]"}`}>
              {selectedPhotoPreviewUrl ? (
                <img
                  src={selectedPhotoPreviewUrl}
                  alt="Selected attachment preview"
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-900">
                  {selectedPhoto.name || "Photo selected"}
                </p>
                <p className="text-[11px] font-semibold text-slate-500">
                  Ready to send
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
                aria-label="Remove selected photo"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <div
            className="mb-2 flex gap-2 overflow-x-auto pb-1"
            aria-label="Quick message suggestions"
          >
            {messageSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setDraft(suggestion)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  isCustomerThread
                    ? "border-blue-200 bg-blue-50 text-azisto-accent hover:bg-blue-100"
                    : "border-[var(--azisto-contractor-burgundy)] bg-[var(--azisto-contractor-bg)] text-[var(--azisto-contractor-burgundy)] hover:bg-white"
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <form
            onSubmit={handleSend}
            className={composerClass}
          >
            <input
              ref={takePhotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelected}
              className="hidden"
              aria-label="Take photo"
            />
            <input
              ref={uploadPhotoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelected}
              className="hidden"
              aria-label="Upload photo"
            />
            <div className="relative">
              {isAttachMenuOpen ? (
                <div className={`absolute bottom-14 left-0 z-20 w-44 rounded-2xl border bg-white p-2 shadow-xl ${isCustomerThread ? "border-azisto-border" : "border-[var(--azisto-contractor-border)]"}`}>
                  <button
                    type="button"
                    onClick={() => takePhotoInputRef.current?.click()}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-800 hover:bg-slate-50"
                  >
                    <Camera aria-hidden="true" className={`h-4 w-4 ${attachAccentClass}`} />
                    Take photo
                  </button>
                  <button
                    type="button"
                    onClick={() => uploadPhotoInputRef.current?.click()}
                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-800 hover:bg-slate-50"
                  >
                    <ImageIcon
                      aria-hidden="true"
                      className={`h-4 w-4 ${attachAccentClass}`}
                    />
                    Upload photo
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  setIsAttachMenuOpen((currentValue) => !currentValue)
                }
                className={attachButtonClass}
                aria-label="Attach photo"
                aria-expanded={isAttachMenuOpen}
              >
                <Paperclip aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a message..."
              className={inputClass}
            />
            <button
              type="submit"
              disabled={isSending || !hasComposerContent}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition ${
                hasComposerContent && !isSending
                  ? activeSendClass
                  : "border-slate-200 bg-slate-100 text-slate-400"
              }`}
              aria-label="Send message"
            >
              <Send aria-hidden="true" className="h-5 w-5" />
            </button>
          </form>

          {canHireContractor ? (
            <button
              type="button"
              onClick={handleOpenHirePrompt}
              className={`${primaryButtonClass} mt-2 flex h-12 w-full items-center justify-center rounded-full text-sm font-bold`}
            >
              Hire Contractor
            </button>
          ) : null}

          {hireStatusMessage ? (
            <p className="mt-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-700">
              {hireStatusMessage}
            </p>
          ) : null}
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
      {isHirePromptOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-5">
          <div className={`${modalCardClass} w-full max-w-[340px] p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className={`text-base font-bold ${accentTextClass}`}>
                  Share phone no.
                </h2>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  Hire the contractor and share a phone no. in this message thread.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHirePromptOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
                aria-label="Close hire prompt"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            {customerPhoneNumber && !isUsingAlternatePhone ? (
              <div className={`mt-4 rounded-[18px] border p-3 ${isCustomerThread ? "border-azisto-border bg-slate-50" : "border-[var(--azisto-contractor-border)] bg-[rgb(248_247_252_/_0.9)]"}`}>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Profile phone no.
                </p>
                <p className="mt-1 text-sm font-bold text-slate-950">
                  {customerPhoneNumber}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsUsingAlternatePhone(true);
                    setHirePhoneNumber("");
                    setHireStatusMessage("");
                  }}
                  className={`mt-2 text-xs font-bold ${accentTextClass}`}
                >
                  Use another phone no.
                </button>
              </div>
            ) : (
              <label className="mt-4 block">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Phone no.
                </span>
                <input
                  value={hirePhoneNumber}
                  onChange={(event) => {
                    setHirePhoneNumber(event.target.value);
                    setHireStatusMessage("");
                  }}
                  placeholder="Enter phone no."
                  className={isCustomerThread ? "mt-2 h-12 w-full rounded-[18px] border border-azisto-border bg-white px-3 text-sm font-semibold outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-blue-100" : "mt-2 h-12 w-full rounded-[18px] border border-[var(--azisto-contractor-border)] bg-white px-3 text-sm font-semibold outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-[rgb(138_15_77_/_0.14)]"}
                />
              </label>
            )}

            {hireStatusMessage ? (
              <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700">
                {hireStatusMessage}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleHireContractor}
              disabled={isHiringContractor || !hirePhoneNumber.trim()}
              className={`${primaryButtonClass} mt-4 flex h-12 w-full items-center justify-center rounded-full text-sm font-bold`}
            >
              {isHiringContractor ? "Hiring..." : "Share phone no. & hire"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
