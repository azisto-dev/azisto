import Link from "next/link";

export default function ContractorSubscriptionPage() {
  return (
    <main className="az-contractor-shell min-h-screen md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-[var(--azisto-contractor-bg)] shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-[var(--azisto-contractor-border)]">
        <div className="flex flex-1 flex-col px-5 pb-6 pt-5">
          <div className="mb-5 flex items-center justify-between text-xs font-bold">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-3 rounded-sm bg-black" />
              <span className="h-2.5 w-3 rounded-sm border border-black" />
              <span className="h-2.5 w-5 rounded-sm bg-black" />
            </div>
          </div>

          <header className="mt-3 flex justify-center">
            <img
              src="/azisto-logo-cropped.png"
              alt="AZISTO - Your on-demand assistant"
              className="w-full max-w-[175px] object-contain"
            />
          </header>

          <section className="flex flex-1 flex-col justify-center text-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--azisto-contractor-burgundy)]">
              Contractor billing
            </p>
            <h1 className="mt-2 text-3xl font-normal leading-tight text-[var(--azisto-contractor-text)]">
              Subscription settings coming soon
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
              Contractors will manage subscription plans and billing here once
              AZISTO plan management is ready.
            </p>
            <Link
              href="/home"
              className="az-btn-contractor mt-7 flex h-12 items-center justify-center rounded-full text-sm font-bold"
            >
              Back to Home
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
