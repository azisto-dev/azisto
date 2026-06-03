"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Briefcase,
  ChevronLeft,
  MessageCircle,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import BottomNav from "@/app/components/BottomNav";

type DashboardTab = "active" | "available" | "past";

type AvailableJob = {
  jobId: string;
  parentJobId?: string;
  taskId?: string;
  customerFirstName: string;
  customerEmailVerified: boolean;
  customerPhoneVerified: boolean;
  customerCompletedJobsCount: number;
  customerReportsCount: number;
  selectedServiceCategory: string;
  selectedSubcategories: string[];
  city: string;
  province: string;
  urgency: string;
  preferredDate: string;
  preferredTime: string;
  status: string;
  matchingStatus: string;
};

type AvailableJobTask = {
  taskId: string;
  label: string;
};

type AvailableJobCard = AvailableJob & {
  jobId: string;
  taskIds: string[];
  taskLabels: string[];
  tasks: AvailableJobTask[];
};

type ContractorJob = {
  jobId: string;
  parentJobId?: string;
  taskId?: string;
  customerFirstName: string;
  customerId: string;
  selectedServiceCategory: string;
  selectedSubcategories: string[];
  city: string;
  province: string;
  preferredDate: string;
  preferredTime: string;
  urgency: string;
  status: string;
  matchingStatus: string;
  hiredContractorId: string;
  hiredBusinessName: string;
  relationship: string;
  completedAt: string;
  cancelledAt: string;
  updatedAt: string;
};

function groupAvailableJobs(jobs: AvailableJob[]) {
  const groupedJobs = new Map<string, AvailableJobCard>();

  jobs.forEach((job) => {
    const parentJobId = job.parentJobId || job.jobId;
    const taskLabel =
      job.selectedSubcategories[0] ||
      job.selectedServiceCategory ||
      job.taskId ||
      "Task";
    const existingJob = groupedJobs.get(parentJobId);

    if (!existingJob) {
      groupedJobs.set(parentJobId, {
        ...job,
        jobId: parentJobId,
        parentJobId: undefined,
        taskIds: job.taskId ? [job.taskId] : [],
        taskLabels: [taskLabel],
        tasks: job.taskId
          ? [{ taskId: job.taskId, label: taskLabel }]
          : job.selectedSubcategories.map((subcategory) => ({
              taskId: "",
              label: subcategory,
            })),
        selectedSubcategories: [taskLabel],
      });
      return;
    }

    if (job.taskId && !existingJob.taskIds.includes(job.taskId)) {
      existingJob.taskIds.push(job.taskId);
      existingJob.tasks.push({ taskId: job.taskId, label: taskLabel });
    }

    if (!existingJob.taskLabels.includes(taskLabel)) {
      existingJob.taskLabels.push(taskLabel);
      existingJob.selectedSubcategories.push(taskLabel);
    }
  });

  return Array.from(groupedJobs.values());
}

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
  return error instanceof Error ? error.message : "Unable to load dashboard.";
}

function formatWhen(date: string, time: string) {
  if (!date && !time) {
    return "Flexible timing";
  }

  return [date, time].filter(Boolean).join(" at ");
}

