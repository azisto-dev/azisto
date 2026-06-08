"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { auth } from "@/lib/firebase";
import { formatScheduleLabel, type JobSchedule } from "@/lib/jobSchedule";
import {
  getCompatibleLifecycleStatus,
  getJobStatusLabel,
} from "@/lib/jobStatus";
import { getStatusChipClass } from "@/lib/theme";
import BottomNav from "@/app/components/BottomNav";
import NotificationBell from "@/app/components/NotificationBell";
import JobProofGallery from "@/app/components/JobProofGallery";
import type { JobProofPhoto } from "@/lib/jobProofPhotos";

type ActiveJob = {
  jobId: string;
  overallStatus?: string;
  selectedServiceCategory: string;
  selectedSubcategories: string[];
  hiredContractorId: string;
  hiredBusinessName: string;
  hiredContractorName: string;
  status: string;
  scheduleMode: string;
  preferredDate: string;
  preferredTime: string;
  preferredTimeWindow: string;
  urgency: string;
  schedule: JobSchedule | null;
  beforePhotos: JobProofPhoto[];
  afterPhotos: JobProofPhoto[];
  tasks?: Array<{
    status: string;
    beforePhotos?: JobProofPhoto[];
    afterPhotos?: JobProofPhoto[];
  }>;
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

async function fetchActiveJobs(user: User) {
  const token = await user.getIdToken();
  const response = await fetch("/api/customers/jobs", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json().catch(() => null)) as {
    jobs?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(typeof body?.message === "string" ? body.message : "Unable to load jobs.");
  }

  if (!Array.isArray(body?.jobs)) {
    return [];
  }

  return (body.jobs as ActiveJob[]).filter((job) => {
    const statuses = [
      ...(job.tasks?.map((task) => task.status) ?? []),
      job.overallStatus,
      job.status,
    ]
      .filter((status): status is string => Boolean(status))
      .map((status) => getCompatibleLifecycleStatus(status));

    return statuses.some((status) =>
      [
        "accepted",
        "hired",
        "on_the_way",
        "in_progress",
        "partially_active",
        "partially_in_progress",
      ].includes(status),
    );
  });
}

async function updateStatus(
  user: User,
  jobId: string,
  status: string,
) {
  const token = await user.getIdToken();
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(typeof body?.message === "string" ? body.message : "Unable to update job.");
  }

  return body;
}

async function openThread(user: User, job: ActiveJob) {
  const token = await user.getIdToken();
  const response = await fetch("/api/messages/threads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jobId: job.jobId, contractorId: job.hiredContractorId }),
  });
  const body = (await response.json().catch(() => null)) as {
    threadId?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(typeof body?.message === "string" ? body.message : "Unable to open messages.");
  }

  return typeof body?.threadId === "string" ? body.threadId : "";
}

