"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Briefcase,
  CalendarDays,
  ChevronLeft,
  Clock3,
  MapPin,
  MessageCircle,
  RefreshCw,
  UserRound,
} from "lucide-react";
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
import { formatScheduleLabel, type JobSchedule } from "@/lib/jobSchedule";
import {
  getCompatibleLifecycleStatus,
  getJobStatusLabel,
} from "@/lib/jobStatus";
import { getCustomerStatusChipClass } from "@/lib/theme";
import BottomNav from "@/app/components/BottomNav";
import AppHeader from "@/app/components/AppHeader";
import AppShimmer from "@/app/components/AppShimmer";
import JobProofGallery from "@/app/components/JobProofGallery";
import type { JobProofPhoto } from "@/lib/jobProofPhotos";

type CustomerJob = {
  jobId: string;
  overallStatus?: string;
  requiresMultipleContractors?: boolean;
  taskCount?: number;
  selectedServiceCategory: string;
  selectedSubcategories: string[];
  city: string;
  province: string;
  scheduleMode: string;
  preferredDate: string;
  preferredTime: string;
  preferredTimeWindow: string;
  urgency: string;
  schedule: JobSchedule | null;
  status: string;
  contractorDecisionStatus?: string;
  hiredContractorId: string;
  hiredContractorName: string;
  hiredBusinessName: string;
  createdAt: string;
  beforePhotos: JobProofPhoto[];
  afterPhotos: JobProofPhoto[];
  reviewed: boolean;
  tasks?: CustomerJobTask[];
};

type CustomerJobTask = {
  taskId: string;
  parentJobId: string;
  category: string;
  subcategory: string;
  status: string;
  contractorDecisionStatus?: string;
  hiredContractorId: string;
  hiredContractorAuthUid: string;
  beforePhotos: JobProofPhoto[];
  afterPhotos: JobProofPhoto[];
  reviewed: boolean;
  createdAt: string;
};

type JobTab = "active" | "open" | "past";

const activeJobStatuses = new Set([
  "accepted",
  "hired",
  "on_the_way",
  "in_progress",
  "partially_active",
  "partially_in_progress",
]);

const openJobStatuses = new Set([
  "open",
  "partially_hired",
  "hired_pending_contractor",
  "pending_contractor_acceptance",
]);

const pastJobStatuses = new Set([
  "completed",
  "cancelled",
  "rejected",
  "expired",
]);

function createApiError(_code: string, message: string) {
  return new Error(message);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load your jobs.";
}

function formatDate(value: string) {
  if (!value) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function getCustomerLifecycleStatus(job: CustomerJob) {
  const taskStatuses = job.tasks?.map((task) => task.status) ?? [];
  const priority = [
    "in_progress",
    "on_the_way",
    "accepted",
    "hired",
    "hired_pending_contractor",
  ];

  return (
    priority.find((status) => taskStatuses.includes(status)) ||
    job.status ||
    "open"
  );
}

function isAcceptedStatus(status: string) {
  const compatibleStatus = getCompatibleLifecycleStatus(status);

  return ["accepted", "hired", "on_the_way", "in_progress"].includes(
    compatibleStatus,
  );
}

function canCancelStatus(status: string) {
  const compatibleStatus = getCompatibleLifecycleStatus(status);

  return (
    compatibleStatus === "open" ||
    compatibleStatus === "hired_pending_contractor"
  );
}

function getJobTab(job: CustomerJob): JobTab {
  const statuses = [
    ...(job.tasks?.map((task) => task.status) ?? []),
    job.overallStatus,
    job.status,
  ]
    .filter((status): status is string => Boolean(status))
    .map((status) => getCompatibleLifecycleStatus(status));

  if (statuses.some((status) => activeJobStatuses.has(status))) {
    return "active";
  }

  if (statuses.some((status) => openJobStatuses.has(status))) {
    return "open";
  }

  if (statuses.some((status) => pastJobStatuses.has(status))) {
    return "past";
  }

  return "open";
}

async function fetchCustomerJobs(
  user: User,
  source: "page-open" | "interval" | "manual" | "focus",
) {
  console.log(
    `[${new Date().toISOString()}] CUSTOMER JOBS FETCH source: ${source}`,
  );
  const response = await authenticatedFetch(user, "/api/customers/jobs");
  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
    jobs?: unknown;
  } | null;

  if (!response.ok) {
    await throwApiResponseError(
      response,
      typeof responseBody?.message === "string"
        ? responseBody.message
        : response.statusText,
    );
  }

  return Array.isArray(responseBody?.jobs)
    ? (responseBody.jobs as CustomerJob[])
    : [];
}

