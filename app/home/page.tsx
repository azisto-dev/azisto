"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Briefcase,
  Filter,
  RotateCw,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { fetchBadgeCounts } from "@/lib/badgeCounts";
import { fetchSessionProfile } from "@/lib/sessionProfile";
import {
  firebaseQuotaMessage,
  isQuotaExceededError,
  isQuotaExceededMessage,
} from "@/lib/apiErrors";
import BottomNav from "@/app/components/BottomNav";
import AppMenu from "@/app/components/AppMenu";
import ContractorJobFilters, {
  type ContractorJobFilterOptions,
  type ContractorJobFilterPreferences,
} from "@/app/components/ContractorJobFilters";

const services = [
  {
    name: "Home Care",
    slug: "home-care",
    image: "/service-icons/home-care.png",
    imageAlt: "Premium home care icon",
    imageClassName: "rounded-[18px]",
  },
  {
    name: "Car Care",
    slug: "car-care",
    image: "/service-icons/car-care.png",
    imageAlt: "Premium car care icon",
    imageClassName: "rounded-[18px]",
  },
  {
    name: "Pet Care",
    slug: "pet-care",
    image: "/service-icons/pet-care.png",
    imageAlt: "Premium pet care icon",
    imageClassName: "rounded-[18px]",
  },
  {
    name: "Garden Care",
    slug: "garden-care",
    image: "/service-icons/garden-care-direct.png",
    imageAlt: "Premium garden care icon",
  },
  {
    name: "Moving",
    slug: "moving",
    image: "/service-icons/moving-direct.png",
    imageAlt: "Premium moving icon",
  },
  {
    name: "Roadside & Emergency",
    slug: "roadside-emergency",
    image: "/service-icons/towing.png",
    imageAlt: "Tow truck carrying a car icon",
  },
];

const emptyContractorFilters: ContractorJobFilterPreferences = {
  categories: [],
  subcategories: [],
  cities: [],
  urgency: "any",
  sort: "newest",
};

const emptyFilterOptions: ContractorJobFilterOptions = {
  categories: [],
  subcategoriesByCategory: {},
  cities: [],
};

type ContractorHomeJob = {
  jobId: string;
  parentJobId: string;
  taskId: string;
  customerFirstName: string;
  customerSafetyBadges: string[];
  selectedServiceCategory: string;
  selectedSubcategories: string[];
  city: string;
  province: string;
  preferredDate: string;
  preferredTime: string;
  urgency: string;
  createdAt: string;
};

type ContractorHomeTask = {
  taskId: string;
  label: string;
};

type ContractorHomeJobCard = ContractorHomeJob & {
  jobId: string;
  taskIds: string[];
  taskLabels: string[];
  tasks: ContractorHomeTask[];
};

type ContractorHomeData = {
  contractorName: string;
  contractorId: string;
  verificationStatus: string;
  completedJobsCount: number;
  averageRating: number;
  reviewCount: number;
  unreadMessagesCount: number;
  activeJob: null | {
    jobId: string;
    serviceCategory: string;
    status: string;
    city: string;
    province: string;
  };
  activeJobBlockingNewInterest: boolean;
  availableJobsCount: number;
  totalAvailableJobsCount: number;
  newTodayCount: number;
  availableJobs: ContractorHomeJob[];
  filters: ContractorJobFilterPreferences;
  savedFilters: ContractorJobFilterPreferences;
  filterOptions: ContractorJobFilterOptions;
  updatedAt: string;
};

