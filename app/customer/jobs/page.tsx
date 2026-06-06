"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Briefcase, ChevronLeft, MessageCircle } from "lucide-react";
import { auth } from "@/lib/firebase";
import { fetchSessionProfile } from "@/lib/sessionProfile";
import { formatScheduleLabel, type JobSchedule } from "@/lib/jobSchedule";
import { getJobStatusLabel } from "@/lib/jobStatus";
import { getStatusChipClass } from "@/lib/theme";
import BottomNav from "@/app/components/BottomNav";

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
  cancelReason?: string;
  previousStatus?: string;
  hiredContractorId: string;
  hiredContractorName: string;
  hiredBusinessName: string;
  createdAt: string;
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
    "disputed",
    "in_progress",
    "on_the_way",
    "accepted",
    "hired",
    "hired_pending_contractor",
    "cancel_requested",
  ];

  return (
    priority.find((status) => taskStatuses.includes(status)) ||
    job.status ||
    "open"
  );
}

async function fetchCustomerJobs(user: User) {
  const token = await user.getIdToken();
  const response = await fetch("/api/customers/jobs", {
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
    ? (responseBody.jobs as CustomerJob[])
    : [];
}

async function updateJobStatus(
  user: User,
  jobId: string,
  status: string,
  cancelReason?: string,
) {
  const token = await user.getIdToken();
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status, cancelReason }),
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

  async function loadJobs(user: User) {
    const customerJobs = await fetchCustomerJobs(user);
    setJobs(customerJobs);
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
          setErrorMessage("Please use a customer account to view customer jobs.");
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

  async function handleCancelJob(job: CustomerJob) {
    if (!currentUser || activeJobId) {
      return;
    }

    const lifecycleStatus = getCustomerLifecycleStatus(job);
    const compatibleStatus =
      lifecycleStatus === "hired" ? "accepted" : lifecycleStatus;
    let cancelReason = "";

    if (compatibleStatus === "accepted") {
      const confirmed = window.confirm(
        "Your contractor has accepted this job. Cancelling now may affect your account reliability.",
      );

      if (!confirmed) {
        return;
      }
    }

    if (
      compatibleStatus === "on_the_way" ||
      compatibleStatus === "in_progress"
    ) {
      const enteredReason = window.prompt(
        compatibleStatus === "on_the_way"
          ? "Please tell us why you need to request cancellation."
          : "Please tell us why you need to stop this active job.",
      );

      if (enteredReason === null) {
        return;
      }

      cancelReason = enteredReason.trim();
      if (!cancelReason) {
        setErrorMessage("Please add a reason for this cancellation request.");
        return;
      }
    }

    try {
      setActiveJobId(job.jobId);
      setErrorMessage("");
      setSuccessMessage("");
      const responseBody = await updateJobStatus(
        currentUser,
        job.jobId,
        "cancelled",
        cancelReason,
      );
      await loadJobs(currentUser);
      const nextStatus =
        typeof responseBody?.status === "string" ? responseBody.status : "";
      setSuccessMessage(
        nextStatus === "disputed"
          ? "This job is now under review."
          : nextStatus === "cancel_requested"
            ? "Cancellation requested. The contractor has been notified."
            : "Job cancelled.",
      );
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
              Customer jobs
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
              My jobs
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Track requests, hire contractors, message, and manage job status.
            </p>
            <Link
              href="/customer/active-jobs"
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

          {successMessage ? (
            <p className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
              {successMessage}
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

          <section className="mt-6 space-y-4">
            {jobs.map((job) => (
              <article
                key={job.jobId}
                className="rounded-xl border border-azisto-primary bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] az-job-id">
                      {job.jobId}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-black">
                      {job.selectedServiceCategory || "Service request"}
                    </h2>
                  </div>
                  <span className={getStatusChipClass(job.status || "open")}>
                    {getJobStatusLabel(
                      job.overallStatus || job.status || "open",
                    )}
                  </span>
                </div>

                {job.tasks && job.tasks.length > 0 ? (
                  <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
                    {job.tasks.map((task) => (
                      <div
                        key={task.taskId}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.1em] az-job-id">
                            {task.taskId}
                          </p>
                          <p className="font-bold text-slate-800">
                            {task.subcategory || task.category || "Task"}
                          </p>
                        </div>
                        <span className={getStatusChipClass(task.status || "open")}>
                          {getJobStatusLabel(task.status || "open")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : job.selectedSubcategories.length > 0 ? (
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
                  <p>{formatScheduleLabel(job)}</p>
                  <p>
                    <span className="font-bold text-slate-800">Created:</span>{" "}
                    {formatDate(job.createdAt)}
                  </p>
                  {job.hiredContractorId ? (
                    <p>
                      <span className="font-bold text-slate-800">
                        Hired:
                      </span>{" "}
                      {job.hiredBusinessName ||
                        job.hiredContractorName ||
                        job.hiredContractorId}
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-2">
                  {(job.status === "open" ||
                    job.overallStatus === "partially_hired") ? (
                    <Link
                      href={`/customer/jobs/${encodeURIComponent(
                        job.jobId,
                      )}/interested`}
                      className="az-btn-primary flex h-12 items-center justify-center rounded-xl text-sm font-bold"
                    >
                      View interested contractors
                    </Link>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => handleOpenMessages(job)}
                    disabled={activeJobId === job.jobId}
                    className="az-btn-secondary flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold"
                  >
                    <MessageCircle aria-hidden="true" className="h-4 w-4" />
                    View messages
                  </button>

                  {[
                    "open",
                    "hired_pending_contractor",
                    "accepted",
                    "hired",
                    "on_the_way",
                    "in_progress",
                  ].includes(getCustomerLifecycleStatus(job)) ||
                  job.overallStatus === "partially_hired" ? (
                    <button
                      type="button"
                      onClick={() => handleCancelJob(job)}
                      disabled={activeJobId === job.jobId}
                      className="az-btn-danger-soft flex h-12 items-center justify-center rounded-xl text-sm font-bold"
                    >
                      {getCustomerLifecycleStatus(job) === "on_the_way" ||
                      getCustomerLifecycleStatus(job) === "in_progress"
                        ? "Request cancellation"
                        : "Cancel job"}
                    </button>
                  ) : null}

                  {job.status === "cancel_requested" ? (
                    <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                      Cancellation requested. AZISTO and the contractor have
                      been notified.
                    </p>
                  ) : null}

                  {job.status === "disputed" ? (
                    <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                      This job is now under review.
                    </p>
                  ) : null}

                  {job.status === "completed" ? (
                    <>
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                        Completed jobs cannot be cancelled. You can leave a
                        review or contact support.
                      </p>
                      <Link
                        href={`/customer/jobs/${encodeURIComponent(
                          job.jobId,
                        )}/review`}
                        className="az-btn-primary flex h-12 items-center justify-center rounded-xl text-sm font-bold"
                      >
                        Review contractor
                      </Link>
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
