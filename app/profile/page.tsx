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
import {
  ChevronDown,
  ChevronLeft,
  FileText,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
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
  selectedSubcategoriesByService?: Record<string, string[]>;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  businessLicenceNumber?: string;
  documentsVerificationStatus?: string;
  documents?: ContractorDocuments;
  verificationStatus?: string;
  profilePhotoUrl?: string;
  profilePhotoStoragePath?: string;
  profilePhotoFileName?: string;
};

type UploadedDocument = {
  status?: string;
  fileName?: string;
  fileUrl?: string;
  storagePath?: string;
  contentType?: string;
  size?: number;
  uploadedAt?: string;
};

type ContractorDocuments = Record<string, UploadedDocument | undefined>;

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
] as const;

const allowedProfilePhotoTypes = ["image/jpeg", "image/png", "image/webp"];
const maxProfilePhotoSizeBytes = 5 * 1024 * 1024;
const allowedDocumentTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const acceptedDocumentTypes = allowedDocumentTypes.join(",");
const maxDocumentSizeBytes = 10 * 1024 * 1024;

const contractorServiceCatalog = [
  {
    name: "Home Care",
    subcategories: [
      "Handyman",
      "General Cleaning",
      "Painter",
      "Pest Control",
      "Electrical",
      "Plumbing",
      "HVAC Services",
      "Junk Removal",
      "Roofing Services",
      "Drywall Repair & Installation",
      "Fencing",
      "Deck Building & Repair",
      "Glass & Shower Doors",
      "Gutter Installation & Cleaning",
      "Garage Door Repair & Installation",
      "Tile Installation",
    ],
  },
  {
    name: "Car Care",
    subcategories: [
      "Mobile Car Servicing",
      "Diagnostic Check",
      "Car Washing & Detailing",
      "Tire Replacement",
      "Puncture Repair",
      "Alloy Wheel Repair",
    ],
  },
  {
    name: "Pet Care",
    subcategories: [
      "In-home Pet Sitting",
      "Pet Walking",
      "Grooming",
      "Washing & Cleaning",
      "Nail Trimming",
      "Ear Cleaning",
      "Pet Training",
    ],
  },
  {
    name: "Garden Care",
    subcategories: [
      "Lawn Mowing & Edging",
      "Weeding",
      "Pruning & Trimming",
      "Leaf Blowing & Cleanup",
      "Mulching",
      "Garden Design & Landscaping",
      "Seasonal Planting",
      "Turf Laying / Seeding",
      "Raised Bed Installation",
      "Tree Trimming & Shaping",
      "Tree Removal",
      "Stump Grinding",
      "Storm Damage Cleanup",
      "Sprinkler Installation & Repair",
      "Drip Irrigation Setup",
      "Drainage Solutions",
      "Soil Fertilizing",
      "Aeration & Scarification",
      "Weed & Pest Control",
      "Composting Services",
      "Patio & Pathway Installation",
      "Retaining Walls",
      "Outdoor Lighting Installation",
      "Organic Gardening",
      "Water Feature Installation",
      "Greenhouse Setup",
      "Winter Prep & Snow Removal",
    ],
  },
  {
    name: "Moving",
    subcategories: [
      "Local Moves",
      "Long-distance Moves",
      "Loading & Unloading",
      "Furniture Rearranging",
      "Piano & Heavy Item Moving",
      "Full Packing Service",
      "Partial Packing",
      "Unpacking & Setup",
      "Office & Commercial Moves",
      "Apartment Moves",
      "Senior Moving",
      "Art & Fine Item Transport",
    ],
  },
  {
    name: "Roadside & Emergency",
    subcategories: [
      "Emergency Towing",
      "Battery Jump-start",
      "Flat Tire Change",
      "Fuel Delivery",
      "Lockout Service",
      "Flatbed Towing",
      "Wheel-lift Towing",
      "Hook & Chain Towing",
      "Dolly Towing",
      "Motorcycle Towing",
      "Heavy-duty Truck & RV Towing",
      "Bus & Commercial Vehicle Towing",
      "Off-road Recovery",
      "Winching & Vehicle Extraction",
      "Mud / Ditch / Rollover Recovery",
      "Water / Flood Recovery",
      "Boat & Trailer Towing",
    ],
  },
];

