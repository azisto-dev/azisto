import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { sendPushToUser, type PushPayload } from "@/lib/pushSender";

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
  pushPayload?: Partial<PushPayload> | false;
};

function readFirstString(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }

  return typeof value === "string" ? value : "";
}

function getDefaultPushUrl(input: CreateNotificationInput) {
  const taskId = readFirstString(input.data?.taskIds ?? input.data?.taskId);

  if (input.type === "new_message") {
    return input.threadId
      ? `/messages/${encodeURIComponent(input.threadId)}`
      : "/messages";
  }

  if (input.recipientRole === "contractor") {
    if (!input.jobId) {
      return "/home";
    }

    const query = taskId ? `?taskId=${encodeURIComponent(taskId)}` : "";

    return `/contractor/jobs/${encodeURIComponent(input.jobId)}${query}`;
  }

  return "/customer/jobs";
}

function buildPushPayload(input: CreateNotificationInput): PushPayload | null {
  if (input.pushPayload === false) {
    return null;
  }

  const override = input.pushPayload ?? {};

  return {
    title: override.title ?? input.title,
    body: override.body ?? input.message,
    url: override.url ?? getDefaultPushUrl(input),
    type: override.type ?? input.type,
    jobId: override.jobId ?? input.jobId,
    threadId: override.threadId ?? input.threadId,
    contractorId: override.contractorId,
  };
}

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

  if (created) {
    const pushPayload = buildPushPayload(input);

    if (pushPayload) {
      await sendPushToUser(input.recipientAuthUid, pushPayload);
    }
  }

  return created;
}
