"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Briefcase,
  Filter,
  RotateCw,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import {
  refreshBadgeCountsNow,
  subscribeBadgeCounts,
} from "@/lib/badgeCounts";
import { fetchSessionProfile } from "@/lib/sessionProfile";
import {
  connectionInterruptedMessage,
  firebaseQuotaMessage,
  getRetryBackoffMs,
  isQuotaExceededError,
  isQuotaExceededMessage,
  isTransientApiError,
} from "@/lib/apiErrors";
import {
  authenticatedFetch,
  throwApiResponseError,
} from "@/lib/authenticatedFetch";
import { formatScheduleLabel, type JobSchedule } from "@/lib/jobSchedule";
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
  serviceCities: [],
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
  scheduleMode: string;
  preferredDate: string;
  preferredTime: string;
  preferredTimeWindow: string;
  urgency: string;
  schedule: JobSchedule | null;
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
  interestedJobsCount: number;
  matchingNotificationsCreated: number;
  availableJobs: ContractorHomeJob[];
  filters: ContractorJobFilterPreferences;
  savedFilters: ContractorJobFilterPreferences;
  filterOptions: ContractorJobFilterOptions;
  updatedAt: string;
};

type ContractorNetworkStatus = "online" | "offline" | "limited";

const contractorHomeCacheTtlMs = 120_000;
const contractorHomeCache = new Map<
  string,
  {
    data: ContractorHomeData;
    expiresAt: number;
  }
>();
const contractorHomeRequests = new Map<string, Promise<ContractorHomeData>>();
let lastGlobalContractorHomeSuccessAt: number | null = null;

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
    serviceCities: readStringList(data.serviceCities ?? data.cities),
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
    interestedJobsCount: readNumber(data.interestedJobsCount),
    matchingNotificationsCreated: readNumber(
      data.matchingNotificationsCreated,
    ),
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
            scheduleMode: readString(jobData.scheduleMode),
            preferredDate: readString(jobData.preferredDate),
            preferredTime: readString(jobData.preferredTime),
            preferredTimeWindow: readString(jobData.preferredTimeWindow),
            urgency: readString(jobData.urgency),
            schedule:
              typeof jobData.schedule === "object" && jobData.schedule !== null
                ? (jobData.schedule as JobSchedule)
                : null,
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
  params.set("filterOverride", "1");

  if (filters.categories.length > 0) {
    params.set("categories", filters.categories.join(","));
  }

  if (filters.subcategories.length > 0) {
    params.set("subcategories", filters.subcategories.join(","));
  }

  if (filters.serviceCities.length > 0) {
    params.set("serviceCities", filters.serviceCities.join(","));
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

function isRecentlyPosted(value: string) {
  const timestamp = new Date(value).getTime();

  return !Number.isNaN(timestamp) && Date.now() - timestamp < 24 * 60 * 60 * 1000;
}

function getTimeOfDayGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good Morning";
  }

  if (hour < 18) {
    return "Good Afternoon";
  }

  return "Good Evening";
}

function formatWorkspaceUpdateTime(value: number | null) {
  if (!value) {
    return "Retrying soon";
  }

  const minutesAgo = Math.max(0, Math.floor((Date.now() - value) / 60_000));

  if (minutesAgo < 1) {
    return "Updated just now";
  }

  return `Updated ${minutesAgo} min ago`;
}

