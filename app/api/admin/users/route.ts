import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { adminErrorResponse, requireAdmin } from "@/lib/adminAuth";
import {
  getAdminLimit,
  readNumber,
  readText,
  serializeTimestamp,
  sortByNewest,
} from "@/lib/adminConsole";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const limit = getAdminLimit(request.nextUrl.searchParams.get("limit"));
    const snapshot = await adminDb.collection("customers").limit(limit).get();
    const users = sortByNewest(
      snapshot.docs.map((documentSnapshot) => {
        const data = documentSnapshot.data();
        return {
          customerId: readText(data.customerId) || documentSnapshot.id,
          name: readText(data.fullName) || readText(data.name) || "Customer",
          email: readText(data.email),
          phone: readText(data.phoneNumber),
          city: readText(data.city),
          province: readText(data.province),
          createdAt: serializeTimestamp(data.createdAt),
          jobsPosted:
            readNumber(data.jobsPosted) || readNumber(data.jobsPostedCount),
          completedJobs:
            readNumber(data.completedJobs) ||
            readNumber(data.completedJobsCount),
          accountStatus: readText(data.accountStatus) || "active",
          profilePhotoUrl: readText(data.profilePhotoUrl),
          profilePhotoStoragePath: readText(data.profilePhotoStoragePath),
        };
      }),
    );

    return NextResponse.json({ ok: true, users });
  } catch (error) {
    return adminErrorResponse(error, "Admin users API failed");
  }
}
