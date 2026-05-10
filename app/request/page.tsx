"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Calendar, Camera, CheckCircle2, ChevronLeft, Clock } from "lucide-react";

const urgencyOptions = [
  "Flexible",
  "This week",
  "As soon as possible",
  "Emergency",
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-sm font-bold leading-5 text-black">{children}</label>
  );
}

function RequestForm() {
  const searchParams = useSearchParams();
  const selectedService = searchParams.get("service");
  const selectedItems = searchParams.getAll("item");
  const [urgency, setUrgency] = useState("Flexible");
  const [isSubmitted, setIsSubmitted] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitted(true);
  }

  return (
    <main className="min-h-screen bg-white text-black md:bg-slate-50 md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-slate-200">
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
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-500">
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
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
                          <span className="text-red-500">•</span>
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

            <div className="space-y-2">
              <FieldLabel>Job description</FieldLabel>
              <textarea
                className="min-h-32 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-black outline-none transition placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-50"
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
              <FieldLabel>Address or postal code</FieldLabel>
              <input
                type="text"
                className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-black outline-none transition placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-50"
                placeholder="Enter address or postal code"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <FieldLabel>Preferred date</FieldLabel>
                <div className="relative">
                  <input
                    type="date"
                    className="h-14 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-black outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50"
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
                    className="h-14 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-black outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50"
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
                          ? "border-red-500 bg-red-50 text-red-600"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            {isSubmitted ? (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0"
                />
                <p>
                  Request captured for now. We will connect this to accounts and
                  Firebase in a later step.
                </p>
              </div>
            ) : null}

            <button
              type="submit"
              className="flex h-14 w-full items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white shadow-lg shadow-red-100"
            >
              Submit Request
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
