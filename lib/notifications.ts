import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

type CreateNotificationInput = {
  recipientAuthUid: string;
  recipientRole: "customer" | "contractor";
  type: string;
  title: string;
  message: string;
  jobId: string;
};

export async function createNotification(input: CreateNotificationInput) {
  if (!input.recipientAuthUid) {
    return;
  }

  const notificationDocument = adminDb.collection("notifications").doc();

  await notificationDocument.set({
    notificationId: notificationDocument.id,
    recipientAuthUid: input.recipientAuthUid,
    recipientRole: input.recipientRole,
    type: input.type,
    title: input.title,
    message: input.message,
    jobId: input.jobId,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}
