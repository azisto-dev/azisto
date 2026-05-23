"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { ChevronLeft, ShieldCheck, UserRound } from "lucide-react";
import { auth, storage } from "@/lib/firebase";
import BottomNav from "@/app/components/BottomNav";

type ProfileRole = "customer" | "contractor";

type ProfileData = {
  role: ProfileRole;
  customerId?: string;
  contractorId?: string;
  fullName?: string;
  contactName?: string;
  businessName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  preferredContactMethod?: string;
  serviceRadiusKm?: number;
  selectedServices?: string[];
  verificationStatus?: string;
  profilePhotoUrl?: string;
  profilePhotoStoragePath?: string;
  profilePhotoFileName?: string;
};

type ProfileResponse = {
  role?: unknown;
  profile?: unknown;
  code?: unknown;
  message?: unknown;
};

const customerFields = [
  { key: "fullName", label: "Full name" },
  { key: "phoneNumber", label: "Phone number" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "province", label: "Province" },
  { key: "postalCode", label: "Postal code" },
  { key: "preferredContactMethod", label: "Preferred contact method" },
] as const;

const contractorFields = [
  { key: "contactName", label: "Contact name" },
  { key: "businessName", label: "Business name" },
  { key: "phoneNumber", label: "Phone number" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "province", label: "Province" },
  { key: "postalCode", label: "Postal code" },
  { key: "serviceRadiusKm", label: "Service radius (km)" },
] as const;

const allowedProfilePhotoTypes = ["image/jpeg", "image/png", "image/webp"];
const maxProfilePhotoSizeBytes = 5 * 1024 * 1024;

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

function createApiError(code: string, message: string) {
  return new Error(`${message}\n\nCode: ${code}`);
}

function readProfile(value: unknown): ProfileData {
  const profile = typeof value === "object" && value !== null ? value : {};

  return profile as ProfileData;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load profile.";
}

function getDisplayName(profile: ProfileData | null) {
  if (!profile) {
    return "Profile";
  }

  return (
    profile.fullName ||
    profile.contactName ||
    profile.businessName ||
    "Profile"
  );
}

function getInitials(name: string) {
  const initials = name
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  return initials || "AZ";
}

async function fetchProfile(user: User) {
  const token = await user.getIdToken();
  const response = await fetch("/api/profile", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const responseBody = (await response.json().catch(() => null)) as
    | ProfileResponse
    | null;

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

  return readProfile(responseBody?.profile);
}

async function saveProfile(
  user: User,
  formValues: Record<string, string | number>,
) {
  const token = await user.getIdToken();
  const response = await fetch("/api/profile", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formValues),
  });
  const responseBody = (await response.json().catch(() => null)) as
    | ProfileResponse
    | null;

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

  return readProfile(responseBody?.profile);
}

function getCleanFileName(fileName: string) {
  const safeFileName = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  return safeFileName || "profile-photo";
}

function validateProfilePhoto(file: File) {
  if (!allowedProfilePhotoTypes.includes(file.type)) {
    throw new Error("Please upload a JPG, PNG, or WEBP image.");
  }

  if (file.size > maxProfilePhotoSizeBytes) {
    throw new Error("Profile photo must be 5 MB or smaller.");
  }
}

