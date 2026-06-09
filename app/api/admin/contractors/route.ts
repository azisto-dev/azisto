import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { adminErrorResponse, requireAdmin } from "@/lib/adminAuth";
import {
  getAdminLimit,
  readNumber,
  readRecord,
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
    const snapshot = await adminDb.collection("contractors").limit(limit).get();
    const contractors = sortByNewest(
      snapshot.docs.map((documentSnapshot) => {
        const data = documentSnapshot.data();
        const subcategoryMap = readRecord(data.selectedSubcategoriesByService);
        return {
          contractorId: readText(data.contractorId) || documentSnapshot.id,
          name:
            readText(data.businessName) ||
            readText(data.contactName) ||
            "Contractor",
          contactName: readText(data.contactName),
          email: readText(data.email),
          phone: readText(data.phoneNumber),
          city: readText(data.city),
          serviceCities: readStringList(
            readRecord(data.jobFilterPreferences).serviceCities,
          ),
          services: readStringList(data.selectedServices),
          subcategories: Object.values(subcategoryMap).flatMap(readStringList),
          verificationStatus: readText(data.verificationStatus) || "pending",
          subscriptionStatus: readText(data.subscriptionStatus) || "not set",
          rating:
            readNumber(data.ratingAverage) || readNumber(data.averageRating),
          reviewCount:
            readNumber(data.ratingCount) || readNumber(data.reviewCount),
          completedJobs: Math.max(
            readNumber(data.completedJobs),
            readNumber(data.completedJobsCount),
          ),
          createdAt: serializeTimestamp(data.createdAt),
        };
      }),
    );

    return NextResponse.json({ ok: true, contractors });
  } catch (error) {
    return adminErrorResponse(error, "Admin contractors API failed");
  }
}
