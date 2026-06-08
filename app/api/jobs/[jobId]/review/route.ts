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
  taskId?: unknown;
  rating?: unknown;
  reviewText?: unknown;
  tags?: unknown;
};

const allowedReviewTags = new Set([
  "On time",
  "Professional",
  "Good communication",
  "Quality work",
  "Fair price",
  "Would hire again",
]);

function getBearerToken(authorizationHeader: string | null) {
  return authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : "";
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readRating(value: unknown) {
  return typeof value === "number" && value >= 1 && value <= 5
    ? Math.round(value)
    : 0;
}

function readTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter((tag) => allowedReviewTags.has(tag)),
    ),
  );
}

function serializeTimestamp(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return "";
}

function getReviewId(jobId: string, taskId: string, customerId: string) {
  return `${jobId}__${taskId || "job"}__${customerId}`.replaceAll("/", "_");
}

async function getReviewContext(
  decodedUid: string,
  jobId: string,
  requestedTaskId = "",
) {
  const jobDocument = adminDb.collection("jobs").doc(jobId);
  const jobSnapshot = await jobDocument.get();

  if (!jobSnapshot.exists) {
    return { error: "This job could not be found.", status: 404 } as const;
  }

  if (jobSnapshot.get("customerAuthUid") !== decodedUid) {
    return {
      error: "You can only review your own completed jobs.",
      status: 403,
    } as const;
  }

  const tasksSnapshot = await jobDocument.collection("tasks").get();
  const completedTasks = tasksSnapshot.docs.filter(
    (taskSnapshot) => readText(taskSnapshot.get("status")) === "completed",
  );
  let selectedTask = requestedTaskId
    ? completedTasks.find(
        (taskSnapshot) =>
          (readText(taskSnapshot.get("taskId")) || taskSnapshot.id) ===
          requestedTaskId,
      )
    : completedTasks.length >= 1
      ? completedTasks[0]
      : undefined;

  if (requestedTaskId && !selectedTask) {
    return {
      error: "This task is not completed or could not be found.",
      status: 400,
    } as const;
  }

  const taskId = selectedTask
    ? readText(selectedTask.get("taskId")) || selectedTask.id
    : "";
  const parentCompleted =
    readText(jobSnapshot.get("overallStatus")) === "completed" ||
    readText(jobSnapshot.get("status")) === "completed";

  if (!selectedTask && !parentCompleted) {
    return {
      error:
        completedTasks.length > 1
          ? "Please choose the completed task you want to review."
          : "Only completed jobs can be reviewed.",
      status: 400,
    } as const;
  }

  const contractorId =
    readText(selectedTask?.get("hiredContractorId")) ||
    readText(jobSnapshot.get("hiredContractorId"));
  const contractorAuthUid =
    readText(selectedTask?.get("hiredContractorAuthUid")) ||
    readText(jobSnapshot.get("hiredContractorAuthUid"));

  if (!contractorId) {
    return {
      error: "The contractor for this completed work could not be found.",
      status: 400,
    } as const;
  }

  return {
    jobDocument,
    jobSnapshot,
    completedTasks,
    selectedTask,
    taskId,
    contractorId,
    contractorAuthUid,
    customerId: readText(jobSnapshot.get("customerId")) || decodedUid,
    serviceCategory:
      readText(selectedTask?.get("category")) ||
      readText(jobSnapshot.get("selectedServiceCategory")),
    subcategory:
      readText(selectedTask?.get("subcategory")) ||
      (Array.isArray(jobSnapshot.get("selectedSubcategories"))
        ? readText(jobSnapshot.get("selectedSubcategories")[0])
        : ""),
    city:
      readText(selectedTask?.get("city")) || readText(jobSnapshot.get("city")),
  } as const;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    assertFirebaseAdminConfig();
    const token = getBearerToken(request.headers.get("authorization"));

    if (!token) {
      return NextResponse.json(
        { message: "Please sign in again." },
        { status: 401 },
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const { jobId } = await context.params;
    const requestedTaskId = readText(request.nextUrl.searchParams.get("taskId"));
    const reviewContext = await getReviewContext(
      decodedToken.uid,
      jobId,
      requestedTaskId,
    );

    if ("error" in reviewContext) {
      return NextResponse.json(
        { message: reviewContext.error },
        { status: reviewContext.status },
      );
    }

    const customerId = reviewContext.customerId;
    const reviewsSnapshot = await adminDb
      .collection("reviews")
      .where("jobId", "==", jobId)
      .get();
    const reviewsByTaskId = new Map(
      reviewsSnapshot.docs
        .filter(
          (reviewSnapshot) =>
            readText(reviewSnapshot.get("customerAuthUid")) === decodedToken.uid,
        )
        .map((reviewSnapshot) => [
          readText(reviewSnapshot.get("taskId")),
          {
            reviewId: reviewSnapshot.id,
            rating: readNumber(reviewSnapshot.get("rating")),
            reviewText: readText(reviewSnapshot.get("reviewText")),
            tags: Array.isArray(reviewSnapshot.get("tags"))
              ? reviewSnapshot.get("tags")
              : [],
            createdAt: serializeTimestamp(reviewSnapshot.get("createdAt")),
          },
        ]),
    );
    const targets = await Promise.all(
      reviewContext.completedTasks.map(async (taskSnapshot) => {
        const taskId = readText(taskSnapshot.get("taskId")) || taskSnapshot.id;
        const contractorId =
          readText(taskSnapshot.get("hiredContractorId")) ||
          reviewContext.contractorId;
        const contractorSnapshot = contractorId
          ? await adminDb.collection("contractors").doc(contractorId).get()
          : null;

        return {
          taskId,
          contractorId,
          contractorName:
            readText(contractorSnapshot?.get("businessName")) ||
            readText(contractorSnapshot?.get("contactName")) ||
            "Contractor",
          serviceCategory:
            readText(taskSnapshot.get("category")) ||
            reviewContext.serviceCategory,
          subcategory:
            readText(taskSnapshot.get("subcategory")) || "Completed task",
          reviewed: reviewsByTaskId.has(taskId),
          review: reviewsByTaskId.get(taskId) ?? null,
        };
      }),
    );

    if (targets.length === 0) {
      const contractorSnapshot = await adminDb
        .collection("contractors")
        .doc(reviewContext.contractorId)
        .get();
      targets.push({
        taskId: "",
        contractorId: reviewContext.contractorId,
        contractorName:
          readText(contractorSnapshot.get("businessName")) ||
          readText(contractorSnapshot.get("contactName")) ||
          "Contractor",
        serviceCategory: reviewContext.serviceCategory,
        subcategory: reviewContext.subcategory || "Completed job",
        reviewed: reviewsByTaskId.has(""),
        review: reviewsByTaskId.get("") ?? null,
      });
    }

    const selectedTarget =
      targets.find((target) => target.taskId === reviewContext.taskId) ??
      targets.find((target) => !target.reviewed) ??
      targets[0];

    return NextResponse.json({
      ok: true,
      jobId,
      customerId,
      city: reviewContext.city,
      selectedTaskId: selectedTarget?.taskId ?? "",
      targets,
    });
  } catch (error) {
    console.error("Job review API GET failed:", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to load review.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertFirebaseAdminConfig();
    const token = getBearerToken(request.headers.get("authorization"));

    if (!token) {
      return NextResponse.json(
        { message: "Please sign in again." },
        { status: 401 },
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const { jobId } = await context.params;
    const body = (await request.json()) as ReviewRequestBody;
    const taskId = readText(body.taskId);
    const rating = readRating(body.rating);
    const reviewText = readText(body.reviewText).slice(0, 1200);
    const tags = readTags(body.tags);

    if (!rating) {
      return NextResponse.json(
        { message: "Please choose a rating from 1 to 5 stars." },
        { status: 400 },
      );
    }

    const reviewContext = await getReviewContext(
      decodedToken.uid,
      jobId,
      taskId,
    );

    if ("error" in reviewContext) {
      return NextResponse.json(
        { message: reviewContext.error },
        { status: reviewContext.status },
      );
    }

    const reviewId = getReviewId(
      jobId,
      reviewContext.taskId,
      reviewContext.customerId,
    );
    const reviewDocument = adminDb.collection("reviews").doc(reviewId);
    const contractorDocument = adminDb
      .collection("contractors")
      .doc(reviewContext.contractorId);
    const legacyReviewDocument = reviewContext.jobDocument
      .collection("review")
      .doc("main");

    if (!reviewContext.taskId && (await legacyReviewDocument.get()).exists) {
      return NextResponse.json(
        { message: "This job has already been reviewed." },
        { status: 409 },
      );
    }

    await adminDb.runTransaction(async (transaction) => {
      const [existingReview, contractorSnapshot] = await Promise.all([
        transaction.get(reviewDocument),
        transaction.get(contractorDocument),
      ]);

      if (existingReview.exists) {
        throw new Error("review-already-exists");
      }

      const contractorData = contractorSnapshot.data() ?? {};
      const previousRatingCount =
        readNumber(contractorData.ratingCount) ||
        readNumber(contractorData.reviewCount);
      const previousRatingAverage =
        readNumber(contractorData.ratingAverage) ||
        readNumber(contractorData.averageRating);
      const ratingCount = previousRatingCount + 1;
      const ratingAverage =
        (previousRatingAverage * previousRatingCount + rating) / ratingCount;
      const completedJobs = Math.max(
        readNumber(contractorData.completedJobs),
        readNumber(contractorData.completedJobsCount),
      );

      transaction.create(reviewDocument, {
        reviewId,
        jobId,
        taskId: reviewContext.taskId || null,
        contractorId: reviewContext.contractorId,
        contractorAuthUid: reviewContext.contractorAuthUid,
        customerId: reviewContext.customerId,
        customerAuthUid: decodedToken.uid,
        rating,
        reviewText,
        tags,
        createdAt: FieldValue.serverTimestamp(),
        serviceCategory: reviewContext.serviceCategory,
        subcategory: reviewContext.subcategory,
        city: reviewContext.city,
      });
      transaction.set(
        contractorDocument,
        {
          ratingAverage,
          ratingCount,
          averageRating: ratingAverage,
          reviewCount: ratingCount,
          latestReviewAt: FieldValue.serverTimestamp(),
          completedJobs,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });

    await createNotification({
      dedupeKey: `review_submitted_${reviewId}`,
      recipientAuthUid: reviewContext.contractorAuthUid,
      recipientRole: "contractor",
      type: "review_submitted",
      title: "New review received",
      message: `You received a ${rating}-star review for job ${jobId}.`,
      jobId,
      data: {
        reviewId,
        taskId: reviewContext.taskId,
      },
    });

    return NextResponse.json({ ok: true, reviewId });
  } catch (error) {
    if (error instanceof Error && error.message === "review-already-exists") {
      return NextResponse.json(
        { message: "This completed job or task has already been reviewed." },
        { status: 409 },
      );
    }

    console.error("Job review API failed:", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to save review.",
      },
      { status: 500 },
    );
  }
}
