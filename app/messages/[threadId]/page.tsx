"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Camera,
  ChevronLeft,
  Image as ImageIcon,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, storage } from "@/lib/firebase";
import BottomNav from "@/app/components/BottomNav";

type MessageThread = {
  threadId: string;
  jobId: string;
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
  const token = await user.getIdToken();
  const response = await fetch(
    `/api/messages/threads/${encodeURIComponent(threadId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
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

async function fetchProfilePhoneNumber(user: User) {
  const token = await user.getIdToken();
  const response = await fetch("/api/profile", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
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
  const token = await user.getIdToken();
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/hire`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contractorId, taskIds }),
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
  const hasComposerContent = Boolean(draft.trim() || selectedPhoto);
  const canHireContractor =
    thread?.currentUserRole === "customer" &&
    Boolean(thread.jobId && thread.contractorId) &&
    (thread.jobStatus === "open" ||
      thread.jobStatus === "partially_hired" ||
      !thread.jobStatus);

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
      await loadMessages(currentUser);
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
        "Contractor hired. Your phone no. was shared in this conversation.",
      );
      await loadMessages(currentUser);
    } catch (error) {
      setHireStatusMessage(getErrorMessage(error));
    } finally {
      setIsHiringContractor(false);
    }
  }

  return (
    <main className="az-contractor-shell min-h-screen md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-[var(--azisto-contractor-bg)] shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-[var(--azisto-contractor-border)]">
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

          <section className="az-contractor-hero-card mt-5 p-4">
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white/75">Messages</p>
                <h1 className="mt-1 text-2xl font-normal leading-7 text-white">
                  {thread?.displayName || "Messages"}
                </h1>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.09em] text-white/80">
                  {thread?.jobId ?? "Conversation"}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-white/20 bg-white/15 px-2 py-0.5 text-right text-[13px] font-bold capitalize leading-5 text-white">
                {thread?.jobStatus
                  ? thread.jobStatus.replaceAll("_", " ")
                  : thread?.status || "Open"}
              </span>
            </div>
            <div className="relative z-10 mt-4 space-y-1 text-[11px] font-semibold text-white/85">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/10 px-2 py-1">
                <p className="min-w-0 truncate">Conversation</p>
                <p className="shrink-0 text-right capitalize">
                  {thread?.status || "Open thread"}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/10 px-2 py-1">
                <p className="min-w-0 truncate">Role</p>
                <p className="shrink-0 text-right capitalize">
                  {thread?.currentUserRole || "Member"}
                </p>
              </div>
            </div>
            <p className="relative z-10 mt-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold leading-5 text-white/85">
              Keep communication inside AZISTO until booking is confirmed.
            </p>
            {thread?.currentUserRole === "customer" &&
            thread.jobStatus === "in_progress" ? (
              <button
                type="button"
                onClick={handleMarkCompleted}
                disabled={isUpdatingStatus}
                className="relative z-10 mt-3 flex h-10 w-full items-center justify-center rounded-full border border-white/30 bg-white text-xs font-bold text-[var(--azisto-contractor-burgundy)]"
              >
                {isUpdatingStatus ? "Completing..." : "Mark job completed"}
              </button>
            ) : null}
          </section>

          {isLoading ? (
            <p className="az-contractor-card-compact mt-5 px-4 py-3 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
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
              <p className="az-contractor-card-compact px-4 py-3 text-center text-sm leading-6 text-[var(--azisto-contractor-muted)]">
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
                        ? "rounded-br-md border border-[var(--azisto-contractor-burgundy)] bg-[var(--azisto-contractor-burgundy)] text-white"
                        : "rounded-bl-md border border-[var(--azisto-contractor-border)] bg-white text-[var(--azisto-contractor-text)]"
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
                    {message.createdAt ? (
                      <p
                        className={`mt-1 text-[11px] font-semibold ${
                          isOwnMessage ? "text-white/75" : "text-slate-400"
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

          {selectedPhoto ? (
            <div className="mb-2 flex items-center gap-3 rounded-[18px] border border-[var(--azisto-contractor-border)] bg-white p-2">
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

          <form onSubmit={handleSend} className="relative flex items-center gap-2">
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
                <div className="absolute bottom-14 left-0 z-20 w-44 rounded-2xl border border-[var(--azisto-contractor-border)] bg-white p-2 shadow-xl">
                  <button
                    type="button"
                    onClick={() => takePhotoInputRef.current?.click()}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-800 hover:bg-slate-50"
                  >
                    <Camera aria-hidden="true" className="h-4 w-4 text-[var(--azisto-contractor-burgundy)]" />
                    Take photo
                  </button>
                  <button
                    type="button"
                    onClick={() => uploadPhotoInputRef.current?.click()}
                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-800 hover:bg-slate-50"
                  >
                    <ImageIcon
                      aria-hidden="true"
                      className="h-4 w-4 text-[var(--azisto-contractor-burgundy)]"
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
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-[var(--azisto-contractor-border)] bg-white text-[var(--azisto-contractor-burgundy)]"
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
              className="h-12 min-w-0 flex-1 rounded-[18px] border border-[var(--azisto-contractor-border)] bg-white px-4 text-sm outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-[rgb(138_15_77_/_0.14)]"
            />
            <button
              type="submit"
              disabled={isSending || !hasComposerContent}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition ${
                hasComposerContent && !isSending
                  ? "border-[var(--azisto-contractor-burgundy)] bg-[var(--azisto-contractor-burgundy)] text-white shadow-sm shadow-[rgb(138_15_77_/_0.18)]"
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
              className="az-btn-contractor mt-2 flex h-12 w-full items-center justify-center rounded-full text-sm font-bold"
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
          <div className="az-contractor-card w-full max-w-[340px] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[var(--azisto-contractor-burgundy)]">
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
              <div className="mt-4 rounded-[18px] border border-[var(--azisto-contractor-border)] bg-[rgb(248_247_252_/_0.9)] p-3">
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
                  className="mt-2 text-xs font-bold text-[var(--azisto-contractor-burgundy)]"
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
                  className="mt-2 h-12 w-full rounded-[18px] border border-[var(--azisto-contractor-border)] bg-white px-3 text-sm font-semibold outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-[rgb(138_15_77_/_0.14)]"
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
              className="az-btn-contractor mt-4 flex h-12 w-full items-center justify-center rounded-full text-sm font-bold"
            >
              {isHiringContractor ? "Hiring..." : "Share phone no. & hire"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
