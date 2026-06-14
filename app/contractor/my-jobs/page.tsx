"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Briefcase, ChevronLeft, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { fetchSessionProfile } from "@/lib/sessionProfile";
import { formatScheduleLabel, type JobSchedule } from "@/lib/jobSchedule";
import BottomNav from "@/app/components/BottomNav";
import ContractorHeader from "@/app/components/ContractorHeader";
import { getContractorJobHref } from "@/lib/contractorJobHref";

type ContractorJob = {
  jobId: string;
  parentJobId: string;
  taskId: string;
  customerId: string;
  customerFirstName: string;
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
  relationship: string;
  createdAt: string;
};

type InterestedJobCard = ContractorJob & {
  parentJobId: string;
  tasks: Array<{
    taskId: string;
    label: string;
  }>;
};

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

async function removeContractorInterest(user: User, jobId: string) {
  const token = await user.getIdToken();
  const response = await fetch(
    `/api/contractors/jobs/${encodeURIComponent(jobId)}/interest`,
    {
      method: "DELETE",
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

function groupInterestedJobs(jobs: ContractorJob[]) {
  const groupedJobs = new Map<string, InterestedJobCard>();

  jobs
    .filter(
      (job) => job.relationship === "interested" && job.status === "open",
    )
    .forEach((job) => {
      const parentJobId = job.parentJobId || job.jobId;
      const existingJob = groupedJobs.get(parentJobId);
      const taskId = job.taskId || job.jobId;
      const taskLabel =
        job.selectedSubcategories[0] ||
        job.selectedServiceCategory ||
        "Service task";

      if (existingJob) {
        if (!existingJob.tasks.some((task) => task.taskId === taskId)) {
          existingJob.tasks.push({ taskId, label: taskLabel });
        }
        return;
      }

      groupedJobs.set(parentJobId, {
        ...job,
        jobId: parentJobId,
        parentJobId,
        tasks: taskId ? [{ taskId, label: taskLabel }] : [],
      });
    });

  return Array.from(groupedJobs.values());
}

function InterestedJobCardView({
  job,
  removingJobId,
  onRemove,
}: {
  job: InterestedJobCard;
  removingJobId: string;
  onRemove: (jobId: string) => void;
}) {
  return (
    <article className="az-contractor-card-compact az-contractor-job-card px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-5 text-[var(--azisto-contractor-text)]">
            {job.selectedServiceCategory || "Service request"}
          </h2>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--azisto-contractor-burgundy)]">
            {job.parentJobId}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(job.parentJobId)}
          disabled={removingJobId === job.parentJobId}
          className="flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-[var(--azisto-contractor-burgundy)] bg-white px-2.5 py-1 text-[10px] font-bold leading-tight text-[var(--azisto-contractor-burgundy)] transition hover:bg-[rgb(122_0_60_/_0.06)] disabled:cursor-wait disabled:opacity-60"
        >
          <X aria-hidden="true" className="h-3 w-3" />
          {removingJobId === job.parentJobId
            ? "Removing..."
            : "Remove from Interested"}
        </button>
      </div>

      <div className="mt-2 flex justify-end">
        <span className="rounded-full bg-white px-2 py-0.5 text-[13px] font-semibold capitalize leading-5 text-[var(--azisto-contractor-text)] shadow-sm">
          {[job.city, job.province].filter(Boolean).join(", ") ||
            "Location pending"}
        </span>
      </div>

      {job.tasks.length > 0 ? (
        <div className="az-contractor-task-panel mt-2 space-y-1 rounded-2xl bg-[rgb(248_247_252_/_0.9)] p-1.5">
          {job.tasks.map((task, index) => (
            <div
              key={task.taskId || `${job.parentJobId}-${task.label}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-[var(--azisto-contractor-border)] bg-white px-2 py-1"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--azisto-contractor-burgundy)]">
                {task.taskId || `Task ${index + 1}`}
              </span>
              <span className="text-[11px] font-bold text-[var(--azisto-contractor-text)]">
                {task.label}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-2 space-y-1 text-[11px] font-semibold text-[var(--azisto-contractor-muted)]">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate">
            Customer: {job.customerFirstName || "Customer"}
          </p>
          <p className="shrink-0 text-right">{formatScheduleLabel(job)}</p>
        </div>
      </div>

      <Link
        href={getContractorJobHref(
          job.parentJobId,
          job.tasks.length === 1 ? job.tasks[0].taskId : "",
        )}
        className="az-btn-contractor-outline mt-3 flex h-10 items-center justify-center rounded-full border-[#5C0032] bg-[rgb(122_0_60_/_0.08)] text-xs font-bold text-[#5C0032]"
      >
        View job
      </Link>
    </article>
  );
}

export default function ContractorMyJobsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<ContractorJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingJobId, setRemovingJobId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const interestedJobs = useMemo(() => groupInterestedJobs(jobs), [jobs]);

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

  async function handleRemoveInterest(jobId: string) {
    if (!currentUser || removingJobId) {
      return;
    }

    try {
      setRemovingJobId(jobId);
      setErrorMessage("");
      await removeContractorInterest(currentUser, jobId);
      setJobs((currentJobs) =>
        currentJobs.filter(
          (job) =>
            job.relationship !== "interested" ||
            (job.parentJobId || job.jobId) !== jobId,
        ),
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setRemovingJobId("");
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
                onClick={() => router.back()}
                className="flex h-10 w-10 items-center justify-center rounded-full text-black"
                aria-label="Go back"
              >
                <ChevronLeft aria-hidden="true" className="h-5 w-5" />
              </button>
            }
          />

          <section className="mt-8">
            <h1 className="text-2xl font-bold uppercase tracking-[0.12em] text-[var(--azisto-contractor-burgundy)]">
              Interested
            </h1>
          </section>

          {isLoading ? (
            <p className="az-contractor-card-compact mt-6 px-4 py-3 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
              Loading your jobs...
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-6 whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {!isLoading && !errorMessage && interestedJobs.length === 0 ? (
            <section className="az-contractor-card mt-6 p-5 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--azisto-contractor-burgundy)]">
                <Briefcase aria-hidden="true" className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-bold text-[var(--azisto-contractor-text)]">
                No interested jobs
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
                Jobs you express interest in will appear here until they are
                accepted or removed.
              </p>
            </section>
          ) : null}

          {interestedJobs.length > 0 ? (
            <section id="interested" className="mt-5 scroll-mt-4">
              <div className="space-y-3">
                {interestedJobs.map((job) => (
                  <InterestedJobCardView
                    key={job.parentJobId}
                    job={job}
                    removingJobId={removingJobId}
                    onRemove={handleRemoveInterest}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <BottomNav role="contractor" />
      </div>
    </main>
  );
}
