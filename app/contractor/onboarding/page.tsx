"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { ChevronLeft, FileText, ShieldCheck, Upload } from "lucide-react";
import { auth, authPersistenceReady, storage } from "@/lib/firebase";

const allowedUploadTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const maxUploadSizeBytes = 10 * 1024 * 1024;
const acceptedUploadTypes = allowedUploadTypes.join(",");

const documentTabs = [
  { id: "required", label: "Required Documents" },
  { id: "insurance", label: "Insurance" },
  { id: "worksafe", label: "WorkSafeBC" },
  { id: "trade", label: "Trade / Category Licences" },
  { id: "vehicle", label: "Vehicle Documents" },
  { id: "driving", label: "Driving Abstract" },
] as const;

const tradeLicenceOptions = [
  {
    id: "electrical",
    title: "Electrical",
    proofLabel: "Electrical contractor licence / trade proof",
    keywords: ["electrical", "electric"],
  },
  {
    id: "plumbing",
    title: "Plumbing",
    proofLabel: "Plumbing licence / trade proof",
    keywords: ["plumbing", "plumber"],
  },
  {
    id: "hvac",
    title: "HVAC / gas",
    proofLabel: "HVAC or gas fitter licence / trade proof",
    keywords: ["hvac", "gas"],
  },
  {
    id: "pest",
    title: "Pest control",
    proofLabel: "Pesticide applicator certificate / licence",
    keywords: ["pest", "pesticide"],
  },
  {
    id: "roofing",
    title: "Roofing",
    proofLabel: "Fall protection / safety proof",
    keywords: ["roof", "roofing"],
  },
  {
    id: "tree",
    title: "Tree services",
    proofLabel: "Arborist certification or experience proof",
    keywords: ["tree", "arborist"],
  },
  {
    id: "general",
    title: "General",
    proofLabel: "Other trade certificate upload placeholder",
    keywords: [],
  },
];

type DocumentTabId = (typeof documentTabs)[number]["id"];
type UploadDocumentType =
  | "governmentId"
  | "businessLicence"
  | "commercialGeneralLiability"
  | "worksafeBC"
  | "tradeLicence"
  | "driverLicence"
  | "vehicleRegistration"
  | "commercialVehicleInsurance"
  | "cargoInsurance"
  | "towingInsurance"
  | "garageKeepersLiability"
  | "drivingAbstract";
type TradeLicenceUploadKey = `tradeLicence-${string}`;
type UploadKey = UploadDocumentType | TradeLicenceUploadKey;

