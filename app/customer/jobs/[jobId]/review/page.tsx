"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Check, ChevronLeft, Star } from "lucide-react";
import { auth } from "@/lib/firebase";
import BottomNav from "@/app/components/BottomNav";
import NotificationBell from "@/app/components/NotificationBell";

type ReviewTarget = {
  taskId: string;
  contractorId: string;
  contractorName: string;
  serviceCategory: string;
  subcategory: string;
  reviewed: boolean;
  review: null | {
    rating: number;
    reviewText: string;
    tags: string[];
    createdAt: string;
  };
};

type ReviewContext = {
  jobId: string;
  city: string;
  selectedTaskId: string;
  targets: ReviewTarget[];
};

const reviewTags = [
  "On time",
  "Professional",
  "Good communication",
  "Quality work",
  "Fair price",
  "Would hire again",
];

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

async function fetchReviewContext(
  user: User,
  jobId: string,
  taskId: string,
) {
  const token = await user.getIdToken();
  const query = taskId ? `?taskId=${encodeURIComponent(taskId)}` : "";
  const response = await fetch(
    `/api/jobs/${encodeURIComponent(jobId)}/review${query}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
  } & Partial<ReviewContext>;

  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Unable to load review details.",
    );
  }

  return {
    jobId: typeof body.jobId === "string" ? body.jobId : jobId,
    city: typeof body.city === "string" ? body.city : "",
    selectedTaskId:
      typeof body.selectedTaskId === "string" ? body.selectedTaskId : "",
    targets: Array.isArray(body.targets) ? body.targets : [],
  } satisfies ReviewContext;
}

async function submitReview(
  user: User,
  jobId: string,
  taskId: string,
  rating: number,
  reviewText: string,
  tags: string[],
) {
  const token = await user.getIdToken();
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/review`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ taskId, rating, reviewText, tags }),
  });
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Unable to submit review.",
    );
  }
}

