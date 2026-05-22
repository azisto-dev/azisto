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

type HireRequestBody = {
  contractorId?: unknown;
};

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
    const body = (await request.json()) as HireRequestBody;
    const contractorId = readText(body.contractorId);

    if (!contractorId) {
      return NextResponse.json(
        {
          code: "missing-contractor-id",
          message: "Please choose a contractor to hire.",
        },
        { status: 400 },
      );
    }

    const jobDocument = adminDb.collection("jobs").doc(jobId);
    const interestedSnapshot = await jobDocument
      .collection("interestedContractors")
      .where("contractorId", "==", contractorId)
      .limit(1)
      .get();

    if (interestedSnapshot.empty) {
      return NextResponse.json(
        {
          code: "contractor-not-interested",
          message: "This contractor has not expressed interest in the job.",
        },
        { status: 400 },
      );
    }

    const interestedContractor = interestedSnapshot.docs[0];
    const hiredContractorAuthUid =
      readText(interestedContractor.get("contractorUid")) ||
      interestedContractor.id;

    await adminDb.runTransaction(async (transaction) => {
      const jobSnapshot = await transaction.get(jobDocument);

      if (!jobSnapshot.exists) {
        throw Object.assign(new Error("This job could not be found."), {
          code: "job-not-found",
        });
      }

      if (jobSnapshot.get("customerAuthUid") !== decodedToken.uid) {
        throw Object.assign(
          new Error("You can only hire contractors for your own jobs."),
          { code: "job-access-denied" },
        );
      }

      if (jobSnapshot.get("status") !== "open") {
        throw Object.assign(new Error("Only open jobs can be hired."), {
          code: "job-not-open",
        });
      }

      transaction.set(
        jobDocument,
        {
          status: "hired",
          matchingStatus: "closed",
          hiredContractorId: contractorId,
          hiredContractorAuthUid,
          hiredContractorName: readText(
            interestedContractor.get("contractorName"),
          ),
          hiredBusinessName: readText(interestedContractor.get("businessName")),
          hiredAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      transaction.set(jobDocument.collection("statusHistory").doc(), {
        fromStatus: "open",
        toStatus: "hired",
        changedByAuthUid: decodedToken.uid,
        changedByRole: "customer",
        changedAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Job hire API failed:", {
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
