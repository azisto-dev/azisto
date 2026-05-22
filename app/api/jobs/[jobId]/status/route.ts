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

type StatusRequestBody = {
  status?: unknown;
};

const lifecycleStatuses = new Set([
  "open",
  "hired",
  "in_progress",
  "completed",
  "cancelled",
  "review_required",
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

function isAllowedTransition(
  fromStatus: string,
  toStatus: string,
  changedByRole: "customer" | "contractor",
) {
  if (fromStatus === "hired" && toStatus === "in_progress") {
    return true;
  }

  if (fromStatus === "in_progress" && toStatus === "completed") {
    return true;
  }

  if (fromStatus === "hired" && toStatus === "cancelled") {
    return true;
  }

  if (
    fromStatus === "open" &&
    toStatus === "cancelled" &&
    changedByRole === "customer"
  ) {
    return true;
  }

  return false;
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
    const body = (await request.json()) as StatusRequestBody;
    const nextStatus = readText(body.status);

    if (!lifecycleStatuses.has(nextStatus)) {
      return NextResponse.json(
        {
          code: "invalid-status",
          message: "Please choose a valid job status.",
        },
        { status: 400 },
      );
    }

    const jobDocument = adminDb.collection("jobs").doc(jobId);
    let changedByRole: "customer" | "contractor" = "customer";

    await adminDb.runTransaction(async (transaction) => {
      const jobSnapshot = await transaction.get(jobDocument);

      if (!jobSnapshot.exists) {
        throw Object.assign(new Error("This job could not be found."), {
          code: "job-not-found",
        });
      }

      const currentStatus = readText(jobSnapshot.get("status"));
      const callerIsCustomer = jobSnapshot.get("customerAuthUid") === decodedToken.uid;
      const callerIsHiredContractor =
        jobSnapshot.get("hiredContractorAuthUid") === decodedToken.uid;

      if (!callerIsCustomer && !callerIsHiredContractor) {
        throw Object.assign(
          new Error("You can only update jobs assigned to you."),
          { code: "job-access-denied" },
        );
      }

      changedByRole = callerIsCustomer ? "customer" : "contractor";

      if (!isAllowedTransition(currentStatus, nextStatus, changedByRole)) {
        throw Object.assign(
          new Error("That job status change is not allowed."),
          { code: "invalid-status-transition" },
        );
      }

      const statusUpdate: Record<string, unknown> = {
        status: nextStatus,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (nextStatus === "in_progress") {
        statusUpdate.startedAt = FieldValue.serverTimestamp();
      }

      if (nextStatus === "completed") {
        statusUpdate.completedAt = FieldValue.serverTimestamp();
        statusUpdate.matchingStatus = "closed";
      }

      if (nextStatus === "cancelled") {
        statusUpdate.cancelledAt = FieldValue.serverTimestamp();
        statusUpdate.matchingStatus = "closed";
      }

      transaction.set(jobDocument, statusUpdate, { merge: true });
      transaction.set(jobDocument.collection("statusHistory").doc(), {
        fromStatus: currentStatus,
        toStatus: nextStatus,
        changedByAuthUid: decodedToken.uid,
        changedByRole,
        changedAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ ok: true, status: nextStatus, changedByRole });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Job status API failed:", {
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
          code === "missing-token"
            ? 401
            : code === "job-not-found"
              ? 404
              : code === "job-access-denied"
                ? 403
                : 500,
      },
    );
  }
}