type ContractorForm = {
  displayName: string;
  phoneNumber: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
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

type DocumentForm = {
  governmentIdExpiryDate: string;
  operatingTradeName: string;
  businessLicenceMunicipality: string;
  worksafeAccountNumber: string;
  worksafeClearanceExpiryDate: string;
  worksafeConfirmed: boolean;
  vehicleType: string;
  licencePlate: string;
  vehicleInsuranceExpiryDate: string;
  drivingAbstractIssueDate: string;
  driverLicenceClass: string;
  driverLicenceExpiryDate: string;
  drivingRecordConfirmed: boolean;
};

type UploadedDocumentFile = {
  status: "uploaded";
  fileName: string;
  fileUrl: string;
  storagePath: string;
  contentType: string;
  size: number;
  uploadedAt: string;
};

type UploadState = {
  isUploading: boolean;
  error: string;
  file?: UploadedDocumentFile;
};

type UploadStates = Partial<Record<UploadKey, UploadState>>;

const initialForm: ContractorForm = {
  displayName: "",
  phoneNumber: "",
  address: "",
  city: "",
  province: "",
  postalCode: "",
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

const initialDocumentForm: DocumentForm = {
  governmentIdExpiryDate: "",
  operatingTradeName: "",
  businessLicenceMunicipality: "",
  worksafeAccountNumber: "",
  worksafeClearanceExpiryDate: "",
  worksafeConfirmed: false,
  vehicleType: "",
  licencePlate: "",
  vehicleInsuranceExpiryDate: "",
  drivingAbstractIssueDate: "",
  driverLicenceClass: "",
  driverLicenceExpiryDate: "",
  drivingRecordConfirmed: false,
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

function TextInput({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-50"
      />
    </div>
  );
}

function UploadCard({
  label,
  uploadKey,
  documentType,
  uploadState,
  onUpload,
}: {
  label: string;
  uploadKey: UploadKey;
  documentType: UploadDocumentType;
  uploadState?: UploadState;
  onUpload: (
    uploadKey: UploadKey,
    documentType: UploadDocumentType,
    fileList: FileList | null,
  ) => void;
}) {
  const uploadedFileName = uploadState?.file?.fileName;
  const isUploading = Boolean(uploadState?.isUploading);

  return (
    <label
      className={`block rounded-xl border border-dashed px-4 py-3 transition ${
        isUploading
          ? "cursor-wait border-red-200 bg-red-50"
          : "cursor-pointer border-slate-300 bg-slate-50 hover:border-red-200 hover:bg-red-50/50"
      }`}
    >
      <span className="flex min-h-16 items-center justify-between">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-red-500 shadow-sm">
            <FileText aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-black">{label}</span>
            <span className="block text-xs leading-5 text-slate-500">
              PDF, JPG, PNG, WEBP. Max 10 MB.
            </span>
            {uploadedFileName ? (
              <span className="mt-1 block truncate text-xs font-semibold text-emerald-600">
                Uploaded: {uploadedFileName}
              </span>
            ) : null}
          </span>
        </span>

        <span className="ml-3 flex shrink-0 items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-red-500 shadow-sm">
          <Upload aria-hidden="true" className="h-4 w-4" />
          {isUploading ? "Uploading..." : uploadedFileName ? "Replace" : "Upload"}
        </span>
      </span>

      {uploadState?.error ? (
        <span className="mt-2 block text-xs font-semibold leading-5 text-red-600">
          {uploadState.error}
        </span>
      ) : null}

      <input
        type="file"
        accept={acceptedUploadTypes}
        disabled={isUploading}
        className="sr-only"
        onChange={(event) => {
          onUpload(uploadKey, documentType, event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
    </label>
  );
}

function CheckboxRow({
  checked,
  children,
  onChange,
}: {
  checked: boolean;
  children: React.ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-red-500"
      />
      <span>{children}</span>
    </label>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to save your contractor profile.";
}

function createApiError(code: string, message: string) {
  return new Error(`${message}\n\nCode: ${code}`);
}

function parseSelectedServices(servicesOffered: string) {
  return servicesOffered
    .split(",")
    .map((service) => service.trim())
    .filter(Boolean);
}

function parseServiceRadiusKm(serviceRadius: string) {
  const parsedValue = Number.parseFloat(serviceRadius);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function serviceTextIncludes(selectedServices: string[], keywords: string[]) {
  const serviceText = selectedServices.join(" ").toLowerCase();

  return keywords.some((keyword) => serviceText.includes(keyword));
}

function getVisibleTradeLicenceOptions(selectedServices: string[]) {
  const matchedOptions = tradeLicenceOptions.filter(
    (option) =>
      option.id !== "general" &&
      serviceTextIncludes(selectedServices, option.keywords),
  );
  const generalOption = tradeLicenceOptions.find(
    (option) => option.id === "general",
  );

  return generalOption ? [...matchedOptions, generalOption] : matchedOptions;
}

function needsVehicleDocuments(selectedServices: string[]) {
  return serviceTextIncludes(selectedServices, [
    "moving",
    "towing",
    "roadside",
    "emergency",
    "car care",
    "car",
    "mobile",
  ]);
}

function needsDrivingAbstract(selectedServices: string[]) {
  return serviceTextIncludes(selectedServices, [
    "towing",
    "moving",
    "roadside",
    "emergency",
  ]);
}

function getTradeLicenceUploadKey(optionId: string): TradeLicenceUploadKey {
  return `tradeLicence-${optionId}`;
}

function getCleanFileName(fileName: string) {
  const safeFileName = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  return safeFileName || "document";
}

function validateUploadFile(file: File) {
  if (!allowedUploadTypes.includes(file.type)) {
    throw new Error("Please upload a PDF, JPG, PNG, or WEBP file.");
  }

  if (file.size > maxUploadSizeBytes) {
    throw new Error("File must be 10 MB or smaller.");
  }
}

async function uploadContractorDocument(
  user: User,
  documentType: UploadDocumentType,
  file: File,
) {
  validateUploadFile(file);

  const timestamp = Date.now();
  const safeFileName = getCleanFileName(file.name);
  const storagePath = `contractor-documents/${user.uid}/${documentType}/${timestamp}-${safeFileName}`;
  const storageReference = ref(storage, storagePath);

  await uploadBytes(storageReference, file, {
    contentType: file.type,
  });

  const fileUrl = await getDownloadURL(storageReference);

  return {
    status: "uploaded" as const,
    fileName: file.name,
    fileUrl,
    storagePath,
    contentType: file.type,
    size: file.size,
    uploadedAt: new Date(timestamp).toISOString(),
  };
}

function getUploadedFile(uploadStates: UploadStates, uploadKey: UploadKey) {
  return uploadStates[uploadKey]?.file ?? null;
}

function getUploadStatus(uploadedFile: UploadedDocumentFile | null) {
  return uploadedFile ? "uploaded" : "not_uploaded";
}

function buildContractorDocuments(
  form: ContractorForm,
  documentForm: DocumentForm,
  selectedServices: string[],
  uploadStates: UploadStates,
) {
  const vehicleDocumentsRequired = needsVehicleDocuments(selectedServices);
  const drivingAbstractRequired = needsDrivingAbstract(selectedServices);
  const governmentIdUpload = getUploadedFile(uploadStates, "governmentId");
  const businessLicenceUpload = getUploadedFile(uploadStates, "businessLicence");
  const liabilityUpload = getUploadedFile(
    uploadStates,
    "commercialGeneralLiability",
  );
  const worksafeUpload = getUploadedFile(uploadStates, "worksafeBC");
  const driverLicenceUpload = getUploadedFile(uploadStates, "driverLicence");
  const vehicleRegistrationUpload = getUploadedFile(
    uploadStates,
    "vehicleRegistration",
  );
  const commercialVehicleInsuranceUpload = getUploadedFile(
    uploadStates,
    "commercialVehicleInsurance",
  );
  const cargoInsuranceUpload = getUploadedFile(uploadStates, "cargoInsurance");
  const towingInsuranceUpload = getUploadedFile(
    uploadStates,
    "towingInsurance",
  );
  const garageKeepersUpload = getUploadedFile(
    uploadStates,
    "garageKeepersLiability",
  );
  const drivingAbstractUpload = getUploadedFile(
    uploadStates,
    "drivingAbstract",
  );
  const hasVehicleUpload = Boolean(
    driverLicenceUpload ||
      vehicleRegistrationUpload ||
      commercialVehicleInsuranceUpload ||
      cargoInsuranceUpload ||
      towingInsuranceUpload ||
      garageKeepersUpload,
  );

  return {
    governmentId: {
      status: getUploadStatus(governmentIdUpload),
      fileName: governmentIdUpload?.fileName ?? "",
      fileUrl: governmentIdUpload?.fileUrl ?? "",
      storagePath: governmentIdUpload?.storagePath ?? "",
      contentType: governmentIdUpload?.contentType ?? "",
      size: governmentIdUpload?.size ?? 0,
      uploadedAt: governmentIdUpload?.uploadedAt ?? "",
      expiryDate: documentForm.governmentIdExpiryDate,
      reviewedAt: null,
      rejectionReason: "",
    },
    businessLicence: {
      status: getUploadStatus(businessLicenceUpload),
      fileName: businessLicenceUpload?.fileName ?? "",
      fileUrl: businessLicenceUpload?.fileUrl ?? "",
      storagePath: businessLicenceUpload?.storagePath ?? "",
      contentType: businessLicenceUpload?.contentType ?? "",
      size: businessLicenceUpload?.size ?? 0,
      uploadedAt: businessLicenceUpload?.uploadedAt ?? "",
      licenceNumber: form.businessLicenceNumber,
      municipality: documentForm.businessLicenceMunicipality,
      expiryDate: form.businessLicenceExpiryDate,
      reviewedAt: null,
      rejectionReason: "",
    },
    commercialGeneralLiability: {
      status: getUploadStatus(liabilityUpload),
      fileName: liabilityUpload?.fileName ?? "",
      fileUrl: liabilityUpload?.fileUrl ?? "",
      storagePath: liabilityUpload?.storagePath ?? "",
      contentType: liabilityUpload?.contentType ?? "",
      size: liabilityUpload?.size ?? 0,
      uploadedAt: liabilityUpload?.uploadedAt ?? "",
      provider: form.insuranceProviderName,
      policyNumber: form.insurancePolicyNumber,
      coverageAmount: form.coverageAmount,
      expiryDate: form.insuranceExpiryDate,
      reviewedAt: null,
      rejectionReason: "",
    },
    worksafeBC: {
      status: getUploadStatus(worksafeUpload),
      accountNumber: documentForm.worksafeAccountNumber,
      fileName: worksafeUpload?.fileName ?? "",
      clearanceLetterUrl: worksafeUpload?.fileUrl ?? "",
      storagePath: worksafeUpload?.storagePath ?? "",
      contentType: worksafeUpload?.contentType ?? "",
      size: worksafeUpload?.size ?? 0,
      uploadedAt: worksafeUpload?.uploadedAt ?? "",
      expiryDate: documentForm.worksafeClearanceExpiryDate,
      reviewedAt: null,
      rejectionReason: "",
      confirmedCoverageResponsibility: documentForm.worksafeConfirmed,
    },
    tradeLicences: getVisibleTradeLicenceOptions(selectedServices).map(
      (option) => {
        const tradeLicenceUpload = getUploadedFile(
          uploadStates,
          getTradeLicenceUploadKey(option.id),
        );

        return {
          category: option.title,
          documentName: option.proofLabel,
          status: getUploadStatus(tradeLicenceUpload),
          fileName: tradeLicenceUpload?.fileName ?? "",
          fileUrl: tradeLicenceUpload?.fileUrl ?? "",
          storagePath: tradeLicenceUpload?.storagePath ?? "",
          contentType: tradeLicenceUpload?.contentType ?? "",
          size: tradeLicenceUpload?.size ?? 0,
          uploadedAt: tradeLicenceUpload?.uploadedAt ?? "",
          reviewedAt: null,
          rejectionReason: "",
        };
      },
    ),
    vehicleDocuments: {
      status: hasVehicleUpload
        ? "uploaded"
        : vehicleDocumentsRequired
          ? "not_uploaded"
          : "not_required",
      driverLicenceUrl: driverLicenceUpload?.fileUrl ?? "",
      driverLicenceFileName: driverLicenceUpload?.fileName ?? "",
      driverLicenceStoragePath: driverLicenceUpload?.storagePath ?? "",
      driverLicenceContentType: driverLicenceUpload?.contentType ?? "",
      driverLicenceSize: driverLicenceUpload?.size ?? 0,
      driverLicenceUploadedAt: driverLicenceUpload?.uploadedAt ?? "",
      vehicleRegistrationUrl: vehicleRegistrationUpload?.fileUrl ?? "",
      vehicleRegistrationFileName: vehicleRegistrationUpload?.fileName ?? "",
      vehicleRegistrationStoragePath:
        vehicleRegistrationUpload?.storagePath ?? "",
      vehicleRegistrationContentType:
        vehicleRegistrationUpload?.contentType ?? "",
      vehicleRegistrationSize: vehicleRegistrationUpload?.size ?? 0,
      vehicleRegistrationUploadedAt:
        vehicleRegistrationUpload?.uploadedAt ?? "",
      commercialVehicleInsuranceUrl:
        commercialVehicleInsuranceUpload?.fileUrl ?? "",
      commercialVehicleInsuranceFileName:
        commercialVehicleInsuranceUpload?.fileName ?? "",
      commercialVehicleInsuranceStoragePath:
        commercialVehicleInsuranceUpload?.storagePath ?? "",
      commercialVehicleInsuranceContentType:
        commercialVehicleInsuranceUpload?.contentType ?? "",
      commercialVehicleInsuranceSize:
        commercialVehicleInsuranceUpload?.size ?? 0,
      commercialVehicleInsuranceUploadedAt:
        commercialVehicleInsuranceUpload?.uploadedAt ?? "",
      cargoInsuranceUrl: cargoInsuranceUpload?.fileUrl ?? "",
      cargoInsuranceFileName: cargoInsuranceUpload?.fileName ?? "",
      cargoInsuranceStoragePath: cargoInsuranceUpload?.storagePath ?? "",
      cargoInsuranceContentType: cargoInsuranceUpload?.contentType ?? "",
      cargoInsuranceSize: cargoInsuranceUpload?.size ?? 0,
      cargoInsuranceUploadedAt: cargoInsuranceUpload?.uploadedAt ?? "",
      towingInsuranceUrl: towingInsuranceUpload?.fileUrl ?? "",
      towingInsuranceFileName: towingInsuranceUpload?.fileName ?? "",
      towingInsuranceStoragePath: towingInsuranceUpload?.storagePath ?? "",
      towingInsuranceContentType: towingInsuranceUpload?.contentType ?? "",
      towingInsuranceSize: towingInsuranceUpload?.size ?? 0,
      towingInsuranceUploadedAt: towingInsuranceUpload?.uploadedAt ?? "",
      garageKeepersLiabilityUrl: garageKeepersUpload?.fileUrl ?? "",
      garageKeepersLiabilityFileName: garageKeepersUpload?.fileName ?? "",
      garageKeepersLiabilityStoragePath:
        garageKeepersUpload?.storagePath ?? "",
      garageKeepersLiabilityContentType:
        garageKeepersUpload?.contentType ?? "",
      garageKeepersLiabilitySize: garageKeepersUpload?.size ?? 0,
      garageKeepersLiabilityUploadedAt:
        garageKeepersUpload?.uploadedAt ?? "",
      vehicleType: documentForm.vehicleType,
      licencePlate: documentForm.licencePlate,
      insuranceExpiryDate: documentForm.vehicleInsuranceExpiryDate,
      reviewedAt: null,
      rejectionReason: "",
    },
    drivingAbstract: {
      status: drivingAbstractUpload
        ? "uploaded"
        : drivingAbstractRequired
          ? "not_uploaded"
          : "not_required",
      fileName: drivingAbstractUpload?.fileName ?? "",
      fileUrl: drivingAbstractUpload?.fileUrl ?? "",
      storagePath: drivingAbstractUpload?.storagePath ?? "",
      contentType: drivingAbstractUpload?.contentType ?? "",
      size: drivingAbstractUpload?.size ?? 0,
      uploadedAt: drivingAbstractUpload?.uploadedAt ?? "",
      issueDate: documentForm.drivingAbstractIssueDate,
      licenceClass: documentForm.driverLicenceClass,
      licenceExpiryDate: documentForm.driverLicenceExpiryDate,
      reviewedAt: null,
      rejectionReason: "",
      confirmedDrivingRecord: documentForm.drivingRecordConfirmed,
    },
  };
}

async function saveContractorProfileWithApi(
  user: User,
  form: ContractorForm,
  documentForm: DocumentForm,
  uploadStates: UploadStates,
) {
  const token = await user.getIdToken();
  const selectedServices = parseSelectedServices(form.servicesOffered);
  const documents = buildContractorDocuments(
    form,
    documentForm,
    selectedServices,
    uploadStates,
  );

  const response = await fetch("/api/contractors/profile", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      businessName: form.legalBusinessName,
      contactName: form.displayName,
      phoneNumber: form.phoneNumber,
      email: user.email ?? "",
      address: form.address,
      city: form.city,
      province: form.province,
      postalCode: form.postalCode,
      selectedServices,
      serviceRadiusKm: parseServiceRadiusKm(form.serviceRadius),
      insuranceProvider: form.insuranceProviderName,
      insurancePolicyNumber: form.insurancePolicyNumber,
      businessLicenceNumber: form.businessLicenceNumber,
      documents,
      documentsVerificationStatus: "pending",
    }),
  });

  if (!response.ok) {
    const responseBody = (await response.json().catch(() => null)) as {
      code?: unknown;
      message?: unknown;
    } | null;

    throw createApiError(
      typeof responseBody?.code === "string"
        ? responseBody.code
        : `api/${response.status}`,
      typeof responseBody?.message === "string"
        ? responseBody.message
        : response.statusText,
    );
  }
}

export default function ContractorOnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState<ContractorForm>(initialForm);
  const [documentForm, setDocumentForm] =
    useState<DocumentForm>(initialDocumentForm);
  const [activeDocumentTab, setActiveDocumentTab] =
    useState<DocumentTabId>("required");
  const [verificationStatus, setVerificationStatus] = useState("Not submitted");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [uploadStates, setUploadStates] = useState<UploadStates>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const selectedServices = parseSelectedServices(form.servicesOffered);
  const vehicleDocumentsRequired = needsVehicleDocuments(selectedServices);
  const drivingAbstractRequired = needsDrivingAbstract(selectedServices);
  const visibleTradeLicenceOptions =
    getVisibleTradeLicenceOptions(selectedServices);
  const isUploadingDocument = Object.values(uploadStates).some(
    (uploadState) => uploadState?.isUploading,
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Contractor onboarding: auth state loaded");
      if (user) {
        console.log("Contractor onboarding current uid:", user.uid);
        setCurrentUser(user);
      } else {
        console.log(
          "Contractor onboarding redirect reason: no signed-in user",
        );
        setCurrentUser(null);
        router.replace("/login?reason=contractor-onboarding");
      }

      setAuthLoading(false);
    });

    return unsubscribe;
  }, [router]);

  function updateField(field: keyof ContractorForm, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function updateDocumentField(
    field: keyof DocumentForm,
    value: string | boolean,
  ) {
    setDocumentForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function handleDocumentUpload(
    uploadKey: UploadKey,
    documentType: UploadDocumentType,
    fileList: FileList | null,
  ) {
    const file = fileList?.[0];

    if (!file) {
      return;
    }

    const user = currentUser;

    if (!user) {
      setUploadStates((currentStates) => ({
        ...currentStates,
        [uploadKey]: {
          ...currentStates[uploadKey],
          isUploading: false,
          error: "Please sign in before uploading documents.",
        },
      }));
      return;
    }

    setUploadStates((currentStates) => ({
      ...currentStates,
      [uploadKey]: {
        ...currentStates[uploadKey],
        isUploading: true,
        error: "",
      },
    }));

    try {
      const uploadedFile = await uploadContractorDocument(
        user,
        documentType,
        file,
      );

      setUploadStates((currentStates) => ({
        ...currentStates,
        [uploadKey]: {
          isUploading: false,
          error: "",
          file: uploadedFile,
        },
      }));
    } catch (error) {
      setUploadStates((currentStates) => ({
        ...currentStates,
        [uploadKey]: {
          ...currentStates[uploadKey],
          isUploading: false,
          error: getErrorMessage(error),
        },
      }));
    }
  }

  async function handleContinue() {
    if (isSaving || authLoading || isUploadingDocument) {
      return;
    }

    const user = currentUser;
    if (!user) {
      router.push("/login?reason=contractor-onboarding");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");
      await authPersistenceReady;

      await saveContractorProfileWithApi(user, form, documentForm, uploadStates);

      setVerificationStatus("Pending review");
      console.log(
        "Contractor onboarding redirect reason: contractor profile saved",
      );
      router.push("/contractor/pending-verification");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
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

            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="text-base font-bold text-black">
                  Documents & Verification
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  AZISTO will review your documents before approving your
                  contractor account.
                </p>
              </div>

              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {documentTabs.map((tab) => {
                  const isActive = activeDocumentTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveDocumentTab(tab.id)}
                      className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition ${
                        isActive
                          ? "border-red-500 bg-red-50 text-red-500"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {activeDocumentTab === "required" ? (
                <div className="space-y-4">
                  <UploadCard
                    label="Government photo ID"
                    uploadKey="governmentId"
                    documentType="governmentId"
                    uploadState={uploadStates.governmentId}
                    onUpload={handleDocumentUpload}
                  />
                  <TextInput
                    label="Government ID expiry date"
                    type="date"
                    value={documentForm.governmentIdExpiryDate}
                    onChange={(value) =>
                      updateDocumentField("governmentIdExpiryDate", value)
                    }
                  />
                  <UploadCard
                    label="Business licence, if applicable"
                    uploadKey="businessLicence"
                    documentType="businessLicence"
                    uploadState={uploadStates.businessLicence}
                    onUpload={handleDocumentUpload}
                  />
                  <TextInput
                    label="Business legal name"
                    value={form.legalBusinessName}
                    onChange={(value) =>
                      updateField("legalBusinessName", value)
                    }
                  />
                  <TextInput
                    label="Operating/trade name"
                    value={documentForm.operatingTradeName}
                    onChange={(value) =>
                      updateDocumentField("operatingTradeName", value)
                    }
                  />
                  <TextInput
                    label="Business licence number"
                    value={form.businessLicenceNumber}
                    onChange={(value) =>
                      updateField("businessLicenceNumber", value)
                    }
                  />
                  <TextInput
                    label="Municipality issuing licence"
                    value={documentForm.businessLicenceMunicipality}
                    onChange={(value) =>
                      updateDocumentField("businessLicenceMunicipality", value)
                    }
                  />
                </div>
              ) : null}

              {activeDocumentTab === "insurance" ? (
                <div className="space-y-4">
                  <UploadCard
                    label="Commercial general liability insurance"
                    uploadKey="commercialGeneralLiability"
                    documentType="commercialGeneralLiability"
                    uploadState={uploadStates.commercialGeneralLiability}
                    onUpload={handleDocumentUpload}
                  />
                  <TextInput
                    label="Insurance provider"
                    value={form.insuranceProviderName}
                    onChange={(value) =>
                      updateField("insuranceProviderName", value)
                    }
                  />
                  <TextInput
                    label="Policy number"
                    value={form.insurancePolicyNumber}
                    onChange={(value) =>
                      updateField("insurancePolicyNumber", value)
                    }
                  />
                  <TextInput
                    label="Coverage amount"
                    value={form.coverageAmount}
                    placeholder="$2,000,000"
                    onChange={(value) => updateField("coverageAmount", value)}
                  />
                  <TextInput
                    label="Policy expiry date"
                    type="date"
                    value={form.insuranceExpiryDate}
                    onChange={(value) =>
                      updateField("insuranceExpiryDate", value)
                    }
                  />
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                    Higher-risk services may require higher insurance coverage.
                  </p>
                </div>
              ) : null}

              {activeDocumentTab === "worksafe" ? (
                <div className="space-y-4">
                  <TextInput
                    label="WorkSafeBC account number"
                    value={documentForm.worksafeAccountNumber}
                    onChange={(value) =>
                      updateDocumentField("worksafeAccountNumber", value)
                    }
                  />
                  <UploadCard
                    label="WorkSafeBC clearance letter"
                    uploadKey="worksafeBC"
                    documentType="worksafeBC"
                    uploadState={uploadStates.worksafeBC}
                    onUpload={handleDocumentUpload}
                  />
                  <TextInput
                    label="Clearance expiry date"
                    type="date"
                    value={documentForm.worksafeClearanceExpiryDate}
                    onChange={(value) =>
                      updateDocumentField("worksafeClearanceExpiryDate", value)
                    }
                  />
                  <CheckboxRow
                    checked={documentForm.worksafeConfirmed}
                    onChange={(checked) =>
                      updateDocumentField("worksafeConfirmed", checked)
                    }
                  >
                    I confirm I am responsible for maintaining valid WorkSafeBC
                    coverage if required.
                  </CheckboxRow>
                </div>
              ) : null}

              {activeDocumentTab === "trade" ? (
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-slate-600">
                    Trade document placeholders update based on the services
                    offered field above.
                  </p>
                  {visibleTradeLicenceOptions.map((option) => (
                    <div
                      key={option.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <p className="text-sm font-bold text-black">
                        {option.title}
                      </p>
                      <div className="mt-3">
                        <UploadCard
                          label={option.proofLabel}
                          uploadKey={getTradeLicenceUploadKey(option.id)}
                          documentType="tradeLicence"
                          uploadState={
                            uploadStates[getTradeLicenceUploadKey(option.id)]
                          }
                          onUpload={handleDocumentUpload}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {activeDocumentTab === "vehicle" ? (
                <div className="space-y-4">
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                    {vehicleDocumentsRequired
                      ? "Vehicle documents are expected for the services listed."
                      : "Vehicle documents are not required for the current services, but you can add details if needed."}
                  </p>
                  <UploadCard
                    label="Driver's licence"
                    uploadKey="driverLicence"
                    documentType="driverLicence"
                    uploadState={uploadStates.driverLicence}
                    onUpload={handleDocumentUpload}
                  />
                  <UploadCard
                    label="Vehicle registration"
                    uploadKey="vehicleRegistration"
                    documentType="vehicleRegistration"
                    uploadState={uploadStates.vehicleRegistration}
                    onUpload={handleDocumentUpload}
                  />
                  <UploadCard
                    label="Commercial vehicle insurance"
                    uploadKey="commercialVehicleInsurance"
                    documentType="commercialVehicleInsurance"
                    uploadState={uploadStates.commercialVehicleInsurance}
                    onUpload={handleDocumentUpload}
                  />
                  <UploadCard
                    label="Cargo insurance for moving"
                    uploadKey="cargoInsurance"
                    documentType="cargoInsurance"
                    uploadState={uploadStates.cargoInsurance}
                    onUpload={handleDocumentUpload}
                  />
                  <UploadCard
                    label="On-hook / towing insurance"
                    uploadKey="towingInsurance"
                    documentType="towingInsurance"
                    uploadState={uploadStates.towingInsurance}
                    onUpload={handleDocumentUpload}
                  />
                  <UploadCard
                    label="Garage keeper's liability"
                    uploadKey="garageKeepersLiability"
                    documentType="garageKeepersLiability"
                    uploadState={uploadStates.garageKeepersLiability}
                    onUpload={handleDocumentUpload}
                  />
                  <TextInput
                    label="Vehicle type"
                    value={documentForm.vehicleType}
                    onChange={(value) =>
                      updateDocumentField("vehicleType", value)
                    }
                  />
                  <TextInput
                    label="Licence plate"
                    value={documentForm.licencePlate}
                    onChange={(value) =>
                      updateDocumentField("licencePlate", value)
                    }
                  />
                  <TextInput
                    label="Vehicle insurance expiry date"
                    type="date"
                    value={documentForm.vehicleInsuranceExpiryDate}
                    onChange={(value) =>
                      updateDocumentField("vehicleInsuranceExpiryDate", value)
                    }
                  />
                </div>
              ) : null}

              {activeDocumentTab === "driving" ? (
                <div className="space-y-4">
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                    {drivingAbstractRequired
                      ? "A driving abstract is expected for this service mix."
                      : "A driving abstract is not required for the current services, but you can add it if needed."}
                  </p>
                  <UploadCard
                    label="Driving abstract"
                    uploadKey="drivingAbstract"
                    documentType="drivingAbstract"
                    uploadState={uploadStates.drivingAbstract}
                    onUpload={handleDocumentUpload}
                  />
                  <TextInput
                    label="Driving abstract issue date"
                    type="date"
                    value={documentForm.drivingAbstractIssueDate}
                    onChange={(value) =>
                      updateDocumentField("drivingAbstractIssueDate", value)
                    }
                  />
                  <TextInput
                    label="Driver's licence class"
                    value={documentForm.driverLicenceClass}
                    onChange={(value) =>
                      updateDocumentField("driverLicenceClass", value)
                    }
                  />
                  <TextInput
                    label="Driver's licence expiry date"
                    type="date"
                    value={documentForm.driverLicenceExpiryDate}
                    onChange={(value) =>
                      updateDocumentField("driverLicenceExpiryDate", value)
                    }
                  />
                  <CheckboxRow
                    checked={documentForm.drivingRecordConfirmed}
                    onChange={(checked) =>
                      updateDocumentField("drivingRecordConfirmed", checked)
                    }
                  >
                    I confirm my driving record is accurate and I will update
                    AZISTO if my driving status changes.
                  </CheckboxRow>
                </div>
              ) : null}
            </section>

            {authLoading ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                Checking account...
              </p>
            ) : null}

            {errorMessage ? (
              <p className="whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleContinue}
              disabled={isSaving || authLoading || isUploadingDocument}
              className="flex h-14 w-full items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white shadow-lg shadow-red-100 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
            >
              {authLoading
                ? "Checking account..."
                : isUploadingDocument
                  ? "Uploading documents..."
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
