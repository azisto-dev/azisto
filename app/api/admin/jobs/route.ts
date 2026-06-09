import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { adminErrorResponse, requireAdmin } from "@/lib/adminAuth";
import {
  getAdminLimit,
  readStringList,
  readText,
  serializeTimestamp,
  sortByNewest,
} from "@/lib/adminConsole";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const limit = getAdminLimit(request.nextUrl.searchParams.get("limit"));
    const snapshot = await adminDb.collection("jobs").limit(limit).get();
    const jobs = sortByNewest(
      snapshot.docs.map((documentSnapshot) => {
        const data = documentSnapshot.data();
        return {
          jobId: readText(data.jobId) || documentSnapshot.id,
          customerId: readText(data.customerId),
          customerName:
            readText(data.customerFirstName) ||
            readText(data.customerName) ||
            "Customer",
          contractorName:
            readText(data.hiredBusinessName) ||
            readText(data.hiredContractorName),
          contractorId: readText(data.hiredContractorId),
          category: readText(data.selectedServiceCategory),
          subcategories: readStringList(data.selectedSubcategories),
          city: readText(data.city),
          province: readText(data.province),
          status: readText(data.overallStatus) || readText(data.status),
          createdAt: serializeTimestamp(data.createdAt),
          completedAt: serializeTimestamp(data.completedAt),
          scheduleMode: readText(data.scheduleMode),
          preferredDate: readText(data.preferredDate),
          preferredTimeWindow: readText(data.preferredTimeWindow),
          urgency: readText(data.urgency),
          reportsCount:
            typeof data.reportsCount === "number" ? data.reportsCount : 0,
        };
      }),
    );

    return NextResponse.json({ ok: true, jobs });
  } catch (error) {
    return adminErrorResponse(error, "Admin jobs API failed");
  }
}