function groupContractorHomeJobs(jobs: ContractorHomeJob[]) {
  const groupedJobs = new Map<string, ContractorHomeJobCard>();

  jobs.forEach((job) => {
    const parentJobId = job.parentJobId || job.jobId;
    const taskLabel =
      job.selectedSubcategories[0] ||
      job.selectedServiceCategory ||
      job.taskId ||
      "Task";
    const existingJob = groupedJobs.get(parentJobId);

    if (!existingJob) {
      groupedJobs.set(parentJobId, {
        ...job,
        jobId: parentJobId,
        parentJobId: "",
        taskIds: job.taskId ? [job.taskId] : [],
        taskLabels: [taskLabel],
        tasks: job.taskId
          ? [{ taskId: job.taskId, label: taskLabel }]
          : job.selectedSubcategories.map((subcategory) => ({
              taskId: "",
              label: subcategory,
            })),
        selectedSubcategories: [taskLabel],
      });
      return;
    }

    if (job.taskId && !existingJob.taskIds.includes(job.taskId)) {
      existingJob.taskIds.push(job.taskId);
      existingJob.tasks.push({ taskId: job.taskId, label: taskLabel });
    }

    if (!existingJob.taskLabels.includes(taskLabel)) {
      existingJob.taskLabels.push(taskLabel);
      existingJob.selectedSubcategories.push(taskLabel);
    }

    if (job.createdAt > existingJob.createdAt) {
      existingJob.createdAt = job.createdAt;
    }
  });

  return Array.from(groupedJobs.values()).sort((firstJob, secondJob) =>
    secondJob.createdAt.localeCompare(firstJob.createdAt),
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17H9m9-1V11a6 6 0 1 0-12 0v5l-2 2h16l-2-2ZM10 21h4"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 text-black"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z"
      />
    </svg>
  );
}

function getFirstName(name: string) {
  return name.trim().split(" ").filter(Boolean)[0] ?? "";
}

function readNumber(value: unknown) {
  return typeof value === "number" ? value : 0;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function readFilterPreferences(value: unknown): ContractorJobFilterPreferences {
  if (typeof value !== "object" || value === null) {
    return emptyContractorFilters;
  }

  const data = value as Record<string, unknown>;
  const urgency =
    data.urgency === "flexible" ||
    data.urgency === "this_week" ||
    data.urgency === "urgent"
      ? data.urgency
      : "any";
  const sort = data.sort === "urgent" ? "urgent" : "newest";

  return {
    categories: readStringList(data.categories),
    subcategories: readStringList(data.subcategories),
    cities: readStringList(data.cities),
    urgency,
    sort,
  };
}

function readFilterOptions(value: unknown): ContractorJobFilterOptions {
  if (typeof value !== "object" || value === null) {
    return emptyFilterOptions;
  }

  const data = value as Record<string, unknown>;
  const subcategoriesByCategory =
    typeof data.subcategoriesByCategory === "object" &&
    data.subcategoriesByCategory !== null
      ? Object.fromEntries(
          Object.entries(data.subcategoriesByCategory).map(([key, list]) => [
            key,
            readStringList(list),
          ]),
        )
      : {};

  return {
    categories: readStringList(data.categories),
    subcategoriesByCategory,
    cities: readStringList(data.cities),
  };
}

function readContractorHomeData(value: unknown): ContractorHomeData {
  const data =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  return {
    contractorName: readString(data.contractorName),
    contractorId: readString(data.contractorId),
    verificationStatus: readString(data.verificationStatus),
    completedJobsCount: readNumber(data.completedJobsCount),
    averageRating: readNumber(data.averageRating),
    reviewCount: readNumber(data.reviewCount),
    unreadMessagesCount: readNumber(data.unreadMessagesCount),
    activeJob:
      typeof data.activeJob === "object" && data.activeJob !== null
        ? {
            jobId: readString((data.activeJob as Record<string, unknown>).jobId),
            serviceCategory: readString(
              (data.activeJob as Record<string, unknown>).serviceCategory,
            ),
            status: readString((data.activeJob as Record<string, unknown>).status),
            city: readString((data.activeJob as Record<string, unknown>).city),
            province: readString(
              (data.activeJob as Record<string, unknown>).province,
            ),
          }
        : null,
    activeJobBlockingNewInterest: data.activeJobBlockingNewInterest === true,
    availableJobsCount: readNumber(data.availableJobsCount),
    totalAvailableJobsCount: readNumber(data.totalAvailableJobsCount),
    newTodayCount: readNumber(data.newTodayCount),
    availableJobs: Array.isArray(data.availableJobs)
      ? data.availableJobs.map((job) => {
          const jobData =
            typeof job === "object" && job !== null
              ? (job as Record<string, unknown>)
              : {};

          return {
            jobId: readString(jobData.jobId),
            parentJobId: readString(jobData.parentJobId),
            taskId: readString(jobData.taskId),
            customerFirstName: readString(jobData.customerFirstName),
            customerSafetyBadges: readStringList(jobData.customerSafetyBadges),
            selectedServiceCategory: readString(jobData.selectedServiceCategory),
            selectedSubcategories: readStringList(jobData.selectedSubcategories),
            city: readString(jobData.city),
            province: readString(jobData.province),
            preferredDate: readString(jobData.preferredDate),
            preferredTime: readString(jobData.preferredTime),
            urgency: readString(jobData.urgency),
            createdAt: readString(jobData.createdAt),
          };
        })
      : [],
    filters: readFilterPreferences(data.filters),
    savedFilters: readFilterPreferences(data.savedFilters),
    filterOptions: readFilterOptions(data.filterOptions),
    updatedAt: readString(data.updatedAt),
  };
}

function buildFilterQuery(filters: ContractorJobFilterPreferences) {
  const params = new URLSearchParams();

  if (filters.categories.length > 0) {
    params.set("categories", filters.categories.join(","));
  }

  if (filters.subcategories.length > 0) {
    params.set("subcategories", filters.subcategories.join(","));
  }

  if (filters.cities.length > 0) {
    params.set("cities", filters.cities.join(","));
  }

  if (filters.urgency !== "any") {
    params.set("urgency", filters.urgency);
  }

  if (filters.sort !== "newest") {
    params.set("sort", filters.sort);
  }

  const query = params.toString();

  return query ? `?${query}` : "";
}

function formatRelativeTime(value: string) {
  if (!value) {
    return "Posted recently";
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "Posted recently";
  }

  const differenceInMinutes = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 60000),
  );

  if (differenceInMinutes < 1) {
    return "Posted just now";
  }

  if (differenceInMinutes < 60) {
    return `Posted ${differenceInMinutes} min ago`;
  }

  const differenceInHours = Math.floor(differenceInMinutes / 60);

  if (differenceInHours < 24) {
    return `Posted ${differenceInHours} hr ago`;
  }

  const differenceInDays = Math.floor(differenceInHours / 24);

  return `Posted ${differenceInDays} day${differenceInDays === 1 ? "" : "s"} ago`;
}

