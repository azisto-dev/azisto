import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";
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

export default function ContractorPendingVerificationPage() {
  return (
    <main className="az-contractor-shell min-h-screen md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-[var(--azisto-contractor-bg)] shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-[var(--azisto-contractor-border)]">
        <div className="flex flex-1 flex-col px-5 pb-6 pt-5">
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

          <section className="flex flex-1 flex-col justify-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50 shadow-sm">
              <ShieldCheck
                aria-hidden="true"
                className="h-8 w-8 text-amber-700"
              />
            </div>

            <div className="mt-6 text-center">
              <span className="inline-flex items-center justify-center rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                Verification pending
              </span>

              <h1 className="mt-4 text-3xl font-normal leading-tight text-[var(--azisto-contractor-text)]">
                Profile submitted
              </h1>

              <p className="mt-3 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
                Your contractor profile has been submitted for review.
              </p>

              <p className="mt-3 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
                AZISTO will verify your business licence, insurance details,
                and service information before your contractor account is
                approved.
              </p>
            </div>
          </section>

          <Link
            href="/home"
            className="az-btn-contractor mt-6 flex h-14 items-center justify-center rounded-full text-sm font-bold"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
