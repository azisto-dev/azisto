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
    const snapshot = await adminDb.collection("messages").limit(limit).get();
    const threads = sortByNewest(
      snapshot.docs.map((documentSnapshot) => {
        const data = documentSnapshot.data();
        return {
          threadId: readText(data.threadId) || documentSnapshot.id,
          jobId: readText(data.jobId),
          userName:
            readText(data.customerFirstName) ||
            readText(data.customerName) ||
            "Customer",
          contractorName:
            readText(data.businessName) ||
            readText(data.contractorName) ||
            "Contractor",
          lastMessage: readText(data.lastMessage),
          updatedAt:
            serializeTimestamp(data.updatedAt) ||
            serializeTimestamp(data.lastMessageAt),
          unreadCount: readStringList(data.unreadBy).length,
          status: readText(data.status),
        };
      }),
    );

    return NextResponse.json({ ok: true, threads });
  } catch (error) {
    return adminErrorResponse(error, "Admin messages API failed");
  }
}
