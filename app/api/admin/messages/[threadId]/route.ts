import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { adminErrorResponse, requireAdmin } from "@/lib/adminAuth";
import {
  readStringList,
  readText,
  serializeTimestamp,
} from "@/lib/adminConsole";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ threadId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireAdmin(request);
    const { threadId } = await context.params;
    const threadSnapshot = await adminDb
      .collection("messages")
      .doc(threadId)
      .get();

    if (!threadSnapshot.exists) {
      return NextResponse.json(
        { code: "thread-not-found", message: "Message thread not found." },
        { status: 404 },
      );
    }

    const itemsSnapshot = await threadSnapshot.ref
      .collection("items")
      .orderBy("createdAt", "asc")
      .limit(50)
      .get();
    const data = threadSnapshot.data() ?? {};

    return NextResponse.json({
      ok: true,
      thread: {
        threadId,
        jobId: readText(data.jobId),
        userName:
          readText(data.customerFirstName) ||
          readText(data.customerName) ||
          "Customer",
        contractorName:
          readText(data.businessName) ||
          readText(data.contractorName) ||
          "Contractor",
        selectedTaskLabels: readStringList(data.selectedTaskLabels),
        status: readText(data.status),
        updatedAt: serializeTimestamp(data.updatedAt),
      },
      messages: itemsSnapshot.docs.map((snapshot) => ({
        messageId: snapshot.id,
        message: readText(snapshot.get("message")),
        senderRole: readText(snapshot.get("senderRole")),
        createdAt: serializeTimestamp(snapshot.get("createdAt")),
        attachments: Array.isArray(snapshot.get("attachments"))
          ? snapshot.get("attachments").flatMap((item: unknown) => {
              const record =
                typeof item === "object" && item !== null
                  ? (item as Record<string, unknown>)
                  : {};
              const url = readText(record.url);
              return url
                ? [
                    {
                      type: readText(record.type),
                      url,
                      storagePath: readText(record.storagePath),
                    },
                  ]
                : [];
            })
          : [],
      })),
    });
  } catch (error) {
    return adminErrorResponse(error, "Admin message detail API failed");
  }
}
