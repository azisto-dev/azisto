import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const safetyItems = [
  "Keep communication inside AZISTO until booking is confirmed.",
  "Report unsafe or suspicious jobs.",
  "Contractors are reviewed before approval.",
  "Do not share payment details outside AZISTO.",
  "Use in-app messaging for records.",
];

export default function HelpSafetyPage() {
  return (
    <main className="min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white px-5 py-5 shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <header className="mt-8 flex justify-center">
          <img
            src="/azisto-logo-cropped.png"
            alt="AZISTO - Your on-demand assistant"
            className="w-full max-w-[165px] object-contain"
          />
        </header>

        <section className="mt-10">
          <p className="az-kicker text-xs font-bold uppercase tracking-[0.14em]">
            Trust & safety
          </p>
          <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
            Help & Safety
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Simple guidelines for safer AZISTO bookings.
          </p>
        </section>

        <section className="mt-6 space-y-3">
          {safetyItems.map((item) => (
            <article
              key={item}
              className="flex gap-3 rounded-xl border border-azisto-border bg-white p-4 shadow-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-black">
                <ShieldCheck aria-hidden="true" className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold leading-6 text-slate-700">
                {item}
              </p>
            </article>
          ))}
        </section>

        <Link
          href="/home"
          className="az-btn-primary mt-auto flex h-12 items-center justify-center rounded-xl text-sm font-bold"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
