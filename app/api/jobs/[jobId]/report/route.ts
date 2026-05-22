import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

type ReportRequestBody = {
  reason?: unknown;
  details?: unknown;
};

const allowedReasons = new Set([
  "fake_job",
  "wrong_address",
  "spam",
  "unsafe_customer",
  "abusive_message",
  "no_response",
  "other",
]);

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return "";
  }

  return authorizationHeader.slice("Bearer ".length).trim();
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getErrorDetails(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";
  const message = error instanceof Error ? error.message : "Unknown error";

  return { code, message };
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertFirebaseAdminConfig();

    const token = getBearerToken(request.headers.get("authorization"));

    if (!token) {
      return NextResponse.json(
        {
          code: "missing-token",
          message: "Please sign in again.",
        },
        { status: 401 },
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const { jobId } = await context.params;
    const body = (await request.json()) as ReportRequestBody;
    const reason = readText(body.reason);
    const details = readText(body.details);

    if (!allowedReasons.has(reason)) {
      return NextResponse.json(
        {
          code: "invalid-report-reason",
          message: "Please choose a valid report reason.",
        },
        { status: 400 },
      );
    }

    const jobDocument = adminDb.collection("jobs").doc(jobId);
    const reportDocument = jobDocument.collection("reports").doc();
    const reportId = reportDocument.id;

    await adminDb.runTransaction(async (transaction) => {
      const jobSnapshot = await transaction.get(jobDocument);

      if (!jobSnapshot.exists) {
        throw Object.assign(new Error("This job could not be found."), {
          code: "job-not-found",
        });
      }

      const currentReportsCount =
        typeof jobSnapshot.get("reportsCount") === "number"
          ? jobSnapshot.get("reportsCount")
          : 0;
      const nextReportsCount = currentReportsCount + 1;
      const customerId = readText(jobSnapshot.get("customerId"));
      const jobUpdate: Record<string, unknown> = {
        reportsCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (nextReportsCount >= 2) {
        jobUpdate.status = "review_required";
        jobUpdate.matchingStatus = "paused";
      }

      transaction.set(reportDocument, {
        reportId,
        jobId,
        reporterAuthUid: decodedToken.uid,
        reason,
        details,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(jobDocument, jobUpdate, { merge: true });

      if (customerId) {
        transaction.set(
          adminDb.collection("customers").doc(customerId),
          {
            reportsCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    });

    return NextResponse.json({ ok: true, reportId });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Job report API failed:", {
      code,
      message,
      error,
    });

    return NextResponse.json(
      {
        code,
        message,
      },
      {
        status:
          code === "missing-token" ? 401 : code === "job-not-found" ? 404 : 500,
      },
    );
  }
}
