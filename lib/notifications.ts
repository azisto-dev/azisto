import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

type CreateNotificationInput = {
  recipientAuthUid: string;
  recipientRole: "customer" | "contractor";
  type: string;
  title: string;
  message: string;
  jobId: string;
  threadId?: string;
  dedupeKey?: string;
  data?: Record<string, unknown>;
};

export async function createNotification(input: CreateNotificationInput) {
  if (!input.recipientAuthUid) {
    return false;
  }

  const notificationDocument = input.dedupeKey
    ? adminDb.collection("notifications").doc(input.dedupeKey)
    : adminDb.collection("notifications").doc();
  let created = false;

  await adminDb.runTransaction(async (transaction) => {
    if (input.dedupeKey) {
      const existingNotification = await transaction.get(notificationDocument);

      if (existingNotification.exists) {
        return;
      }
    }

    transaction.set(notificationDocument, {
      notificationId: notificationDocument.id,
      recipientAuthUid: input.recipientAuthUid,
      recipientRole: input.recipientRole,
      type: input.type,
      title: input.title,
      message: input.message,
      jobId: input.jobId,
      threadId: input.threadId ?? "",
      read: false,
      clearedAt: null,
      ...(input.data ?? {}),
      createdAt: FieldValue.serverTimestamp(),
    });
    created = true;
  });

  return created;
}
