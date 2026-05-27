import Link from "next/link";
import { FileText } from "lucide-react";

const legalSections = [
  "Terms of Service",
  "Privacy Policy",
  "Contractor Agreement",
  "Community Guidelines",
];

export default function LegalPage() {
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
            Legal
          </p>
          <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
            Terms & Privacy
          </h1>
          <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
            Final legal documents should be reviewed before production launch.
          </p>
        </section>

        <section className="mt-6 space-y-3">
          {legalSections.map((section) => (
            <article
              key={section}
              className="rounded-xl border border-azisto-border bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black">
                  <FileText aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-black">{section}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Placeholder content coming soon.
                  </p>
                </div>
              </div>
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
