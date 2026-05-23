"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Briefcase, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { auth } from "@/lib/firebase";

type ContractorJob = {
  jobId: string;
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

  return "Unable to load available jobs.";
}

async function fetchContractorJobs(user: User) {
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
    ? (responseBody.jobs as ContractorJob[])
    : [];
}

function formatWhen(date: string, time: string) {
  if (!date && !time) {
    return "Flexible timing";
  }

  return [date, time].filter(Boolean).join(" at ");
}

export default function ContractorDashboardPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ContractorJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        const availableJobs = await fetchContractorJobs(user);
        setJobs(availableJobs);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

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
              Contractor dashboard
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
              Available jobs
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Review open customer requests, express interest, and message
              customers once a conversation is started.
            </p>
            <Link
              href="/contractor/my-jobs"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-red-100 bg-red-50 px-4 text-sm font-bold text-red-600"
            >
              My jobs
            </Link>
          </section>

          {isLoading ? (
            <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              Loading available jobs...
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-6 whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {!isLoading && !errorMessage && jobs.length === 0 ? (
            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
                <Briefcase aria-hidden="true" className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-bold text-black">
                No open jobs yet
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                New customer requests will appear here once posted.
              </p>
            </section>
          ) : null}

          <section className="mt-6 space-y-4">
            {jobs.map((job) => (
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
                  <p className="flex items-center gap-2">
                    <MapPin aria-hidden="true" className="h-4 w-4" />
                    {[job.city, job.province].filter(Boolean).join(", ") ||
                      "Location not provided"}
                  </p>
                  <p>
                    <span className="font-bold text-slate-800">Urgency:</span>{" "}
                    {job.urgency || "Flexible"}
                  </p>
                  <p>
                    <span className="font-bold text-slate-800">When:</span>{" "}
                    {formatWhen(job.preferredDate, job.preferredTime)}
                  </p>
                  <p>
                    <span className="font-bold text-slate-800">
                      Customer:
                    </span>{" "}
                    {job.customerCompletedJobsCount} completed jobs ·{" "}
                    {job.customerReportsCount} reports
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

                <Link
                  href={`/contractor/jobs/${encodeURIComponent(job.jobId)}`}
                  className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-red-500 text-sm font-bold text-white shadow-lg shadow-red-100"
                >
                  View job
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
