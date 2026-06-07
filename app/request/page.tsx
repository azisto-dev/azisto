"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Calendar, Camera, ChevronLeft, Clock, LocateFixed, MapPin } from "lucide-react";
import { auth } from "@/lib/firebase";
import BottomNav from "@/app/components/BottomNav";
import NotificationBell from "@/app/components/NotificationBell";

const scheduleModeOptions = [
  {
    value: "specific",
    label: "Pick date & time",
    subtext: "I know when I need help.",
  },
  {
    value: "urgency",
    label: "Choose urgency",
    subtext: "I need flexible or urgent help.",
  },
] as const;

const timeWindowOptions = ["Morning", "Afternoon", "Evening", "Anytime"];

const urgencyOptions = [
  "Flexible",
  "This week",
  "As soon as possible",
  "Emergency",
];

type ScheduleMode = (typeof scheduleModeOptions)[number]["value"];
type LocationMode = "manual" | "live";
type LiveLocation = {
  lat: number;
  lng: number;
};

type JobRequestForm = {
  jobDescription: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  preferredDate: string;
  preferredTimeWindow: string;
};

type SelectedSubcategoryGroup = {
  subcategory: string;
  group: string;
};

const initialJobRequestForm: JobRequestForm = {
  jobDescription: "",
  address: "",
  city: "",
  province: "",
  postalCode: "",
  preferredDate: "",
  preferredTimeWindow: "",
};

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

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

function createApiError(_code: string, message: string) {
  return new Error(message);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("customer-profile-required")) {
      return "Please sign in or create a user account before posting a job.";
    }

    return error.message;
  }

  return "Unable to submit your request.";
}

async function submitJobRequest(
  user: User,
  form: JobRequestForm,
  selectedServiceCategory: string,
  selectedSubcategories: string[],
  selectedSubcategoryGroups: SelectedSubcategoryGroup[],
  locationMode: LocationMode,
  liveLocation: LiveLocation | null,
  scheduleMode: ScheduleMode,
  urgency: string,
) {
  const token = await user.getIdToken();

  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      selectedServiceCategory,
      selectedSubcategories,
      selectedSubcategoryGroups,
      jobDescription: form.jobDescription,
      photos: [],
      photoPlaceholders: [],
      address: form.address,
      city: form.city,
      province: form.province,
      postalCode: form.postalCode,
      locationMode,
      location:
        locationMode === "live" && liveLocation
          ? {
              lat: liveLocation.lat,
              lng: liveLocation.lng,
            }
          : null,
      scheduleMode,
      preferredDate: scheduleMode === "specific" ? form.preferredDate : null,
      preferredTimeWindow:
        scheduleMode === "specific" ? form.preferredTimeWindow : null,
      preferredTime: null,
      urgency: scheduleMode === "urgency" ? urgency : null,
      schedule:
        scheduleMode === "specific"
          ? {
              mode: "specific",
              date: form.preferredDate,
              timeWindow: form.preferredTimeWindow,
            }
          : {
              mode: "urgency",
              urgency,
            },
    }),
  });

  const responseBody = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
    jobId?: unknown;
    status?: unknown;
  } | null;

  if (!response.ok) {
    throw createApiError(
      typeof responseBody?.code === "string"
        ? responseBody.code
        : `api/${response.status}`,
      typeof responseBody?.message === "string"
        ? responseBody.message
        : response.statusText,
    );
  }

  return {
    jobId: typeof responseBody?.jobId === "string" ? responseBody.jobId : "",
    status: typeof responseBody?.status === "string" ? responseBody.status : "",
  };
}

function RequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedService = searchParams.get("service") ?? "";
  const selectedItems = searchParams.getAll("item");
  const selectedSubcategoryGroups = searchParams
    .getAll("itemGroup")
    .map((value) => {
      const [subcategory, group] = value.split("|||");

      return {
        subcategory: subcategory?.trim() ?? "",
        group: group?.trim() ?? "",
      };
    })
    .filter((item) => item.subcategory && item.group);
  const [form, setForm] = useState<JobRequestForm>(initialJobRequestForm);
  const [locationMode, setLocationMode] = useState<LocationMode>("manual");
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [locationMessage, setLocationMessage] = useState("");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("urgency");
  const [urgency, setUrgency] = useState("Flexible");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const todayDate = getTodayDateString();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (!user) {
        router.replace("/login?reason=submit-request");
      }
    });

    return unsubscribe;
  }, [router]);

  function updateField(field: keyof JobRequestForm, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function captureLiveLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationMessage(
        "We could not access your location. You can enter the address manually.",
      );
      return;
    }

    setLocationMode("live");
    setLocationStatus("loading");
    setLocationMessage("Getting your location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLiveLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus("success");
        setLocationMessage("Location captured");
      },
      () => {
        setLiveLocation(null);
        setLocationStatus("error");
        setLocationMessage(
          "We could not access your location. You can enter the address manually.",
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 12_000,
      },
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (authLoading || isSubmitting) {
      return;
    }

    const user = currentUser;

    if (!user) {
      router.push("/login?reason=submit-request");
      return;
    }

    if (form.jobDescription.trim().length < 20) {
      setErrorMessage("Please describe the job in at least 20 characters.");
      return;
    }

    if (
      locationMode === "manual" &&
      (!form.address.trim() ||
        !form.city.trim() ||
        !form.province.trim() ||
        !form.postalCode.trim())
    ) {
      setErrorMessage(
        "Please enter the service address, city, province, and postal code.",
      );
      return;
    }

    if (locationMode === "live" && !liveLocation) {
      setErrorMessage("Please capture your live location before submitting.");
      return;
    }

    if (scheduleMode === "specific" && !form.preferredDate) {
      setErrorMessage("Please choose a preferred date.");
      return;
    }

    if (scheduleMode === "specific" && !form.preferredTimeWindow) {
      setErrorMessage("Please choose a preferred time window.");
      return;
    }

    if (
      scheduleMode === "specific" &&
      form.preferredDate &&
      form.preferredDate < todayDate
    ) {
      setErrorMessage("Please choose today or a future date.");
      return;
    }

    if (scheduleMode === "urgency" && !urgency) {
      setErrorMessage("Please choose an urgency.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const submittedJob = await submitJobRequest(
        user,
        form,
        selectedService,
        selectedItems,
        selectedSubcategoryGroups,
        locationMode,
        liveLocation,
        scheduleMode,
        urgency,
      );

      router.push(
        `/request/submitted?jobId=${encodeURIComponent(
          submittedJob.jobId,
        )}&status=${encodeURIComponent(submittedJob.status)}`,
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <div className="flex-1 px-5 pb-28 pt-5">
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
            <p className="text-xs font-bold uppercase tracking-[0.14em] az-kicker">
              Request details
            </p>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-black">
              Tell us about the job
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Share the basics now. AZISTO will use this to prepare your request
              before matching you with help.
            </p>
          </section>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <section className="rounded-xl border border-azisto-border bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-black">
                Selected service summary
              </p>
              {selectedService || selectedItems.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {selectedService ? (
                    <p className="text-sm font-semibold text-slate-700">
                      {selectedService}
                    </p>
                  ) : null}

                  {selectedItems.length > 0 ? (
                    <ul className="space-y-2 text-sm leading-6 text-slate-600">
                      {selectedItems.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-azisto-text">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm leading-6 text-slate-600">
                      No subcategories selected yet.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Your selected service and subcategories will appear here.
                </p>
              )}
            </section>

            {/* TODO: Replace this placeholder with Firebase Phone Auth before production. */}
            <section className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              <p className="font-bold">Phone verification required soon</p>
              <p className="mt-1">
                You can post now, but AZISTO will require phone verification
                before full marketplace matching is enabled.
              </p>
            </section>

            <div className="space-y-2">
              <FieldLabel>Job description</FieldLabel>
              <textarea
                value={form.jobDescription}
                onChange={(event) =>
                  updateField("jobDescription", event.target.value)
                }
                className="min-h-32 w-full resize-none rounded-xl border border-azisto-border bg-white px-4 py-3 text-sm leading-6 text-black outline-none transition placeholder:text-slate-400 az-focus-field"
                placeholder="Describe what you need help with..."
              />
            </div>

            <div className="space-y-2">
              <FieldLabel>Photos</FieldLabel>
              <button
                type="button"
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm font-bold text-slate-700"
              >
                <Camera aria-hidden="true" className="h-5 w-5" />
                Add photos
              </button>
            </div>

            <section className="space-y-3 rounded-[22px] border border-azisto-border bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
              <FieldLabel>Where do you need service?</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={captureLiveLocation}
                  className={`min-h-[108px] rounded-2xl border p-3 text-left transition duration-200 active:scale-[0.98] ${
                    locationMode === "live"
                      ? "border-azisto-accent bg-blue-50 text-[#0F172A] shadow-[0_8px_22px_rgba(37,99,235,0.12)]"
                      : "border-azisto-border bg-white text-slate-700 shadow-sm"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-bold leading-5">
                    <LocateFixed aria-hidden="true" className="h-4 w-4" />
                    Share live location
                  </span>
                  <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">
                    Use your current location for faster matching.
                  </span>
                  <span className="mt-1 block text-[11px] font-semibold leading-4 text-slate-400">
                    Your location is used only for this service request.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLocationMode("manual");
                    setLocationStatus("idle");
                    setLocationMessage("");
                  }}
                  className={`min-h-[108px] rounded-2xl border p-3 text-left transition duration-200 active:scale-[0.98] ${
                    locationMode === "manual"
                      ? "border-azisto-accent bg-blue-50 text-[#0F172A] shadow-[0_8px_22px_rgba(37,99,235,0.12)]"
                      : "border-azisto-border bg-white text-slate-700 shadow-sm"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-bold leading-5">
                    <MapPin aria-hidden="true" className="h-4 w-4" />
                    Enter address manually
                  </span>
                  <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">
                    Type the service address yourself.
                  </span>
                </button>
              </div>

              {locationMode === "live" ? (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-slate-700">
                  <p className="font-bold text-[#0F172A]">
                    {locationMessage || "Getting your location..."}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Your location is used only for this service request.
                  </p>
                  {locationStatus === "success" && liveLocation ? (
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      Lat {liveLocation.lat.toFixed(5)} · Lng{" "}
                      {liveLocation.lng.toFixed(5)}
                    </p>
                  ) : null}
                  {locationStatus === "error" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setLocationMode("manual");
                        setLocationStatus("idle");
                        setLocationMessage("");
                      }}
                      className="az-btn-secondary mt-3 flex h-10 items-center justify-center rounded-xl px-4 text-xs font-bold"
                    >
                      Enter address manually
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  <div className="space-y-2">
                    <FieldLabel>Address</FieldLabel>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(event) =>
                        updateField("address", event.target.value)
                      }
                      className="h-14 w-full rounded-xl border border-azisto-border bg-white px-4 text-sm text-black outline-none transition placeholder:text-slate-400 az-focus-field"
                      placeholder="Enter service address"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <FieldLabel>City</FieldLabel>
                      <input
                        type="text"
                        value={form.city}
                        onChange={(event) =>
                          updateField("city", event.target.value)
                        }
                        className="h-14 w-full rounded-xl border border-azisto-border bg-white px-4 text-sm text-black outline-none transition placeholder:text-slate-400 az-focus-field"
                        placeholder="City"
                      />
                    </div>

                    <div className="space-y-2">
                      <FieldLabel>Province</FieldLabel>
                      <input
                        type="text"
                        value={form.province}
                        onChange={(event) =>
                          updateField("province", event.target.value)
                        }
                        className="h-14 w-full rounded-xl border border-azisto-border bg-white px-4 text-sm text-black outline-none transition placeholder:text-slate-400 az-focus-field"
                        placeholder="BC"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <FieldLabel>Postal code</FieldLabel>
                    <input
                      type="text"
                      value={form.postalCode}
                      onChange={(event) =>
                        updateField("postalCode", event.target.value)
                      }
                      className="h-14 w-full rounded-xl border border-azisto-border bg-white px-4 text-sm text-black outline-none transition placeholder:text-slate-400 az-focus-field"
                      placeholder="Postal code"
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-xl border border-azisto-border bg-white p-4 shadow-sm">
              <FieldLabel>When do you need this done?</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {scheduleModeOptions.map((option) => {
                  const isSelected = scheduleMode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setScheduleMode(option.value)}
                      className={`min-h-[96px] rounded-2xl border p-3 text-left transition duration-200 ${
                        isSelected
                          ? "border-azisto-accent bg-blue-50 text-black shadow-[0_8px_22px_rgba(37,99,235,0.12)]"
                          : "border-azisto-border bg-white text-slate-700 shadow-sm"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-bold leading-5">
                        {option.value === "specific" ? (
                          <Calendar aria-hidden="true" className="h-4 w-4" />
                        ) : (
                          <Clock aria-hidden="true" className="h-4 w-4" />
                        )}
                        {option.label}
                      </span>
                      <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">
                        {option.subtext}
                      </span>
                    </button>
                  );
                })}
              </div>

              {scheduleMode === "specific" ? (
                <div className="space-y-4 pt-1">
                  <div className="space-y-2">
                    <FieldLabel>Preferred date</FieldLabel>
                    <div className="relative">
                      <input
                        type="date"
                        min={todayDate}
                        value={form.preferredDate}
                        onChange={(event) =>
                          updateField("preferredDate", event.target.value)
                        }
                        className="h-14 w-full rounded-xl border border-azisto-border bg-white px-3 text-sm text-black outline-none transition az-focus-field"
                      />
                      <Calendar
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <FieldLabel>Preferred time window</FieldLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {timeWindowOptions.map((option) => {
                        const isSelected = form.preferredTimeWindow === option;

                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              updateField("preferredTimeWindow", option)
                            }
                            className={`min-h-12 rounded-xl border px-3 py-2 text-sm font-bold leading-5 transition duration-200 ${
                              isSelected
                                ? "border-azisto-accent bg-blue-50 text-black shadow-sm"
                                : "border-azisto-border bg-white text-slate-700"
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <FieldLabel>Urgency</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {urgencyOptions.map((option) => {
                      const isSelected = urgency === option;

                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setUrgency(option)}
                          className={`min-h-12 rounded-xl border px-3 py-2 text-sm font-bold leading-5 transition duration-200 ${
                            isSelected
                              ? "border-azisto-accent bg-blue-50 text-black shadow-sm"
                              : "border-azisto-border bg-white text-slate-700"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {authLoading ? (
              <p className="rounded-xl border border-azisto-border bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                Checking account...
              </p>
            ) : null}

            {errorMessage ? (
              <p className="whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={authLoading || isSubmitting}
              className="az-btn-primary flex h-14 w-full items-center justify-center rounded-xl text-sm font-bold"
            >
              {authLoading
                ? "Checking account..."
                : isSubmitting
                  ? "Submitting..."
                  : "Submit Request"}
            </button>
          </form>
        </div>
        <BottomNav role="customer" />
      </div>
    </main>
  );
}

export default function RequestPage() {
  return (
    <Suspense>
      <RequestForm />
    </Suspense>
  );
}
