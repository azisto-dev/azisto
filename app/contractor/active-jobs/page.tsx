"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { auth } from "@/lib/firebase";
import { formatScheduleLabel, type JobSchedule } from "@/lib/jobSchedule";
import { getJobStatusLabel } from "@/lib/jobStatus";
import { getStatusChipClass } from "@/lib/theme";
import BottomNav from "@/app/components/BottomNav";
import ContractorHeader from "@/app/components/ContractorHeader";
import { getContractorJobHref } from "@/lib/contractorJobHref";

type ActiveJob = {
  jobId: string;
  parentJobId?: string;
  taskId?: string;
  customerId: string;
  selectedServiceCategory: string;
  selectedSubcategories: string[];
  city: string;
  province: string;
  status: string;
  scheduleMode: string;
  preferredDate: string;
  preferredTime: string;
  preferredTimeWindow: string;
  urgency: string;
  schedule: JobSchedule | null;
};

async function fetchActiveJobs(user: User) {
  const token = await user.getIdToken();
  const response = await fetch("/api/contractor/active-jobs", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json().catch(() => null)) as {
    jobs?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(typeof body?.message === "string" ? body.message : "Unable to load jobs.");
  }

  return Array.isArray(body?.jobs) ? (body.jobs as ActiveJob[]) : [];
}

async function openThread(user: User, jobId: string) {
  const token = await user.getIdToken();
  const response = await fetch("/api/messages/threads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jobId }),
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

export default function ContractorActiveJobsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [activeJobId, setActiveJobId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadJobs(currentUser: User) {
    setJobs(await fetchActiveJobs(currentUser));
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
        await loadJobs(currentUser);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load jobs.");
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

  async function handleMessage(jobId: string) {
    if (!user) return;
    try {
      setActiveJobId(jobId);
      const threadId = await openThread(user, jobId);
      router.push(`/messages/${encodeURIComponent(threadId)}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open messages.");
    } finally {
      setActiveJobId("");
    }
  }

  return (
    <main className="az-contractor-shell min-h-screen md:px-6 md:py-8">
      <div className="mx-auto flex h-screen min-h-0 w-full max-w-[390px] flex-col bg-[var(--azisto-contractor-bg)] shadow-none md:h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-[var(--azisto-contractor-border)]">
        <div className="azisto-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-24 pt-5">
          <ContractorHeader
            leftControl={
              <button
                type="button"
                onClick={() => router.push("/contractor/my-jobs")}
                className="flex h-10 w-10 items-center justify-center rounded-full text-black"
                aria-label="Back to my jobs"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            }
          />
          <section className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--azisto-contractor-burgundy)]">Contractor jobs</p>
            <h1 className="mt-1 text-3xl font-normal leading-tight text-[var(--azisto-contractor-text)]">Active jobs</h1>
          </section>
          {isLoading ? <p className="az-contractor-card-compact mt-6 p-4 text-sm text-[var(--azisto-contractor-muted)]">Loading active jobs...</p> : null}
          {errorMessage ? <p className="mt-6 whitespace-pre-line rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p> : null}
          <section className="mt-6 space-y-4">
            {jobs.map((job) => (
              <article key={job.jobId} className="az-contractor-card-compact p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--azisto-contractor-burgundy)]">{job.jobId}</p>
                    {job.parentJobId ? (
                      <p className="mt-1 text-xs font-semibold text-[var(--azisto-contractor-muted)]">
                        Parent job: {job.parentJobId}
                      </p>
                    ) : null}
                    <h2 className="mt-1 text-lg font-normal text-[var(--azisto-contractor-text)]">{job.selectedServiceCategory || "Service request"}</h2>
                  </div>
                  <span className={getStatusChipClass(job.status)}>
                    {getJobStatusLabel(job.status)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-[var(--azisto-contractor-muted)]">Customer: {job.customerId}</p>
                <p className="mt-1 text-sm text-[var(--azisto-contractor-muted)]">{[job.city, job.province].filter(Boolean).join(", ")}</p>
                <p className="mt-1 text-sm text-[var(--azisto-contractor-muted)]">{formatScheduleLabel(job)}</p>
                <div className="mt-4 grid gap-2">
                  <button type="button" onClick={() => handleMessage(job.parentJobId || job.jobId)} disabled={activeJobId === job.jobId} className="az-btn-contractor flex h-12 items-center justify-center gap-2 rounded-full text-sm font-bold">
                    <MessageCircle className="h-4 w-4" /> Message customer
                  </button>
                  <Link
                    href={getContractorJobHref(
                      job.parentJobId || job.jobId,
                      job.taskId,
                    )}
                    className="az-btn-contractor-outline flex h-12 items-center justify-center rounded-full text-sm font-bold"
                  >
                    Manage job
                  </Link>
                </div>
              </article>
            ))}
          </section>
        </div>
        <BottomNav role="contractor" />
      </div>
    </main>
  );
}