async function uploadProfilePhoto(user: User, file: File) {
  validateProfilePhoto(file);

  const timestamp = Date.now();
  const safeFileName = getCleanFileName(file.name);
  const storagePath = `profile-photos/${user.uid}/${timestamp}-${safeFileName}`;
  const storageReference = ref(storage, storagePath);

  await uploadBytes(storageReference, file, {
    contentType: file.type,
  });

  const fileUrl = await getDownloadURL(storageReference);

  return {
    profilePhotoUrl: fileUrl,
    profilePhotoStoragePath: storagePath,
    profilePhotoFileName: file.name,
    profilePhotoContentType: file.type,
    profilePhotoSize: file.size,
    profilePhotoUploadedAt: new Date(timestamp).toISOString(),
  };
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">
        {value || "Not provided"}
      </p>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-black">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
      />
    </label>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const editableFields = useMemo(() => {
    if (profile?.role === "contractor") {
      return contractorFields;
    }

    return customerFields;
  }, [profile?.role]);

  function fillForm(nextProfile: ProfileData) {
    const nextValues: Record<string, string> = {};
    const fields =
      nextProfile.role === "contractor" ? contractorFields : customerFields;

    fields.forEach((field) => {
      const value = nextProfile[field.key as keyof ProfileData];
      nextValues[field.key] =
        typeof value === "number" ? String(value) : String(value ?? "");
    });

    setFormValues(nextValues);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setCurrentUser(user);

      try {
        setIsLoading(true);
        setErrorMessage("");
        const userProfile = await fetchProfile(user);
        setProfile(userProfile);
        fillForm(userProfile);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [router]);

  async function handleSave() {
    if (!currentUser || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");
      setSuccessMessage("");
      const updatedProfile = await saveProfile(currentUser, formValues);
      setProfile(updatedProfile);
      fillForm(updatedProfile);
      setIsEditing(false);
      setSuccessMessage("Profile updated.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    if (profile) {
      fillForm(profile);
    }

    setIsEditing(false);
    setErrorMessage("");
  }

  async function handlePasswordReset() {
    if (!currentUser?.email) {
      setErrorMessage("No email address is available for this account.");
      return;
    }

    try {
      setErrorMessage("");
      setSuccessMessage("");
      await sendPasswordResetEmail(auth, currentUser.email);
      setSuccessMessage("Password reset email sent.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !currentUser || isUploadingPhoto) {
      return;
    }

    try {
      setIsUploadingPhoto(true);
      setErrorMessage("");
      setSuccessMessage("");
      const uploadedPhoto = await uploadProfilePhoto(currentUser, file);
      const updatedProfile = await saveProfile(currentUser, uploadedPhoto);
      setProfile(updatedProfile);
      fillForm(updatedProfile);
      setSuccessMessage("Profile photo updated.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  const displayName = getDisplayName(profile);
  const readableId =
    profile?.role === "contractor" ? profile.contractorId : profile?.customerId;

  return (
    <main className="min-h-screen bg-white text-black md:bg-slate-50 md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-slate-200">
        <div className="flex-1 px-5 pb-6 pt-5">
          <StatusBar />

          <header className="mt-3 grid grid-cols-[40px_1fr_40px] items-center">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-10 w-10 items-center justify-center rounded-full text-black"
              aria-label="Go back"
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            </button>

            <Link href="/home" className="flex justify-center">
              <img
                src="/azisto-logo-cropped.png"
                alt="AZISTO - Your on-demand assistant"
                className="w-full max-w-[165px] object-contain"
              />
            </Link>

            <span aria-hidden="true" />
          </header>

          {isLoading ? (
            <p className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              Loading profile...
            </p>
          ) : null}

          {profile ? (
            <>
              <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                {profile.profilePhotoUrl ? (
                  <img
                    src={profile.profilePhotoUrl}
                    alt={`${displayName} profile photo`}
                    className="mx-auto h-20 w-20 rounded-3xl border border-red-100 object-cover shadow-sm"
                  />
                ) : (
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-red-100 bg-red-50 text-2xl font-black text-red-500 shadow-sm">
                    {getInitials(displayName)}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="mt-3 text-xs font-bold text-red-500"
                >
                  {isUploadingPhoto
                    ? "Uploading photo..."
                    : profile.profilePhotoUrl
                      ? "Edit profile photo"
                      : "Upload profile photo"}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  JPG, PNG, or WEBP. Max 5 MB.
                </p>

                <h1 className="mt-4 text-2xl font-bold leading-tight text-black">
                  {displayName}
                </h1>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold capitalize text-red-500">
                    <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
                    {profile.role}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                    {readableId || "ID pending"}
                  </span>
                  {profile.role === "contractor" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-700">
                      <ShieldCheck
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                      {profile.verificationStatus || "pending"}
                    </span>
                  ) : null}
                </div>
              </section>

              {errorMessage ? (
                <p className="mt-5 whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                  {errorMessage}
                </p>
              ) : null}

              {successMessage ? (
                <p className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                  {successMessage}
                </p>
              ) : null}

              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-black">
                    Profile details
                  </h2>
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-500"
                    >
                      Edit Profile
                    </button>
                  ) : null}
                </div>

                {isEditing ? (
                  <div className="mt-4 space-y-4">
                    {editableFields.map((field) => (
                      <EditField
                        key={field.key}
                        label={field.label}
                        value={formValues[field.key] ?? ""}
                        onChange={(value) =>
                          setFormValues((currentValues) => ({
                            ...currentValues,
                            [field.key]: value,
                          }))
                        }
                      />
                    ))}

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex h-12 items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white shadow-lg shadow-red-100 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        {isSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <InfoRow label="Email" value={profile.email ?? ""} />

                    {profile.role === "customer" ? (
                      <>
                        <InfoRow
                          label="Full name"
                          value={profile.fullName ?? ""}
                        />
                        <InfoRow
                          label="Phone number"
                          value={profile.phoneNumber ?? ""}
                        />
                        <InfoRow label="Address" value={profile.address ?? ""} />
                        <InfoRow label="City" value={profile.city ?? ""} />
                        <InfoRow
                          label="Province"
                          value={profile.province ?? ""}
                        />
                        <InfoRow
                          label="Postal code"
                          value={profile.postalCode ?? ""}
                        />
                        <InfoRow
                          label="Preferred contact"
                          value={profile.preferredContactMethod ?? ""}
                        />
                      </>
                    ) : (
                      <>
                        <InfoRow
                          label="Contact name"
                          value={profile.contactName ?? ""}
                        />
                        <InfoRow
                          label="Business name"
                          value={profile.businessName ?? ""}
                        />
                        <InfoRow
                          label="Phone number"
                          value={profile.phoneNumber ?? ""}
                        />
                        <InfoRow label="Address" value={profile.address ?? ""} />
                        <InfoRow label="City" value={profile.city ?? ""} />
                        <InfoRow
                          label="Province"
                          value={profile.province ?? ""}
                        />
                        <InfoRow
                          label="Postal code"
                          value={profile.postalCode ?? ""}
                        />
                        <InfoRow
                          label="Service radius"
                          value={
                            profile.serviceRadiusKm
                              ? `${profile.serviceRadiusKm} km`
                              : ""
                          }
                        />
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                            Selected services
                          </p>
                          {profile.selectedServices?.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {profile.selectedServices.map((service) => (
                                <span
                                  key={service}
                                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                                >
                                  {service}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              Not provided
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>

              <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-lg font-bold text-black">Security</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  We’ll email a secure password reset link to your account
                  email.
                </p>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900"
                >
                  Change password
                </button>
              </section>
            </>
          ) : null}
        </div>
        <BottomNav role={profile?.role ?? "unknown"} />
      </div>
    </main>
  );
}