function formatDate(value: string) {
  if (!value) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

async function fetchAvailableJobs(user: User) {
  const token = await user.getIdToken();
  const response = await fetch("/api/contractors/jobs", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
    jobs?: unknown;
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

  return Array.isArray(responseBody?.jobs)
    ? (responseBody.jobs as AvailableJob[])
    : [];
}

async function fetchContractorJobs(user: User) {
  const token = await user.getIdToken();
  const response = await fetch("/api/contractors/my-jobs", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
    jobs?: unknown;
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

  return Array.isArray(responseBody?.jobs)
    ? (responseBody.jobs as ContractorJob[])
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

async function createMessageThread(user: User, job: ContractorJob) {
  const parentJobId = job.parentJobId || job.jobId;
  const token = await user.getIdToken();
  const response = await fetch("/api/messages/threads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jobId: parentJobId,
      selectedTaskIds: job.taskId ? [job.taskId] : [],
      selectedTaskLabels: job.taskId
        ? [job.selectedSubcategories[0] || job.selectedServiceCategory || job.taskId]
        : [],
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

function SubcategoryList({ items }: { items: string[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.slice(0, 4).map((item) => (
        <span
          key={item}
          className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <section className="az-contractor-card mt-6 p-5 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--azisto-contractor-burgundy)]">
        <Briefcase aria-hidden="true" className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm font-bold text-[var(--azisto-contractor-text)]">{message}</p>
    </section>
  );
}

export default function ContractorDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedTab, setSelectedTab] = useState<DashboardTab>("active");
  const [availableJobs, setAvailableJobs] = useState<AvailableJob[]>([]);
  const [contractorJobs, setContractorJobs] = useState<ContractorJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeJobId, setActiveJobId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const activeJobs = useMemo(
    () =>
      contractorJobs.filter(
        (job) =>
          job.relationship === "hired" &&
          ["hired", "in_progress"].includes(job.status),
      ),
    [contractorJobs],
  );
  const pastJobs = useMemo(
    () =>
      contractorJobs.filter(
        (job) =>
          job.relationship === "hired" &&
          ["completed", "cancelled"].includes(job.status),
      ),
    [contractorJobs],
  );
  const availableJobCards = useMemo(
    () => groupAvailableJobs(availableJobs),
    [availableJobs],
  );
  const hasActiveJob = activeJobs.length > 0;

  async function loadDashboard(user: User) {
    const [nextAvailableJobs, nextContractorJobs] = await Promise.all([
      fetchAvailableJobs(user),
      fetchContractorJobs(user),
    ]);
    setAvailableJobs(nextAvailableJobs);
    setContractorJobs(nextContractorJobs);
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
        await loadDashboard(user);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

  async function handleMessage(job: ContractorJob) {
    if (!currentUser || activeJobId) {
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

  async function handleMarkInProgress(job: ContractorJob) {
    if (!currentUser || activeJobId) {
      return;
    }

    const parentJobId = job.parentJobId || job.jobId;

    try {
      setActiveJobId(job.jobId);
      setErrorMessage("");
      setSuccessMessage("");
      await updateJobStatus(currentUser, parentJobId, "in_progress", job.taskId);
      await loadDashboard(currentUser);
      setSuccessMessage("Job marked in progress.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setActiveJobId("");
    }
  }

  const tabs: Array<{ id: DashboardTab; label: string; count: number }> = [
    { id: "active", label: "Active jobs", count: activeJobs.length },
    { id: "available", label: "Available jobs", count: availableJobCards.length },
    { id: "past", label: "Past jobs", count: pastJobs.length },
  ];

  return (
    <main className="az-contractor-shell min-h-screen md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-[var(--azisto-contractor-bg)] shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-[var(--azisto-contractor-border)]">
        <div className="flex-1 px-5 pb-6 pt-5">
          <StatusBar />

          <header className="mt-3 grid grid-cols-[40px_1fr_40px] items-center">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-10 w-10 items-center justify-center rounded-full text-black"
              aria-label="Go back"
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            </button>

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
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--azisto-contractor-burgundy)]">
              Contractor workspace
            </p>
            <h1 className="mt-1 text-3xl font-normal leading-tight text-[var(--azisto-contractor-text)]">
              Contractor Dashboard
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
              Manage current work, browse open requests, and review completed
              jobs in one place.
            </p>
          </section>

          <div className="az-contractor-card mt-5 grid grid-cols-3 gap-1 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTab(tab.id)}
                className={`min-h-12 rounded-[18px] border px-2 text-xs font-bold leading-tight transition ${
                  selectedTab === tab.id
                    ? "border-[rgb(138_15_77_/_0.28)] bg-[rgb(138_15_77_/_0.08)] text-[var(--azisto-contractor-burgundy)] shadow-sm"
                    : "border-transparent bg-transparent text-[var(--azisto-contractor-muted)]"
                }`}
              >
                {tab.label}
                <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--azisto-contractor-burgundy)] px-1.5 py-0.5 text-[10px] text-white">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {hasActiveJob ? (
            <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
              Complete your active job before accepting a new one.
            </p>
          ) : null}

          {isLoading ? (
            <p className="mt-6 rounded-xl border border-azisto-border bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              Loading contractor dashboard...
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-5 whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
              {successMessage}
            </p>
          ) : null}

          {selectedTab === "active" && !isLoading ? (
            <section className="mt-6 space-y-4">
              {activeJobs.length === 0 ? (
                <EmptyState message="No active jobs yet" />
              ) : null}

              {activeJobs.map((job) => (
                <article
                  key={job.jobId}
                  className="az-contractor-card-compact az-contractor-job-card px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-semibold leading-5 text-[var(--azisto-contractor-text)]">
                        {job.selectedServiceCategory || "Service request"}
                      </h2>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--azisto-contractor-burgundy)]">
                        {job.taskId || job.jobId}
                      </p>
                      {job.parentJobId ? (
                        <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                          Parent job: {job.parentJobId}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-right text-[13px] font-semibold capitalize leading-5 text-[var(--azisto-contractor-text)] shadow-sm">
                      {[job.city, job.province].filter(Boolean).join(", ") ||
                        "Location pending"}
                    </span>
                  </div>

                  <SubcategoryList items={job.selectedSubcategories} />

                  <div className="mt-2 space-y-1 text-[11px] font-semibold text-[var(--azisto-contractor-muted)]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate">
                        Customer: {job.customerFirstName || "Customer"}
                      </p>
                      <p className="shrink-0 text-right capitalize">
                        {job.status.replaceAll("_", " ")}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate">
                        {job.urgency || "Flexible"}
                      </p>
                      <p className="shrink-0 text-right">
                        {formatWhen(job.preferredDate, job.preferredTime)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 grid gap-2">
                    <button
                      type="button"
                      onClick={() => handleMessage(job)}
                      disabled={activeJobId === job.jobId}
                      className="az-btn-contractor flex h-10 items-center justify-center gap-2 rounded-full text-xs font-bold"
                    >
                      <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />
                      Message customer
                    </button>
                    {job.status === "hired" ? (
                      <button
                        type="button"
                        onClick={() => handleMarkInProgress(job)}
                        disabled={activeJobId === job.jobId}
                        className="az-btn-contractor flex h-10 items-center justify-center rounded-full text-xs font-bold"
                      >
                        Mark in progress
                      </button>
                    ) : null}
                    <Link
                      href={`/contractor/jobs/${encodeURIComponent(
                        job.parentJobId || job.jobId,
                      )}${job.taskId ? `?taskId=${encodeURIComponent(job.taskId)}` : ""}`}
                      className="az-btn-contractor-outline flex h-10 items-center justify-center rounded-full text-xs font-bold"
                    >
                      View details
                    </Link>
                  </div>
                </article>
              ))}
            </section>
          ) : null}

          {selectedTab === "available" && !isLoading ? (
            <section className="mt-6 space-y-4">
              {availableJobCards.length === 0 ? (
                <EmptyState message="No available jobs right now" />
              ) : null}

              {availableJobCards.map((job) => (
                <article
                  key={job.jobId}
                  className="az-contractor-card-compact az-contractor-job-card px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-semibold leading-5 text-[var(--azisto-contractor-text)]">
                        {job.selectedServiceCategory || "Service request"}
                      </h2>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--azisto-contractor-burgundy)]">
                        {job.jobId}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-right text-[13px] font-semibold capitalize leading-5 text-[var(--azisto-contractor-text)] shadow-sm">
                      {[job.city, job.province].filter(Boolean).join(", ") ||
                        "Location pending"}
                    </span>
                  </div>

                  {job.tasks.length > 0 ? (
                    <div className="az-contractor-task-panel mt-2 space-y-1 rounded-2xl bg-[rgb(248_247_252_/_0.9)] p-1.5">
                      {job.tasks.map((task, index) => (
                        <div
                          key={task.taskId || `${job.jobId}-${task.label}`}
                          className="flex items-center justify-between gap-2 rounded-xl border border-[var(--azisto-contractor-border)] bg-white px-2 py-1"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--azisto-contractor-burgundy)]">
                            {task.taskId || `Task ${index + 1}`}
                          </span>
                          <span className="text-[11px] font-bold text-slate-800">
                            {task.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <SubcategoryList items={job.selectedSubcategories} />
                  )}

                  <div className="mt-2 space-y-1 text-[11px] font-semibold text-[var(--azisto-contractor-muted)]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate">
                        Customer: {job.customerFirstName || "Customer"}
                      </p>
                      <p className="shrink-0 text-right capitalize">
                        {job.urgency || "Flexible"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate capitalize">
                        {job.status || "open"}
                      </p>
                      <p className="shrink-0 text-right">
                        {formatWhen(job.preferredDate, job.preferredTime)}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/contractor/jobs/${encodeURIComponent(job.jobId)}`}
                    className="az-btn-contractor mt-3 flex h-10 items-center justify-center rounded-full text-xs font-bold"
                  >
                    View job
                  </Link>
                </article>
              ))}
            </section>
          ) : null}

          {selectedTab === "past" && !isLoading ? (
            <section className="mt-6 space-y-4">
              {pastJobs.length === 0 ? (
                <EmptyState message="No past jobs yet" />
              ) : null}

              {pastJobs.map((job) => (
                <article
                  key={job.jobId}
                  className="az-contractor-card-compact az-contractor-job-card px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-semibold leading-5 text-[var(--azisto-contractor-text)]">
                        {job.selectedServiceCategory || "Service request"}
                      </h2>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--azisto-contractor-burgundy)]">
                        {job.jobId}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-right text-[13px] font-semibold capitalize leading-5 text-[var(--azisto-contractor-text)] shadow-sm">
                      {[job.city, job.province].filter(Boolean).join(", ") ||
                        "Location pending"}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1 text-[11px] font-semibold text-[var(--azisto-contractor-muted)]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate">
                        Customer: {job.customerFirstName || "Customer"}
                      </p>
                      <p className="shrink-0 text-right capitalize">
                        {job.status.replaceAll("_", " ")}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate">Updated</p>
                      <p className="shrink-0 text-right">
                        {formatDate(job.completedAt || job.cancelledAt || job.updatedAt)}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/contractor/jobs/${encodeURIComponent(job.jobId)}`}
                    className="az-btn-contractor mt-3 flex h-10 items-center justify-center rounded-full text-xs font-bold"
                  >
                    View details
                  </Link>
                </article>
              ))}
            </section>
          ) : null}
        </div>
        <BottomNav role="contractor" />
      </div>
    </main>
  );
}
