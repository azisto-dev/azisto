import Link from "next/link";
import { Mail, ShieldAlert, UserRound, Wrench } from "lucide-react";
import BottomNav from "@/app/components/BottomNav";

const supportSections = [
  {
    title: "User support",
    text: "Help with bookings, messages, job status, and account access.",
    icon: UserRound,
  },
  {
    title: "Contractor support",
    text: "Help with verification, job interest, dashboard access, and future billing.",
    icon: Wrench,
  },
  {
    title: "Safety concerns",
    text: "Report unsafe, suspicious, or abusive activity so AZISTO can review it.",
    icon: ShieldAlert,
  },
];

export default function ContactPage() {
  return (
    <main className="az-customer-shell min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white px-5 pb-0 pt-5 shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <header className="mt-8 flex justify-center">
          <img
            src="/azisto-logo-cropped.png"
            alt="AZISTO - Your on-demand assistant"
            className="w-full max-w-[150px] object-contain"
          />
        </header>

        <section className="mt-10">
          <p className="az-kicker text-xs font-bold uppercase tracking-[0.14em]">
            Support
          </p>
          <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
            Contact AZISTO
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            We usually respond within 1-2 business days.
          </p>
          <a
            href="mailto:support@azisto.ca"
            className="mt-5 flex min-h-14 items-center gap-3 rounded-xl border border-azisto-border bg-white px-4 text-sm font-bold text-black shadow-sm"
          >
            <Mail aria-hidden="true" className="h-5 w-5 text-azisto-gold" />
            support@azisto.ca
          </a>
        </section>

        <section className="mt-6 space-y-3">
          {supportSections.map((section) => {
            const Icon = section.icon;

            return (
              <article
                key={section.title}
                className="rounded-xl border border-azisto-border bg-white p-4 shadow-sm"
              >
                <div className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-black">
                      {section.title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {section.text}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <div className="mt-auto pb-24">
          <Link
            href="/home"
            className="az-btn-primary flex h-12 items-center justify-center rounded-xl text-sm font-bold"
          >
            Back to Home
          </Link>
        </div>
        <BottomNav role="customer" />
      </div>
    </main>
  );
}
