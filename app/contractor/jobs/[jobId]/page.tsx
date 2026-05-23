"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ChevronLeft, Flag, MapPin } from "lucide-react";
import { auth } from "@/lib/firebase";
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

async function submitContractorInterest(user: User, jobId: string) {
  const token = await user.getIdToken();
  const response = await fetch(
    `/api/contractors/jobs/${encodeURIComponent(jobId)}/interest`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
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

async function createMessageThread(user: User, jobId: string) {
  const token = await user.getIdToken();
  const response = await fetch("/api/messages/threads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jobId,
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

  async function loadJob(user: User) {
    const jobDetails = await fetchContractorJob(user, jobId);
    setJob(jobDetails);
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
  }, [jobId, router]);

  async function handleInterestSubmit() {
    if (!currentUser || isSubmittingInterest || hasSubmittedInterest) {
      return;
    }

    try {
      setIsSubmittingInterest(true);
      setInterestMessage("");
      await submitContractorInterest(currentUser, jobId);
      setHasSubmittedInterest(true);
      setInterestMessage("Interest submitted successfully");
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
      const threadId = await createMessageThread(currentUser, jobId);
      router.push(`/messages/${encodeURIComponent(threadId)}`);
    } catch (error) {
      setInterestMessage(getErrorMessage(error));
    } finally {
      setIsOpeningThread(false);
    }
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
    <main className="min-h-screen bg-white text-black md:bg-slate-50 md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-slate-200">
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
            <p className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
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
              <section className="mt-8">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-500">
                  {job.jobId}
                </p>
                <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
                  {job.selectedServiceCategory || "Service request"}
                </h1>
                <p className="mt-3 flex items-center gap-2 text-sm leading-6 text-slate-600">
                  <MapPin aria-hidden="true" className="h-4 w-4" />
                  {[job.city, job.province].filter(Boolean).join(", ") ||
                    "Location not provided"}
                </p>
              </section>

              <section className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-black">Status</p>
                  <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold capitalize text-emerald-700">
                    {job.status || "open"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm leading-6">
                  <div>
                    <p className="font-bold text-black">Urgency</p>
                    <p className="text-slate-600">{job.urgency || "Flexible"}</p>
                  </div>
                  <div>
                    <p className="font-bold text-black">When</p>
                    <p className="text-slate-600">
                      {formatWhen(job.preferredDate, job.preferredTime)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-black">Customer</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {job.customerFirstName || "Customer"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-bold text-black">
                    Customer safety summary
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        job.customerEmailVerified
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-white text-slate-600"
                      }`}
                    >
                      {job.customerEmailVerified
                        ? "Email verified"
                        : "Email unverified"}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        job.customerPhoneVerified
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {job.customerPhoneVerified
                        ? "Phone verified"
                        : "Phone pending"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {job.customerCompletedJobsCount} completed jobs ·{" "}
                    {job.customerReportsCount} reports
                  </p>
                </div>
              </section>

              <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-black">Subcategories</p>
                {job.selectedSubcategories.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.selectedSubcategories.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    No subcategories listed.
                  </p>
                )}
              </section>

              <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-black">Job details</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {job.jobDescription || "No description provided."}
                </p>
              </section>

              <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-black">Service address</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {[job.address, job.city, job.province, job.postalCode]
                    .filter(Boolean)
                    .join(", ") || "Address not provided."}
                </p>
              </section>

              <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
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
                        className="min-h-24 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-50"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleReportSubmit}
                      disabled={isSubmittingReport}
                      className="flex h-12 w-full items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white shadow-lg shadow-red-100 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
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
                <p className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
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
                  disabled={isSubmittingInterest || hasSubmittedInterest}
                  className="mt-6 flex h-14 w-full items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white shadow-lg shadow-red-100 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                >
                  {isSubmittingInterest
                    ? "Submitting..."
                    : hasSubmittedInterest
                      ? "Interest submitted"
                      : "I\u2019m interested"}
                </button>
              ) : null}

              {job.status === "hired" ? (
                <button
                  type="button"
                  onClick={handleMarkInProgress}
                  disabled={isUpdatingStatus}
                  className="mt-6 flex h-14 w-full items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white shadow-lg shadow-red-100 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
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
                  className="mt-3 flex h-14 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {isOpeningThread ? "Opening conversation..." : "Message customer"}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        <BottomNav role="contractor" />
      </div>
    </main>
  );
}
