"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  BriefcaseBusiness,
  ChevronLeft,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import BottomNav from "@/app/components/BottomNav";
import AppHeader from "@/app/components/AppHeader";
import AppShimmer from "@/app/components/AppShimmer";

type InterestedContractor = {
  contractorId: string;
  contractorName: string;
  businessName: string;
  city: string;
  province: string;
  verificationStatus: string;
  taskIds: string[];
  taskLabels: string[];
  interestedAt: string;
  ratingAverage: number;
  ratingCount: number;
  completedJobs: number;
  verified: boolean;
};

function createApiError(_code: string, message: string) {
  return new Error(message);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load interested contractors.";
}

function formatInterestedAt(value: string) {
  if (!value) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function fetchInterestedContractors(user: User, jobId: string) {
  const token = await user.getIdToken();
  const response = await fetch(
    `/api/customers/jobs/${encodeURIComponent(jobId)}/interested`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
    interestedContractors?: unknown;
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

  return Array.isArray(responseBody?.interestedContractors)
    ? (responseBody.interestedContractors as InterestedContractor[])
    : [];
}

async function createMessageThread(
  user: User,
  jobId: string,
  contractorId: string,
  selectedTaskIds: string[],
  selectedTaskLabels: string[],
) {
  const token = await user.getIdToken();
  const response = await fetch("/api/messages/threads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jobId,
      contractorId,
      selectedTaskIds,
      selectedTaskLabels,
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

async function hireContractor(
  user: User,
  jobId: string,
  contractorId: string,
  taskIds: string[],
) {
  const token = await user.getIdToken();
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/hire`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contractorId,
      taskIds,
    }),
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

export default function CustomerInterestedContractorsPage() {
  const router = useRouter();
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [contractors, setContractors] = useState<InterestedContractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openingContractorId, setOpeningContractorId] = useState("");
  const [hiringContractorId, setHiringContractorId] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setCurrentUser(user);

      try {
        setIsLoading(true);
        setErrorMessage("");
        const interestedContractors = await fetchInterestedContractors(
          user,
          jobId,
        );
        setContractors(interestedContractors);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [jobId, router]);

  async function handleMessageContractor(contractor: InterestedContractor) {
    if (!currentUser || openingContractorId) {
      return;
    }

    try {
      setOpeningContractorId(contractor.contractorId);
      setErrorMessage("");
      const threadId = await createMessageThread(
        currentUser,
        jobId,
        contractor.contractorId,
        contractor.taskIds,
        contractor.taskLabels,
      );
      router.push(`/messages/${encodeURIComponent(threadId)}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setOpeningContractorId("");
    }
  }

  async function handleHireContractor(contractor: InterestedContractor) {
    if (!currentUser || hiringContractorId) {
      return;
    }

    try {
      setHiringContractorId(contractor.contractorId);
      setErrorMessage("");
      setSuccessMessage("");
      await hireContractor(
        currentUser,
        jobId,
        contractor.contractorId,
        contractor.taskIds,
      );
      setSuccessMessage(
        "Contractor selected. Waiting for them to accept the job.",
      );
      router.push("/customer/jobs");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setHiringContractorId("");
    }
  }

  return (
    <main className="az-customer-shell min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <div className="flex-1 px-5 pb-6 pt-5">
          <AppHeader
            leftControl={
              <Link
                href="/customer/jobs"
                className="flex h-10 w-10 items-center justify-center rounded-full text-black"
                aria-label="Back to my jobs"
              >
                <ChevronLeft aria-hidden="true" className="h-5 w-5" />
              </Link>
            }
          />

          <section className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] az-job-id">
              {jobId}
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
              Interested contractors
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Contractors who expressed interest in your request will appear
              here. You can message a contractor directly from their card.
            </p>
          </section>

          {isLoading ? (
            <AppShimmer className="mt-6" rows={3} />
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

          {!isLoading && !errorMessage && contractors.length === 0 ? (
            <section className="mt-6 rounded-xl border border-azisto-border bg-white p-5 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-azisto-text">
                <BriefcaseBusiness aria-hidden="true" className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-bold text-black">
                No contractors yet
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Interested contractors will show here once they respond.
              </p>
            </section>
          ) : null}

          <section className="mt-6 space-y-4">
            {contractors.map((contractor) => (
              <article
                key={contractor.contractorId}
                className="az-customer-job-card rounded-xl border bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] az-job-id">
                      {contractor.contractorId}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-black">
                      {contractor.businessName ||
                        contractor.contractorName ||
                        "Contractor"}
                    </h2>
                    {contractor.contractorName ? (
                      <p className="mt-1 text-sm text-slate-600">
                        {contractor.contractorName}
                      </p>
                    ) : null}
                  </div>
                  {contractor.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-azisto-accent">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : (
                    <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-700">
                      {contractor.verificationStatus || "pending"}
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                  <div className="grid grid-cols-3 gap-2">
                    <Link
                      href={`/customer/contractors/${encodeURIComponent(
                        contractor.contractorId,
                      )}/reviews?jobId=${encodeURIComponent(jobId)}`}
                      aria-label={`View ratings and reviews for ${
                        contractor.businessName ||
                        contractor.contractorName ||
                        "contractor"
                      }`}
                      className="cursor-pointer rounded-xl bg-blue-50 px-2 py-2 text-center transition hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98]"
                    >
                      <p className="flex items-center justify-center gap-1 text-sm font-bold text-slate-900">
                        {contractor.ratingAverage > 0
                          ? contractor.ratingAverage.toFixed(1)
                          : "New"}
                        <Star className="h-3.5 w-3.5 fill-[#F5B400] text-[#F5B400]" />
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500">
                        Rating
                      </p>
                    </Link>
                    <Link
                      href={`/customer/contractors/${encodeURIComponent(
                        contractor.contractorId,
                      )}/reviews?jobId=${encodeURIComponent(jobId)}`}
                      aria-label={`View ${contractor.ratingCount} reviews`}
                      className="cursor-pointer rounded-xl bg-slate-50 px-2 py-2 text-center transition hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98]"
                    >
                      <p className="text-sm font-bold text-slate-900">
                        {contractor.ratingCount}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500">
                        Reviews
                      </p>
                    </Link>
                    <div className="rounded-xl bg-emerald-50 px-2 py-2 text-center">
                      <p className="text-sm font-bold text-slate-900">
                        {contractor.completedJobs}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500">
                        Jobs Completed
                      </p>
                    </div>
                  </div>
                  <p className="flex items-center gap-2">
                    <MapPin aria-hidden="true" className="h-4 w-4" />
                    {[contractor.city, contractor.province]
                      .filter(Boolean)
                      .join(", ") || "Location not provided"}
                  </p>
                  <p>
                    <span className="font-bold text-slate-800">
                      Interested:
                    </span>{" "}
                    {formatInterestedAt(contractor.interestedAt)}
                  </p>
                  {contractor.taskLabels.length > 0 ? (
                    <div>
                      <p className="font-bold text-slate-800">Can do:</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {contractor.taskLabels.map((taskLabel) => (
                          <span
                            key={taskLabel}
                            className="rounded-full border border-[#F5B400] bg-amber-50 px-3 py-1 text-xs font-bold text-slate-800"
                          >
                            ✓ {taskLabel}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => handleMessageContractor(contractor)}
                  disabled={Boolean(openingContractorId)}
                  className="az-btn-primary mt-4 flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold"
                >
                  {openingContractorId === contractor.contractorId
                    ? "Opening conversation..."
                    : "Message contractor"}
                </button>

                <button
                  type="button"
                  onClick={() => handleHireContractor(contractor)}
                  disabled={Boolean(hiringContractorId)}
                  className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-[#F5B400] bg-white text-sm font-bold text-[#1F1F1F] shadow-sm transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
                >
                  {hiringContractorId === contractor.contractorId
                    ? "Hiring..."
                    : "Hire contractor"}
                </button>
              </article>
            ))}
          </section>
        </div>
        <BottomNav role="customer" />
      </div>
    </main>
  );
}
