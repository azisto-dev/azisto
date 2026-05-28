"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Check, ChevronLeft, Flag, MapPin, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { getStatusChipClass } from "@/lib/theme";
import BottomNav from "@/app/components/BottomNav";

const reportReasonOptions = [
  { value: "fake_job", label: "Fake job" },
  { value: "wrong_address", label: "Wrong address" },
  { value: "spam", label: "Spam" },
  { value: "unsafe_customer", label: "Unsafe customer" },
  { value: "abusive_message", label: "Abusive message" },
  { value: "no_response", label: "No response" },
  { value: "other", label: "Other" },
];

type ContractorJobDetail = {
  jobId: string;
  customerId: string;
  customerFirstName: string;
  customerEmailVerified: boolean;
  customerPhoneVerified: boolean;
  customerCompletedJobsCount: number;
  customerReportsCount: number;
  selectedServiceCategory: string;
  selectedSubcategories: string[];
  jobDescription: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  preferredDate: string;
  preferredTime: string;
  urgency: string;
  status: string;
  matchingStatus: string;
  hiredContractorId: string;
  hiredBusinessName: string;
  tasks?: JobTask[];
};

type JobTask = {
  taskId: string;
  parentJobId: string;
  category: string;
  subcategory: string;
  status: string;
  hiredContractorId: string;
  interestedContractorIds: string[];
  contractorServiceMatch?: boolean;
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

  return "Unable to load this job.";
}

async function fetchContractorJob(user: User, jobId: string) {
  const token = await user.getIdToken();
  const response = await fetch(
    `/api/contractors/jobs/${encodeURIComponent(jobId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
    job?: unknown;
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

  return responseBody?.job as ContractorJobDetail;
}

async function submitContractorInterest(
  user: User,
  jobId: string,
  taskIds: string[],
) {
  const token = await user.getIdToken();
  const response = await fetch(
    `/api/contractors/jobs/${encodeURIComponent(jobId)}/interest`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ taskIds }),
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

async function createMessageThread(
  user: User,
  jobId: string,
  selectedTaskIds: string[],
  selectedTaskLabels: string[],
) {
  const token = await user.getIdToken();
  const response = await fetch("/api/messages/threads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jobId,
      selectedTaskIds,
      selectedTaskLabels,
    }),
  });
  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
    threadId?: unknown;
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

  return typeof responseBody?.threadId === "string"
    ? responseBody.threadId
    : "";
}

async function submitJobReport(
  user: User,
  jobId: string,
  reason: string,
  details: string,
) {
  const token = await user.getIdToken();
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/report`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason,
      details,
    }),
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

function formatWhen(date: string, time: string) {
  if (!date && !time) {
    return "Flexible timing";
  }

  return [date, time].filter(Boolean).join(" at ");
}

