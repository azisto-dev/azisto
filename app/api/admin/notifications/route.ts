import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { adminErrorResponse, requireAdmin } from "@/lib/adminAuth";
import {
  getAdminLimit,
  readText,
  serializeTimestamp,
  sortByNewest,
} from "@/lib/adminConsole";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const limit = getAdminLimit(request.nextUrl.searchParams.get("limit"));
    const snapshot = await adminDb.collection("notifications").limit(limit).get();
    const notifications = sortByNewest(
      snapshot.docs.map((documentSnapshot) => {
        const data = documentSnapshot.data();
        return {
          notificationId:
            readText(data.notificationId) || documentSnapshot.id,
          recipient:
            readText(data.recipientName) ||
            readText(data.recipientRole) ||
            "User",
          recipientRole: readText(data.recipientRole),
          type: readText(data.type),
          title: readText(data.title),
          message: readText(data.message),
          read: data.read === true,
          jobId: readText(data.jobId),
          createdAt: serializeTimestamp(data.createdAt),
        };
      }),
    );

    return NextResponse.json({ ok: true, notifications });
  } catch (error) {
    return adminErrorResponse(error, "Admin notifications API failed");
  }
}
