"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { BriefcaseBusiness, ChevronLeft, MapPin } from "lucide-react";
import { auth } from "@/lib/firebase";

type InterestedContractor = {
  contractorId: string;
  contractorName: string;
  businessName: string;
  city: string;
  province: string;
  verificationStatus: string;
  interestedAt: string;
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

async function hireContractor(user: User, jobId: string, contractorId: string) {
  const token = await user.getIdToken();
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/hire`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contractorId,
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

  async function handleMessageContractor(contractorId: string) {
    if (!currentUser || openingContractorId) {
      return;
    }

    try {
      setOpeningContractorId(contractorId);
      setErrorMessage("");
      const threadId = await createMessageThread(
        currentUser,
        jobId,
        contractorId,
      );
      router.push(`/messages/${encodeURIComponent(threadId)}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setOpeningContractorId("");
    }
  }

  async function handleHireContractor(contractorId: string) {
    if (!currentUser || hiringContractorId) {
      return;
    }

    try {
      setHiringContractorId(contractorId);
      setErrorMessage("");
      setSuccessMessage("");
      await hireContractor(currentUser, jobId, contractorId);
      setSuccessMessage("Contractor hired successfully");
      router.push("/customer/jobs");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setHiringContractorId("");
    }
  }

  return (
    <main className="min-h-screen bg-white text-black md:bg-slate-50 md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-slate-200">
        <div className="flex-1 px-5 pb-6 pt-5">
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

          <section className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-500">
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
            <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              Loading interested contractors...
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

          {!isLoading && !errorMessage && contractors.length === 0 ? (
            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
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
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-500">
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
                  <span className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold capitalize text-red-500">
                    {contractor.verificationStatus || "pending"}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
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
                </div>

                <button
                  type="button"
                  onClick={() => handleMessageContractor(contractor.contractorId)}
                  disabled={Boolean(openingContractorId)}
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white shadow-lg shadow-red-100 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                >
                  {openingContractorId === contractor.contractorId
                    ? "Opening conversation..."
                    : "Message contractor"}
                </button>

                <button
                  type="button"
                  onClick={() => handleHireContractor(contractor.contractorId)}
                  disabled={Boolean(hiringContractorId)}
                  className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-red-100 bg-red-50 text-sm font-bold text-red-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {hiringContractorId === contractor.contractorId
                    ? "Hiring..."
                    : "Hire contractor"}
                </button>
              </article>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
