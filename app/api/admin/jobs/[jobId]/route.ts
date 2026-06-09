import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { adminErrorResponse, requireAdmin } from "@/lib/adminAuth";
import {
  collectLinkedFiles,
  readNumber,
  readStringList,
  readText,
  serializeTimestamp,
  sortByNewest,
} from "@/lib/adminConsole";
import { readJobProofPhotos } from "@/lib/jobProofPhotos";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireAdmin(request);
    const { jobId } = await context.params;
    const jobSnapshot = await adminDb.collection("jobs").doc(jobId).get();

    if (!jobSnapshot.exists) {
      return NextResponse.json(
        { code: "job-not-found", message: "Job not found." },
        { status: 404 },
      );
    }

    const [tasksSnapshot, reportsSnapshot, reviewsSnapshot, threadsSnapshot] =
      await Promise.all([
        jobSnapshot.ref.collection("tasks").limit(50).get(),
        jobSnapshot.ref.collection("reports").limit(25).get(),
        adminDb.collection("reviews").where("jobId", "==", jobId).limit(10).get(),
        adminDb.collection("messages").where("jobId", "==", jobId).limit(10).get(),
      ]);
    const data = jobSnapshot.data() ?? {};
    const tasks = sortByNewest(
      tasksSnapshot.docs.map((snapshot) => {
        const taskData = snapshot.data();
        return {
          taskId: readText(taskData.taskId) || snapshot.id,
          category: readText(taskData.category),
          subcategory: readText(taskData.subcategory),
          status: readText(taskData.status),
          contractorId: readText(taskData.hiredContractorId),
          contractorName:
            readText(taskData.hiredBusinessName) ||
            readText(taskData.hiredContractorName),
          interestedContractorIds: readStringList(
            taskData.interestedContractorIds,
          ),
          beforePhotos: readJobProofPhotos(taskData.beforePhotos),
          afterPhotos: readJobProofPhotos(taskData.afterPhotos),
          createdAt: serializeTimestamp(taskData.createdAt),
          updatedAt: serializeTimestamp(taskData.updatedAt),
        };
      }),
    );

    return NextResponse.json({
      ok: true,
      job: {
        jobId: readText(data.jobId) || jobSnapshot.id,
        customerId: readText(data.customerId),
        customerName:
          readText(data.customerFirstName) ||
          readText(data.customerName) ||
          "Customer",
        contractorId: readText(data.hiredContractorId),
        contractorName:
          readText(data.hiredBusinessName) ||
          readText(data.hiredContractorName),
        category: readText(data.selectedServiceCategory),
        subcategories: readStringList(data.selectedSubcategories),
        description: readText(data.jobDescription),
        address: readText(data.address),
        city: readText(data.city),
        province: readText(data.province),
        postalCode: readText(data.postalCode),
        status: readText(data.overallStatus) || readText(data.status),
        matchingStatus: readText(data.matchingStatus),
        scheduleMode: readText(data.scheduleMode),
        preferredDate: readText(data.preferredDate),
        preferredTimeWindow: readText(data.preferredTimeWindow),
        urgency: readText(data.urgency),
        reportsCount: readNumber(data.reportsCount),
        interestedContractorIds: readStringList(data.interestedContractorIds),
        statusHistory: Array.isArray(data.statusHistory)
          ? data.statusHistory.map((item) => {
              const record =
                typeof item === "object" && item !== null
                  ? (item as Record<string, unknown>)
                  : {};
              return {
                status: readText(record.status),
                note: readText(record.note),
                createdAt: serializeTimestamp(record.createdAt),
              };
            })
          : [],
        beforePhotos: readJobProofPhotos(data.beforePhotos),
        afterPhotos: readJobProofPhotos(data.afterPhotos),
        createdAt: serializeTimestamp(data.createdAt),
        completedAt: serializeTimestamp(data.completedAt),
      },
      tasks,
      reports: sortByNewest(
        reportsSnapshot.docs.map((snapshot) => ({
          reportId: snapshot.id,
          reason: readText(snapshot.get("reason")),
          details: readText(snapshot.get("details")),
          createdAt: serializeTimestamp(snapshot.get("createdAt")),
        })),
      ),
      reviews: sortByNewest(
        reviewsSnapshot.docs.map((snapshot) => ({
          reviewId: snapshot.id,
          rating: readNumber(snapshot.get("rating")),
          reviewText: readText(snapshot.get("reviewText")),
          tags: readStringList(snapshot.get("tags")),
          createdAt: serializeTimestamp(snapshot.get("createdAt")),
        })),
      ),
      threads: threadsSnapshot.docs.map((snapshot) => ({
        threadId: readText(snapshot.get("threadId")) || snapshot.id,
        lastMessage: readText(snapshot.get("lastMessage")),
        updatedAt: serializeTimestamp(snapshot.get("updatedAt")),
      })),
      linkedFiles: collectLinkedFiles(data.photos, ["photos"]),
    });
  } catch (error) {
    return adminErrorResponse(error, "Admin job detail API failed");
  }
}
