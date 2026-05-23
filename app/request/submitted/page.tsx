"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, ChevronLeft } from "lucide-react";

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

function SubmittedContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") ?? "Pending";
  const status = searchParams.get("status") ?? "open";
  const isUnderReview = status === "review_required";

  return (
    <main className="min-h-screen bg-white text-black md:bg-slate-50 md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-slate-200">
        <div className="flex flex-1 flex-col px-5 pb-6 pt-5">
          <StatusBar />

          <header className="mt-3 grid grid-cols-[40px_1fr_40px] items-center">
            <Link
              href="/customer/jobs"
              className="flex h-10 w-10 items-center justify-center rounded-full text-black"
              aria-label="Back to customer jobs"
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            </Link>

            <Link href="/home" className="flex justify-center">
              <img
                src="/azisto-logo-cropped.png"
                alt="AZISTO - Your on-demand assistant"
                className="w-full max-w-[165px] object-contain"
              />
            </Link>

            <span aria-hidden="true" />
          </header>

          <section className="flex flex-1 flex-col justify-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-100 bg-red-50 shadow-sm">
              <CheckCircle2
                aria-hidden="true"
                className="h-8 w-8 text-red-500"
              />
            </div>

            <div className="mt-6 text-center">
              <span
                className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-bold ${
                  isUnderReview
                    ? "border-amber-100 bg-amber-50 text-amber-700"
                    : "border-red-100 bg-red-50 text-red-500"
                }`}
              >
                {isUnderReview ? "Review required" : "Open"}
              </span>

              <h1 className="mt-4 text-3xl font-bold leading-tight text-black">
                Request submitted
              </h1>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                {isUnderReview
                  ? "Your job request has been received and will be reviewed by AZISTO before it is shown to contractors."
                  : "Your job request has been posted. Contractors near your area will be notified once matching is active."}
              </p>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Job ID
                </p>
                <p className="mt-1 text-xl font-bold text-black">{jobId}</p>
              </div>
            </div>
          </section>

          <Link
            href="/customer/jobs"
            className="mt-6 flex h-14 items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white shadow-lg shadow-red-200 transition hover:bg-red-600"
          >
            View My Jobs
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function RequestSubmittedPage() {
  return (
    <Suspense>
      <SubmittedContent />
    </Suspense>
  );
}
