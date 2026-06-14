import { NextRequest, NextResponse } from "next/server";
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
  getStripePortalReturnUrl,
} from "@/lib/stripe";

export const runtime = "nodejs";

function getBearerToken(authorizationHeader: string | null) {
  return authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : "";
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

    const stripeCustomerId = readBillingText(
      contractorProfile.get("stripeCustomerId"),
    );

    if (!stripeCustomerId) {
      return NextResponse.json(
        {
          code: "stripe-customer-required",
          message: "Complete subscription checkout before managing billing.",
        },
        { status: 409 },
      );
    }

    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: getStripePortalReturnUrl(),
    });

    return NextResponse.json({ ok: true, url: portalSession.url });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Stripe billing portal API failed:", {
      code,
      message,
      error,
    });

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
