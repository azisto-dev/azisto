import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import { JOB_EXPIRY_DURATION_MS } from "@/lib/jobExpiry";
import { getParentJobStatus } from "@/lib/jobLifecycle";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

function getBearerToken(authorizationHeader: string | null) {
  return authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : "";
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

export async function POST(request: NextRequest, context: RouteContext) {
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
    const { jobId } = await context.params;
    const jobDocument = adminDb.collection("jobs").doc(jobId);
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(
      now.toMillis() + JOB_EXPIRY_DURATION_MS,
    );

    await adminDb.runTransaction(async (transaction) => {
      const jobSnapshot = await transaction.get(jobDocument);

      if (!jobSnapshot.exists) {
        throw Object.assign(new Error("This job could not be found."), {
          code: "job-not-found",
        });
      }

      if (jobSnapshot.get("customerAuthUid") !== decodedToken.uid) {
        throw Object.assign(new Error("You can only repost your own jobs."), {
          code: "job-access-denied",
        });
      }

      const currentStatus = readText(jobSnapshot.get("status"));
      const tasksSnapshot = await transaction.get(
        jobDocument.collection("tasks"),
      );
      const repostableTasks = tasksSnapshot.docs.filter((taskSnapshot) =>
        ["open", "expired"].includes(readText(taskSnapshot.get("status"))),
      );

      if (
        tasksSnapshot.empty &&
        !["open", "expired"].includes(currentStatus)
      ) {
        throw Object.assign(
          new Error("Only open or expired jobs can be reposted."),
          { code: "job-not-repostable" },
        );
      }

      if (!tasksSnapshot.empty && repostableTasks.length === 0) {
        throw Object.assign(
          new Error("This job has no open or expired tasks to repost."),
          { code: "job-not-repostable" },
        );
      }

      const repostableIds = new Set(
        repostableTasks.map((taskSnapshot) => taskSnapshot.id),
      );
      repostableTasks.forEach((taskSnapshot) => {
        transaction.set(
          taskSnapshot.ref,
          {
            status: "open",
            matchingStatus: "open",
            createdAt: now,
            repostedAt: now,
            expiresAt,
            expiryNoticeSentAt: null,
            expiredAt: FieldValue.delete(),
            updatedAt: now,
          },
          { merge: true },
        );
      });

      const parentStatus = tasksSnapshot.empty
        ? {
            status: "open",
            overallStatus: "open",
            matchingStatus: "open" as const,
          }
        : getParentJobStatus(
            tasksSnapshot.docs.map((taskSnapshot) =>
              repostableIds.has(taskSnapshot.id)
                ? "open"
                : readText(taskSnapshot.get("status")),
            ),
          );

      transaction.set(
        jobDocument,
        {
          ...parentStatus,
          createdAt: now,
          repostedAt: now,
          expiresAt,
          expiryNoticeSentAt: null,
          expiredAt: FieldValue.delete(),
          updatedAt: now,
        },
        { merge: true },
      );

      transaction.set(jobDocument.collection("statusHistory").doc(), {
        fromStatus: currentStatus,
        toStatus: parentStatus.status,
        status: parentStatus.status,
        changedAt: now,
        changedByRole: "customer",
        changedByUid: decodedToken.uid,
        note: "Job reposted",
      });
    });

    return NextResponse.json({
      ok: true,
      status: "open",
      expiresAt: expiresAt.toDate().toISOString(),
    });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Job repost API failed:", { code, message, error });

    return NextResponse.json(
      { code, message },
      {
        status:
          code === "missing-token"
            ? 401
            : code === "job-not-found"
              ? 404
              : code === "job-access-denied"
                ? 403
                : code === "job-not-repostable"
                  ? 409
                  : 500,
      },
    );
  }
}
