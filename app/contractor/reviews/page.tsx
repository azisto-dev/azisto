"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ChevronLeft, Star } from "lucide-react";
import { auth } from "@/lib/firebase";
import BottomNav from "@/app/components/BottomNav";
import ContractorHeader from "@/app/components/ContractorHeader";

type ContractorReview = {
  reviewId: string;
  jobId: string;
  taskId: string;
  rating: number;
  reviewText: string;
  tags: string[];
  serviceCategory: string;
  subcategory: string;
  city: string;
  createdAt: string;
};

type ReviewSummary = {
  contractorId: string;
  contractorName: string;
  ratingAverage: number;
  ratingCount: number;
  completedJobs: number;
  recentReviews: ContractorReview[];
};

function formatDate(value: string) {
  if (!value) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

async function fetchReviewSummary(user: User) {
  const token = await user.getIdToken();
  const response = await fetch("/api/contractors/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
  } & Partial<ReviewSummary>;

  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Unable to load ratings.",
    );
  }

  return {
    contractorId:
      typeof body.contractorId === "string" ? body.contractorId : "",
    contractorName:
      typeof body.contractorName === "string"
        ? body.contractorName
        : "Contractor",
    ratingAverage:
      typeof body.ratingAverage === "number" ? body.ratingAverage : 0,
    ratingCount: typeof body.ratingCount === "number" ? body.ratingCount : 0,
    completedJobs:
      typeof body.completedJobs === "number" ? body.completedJobs : 0,
    recentReviews: Array.isArray(body.recentReviews)
      ? body.recentReviews
      : [],
  } satisfies ReviewSummary;
}

export default function ContractorReviewsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
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
        setSummary(await fetchReviewSummary(user));
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load ratings.",
        );
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

  return (
    <main className="az-contractor-shell min-h-screen md:px-6 md:py-8">
      <div className="mx-auto flex h-screen min-h-0 w-full max-w-[390px] flex-col bg-white md:h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-[var(--azisto-contractor-border)]">
        <div className="azisto-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-24 pt-5">
          <ContractorHeader
            leftControl={
              <button
                type="button"
                onClick={() => router.back()}
                className="flex h-10 w-10 items-center justify-center rounded-full text-black"
                aria-label="Go back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            }
          />

          <section className="mt-8">
            <h1 className="text-3xl font-normal text-[var(--azisto-contractor-text)]">
              Ratings & reviews
            </h1>
          </section>

          {isLoading ? (
            <p className="az-contractor-card mt-6 p-4 text-sm text-[var(--azisto-contractor-muted)]">
              Loading your reviews...
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {summary ? (
            <>
              <section className="az-contractor-card mt-6 p-4">
                <p className="text-sm font-semibold text-[var(--azisto-contractor-muted)]">
                  {summary.contractorName}
                </p>
                <div className="mt-3 flex items-end gap-3">
                  <span className="text-4xl font-bold text-[var(--azisto-contractor-text)]">
                    {summary.ratingCount > 0
                      ? summary.ratingAverage.toFixed(1)
                      : "New"}
                  </span>
                  <div>
                    <div className="flex text-xl text-[#FFD700]">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          className={`h-5 w-5 ${
                            index < Math.round(summary.ratingAverage)
                              ? "fill-[#FFD700]"
                              : "fill-transparent text-[#FFD700]/30"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[var(--azisto-contractor-muted)]">
                      {summary.ratingCount} review
                      {summary.ratingCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[rgb(138_15_77_/_0.06)] p-3">
                    <p className="text-xl font-bold text-[var(--azisto-contractor-burgundy)]">
                      {summary.ratingCount}
                    </p>
                    <p className="text-xs font-semibold text-[var(--azisto-contractor-muted)]">
                      Total reviews
                    </p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-3">
                    <p className="text-xl font-bold text-emerald-700">
                      {summary.completedJobs}
                    </p>
                    <p className="text-xs font-semibold text-[var(--azisto-contractor-muted)]">
                      Completed jobs
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-normal text-[var(--azisto-contractor-text)]">
                  Recent reviews
                </h2>
                {summary.recentReviews.length === 0 ? (
                  <div className="az-contractor-card mt-3 p-5 text-center">
                    <p className="text-sm font-bold text-[var(--azisto-contractor-text)]">
                      No reviews yet
                    </p>
                    <p className="mt-2 text-sm text-[var(--azisto-contractor-muted)]">
                      Customer feedback will appear after completed jobs.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {summary.recentReviews.map((review) => (
                      <article
                        key={review.reviewId}
                        className="az-contractor-card p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-[var(--azisto-contractor-text)]">
                              {review.subcategory ||
                                review.serviceCategory ||
                                "Completed job"}
                            </p>
                            <p className="mt-1 text-xs text-[var(--azisto-contractor-muted)]">
                              {review.jobId}
                              {review.city ? ` · ${review.city}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-bold text-[var(--azisto-contractor-text)]">
                            {review.rating.toFixed(1)}
                            <Star className="h-4 w-4 fill-[#FFD700] text-[#FFD700]" />
                          </div>
                        </div>
                        {review.reviewText ? (
                          <p className="mt-3 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
                            &quot;{review.reviewText}&quot;
                          </p>
                        ) : null}
                        {review.tags.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {review.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full border border-[rgb(138_15_77_/_0.16)] bg-[rgb(138_15_77_/_0.06)] px-2.5 py-1 text-[10px] font-bold text-[var(--azisto-contractor-burgundy)]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <p className="mt-3 text-[11px] font-semibold text-slate-400">
                          {formatDate(review.createdAt)}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
        <BottomNav role="contractor" />
      </div>
    </main>
  );
}
