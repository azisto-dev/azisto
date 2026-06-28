import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { adminErrorResponse, requireAdmin } from "@/lib/adminAuth";
import {
  readText,
  serializeTimestamp,
  sortByNewest,
} from "@/lib/adminConsole";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const [
      customersCount,
      contractorsCount,
      pendingContractorsCount,
      activeJobsCount,
      completedJobsCount,
      reportedJobsCount,
      reviewsCount,
      recentJobs,
      recentReviews,
      recentNotifications,
    ] = await Promise.all([
      adminDb.collection("customers").count().get(),
      adminDb.collection("contractors").count().get(),
      adminDb
        .collection("contractors")
        .where("verificationStatus", "==", "pending")
        .count()
        .get(),
      adminDb
        .collection("jobs")
        .where("status", "in", [
          "hired",
          "accepted",
          "on_the_way",
          "in_progress",
          "completion_pending_customer",
        ])
        .count()
        .get(),
      adminDb.collection("jobs").where("status", "==", "completed").count().get(),
      adminDb.collection("jobs").where("reportsCount", ">", 0).count().get(),
      adminDb.collection("reviews").count().get(),
      adminDb.collection("jobs").orderBy("createdAt", "desc").limit(6).get(),
      adminDb.collection("reviews").orderBy("createdAt", "desc").limit(6).get(),
      adminDb
        .collection("notifications")
        .orderBy("createdAt", "desc")
        .limit(6)
        .get(),
    ]);

    const recentActivity = sortByNewest([
      ...recentJobs.docs.map((snapshot) => ({
        type: "job",
        title: `Job ${readText(snapshot.get("jobId")) || snapshot.id} created`,
        detail:
          readText(snapshot.get("selectedServiceCategory")) ||
          "Service request",
        createdAt: serializeTimestamp(snapshot.get("createdAt")),
      })),
      ...recentReviews.docs.map((snapshot) => ({
        type: "review",
        title: `New ${snapshot.get("rating") || 0}-star review`,
        detail: readText(snapshot.get("jobId")),
        createdAt: serializeTimestamp(snapshot.get("createdAt")),
      })),
      ...recentNotifications.docs.map((snapshot) => ({
        type: "notification",
        title: readText(snapshot.get("title")) || "Notification",
        detail: readText(snapshot.get("message")),
        createdAt: serializeTimestamp(snapshot.get("createdAt")),
      })),
    ]).slice(0, 10);

    return NextResponse.json({
      ok: true,
      stats: {
        totalUsers: customersCount.data().count,
        totalContractors: contractorsCount.data().count,
        pendingContractors: pendingContractorsCount.data().count,
        activeJobs: activeJobsCount.data().count,
        completedJobs: completedJobsCount.data().count,
        openReports: reportedJobsCount.data().count,
        reviews: reviewsCount.data().count,
      },
      recentActivity,
    });
  } catch (error) {
    return adminErrorResponse(error, "Admin overview API failed");
  }
}
