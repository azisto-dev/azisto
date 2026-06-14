"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import {
  authenticatedFetch,
  throwApiResponseError,
} from "@/lib/authenticatedFetch";

type AdminTab =
  | "overview"
  | "users"
  | "contractors"
  | "jobs"
  | "messages"
  | "reviews"
  | "notifications";

type AdminRecord = Record<string, unknown>;
type AdminResponse = Record<string, unknown>;

const tabs: Array<{
  id: AdminTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "contractors", label: "Contractors", icon: BriefcaseBusiness },
  { id: "jobs", label: "Jobs", icon: ClipboardList },
  { id: "messages", label: "Messages", icon: MessageSquareText },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "notifications", label: "Notifications", icon: Bell },
];

const endpointByTab: Record<AdminTab, string> = {
  overview: "/api/admin/overview",
  users: "/api/admin/users?limit=50",
  contractors: "/api/admin/contractors?limit=50",
  jobs: "/api/admin/jobs?limit=50",
  messages: "/api/admin/messages?limit=50",
  reviews: "/api/admin/reviews?limit=50",
  notifications: "/api/admin/notifications?limit=50",
};

const collectionKeyByTab: Partial<Record<AdminTab, string>> = {
  users: "users",
  contractors: "contractors",
  jobs: "jobs",
  messages: "threads",
  reviews: "reviews",
  notifications: "notifications",
};

function text(value: unknown, fallback = "Not provided") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function list(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function record(value: unknown): AdminRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : {};
}

