import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

type ReviewRequestBody = {
  rating?: unknown;
  reviewText?: unknown;
};

function getBearerToken(authorizationHeader: string | null) {
  return authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : "";
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readRating(value: unknown) {
  return typeof value === "number" && value >= 1 && value <= 5
    ? Math.round(value)
    : 0;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertFirebaseAdminConfig();
    const token = getBearerToken(request.headers.get("authorization"));

    if (!token) {
      return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const { jobId } = await context.params;
    const body = (await request.json()) as ReviewRequestBody;
    const rating = readRating(body.rating);
    const reviewText = readText(body.reviewText);

    if (!rating) {
      return NextResponse.json(
        { message: "Please choose a rating from 1 to 5 stars." },
        { status: 400 },
      );
    }

    const jobDocument = adminDb.collection("jobs").doc(jobId);
    const jobSnapshot = await jobDocument.get();

    if (!jobSnapshot.exists) {
      return NextResponse.json({ message: "This job could not be found." }, { status: 404 });
    }

    if (jobSnapshot.get("customerAuthUid") !== decodedToken.uid) {
      return NextResponse.json(
        { message: "You can only review your own completed jobs." },
        { status: 403 },
      );
    }

    if (jobSnapshot.get("status") !== "completed") {
      return NextResponse.json(
        { message: "Only completed jobs can be reviewed." },
        { status: 400 },
      );
    }

    const reviewDocument = jobDocument.collection("review").doc("main");
    const reviewSnapshot = await reviewDocument.get();

    if (reviewSnapshot.exists) {
      return NextResponse.json(
        { message: "This job has already been reviewed." },
        { status: 400 },
      );
    }

    const customerId = readText(jobSnapshot.get("customerId"));
    const contractorId = readText(jobSnapshot.get("hiredContractorId"));
    const contractorDocument = adminDb.collection("contractors").doc(contractorId);
    const contractorSnapshot = await contractorDocument.get();
    const contractorData = contractorSnapshot.exists
      ? contractorSnapshot.data() ?? {}
      : {};
    const previousReviewCount =
      typeof contractorData.reviewCount === "number"
        ? contractorData.reviewCount
        : 0;
    const previousAverageRating =
      typeof contractorData.averageRating === "number"
        ? contractorData.averageRating
        : 0;
    const nextReviewCount = previousReviewCount + 1;
    const nextAverageRating =
      (previousAverageRating * previousReviewCount + rating) / nextReviewCount;

    await reviewDocument.set({
      jobId,
      customerId,
      contractorId,
      rating,
      reviewText,
      createdAt: FieldValue.serverTimestamp(),
    });
    await contractorDocument.set(
      {
        reviewCount: nextReviewCount,
        averageRating: nextAverageRating,
        latestReviewAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await createNotification({
      recipientAuthUid: readText(jobSnapshot.get("hiredContractorAuthUid")),
      recipientRole: "contractor",
      type: "review_submitted",
      title: "New review received",
      message: `You received a ${rating}-star review for job ${jobId}.`,
      jobId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Job review API failed:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to save review." },
      { status: 500 },
    );
  }
}