export default function CustomerJobReviewPage() {
  const router = useRouter();
  const params = useParams<{ jobId: string }>();
  const searchParams = useSearchParams();
  const jobId = params.jobId;
  const requestedTaskId = searchParams.get("taskId") ?? "";
  const [user, setUser] = useState<User | null>(null);
  const [reviewContext, setReviewContext] = useState<ReviewContext | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
        const nextContext = await fetchReviewContext(
          currentUser,
          jobId,
          requestedTaskId,
        );
        setReviewContext(nextContext);
        setSelectedTaskId(
          requestedTaskId || nextContext.selectedTaskId || "",
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load review details.",
        );
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [jobId, requestedTaskId, router]);

  const selectedTarget =
    reviewContext?.targets.find(
      (target) => target.taskId === selectedTaskId,
    ) ??
    reviewContext?.targets.find((target) => !target.reviewed) ??
    reviewContext?.targets[0];

  function toggleTag(tag: string) {
    setSelectedTags((currentTags) =>
      currentTags.includes(tag)
        ? currentTags.filter((currentTag) => currentTag !== tag)
        : [...currentTags, tag],
    );
  }

  async function handleSubmit() {
    if (!user || !selectedTarget || isSubmitting) {
      return;
    }

    if (selectedTarget.reviewed) {
      setErrorMessage("This completed task has already been reviewed.");
      return;
    }

    if (!rating) {
      setErrorMessage("Please choose a rating from 1 to 5 stars.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      await submitReview(
        user,
        jobId,
        selectedTarget.taskId,
        rating,
        reviewText,
        selectedTags,
      );
      router.replace("/customer/jobs");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to submit review.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-azisto-background text-black md:px-6 md:py-8">
      <div className="mx-auto flex h-screen min-h-0 w-full max-w-[390px] flex-col bg-white md:h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <div className="azisto-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-24 pt-5">
          <StatusBar />
          <header className="mt-3 grid grid-cols-[40px_1fr_40px] items-center">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-10 w-10 items-center justify-center rounded-full text-black"
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <Link href="/home" className="flex justify-center">
              <img
                src="/azisto-logo-cropped.png"
                alt="AZISTO"
                className="w-full max-w-[165px] object-contain"
              />
            </Link>
            <NotificationBell />
          </header>

          <section className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-azisto-accent">
              {jobId}
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight">
              Rate contractor
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your feedback helps customers choose trusted professionals.
            </p>
          </section>

          {isLoading ? (
            <p className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-600">
              Loading completed work...
            </p>
          ) : null}

          {reviewContext && reviewContext.targets.length > 1 ? (
            <section className="mt-6 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-900">
                Choose completed task
              </p>
              <div className="mt-3 grid gap-2">
                {reviewContext.targets.map((target) => (
                  <button
                    key={target.taskId || "job"}
                    type="button"
                    onClick={() => {
                      setSelectedTaskId(target.taskId);
                      setRating(0);
                      setReviewText("");
                      setSelectedTags([]);
                      setErrorMessage("");
                    }}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      selectedTarget?.taskId === target.taskId
                        ? "border-azisto-accent bg-blue-50"
                        : "border-azisto-border bg-white"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold text-slate-900">
                        {target.subcategory}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {target.contractorName}
                      </span>
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        target.reviewed
                          ? "text-emerald-700"
                          : "text-azisto-accent"
                      }`}
                    >
                      {target.reviewed ? "Submitted" : "Review"}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {selectedTarget ? (
            <section className="mt-6 rounded-xl border border-blue-100 bg-white p-4 shadow-[0_8px_24px_rgba(37,99,235,0.08)]">
              <div className="rounded-xl bg-blue-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-azisto-accent">
                  {selectedTarget.serviceCategory}
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {selectedTarget.subcategory}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedTarget.contractorName}
                  {reviewContext?.city ? ` · ${reviewContext.city}` : ""}
                </p>
              </div>

              {selectedTarget.reviewed ? (
                <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                    <Check className="h-4 w-4" />
                    Review submitted
                  </p>
                  <div className="mt-2 text-xl text-[#FFD700]">
                    {"★".repeat(selectedTarget.review?.rating ?? 0)}
                  </div>
                  {selectedTarget.review?.reviewText ? (
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {selectedTarget.review.reviewText}
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <p className="mt-5 text-sm font-bold">Your rating</p>
                  <div className="mt-2 flex justify-between">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRating(value)}
                        className="rounded-full p-1 transition hover:scale-105"
                        aria-label={`${value} star${value === 1 ? "" : "s"}`}
                      >
                        <Star
                          className={`h-9 w-9 ${
                            value <= rating
                              ? "fill-[#FFD700] text-[#FFD700]"
                              : "text-slate-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  <p className="mt-5 text-sm font-bold">What stood out?</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {reviewTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                            isSelected
                              ? "border-azisto-accent bg-blue-50 text-azisto-accent"
                              : "border-slate-200 bg-white text-slate-600"
                          }`}
                        >
                          {isSelected ? "✓ " : ""}
                          {tag}
                        </button>
                      );
                    })}
                  </div>

                  <label className="mt-5 block text-sm font-bold">
                    Review
                  </label>
                  <textarea
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                    maxLength={1200}
                    className="mt-2 min-h-32 w-full resize-none rounded-xl border border-azisto-border px-4 py-3 text-sm outline-none az-focus-field"
                    placeholder="Share what went well..."
                  />
                </>
              )}
            </section>
          ) : null}

          {errorMessage ? (
            <p className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {selectedTarget && !selectedTarget.reviewed ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="az-btn-primary mt-6 flex h-14 w-full items-center justify-center rounded-xl text-sm font-bold"
            >
              {isSubmitting ? "Submitting..." : "Submit review"}
            </button>
          ) : null}
        </div>
        <BottomNav role="customer" />
      </div>
    </main>
  );
}
