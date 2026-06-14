import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { adminErrorResponse, requireAdmin } from "@/lib/adminAuth";
import {
  collectLinkedFiles,
  readNumber,
  readRecord,
  readStringList,
  readText,
  serializeTimestamp,
  sortByNewest,
} from "@/lib/adminConsole";
import { getSubscriptionSummary } from "@/lib/subscriptions";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ contractorId: string }>;
};

async function findContractor(contractorId: string) {
  const direct = await adminDb.collection("contractors").doc(contractorId).get();

  if (direct.exists) {
    return direct;
  }

  const query = await adminDb
    .collection("contractors")
    .where("contractorId", "==", contractorId)
    .limit(1)
    .get();
  return query.empty ? null : query.docs[0];
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireAdmin(request);
    const { contractorId } = await context.params;
    const contractorSnapshot = await findContractor(contractorId);

    if (!contractorSnapshot) {
      return NextResponse.json(
        { code: "contractor-not-found", message: "Contractor not found." },
        { status: 404 },
      );
    }

    const data = contractorSnapshot.data() ?? {};
    const publicContractorId =
      readText(data.contractorId) || contractorSnapshot.id;
    const [reviewsSnapshot, jobsSnapshot] = await Promise.all([
      adminDb
        .collection("reviews")
        .where("contractorId", "==", publicContractorId)
        .limit(10)
        .get(),
      adminDb
        .collection("jobs")
        .where("hiredContractorId", "==", publicContractorId)
        .limit(10)
        .get(),
    ]);
    const documents = readRecord(data.documents);
    const subscription = getSubscriptionSummary(data);

    return NextResponse.json({
      ok: true,
      contractor: {
        contractorId: publicContractorId,
        name:
          readText(data.businessName) ||
          readText(data.contactName) ||
          "Contractor",
        contactName: readText(data.contactName),
        businessName: readText(data.businessName),
        email: readText(data.email),
        phone: readText(data.phoneNumber),
        address: readText(data.address),
        city: readText(data.city),
        province: readText(data.province),
        postalCode: readText(data.postalCode),
        serviceCities: readStringList(
          readRecord(data.jobFilterPreferences).serviceCities,
        ),
        services: readStringList(data.selectedServices),
        subcategories: Object.values(
          readRecord(data.selectedSubcategoriesByService),
        ).flatMap(readStringList),
        verificationStatus: readText(data.verificationStatus) || "pending",
        documentsVerificationStatus:
          readText(data.documentsVerificationStatus) || "pending",
        subscriptionPlan: subscription.plan.name,
        subscriptionStatus: subscription.status,
        subscriptionTrialDaysRemaining: subscription.trialDaysRemaining,
        subscriptionAcceptedJobsThisMonth:
          subscription.acceptedJobsThisMonth,
        subscriptionJobsRemaining: subscription.jobsRemaining,
        subscriptionAcceptedJobsLimit:
          subscription.plan.acceptedJobsLimit,
        subscriptionBillingCycleStart:
          subscription.billingCycleStart.toISOString(),
        subscriptionBillingCycleEnd:
          subscription.billingCycleEnd.toISOString(),
        nextBillingDate: subscription.nextBillingDate.toISOString(),
        stripeCustomerId: readText(data.stripeCustomerId),
        stripeSubscriptionId: readText(data.stripeSubscriptionId),
        acceptedJobsThisCycle: readNumber(data.acceptedJobsThisCycle),
        acceptedJobsLimit:
          data.acceptedJobsLimit === null
            ? null
            : readNumber(data.acceptedJobsLimit) ||
              subscription.plan.acceptedJobsLimit,
        rating:
          readNumber(data.ratingAverage) || readNumber(data.averageRating),
        reviewCount:
          readNumber(data.ratingCount) || readNumber(data.reviewCount),
        completedJobs: Math.max(
          readNumber(data.completedJobs),
          readNumber(data.completedJobsCount),
        ),
        createdAt: serializeTimestamp(data.createdAt),
        profilePhoto: {
          url: readText(data.profilePhotoUrl),
          storagePath: readText(data.profilePhotoStoragePath),
          fileName: readText(data.profilePhotoFileName),
          uploadedAt: serializeTimestamp(data.profilePhotoUploadedAt),
        },
      },
      files: collectLinkedFiles(documents, ["documents"]),
      recentReviews: sortByNewest(
        reviewsSnapshot.docs.map((snapshot) => ({
          reviewId: snapshot.id,
          jobId: readText(snapshot.get("jobId")),
          rating: readNumber(snapshot.get("rating")),
          reviewText: readText(snapshot.get("reviewText")),
          createdAt: serializeTimestamp(snapshot.get("createdAt")),
        })),
      ),
      recentJobs: sortByNewest(
        jobsSnapshot.docs.map((snapshot) => ({
          jobId: readText(snapshot.get("jobId")) || snapshot.id,
          category: readText(snapshot.get("selectedServiceCategory")),
          status:
            readText(snapshot.get("overallStatus")) ||
            readText(snapshot.get("status")),
          createdAt: serializeTimestamp(snapshot.get("createdAt")),
        })),
      ),
    });
  } catch (error) {
    return adminErrorResponse(error, "Admin contractor detail API failed");
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireAdmin(request);
    const { contractorId } = await context.params;
    const contractorSnapshot = await findContractor(contractorId);

    if (!contractorSnapshot) {
      return NextResponse.json(
        { code: "contractor-not-found", message: "Contractor not found." },
        { status: 404 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      action?: unknown;
      documentKey?: unknown;
    } | null;
    const action = readText(body?.action);
    const documentKey = readText(body?.documentKey);
    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (action === "approve-contractor") {
      update.verificationStatus = "approved";
    } else if (action === "reject-contractor") {
      update.verificationStatus = "rejected";
    } else if (action === "request-documents") {
      update.verificationStatus = "changes_requested";
      update.documentsVerificationStatus = "replacement_requested";
    } else if (
      ["approve-document", "reject-document", "request-replacement"].includes(
        action,
      ) &&
      /^documents\.[A-Za-z0-9_-]+$/.test(documentKey)
    ) {
      update[`${documentKey}.reviewStatus`] =
        action === "approve-document"
          ? "approved"
          : action === "reject-document"
            ? "rejected"
            : "replacement_requested";
      update[`${documentKey}.reviewedAt`] = FieldValue.serverTimestamp();
    } else {
      return NextResponse.json(
        { code: "invalid-admin-action", message: "Unsupported admin action." },
        { status: 400 },
      );
    }

    await contractorSnapshot.ref.update(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error, "Admin contractor update API failed");
  }
}