async function fetchContractorFilterPreferences(user: User) {
  const response = await authenticatedFetch(user, "/api/contractors/job-filters");
  const body = (await response.json().catch(() => null)) as {
    preferences?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok) {
    await throwApiResponseError(
      response,
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
  const response = await authenticatedFetch(user, "/api/contractors/job-filters", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(filters),
  });
  const body = (await response.json().catch(() => null)) as {
    preferences?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok) {
    await throwApiResponseError(
      response,
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
  source: string,
  forceRefresh = false,
) {
  const requestKey = `${user.uid}:${buildFilterQuery(filters)}`;
  const now = Date.now();
  const cachedHome = contractorHomeCache.get(requestKey);

  if (!forceRefresh && cachedHome && cachedHome.expiresAt > now) {
    lastGlobalContractorHomeSuccessAt = now;
    return cachedHome.data;
  }

  const pendingRequest = contractorHomeRequests.get(requestKey);

  if (pendingRequest) {
    return pendingRequest;
  }

  const request = (async () => {
  console.log(
    `[${new Date().toISOString()}] CONTRACTOR HOME FETCH source: ${source}`,
  );
  const response = await authenticatedFetch(
    user,
    `/api/contractors/home${buildFilterQuery(filters)}`,
    {
      headers: {
        "X-Azisto-Trigger": source,
      },
    },
  );
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof body?.message === "string"
        ? body.message
        : "Unable to load contractor workspace.";

    await throwApiResponseError(
      response,
      isQuotaExceededMessage(message) ? firebaseQuotaMessage : message,
    );
  }

    const data = readContractorHomeData(body);

    contractorHomeCache.set(requestKey, {
      data: {
        ...data,
        matchingNotificationsCreated: 0,
      },
      expiresAt: Date.now() + contractorHomeCacheTtlMs,
    });
    lastGlobalContractorHomeSuccessAt = Date.now();

    return data;
  })().finally(() => contractorHomeRequests.delete(requestKey));

  contractorHomeRequests.set(requestKey, request);

  return request;
}

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [role, setRole] = useState<"customer" | "contractor" | "unknown">(
    "unknown",
  );
  const [isRoleLoading, setIsRoleLoading] = useState(true);
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
  const [contractorNetworkStatus, setContractorNetworkStatus] =
    useState<ContractorNetworkStatus>(() =>
      lastGlobalContractorHomeSuccessAt !== null &&
      Date.now() - lastGlobalContractorHomeSuccessAt < 135_000
        ? "online"
        : "limited",
    );
  const [lastSuccessfulContractorFetchAt, setLastSuccessfulContractorFetchAt] =
    useState<number | null>(lastGlobalContractorHomeSuccessAt);
  const [networkStatusClock, setNetworkStatusClock] = useState(() => Date.now());
  const contractorHomeRequestInFlightRef = useRef(false);
  const contractorHomeRetryAfterRef = useRef(0);
  const contractorHomeInitializedUidRef = useRef("");
  const contractorFiltersRef = useRef(contractorFilters);
  const lastSuccessfulContractorFetchAtRef = useRef<number | null>(
    lastGlobalContractorHomeSuccessAt,
  );
  const notificationsHref = role === "unknown" ? "/login" : "/notifications";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Home auth state loaded");
      setCurrentUser(user);
      setIsRoleLoading(true);

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
        setIsRoleLoading(false);
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
      } finally {
        setIsRoleLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let unsubscribeBadges: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribeBadges?.();
      unsubscribeBadges = null;

      if (!user) {
        setNotificationBadgeCount(0);
        return;
      }

      unsubscribeBadges = subscribeBadgeCounts(
        user,
        (counts) => setNotificationBadgeCount(counts.notifications),
        "HomePage",
      );
    });

    return () => {
      unsubscribe();
      unsubscribeBadges?.();
    };
  }, []);

  useEffect(() => {
    function handleOnline() {
      const lastSuccess =
        lastSuccessfulContractorFetchAtRef.current ??
        lastGlobalContractorHomeSuccessAt;
      const hasRecentSuccess =
        lastSuccess !== null && Date.now() - lastSuccess < 135_000;

      setContractorNetworkStatus(hasRecentSuccess ? "online" : "limited");
    }

    function handleOffline() {
      setContractorNetworkStatus("offline");
    }

    handleOnline();
    if (!window.navigator.onLine) {
      setContractorNetworkStatus("offline");
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const statusClockInterval = window.setInterval(
      () => setNetworkStatusClock(Date.now()),
      30_000,
    );

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(statusClockInterval);
    };
  }, []);

  async function loadContractorWorkspace(
    user: User,
    filters: ContractorJobFilterPreferences,
    options: { showLoading?: boolean; forceRefresh?: boolean } = {},
    source = "manual",
  ) {
    if (
      contractorHomeRequestInFlightRef.current ||
      contractorHomeRetryAfterRef.current > Date.now()
    ) {
      return;
    }

    contractorHomeRequestInFlightRef.current = true;

    if (options.showLoading) {
      setIsContractorHomeLoading(true);
    } else {
      setIsRefreshingContractorHome(true);
    }

    try {
      const nextHome = await fetchContractorHome(
        user,
        filters,
        source,
        options.forceRefresh,
      );
      setContractorHome(nextHome);
      setFilterOptions(nextHome.filterOptions);
      if (nextHome.matchingNotificationsCreated > 0) {
        await refreshBadgeCountsNow(user, "contractor matching notification");
      }
      setContractorHomeError("");
      const fetchedAt = Date.now();
      lastSuccessfulContractorFetchAtRef.current = fetchedAt;
      setLastSuccessfulContractorFetchAt(fetchedAt);
      setContractorNetworkStatus(
        window.navigator.onLine ? "online" : "offline",
      );
    } catch (error) {
      const backoffMs = isQuotaExceededError(error)
        ? 10 * 60_000
        : getRetryBackoffMs(error);

      if (backoffMs > 0) {
        contractorHomeRetryAfterRef.current = Date.now() + backoffMs;
      }

      setContractorHomeError(
        isTransientApiError(error)
          ? connectionInterruptedMessage
          : error instanceof Error
          ? error.message
          : "Unable to load contractor workspace.",
      );
      setContractorNetworkStatus(
        window.navigator.onLine ? "limited" : "offline",
      );
    } finally {
      contractorHomeRequestInFlightRef.current = false;
      setIsContractorHomeLoading(false);
      setIsRefreshingContractorHome(false);
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadInitialContractorWorkspace(user: User) {
      if (
        contractorHomeRequestInFlightRef.current ||
        contractorHomeInitializedUidRef.current === user.uid
      ) {
        return;
      }

      contractorHomeInitializedUidRef.current = user.uid;
      contractorHomeRequestInFlightRef.current = true;
      setIsContractorHomeLoading(true);
      setContractorHomeError("");

      try {
        const savedFilters = await fetchContractorFilterPreferences(user);

        if (isCancelled) {
          return;
        }

        setContractorFilters(savedFilters);
        const nextHome = await fetchContractorHome(
          user,
          savedFilters,
          "page-open",
        );

        if (isCancelled) {
          return;
        }

        setContractorHome(nextHome);
        setFilterOptions(nextHome.filterOptions);
        if (nextHome.matchingNotificationsCreated > 0) {
          await refreshBadgeCountsNow(
            user,
            "contractor matching notification",
          );
        }
        const fetchedAt = Date.now();
        lastSuccessfulContractorFetchAtRef.current = fetchedAt;
        setLastSuccessfulContractorFetchAt(fetchedAt);
        setContractorNetworkStatus(
          window.navigator.onLine ? "online" : "offline",
        );
      } catch (error) {
        if (!isCancelled) {
          const backoffMs = isQuotaExceededError(error)
            ? 10 * 60_000
            : getRetryBackoffMs(error);

          if (backoffMs > 0) {
            contractorHomeRetryAfterRef.current = Date.now() + backoffMs;
          }

          setContractorHomeError(
            isTransientApiError(error)
              ? connectionInterruptedMessage
              : error instanceof Error
              ? error.message
              : "Unable to load contractor workspace.",
          );
          setContractorNetworkStatus(
            window.navigator.onLine ? "limited" : "offline",
          );
        }
      } finally {
        contractorHomeRequestInFlightRef.current = false;

        if (!isCancelled) {
          setIsContractorHomeLoading(false);
        }
      }
    }

    if (role !== "contractor" || !currentUser) {
      contractorHomeInitializedUidRef.current = "";
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
    contractorFiltersRef.current = contractorFilters;
  }, [contractorFilters]);

  useEffect(() => {
    if (role !== "contractor" || !currentUser) {
      return;
    }

    const runtimeWindow = window as typeof window & {
      __azistoContractorHomeInterval?: ReturnType<typeof setInterval>;
    };

    if (runtimeWindow.__azistoContractorHomeInterval) {
      clearInterval(runtimeWindow.__azistoContractorHomeInterval);
    }

    console.log(`[${new Date().toISOString()}] HOME_INTERVAL_CREATED`);
    console.count("HOME_INTERVAL_CREATED");
    const intervalId = setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void loadContractorWorkspace(
        currentUser,
        contractorFiltersRef.current,
        {},
        "interval",
      );
    }, 120_000);

    runtimeWindow.__azistoContractorHomeInterval = intervalId;

    return () => {
      clearInterval(intervalId);

      if (runtimeWindow.__azistoContractorHomeInterval === intervalId) {
        delete runtimeWindow.__azistoContractorHomeInterval;
      }
    };
  }, [currentUser, role]);

  useEffect(() => {
    if (role !== "contractor" || !currentUser) {
      return;
    }

    function markCachedWorkspaceFresh() {
      if (document.visibilityState !== "visible") {
        return;
      }

      if (!window.navigator.onLine) {
        setContractorNetworkStatus("offline");
        return;
      }

      if (contractorHomeRetryAfterRef.current > Date.now()) {
        setContractorNetworkStatus("limited");
        return;
      }

      if (contractorHome) {
        const refreshedAt = Date.now();
        lastSuccessfulContractorFetchAtRef.current = refreshedAt;
        lastGlobalContractorHomeSuccessAt = refreshedAt;
        setLastSuccessfulContractorFetchAt(refreshedAt);
        setContractorNetworkStatus("online");
        return;
      }

      if (
        lastGlobalContractorHomeSuccessAt !== null &&
        Date.now() - lastGlobalContractorHomeSuccessAt < 135_000
      ) {
        lastSuccessfulContractorFetchAtRef.current =
          lastGlobalContractorHomeSuccessAt;
        setLastSuccessfulContractorFetchAt(lastGlobalContractorHomeSuccessAt);
        setContractorNetworkStatus("online");
      }
    }

    window.addEventListener("pageshow", markCachedWorkspaceFresh);
    document.addEventListener("visibilitychange", markCachedWorkspaceFresh);
    markCachedWorkspaceFresh();

    return () => {
      window.removeEventListener("pageshow", markCachedWorkspaceFresh);
      document.removeEventListener("visibilitychange", markCachedWorkspaceFresh);
    };
  }, [contractorHome, currentUser, role]);

  async function handleApplyContractorFilters(
    nextFilters: ContractorJobFilterPreferences,
  ) {
    setContractorFilters(nextFilters);
    setIsFilterSheetOpen(false);

    if (currentUser) {
      await loadContractorWorkspace(currentUser, nextFilters, {}, "apply-filters");
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
      await loadContractorWorkspace(currentUser, savedFilters, {}, "save-filters");
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
      await loadContractorWorkspace(
        currentUser,
        emptyContractorFilters,
        {},
        "clear-filters",
      );
    }
  }

  if (isRoleLoading) {
    return (
      <main className="az-contractor-shell min-h-screen md:px-6 md:py-8">
        <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-white px-5 pt-5 shadow-none md:min-h-[780px] md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-[var(--azisto-contractor-border)]">
          <div className="mb-5 flex items-center justify-between text-xs font-bold">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-3 rounded-sm bg-black" />
              <span className="h-2.5 w-3 rounded-sm border border-black" />
              <span className="h-2.5 w-5 rounded-sm bg-black" />
            </div>
          </div>
          <img
            src="/azisto-logo-cropped.png"
            alt="AZISTO - Your on-demand assistant"
            className="mx-auto mt-3 w-full max-w-[165px] object-contain"
          />
          <p className="mt-10 text-center text-sm font-semibold text-[var(--azisto-contractor-muted)]">
            Loading your AZISTO home...
          </p>
        </div>
      </main>
    );
  }

  if (role === "contractor") {
    const contractorGreetingName =
      contractorHome?.contractorName.trim() || greetingName || "Contractor";
    const contractorAvailableJobCards = groupContractorHomeJobs(
      contractorHome?.availableJobs ?? [],
    );
    const hasRecentSuccessfulContractorFetch =
      lastSuccessfulContractorFetchAt !== null &&
      networkStatusClock - lastSuccessfulContractorFetchAt < 135_000;
    const workspaceNetworkStatus: ContractorNetworkStatus =
      contractorNetworkStatus === "offline"
        ? "offline"
        : contractorNetworkStatus === "limited" ||
            !hasRecentSuccessfulContractorFetch
          ? "limited"
          : "online";
    const workspaceUpdateText =
      workspaceNetworkStatus === "offline"
        ? "Connection paused"
        : workspaceNetworkStatus === "limited"
          ? "Retrying soon"
          : formatWorkspaceUpdateTime(lastSuccessfulContractorFetchAt);
    const workspaceNetworkPillClassName =
      workspaceNetworkStatus === "online"
        ? "live-pill-online"
        : workspaceNetworkStatus === "offline"
          ? "live-pill-offline"
          : "live-pill-limited";
    const hasActiveFilters =
      contractorFilters.categories.length > 0 ||
      contractorFilters.subcategories.length > 0 ||
      contractorFilters.serviceCities.length > 0 ||
      contractorFilters.urgency !== "any" ||
      contractorFilters.sort !== "newest";

    return (
      <main className="az-contractor-shell min-h-screen md:px-6 md:py-8">
        <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-[var(--azisto-contractor-bg)] shadow-none md:min-h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-[var(--azisto-contractor-border)]">
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
              <div className="translate-y-3">
                <AppMenu role={role} />
              </div>

              <Link href="/home" className="flex justify-center">
                <img
                  src="/azisto-logo-cropped.png"
                  alt="AZISTO - Your on-demand assistant"
                  className="w-full max-w-[165px] object-contain"
                />
              </Link>

              <Link
                href={notificationsHref}
                className="relative flex h-10 w-10 translate-y-3 items-center justify-center justify-self-end rounded-full text-black"
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
              <h1 className="mt-4 text-3xl font-normal leading-tight text-[var(--azisto-contractor-text)]">
                <span className="block text-lg text-[var(--azisto-contractor-muted)]">
                  {getTimeOfDayGreeting()},
                </span>
                <span className="mt-1 block text-[var(--azisto-contractor-burgundy)]">
                  {contractorGreetingName}
                </span>
              </h1>
              <p className="mt-3 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
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
                  label: "New Jobs",
                  value: contractorHome?.availableJobsCount ?? 0,
                  href: "#available-jobs",
                  className: "border-[var(--azisto-contractor-border)] bg-white/75",
                  labelClassName: "text-emerald-700",
                  valueClassName: "text-emerald-700",
                  supportingText:
                    contractorHome && contractorHome.newTodayCount > 0
                      ? `+${contractorHome.newTodayCount} recently`
                      : "Marketplace live",
                },
                {
                  label: "Interested",
                  value: contractorHome?.interestedJobsCount ?? 0,
                  href: "/contractor/my-jobs#interested",
                  className: "border-[var(--azisto-contractor-border)] bg-white/75",
                  labelClassName: "text-[#4169E1]",
                  valueClassName: "text-[#4169E1]",
                  supportingText: "Waiting for customer",
                },
                {
                  label: "Active Jobs",
                  value: contractorHome?.activeJob ? 1 : 0,
                  href: "/contractor/dashboard",
                  className: "border-[var(--azisto-contractor-border)] bg-white/75",
                  labelClassName: "text-black",
                  valueClassName: "text-black",
                  supportingText: contractorHome?.activeJob
                    ? "In progress"
                    : "Ready for work",
                },
                {
                  label: "Rating",
                  value: contractorHome?.averageRating ?? 0,
                  href: "/contractor/reviews",
                  className: "border-[var(--azisto-contractor-border)] bg-white/75",
                  labelClassName: "text-black",
                  valueClassName: "text-black",
                  isRating: true,
                  supportingText: "Premium score",
                },
              ].map((stat) => (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className={`az-contractor-stat-card rounded-[22px] border px-3 py-3 ${stat.className}`}
                >
                  <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${stat.labelClassName}`}>
                    {stat.label}
                  </p>
                  {stat.isRating ? (
                    <div className="mt-1 flex items-center gap-1">
                      <span className={`text-lg font-bold leading-none ${stat.valueClassName}`}>
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
                    <p className={`mt-1 truncate text-lg font-bold capitalize ${stat.valueClassName}`}>
                      {stat.value}
                    </p>
                  )}
                  <p className="mt-1 truncate text-[10px] font-semibold text-[var(--azisto-contractor-muted)]">
                    {stat.supportingText}
                  </p>
                </Link>
              ))}
            </section>

            <div className="mt-5">
              <button
                type="button"
                onClick={() =>
                  currentUser &&
                  void loadContractorWorkspace(
                    currentUser,
                    contractorFilters,
                    { forceRefresh: true },
                    "manual",
                  )
                }
                disabled={
                  workspaceNetworkStatus === "offline" ||
                  isRefreshingContractorHome
                }
                className="az-btn-contractor flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold"
              >
                <RotateCw
                  aria-hidden="true"
                  className={`h-4 w-4 ${isRefreshingContractorHome ? "animate-spin" : ""}`}
                />
                {workspaceNetworkStatus === "limited" ? "Retry" : "Refresh"}
              </button>
              <div className="mt-3 flex items-center justify-center">
                <span className={workspaceNetworkPillClassName}>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      workspaceNetworkStatus === "online"
                        ? "live-dot-pulse bg-emerald-500"
                        : workspaceNetworkStatus === "limited"
                          ? "bg-amber-500"
                          : "bg-slate-400"
                    }`}
                  />
                  {workspaceNetworkStatus === "online"
                    ? "Live"
                    : workspaceNetworkStatus === "limited"
                      ? "Connection limited"
                      : "Offline"}
                </span>
              </div>
            </div>

            <section id="available-jobs" className="mt-6 scroll-mt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-normal text-[var(--azisto-contractor-text)]">
                    Available jobs
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterSheetOpen(true)}
                  className="az-btn-contractor-outline flex h-10 items-center justify-center gap-2 rounded-full px-4 text-xs font-bold"
                >
                  <Filter aria-hidden="true" className="h-4 w-4" />
                  Filter
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-azisto-muted">
                  {workspaceUpdateText}
                </span>
                {contractorHome && contractorHome.newTodayCount > 0 ? (
                  <span className="az-contractor-chip rounded-full px-3 py-1 text-xs font-bold">
                    New jobs added recently
                  </span>
                ) : null}
                {hasActiveFilters ? (
                  <span className="rounded-full border border-[var(--azisto-contractor-border)] bg-white px-3 py-1 text-xs font-bold text-[var(--azisto-contractor-muted)]">
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
                <p className="az-contractor-card-compact mt-4 px-4 py-3 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
                  Loading live contractor workspace...
                </p>
              ) : null}

              {!isContractorHomeLoading &&
              contractorHome &&
              contractorAvailableJobCards.length === 0 ? (
                <div className="az-contractor-card mt-4 p-5 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--azisto-contractor-burgundy)]">
                    <Briefcase aria-hidden="true" className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-[var(--azisto-contractor-text)]">
                    No matching open jobs yet
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
                    Adjust your filters or check back soon. This feed refreshes
                    every 60 seconds.
                  </p>
                </div>
              ) : null}

              <div className="az-contractor-panel mt-4 max-h-[360px] space-y-2 overflow-y-auto p-2 pr-1">
                {contractorAvailableJobCards.map((job) => (
                  <article
                    key={job.jobId}
                    className="az-contractor-card-compact az-contractor-job-card px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold leading-5 text-[var(--azisto-contractor-text)]">
                          {job.selectedServiceCategory || "Service request"}
                        </h3>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--azisto-contractor-burgundy)]">
                            {job.jobId}
                          </p>
                          {isRecentlyPosted(job.createdAt) ? (
                            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                              Recently posted
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-right text-[13px] font-semibold capitalize leading-5 text-[var(--azisto-contractor-text)] shadow-sm">
                        {[job.city, job.province].filter(Boolean).join(", ") ||
                          "Location pending"}
                      </span>
                    </div>

                    {job.tasks.length > 0 ? (
                      <div className="az-contractor-task-panel mt-2 space-y-1 rounded-2xl bg-[rgb(248_247_252_/_0.9)] p-1.5">
                        {job.tasks.map((task, index) => (
                          <div
                            key={task.taskId || `${job.jobId}-${task.label}`}
                            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--azisto-contractor-border)] bg-white px-2 py-1"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--azisto-contractor-burgundy)]">
                              {task.taskId || `Task ${index + 1}`}
                            </span>
                            <span className="text-[11px] font-bold text-[var(--azisto-contractor-text)]">
                              {task.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-2 space-y-1 text-[11px] font-semibold text-[var(--azisto-contractor-muted)]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate">
                          Customer: {job.customerFirstName || "Customer"}
                        </p>
                        <p className="shrink-0 text-right">
                          {formatScheduleLabel(job)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate">
                          {formatRelativeTime(job.createdAt)}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/contractor/jobs/${encodeURIComponent(job.jobId)}`}
                      className="az-btn-contractor-outline mt-3 flex h-10 items-center justify-center rounded-full border-[#5C0032] bg-white text-xs font-bold text-[#5C0032]"
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
