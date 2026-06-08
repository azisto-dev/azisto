import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    contractorId: string;
  }>;
};

type PublicReview = {
  reviewId: string;
  rating: number;
  reviewText: string;
  tags: string[];
  serviceCategory: string;
  subcategory: string;
  city: string;
  createdAt: string;
  customerName: string;
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

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
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

function serializeReview(
  reviewId: string,
  data: Record<string, unknown>,
  fallback: Partial<PublicReview> = {},
): PublicReview {
  return {
    reviewId,
    rating: readNumber(data.rating),
    reviewText: readText(data.reviewText),
    tags: readStringList(data.tags),
    serviceCategory:
      readText(data.serviceCategory) || fallback.serviceCategory || "",
    subcategory: readText(data.subcategory) || fallback.subcategory || "",
    city: readText(data.city) || fallback.city || "",
    createdAt: serializeTimestamp(data.createdAt),
    customerName: "AZISTO customer",
  };
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

    await adminAuth.verifyIdToken(token);
    const { contractorId } = await context.params;
    const contractorSnapshot = await adminDb
      .collection("contractors")
      .doc(contractorId)
      .get();

    if (!contractorSnapshot.exists) {
      return NextResponse.json(
        { message: "This contractor could not be found." },
        { status: 404 },
      );
    }

    const contractorData = contractorSnapshot.data() ?? {};
    const [currentReviewsSnapshot, legacyJobsSnapshot] = await Promise.all([
      adminDb
        .collection("reviews")
        .where("contractorId", "==", contractorId)
        .get(),
      adminDb
        .collection("jobs")
        .where("hiredContractorId", "==", contractorId)
        .limit(50)
        .get(),
    ]);
    const reviewsByKey = new Map<string, PublicReview>();

    currentReviewsSnapshot.docs.forEach((reviewSnapshot) => {
      const data = reviewSnapshot.data();
      const jobId = readText(data.jobId);
      const taskId = readText(data.taskId);
      reviewsByKey.set(
        `${jobId}:${taskId || "job"}`,
        serializeReview(reviewSnapshot.id, data),
      );
    });

    await Promise.all(
      legacyJobsSnapshot.docs.map(async (jobSnapshot) => {
        const reviewSnapshot = await jobSnapshot.ref
          .collection("review")
          .doc("main")
          .get();

        if (!reviewSnapshot.exists) {
          return;
        }

        const data = reviewSnapshot.data() ?? {};
        const jobData = jobSnapshot.data();
        const jobId = readText(data.jobId) || jobSnapshot.id;
        const reviewKey = `${jobId}:job`;

        if (reviewsByKey.has(reviewKey)) {
          return;
        }

        const selectedSubcategories = readStringList(
          jobData.selectedSubcategories,
        );

        reviewsByKey.set(
          reviewKey,
          serializeReview(reviewSnapshot.id, data, {
            serviceCategory: readText(jobData.selectedServiceCategory),
            subcategory: selectedSubcategories[0] ?? "",
            city: readText(jobData.city),
          }),
        );
      }),
    );

    const reviews = Array.from(reviewsByKey.values())
      .filter((review) => review.rating >= 1 && review.rating <= 5)
      .sort((firstReview, secondReview) =>
        secondReview.createdAt.localeCompare(firstReview.createdAt),
      )
      .slice(0, 20);
    const verificationStatus = readText(contractorData.verificationStatus);

    return NextResponse.json({
      ok: true,
      contractor: {
        name:
          readText(contractorData.businessName) ||
          readText(contractorData.contactName) ||
          "Contractor",
        contactName: readText(contractorData.contactName),
        ratingAverage:
          readNumber(contractorData.ratingAverage) ||
          readNumber(contractorData.averageRating),
        ratingCount:
          readNumber(contractorData.ratingCount) ||
          readNumber(contractorData.reviewCount),
        completedJobs: Math.max(
          readNumber(contractorData.completedJobs),
          readNumber(contractorData.completedJobsCount),
        ),
        verified: ["approved", "verified", "active"].includes(
          verificationStatus.toLowerCase(),
        ),
      },
      reviews,
    });
  } catch (error) {
    console.error("Public contractor reviews API failed:", error);
    return NextResponse.json(
      { message: "Reviews could not be loaded. Please try again." },
      { status: 500 },
    );
  }
}
