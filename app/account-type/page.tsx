import Link from "next/link";

const accountTypes = [
  {
    title: "Customer",
    description:
      "Find trusted help for home, car, pet, garden, moving, and roadside services.",
    buttonText: "Continue as Customer",
    href: "/home",
  },
  {
    title: "Contractor",
    description:
      "Offer your services, receive job requests, and manage your AZISTO subscription.",
    buttonText: "Continue as Contractor",
    href: "/contractor/onboarding",
  },
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

export default function AccountTypePage() {
  return (
    <main className="min-h-screen bg-white text-black md:bg-slate-50 md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-slate-200">
        <div className="flex-1 px-5 pb-6 pt-5">
          <StatusBar />

          <header className="mt-3 flex justify-center">
            <img
              src="/azisto-logo-cropped.png"
              alt="AZISTO - Your on-demand assistant"
              className="w-full max-w-[175px] object-contain"
            />
          </header>

          <section className="mt-10">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-500">
              Account type
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
              How will you use AZISTO?
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Choose the experience that fits what you want to do next.
            </p>
          </section>

          <section className="mt-7 space-y-4">
            {accountTypes.map((accountType) => (
              <article
                key={accountType.title}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h2 className="text-xl font-bold text-black">
                  {accountType.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {accountType.description}
                </p>
                <Link
                  href={accountType.href}
                  className={`mt-5 flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold ${
                    accountType.title === "Customer"
                      ? "bg-red-500 text-white shadow-lg shadow-red-100"
                      : "border border-slate-300 bg-white text-slate-900"
                  }`}
                >
                  {accountType.buttonText}
                </Link>
              </article>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
