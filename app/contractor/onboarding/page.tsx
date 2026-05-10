"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { ChevronLeft, FileText, ShieldCheck, Upload } from "lucide-react";
import { auth, db } from "@/lib/firebase";

const documentFields = [
  "Business licence document",
  "Insurance certificate",
  "Government ID",
  "Optional additional certification",
];

type FileNames = Record<string, string>;

type ContractorForm = {
  displayName: string;
  phoneNumber: string;
  serviceAreaPostalCode: string;
  serviceRadius: string;
  servicesOffered: string;
  yearsExperience: string;
  bio: string;
  legalBusinessName: string;
  businessNumber: string;
  businessLicenceNumber: string;
  businessLicenceExpiryDate: string;
  insuranceProviderName: string;
  insurancePolicyNumber: string;
  insuranceExpiryDate: string;
  coverageAmount: string;
};

const initialForm: ContractorForm = {
  displayName: "",
  phoneNumber: "",
  serviceAreaPostalCode: "",
  serviceRadius: "",
  servicesOffered: "",
  yearsExperience: "",
  bio: "",
  legalBusinessName: "",
  businessNumber: "",
  businessLicenceNumber: "",
  businessLicenceExpiryDate: "",
  insuranceProviderName: "",
  insurancePolicyNumber: "",
  insuranceExpiryDate: "",
  coverageAmount: "",
};

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