export default function ContractorJobDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [job, setJob] = useState<ContractorJobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingInterest, setIsSubmittingInterest] = useState(false);
  const [isOpeningThread, setIsOpeningThread] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [hasSubmittedInterest, setHasSubmittedInterest] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportReason, setReportReason] = useState("fake_job");
  const [reportDetails, setReportDetails] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [interestMessage, setInterestMessage] = useState("");
  const [lifecycleMessage, setLifecycleMessage] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isMessagePromptOpen, setIsMessagePromptOpen] = useState(false);

  async function loadJob(user: User) {
    const jobDetails = await fetchContractorJob(user, jobId);
    const openTasks =
      jobDetails.tasks?.filter((task) => task.status === "open") ?? [];
    const requestedTaskId = searchParams.get("taskId");
    const initialTaskIds =
      requestedTaskId &&
      openTasks.some((task) => task.taskId === requestedTaskId)
        ? [requestedTaskId]
        : [];

    setJob(jobDetails);
    setSelectedTaskIds(initialTaskIds);
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
        await loadJob(user);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [jobId, router, searchParams]);

  async function handleInterestSubmit() {
    if (!currentUser || isSubmittingInterest || hasSubmittedInterest) {
      return;
    }

    if (selectedTaskIds.length === 0) {
      setInterestMessage("Please choose at least one task before submitting interest.");
      return;
    }

    const selectedTasks =
      job?.tasks?.filter((task) => selectedTaskIds.includes(task.taskId)) ?? [];
    const hasInvalidSelectedTask =
      selectedTasks.length !== selectedTaskIds.length ||
      selectedTasks.some(
        (task) => task.status !== "open" || task.contractorServiceMatch === false,
      );

    if (hasInvalidSelectedTask) {
      setInterestMessage(
        "Please choose only open tasks that match the services saved in your contractor profile.",
      );
      return;
    }

    try {
      setIsSubmittingInterest(true);
      setInterestMessage("");
      await submitContractorInterest(currentUser, jobId, selectedTaskIds);
      setHasSubmittedInterest(true);
      setInterestMessage("Interest submitted successfully");
      setIsMessagePromptOpen(true);
    } catch (error) {
      setInterestMessage(getErrorMessage(error));
    } finally {
      setIsSubmittingInterest(false);
    }
  }

  async function handleMessageCustomer() {
    if (!currentUser || isOpeningThread) {
      return;
    }

    try {
      setIsOpeningThread(true);
      setInterestMessage("");
      const selectedTaskLabels =
        job?.tasks
          ?.filter((task) => selectedTaskIds.includes(task.taskId))
          .map((task) => task.subcategory || task.category || task.taskId) ?? [];
      const threadId = await createMessageThread(
        currentUser,
        jobId,
        selectedTaskIds,
        selectedTaskLabels,
      );
      router.push(`/messages/${encodeURIComponent(threadId)}`);
    } catch (error) {
      setInterestMessage(getErrorMessage(error));
    } finally {
      setIsOpeningThread(false);
    }
  }

  function toggleSelectedTask(taskId: string) {
    setSelectedTaskIds((currentTaskIds) =>
      currentTaskIds.includes(taskId)
        ? currentTaskIds.filter((currentTaskId) => currentTaskId !== taskId)
        : [...currentTaskIds, taskId],
    );
  }

  async function handleMarkInProgress() {
    if (!currentUser || isUpdatingStatus) {
      return;
    }

    try {
      setIsUpdatingStatus(true);
      setLifecycleMessage("");
      await updateJobStatus(currentUser, jobId, "in_progress");
      await loadJob(currentUser);
      setLifecycleMessage("Job marked in progress");
    } catch (error) {
      setLifecycleMessage(getErrorMessage(error));
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleReportSubmit() {
    if (!currentUser || isSubmittingReport) {
      return;
    }

    try {
      setIsSubmittingReport(true);
      setReportMessage("");
      await submitJobReport(currentUser, jobId, reportReason, reportDetails);
      setReportDetails("");
      setIsReportOpen(false);
      setReportMessage("Report submitted. AZISTO will review this job.");
    } catch (error) {
      setReportMessage(getErrorMessage(error));
    } finally {
      setIsSubmittingReport(false);
    }
  }

  return (
    <main className="az-contractor-shell min-h-screen md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-[var(--azisto-contractor-bg)] shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-[var(--azisto-contractor-border)]">
        <div className="flex-1 px-5 pb-6 pt-5">
          <StatusBar />

          <header className="mt-3 grid grid-cols-[40px_1fr_40px] items-center">
            <Link
              href="/contractor/dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-full text-black"
              aria-label="Back to available jobs"
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

          {isLoading ? (
            <p className="az-contractor-card-compact mt-8 px-4 py-3 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
              Loading job details...
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-8 whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {job ? (
            <>
              <section className="az-contractor-hero-card mt-8 p-5">
                <div className="relative z-10">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/75">
                    {job.jobId}
                  </p>
                  <h1 className="mt-2 text-3xl font-normal leading-tight text-white">
                    {job.selectedServiceCategory || "Service request"}
                  </h1>
                  <p className="mt-8 flex items-center gap-2 text-sm font-semibold leading-6 text-white/80">
                    <MapPin aria-hidden="true" className="h-4 w-4" />
                    {[job.city, job.province].filter(Boolean).join(", ") ||
                      "Location not provided"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-bold capitalize text-white">
                      {job.status || "open"}
                    </span>
                    <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-bold text-white">
                      {job.urgency || "Flexible"}
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm leading-5">
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/65">When</p>
                      <p className="mt-1 font-semibold text-white">
                        {formatWhen(job.preferredDate, job.preferredTime)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/65">Customer</p>
                      <p className="mt-1 font-semibold text-white">
                        {job.customerFirstName || "Customer"}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="az-contractor-card mt-5 p-4">
                <p className="text-sm font-bold text-[var(--azisto-contractor-text)]">Tasks</p>
                {job.tasks && job.tasks.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {job.tasks.map((task) => {
                      const isOpen = task.status === "open";
                      const canSelectTask = isOpen && task.contractorServiceMatch !== false;
                      const isSelected = selectedTaskIds.includes(task.taskId);

                      return (
                        <button
                          key={task.taskId}
                          type="button"
                          onClick={() => {
                            if (canSelectTask) {
                              toggleSelectedTask(task.taskId);
                            }
                          }}
                          disabled={!canSelectTask}
                          className={`flex w-full items-center justify-between gap-3 rounded-[22px] border px-3 py-3 text-left text-sm transition ${
                            isSelected
                              ? "border-[var(--azisto-contractor-burgundy)] bg-[rgb(138_15_77_/_0.07)] text-[var(--azisto-contractor-text)]"
                              : "border-[var(--azisto-contractor-border)] bg-[rgb(248_247_252_/_0.9)] text-[var(--azisto-contractor-muted)]"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
                                isSelected
                                  ? "border-[var(--azisto-contractor-burgundy)] bg-[var(--azisto-contractor-burgundy)] text-white"
                                  : canSelectTask
                                    ? "border-[var(--azisto-contractor-burgundy)] bg-white text-transparent"
                                    : "border-slate-300 bg-slate-100 text-transparent"
                              }`}
                              aria-hidden="true"
                            >
                              <Check className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-xs font-bold uppercase tracking-[0.12em] text-[var(--azisto-contractor-burgundy)]">
                                {task.taskId}
                              </span>
                              <span className="mt-1 block truncate font-bold">
                                {task.subcategory || task.category || "Task"}
                              </span>
                            </span>
                          </span>
                          <span className={`${getStatusChipClass(task.status || "open")} shrink-0`}>
                            {task.contractorServiceMatch === false
                              ? "Not in profile"
                              : task.status || "open"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : job.selectedSubcategories.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.selectedSubcategories.map((item) => (
                      <span
                        key={item}
                        className="az-contractor-chip rounded-full px-3 py-1 text-xs font-bold"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
                    No tasks listed.
                  </p>
                )}
              </section>

              <section className="az-contractor-card mt-5 p-4">
                <p className="text-sm font-bold text-[var(--azisto-contractor-text)]">Job details</p>
                <p className="mt-2 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
                  {job.jobDescription || "No description provided."}
                </p>
              </section>

              <section className="az-contractor-card mt-5 p-4">
                <p className="text-sm font-bold text-[var(--azisto-contractor-text)]">Service address</p>
                <p className="mt-2 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
                  {[job.address, job.city, job.province, job.postalCode]
                    .filter(Boolean)
                    .join(", ") || "Address not provided."}
                </p>
              </section>

              <section className="az-contractor-card mt-5 p-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsReportOpen((currentValue) => !currentValue);
                    setReportMessage("");
                  }}
                  className="flex w-full items-center justify-between gap-3 text-left text-sm font-bold text-slate-900"
                >
                  <span className="flex items-center gap-2">
                    <Flag aria-hidden="true" className="h-4 w-4 text-red-500" />
                    Report job
                  </span>
                  <span className="text-xs font-bold text-red-500">
                    Trust & safety
                  </span>
                </button>

                {isReportOpen ? (
                  <div className="mt-4 space-y-3">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                        Reason
                      </label>
                      <select
                        value={reportReason}
                        onChange={(event) => setReportReason(event.target.value)}
                        className="h-12 w-full rounded-[18px] border border-[var(--azisto-contractor-border)] bg-white px-3 text-sm font-semibold text-slate-800 outline-none az-focus-field"
                      >
                        {reportReasonOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                        Details
                      </label>
                      <textarea
                        value={reportDetails}
                        onChange={(event) => setReportDetails(event.target.value)}
                        placeholder="Add any details that will help AZISTO review this job."
                        className="min-h-24 w-full resize-none rounded-[18px] border border-[var(--azisto-contractor-border)] bg-white px-3 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 az-focus-field"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleReportSubmit}
                      disabled={isSubmittingReport}
                      className="az-btn-danger-soft flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold"
                    >
                      {isSubmittingReport ? "Submitting..." : "Submit report"}
                    </button>
                  </div>
                ) : null}

                {reportMessage ? (
                  <p className="mt-3 whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                    {reportMessage}
                  </p>
                ) : null}
              </section>

              {interestMessage ? (
                <p
                  className={`mt-5 rounded-xl border px-4 py-3 text-sm leading-6 ${
                    interestMessage === "Interest submitted successfully"
                      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                      : "border-red-100 bg-red-50 text-red-700"
                  }`}
                >
                  {interestMessage}
                </p>
              ) : null}

              {lifecycleMessage ? (
                <p className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                  {lifecycleMessage}
                </p>
              ) : null}

              {job.status === "open" ? (
                <button
                  type="button"
                  onClick={handleInterestSubmit}
                  disabled={
                    isSubmittingInterest ||
                    hasSubmittedInterest ||
                    selectedTaskIds.length === 0
                  }
                  className="az-btn-contractor mt-6 flex h-14 w-full items-center justify-center rounded-full text-sm font-bold"
                >
                  {isSubmittingInterest
                    ? "Submitting..."
                    : hasSubmittedInterest
                      ? "Interest submitted"
                      : selectedTaskIds.length === 0
                        ? "Select at least one task"
                        : selectedTaskIds.length > 1
                        ? "Submit interest for selected tasks"
                        : "I\u2019m interested"}
                </button>
              ) : null}

              {job.status === "hired" ? (
                <button
                  type="button"
                  onClick={handleMarkInProgress}
                  disabled={isUpdatingStatus}
                  className="az-btn-contractor mt-6 flex h-14 w-full items-center justify-center rounded-full text-sm font-bold"
                >
                  {isUpdatingStatus ? "Updating..." : "Mark in progress"}
                </button>
              ) : null}

              {hasSubmittedInterest ||
              ["hired", "in_progress", "completed"].includes(job.status) ? (
                <button
                  type="button"
                  onClick={handleMessageCustomer}
                  disabled={isOpeningThread}
                  className="az-btn-contractor mt-3 flex h-14 w-full items-center justify-center rounded-full text-sm font-bold"
                >
                  {isOpeningThread ? "Opening conversation..." : "Message customer"}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        <BottomNav role="contractor" />
      </div>

      {isMessagePromptOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="message-customer-title"
        >
          <div className="az-contractor-card relative w-full max-w-[340px] p-5">
            <button
              type="button"
              onClick={() => setIsMessagePromptOpen(false)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
              aria-label="Close message prompt"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>

            <p
              id="message-customer-title"
              className="pr-10 text-lg font-bold leading-6 text-black"
            >
              Message customer?
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Your interest was submitted. You can now open the customer
              conversation for this job.
            </p>

            <button
              type="button"
              onClick={handleMessageCustomer}
              disabled={isOpeningThread}
              className="az-btn-contractor mt-5 flex h-12 w-full items-center justify-center rounded-full text-sm font-bold"
            >
              {isOpeningThread ? "Opening conversation..." : "Message customer"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
