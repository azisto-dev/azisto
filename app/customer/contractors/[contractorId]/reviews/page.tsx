"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ChevronLeft, ShieldCheck, Star } from "lucide-react";
import { auth } from "@/lib/firebase";
import BottomNav from "@/app/components/BottomNav";
import AppHeader from "@/app/components/AppHeader";
import AppShimmer from "@/app/components/AppShimmer";

type PublicReview = {
  reviewId: string;
  rating: number;
  reviewText: string;
  tags: string[];
  serviceCategory: string;
  subcategory: string;
  city: string;
  createdAt: string;
  customerName: string;
};

type ContractorReviewSummary = {
  name: string;
  contactName: string;
  ratingAverage: number;
  ratingCount: number;
  completedJobs: number;
  completedTasks?: number;
  verified: boolean;
};

type PublicReviewsResponse = {
  contractor: ContractorReviewSummary;
  reviews: PublicReview[];
};

function formatDate(value: string) {
  if (!value) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
  }).format(new Date(value));
}

async function fetchPublicReviews(user: User, contractorId: string) {
  const token = await user.getIdToken();
  const response = await fetch(
    `/api/contractors/${encodeURIComponent(contractorId)}/reviews`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
    contractor?: unknown;
    reviews?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Reviews could not be loaded. Please try again.",
    );
  }

  return {
    contractor: body?.contractor as ContractorReviewSummary,
    reviews: Array.isArray(body?.reviews)
      ? (body.reviews as PublicReview[])
      : [],
  } satisfies PublicReviewsResponse;
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span
      className="flex items-center gap-0.5 text-[#F59E0B]"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={`h-4 w-4 ${
            index < Math.round(rating)
              ? "fill-[#F59E0B]"
              : "fill-transparent text-[#F59E0B]/35"
          }`}
        />
      ))}
    </span>
  );
}

export default function CustomerContractorReviewsPage() {
  const router = useRouter();
  const params = useParams<{ contractorId: string }>();
  const searchParams = useSearchParams();
  const contractorId = params.contractorId;
  const jobId = searchParams.get("jobId") ?? "";
  const backHref = jobId
    ? `/customer/jobs/${encodeURIComponent(jobId)}/interested`
    : "/customer/jobs";
  const [data, setData] = useState<PublicReviewsResponse | null>(null);
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
        setData(await fetchPublicReviews(user, contractorId));
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Reviews could not be loaded. Please try again.",
        );
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [contractorId, router]);

  const reviewsUnavailable =
    data && data.contractor.ratingCount > 0 && data.reviews.length === 0;

  return (
    <main className="az-customer-shell min-h-screen bg-azisto-background text-black md:px-6 md:py-8">
      <div className="mx-auto flex h-screen min-h-0 w-full max-w-[390px] flex-col bg-white md:h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <div className="azisto-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-24 pt-5">
          <AppHeader
            leftControl={
              <Link
                href={backHref}
                aria-label="Back to interested contractors"
                className="flex h-10 w-10 items-center justify-center rounded-full text-black"
              >
                <ChevronLeft aria-hidden="true" className="h-5 w-5" />
              </Link>
            }
          />

          <section className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-azisto-accent">
              Contractor reviews
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight">
              Ratings &amp; reviews
            </h1>
          </section>

          {isLoading ? (
            <AppShimmer className="mt-6" rows={3} />
          ) : null}

          {errorMessage ? (
            <p className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {data ? (
            <>
              <section className="mt-6 rounded-xl border border-blue-100 bg-white p-4 shadow-[0_8px_24px_rgba(37,99,235,0.08)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      <span className="az-customer-name">
                        {data.contractor.name}
                      </span>
                    </h2>
                    {data.contractor.contactName &&
                    data.contractor.contactName !== data.contractor.name ? (
                      <p className="mt-1 text-sm text-slate-600">
                        <span className="az-customer-name">
                          {data.contractor.contactName}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  {data.contractor.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-azisto-accent">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <span className="text-3xl font-bold text-slate-900">
                    {data.contractor.ratingCount > 0
                      ? data.contractor.ratingAverage.toFixed(1)
                      : "New"}
                  </span>
                  <div>
                    <RatingStars rating={data.contractor.ratingAverage} />
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {data.contractor.ratingCount} review
                      {data.contractor.ratingCount === 1 ? "" : "s"}
                      {" · "}
                      {data.contractor.completedTasks ??
                        data.contractor.completedJobs}{" "}
                      completed task
                      {(data.contractor.completedTasks ??
                        data.contractor.completedJobs) === 1
                        ? ""
                        : "s"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-blue-50 p-3">
                    <p className="text-xl font-bold text-azisto-accent">
                      {data.contractor.ratingCount}
                    </p>
                    <p className="text-xs font-semibold text-slate-500">
                      Reviews
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <p className="text-xl font-bold text-emerald-700">
                      {data.contractor.completedTasks ??
                        data.contractor.completedJobs}
                    </p>
                    <p className="text-xs font-semibold text-slate-500">
                      Tasks Completed
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-6">
                <h2 className="text-xl font-bold text-slate-900">
                  Recent reviews
                </h2>

                {reviewsUnavailable ? (
                  <p className="mt-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                    Reviews could not be loaded. Please try again.
                  </p>
                ) : data.reviews.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-azisto-border bg-white p-5 text-center text-sm text-slate-600 shadow-sm">
                    No reviews yet.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {data.reviews.map((review) => (
                      <article
                        key={review.reviewId}
                        className="rounded-xl border border-azisto-border bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {review.subcategory ||
                                review.serviceCategory ||
                                "Completed service"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {[review.serviceCategory, review.city]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <span className="flex items-center gap-1 text-sm font-bold text-slate-900">
                            {review.rating.toFixed(1)}
                            <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
                          </span>
                        </div>
                        <div className="mt-2">
                          <RatingStars rating={review.rating} />
                        </div>
                        {review.reviewText ? (
                          <p className="mt-3 text-sm leading-6 text-slate-700">
                            &quot;{review.reviewText}&quot;
                          </p>
                        ) : null}
                        {review.tags.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {review.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-azisto-accent"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-400">
                          <span className="az-customer-name">
                            {review.customerName}
                          </span>
                          <span>{formatDate(review.createdAt)}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
        <BottomNav role="customer" />
      </div>
    </main>
  );
}
