"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { auth } from "@/lib/firebase";
import { getStatusChipClass } from "@/lib/theme";
import BottomNav from "@/app/components/BottomNav";

type ActiveJob = {
  jobId: string;
  customerId: string;
  selectedServiceCategory: string;
  selectedSubcategories: string[];
  city: string;
  province: string;
  status: string;
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

async function updateStatus(user: User, jobId: string) {
  const token = await user.getIdToken();
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "in_progress" }),
  });
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(typeof body?.message === "string" ? body.message : "Unable to update job.");
  }
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

  async function handleInProgress(jobId: string) {
    if (!user) return;
    try {
      setActiveJobId(jobId);
      await updateStatus(user, jobId);
      await loadJobs(user);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update job.");
    } finally {
      setActiveJobId("");
    }
  }

  return (
    <main className="min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <div className="flex-1 px-5 pb-6 pt-5">
          <StatusBar />
          <header className="mt-3 grid grid-cols-[40px_1fr_40px] items-center">
            <button type="button" onClick={() => router.push("/contractor/my-jobs")} className="flex h-10 w-10 items-center justify-center rounded-full text-black" aria-label="Back to my jobs">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <Link href="/home" className="flex justify-center">
              <img src="/azisto-logo-cropped.png" alt="AZISTO" className="w-full max-w-[165px] object-contain" />
            </Link>
            <span aria-hidden="true" />
          </header>
          <section className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] az-kicker">Contractor jobs</p>
            <h1 className="mt-1 text-3xl font-bold leading-tight">Active jobs</h1>
          </section>
          {isLoading ? <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Loading active jobs...</p> : null}
          {errorMessage ? <p className="mt-6 whitespace-pre-line rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p> : null}
          <section className="mt-6 space-y-4">
            {jobs.map((job) => (
              <article key={job.jobId} className="rounded-xl border border-azisto-primary bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] az-job-id">{job.jobId}</p>
                    <h2 className="mt-1 text-lg font-bold">{job.selectedServiceCategory || "Service request"}</h2>
                  </div>
                  <span className={getStatusChipClass(job.status)}>{job.status}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">Customer: {job.customerId}</p>
                <p className="mt-1 text-sm text-slate-600">{[job.city, job.province].filter(Boolean).join(", ")}</p>
                <div className="mt-4 grid gap-2">
                  <button type="button" onClick={() => handleMessage(job.jobId)} disabled={activeJobId === job.jobId} className="az-btn-primary flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold">
                    <MessageCircle className="h-4 w-4" /> Message customer
                  </button>
                  {job.status === "hired" ? (
                    <button type="button" onClick={() => handleInProgress(job.jobId)} disabled={activeJobId === job.jobId} className="az-btn-primary flex h-12 items-center justify-center rounded-xl text-sm font-bold">Mark in progress</button>
                  ) : null}
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
