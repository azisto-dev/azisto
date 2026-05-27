"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ChevronLeft, Star } from "lucide-react";
import { auth } from "@/lib/firebase";
import BottomNav from "@/app/components/BottomNav";

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

async function submitReview(
  user: User,
  jobId: string,
  rating: number,
  reviewText: string,
) {
  const token = await user.getIdToken();
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/review`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rating, reviewText }),
  });
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(typeof body?.message === "string" ? body.message : "Unable to submit review.");
  }
}

export default function CustomerJobReviewPage() {
  const router = useRouter();
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const [user, setUser] = useState<User | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);
    });

    return unsubscribe;
  }, [router]);

  async function handleSubmit() {
    if (!user || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setErrorMessage("");
      await submitReview(user, jobId, rating, reviewText);
      router.push("/customer/jobs");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to submit review.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <div className="flex-1 px-5 pb-6 pt-5">
          <StatusBar />
          <header className="mt-3 grid grid-cols-[40px_1fr_40px] items-center">
            <button type="button" onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full text-black" aria-label="Go back">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <Link href="/home" className="flex justify-center">
              <img src="/azisto-logo-cropped.png" alt="AZISTO" className="w-full max-w-[165px] object-contain" />
            </Link>
            <span aria-hidden="true" />
          </header>
          <section className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] az-job-id">{jobId}</p>
            <h1 className="mt-1 text-3xl font-bold leading-tight">Review contractor</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Your feedback helps keep AZISTO trustworthy.</p>
          </section>
          <section className="mt-6 rounded-xl border border-azisto-border bg-white p-4 shadow-sm">
            <p className="text-sm font-bold">Rating</p>
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" onClick={() => setRating(value)} className="rounded-full p-1">
                  <Star className={`h-8 w-8 ${value <= rating ? "fill-[#FFD700] text-[#FFD700]" : "text-slate-300"}`} />
                </button>
              ))}
            </div>
            <label className="mt-5 block text-sm font-bold">Review</label>
            <textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} className="mt-2 min-h-32 w-full resize-none rounded-xl border border-azisto-border px-4 py-3 text-sm outline-none az-focus-field" placeholder="Share what went well..." />
          </section>
          {errorMessage ? <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p> : null}
          <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="az-btn-primary mt-6 flex h-14 w-full items-center justify-center rounded-xl text-sm font-bold">
            {isSubmitting ? "Submitting..." : "Submit review"}
          </button>
        </div>
        <BottomNav role="customer" />
      </div>
    </main>
  );
}
