"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import BottomNav from "@/app/components/BottomNav";

type DashboardTab = "active" | "available" | "past";

type AvailableJob = {
  jobId: string;
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

type ContractorJob = {
  jobId: string;
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

async function submitInterest(user: User, jobId: string) {
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

async function createMessageThread(user: User, jobId: string) {
  const token = await user.getIdToken();
  const response = await fetch("/api/messages/threads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jobId }),
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
    <div className="mt-3 flex flex-wrap gap-2">
      {items.slice(0, 4).map((item) => (
        <span
          key={item}
          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
        <Briefcase aria-hidden="true" className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm font-bold text-black">{message}</p>
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

  async function handleInterest(jobId: string) {
    if (!currentUser || activeJobId || hasActiveJob) {
      return;
    }

    try {
      setActiveJobId(jobId);
      setErrorMessage("");
      setSuccessMessage("");
      await submitInterest(currentUser, jobId);
      await loadDashboard(currentUser);
      setSuccessMessage("Interest submitted successfully.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setActiveJobId("");
    }
  }

  async function handleMessage(jobId: string) {
    if (!currentUser || activeJobId) {
      return;
    }

    try {
      setActiveJobId(jobId);
      setErrorMessage("");
      const threadId = await createMessageThread(currentUser, jobId);
      router.push(`/messages/${encodeURIComponent(threadId)}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setActiveJobId("");
    }
  }

  async function handleMarkInProgress(jobId: string) {
    if (!currentUser || activeJobId) {
      return;
    }

    try {
      setActiveJobId(jobId);
      setErrorMessage("");
      setSuccessMessage("");
      await updateJobStatus(currentUser, jobId, "in_progress");
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
    { id: "available", label: "Available jobs", count: availableJobs.length },
    { id: "past", label: "Past jobs", count: pastJobs.length },
  ];

  return (
    <main className="min-h-screen bg-white text-black md:bg-slate-50 md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-slate-200">
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
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-500">
              Contractor workspace
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
              Contractor Dashboard
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Manage current work, browse open requests, and review completed
              jobs in one place.
            </p>
          </section>

          <div className="mt-5 grid grid-cols-3 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTab(tab.id)}
                className={`min-h-12 rounded-xl px-2 text-xs font-bold leading-tight ${
                  selectedTab === tab.id
                    ? "bg-white text-red-500 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                {tab.label}
                <span className="ml-1 text-[10px]">({tab.count})</span>
              </button>
            ))}
          </div>

          {hasActiveJob ? (
            <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
              Complete your active job before accepting a new one.
            </p>
          ) : null}

          {isLoading ? (
            <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
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
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-500">
                        {job.jobId}
                      </p>
                      <h2 className="mt-1 text-lg font-bold text-black">
                        {job.selectedServiceCategory || "Service request"}
                      </h2>
                    </div>
                    <span className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold capitalize text-red-500">
                      {job.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <SubcategoryList items={job.selectedSubcategories} />

                  <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                    <p>Customer: {job.customerFirstName || "Customer"}</p>
                    <p className="flex items-center gap-2">
                      <MapPin aria-hidden="true" className="h-4 w-4" />
                      {[job.city, job.province].filter(Boolean).join(", ") ||
                        "Location not provided"}
                    </p>
                    <p>
                      <span className="font-bold text-slate-800">When:</span>{" "}
                      {formatWhen(job.preferredDate, job.preferredTime)}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <button
                      type="button"
                      onClick={() => handleMessage(job.jobId)}
                      disabled={activeJobId === job.jobId}
                      className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <MessageCircle aria-hidden="true" className="h-4 w-4" />
                      Message customer
                    </button>
                    {job.status === "hired" ? (
                      <button
                        type="button"
                        onClick={() => handleMarkInProgress(job.jobId)}
                        disabled={activeJobId === job.jobId}
                        className="flex h-12 items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white shadow-lg shadow-red-100 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        Mark in progress
                      </button>
                    ) : null}
                    <Link
                      href={`/contractor/jobs/${encodeURIComponent(job.jobId)}`}
                      className="flex h-12 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-sm font-bold text-red-600"
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
              {availableJobs.length === 0 ? (
                <EmptyState message="No available jobs right now" />
              ) : null}

              {availableJobs.map((job) => (
                <article
                  key={job.jobId}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-500">
                        {job.jobId}
                      </p>
                      <h2 className="mt-1 text-lg font-bold text-black">
                        {job.selectedServiceCategory || "Service request"}
                      </h2>
                    </div>
                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold capitalize text-emerald-700">
                      {job.status || "open"}
                    </span>
                  </div>

                  <SubcategoryList items={job.selectedSubcategories} />

                  <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                    <p>Customer: {job.customerFirstName || "Customer"}</p>
                    <p className="flex items-center gap-2">
                      <MapPin aria-hidden="true" className="h-4 w-4" />
                      {[job.city, job.province].filter(Boolean).join(", ") ||
                        "Location not provided"}
                    </p>
                    <p>
                      <span className="font-bold text-slate-800">
                        Urgency:
                      </span>{" "}
                      {job.urgency || "Flexible"}
                    </p>
                    <p>
                      <span className="font-bold text-slate-800">When:</span>{" "}
                      {formatWhen(job.preferredDate, job.preferredTime)}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        job.customerEmailVerified
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
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

                  <div className="mt-4 grid gap-2">
                    <Link
                      href={`/contractor/jobs/${encodeURIComponent(job.jobId)}`}
                      className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900"
                    >
                      View job
                      <ChevronRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleInterest(job.jobId)}
                      disabled={hasActiveJob || activeJobId === job.jobId}
                      className="flex h-12 items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white shadow-lg shadow-red-100 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none"
                    >
                      {hasActiveJob
                        ? "Complete active job first"
                        : activeJobId === job.jobId
                          ? "Submitting..."
                          : "I’m interested"}
                    </button>
                  </div>
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
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-500">
                        {job.jobId}
                      </p>
                      <h2 className="mt-1 text-lg font-bold text-black">
                        {job.selectedServiceCategory || "Service request"}
                      </h2>
                    </div>
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold capitalize text-slate-700">
                      {job.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                    <p>Customer: {job.customerFirstName || "Customer"}</p>
                    <p>
                      <span className="font-bold text-slate-800">Updated:</span>{" "}
                      {formatDate(job.completedAt || job.cancelledAt || job.updatedAt)}
                    </p>
                    <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                      Review summary coming soon.
                    </p>
                  </div>

                  <Link
                    href={`/contractor/jobs/${encodeURIComponent(job.jobId)}`}
                    className="mt-4 flex h-12 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-sm font-bold text-red-600"
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
