import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type PasswordResetRequestBody = {
  email?: unknown;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getErrorDetails(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";
  const message = error instanceof Error ? error.message : "Unknown error";

  return { code, message };
}

export async function POST(request: NextRequest) {
  try {
    assertFirebaseAdminConfig();

    const body = (await request.json()) as PasswordResetRequestBody;
    const email = readEmail(body.email);

    if (!email) {
      return NextResponse.json(
        {
          code: "missing-email",
          message: "Please enter your registered email address.",
        },
        { status: 400 },
      );
    }

    if (!emailPattern.test(email)) {
      return NextResponse.json(
        {
          code: "invalid-email",
          message: "Please enter a valid email address.",
        },
        { status: 400 },
      );
    }

    try {
      await adminAuth.getUserByEmail(email);

      return NextResponse.json({ ok: true, registered: true });
    } catch (error) {
      const { code } = getErrorDetails(error);

      if (code === "auth/user-not-found") {
        return NextResponse.json(
          {
            code: "email-not-registered",
            message: "No AZISTO account was found with that email address.",
            registered: false,
          },
          { status: 404 },
        );
      }

      throw error;
    }
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Password reset registration check failed:", {
      code,
      message,
      error,
    });

    return NextResponse.json(
      {
        code,
        message:
          code === "unknown"
            ? "Password reset could not be checked. Please try again."
            : message,
      },
      { status: 500 },
    );
  }
}