const contractorDocumentOptions = [
  {
    key: "governmentId",
    label: "Government photo ID",
    type: "governmentId",
  },
  {
    key: "businessLicence",
    label: "Business licence",
    type: "businessLicence",
  },
  {
    key: "commercialGeneralLiability",
    label: "Liability insurance",
    type: "commercialGeneralLiability",
  },
  {
    key: "worksafeBC",
    label: "WorkSafeBC clearance",
    type: "worksafeBC",
  },
] as const;

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

function createApiError(_code: string, message: string) {
  return new Error(message);
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
  formValues: Record<string, unknown>,
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

function validateContractorDocument(file: File) {
  if (!allowedDocumentTypes.includes(file.type)) {
    throw new Error("Please upload a PDF, JPG, PNG, or WEBP file.");
  }

  if (file.size > maxDocumentSizeBytes) {
    throw new Error("Document must be 10 MB or smaller.");
  }
}

async function uploadContractorDocument(
  user: User,
  documentType: string,
  file: File,
) {
  validateContractorDocument(file);

  const timestamp = Date.now();
  const safeFileName = getCleanFileName(file.name);
  const storagePath = `contractor-documents/${user.uid}/${documentType}/${timestamp}-${safeFileName}`;
  const storageReference = ref(storage, storagePath);

  await uploadBytes(storageReference, file, {
    contentType: file.type,
  });

  const fileUrl = await getDownloadURL(storageReference);

  return {
    status: "uploaded",
    fileName: file.name,
    fileUrl,
    storagePath,
    contentType: file.type,
    size: file.size,
    uploadedAt: new Date(timestamp).toISOString(),
  };
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-azisto-border bg-white px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">
        {value || "Not provided"}
      </p>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-azisto-border bg-slate-50 px-4 py-3">
      <p className="text-sm font-bold text-black">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-600">
        {value || "Not provided"}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">
        This email is linked to sign in and cannot be edited here.
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
        className="mt-2 h-12 w-full rounded-xl border border-azisto-border bg-white px-4 text-sm font-semibold text-slate-900 outline-none az-focus-field"
      />
    </label>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedSubcategoriesByService, setSelectedSubcategoriesByService] =
    useState<Record<string, string[]>>({});
  const [openServiceCategory, setOpenServiceCategory] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadingDocumentKey, setUploadingDocumentKey] = useState("");
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

    if (nextProfile.role === "contractor") {
      nextValues.insuranceProvider = nextProfile.insuranceProvider ?? "";
      nextValues.insurancePolicyNumber =
        nextProfile.insurancePolicyNumber ?? "";
      nextValues.businessLicenceNumber =
        nextProfile.businessLicenceNumber ?? "";
    }

    const nextSubcategories = nextProfile.selectedSubcategoriesByService ?? {};
    const nextSelectedServices = (nextProfile.selectedServices ?? []).filter(
      (service) => (nextSubcategories[service] ?? []).length > 0,
    );

    setFormValues(nextValues);
    setSelectedServices(nextSelectedServices);
    setSelectedSubcategoriesByService(nextSubcategories);
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
      const updatedProfile = await saveProfile(currentUser, {
        ...formValues,
        ...(profile?.role === "contractor"
          ? { selectedServices, selectedSubcategoriesByService }
          : {}),
      });
      setProfile(updatedProfile);
      fillForm(updatedProfile);
      setIsEditing(false);
      setSuccessMessage(
        updatedProfile.role === "contractor"
          ? "Profile sent to AZISTO for review."
          : "Profile updated.",
      );
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

  function toggleSelectedService(service: string) {
    setSelectedServices((currentServices) => {
      if (!currentServices.includes(service)) {
        return [...currentServices, service];
      }

      setSelectedSubcategoriesByService((currentSubcategories) => {
        const { [service]: _removedService, ...remainingSubcategories } =
          currentSubcategories;
        return remainingSubcategories;
      });

      if (openServiceCategory === service) {
        setOpenServiceCategory("");
      }

      return currentServices.filter((currentService) => currentService !== service);
    });
  }

  function toggleSelectedSubcategory(service: string, subcategory: string) {
    setSelectedSubcategoriesByService((currentSubcategories) => {
      const currentServiceSubcategories = currentSubcategories[service] ?? [];
      const nextServiceSubcategories = currentServiceSubcategories.includes(
        subcategory,
      )
        ? currentServiceSubcategories.filter(
            (currentSubcategory) => currentSubcategory !== subcategory,
          )
        : [...currentServiceSubcategories, subcategory];

      setSelectedServices((currentServices) => {
        const hasService = currentServices.includes(service);

        if (nextServiceSubcategories.length > 0 && !hasService) {
          return [...currentServices, service];
        }

        if (nextServiceSubcategories.length === 0 && hasService) {
          return currentServices.filter(
            (currentService) => currentService !== service,
          );
        }

        return currentServices;
      });

      return {
        ...currentSubcategories,
        [service]: nextServiceSubcategories,
      };
    });
  }

  async function handleDocumentChange(
    documentKey: string,
    documentType: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !currentUser || !profile || uploadingDocumentKey) {
      return;
    }

    try {
      setUploadingDocumentKey(documentKey);
      setErrorMessage("");
      setSuccessMessage("");
      const uploadedDocument = await uploadContractorDocument(
        currentUser,
        documentType,
        file,
      );
      const updatedDocuments = {
        ...(profile.documents ?? {}),
        [documentKey]: {
          ...(profile.documents?.[documentKey] ?? {}),
          ...uploadedDocument,
        },
      };
      const updatedProfile = await saveProfile(currentUser, {
        documents: updatedDocuments,
      });
      setProfile(updatedProfile);
      fillForm(updatedProfile);
      setSuccessMessage("Document uploaded and sent to AZISTO for review.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setUploadingDocumentKey("");
    }
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
      setSuccessMessage(
        updatedProfile.role === "contractor"
          ? "Profile photo updated and sent to AZISTO for review."
          : "Profile photo updated.",
      );
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
    <main className="min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex h-screen min-h-0 w-full max-w-[390px] flex-col bg-white shadow-none md:h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-5">
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
            <p className="mt-8 rounded-xl border border-azisto-border bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              Loading profile...
            </p>
          ) : null}

          {profile ? (
            <>
              <section className="mt-8 rounded-2xl border border-azisto-primary bg-white p-5 text-center shadow-sm">
                {profile.profilePhotoUrl ? (
                  <img
                    src={profile.profilePhotoUrl}
                    alt={`${displayName} profile photo`}
                    className="mx-auto h-20 w-20 rounded-3xl border border-azisto-border object-cover shadow-sm"
                  />
                ) : (
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-azisto-gold/30 bg-white text-2xl font-black text-azisto-text shadow-sm">
                    {getInitials(displayName)}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="mt-3 text-xs font-bold text-azisto-text"
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
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-700">
                    <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
                    {profile.role}
                  </span>
                  <span className="rounded-full border border-azisto-border bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
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

              <section className="mt-6 rounded-2xl border border-azisto-primary bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-black">
                    Profile details
                  </h2>
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="rounded-full border border-azisto-border bg-white px-3 py-1.5 text-xs font-bold text-azisto-text"
                    >
                      Edit Profile
                    </button>
                  ) : null}
                </div>

                {isEditing ? (
                  <div className="mt-4 space-y-4">
                    <ReadOnlyField
                      label="Email"
                      value={profile.email || currentUser?.email || ""}
                    />

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

                    {profile.role === "contractor" ? (
                      <>
                        <div className="rounded-xl border border-azisto-border bg-slate-50 p-3">
                          <p className="text-sm font-bold text-black">
                            Service categories
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Choose each service, then pick the subcategories you
                            want to receive jobs for.
                          </p>
                          <div className="mt-3 space-y-2">
                            {contractorServiceCatalog.map((service) => {
                              const isSelected = selectedServices.includes(
                                service.name,
                              );
                              const isOpen =
                                openServiceCategory === service.name;
                              const selectedSubcategories =
                                selectedSubcategoriesByService[service.name] ??
                                [];

                              return (
                                <div
                                  key={service.name}
                                  className="rounded-xl border border-azisto-gold bg-white"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenServiceCategory(
                                        isOpen ? "" : service.name,
                                      );
                                    }}
                                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                                  >
                                    <span>
                                      <span className="block text-sm font-bold text-black">
                                        {service.name}
                                      </span>
                                      <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                                        {selectedSubcategories.length
                                          ? `${selectedSubcategories.length} selected`
                                          : "Tap to view subcategories"}
                                      </span>
                                    </span>
                                    <ChevronDown
                                      aria-hidden="true"
                                      className={`h-4 w-4 text-azisto-text transition ${
                                        isOpen ? "rotate-180" : ""
                                      }`}
                                    />
                                  </button>

                                  {isOpen ? (
                                    <div className="border-t border-azisto-border px-3 pb-3 pt-2">
                                      <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1">
                                        {service.subcategories.map(
                                          (subcategory) => {
                                            const isSubcategorySelected =
                                              selectedSubcategories.includes(
                                                subcategory,
                                              );

                                            return (
                                              <button
                                                key={subcategory}
                                                type="button"
                                                onClick={() =>
                                                  toggleSelectedSubcategory(
                                                    service.name,
                                                    subcategory,
                                                  )
                                                }
                                                className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                                                  isSubcategorySelected
                                                    ? "border-azisto-gold bg-azisto-gold/10 text-azisto-text"
                                                    : "border-azisto-border bg-white text-slate-700"
                                                }`}
                                              >
                                                <span>{subcategory}</span>
                                                <span
                                                  aria-hidden="true"
                                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                                    isSubcategorySelected
                                                      ? "border-azisto-gold bg-azisto-gold"
                                                      : "border-slate-300 bg-white"
                                                  }`}
                                                >
                                                  {isSubcategorySelected ? (
                                                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                                  ) : null}
                                                </span>
                                              </button>
                                            );
                                          },
                                        )}
                                      </div>
                                      {isSelected ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleSelectedService(service.name)
                                          }
                                          className="mt-3 text-xs font-bold text-red-600"
                                        >
                                          Clear {service.name}
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <EditField
                          label="Insurance provider"
                          value={formValues.insuranceProvider ?? ""}
                          onChange={(value) =>
                            setFormValues((currentValues) => ({
                              ...currentValues,
                              insuranceProvider: value,
                            }))
                          }
                        />
                        <EditField
                          label="Policy No."
                          value={formValues.insurancePolicyNumber ?? ""}
                          onChange={(value) =>
                            setFormValues((currentValues) => ({
                              ...currentValues,
                              insurancePolicyNumber: value,
                            }))
                          }
                        />
                        <EditField
                          label="Business Licence No."
                          value={formValues.businessLicenceNumber ?? ""}
                          onChange={(value) =>
                            setFormValues((currentValues) => ({
                              ...currentValues,
                              businessLicenceNumber: value,
                            }))
                          }
                        />
                      </>
                    ) : null}

                    {profile.role === "customer" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={handleCancel}
                          disabled={isSaving}
                          className="flex h-12 items-center justify-center rounded-xl border border-azisto-border bg-white text-sm font-bold text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={isSaving}
                          className="az-btn-primary flex h-12 items-center justify-center rounded-xl text-sm font-bold"
                        >
                          {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    ) : null}
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
                        <div className="rounded-xl border border-azisto-border bg-white px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                            Selected services
                          </p>
                          {profile.selectedServices?.length ? (
                            <div className="mt-2 space-y-3">
                              {profile.selectedServices.map((service) => (
                                <div key={service}>
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                                    {service}
                                  </span>
                                  {profile.selectedSubcategoriesByService?.[
                                    service
                                  ]?.length ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {profile.selectedSubcategoriesByService[
                                        service
                                      ]?.map((subcategory) => (
                                        <span
                                          key={subcategory}
                                          className="rounded-full border border-azisto-gold/40 bg-azisto-gold/10 px-2.5 py-1 text-[11px] font-bold text-azisto-text"
                                        >
                                          {subcategory}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              Not provided
                            </p>
                          )}
                        </div>
                        <InfoRow
                          label="Insurance provider"
                          value={profile.insuranceProvider ?? ""}
                        />
                        <InfoRow
                          label="Policy No."
                          value={profile.insurancePolicyNumber ?? ""}
                        />
                        <InfoRow
                          label="Business Licence No."
                          value={profile.businessLicenceNumber ?? ""}
                        />
                      </>
                    )}
                  </div>
                )}
              </section>

              {profile.role === "contractor" ? (
                <section className="mt-5 rounded-2xl border border-azisto-primary bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-azisto-background text-azisto-text">
                      <FileText aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-black">
                        Documents
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Upload or replace key verification documents for AZISTO
                        review.
                      </p>
                      {profile.documentsVerificationStatus ? (
                        <p className="mt-2 inline-flex rounded-full border border-azisto-gold/30 bg-azisto-gold/10 px-3 py-1 text-xs font-bold capitalize text-azisto-text">
                          {profile.documentsVerificationStatus}
                        </p>
                      ) : null}
                    </div>
                  </div>

	                  <div className="mt-4 space-y-3">
	                    {contractorDocumentOptions.map((documentOption) => {
                      const document =
                        profile.documents?.[documentOption.key] ?? {};
                      const isUploading =
                        uploadingDocumentKey === documentOption.key;

                      return (
                        <div
                          key={documentOption.key}
                          className="rounded-xl border border-azisto-border bg-slate-50 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-black">
                                {documentOption.label}
                              </p>
                              <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                                {document.fileName
                                  ? `Uploaded: ${document.fileName}`
                                  : "No file uploaded"}
                              </p>
                            </div>
                            <label className="flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-azisto-gold bg-white px-3 text-xs font-bold text-azisto-text transition hover:bg-azisto-gold/10">
                              <Upload aria-hidden="true" className="h-4 w-4" />
                              {isUploading
                                ? "Uploading"
                                : document.fileName
                                  ? "Replace"
                                  : "Upload"}
                              <input
                                type="file"
                                accept={acceptedDocumentTypes}
                                className="sr-only"
                                disabled={Boolean(uploadingDocumentKey)}
                                onChange={(event) =>
                                  handleDocumentChange(
                                    documentOption.key,
                                    documentOption.type,
                                    event,
                                  )
                                }
                              />
                            </label>
                          </div>
                          {document.fileUrl ? (
                            <a
                              href={document.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex text-xs font-bold text-azisto-text underline"
                            >
                              View uploaded file
                            </a>
                          ) : null}
                        </div>
	                      );
	                    })}
	                  </div>
	                  {isEditing ? (
	                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-azisto-border pt-4">
	                      <button
	                        type="button"
	                        onClick={handleCancel}
	                        disabled={isSaving}
	                        className="flex h-12 items-center justify-center rounded-xl border border-azisto-border bg-white text-sm font-bold text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
	                      >
	                        Cancel
	                      </button>
	                      <button
	                        type="button"
	                        onClick={handleSave}
	                        disabled={isSaving}
	                        className="az-btn-primary flex h-12 items-center justify-center rounded-xl text-sm font-bold"
	                      >
	                        {isSaving
	                          ? "Sending..."
	                          : "Send to AZISTO for review"}
	                      </button>
	                    </div>
	                  ) : null}
	                </section>
              ) : null}

              <section className="mt-5 rounded-2xl border border-azisto-primary bg-white p-4 shadow-sm">
                <h2 className="text-lg font-bold text-black">Security</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  We’ll email a secure password reset link to your account
                  email.
                </p>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-xl border border-azisto-border bg-white text-sm font-bold text-slate-900"
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
