import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import type Stripe from "stripe";
import {
  findContractorProfileForStripe,
  readBillingText,
} from "@/lib/contractorBilling";
import { assertFirebaseAdminConfig } from "@/lib/firebaseAdmin";
import {
  getPlanIdForStripePrice,
  getStripe,
  getStripeWebhookSecret,
  mapStripeSubscriptionStatus,
  stripeObjectId,
} from "@/lib/stripe";
import {
  getSubscriptionPlan,
  getSubscriptionSummary,
} from "@/lib/subscriptions";

export const runtime = "nodejs";

type SyncOptions = {
  replaceExisting?: boolean;
  statusOverride?: string;
  invoice?: Stripe.Invoice;
  invoicePaymentStatus?: "succeeded" | "failed";
};

function unixDate(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const subscription = invoice.parent?.subscription_details?.subscription;
  return stripeObjectId(subscription);
}

async function syncStripeSubscription(
  subscription: Stripe.Subscription,
  options: SyncOptions = {},
) {
  const stripeCustomerId = stripeObjectId(subscription.customer);
  const priceId = subscription.items.data[0]?.price.id ?? "";
  const selectedPlan = readBillingText(subscription.metadata.selectedPlan);
  const planId =
    getPlanIdForStripePrice(priceId) ||
    (["starter", "professional", "premium"].includes(selectedPlan)
      ? (selectedPlan as "starter" | "professional" | "premium")
      : null);

  if (!planId) {
    throw Object.assign(
      new Error(`No AZISTO plan is configured for Stripe price ${priceId}.`),
      { code: "stripe-price-not-mapped" },
    );
  }

  const contractorProfile = await findContractorProfileForStripe({
    contractorId: readBillingText(subscription.metadata.contractorId),
    contractorAuthUid: readBillingText(
      subscription.metadata.contractorAuthUid,
    ),
    stripeCustomerId,
  });

  if (!contractorProfile) {
    throw Object.assign(
      new Error(
        `No contractor profile matches Stripe subscription ${subscription.id}.`,
      ),
      { code: "stripe-contractor-not-found" },
    );
  }

  const existingSubscriptionId = readBillingText(
    contractorProfile.get("stripeSubscriptionId"),
  );

  if (
    !options.replaceExisting &&
    existingSubscriptionId &&
    existingSubscriptionId !== subscription.id
  ) {
    return contractorProfile;
  }

  const profileData = contractorProfile.data() ?? {};
  const summary = getSubscriptionSummary(profileData);
  const plan = getSubscriptionPlan(planId);
  const subscriptionItem = subscription.items.data[0];
  const billingCycleStart =
    unixDate(subscriptionItem?.current_period_start) ??
    unixDate(subscription.start_date) ??
    new Date();
  const billingCycleEnd =
    unixDate(subscriptionItem?.current_period_end) ?? billingCycleStart;
  const trialStartedAt = unixDate(subscription.trial_start);
  const trialEndsAt = unixDate(subscription.trial_end);
  const nextBillingDate =
    mapStripeSubscriptionStatus(subscription.status) === "trial" &&
    trialEndsAt
      ? trialEndsAt
      : billingCycleEnd;
  const subscriptionStatus =
    options.statusOverride ??
    mapStripeSubscriptionStatus(subscription.status);
  const update: Record<string, unknown> = {
    subscriptionPlan: planId,
    subscriptionStatus,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStartedAt:
      unixDate(subscription.start_date) ?? billingCycleStart,
    nextBillingDate,
    billingCycleStart,
    billingCycleEnd,
    acceptedJobsLimit: plan.acceptedJobsLimit,
    acceptedJobsThisCycle: summary.acceptedJobsThisMonth,
    subscriptionUpdatedAt: FieldValue.serverTimestamp(),
    lastStripeEventAt: FieldValue.serverTimestamp(),
    ...(trialStartedAt
      ? { subscriptionTrialStartedAt: trialStartedAt }
      : {}),
    ...(trialEndsAt ? { subscriptionTrialEndsAt: trialEndsAt } : {}),
  };

  if (options.invoice && options.invoicePaymentStatus) {
    update.lastStripeInvoiceId = options.invoice.id;
    update.lastStripePaymentStatus = options.invoicePaymentStatus;

    if (options.invoicePaymentStatus === "succeeded") {
      update.lastStripePaymentSucceededAt = FieldValue.serverTimestamp();
    } else {
      update.lastStripePaymentFailedAt = FieldValue.serverTimestamp();
    }
  }

  await contractorProfile.ref.set(update, { merge: true });
  return contractorProfile;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const stripe = getStripe();
  const subscriptionId = stripeObjectId(session.subscription);
  const stripeCustomerId = stripeObjectId(session.customer);

  if (!subscriptionId) {
    const contractorProfile = await findContractorProfileForStripe({
      contractorId: readBillingText(session.metadata?.contractorId),
      contractorAuthUid: readBillingText(
        session.metadata?.contractorAuthUid,
      ),
      stripeCustomerId,
    });

    if (contractorProfile && stripeCustomerId) {
      await contractorProfile.ref.set(
        {
          stripeCustomerId,
          subscriptionUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncStripeSubscription(subscription, { replaceExisting: true });

  const previousSubscriptionId = readBillingText(
    session.metadata?.previousStripeSubscriptionId,
  );

  if (
    previousSubscriptionId &&
    previousSubscriptionId !== subscription.id
  ) {
    const previousSubscription = await stripe.subscriptions
      .retrieve(previousSubscriptionId)
      .catch(() => null);

    if (
      previousSubscription &&
      !["canceled", "incomplete_expired"].includes(
        previousSubscription.status,
      )
    ) {
      await stripe.subscriptions.cancel(previousSubscriptionId);
    }
  }
}

async function handleInvoicePayment(
  invoice: Stripe.Invoice,
  paymentStatus: "succeeded" | "failed",
) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  if (!subscriptionId) {
    return;
  }

  const subscription = await getStripe().subscriptions.retrieve(
    subscriptionId,
  );
  await syncStripeSubscription(subscription, {
    invoice,
    invoicePaymentStatus: paymentStatus,
    ...(paymentStatus === "failed" ? { statusOverride: "past_due" } : {}),
  });
}

export async function POST(request: NextRequest) {
  try {
    assertFirebaseAdminConfig();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        {
          code: "stripe-signature-missing",
          message: "Stripe signature is required.",
        },
        { status: 400 },
      );
    }

    const rawBody = await request.text();
    const event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecret(),
    );

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncStripeSubscription(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePayment(
          event.data.object as Stripe.Invoice,
          "succeeded",
        );
        break;
      case "invoice.payment_failed":
        await handleInvoicePayment(
          event.data.object as Stripe.Invoice,
          "failed",
        );
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "stripe-webhook-error";
    const message =
      error instanceof Error ? error.message : "Stripe webhook failed.";

    console.error("Stripe webhook failed:", { code, message, error });

    return NextResponse.json({ code, message }, { status: 400 });
  }
}

// Local test mode:
// stripe listen --forward-to localhost:3000/api/stripe/webhook