async function updateJobStatus(
  user: User,
  jobId: string,
  status: string,
  taskId?: string,
) {
  const token = await user.getIdToken();
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status, taskId }),
  });
  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
    status?: unknown;
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

  return responseBody;
}

async function createMessageThread(user: User, job: CustomerJob) {
  const token = await user.getIdToken();
  const response = await fetch("/api/messages/threads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jobId: job.jobId,
      contractorId: job.hiredContractorId,
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

export default function CustomerJobsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<CustomerJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeJobId, setActiveJobId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [refreshWarning, setRefreshWarning] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<JobTab>("active");
  const isJobsRequestInFlightRef = useRef(false);
  const jobsRetryAfterRef = useRef(0);
  const hasSelectedInitialTabRef = useRef(false);

  async function loadJobs(
    user: User,
    source: "page-open" | "interval" | "manual" | "focus",
    isBackgroundRefresh = false,
  ) {
    if (
      isJobsRequestInFlightRef.current ||
      jobsRetryAfterRef.current > Date.now()
    ) {
      return;
    }

    isJobsRequestInFlightRef.current = true;

    try {
      const customerJobs = await fetchCustomerJobs(user, source);
      setJobs(customerJobs);
      setRefreshWarning("");
      jobsRetryAfterRef.current = 0;

      if (!hasSelectedInitialTabRef.current) {
        const hasActiveJobs = customerJobs.some(
          (job) => getJobTab(job) === "active",
        );
        setSelectedTab(hasActiveJobs ? "active" : "open");
        hasSelectedInitialTabRef.current = true;
      }
    } catch (error) {
      if (
        isQuotaExceededError(error) ||
        isQuotaExceededMessage(
          error instanceof Error ? error.message : String(error),
        )
      ) {
        jobsRetryAfterRef.current = Date.now() + 10 * 60_000;
      }

      if (isBackgroundRefresh) {
        setRefreshWarning("Status updates paused. Retrying soon.");
        return;
      }

      throw error;
    } finally {
      isJobsRequestInFlightRef.current = false;
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Customer jobs auth state loaded");
      if (!user) {
        console.log("Customer jobs redirect reason: no signed-in user");
        router.replace("/login");
        return;
      }

      console.log("Customer jobs current uid:", user.uid);
      setCurrentUser(user);

      try {
        setIsLoading(true);
        setErrorMessage("");
        const profile = await fetchSessionProfile(user);
        console.log("Customer jobs role API result:", profile);

        if (profile.role !== "customer") {
          console.log("Customer jobs redirect reason:", `role:${profile.role}`);
          setErrorMessage("Please use a user account to view your jobs.");
          return;
        }

        await loadJobs(user, "page-open");
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

    const refreshVisibleJobs = (
      source: "interval" | "focus",
    ) => {
      if (!document.hidden) {
        void loadJobs(currentUser, source, true);
      }
    };
    const intervalId = window.setInterval(
      () => refreshVisibleJobs("interval"),
      120_000,
    );
    const handleFocus = () => refreshVisibleJobs("focus");

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [currentUser]);

  async function handleManualRefresh() {
    if (!currentUser || isRefreshing) {
      return;
    }

    try {
      setIsRefreshing(true);
      setRefreshWarning("");
      await loadJobs(currentUser, "manual");
    } catch (error) {
      setRefreshWarning("Status updates paused. Retrying soon.");
      console.error("Customer job refresh failed:", error);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleCancelJob(job: CustomerJob, task?: CustomerJobTask) {
    if (!currentUser || activeJobId) {
      return;
    }

    const lifecycleStatus = task?.status || getCustomerLifecycleStatus(job);
    const compatibleStatus =
      lifecycleStatus === "hired" ? "accepted" : lifecycleStatus;

    if (isAcceptedStatus(compatibleStatus)) {
      setErrorMessage(
        "This contractor has already accepted your job. Please contact the contractor directly to discuss cancellation.",
      );
      return;
    }

    try {
      setActiveJobId(task?.taskId || job.jobId);
      setErrorMessage("");
      setSuccessMessage("");
      await updateJobStatus(
        currentUser,
        job.jobId,
        "cancelled",
        task?.taskId,
      );
      await loadJobs(currentUser, "manual");
      setSuccessMessage(task ? "Task cancelled." : "Job cancelled.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setActiveJobId("");
    }
  }

  async function handleOpenMessages(job: CustomerJob) {
    if (!currentUser || activeJobId) {
      return;
    }

    if (!job.hiredContractorId) {
      router.push("/messages");
      return;
    }

    try {
      setActiveJobId(job.jobId);
      setErrorMessage("");
      const threadId = await createMessageThread(currentUser, job);
      router.push(`/messages/${encodeURIComponent(threadId)}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setActiveJobId("");
    }
  }

  const tabCounts = jobs.reduce(
    (counts, job) => {
      counts[getJobTab(job)] += 1;
      return counts;
    },
    { active: 0, open: 0, past: 0 } as Record<JobTab, number>,
  );
  const visibleJobs = jobs.filter((job) => getJobTab(job) === selectedTab);
  const tabs: Array<{ key: JobTab; label: string }> = [
    { key: "active", label: "Active" },
    { key: "open", label: "Open" },
    { key: "past", label: "Past" },
  ];

  return (
    <main className="az-customer-shell min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex h-screen min-h-0 w-full max-w-[390px] flex-col bg-white shadow-none md:h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <div className="azisto-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-24 pt-5">
          <AppHeader
            leftControl={
              <button
                type="button"
                onClick={() => router.back()}
                className="flex h-10 w-10 items-center justify-center rounded-full text-black"
                aria-label="Go back"
              >
                <ChevronLeft aria-hidden="true" className="h-5 w-5" />
              </button>
            }
          />

          <section className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] az-kicker">
              User jobs
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
              My jobs
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Track requests, hire contractors, message, and manage job status.
            </p>
          </section>

          <section className="mt-5">
            <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[#E5E7EB] bg-[#F3F4F6] p-1.5 shadow-sm">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedTab(tab.key)}
                  className={`flex h-11 items-center justify-center gap-1 rounded-xl text-xs font-bold transition duration-200 ${
                    selectedTab === tab.key
                      ? "bg-[#1F1F1F] text-white shadow-md shadow-slate-300"
                      : "bg-white text-slate-700"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      selectedTab === tab.key
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-[#2563EB]"
                    }`}
                  >
                    {tabCounts[tab.key]}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void handleManualRefresh()}
              disabled={isRefreshing}
              className="az-btn-secondary mt-3 flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold"
            >
              <RefreshCw
                aria-hidden="true"
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              {isRefreshing ? "Refreshing..." : "Refresh status"}
            </button>
          </section>

          {isLoading ? (
            <AppShimmer className="mt-6" rows={3} />
          ) : null}

          {errorMessage ? (
            <p className="mt-6 whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
              {successMessage}
            </p>
          ) : null}

          {refreshWarning ? (
            <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {refreshWarning}
            </p>
          ) : null}

          {!isLoading && !errorMessage && jobs.length === 0 ? (
            <section className="mt-6 rounded-xl border border-azisto-border bg-white p-5 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-azisto-text">
                <Briefcase aria-hidden="true" className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-bold text-black">No jobs yet</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Posted requests will appear here.
              </p>
            </section>
          ) : null}

          {!isLoading && !errorMessage && jobs.length > 0 && visibleJobs.length === 0 ? (
            <section className="mt-6 rounded-xl border border-blue-100 bg-blue-50/40 p-5 text-center">
              <p className="text-sm font-bold text-slate-900">
                No {selectedTab} jobs
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Jobs will appear here when their status changes.
              </p>
            </section>
          ) : null}

          <section className="mt-6 space-y-4">
            {visibleJobs.map((job) => (
              <article
                key={job.jobId}
                className="az-customer-job-card rounded-[22px] border bg-white px-4 py-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] az-job-id">
                      {job.jobId}
                    </p>
                    <h2 className="mt-1 text-xl font-bold leading-tight text-black">
                      {job.selectedServiceCategory || "Service request"}
                    </h2>
                  </div>
                  <span
                    className={getCustomerStatusChipClass(
                      job.overallStatus || job.status || "open",
                    )}
                  >
                    {getJobStatusLabel(
                      job.overallStatus || job.status || "open",
                    )}
                  </span>
                </div>

                {job.tasks && job.tasks.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {job.tasks.map((task) => (
                      <div
                        key={task.taskId}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                      >
                        <span className="truncate">
                          {task.subcategory || task.category || "Task"}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {getJobStatusLabel(task.status || "open")}
                        </span>
                        {canCancelStatus(task.status) ? (
                          <button
                            type="button"
                            onClick={() => handleCancelJob(job, task)}
                            disabled={activeJobId === task.taskId}
                            className="ml-0.5 text-[10px] font-bold text-red-600 disabled:opacity-50"
                            aria-label={`Cancel ${
                              task.subcategory || task.category || "task"
                            }`}
                          >
                            Cancel
                          </button>
                        ) : task.status === "completed" ? (
                          task.reviewed ? (
                            <span className="text-[10px] font-bold text-emerald-700">
                              Reviewed
                            </span>
                          ) : (
                            <Link
                              href={`/customer/jobs/${encodeURIComponent(
                                job.jobId,
                              )}/review?taskId=${encodeURIComponent(task.taskId)}`}
                              className="text-[10px] font-bold text-black underline"
                            >
                              Review
                            </Link>
                          )
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : job.selectedSubcategories.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {job.selectedSubcategories.slice(0, 3).map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 space-y-2 text-sm leading-5 text-slate-600">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <p className="flex items-center gap-2">
                      <MapPin
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-black"
                      />
                      {[job.city, job.province].filter(Boolean).join(", ")}
                    </p>
                    {job.hiredContractorId ? (
                      <p className="flex min-w-0 items-center gap-2">
                        <UserRound
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-black"
                        />
                        <span className="truncate">
                          {job.hiredBusinessName ||
                            job.hiredContractorName ||
                            job.hiredContractorId}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  <p className="flex items-center gap-2">
                    <CalendarDays
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-black"
                    />
                    {formatScheduleLabel(job)}
                  </p>
                  <p className="flex items-center gap-2 text-xs">
                    <Clock3
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 text-black"
                    />
                    Posted {formatDate(job.createdAt)}
                  </p>
                </div>

                <JobProofGallery
                  beforePhotos={job.beforePhotos}
                  afterPhotos={job.afterPhotos}
                  tasks={job.tasks}
                />

                <div className="mt-3 grid gap-2 border-t border-[var(--azisto-customer-border)] pt-3">
                  {(job.status === "open" ||
                    job.overallStatus === "partially_hired") ? (
                    <Link
                      href={`/customer/jobs/${encodeURIComponent(
                        job.jobId,
                      )}/interested`}
                      className="az-btn-primary flex h-11 items-center justify-center rounded-xl text-sm font-bold"
                    >
                      View interested contractors
                    </Link>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => handleOpenMessages(job)}
                    disabled={activeJobId === job.jobId}
                    className="az-btn-secondary flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold"
                  >
                    <MessageCircle aria-hidden="true" className="h-4 w-4" />
                    View messages
                  </button>

                  {(!job.tasks || job.tasks.length === 0) &&
                  canCancelStatus(getCustomerLifecycleStatus(job)) ? (
                    <button
                      type="button"
                      onClick={() => handleCancelJob(job)}
                      disabled={activeJobId === job.jobId}
                      className="az-btn-danger-soft flex h-11 items-center justify-center rounded-xl text-sm font-bold"
                    >
                      Cancel job
                    </button>
                  ) : null}

                  {isAcceptedStatus(getCustomerLifecycleStatus(job)) ? (
                    <>
                      <button
                        type="button"
                        disabled
                        className="flex h-11 cursor-not-allowed items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-sm font-bold text-slate-400"
                      >
                        Cancel job
                      </button>
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-700">
                        This contractor has already accepted your job. Please
                        contact the contractor directly to discuss cancellation.
                      </p>
                    </>
                  ) : null}

                  {job.status === "completed" &&
                  (!job.tasks || job.tasks.length === 0) ? (
                    <>
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                        Completed jobs cannot be cancelled. You can leave a
                        review or contact support.
                      </p>
                      {job.reviewed ? (
                        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center text-sm font-bold text-emerald-700">
                          Review submitted
                        </p>
                      ) : (
                        <Link
                          href={`/customer/jobs/${encodeURIComponent(
                            job.jobId,
                          )}/review`}
                          className="az-btn-primary flex h-11 items-center justify-center rounded-xl text-sm font-bold"
                        >
                          Leave review
                        </Link>
                      )}
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        </div>
        <BottomNav role="customer" />
      </div>
    </main>
  );
}
