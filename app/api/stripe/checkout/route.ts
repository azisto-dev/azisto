import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  findContractorProfileByAuthUid,
  readBillingText,
} from "@/lib/contractorBilling";
import {
  adminAuth,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import {
  getStripe,
  getStripeAppUrl,
  getStripePriceId,
} from "@/lib/stripe";
import {
  getSubscriptionSummary,
  subscriptionPlans,
  type SubscriptionPlanId,
} from "@/lib/subscriptions";

export const runtime = "nodejs";

type CheckoutBody = {
  plan?: unknown;
};

function getBearerToken(authorizationHeader: string | null) {
  return authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : "";
}

function isSubscriptionPlanId(value: unknown): value is SubscriptionPlanId {
  return subscriptionPlans.some((plan) => plan.id === value);
}

function getErrorDetails(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";

  return {
    code,
    message: error instanceof Error ? error.message : "Unknown error",
  };
}

export async function POST(request: NextRequest) {
  try {
    assertFirebaseAdminConfig();
    const token = getBearerToken(request.headers.get("authorization"));

    if (!token) {
      return NextResponse.json(
        { code: "missing-token", message: "Please sign in again." },
        { status: 401 },
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const contractorProfile = await findContractorProfileByAuthUid(
      decodedToken.uid,
    );

    if (!contractorProfile) {
      return NextResponse.json(
        {
          code: "contractor-profile-required",
          message: "Please complete your contractor profile first.",
        },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as CheckoutBody | null;

    if (!isSubscriptionPlanId(body?.plan)) {
      return NextResponse.json(
        {
          code: "invalid-subscription-plan",
          message: "Please select a valid subscription plan.",
        },
        { status: 400 },
      );
    }

    const planId = body.plan;
    const profileData = contractorProfile.data() ?? {};
    const contractorId =
      readBillingText(profileData.contractorId) || contractorProfile.id;
    const contractorAuthUid =
      readBillingText(profileData.authUid) || decodedToken.uid;
    const stripe = getStripe();
    let stripeCustomerId = readBillingText(profileData.stripeCustomerId);

    if (stripeCustomerId) {
      let existingCustomer;

      try {
        existingCustomer = await stripe.customers.retrieve(stripeCustomerId);
      } catch (error) {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String((error as { code?: unknown }).code)
            : "";

        if (code !== "resource_missing") {
          throw error;
        }
      }

      if (!existingCustomer || existingCustomer.deleted) {
        stripeCustomerId = "";
      }
    }

    if (!stripeCustomerId) {
      const customerEmail =
        decodedToken.email || readBillingText(profileData.email);
      const customer = await stripe.customers.create({
        email: customerEmail || undefined,
        name:
          readBillingText(profileData.businessName) ||
          readBillingText(profileData.contactName) ||
          undefined,
        metadata: {
          contractorId,
          contractorAuthUid,
        },
      });
      stripeCustomerId = customer.id;

      await contractorProfile.ref.set(
        {
          stripeCustomerId,
          subscriptionUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } else {
      await stripe.customers.update(stripeCustomerId, {
        metadata: {
          contractorId,
          contractorAuthUid,
        },
      });
    }

    const previousStripeSubscriptionId = readBillingText(
      profileData.stripeSubscriptionId,
    );
    const metadata = {
      contractorId,
      contractorAuthUid,
      selectedPlan: planId,
      ...(previousStripeSubscriptionId
        ? { previousStripeSubscriptionId }
        : {}),
    };
    const summary = getSubscriptionSummary(profileData);
    const trialEndSeconds = Math.floor(summary.trialEndsAt.getTime() / 1000);
    const minimumTrialEnd = Math.floor(Date.now() / 1000) + 48 * 60 * 60;
    const shouldCarryStarterTrial =
      planId === "starter" &&
      summary.trialDaysRemaining > 0 &&
      trialEndSeconds >= minimumTrialEnd;
    const appUrl = getStripeAppUrl();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: contractorId,
      line_items: [{ price: getStripePriceId(planId), quantity: 1 }],
      metadata,
      subscription_data: {
        metadata,
        ...(shouldCarryStarterTrial ? { trial_end: trialEndSeconds } : {}),
      },
      success_url: `${appUrl}/contractor/subscription?stripe=success`,
      cancel_url: `${appUrl}/contractor/subscription?stripe=cancelled`,
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return NextResponse.json({ ok: true, url: checkoutSession.url });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Stripe checkout API failed:", { code, message, error });

    return NextResponse.json(
      { code, message },
      {
        status:
          code === "missing-token"
            ? 401
            : code === "stripe-not-configured"
              ? 503
              : 500,
      },
    );
  }
}