function formatDateTime(date: string, time: string) {
  if (!date && !time) {
    return "Flexible timing";
  }

  return [date, time].filter(Boolean).join(" at ");
}

async function fetchContractorFilterPreferences(user: User) {
  const token = await user.getIdToken();
  const response = await fetch("/api/contractors/job-filters", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = (await response.json().catch(() => null)) as {
    preferences?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Unable to load saved filters.",
    );
  }

  return readFilterPreferences(body?.preferences);
}

async function saveContractorFilterPreferences(
  user: User,
  filters: ContractorJobFilterPreferences,
) {
  const token = await user.getIdToken();
  const response = await fetch("/api/contractors/job-filters", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(filters),
  });
  const body = (await response.json().catch(() => null)) as {
    preferences?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Unable to save filters.",
    );
  }

  return readFilterPreferences(body?.preferences);
}

async function fetchContractorHome(
  user: User,
  filters: ContractorJobFilterPreferences,
) {
  const token = await user.getIdToken();
  const response = await fetch(
    `/api/contractors/home${buildFilterQuery(filters)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof body?.message === "string"
        ? body.message
        : "Unable to load contractor workspace.";

    throw new Error(
      isQuotaExceededMessage(message) ? firebaseQuotaMessage : message,
    );
  }

  return readContractorHomeData(body);
}

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [role, setRole] = useState<"customer" | "contractor" | "unknown">(
    "unknown",
  );
  const [greetingName, setGreetingName] = useState("");
  const [notificationBadgeCount, setNotificationBadgeCount] = useState(0);
  const [contractorHome, setContractorHome] =
    useState<ContractorHomeData | null>(null);
  const [contractorFilters, setContractorFilters] =
    useState<ContractorJobFilterPreferences>(emptyContractorFilters);
  const [filterOptions, setFilterOptions] =
    useState<ContractorJobFilterOptions>(emptyFilterOptions);
  const [isContractorHomeLoading, setIsContractorHomeLoading] = useState(false);
  const [isRefreshingContractorHome, setIsRefreshingContractorHome] =
    useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isSavingFilters, setIsSavingFilters] = useState(false);
  const [homeErrorMessage, setHomeErrorMessage] = useState("");
  const [contractorHomeError, setContractorHomeError] = useState("");
  const notificationsHref = role === "unknown" ? "/login" : "/notifications";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Home auth state loaded");
      setCurrentUser(user);

      if (!user) {
        console.log("Home current uid: none");
        console.log("Home redirect reason: none, public home");
        setRole("unknown");
        setGreetingName("");
        setHomeErrorMessage("");
        setNotificationBadgeCount(0);
        setContractorHome(null);
        setContractorFilters(emptyContractorFilters);
        setFilterOptions(emptyFilterOptions);
        return;
      }

      console.log("Home current uid:", user.uid);

      try {
        const profile = await fetchSessionProfile(user);
        console.log("Home role API result:", profile);
        setRole(profile.role);
        setGreetingName(getFirstName(profile.displayName));
        setHomeErrorMessage(
          profile.quotaExceeded ? firebaseQuotaMessage : "",
        );
      } catch (error) {
        if (!isQuotaExceededError(error)) {
          console.error("Home role lookup failed:", error);
        }

        setHomeErrorMessage(
          isQuotaExceededError(error)
            ? firebaseQuotaMessage
            : error instanceof Error
              ? error.message
              : "Unable to load your account profile.",
        );
        setRole("unknown");
        setGreetingName("");
        setNotificationBadgeCount(0);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    async function loadNotificationBadge(user: User) {
      try {
        const counts = await fetchBadgeCounts(user);
        setNotificationBadgeCount(counts.notifications);
      } catch (error) {
        if (!isQuotaExceededError(error)) {
          console.error("Home notification badge lookup failed:", error);
        }

        setNotificationBadgeCount(0);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setNotificationBadgeCount(0);
        return;
      }

      void loadNotificationBadge(user);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  async function loadContractorWorkspace(
    user: User,
    filters: ContractorJobFilterPreferences,
    options: { showLoading?: boolean } = {},
  ) {
    if (options.showLoading) {
      setIsContractorHomeLoading(true);
    } else {
      setIsRefreshingContractorHome(true);
    }

    try {
      const nextHome = await fetchContractorHome(user, filters);
      setContractorHome(nextHome);
      setFilterOptions(nextHome.filterOptions);
      setContractorHomeError("");
    } catch (error) {
      setContractorHomeError(
        error instanceof Error
          ? error.message
          : "Unable to load contractor workspace.",
      );
    } finally {
      setIsContractorHomeLoading(false);
      setIsRefreshingContractorHome(false);
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadInitialContractorWorkspace(user: User) {
      setIsContractorHomeLoading(true);
      setContractorHomeError("");

      try {
        const savedFilters = await fetchContractorFilterPreferences(user);

        if (isCancelled) {
          return;
        }

        setContractorFilters(savedFilters);
        const nextHome = await fetchContractorHome(user, savedFilters);

        if (isCancelled) {
          return;
        }

        setContractorHome(nextHome);
        setFilterOptions(nextHome.filterOptions);
      } catch (error) {
        if (!isCancelled) {
          setContractorHomeError(
            error instanceof Error
              ? error.message
              : "Unable to load contractor workspace.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsContractorHomeLoading(false);
        }
      }
    }

    if (role !== "contractor" || !currentUser) {
      setContractorHome(null);
      return () => {
        isCancelled = true;
      };
    }

    void loadInitialContractorWorkspace(currentUser);

    return () => {
      isCancelled = true;
    };
  }, [currentUser, role]);

  useEffect(() => {
    if (role !== "contractor" || !currentUser) {
      return;
    }

    const intervalId = setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void loadContractorWorkspace(currentUser, contractorFilters);
    }, 60000);

    return () => clearInterval(intervalId);
  }, [contractorFilters, currentUser, role]);

  async function handleApplyContractorFilters(
    nextFilters: ContractorJobFilterPreferences,
  ) {
    setContractorFilters(nextFilters);
    setIsFilterSheetOpen(false);

    if (currentUser) {
      await loadContractorWorkspace(currentUser, nextFilters);
    }
  }

  async function handleSaveContractorFilters(
    nextFilters: ContractorJobFilterPreferences,
  ) {
    if (!currentUser) {
      return;
    }

    setIsSavingFilters(true);

    try {
      const savedFilters = await saveContractorFilterPreferences(
        currentUser,
        nextFilters,
      );
      setContractorFilters(savedFilters);
      setIsFilterSheetOpen(false);
      await loadContractorWorkspace(currentUser, savedFilters);
    } catch (error) {
      setContractorHomeError(
        error instanceof Error ? error.message : "Unable to save filters.",
      );
    } finally {
      setIsSavingFilters(false);
    }
  }

  async function handleClearContractorFilters() {
    setContractorFilters(emptyContractorFilters);
    setIsFilterSheetOpen(false);

    if (currentUser) {
      await loadContractorWorkspace(currentUser, emptyContractorFilters);
    }
  }

  if (role === "contractor") {
    const contractorGreetingName =
      getFirstName(contractorHome?.contractorName ?? "") || greetingName;
    const contractorAvailableJobCards = groupContractorHomeJobs(
      contractorHome?.availableJobs ?? [],
    );
    const hasActiveFilters =
      contractorFilters.categories.length > 0 ||
      contractorFilters.subcategories.length > 0 ||
      contractorFilters.cities.length > 0 ||
      contractorFilters.urgency !== "any" ||
      contractorFilters.sort !== "newest";

    return (
      <main className="min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
        <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
          <div className="flex-1 px-5 pb-6 pt-5">
            <div className="mb-5 flex items-center justify-between text-xs font-bold">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-3 rounded-sm bg-black" />
                <span className="h-2.5 w-3 rounded-sm border border-black" />
                <span className="h-2.5 w-5 rounded-sm bg-black" />
              </div>
            </div>

            <header className="relative mt-3 grid grid-cols-[40px_1fr_40px] items-center">
              <AppMenu role={role} />

              <Link href="/home" className="flex justify-center">
                <img
                  src="/azisto-logo-cropped.png"
                  alt="AZISTO - Your on-demand assistant"
                  className="w-full max-w-[165px] object-contain"
                />
              </Link>

              <Link
                href={notificationsHref}
                className="relative flex h-10 w-10 items-center justify-center justify-self-end rounded-full text-black"
                aria-label="Notifications"
              >
                <BellIcon />
                {notificationBadgeCount > 0 ? (
                  <span className="absolute right-0 top-0 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-azisto-danger px-1 text-[10px] font-black leading-none text-white shadow-md shadow-red-200 ring-2 ring-white">
                    {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
                  </span>
                ) : null}
              </Link>
            </header>

            <section className="mt-6">
              <h1 className="text-xl font-normal leading-tight text-black">
                Hello
                {contractorGreetingName ? (
                  <>
                    ,{" "}
                    <span className="text-azisto-text">
                      {contractorGreetingName}
                    </span>
                  </>
                ) : null}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                New jobs near you are updating live.
              </p>
            </section>

            {homeErrorMessage ? (
              <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
                {homeErrorMessage}
              </p>
            ) : null}

            {contractorHome?.activeJobBlockingNewInterest ? (
              <p className="mt-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
                Complete your active job before accepting a new one.
              </p>
            ) : null}

            <section className="mt-5 grid grid-cols-2 gap-2">
              {[
                {
                  label: "Available",
                  value: contractorHome?.availableJobsCount ?? 0,
                  className: "border-emerald-100 bg-emerald-50",
                },
                {
                  label: "New today",
                  value: contractorHome?.newTodayCount ?? 0,
                  className: "border-sky-100 bg-sky-50",
                },
                {
                  label: "Unread",
                  value: contractorHome?.unreadMessagesCount ?? 0,
                  className: "border-violet-100 bg-violet-50",
                },
                {
                  label: "Rating",
                  value: contractorHome?.averageRating ?? 0,
                  className: "border-slate-200 bg-slate-100",
                  isRating: true,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={`rounded-xl border px-3 py-3 shadow-sm ${stat.className}`}
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-azisto-muted">
                    {stat.label}
                  </p>
                  {stat.isRating ? (
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-lg font-bold leading-none text-azisto-text">
                        {stat.value > 0 ? stat.value.toFixed(1) : "New"}
                      </span>
                      <span
                        className="flex text-sm leading-none text-[#FFD700]"
                        aria-label={
                          stat.value > 0
                            ? `${stat.value.toFixed(1)} star rating`
                            : "No rating yet"
                        }
                      >
                        {Array.from({ length: 5 }).map((_, index) => (
                          <span
                            key={index}
                            className={
                              index < Math.round(stat.value)
                                ? "text-[#FFD700]"
                                : "text-[#FFD700]/30"
                            }
                          >
                            ★
                          </span>
                        ))}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-1 truncate text-lg font-bold capitalize text-azisto-text">
                      {stat.value}
                    </p>
                  )}
                </div>
              ))}
            </section>

            <div className="mt-5">
              <button
                type="button"
                onClick={() =>
                  currentUser &&
                  void loadContractorWorkspace(currentUser, contractorFilters)
                }
                className="az-btn-secondary flex h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold"
              >
                <RotateCw
                  aria-hidden="true"
                  className={`h-4 w-4 ${isRefreshingContractorHome ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            <section className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    Live
                  </span>
                  <h2 className="mt-1 text-lg font-bold text-black">
                    Available jobs
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterSheetOpen(true)}
                  className="az-btn-secondary flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold"
                >
                  <Filter aria-hidden="true" className="h-4 w-4" />
                  Filter
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-azisto-muted">
                  Updated just now
                </span>
                {contractorHome && contractorHome.newTodayCount > 0 ? (
                  <span className="rounded-full border border-azisto-gold/30 bg-azisto-gold/10 px-3 py-1 text-xs font-bold text-azisto-text">
                    New jobs added recently
                  </span>
                ) : null}
                {hasActiveFilters ? (
                  <span className="rounded-full border border-azisto-border bg-white px-3 py-1 text-xs font-bold text-slate-600">
                    Filters active
                  </span>
                ) : null}
              </div>

              {contractorHomeError ? (
                <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                  {contractorHomeError}
                </p>
              ) : null}

              {isContractorHomeLoading ? (
                <p className="mt-4 rounded-xl border border-azisto-border bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                  Loading live contractor workspace...
                </p>
              ) : null}

              {!isContractorHomeLoading &&
              contractorHome &&
              contractorAvailableJobCards.length === 0 ? (
                <div className="mt-4 rounded-xl border border-azisto-border bg-white p-5 text-center shadow-sm">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-azisto-text">
                    <Briefcase aria-hidden="true" className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-black">
                    No matching open jobs yet
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Adjust your filters or check back soon. This feed refreshes
                    every 30 seconds.
                  </p>
                </div>
              ) : null}

              <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2 pr-1 shadow-inner">
                {contractorAvailableJobCards.map((job) => (
                  <article
                    key={job.jobId}
                    className="rounded-xl border border-azisto-primary bg-white px-3 py-2.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-[13px] font-bold leading-5 text-black">
                          {job.selectedServiceCategory || "Service request"}
                        </h3>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.09em] text-[#1E3A8A]">
                          {job.jobId}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-right text-[13px] font-bold capitalize leading-5 text-black">
                        {[job.city, job.province].filter(Boolean).join(", ") ||
                          "Location pending"}
                      </span>
                    </div>

                    {job.tasks.length > 0 ? (
                      <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-1.5">
                        {job.tasks.map((task, index) => (
                          <div
                            key={task.taskId || `${job.jobId}-${task.label}`}
                            className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-[0.08em] az-job-id">
                              {task.taskId || `Task ${index + 1}`}
                            </span>
                            <span className="text-[11px] font-bold text-slate-800">
                              {task.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-2 space-y-1 text-[11px] font-semibold text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate">
                          Customer: {job.customerFirstName || "Customer"}
                        </p>
                        <p className="shrink-0 text-right capitalize">
                          {job.urgency || "Flexible"}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate">
                          {formatRelativeTime(job.createdAt)}
                        </p>
                        <p className="shrink-0 text-right">
                          {formatDateTime(job.preferredDate, job.preferredTime)}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/contractor/jobs/${encodeURIComponent(job.jobId)}`}
                      className="az-btn-royal-blue mt-2 flex h-9 items-center justify-center rounded-xl text-xs font-bold"
                    >
                      View job
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <BottomNav role="contractor" />
        </div>

        <ContractorJobFilters
          isOpen={isFilterSheetOpen}
          filters={contractorFilters}
          options={filterOptions}
          isSaving={isSavingFilters}
          onClose={() => setIsFilterSheetOpen(false)}
          onApply={handleApplyContractorFilters}
          onSave={handleSaveContractorFilters}
          onClear={handleClearContractorFilters}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-azisto-background text-black md:bg-azisto-background md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-azisto-border">
        <div className="flex-1 px-5 pb-6 pt-5">
          <div className="mb-5 flex items-center justify-between text-xs font-bold">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-3 rounded-sm bg-black" />
              <span className="h-2.5 w-3 rounded-sm border border-black" />
              <span className="h-2.5 w-5 rounded-sm bg-black" />
            </div>
          </div>

          <header className="relative mt-3 grid grid-cols-[40px_1fr_40px] items-center">
            <AppMenu role={role} />

            <Link href="/home" className="flex justify-center">
              <img
                src="/azisto-logo-cropped.png"
                alt="AZISTO - Your on-demand assistant"
                className="w-full max-w-[165px] object-contain"
              />
            </Link>

            <Link
              href={notificationsHref}
              className="relative flex h-10 w-10 items-center justify-center justify-self-end rounded-full text-black"
              aria-label="Notifications"
            >
              <BellIcon />
              {notificationBadgeCount > 0 ? (
                <span className="absolute right-0 top-0 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-azisto-danger px-1 text-[10px] font-black leading-none text-white shadow-md shadow-red-200 ring-2 ring-white">
                  {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
                </span>
              ) : null}
            </Link>
          </header>

          <section className="mt-6">
            <h1 className="text-xl font-normal leading-tight text-black">
              Hello
              {greetingName ? (
                <>
                  ,{" "}
                  <span className="text-azisto-text">{greetingName}</span>
                </>
              ) : null}
            </h1>
          </section>

          {homeErrorMessage ? (
            <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
              {homeErrorMessage}
            </p>
          ) : null}

          <div className="mt-5 flex h-14 items-center gap-3 rounded-lg border border-azisto-border bg-white px-4 text-sm text-slate-500 shadow-sm">
            <Link
              href={role === "unknown" ? "/login" : "/service/home-care"}
              className="flex min-w-0 flex-1 items-center justify-between gap-3"
            >
              <span className="truncate">What do you need help with?</span>
              <SearchIcon />
            </Link>

            <Link
              href="/ai-assistant"
              className="azisto-ai-glow az-ai-pill flex h-9 shrink-0 items-center justify-center rounded-full px-3 text-xs font-bold"
              aria-label="Open AZISTO AI assistant"
            >
              ✨ AI
            </Link>
          </div>

          <section className="mt-6 grid grid-cols-3 gap-3">
            {services.map((service) => (
              <Link
                key={service.name}
                href={`/service/${service.slug}`}
                className="flex min-h-[86px] flex-col items-center justify-start text-center"
              >
                <img
                  src={service.image}
                  alt={service.imageAlt}
                  className={`h-16 w-16 object-contain ${
                    service.imageClassName ?? ""
                  }`}
                />
                <span className="mt-2 text-xs font-bold leading-tight text-black">
                  {service.name}
                </span>
              </Link>
            ))}
          </section>

          <section className="mt-6 rounded-lg border border-azisto-border bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-black">
              Trusted professionals
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Verified. Rated. Reliable.
            </p>

            <div className="mt-5 flex items-center justify-between">
              <div className="flex -space-x-2">
                {["AJ", "MK", "SR"].map((initials) => (
                  <div
                    key={initials}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-[10px] font-bold text-white"
                  >
                    {initials}
                  </div>
                ))}
              </div>

              <p className="text-sm font-semibold text-black">
                <span className="text-[#FFD700]">★</span> 4.9{" "}
                <span className="font-normal text-slate-500">
                  (2.3k reviews)
                </span>
              </p>
            </div>
          </section>
        </div>

        <BottomNav role={role} />
      </div>
    </main>
  );
}
