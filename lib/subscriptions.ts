export type SubscriptionPlanId = "starter" | "professional" | "premium";

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: string;
  priceBiweekly: number;
  acceptedJobsLimit: number | null;
  trialDays: number;
  description: string;
};

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: "starter",
    name: "Starter",
    priceBiweekly: 15,
    acceptedJobsLimit: 5,
    trialDays: 60,
    description: "A simple start for building your AZISTO business.",
  },
  {
    id: "professional",
    name: "Professional",
    priceBiweekly: 25,
    acceptedJobsLimit: 10,
    trialDays: 0,
    description: "More monthly capacity for growing contractors.",
  },
  {
    id: "premium",
    name: "Premium",
    priceBiweekly: 35,
    acceptedJobsLimit: null,
    trialDays: 0,
    description: "Unlimited accepted jobs for established businesses.",
  },
];

export type SubscriptionSummary = {
  plan: SubscriptionPlan;
  status: string;
  trialStartedAt: Date;
  trialEndsAt: Date;
  trialDaysRemaining: number;
  acceptedJobsThisMonth: number;
  jobsRemaining: number | null;
  usageMonth: string;
  billingCycleStart: Date;
  billingCycleEnd: Date;
  nextBillingDate: Date;
};

const dayMs = 24 * 60 * 60 * 1000;
const billingCycleDays = 14;

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function subscriptionDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const parsed = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

export function getSubscriptionMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getSubscriptionPlan(value: unknown) {
  const planId = readText(value).toLowerCase();

  return (
    subscriptionPlans.find((plan) => plan.id === planId) ??
    subscriptionPlans[0]
  );
}

export function getStarterTrialDates(startedAt = new Date()) {
  return {
    trialStartedAt: startedAt,
    trialEndsAt: new Date(startedAt.getTime() + 60 * dayMs),
  };
}

export function getSubscriptionSummary(
  data: Record<string, unknown>,
  now = new Date(),
): SubscriptionSummary {
  const plan = getSubscriptionPlan(data.subscriptionPlan);
  const fallbackStart =
    subscriptionDate(data.createdAt) ??
    subscriptionDate(data.subscriptionStartedAt) ??
    now;
  const trialStartedAt =
    subscriptionDate(data.subscriptionTrialStartedAt) ?? fallbackStart;
  const trialEndsAt =
    subscriptionDate(data.subscriptionTrialEndsAt) ??
    getStarterTrialDates(trialStartedAt).trialEndsAt;
  const storedStatus = readText(data.subscriptionStatus).toLowerCase();
  const hasStripeSubscription = Boolean(
    readText(data.stripeSubscriptionId),
  );
  const normalizedStripeStatus =
    storedStatus === "trialing"
      ? "trial"
      : storedStatus === "canceled"
        ? "cancelled"
        : storedStatus === "incomplete_expired"
          ? "expired"
          : storedStatus;
  const isLegacyTrial =
    !hasStripeSubscription && plan.id === "starter" && now < trialEndsAt;
  const status = hasStripeSubscription
    ? normalizedStripeStatus || "incomplete"
    : storedStatus === "cancelled" || storedStatus === "suspended"
      ? storedStatus
      : isLegacyTrial
        ? "trialing"
        : "active";
  const isTrialing =
    (status === "trial" || status === "trialing") && now < trialEndsAt;
  const trialDaysRemaining = isTrialing
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / dayMs))
    : 0;
  const usageMonth = getSubscriptionMonthKey(now);
  const acceptedJobsThisMonth =
    readText(data.subscriptionAcceptedJobsMonth) === usageMonth
      ? Math.max(0, Math.floor(readNumber(data.subscriptionAcceptedJobsCount)))
      : 0;
  const jobsRemaining =
    plan.acceptedJobsLimit === null
      ? null
      : Math.max(0, plan.acceptedJobsLimit - acceptedJobsThisMonth);
  const billingAnchor =
    plan.id === "starter"
      ? trialEndsAt
      : subscriptionDate(data.subscriptionStartedAt) ?? fallbackStart;
  const elapsedCycles = Math.max(
    0,
    Math.floor(
      (now.getTime() - billingAnchor.getTime()) /
        (billingCycleDays * dayMs),
    ),
  );
  const calculatedBillingCycleStart = isTrialing
    ? trialStartedAt
    : new Date(
        billingAnchor.getTime() + elapsedCycles * billingCycleDays * dayMs,
      );
  const calculatedBillingCycleEnd = isTrialing
    ? trialEndsAt
    : new Date(
        calculatedBillingCycleStart.getTime() + billingCycleDays * dayMs,
      );
  const billingCycleStart =
    subscriptionDate(data.billingCycleStart) ?? calculatedBillingCycleStart;
  const billingCycleEnd =
    subscriptionDate(data.billingCycleEnd) ?? calculatedBillingCycleEnd;
  const nextBillingDate =
    subscriptionDate(data.nextBillingDate) ?? billingCycleEnd;

  return {
    plan,
    status,
    trialStartedAt,
    trialEndsAt,
    trialDaysRemaining,
    acceptedJobsThisMonth,
    jobsRemaining,
    usageMonth,
    billingCycleStart,
    billingCycleEnd,
    nextBillingDate,
  };
}

export function canAcceptJobsForSubscription(
  data: Record<string, unknown>,
  summary = getSubscriptionSummary(data),
) {
  const hasStripeSubscription = Boolean(
    readText(data.stripeSubscriptionId),
  );

  if (!hasStripeSubscription) {
    return !["cancelled", "suspended"].includes(summary.status);
  }

  return ["active", "trial", "trialing"].includes(summary.status);
}
