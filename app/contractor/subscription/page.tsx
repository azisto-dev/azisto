"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CreditCard,
  Gauge,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import BottomNav from "@/app/components/BottomNav";
import NotificationBell from "@/app/components/NotificationBell";
import { auth } from "@/lib/firebase";
import {
  authenticatedFetch,
  throwApiResponseError,
} from "@/lib/authenticatedFetch";
import {
  getSubscriptionPlan,
  subscriptionPlans,
  type SubscriptionPlanId,
} from "@/lib/subscriptions";

type SubscriptionData = {
  planId: SubscriptionPlanId;
  planName: string;
  status: string;
  trialDaysRemaining: number;
  trialStartedAt: string;
  trialEndsAt: string;
  acceptedJobsThisMonth: number;
  jobsRemaining: number | null;
  acceptedJobsLimit: number | null;
  usageMonth: string;
  billingCycleStart: string;
  billingCycleEnd: string;
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
function formatDate(value: string) {
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(parsed);
}

function formatStatus(value: string) {
  if (value === "trialing") {
    return "Free trial";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function fetchSubscription(user: User) {
  const response = await authenticatedFetch(
    user,
    "/api/contractors/subscription",
  );
  const body = (await response.json().catch(() => null)) as {
    subscription?: SubscriptionData;
    message?: unknown;
  } | null;
  const subscription = body?.subscription;

  if (!response.ok) {
    await throwApiResponseError(
      response,
      typeof body?.message === "string"
        ? body.message
        : "Unable to load subscription settings.",
    );
  }

  if (!subscription) {
    throw new Error("Unable to load subscription settings.");
  }

  return subscription;
}

export default function ContractorSubscriptionPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [billingNotice, setBillingNotice] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        setSubscription(await fetchSubscription(user));
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load subscription settings.",
        );
      } finally {
        setIsLoading(false);
      }
    });
  }, [router]);

  const currentPlan = getSubscriptionPlan(subscription?.planId);

  return (
    <main className="az-contractor-shell min-h-screen md:px-6 md:py-8">
      <div className="mx-auto flex h-screen min-h-0 w-full max-w-[390px] flex-col bg-[var(--azisto-contractor-bg)] shadow-none md:h-[780px] md:overflow-hidden md:rounded-[28px] md:shadow-2xl md:ring-1 md:ring-[var(--azisto-contractor-border)]">
        <div className="azisto-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-24 pt-5">
          <StatusBar />

          <header className="grid grid-cols-[40px_1fr_40px] items-center">
            <Link
              href="/home"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--azisto-contractor-border)] bg-white text-black"
              aria-label="Back to home"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </Link>
            <img
              src="/azisto-logo-cropped.png"
              alt="AZISTO - Your on-demand assistant"
              className="mx-auto w-full max-w-[155px] object-contain"
            />
            <NotificationBell />
          </header>

          <section className="mt-7">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--azisto-contractor-burgundy)]">
              Contractor billing
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-[var(--azisto-contractor-text)]">
              Subscription settings
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--azisto-contractor-muted)]">
              Track your plan, monthly accepted jobs, trial, and billing cycle.
            </p>
          </section>

          {isLoading ? (
            <div className="flex min-h-72 items-center justify-center">
              <LoaderCircle
                aria-label="Loading subscription"
                className="h-7 w-7 animate-spin text-[var(--azisto-contractor-burgundy)]"
              />
            </div>
          ) : errorMessage ? (
            <section className="az-contractor-card mt-6 p-5">
              <p className="text-sm font-semibold text-red-700">
                {errorMessage}
              </p>
              <Link
                href="/home"
                className="az-btn-contractor mt-4 flex h-11 items-center justify-center rounded-full text-sm font-bold"
              >
                Back to Home
              </Link>
            </section>
          ) : subscription ? (
            <>
              <section className="az-contractor-soft-hero mt-6 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--azisto-contractor-muted)]">
                      Current plan
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-[var(--azisto-contractor-text)]">
                      {subscription.planName}
                    </h2>
                  </div>
                  <span className="rounded-full border border-[var(--azisto-contractor-border)] bg-white/85 px-3 py-1 text-xs font-bold text-[var(--azisto-contractor-burgundy)]">
                    {formatStatus(subscription.status)}
                  </span>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/90 bg-white/75 p-3">
                    <p className="text-xs text-[var(--azisto-contractor-muted)]">
                      Bi-weekly price
                    </p>
                    <p className="mt-1 text-xl font-bold text-[var(--azisto-contractor-text)]">
                      ${currentPlan.priceBiweekly}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/90 bg-white/75 p-3">
                    <p className="text-xs text-[var(--azisto-contractor-muted)]">
                      Trial remaining
                    </p>
                    <p className="mt-1 text-xl font-bold text-[var(--azisto-contractor-text)]">
                      {subscription.trialDaysRemaining} days
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-4 grid grid-cols-2 gap-3">
                <article className="az-contractor-card p-4">
                  <BriefcaseBusiness
                    aria-hidden="true"
                    className="h-5 w-5 text-[var(--azisto-contractor-burgundy)]"
                  />
                  <p className="mt-3 text-2xl font-bold text-[var(--azisto-contractor-text)]">
                    {subscription.acceptedJobsThisMonth}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--azisto-contractor-muted)]">
                    Jobs accepted this month
                  </p>
                </article>
                <article className="az-contractor-card p-4">
                  <Gauge
                    aria-hidden="true"
                    className="h-5 w-5 text-[var(--azisto-contractor-burgundy)]"
                  />
                  <p className="mt-3 text-2xl font-bold text-[var(--azisto-contractor-text)]">
                    {subscription.jobsRemaining === null
                      ? "Unlimited"
                      : subscription.jobsRemaining}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--azisto-contractor-muted)]">
                    Jobs remaining
                  </p>
                </article>
              </section>

              <section className="az-contractor-card mt-4 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(122_0_60_/_0.08)] text-[var(--azisto-contractor-burgundy)]">
                    <CalendarDays aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-bold text-[var(--azisto-contractor-text)]">
                      Billing cycle
                    </h2>
                    <p className="text-xs text-[var(--azisto-contractor-muted)]">
                      {subscription.status === "trialing"
                        ? "Starter free-trial period"
                        : "Current 14-day billing period"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Starts</p>
                    <p className="mt-1 font-bold text-slate-900">
                      {formatDate(subscription.billingCycleStart)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Ends</p>
                    <p className="mt-1 font-bold text-slate-900">
                      {formatDate(subscription.billingCycleEnd)}
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--azisto-contractor-burgundy)]">
                      Plans
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-[var(--azisto-contractor-text)]">
                      Select your plan
                    </h2>
                  </div>
                  <CreditCard
                    aria-hidden="true"
                    className="h-6 w-6 text-[var(--azisto-contractor-burgundy)]"
                  />
                </div>

                <div className="mt-4 space-y-4">
                  {subscriptionPlans.map((plan) => {
                    const isCurrent = plan.id === subscription.planId;
                    const isUpgrade =
                      plan.priceBiweekly > currentPlan.priceBiweekly;

                    return (
                      <article
                        key={plan.id}
                        className={`az-contractor-card p-5 ${
                          isCurrent
                            ? "ring-2 ring-[var(--azisto-contractor-burgundy)]"
                            : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-bold text-[var(--azisto-contractor-text)]">
                                {plan.name}
                              </h3>
                              {isCurrent ? (
                                <span className="rounded-full bg-[rgb(122_0_60_/_0.09)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--azisto-contractor-burgundy)]">
                                  Current
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-[var(--azisto-contractor-muted)]">
                              {plan.description}
                            </p>
                          </div>
                          {plan.id === "premium" ? (
                            <Sparkles
                              aria-hidden="true"
                              className="h-5 w-5 shrink-0 text-[var(--azisto-contractor-burgundy)]"
                            />
                          ) : null}
                        </div>

                        <p className="mt-4 text-2xl font-bold text-[var(--azisto-contractor-text)]">
                          ${plan.priceBiweekly}
                          <span className="ml-1 text-xs font-medium text-[var(--azisto-contractor-muted)]">
                            / bi-weekly
                          </span>
                        </p>

                        <div className="mt-4 space-y-2 text-sm text-slate-700">
                          {plan.trialDays > 0 ? (
                            <p className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-emerald-600" />
                              2 months free trial
                            </p>
                          ) : null}
                          <p className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600" />
                            {plan.acceptedJobsLimit === null
                              ? "Unlimited accepted jobs"
                              : `${plan.acceptedJobsLimit} accepted jobs per month`}
                          </p>
                          <p className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600" />
                            Browsing and interest submissions do not count
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={isCurrent}
                          onClick={() =>
                            setBillingNotice(
                              `${isUpgrade ? "Upgrades" : "Downgrades"} will be available when Stripe billing launches.`,
                            )
                          }
                          className={`mt-5 flex h-11 w-full items-center justify-center rounded-full text-sm font-bold ${
                            isCurrent
                              ? "cursor-default border border-slate-200 bg-slate-100 text-slate-500"
                              : "az-btn-contractor"
                          }`}
                        >
                          {isCurrent
                            ? "Current plan"
                            : `${isUpgrade ? "Upgrade" : "Downgrade"} (coming soon)`}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="mt-5 rounded-2xl border border-dashed border-[var(--azisto-contractor-border)] bg-slate-50 p-4 text-center">
                <p className="text-sm font-bold text-[var(--azisto-contractor-text)]">
                  Stripe billing coming soon
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--azisto-contractor-muted)]">
                  Plan changes and payment management are placeholders in v1.
                </p>
                {billingNotice ? (
                  <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[var(--azisto-contractor-burgundy)]">
                    {billingNotice}
                  </p>
                ) : null}
              </section>
            </>
          ) : null}
        </div>
        <BottomNav role="contractor" />
      </div>
    </main>
  );
}
