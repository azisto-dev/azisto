"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { ChevronLeft } from "lucide-react";
import { auth, db } from "@/lib/firebase";

const contactMethods = ["In-app message", "Phone call", "Text message"];

type CustomerForm = {
  fullName: string;
  phoneNumber: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
};

const initialForm: CustomerForm = {
  fullName: "",
  phoneNumber: "",
  address: "",
  city: "",
  province: "",
  postalCode: "",
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

function getCustomerSaveErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const errorCode =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const details = `${errorCode} ${message}`.toLowerCase();

  if (
    errorCode === "permission-denied" ||
    errorCode === "firestore/permission-denied" ||
    details.includes("permission-denied") ||
    details.includes("missing or insufficient permissions")
  ) {
    return "Firestore permission denied. Check Firebase rules.";
  }

  if (
    errorCode === "unauthenticated" ||
    errorCode === "firestore/unauthenticated" ||
    details.includes("unauthenticated") ||
    details.includes("auth/user-token-expired") ||
    details.includes("auth/id-token-expired") ||
    details.includes("securetoken") ||
    details.includes("id token")
  ) {
    return "Please sign in again.";
  }

  if (
    errorCode === "unavailable" ||
    errorCode === "firestore/unavailable" ||
    errorCode === "deadline-exceeded" ||
    errorCode === "firestore/deadline-exceeded" ||
    details.includes("unavailable") ||
    details.includes("deadline-exceeded") ||
    details.includes("network")
  ) {
    return "Firebase connection failed. Try again.";
  }

  return "Unable to save your customer profile. Please try again.";
}

export default function CustomerOnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState<CustomerForm>(initialForm);
  const [preferredContactMethod, setPreferredContactMethod] =
    useState("In-app message");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Customer onboarding: auth state loaded");

      if (user) {
        console.log("Customer onboarding auth user UID:", user.uid);
        setCurrentUser(user);
      } else {
        console.log(
          "Customer onboarding: no auth user, redirecting to login",
        );
        setCurrentUser(null);
        router.replace("/login?reason=customer-onboarding");
      }

      setAuthLoading(false);
    });

    return unsubscribe;
  }, [router]);

  function updateField(field: keyof CustomerForm, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function handleContinue() {
    if (isSaving || authLoading) {
      return;
    }

    const user = currentUser;

    if (!user) {
      console.log(
        "Customer onboarding: no loaded user, redirecting to login",
      );
      router.push("/login?reason=customer-onboarding");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");

      console.log("Customer onboarding current user UID:", user.uid);
      console.log("Customer onboarding: before saving customer");

      await setDoc(
        doc(db, "customers", user.uid),
        {
          userId: user.uid,
          fullName: form.fullName,
          phoneNumber: form.phoneNumber,
          address: form.address,
          city: form.city,
          province: form.province,
          postalCode: form.postalCode,
          preferredContactMethod,
          role: "customer",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      console.log("Customer onboarding: customer saved successfully");
      router.push("/home");
    } catch (error) {
      console.error("Customer onboarding Firestore error:", error);
      setErrorMessage(getCustomerSaveErrorMessage(error));
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
              Customer profile
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
              Set up your customer profile
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This helps contractors contact you and understand where service is
              needed.
            </p>
          </section>

          <form className="mt-6 space-y-5">
            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="space-y-2">
                <FieldLabel>Full name</FieldLabel>
                <input
                  value={form.fullName}
                  onChange={(event) =>
                    updateField("fullName", event.target.value)
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
                <FieldLabel>Address</FieldLabel>
                <input
                  value={form.address}
                  onChange={(event) =>
                    updateField("address", event.target.value)
                  }
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <FieldLabel>City</FieldLabel>
                  <input
                    value={form.city}
                    onChange={(event) =>
                      updateField("city", event.target.value)
                    }
                    className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Province</FieldLabel>
                  <input
                    value={form.province}
                    onChange={(event) =>
                      updateField("province", event.target.value)
                    }
                    className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel>Postal code</FieldLabel>
                <input
                  value={form.postalCode}
                  onChange={(event) =>
                    updateField("postalCode", event.target.value)
                  }
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-base font-bold text-black">
                Preferred contact method
              </p>

              <div className="grid gap-2">
                {contactMethods.map((method) => {
                  const isSelected = preferredContactMethod === method;

                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPreferredContactMethod(method)}
                      className={`flex h-12 items-center justify-between rounded-xl border px-4 text-sm font-bold transition ${
                        isSelected
                          ? "border-red-500 bg-red-50 text-red-600"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <span>{method}</span>
                      <span
                        className={`h-4 w-4 rounded-full border ${
                          isSelected
                            ? "border-red-500 bg-red-500"
                            : "border-slate-300 bg-white"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </section>

            {authLoading ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                Checking account...
              </p>
            ) : null}

            {errorMessage ? (
              <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleContinue}
              disabled={isSaving || authLoading}
              className="flex h-14 w-full items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white shadow-lg shadow-red-100 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
            >
              {authLoading
                ? "Checking account..."
                : isSaving
                  ? "Saving..."
                  : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
