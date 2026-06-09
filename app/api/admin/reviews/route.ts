import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { adminErrorResponse, requireAdmin } from "@/lib/adminAuth";
import {
  getAdminLimit,
  readNumber,
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
    const snapshot = await adminDb.collection("reviews").limit(limit).get();
    const reviews = sortByNewest(
      snapshot.docs.map((documentSnapshot) => {
        const data = documentSnapshot.data();
        return {
          reviewId: readText(data.reviewId) || documentSnapshot.id,
          contractorId: readText(data.contractorId),
          contractorName:
            readText(data.contractorName) || readText(data.businessName),
          customerName:
            readText(data.customerFirstName) || "AZISTO customer",
          jobId: readText(data.jobId),
          rating: readNumber(data.rating),
          tags: readStringList(data.tags),
          reviewText: readText(data.reviewText),
          serviceCategory: readText(data.serviceCategory),
          subcategory: readText(data.subcategory),
          city: readText(data.city),
          createdAt: serializeTimestamp(data.createdAt),
        };
      }),
    );

    return NextResponse.json({ ok: true, reviews });
  } catch (error) {
    return adminErrorResponse(error, "Admin reviews API failed");
  }
}