function records(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is AdminRecord =>
          typeof item === "object" && item !== null && !Array.isArray(item),
      )
    : [];
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return "Not recorded";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("en-CA", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function statusClass(status: unknown) {
  const normalized = text(status, "").toLowerCase();

  if (
    normalized.includes("approved") ||
    normalized.includes("active") ||
    normalized.includes("completed") ||
    normalized.includes("read")
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    normalized.includes("reject") ||
    normalized.includes("suspend") ||
    normalized.includes("report")
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (
    normalized.includes("pending") ||
    normalized.includes("request") ||
    normalized.includes("open")
  ) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function StatusPill({ value }: { value: unknown }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(value)}`}
    >
      {text(value, "Unknown")}
    </span>
  );
}

async function fetchAdmin(
  user: User,
  endpoint: string,
  init?: RequestInit,
) {
  const response = await authenticatedFetch(user, endpoint, init);
  const body = (await response.json().catch(() => null)) as AdminResponse | null;

  if (!response.ok) {
    await throwApiResponseError(
      response,
      typeof body?.message === "string"
        ? body.message
        : response.statusText,
    );
  }

  return body ?? {};
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
      No {label.toLowerCase()} found.
    </div>
  );
}

function Meta({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-800">
        {text(value)}
      </dd>
    </div>
  );
}

export default function AdminConsolePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [dataByTab, setDataByTab] = useState<
    Partial<Record<AdminTab, AdminResponse>>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState<AdminResponse | null>(null);
  const [detailType, setDetailType] = useState<
    "contractor" | "job" | "message" | "user" | null
  >(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  async function loadTab(
    user: User,
    tab: AdminTab,
    force = false,
  ) {
    if (!force && dataByTab[tab]) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const responseBody = await fetchAdmin(user, endpointByTab[tab]);
      setDataByTab((current) => ({ ...current, [tab]: responseBody }));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The admin console could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      if (!user) {
        setIsLoading(false);
        setError("Please sign in with an administrator account.");
        return;
      }

      void loadTab(user, "overview", true);
    });
    // The listener should be registered once for this console session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeData = dataByTab[activeTab] ?? {};
  const isAccessDenied =
    Boolean(error) &&
    !dataByTab[activeTab] &&
    (error.toLowerCase().includes("access") ||
      error.toLowerCase().includes("administrator"));
  const collectionKey = collectionKeyByTab[activeTab];
  const activeRecords = collectionKey
    ? records(activeData[collectionKey])
    : [];
  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return activeRecords.filter((item) => {
      const searchableValue = Object.values(item)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter(
          (value): value is string | number =>
            typeof value === "string" || typeof value === "number",
        )
        .join(" ")
        .toLowerCase();
      const statusValue = `${text(item.status, "")} ${text(
        item.verificationStatus,
        "",
      )} ${text(item.accountStatus, "")}`.toLowerCase();

      return (
        (!query || searchableValue.includes(query)) &&
        (statusFilter === "all" || statusValue.includes(statusFilter))
      );
    });
  }, [activeRecords, searchQuery, statusFilter]);

  async function selectTab(tab: AdminTab) {
    setActiveTab(tab);
    setSearchQuery("");
    setStatusFilter("all");
    setDetail(null);
    setDetailType(null);

    if (currentUser) {
      await loadTab(currentUser, tab);
    }
  }

  async function openDetail(
    type: "contractor" | "job" | "message",
    id: string,
  ) {
    if (!currentUser) {
      return;
    }

    setIsDetailLoading(true);
    setDetailType(type);
    setDetail(null);

    try {
      const responseBody = await fetchAdmin(
        currentUser,
        `/api/admin/${type === "contractor" ? "contractors" : type === "job" ? "jobs" : "messages"}/${encodeURIComponent(id)}`,
      );
      setDetail(responseBody);
    } catch (detailError) {
      setError(
        detailError instanceof Error
          ? detailError.message
          : "The selected record could not be loaded.",
      );
      setDetailType(null);
    } finally {
      setIsDetailLoading(false);
    }
  }

  function openUserDetail(user: AdminRecord) {
    setDetailType("user");
    setDetail({ user });
  }

  async function updateContractor(
    contractorId: string,
    action: string,
    documentKey = "",
  ) {
    if (!currentUser) {
      return;
    }

    setIsDetailLoading(true);
    try {
      await fetchAdmin(
        currentUser,
        `/api/admin/contractors/${encodeURIComponent(contractorId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, documentKey }),
        },
      );
      await Promise.all([
        loadTab(currentUser, "contractors", true),
        openDetail("contractor", contractorId),
        loadTab(currentUser, "overview", true),
      ]);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "The contractor could not be updated.",
      );
    } finally {
      setIsDetailLoading(false);
    }
  }

  function renderOverview() {
    const stats = record(activeData.stats);
    const statItems = [
      ["Total users", stats.totalUsers, Users],
      ["Total contractors", stats.totalContractors, BriefcaseBusiness],
      ["Pending contractors", stats.pendingContractors, ShieldCheck],
      ["Active jobs", stats.activeJobs, ClipboardList],
      ["Completed jobs", stats.completedJobs, CheckCircle2],
      ["Open reports", stats.openReports, XCircle],
      ["Reviews", stats.reviews, Star],
    ] as const;
    const activity = records(activeData.recentActivity);

    return (
      <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statItems.map(([label, value, Icon]) => (
            <article
              key={label}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <Icon className="h-5 w-5 text-slate-400" aria-hidden="true" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-slate-950">
                {number(value)}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-7 rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-950">Recent activity</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {activity.length ? (
              activity.map((item, index) => (
                <div
                  key={`${text(item.type)}-${text(item.createdAt)}-${index}`}
                  className="flex items-start justify-between gap-4 px-5 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {text(item.title)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {text(item.detail, "")}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-slate-400">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-6 text-sm text-slate-500">
                No recent activity.
              </div>
            )}
          </div>
        </section>
      </>
    );
  }

  function renderList() {
    if (!filteredRecords.length) {
      return <EmptyState label={tabs.find((tab) => tab.id === activeTab)?.label ?? "records"} />;
    }

    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {filteredRecords.map((item, index) => {
            const id =
              text(item.customerId, "") ||
              text(item.contractorId, "") ||
              text(item.jobId, "") ||
              text(item.threadId, "") ||
              text(item.reviewId, "") ||
              text(item.notificationId, "") ||
              String(index);

            if (activeTab === "users") {
              return (
                <article
                  key={id}
                  className="grid gap-4 px-5 py-4 lg:grid-cols-[1.5fr_1fr_1fr_auto]"
                >
                  <div>
                    <p className="font-semibold text-slate-950">{text(item.name)}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {text(item.email)} · {text(item.phone)}
                    </p>
                  </div>
                  <Meta label="Location" value={`${text(item.city, "")} ${text(item.province, "")}`.trim()} />
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Activity
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {number(item.jobsPosted)} posted · {number(item.completedJobs)} completed
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill value={item.accountStatus} />
                    <button
                      type="button"
                      onClick={() => openUserDetail(item)}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View
                    </button>
                  </div>
                </article>
              );
            }

            if (activeTab === "contractors") {
              return (
                <article
                  key={id}
                  className="grid gap-4 px-5 py-4 lg:grid-cols-[1.5fr_1fr_1fr_auto]"
                >
                  <div>
                    <p className="font-semibold text-slate-950">{text(item.name)}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {text(item.contactName)} · {text(item.city)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Services
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-700">
                      {list(item.services).join(", ") || "Not selected"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      Performance
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {number(item.rating).toFixed(1)} rating · {number(item.completedJobs)} jobs
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill value={item.verificationStatus} />
                    <button
                      type="button"
                      onClick={() => void openDetail("contractor", id)}
                      className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Review
                    </button>
                  </div>
                </article>
              );
            }

            if (activeTab === "jobs") {
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => void openDetail("job", id)}
                  className="grid w-full gap-4 px-5 py-4 text-left hover:bg-slate-50 lg:grid-cols-[1.1fr_1.4fr_1fr_auto]"
                >
                  <div>
                    <p className="font-semibold text-slate-950">{id}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {text(item.category)}
                    </p>
                  </div>
                  <Meta label="Customer / contractor" value={`${text(item.customerName)} / ${text(item.contractorName)}`} />
                  <Meta label="Location / created" value={`${text(item.city)} · ${formatDate(item.createdAt)}`} />
                  <div className="flex items-center gap-3">
                    <StatusPill value={item.status} />
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </button>
              );
            }

            if (activeTab === "messages") {
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => void openDetail("message", id)}
                  className="grid w-full gap-4 px-5 py-4 text-left hover:bg-slate-50 lg:grid-cols-[1.2fr_1fr_2fr_auto]"
                >
                  <Meta label="Thread" value={id} />
                  <Meta label="Participants" value={`${text(item.userName)} / ${text(item.contractorName)}`} />
                  <Meta label="Last message" value={item.lastMessage} />
                  <div className="flex items-center gap-3">
                    {number(item.unreadCount) > 0 && (
                      <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                        {number(item.unreadCount)} unread
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </button>
              );
            }

            if (activeTab === "reviews") {
              return (
                <article key={id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-amber-500">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="font-semibold text-slate-900">
                          {number(item.rating).toFixed(1)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">
                        {text(item.reviewText, "No written review.")}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {text(item.customerName)} · {text(item.jobId)} · {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button disabled className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400">
                        Hide (soon)
                      </button>
                      <button disabled className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400">
                        Flag (soon)
                      </button>
                    </div>
                  </div>
                </article>
              );
            }

            return (
              <article
                key={id}
                className="grid gap-4 px-5 py-4 lg:grid-cols-[1.1fr_1fr_2fr_auto]"
              >
                <div>
                  <p className="font-semibold text-slate-950">{text(item.title)}</p>
                  <p className="mt-1 text-xs text-slate-500">{text(item.type)}</p>
                </div>
                <Meta label="Recipient" value={item.recipient} />
                <Meta label="Message" value={item.message} />
                <div className="flex items-center gap-3">
                  <StatusPill value={item.read === true ? "Read" : "Unread"} />
                  <span className="text-xs text-slate-400">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  function renderDetail() {
    if (!detailType) {
      return null;
    }

    const contractor = record(detail?.contractor);
    const job = record(detail?.job);
    const thread = record(detail?.thread);
    const user = record(detail?.user);
    const files = records(detail?.files);

    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35">
        <button
          type="button"
          aria-label="Close detail"
          className="absolute inset-0"
          onClick={() => {
            setDetail(null);
            setDetailType(null);
          }}
        />
        <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-slate-50 shadow-2xl">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Admin detail
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                {detailType === "contractor"
                  ? text(contractor.name)
                  : detailType === "job"
                    ? text(job.jobId)
                    : detailType === "message"
                      ? text(thread.threadId)
                      : text(user.name)}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setDetail(null);
                setDetailType(null);
              }}
              className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Close detail"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {isDetailLoading && !detail ? (
            <div className="flex h-64 items-center justify-center">
              <LoaderCircle className="h-7 w-7 animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="space-y-5 p-6">
              {detailType === "user" && (
                <>
                  <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-4">
                      {text(user.profilePhotoUrl, "") ? (
                        <img
                          src={text(user.profilePhotoUrl)}
                          alt=""
                          className="h-16 w-16 rounded-full object-cover"
                        />
                      ) : (
                        <CircleUserRound className="h-16 w-16 text-slate-300" />
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">
                          {text(user.name)}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {text(user.customerId)}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                      <Meta label="Email" value={user.email} />
                      <Meta label="Phone" value={user.phone} />
                      <Meta label="City" value={user.city} />
                      <Meta label="Created" value={formatDate(user.createdAt)} />
                    </dl>
                  </section>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => {
                        setDetail(null);
                        setDetailType(null);
                        setActiveTab("jobs");
                        setSearchQuery(text(user.customerId, ""));
                        if (currentUser) void loadTab(currentUser, "jobs");
                      }}
                      className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                      View bookings
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDetail(null);
                        setDetailType(null);
                        setActiveTab("reviews");
                        setSearchQuery(text(user.customerId, ""));
                        if (currentUser) void loadTab(currentUser, "reviews");
                      }}
                      className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                      View reviews
                    </button>
                    <button disabled className="rounded-md border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400">
                      Suspend (soon)
                    </button>
                  </div>
                </>
              )}

              {detailType === "contractor" && detail && (
                <>
                  <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {text(record(contractor.profilePhoto).url, "") ? (
                          <img
                            src={text(record(contractor.profilePhoto).url)}
                            alt=""
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                        ) : (
                          <CircleUserRound className="h-16 w-16 text-slate-300" />
                        )}
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">
                            {text(contractor.name)}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {text(contractor.contractorId)}
                          </p>
                        </div>
                      </div>
                      <StatusPill value={contractor.verificationStatus} />
                    </div>
                    <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                      <Meta label="Email" value={contractor.email} />
                      <Meta label="Phone" value={contractor.phone} />
                      <Meta label="Location" value={`${text(contractor.city, "")}, ${text(contractor.province, "")}`} />
                      <Meta label="Services" value={list(contractor.services).join(", ")} />
                      <Meta label="Service cities" value={list(contractor.serviceCities).join(", ")} />
                    </dl>
                    <div className="mt-5 grid gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => void updateContractor(text(contractor.contractorId), "approve-contractor")}
                        className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateContractor(text(contractor.contractorId), "request-documents")}
                        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"
                      >
                        Request documents
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateContractor(text(contractor.contractorId), "reject-contractor")}
                        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-400">
                          Subscription
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-950">
                          {text(contractor.subscriptionPlan, "Starter")}
                        </h3>
                      </div>
                      <StatusPill value={contractor.subscriptionStatus} />
                    </div>
                    <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                      <Meta
                        label="Trial days remaining"
                        value={number(contractor.subscriptionTrialDaysRemaining)}
                      />
                      <Meta
                        label="Accepted this month"
                        value={number(contractor.subscriptionAcceptedJobsThisMonth)}
                      />
                      <Meta
                        label="Jobs remaining"
                        value={
                          contractor.subscriptionJobsRemaining === null
                            ? "Unlimited"
                            : number(contractor.subscriptionJobsRemaining)
                        }
                      />
                      <Meta
                        label="Monthly limit"
                        value={
                          contractor.subscriptionAcceptedJobsLimit === null
                            ? "Unlimited"
                            : number(contractor.subscriptionAcceptedJobsLimit)
                        }
                      />
                      <Meta
                        label="Billing cycle starts"
                        value={formatDate(contractor.subscriptionBillingCycleStart)}
                      />
                      <Meta
                        label="Billing cycle ends"
                        value={formatDate(contractor.subscriptionBillingCycleEnd)}
                      />
                      <Meta
                        label="Next billing date"
                        value={formatDate(contractor.nextBillingDate)}
                      />
                      <Meta
                        label="Accepted this billing cycle"
                        value={number(contractor.acceptedJobsThisCycle)}
                      />
                      <Meta
                        label="Stripe customer ID"
                        value={contractor.stripeCustomerId}
                      />
                      <Meta
                        label="Stripe subscription ID"
                        value={contractor.stripeSubscriptionId}
                      />
                    </dl>
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <h3 className="font-semibold text-slate-950">
                      Contractor documents
                    </h3>
                    <div className="mt-4 space-y-3">
                      {files.length ? (
                        files.map((file, index) => {
                          const documentKey = text(file.documentKey, "");
                          const canReview =
                            documentKey.split(".").length === 2;
                          return (
                            <div
                              key={`${text(file.storagePath, "")}-${index}`}
                              className="rounded-md border border-slate-200 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-900">
                                    {text(file.label)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {text(file.fileName)} · {formatDate(file.uploadedAt)}
                                  </p>
                                  <p className="mt-1 break-all text-xs text-slate-400">
                                    {text(file.storagePath)}
                                  </p>
                                </div>
                                {text(file.url, "") && (
                                  <a
                                    href={text(file.url)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                                  >
                                    View file
                                  </a>
                                )}
                              </div>
                              {canReview && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void updateContractor(text(contractor.contractorId), "approve-document", documentKey)}
                                    className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void updateContractor(text(contractor.contractorId), "reject-document", documentKey)}
                                    className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void updateContractor(text(contractor.contractorId), "request-replacement", documentKey)}
                                    className="rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
                                  >
                                    Request replacement
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-slate-500">
                          No linked documents found.
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-5">
                      <h3 className="font-semibold text-slate-950">Recent jobs</h3>
                      <div className="mt-3 space-y-3">
                        {records(detail.recentJobs).map((item) => (
                          <button
                            type="button"
                            key={text(item.jobId)}
                            onClick={() => void openDetail("job", text(item.jobId))}
                            className="flex w-full items-center justify-between rounded-md bg-slate-50 p-3 text-left"
                          >
                            <span className="text-sm font-medium text-slate-800">
                              {text(item.jobId)} · {text(item.category)}
                            </span>
                            <StatusPill value={item.status} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-5">
                      <h3 className="font-semibold text-slate-950">Recent reviews</h3>
                      <div className="mt-3 space-y-3">
                        {records(detail.recentReviews).map((item) => (
                          <div key={text(item.reviewId)} className="rounded-md bg-slate-50 p-3">
                            <p className="text-sm font-semibold text-slate-900">
                              {number(item.rating).toFixed(1)} stars · {text(item.jobId)}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {text(item.reviewText, "No written review.")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                  <button disabled className="w-full rounded-md border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400">
                    Suspend / reactivate placeholder
                  </button>
                </>
              )}

              {detailType === "job" && detail && (
                <>
                  <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">
                          {text(job.category)}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {text(job.customerName)} · {text(job.city)}, {text(job.province)}
                        </p>
                      </div>
                      <StatusPill value={job.status} />
                    </div>
                    <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                      <Meta label="Assigned contractor" value={job.contractorName} />
                      <Meta label="Created" value={formatDate(job.createdAt)} />
                      <Meta label="Schedule" value={text(job.scheduleMode, "") === "specific" ? `${text(job.preferredDate)} · ${text(job.preferredTimeWindow)}` : text(job.urgency)} />
                      <Meta label="Reports" value={number(job.reportsCount)} />
                      <Meta label="Address" value={`${text(job.address, "")}, ${text(job.city, "")}, ${text(job.province, "")} ${text(job.postalCode, "")}`} />
                      <Meta label="Description" value={job.description} />
                    </dl>
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <h3 className="font-semibold text-slate-950">Task statuses</h3>
                    <div className="mt-4 space-y-3">
                      {records(detail.tasks).map((task) => (
                        <div key={text(task.taskId)} className="rounded-md border border-slate-200 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {text(task.taskId)} · {text(task.subcategory)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {list(task.interestedContractorIds).length} interested · {text(task.contractorName)}
                              </p>
                            </div>
                            <StatusPill value={task.status} />
                          </div>
                          <PhotoGrid
                            before={records(task.beforePhotos)}
                            after={records(task.afterPhotos)}
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <PhotoGrid
                    before={records(job.beforePhotos)}
                    after={records(job.afterPhotos)}
                  />

                  <section className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-5">
                      <h3 className="font-semibold text-slate-950">Reports</h3>
                      <div className="mt-3 space-y-3">
                        {records(detail.reports).map((item) => (
                          <div key={text(item.reportId)} className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                            <p className="font-semibold">{text(item.reason)}</p>
                            <p className="mt-1">{text(item.details, "No details.")}</p>
                          </div>
                        ))}
                        {!records(detail.reports).length && (
                          <p className="text-sm text-slate-500">No reports.</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-5">
                      <h3 className="font-semibold text-slate-950">Review</h3>
                      <div className="mt-3 space-y-3">
                        {records(detail.reviews).map((item) => (
                          <div key={text(item.reviewId)} className="rounded-md bg-slate-50 p-3">
                            <p className="font-semibold text-slate-900">
                              {number(item.rating)} stars
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {text(item.reviewText, "No written review.")}
                            </p>
                          </div>
                        ))}
                        {!records(detail.reviews).length && (
                          <p className="text-sm text-slate-500">No review.</p>
                        )}
                      </div>
                    </div>
                  </section>

                  <textarea
                    disabled
                    placeholder="Admin note field placeholder"
                    className="min-h-24 w-full rounded-lg border border-slate-200 bg-slate-100 p-4 text-sm text-slate-400"
                  />
                </>
              )}

              {detailType === "message" && detail && (
                <>
                  <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-950">
                          {text(thread.userName)} and {text(thread.contractorName)}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Job {text(thread.jobId)} · {list(thread.selectedTaskLabels).join(", ")}
                        </p>
                      </div>
                      <StatusPill value={thread.status} />
                    </div>
                    <p className="mt-4 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                      Trust and safety access is read-only. Admins cannot edit messages.
                    </p>
                  </section>
                  <section className="space-y-3">
                    {records(detail.messages).map((message) => (
                      <article
                        key={text(message.messageId)}
                        className="rounded-lg border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold uppercase text-slate-500">
                            {text(message.senderRole)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatDate(message.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                          {text(message.message, "Photo attachment")}
                        </p>
                        {records(message.attachments).map((attachment, index) => (
                          <a
                            key={`${text(attachment.storagePath, "")}-${index}`}
                            href={text(attachment.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 block break-all rounded-md bg-slate-50 p-3 text-xs font-medium text-slate-600"
                          >
                            Linked attachment · {text(attachment.storagePath)}
                          </a>
                        ))}
                      </article>
                    ))}
                  </section>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-slate-950 px-4 py-6 text-white lg:block">
          <div className="flex items-center gap-3 px-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-slate-950">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">AZISTO Admin</p>
              <p className="text-xs text-slate-400">Operations console</p>
            </div>
          </div>
          <nav className="mt-8 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => void selectTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                    activeTab === tab.id
                      ? "bg-white text-slate-950"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
          <p className="mt-8 px-3 text-xs leading-5 text-slate-500">
            Record-linked files only. No unrestricted Storage access.
          </p>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white px-5 py-5 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Administration
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-950">
                  {tabs.find((tab) => tab.id === activeTab)?.label}
                </h1>
              </div>
              <button
                type="button"
                onClick={() =>
                  currentUser && void loadTab(currentUser, activeTab, true)
                }
                disabled={!currentUser || isLoading}
                className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {tabs.map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => void selectTab(tab.id)}
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold ${
                    activeTab === tab.id
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </header>

          <div className="p-5 lg:p-8">
            {activeTab !== "overview" && (
              <div className="mb-5 flex flex-wrap gap-3">
                <label className="relative min-w-[240px] flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={`Search ${activeTab}`}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-500"
                  />
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="open">Open</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            )}

            {error && !isAccessDenied && (
              <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {isAccessDenied ? (
              <section className="mx-auto mt-16 max-w-lg rounded-lg border border-red-200 bg-white p-8 text-center shadow-sm">
                <ShieldCheck className="mx-auto h-10 w-10 text-red-500" />
                <h2 className="mt-4 text-xl font-semibold text-slate-950">
                  Access denied
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {error}
                </p>
              </section>
            ) : isLoading && !dataByTab[activeTab] ? (
              <div className="flex h-72 items-center justify-center">
                <LoaderCircle className="h-8 w-8 animate-spin text-slate-500" />
              </div>
            ) : activeTab === "overview" ? (
              renderOverview()
            ) : (
              renderList()
            )}
          </div>
        </div>
      </div>
      {renderDetail()}
    </main>
  );
}

function PhotoGrid({
  before,
  after,
}: {
  before: AdminRecord[];
  after: AdminRecord[];
}) {
  if (!before.length && !after.length) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {[
        ["Before photos", before],
        ["After photos", after],
      ].map(([label, photos]) => (
        <div key={label as string}>
          <p className="text-xs font-semibold uppercase text-slate-400">
            {label as string}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(photos as AdminRecord[]).map((photo, index) => (
              <a
                key={`${text(photo.storagePath, "")}-${index}`}
                href={text(photo.url)}
                target="_blank"
                rel="noreferrer"
                title={text(photo.storagePath)}
              >
                <img
                  src={text(photo.url)}
                  alt=""
                  className="aspect-square w-full rounded-md border border-slate-200 object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
