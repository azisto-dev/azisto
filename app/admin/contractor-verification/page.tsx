"use client";

import { useState } from "react";
import { CheckCircle2, FileWarning, XCircle } from "lucide-react";

const initialContractors = [
  {
    name: "North Shore Home Pros",
    services: "Handyman, Plumbing, Drywall Repair",
    licenceStatus: "Submitted",
    insuranceStatus: "Submitted",
    verificationStatus: "Pending Review",
  },
  {
    name: "Evergreen Garden Crew",
    services: "Lawn Mowing, Tree Trimming, Snow Removal",
    licenceStatus: "Submitted",
    insuranceStatus: "Submitted",
    verificationStatus: "Pending Review",
  },
  {
    name: "Rapid Roadside BC",
    services: "Flatbed Towing, Battery Jump-start, Fuel Delivery",
    licenceStatus: "Submitted",
    insuranceStatus: "Submitted",
    verificationStatus: "Pending Review",
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

export default function ContractorVerificationAdminPage() {
  const [contractors, setContractors] = useState(initialContractors);

  function updateStatus(contractorName: string, nextStatus: string) {
    setContractors((currentContractors) =>
      currentContractors.map((contractor) => {
        if (contractor.name !== contractorName) {
          return contractor;
        }

        return {
          ...contractor,
          verificationStatus: nextStatus,
        };
      }),
    );
  }

  return (
    <main className="min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <div className="flex-1 px-5 pb-6 pt-5">
          <StatusBar />

          <header className="mt-3 flex justify-center">
            <img
              src="/azisto-logo-cropped.png"
              alt="AZISTO - Your on-demand assistant"
              className="w-full max-w-[165px] object-contain"
            />
          </header>

          <section className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] az-kicker">
              Admin review
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
              Contractor Verification
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Review submitted contractor licence and insurance details. These
              controls are local placeholders for now.
            </p>
          </section>

          <section className="mt-6 space-y-4">
            {contractors.map((contractor) => (
              <article
                key={contractor.name}
                className="rounded-xl border border-azisto-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-black">
                      {contractor.name}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {contractor.services}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                    {contractor.verificationStatus}
                  </span>
                </div>

                <dl className="mt-4 grid gap-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Licence status</dt>
                    <dd className="font-semibold text-black">
                      {contractor.licenceStatus}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Insurance status</dt>
                    <dd className="font-semibold text-black">
                      {contractor.insuranceStatus}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Verification status</dt>
                    <dd className="font-semibold text-black">
                      {contractor.verificationStatus}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={() => updateStatus(contractor.name, "Approved")}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white"
                  >
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateStatus(contractor.name, "Changes Requested")
                    }
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 text-sm font-bold text-amber-800"
                  >
                    <FileWarning aria-hidden="true" className="h-4 w-4" />
                    Request Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(contractor.name, "Rejected")}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-bold text-red-700"
                  >
                    <XCircle aria-hidden="true" className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
