"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Calendar, Camera, ChevronLeft, Clock } from "lucide-react";
import { auth } from "@/lib/firebase";

const urgencyOptions = [
  "Flexible",
  "This week",
  "As soon as possible",
  "Emergency",
];

type JobRequestForm = {
  jobDescription: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  preferredDate: string;
  preferredTime: string;
};

const initialJobRequestForm: JobRequestForm = {
  jobDescription: "",
  address: "",
  city: "",
  province: "",
  postalCode: "",
  preferredDate: "",
  preferredTime: "",
};

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-sm font-bold leading-5 text-black">{children}</label>
  );
}

function createApiError(code: string, message: string) {
  return new Error(`${message}\n\nCode: ${code}`);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("customer-profile-required")) {
      return "Please sign in or create a customer account before posting a job.";
    }

    return error.message;
  }

  return "Unable to submit your request.";
}

async function submitJobRequest(
  user: User,
  form: JobRequestForm,
  selectedServiceCategory: string,
  selectedSubcategories: string[],
  urgency: string,
) {
  const token = await user.getIdToken();

  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      selectedServiceCategory,
      selectedSubcategories,
      jobDescription: form.jobDescription,
      photos: [],
      photoPlaceholders: [],
      address: form.address,
      city: form.city,
      province: form.province,
      postalCode: form.postalCode,
      preferredDate: form.preferredDate,
      preferredTime: form.preferredTime,
      urgency,
    }),
  });

  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
    jobId?: unknown;
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

  return {
    jobId: typeof responseBody?.jobId === "string" ? responseBody.jobId : "",
    status: typeof responseBody?.status === "string" ? responseBody.status : "",
  };
}

function RequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedService = searchParams.get("service") ?? "";
  const selectedItems = searchParams.getAll("item");
  const [form, setForm] = useState<JobRequestForm>(initialJobRequestForm);
  const [urgency, setUrgency] = useState("Flexible");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const todayDate = getTodayDateString();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (!user) {
        router.replace("/login?reason=submit-request");
      }
    });

    return unsubscribe;
  }, [router]);

  function updateField(field: keyof JobRequestForm, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (authLoading || isSubmitting) {
      return;
    }

    const user = currentUser;

    if (!user) {
      router.push("/login?reason=submit-request");
      return;
    }

    if (form.jobDescription.trim().length < 20) {
      setErrorMessage("Please describe the job in at least 20 characters.");
      return;
    }

    if (
      !form.address.trim() ||
      !form.city.trim() ||
      !form.province.trim() ||
      !form.postalCode.trim()
    ) {
      setErrorMessage(
        "Please enter the service address, city, province, and postal code.",
      );
      return;
    }

    if (form.preferredDate && form.preferredDate < todayDate) {
      setErrorMessage("Please choose today or a future date.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const submittedJob = await submitJobRequest(
        user,
        form,
        selectedService,
        selectedItems,
        urgency,
      );

      router.push(
        `/request/submitted?jobId=${encodeURIComponent(
          submittedJob.jobId,
        )}&status=${encodeURIComponent(submittedJob.status)}`,
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
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
            <Link
              href="/home"
              className="flex h-10 w-10 items-center justify-center rounded-full text-black"
              aria-label="Back to home"
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
            <p className="text-xs font-bold uppercase tracking-[0.14em] az-kicker">
              Request details
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
              Tell us about the job
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Share the basics now. AZISTO will use this to prepare your request
              before matching you with help.
            </p>
          </section>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <section className="rounded-xl border border-azisto-border bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-black">
                Selected service summary
              </p>
              {selectedService || selectedItems.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {selectedService ? (
                    <p className="text-sm font-semibold text-slate-700">
                      {selectedService}
                    </p>
                  ) : null}

                  {selectedItems.length > 0 ? (
                    <ul className="space-y-2 text-sm leading-6 text-slate-600">
                      {selectedItems.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-azisto-text">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm leading-6 text-slate-600">
                      No subcategories selected yet.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Your selected service and subcategories will appear here.
                </p>
              )}
            </section>

            {/* TODO: Replace this placeholder with Firebase Phone Auth before production. */}
            <section className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              <p className="font-bold">Phone verification required soon</p>
              <p className="mt-1">
                You can post now, but AZISTO will require phone verification
                before full marketplace matching is enabled.
              </p>
            </section>

            <div className="space-y-2">
              <FieldLabel>Job description</FieldLabel>
              <textarea
                value={form.jobDescription}
                onChange={(event) =>
                  updateField("jobDescription", event.target.value)
                }
                className="min-h-32 w-full resize-none rounded-xl border border-azisto-border bg-white px-4 py-3 text-sm leading-6 text-black outline-none transition placeholder:text-slate-400 az-focus-field"
                placeholder="Describe what you need help with..."
              />
            </div>

            <div className="space-y-2">
              <FieldLabel>Photos</FieldLabel>
              <button
                type="button"
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm font-bold text-slate-700"
              >
                <Camera aria-hidden="true" className="h-5 w-5" />
                Add photos
              </button>
            </div>

            <div className="space-y-2">
              <FieldLabel>Address</FieldLabel>
              <input
                type="text"
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
                className="h-14 w-full rounded-xl border border-azisto-border bg-white px-4 text-sm text-black outline-none transition placeholder:text-slate-400 az-focus-field"
                placeholder="Enter service address"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <FieldLabel>City</FieldLabel>
                <input
                  type="text"
                  value={form.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  className="h-14 w-full rounded-xl border border-azisto-border bg-white px-4 text-sm text-black outline-none transition placeholder:text-slate-400 az-focus-field"
                  placeholder="City"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Province</FieldLabel>
                <input
                  type="text"
                  value={form.province}
                  onChange={(event) =>
                    updateField("province", event.target.value)
                  }
                  className="h-14 w-full rounded-xl border border-azisto-border bg-white px-4 text-sm text-black outline-none transition placeholder:text-slate-400 az-focus-field"
                  placeholder="BC"
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel>Postal code</FieldLabel>
              <input
                type="text"
                value={form.postalCode}
                onChange={(event) =>
                  updateField("postalCode", event.target.value)
                }
                className="h-14 w-full rounded-xl border border-azisto-border bg-white px-4 text-sm text-black outline-none transition placeholder:text-slate-400 az-focus-field"
                placeholder="Postal code"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <FieldLabel>Preferred date</FieldLabel>
                <div className="relative">
                  <input
                    type="date"
                    min={todayDate}
                    value={form.preferredDate}
                    onChange={(event) =>
                      updateField("preferredDate", event.target.value)
                    }
                    className="h-14 w-full rounded-xl border border-azisto-border bg-white px-3 text-sm text-black outline-none transition az-focus-field"
                  />
                  <Calendar
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel>Preferred time</FieldLabel>
                <div className="relative">
                  <input
                    type="time"
                    value={form.preferredTime}
                    onChange={(event) =>
                      updateField("preferredTime", event.target.value)
                    }
                    className="h-14 w-full rounded-xl border border-azisto-border bg-white px-3 text-sm text-black outline-none transition az-focus-field"
                  />
                  <Clock
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel>Urgency</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {urgencyOptions.map((option) => {
                  const isSelected = urgency === option;

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setUrgency(option)}
                      className={`min-h-12 rounded-xl border px-3 py-2 text-sm font-bold leading-5 transition ${
                        isSelected
                          ? "border-azisto-gold bg-white text-azisto-text shadow-sm shadow-azisto-gold/10"
                          : "border-azisto-gold bg-white text-slate-700"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            {authLoading ? (
              <p className="rounded-xl border border-azisto-border bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                Checking account...
              </p>
            ) : null}

            {errorMessage ? (
              <p className="whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={authLoading || isSubmitting}
              className="az-btn-primary flex h-14 w-full items-center justify-center rounded-xl text-sm font-bold"
            >
              {authLoading
                ? "Checking account..."
                : isSubmitting
                  ? "Submitting..."
                  : "Submit Request"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function RequestPage() {
  return (
    <Suspense>
      <RequestForm />
    </Suspense>
  );
}
