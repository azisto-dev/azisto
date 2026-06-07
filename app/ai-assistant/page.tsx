"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Sparkles } from "lucide-react";
import NotificationBell from "@/app/components/NotificationBell";

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

export default function AiAssistantPage() {
  const [message, setMessage] = useState("");

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

            <NotificationBell />
          </header>

          <section className="mt-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50 text-azisto-gold shadow-lg shadow-amber-100">
              <Sparkles aria-hidden="true" className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-3xl font-bold leading-tight text-black">
              AZISTO AI Assistant
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Describe your issue in your own words and we’ll suggest the right
              services.
            </p>
          </section>

          <section className="mt-6 space-y-4 rounded-xl border border-azisto-border bg-white p-4 shadow-sm">
            <textarea
              className="min-h-40 w-full resize-none rounded-xl border border-azisto-border bg-white px-4 py-3 text-sm leading-6 text-black outline-none placeholder:text-slate-400 az-focus-field"
              placeholder="Example: My kitchen sink is leaking under the cabinet…"
            />

            {message ? (
              <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                {message}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => setMessage("AI suggestions coming soon.")}
              className="az-btn-primary flex h-14 w-full items-center justify-center rounded-xl text-sm font-bold"
            >
              Suggest services
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