export default function ContractorOnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState<ContractorForm>(initialForm);
  const [verificationStatus, setVerificationStatus] = useState("Not submitted");
  const [fileNames, setFileNames] = useState<FileNames>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function updateField(field: keyof ContractorForm, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function handleFileChange(field: string, fileList: FileList | null) {
    const file = fileList?.[0];

    if (!file) {
      return;
    }

    setFileNames((currentNames) => ({
      ...currentNames,
      [field]: file.name,
    }));
  }

  async function handleContinue() {
    const user = auth.currentUser;

    if (!user) {
      router.push("/login?reason=contractor-onboarding");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");

      await setDoc(
        doc(db, "contractors", user.uid),
        {
          userId: user.uid,
          displayName: form.displayName,
          phoneNumber: form.phoneNumber,
          serviceAreaPostalCode: form.serviceAreaPostalCode,
          serviceRadius: form.serviceRadius,
          servicesOffered: form.servicesOffered,
          yearsExperience: form.yearsExperience,
          bio: form.bio,
          legalBusinessName: form.legalBusinessName,
          businessNumber: form.businessNumber,
          businessLicenceNumber: form.businessLicenceNumber,
          businessLicenceExpiryDate: form.businessLicenceExpiryDate,
          insuranceProviderName: form.insuranceProviderName,
          insurancePolicyNumber: form.insurancePolicyNumber,
          insuranceExpiryDate: form.insuranceExpiryDate,
          coverageAmount: form.coverageAmount,
          verificationStatus: "pending_review",
          subscriptionStatus: "not_started",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setVerificationStatus("Pending review");
      router.push("/contractor/subscription");
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to save your contractor profile.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black md:bg-slate-50 md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-slate-200">
        <div className="flex-1 px-5 pb-6 pt-5">
          <StatusBar />

          <header className="mt-3 grid grid-cols-[40px_1fr_40px] items-center">
            <Link
              href="/account-type"
              className="flex h-10 w-10 items-center justify-center rounded-full text-black"
              aria-label="Back to account type"
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
              Contractor verification
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
              Verify your business
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Share your licence, insurance, and identity documents so AZISTO
              can review your contractor profile.
            </p>
          </section>

          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
                <ShieldCheck aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-black">
                  Verification status
                </p>
                <p className="mt-1 text-sm font-semibold text-red-500">
                  {verificationStatus}
                </p>
              </div>
            </div>
          </section>

          <form className="mt-6 space-y-5">
            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="text-base font-bold text-black">
                  Contractor profile
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Tell AZISTO how customers should see your contractor profile.
                </p>
              </div>

              <div className="space-y-2">
                <FieldLabel>Display name</FieldLabel>
                <input
                  value={form.displayName}
                  onChange={(event) =>
                    updateField("displayName", event.target.value)
                  }
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Phone number</FieldLabel>
                <input
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(event) =>
                    updateField("phoneNumber", event.target.value)
                  }
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Service area postal code</FieldLabel>
                <input
                  value={form.serviceAreaPostalCode}
                  onChange={(event) =>
                    updateField("serviceAreaPostalCode", event.target.value)
                  }
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Service radius</FieldLabel>
                <input
                  value={form.serviceRadius}
                  onChange={(event) =>
                    updateField("serviceRadius", event.target.value)
                  }
                  placeholder="25 km"
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Services offered</FieldLabel>
                <input
                  value={form.servicesOffered}
                  onChange={(event) =>
                    updateField("servicesOffered", event.target.value)
                  }
                  placeholder="Handyman, plumbing, moving..."
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Years experience</FieldLabel>
                <input
                  type="number"
                  min="0"
                  value={form.yearsExperience}
                  onChange={(event) =>
                    updateField("yearsExperience", event.target.value)
                  }
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Bio</FieldLabel>
                <textarea
                  value={form.bio}
                  onChange={(event) => updateField("bio", event.target.value)}
                  placeholder="A short summary of your experience..."
                  className="min-h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="text-base font-bold text-black">
                  Business verification
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Documents will be reviewed by AZISTO before your contractor
                  profile is approved.
                </p>
              </div>

              <div className="space-y-2">
                <FieldLabel>Legal business name</FieldLabel>
                <input
                  value={form.legalBusinessName}
                  onChange={(event) =>
                    updateField("legalBusinessName", event.target.value)
                  }
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Business number / registration number</FieldLabel>
                <input
                  value={form.businessNumber}
                  onChange={(event) =>
                    updateField("businessNumber", event.target.value)
                  }
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Business licence number</FieldLabel>
                <input
                  value={form.businessLicenceNumber}
                  onChange={(event) =>
                    updateField("businessLicenceNumber", event.target.value)
                  }
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Business licence expiry date</FieldLabel>
                <input
                  type="date"
                  value={form.businessLicenceExpiryDate}
                  onChange={(event) =>
                    updateField(
                      "businessLicenceExpiryDate",
                      event.target.value,
                    )
                  }
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Insurance provider name</FieldLabel>
                <input
                  value={form.insuranceProviderName}
                  onChange={(event) =>
                    updateField("insuranceProviderName", event.target.value)
                  }
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Insurance policy number</FieldLabel>
                <input
                  value={form.insurancePolicyNumber}
                  onChange={(event) =>
                    updateField("insurancePolicyNumber", event.target.value)
                  }
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Insurance expiry date</FieldLabel>
                <input
                  type="date"
                  value={form.insuranceExpiryDate}
                  onChange={(event) =>
                    updateField("insuranceExpiryDate", event.target.value)
                  }
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Coverage amount</FieldLabel>
                <input
                  type="text"
                  value={form.coverageAmount}
                  onChange={(event) =>
                    updateField("coverageAmount", event.target.value)
                  }
                  placeholder="$2,000,000"
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="text-base font-bold text-black">
                  Verification documents
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Upload placeholders only for now. Files stay local in this
                  form until storage is added.
                </p>
              </div>

              {documentFields.map((field) => (
                <label
                  key={field}
                  className="flex min-h-16 cursor-pointer items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-red-500 shadow-sm">
                      <FileText aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-black">
                        {field}
                      </span>
                      <span className="block truncate text-xs leading-5 text-slate-500">
                        {fileNames[field] ?? "Choose file"}
                      </span>
                    </span>
                  </span>

                  <Upload
                    aria-hidden="true"
                    className="ml-3 h-5 w-5 shrink-0 text-slate-500"
                  />
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(event) =>
                      handleFileChange(field, event.currentTarget.files)
                    }
                  />
                </label>
              ))}
            </section>

            {errorMessage ? (
              <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleContinue}
              disabled={isSaving}
              className="flex h-14 w-full items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white shadow-lg shadow-red-100 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
            >
              {isSaving ? "Saving..." : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
