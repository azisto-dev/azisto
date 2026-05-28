"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Briefcase, ChevronLeft, MessageCircle } from "lucide-react";
import { auth } from "@/lib/firebase";
import { fetchSessionProfile } from "@/lib/sessionProfile";
import { getStatusChipClass } from "@/lib/theme";
import BottomNav from "@/app/components/BottomNav";

type ContractorJob = {
  jobId: string;
  customerId: string;
  selectedServiceCategory: string;
  selectedSubcategories: string[];
  city: string;
  province: string;
  preferredDate: string;
  preferredTime: string;
  urgency: string;
  status: string;
  relationship: string;
  createdAt: string;
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
  return error instanceof Error ? error.message : "Unable to load your jobs.";
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

function formatWhen(date: string, time: string) {
  if (!date && !time) {
    return "Flexible timing";
  }

  return [date, time].filter(Boolean).join(" at ");
}

function JobCard({
  job,
  activeJobId,
  onMessage,
  onMarkInProgress,
}: {
  job: ContractorJob;
  activeJobId: string;
  onMessage: (jobId: string) => void;
  onMarkInProgress: (jobId: string) => void;
}) {
  return (
    <article className="rounded-xl border border-azisto-primary bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] az-job-id">
            {job.jobId}
          </p>
          <h3 className="mt-1 text-lg font-bold text-black">
            {job.selectedServiceCategory || "Service request"}
          </h3>
        </div>
        <span className={getStatusChipClass(job.status || "open")}>
          {job.status || "open"}
        </span>
      </div>

      {job.selectedSubcategories.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
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

      <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
        <p>{[job.city, job.province].filter(Boolean).join(", ")}</p>
        <p>
          <span className="font-bold text-slate-800">When:</span>{" "}
          {formatWhen(job.preferredDate, job.preferredTime)}
        </p>
        <p>
          <span className="font-bold text-slate-800">Urgency:</span>{" "}
          {job.urgency || "Flexible"}
        </p>
      </div>

      <div className="mt-4 grid gap-2">
        <Link
          href={`/contractor/jobs/${encodeURIComponent(job.jobId)}`}
          className="az-btn-primary flex h-12 items-center justify-center rounded-xl text-sm font-bold"
        >
          View job
        </Link>
        <button
          type="button"
          onClick={() => onMessage(job.jobId)}
          disabled={activeJobId === job.jobId}
          className="az-btn-primary flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold"
        >
          <MessageCircle aria-hidden="true" className="h-4 w-4" />
          Message customer
        </button>
        {job.status === "hired" ? (
          <button
            type="button"
            onClick={() => onMarkInProgress(job.jobId)}
            disabled={activeJobId === job.jobId}
            className="az-btn-primary flex h-12 items-center justify-center rounded-xl text-sm font-bold"
          >
            Mark in progress
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function ContractorMyJobsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<ContractorJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeJobId, setActiveJobId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const groupedJobs = useMemo(
    () => ({
      interested: jobs.filter(
        (job) => job.relationship === "interested" && job.status === "open",
      ),
      active: jobs.filter((job) =>
        ["hired", "in_progress"].includes(job.status),
      ),
      completed: jobs.filter((job) => job.status === "completed"),
    }),
    [jobs],
  );

  async function loadJobs(user: User) {
    const contractorJobs = await fetchContractorJobs(user);
    setJobs(contractorJobs);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Contractor my jobs auth state loaded");
      if (!user) {
        console.log("Contractor my jobs redirect reason: no signed-in user");
        router.replace("/login");
        return;
      }

      console.log("Contractor my jobs current uid:", user.uid);
      setCurrentUser(user);

      try {
        setIsLoading(true);
        setErrorMessage("");
        const profile = await fetchSessionProfile(user);
        console.log("Contractor my jobs role API result:", profile);

        if (profile.role !== "contractor") {
          console.log(
            "Contractor my jobs redirect reason:",
            `role:${profile.role}`,
          );
          setErrorMessage(
            "Please use a contractor account to view contractor jobs.",
          );
          return;
        }

        await loadJobs(user);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

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
      await updateJobStatus(currentUser, jobId, "in_progress");
      await loadJobs(currentUser);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setActiveJobId("");
    }
  }

  const sections = [
    { title: "Interested", jobs: groupedJobs.interested },
    { title: "Hired / Active", jobs: groupedJobs.active },
    { title: "Completed", jobs: groupedJobs.completed },
  ];

  return (
    <main className="min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
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
            <p className="text-xs font-bold uppercase tracking-[0.14em] az-kicker">
              Contractor jobs
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
              My jobs
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Follow interested, hired, active, and completed AZISTO jobs.
            </p>
            <Link
              href="/contractor/active-jobs"
              className="az-btn-secondary mt-4 inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold"
            >
              View active jobs
            </Link>
          </section>

          {isLoading ? (
            <p className="mt-6 rounded-xl border border-azisto-border bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              Loading your jobs...
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-6 whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {!isLoading && !errorMessage && jobs.length === 0 ? (
            <section className="mt-6 rounded-xl border border-azisto-border bg-white p-5 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-azisto-text">
                <Briefcase aria-hidden="true" className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-bold text-black">No jobs yet</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Jobs you express interest in or get hired for will appear here.
              </p>
            </section>
          ) : null}

          <div className="mt-6 space-y-7">
            {sections.map((section) =>
              section.jobs.length > 0 ? (
                <section key={section.title}>
                  <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-500">
                    {section.title}
                  </h2>
                  <div className="mt-3 space-y-4">
                    {section.jobs.map((job) => (
                      <JobCard
                        key={job.jobId}
                        job={job}
                        activeJobId={activeJobId}
                        onMessage={handleMessage}
                        onMarkInProgress={handleMarkInProgress}
                      />
                    ))}
                  </div>
                </section>
              ) : null,
            )}
          </div>
        </div>
        <BottomNav role="contractor" />
      </div>
    </main>
  );
}
