import Stripe from "stripe";
import type { SubscriptionPlanId } from "@/lib/subscriptions";

let stripeClient: Stripe | null = null;

const priceEnvironmentVariables: Record<SubscriptionPlanId, string> = {
  starter: "STRIPE_STARTER_PRICE_ID",
  professional: "STRIPE_PROFESSIONAL_PRICE_ID",
  premium: "STRIPE_PREMIUM_PRICE_ID",
};

function requiredEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw Object.assign(new Error(`${name} is not configured.`), {
      code: "stripe-not-configured",
    });
  }

  return value;
}

export function getStripe() {
  const secretKey = requiredEnvironmentVariable("STRIPE_SECRET_KEY");

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

export function getStripeWebhookSecret() {
  return requiredEnvironmentVariable("STRIPE_WEBHOOK_SECRET");
}

export function getStripePriceId(planId: SubscriptionPlanId) {
  return requiredEnvironmentVariable(priceEnvironmentVariables[planId]);
}

export function getPlanIdForStripePrice(
  priceId: string,
): SubscriptionPlanId | null {
  const match = Object.entries(priceEnvironmentVariables).find(
    ([, environmentVariable]) =>
      process.env[environmentVariable]?.trim() === priceId,
  );

  return (match?.[0] as SubscriptionPlanId | undefined) ?? null;
}

export function getStripeAppUrl() {
  return requiredEnvironmentVariable("NEXT_PUBLIC_APP_URL").replace(/\/+$/, "");
}

export function getStripePortalReturnUrl() {
  return (
    process.env.STRIPE_BILLING_PORTAL_RETURN_URL?.trim() ||
    `${getStripeAppUrl()}/contractor/subscription`
  );
}

export function stripeObjectId(
  value: string | { id: string } | null | undefined,
) {
  return typeof value === "string" ? value : value?.id ?? "";
}

export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status) {
  switch (status) {
    case "trialing":
      return "trial";
    case "canceled":
      return "cancelled";
    case "incomplete_expired":
      return "expired";
    default:
      return status;
  }
}
