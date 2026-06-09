import type { DecodedIdToken } from "firebase-admin/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";

class AdminAccessError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AdminAccessError";
    this.code = code;
    this.status = status;
  }
}

function getBearerToken(authorizationHeader: string | null) {
  return authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : "";
}

function readAdminList(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function requireAdmin(
  request: NextRequest,
): Promise<DecodedIdToken> {
  assertFirebaseAdminConfig();
  const token = getBearerToken(request.headers.get("authorization"));

  if (!token) {
    throw new AdminAccessError(
      "missing-token",
      "Please sign in with an administrator account.",
      401,
    );
  }

  const decodedToken = await adminAuth.verifyIdToken(token);
  const allowedEmails = readAdminList(process.env.ADMIN_EMAILS);
  const allowedUids = readAdminList(process.env.ADMIN_UIDS);
  // TODO: remove this development fallback once ADMIN_EMAILS is configured.
  allowedEmails.add("admin@azisto.ca");

  const isAdmin =
    decodedToken.admin === true ||
    allowedUids.has(decodedToken.uid.toLowerCase()) ||
    (typeof decodedToken.email === "string" &&
      allowedEmails.has(decodedToken.email.toLowerCase()));

  if (!isAdmin) {
    throw new AdminAccessError(
      "admin-access-denied",
      "This account does not have access to the AZISTO admin console.",
      403,
    );
  }

  return decodedToken;
}

export function adminErrorResponse(error: unknown, label: string) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "admin-request-failed";
  const message =
    error instanceof Error ? error.message : "The admin request failed.";
  const status =
    error instanceof AdminAccessError
      ? error.status
      : code.includes("token")
        ? 401
        : 500;

  console.error(`${label}:`, { code, message, error });
  return NextResponse.json({ code, message }, { status });
}