export default function CustomerActiveJobsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [activeJobId, setActiveJobId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshWarning, setRefreshWarning] = useState("");
  const isJobsRequestInFlightRef = useRef(false);

  async function loadJobs(currentUser: User, isBackgroundRefresh = false) {
    if (isJobsRequestInFlightRef.current) {
      return;
    }

    isJobsRequestInFlightRef.current = true;

    try {
      setJobs(await fetchActiveJobs(currentUser));
      setRefreshWarning("");
    } catch (error) {
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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);

      try {
        setIsLoading(true);
        setErrorMessage("");
        await loadJobs(currentUser);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load jobs.");
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const refreshVisibleJobs = () => {
      if (document.visibilityState === "visible") {
        void loadJobs(user, true);
      }
    };
    const intervalId = window.setInterval(refreshVisibleJobs, 60000);

    window.addEventListener("focus", refreshVisibleJobs);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshVisibleJobs);
    };
  }, [user]);

  async function handleCancel(job: ActiveJob) {
    if (!user) return;
    const compatibleStatus = getCompatibleLifecycleStatus(job.status);

    if (
      ["accepted", "on_the_way", "in_progress"].includes(compatibleStatus)
    ) {
      setErrorMessage(
        "This contractor has already accepted your job. Please contact the contractor directly to discuss cancellation.",
      );
      return;
    }

    try {
      setActiveJobId(job.jobId);
      setErrorMessage("");
      await updateStatus(user, job.jobId, "cancelled");
      await loadJobs(user);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update job.",
      );
    } finally {
      setActiveJobId("");
    }
  }

  async function handleMessage(job: ActiveJob) {
    if (!user) return;
    try {
      setActiveJobId(job.jobId);
      const threadId = await openThread(user, job);
      router.push(`/messages/${encodeURIComponent(threadId)}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open messages.");
    } finally {
      setActiveJobId("");
    }
  }

  return (
    <main className="min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex h-screen min-h-0 w-full max-w-[390px] flex-col bg-white shadow-none md:h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <div className="azisto-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-24 pt-5">
          <StatusBar />
          <header className="mt-3 grid grid-cols-[40px_1fr_40px] items-center">
            <button type="button" onClick={() => router.push("/customer/jobs")} className="flex h-10 w-10 items-center justify-center rounded-full text-black" aria-label="Back to jobs">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <Link href="/home" className="flex justify-center">
              <img src="/azisto-logo-cropped.png" alt="AZISTO" className="w-full max-w-[165px] object-contain" />
            </Link>
            <NotificationBell />
          </header>
          <section className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] az-kicker">User jobs</p>
            <h1 className="mt-1 text-3xl font-bold leading-tight">Active jobs</h1>
          </section>
          {isLoading ? <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Loading active jobs...</p> : null}
          {errorMessage ? <p className="mt-6 whitespace-pre-line rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p> : null}
          {refreshWarning ? (
            <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              {refreshWarning}
            </p>
          ) : null}
          <section className="mt-6 space-y-4">
            {jobs.map((job) => (
              <article key={job.jobId} className="rounded-xl border border-azisto-primary bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] az-job-id">{job.jobId}</p>
                    <h2 className="mt-1 text-lg font-bold">{job.selectedServiceCategory || "Service request"}</h2>
                  </div>
                  <span className={getStatusChipClass(job.status)}>
                    {getJobStatusLabel(job.status)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600">Contractor: {job.hiredBusinessName || job.hiredContractorName || job.hiredContractorId}</p>
                <p className="mt-1 text-sm text-slate-600">{formatScheduleLabel(job)}</p>
                {job.selectedSubcategories.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.selectedSubcategories.slice(0, 3).map((item) => (
                      <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{item}</span>
                    ))}
                  </div>
                ) : null}
                <JobProofGallery
                  beforePhotos={job.beforePhotos}
                  afterPhotos={job.afterPhotos}
                  tasks={job.tasks}
                />
                <div className="mt-4 grid gap-2">
                  <button type="button" onClick={() => handleMessage(job)} disabled={activeJobId === job.jobId} className="az-btn-primary flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold">
                    <MessageCircle className="h-4 w-4" /> Message contractor
                  </button>
                  {[
                    "hired_pending_contractor",
                  ].includes(job.status) ? (
                    <button type="button" onClick={() => handleCancel(job)} disabled={activeJobId === job.jobId} className="az-btn-danger-soft flex h-12 items-center justify-center rounded-xl text-sm font-bold">
                      Cancel job
                    </button>
                  ) : null}
                  {["accepted", "on_the_way", "in_progress"].includes(
                    getCompatibleLifecycleStatus(job.status),
                  ) ? (
                    <>
                      <button
                        type="button"
                        disabled
                        className="flex h-12 cursor-not-allowed items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-sm font-bold text-slate-400"
                      >
                        Cancel job
                      </button>
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-700">
                        This contractor has already accepted your job. Please
                        contact the contractor directly to discuss cancellation.
                      </p>
                    </>
                  ) : null}
                  {job.status === "completed" ? (
                    <>
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                        Completed jobs cannot be cancelled. You can leave a
                        review or contact support.
                      </p>
                      <Link href={`/customer/jobs/${encodeURIComponent(job.jobId)}/review`} className="az-btn-primary flex h-12 items-center justify-center rounded-xl text-sm font-bold">Review contractor</Link>
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
