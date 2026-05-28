import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    threadId: string;
  }>;
};

type MessageRequestBody = {
  text?: unknown;
  attachments?: unknown;
};

type MessageAttachment = {
  type: "image";
  url: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  size: number;
};

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return "";
  }

  return authorizationHeader.slice("Bearer ".length).trim();
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getFirstName(value: string) {
  return value.trim().split(" ").filter(Boolean)[0] ?? "";
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readAttachments(value: unknown): MessageAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const data =
        typeof item === "object" && item !== null
          ? (item as Record<string, unknown>)
          : {};
      const type = readText(data.type);
      const url = readText(data.url);
      const fileName = readText(data.fileName);
      const storagePath = readText(data.storagePath);
      const contentType = readText(data.contentType);
      const size = typeof data.size === "number" ? data.size : 0;

      if (type !== "image" || !url || !storagePath) {
        return null;
      }

      return {
        type,
        url,
        fileName,
        storagePath,
        contentType,
        size,
      };
    })
    .filter((item): item is MessageAttachment => item !== null);
}

function serializeTimestamp(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return "";
}

function getErrorDetails(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";
  const message = error instanceof Error ? error.message : "Unknown error";

  return { code, message };
}

function serializeMessage(data: Record<string, unknown>) {
  return {
    messageId: readText(data.messageId),
    senderRole: readText(data.senderRole),
    text: readText(data.text),
    attachments: readAttachments(data.attachments),
    createdAt: serializeTimestamp(data.createdAt),
    readBy: readStringList(data.readBy),
  };
}

async function getThreadForParticipant(threadId: string, firebaseUid: string) {
  const threadSnapshot = await adminDb.collection("messages").doc(threadId).get();

  if (!threadSnapshot.exists) {
    return null;
  }

  const participants = readStringList(threadSnapshot.get("participants"));

  return participants.includes(firebaseUid) ? threadSnapshot : null;
}

async function getCustomerFirstName({
  threadData,
  jobData,
}: {
  threadData: Record<string, unknown>;
  jobData: Record<string, unknown>;
}) {
  const savedName =
    getFirstName(readText(threadData.customerFirstName)) ||
    getFirstName(readText(jobData.customerFirstName)) ||
    getFirstName(readText(threadData.customerName)) ||
    getFirstName(readText(jobData.customerName));

  if (savedName) {
    return savedName;
  }

  const customerId = readText(threadData.customerId) || readText(jobData.customerId);

  if (customerId) {
    const customerSnapshot = await adminDb
      .collection("customers")
      .doc(customerId)
      .get();

    if (customerSnapshot.exists) {
      return getFirstName(readText(customerSnapshot.get("fullName"))) || "Customer";
    }
  }

  const customerAuthUid =
    readText(threadData.customerAuthUid) || readText(jobData.customerAuthUid);

  if (customerAuthUid) {
    const customerSnapshot = await adminDb
      .collection("customers")
      .where("authUid", "==", customerAuthUid)
      .limit(1)
      .get();

    if (!customerSnapshot.empty) {
      return (
        getFirstName(readText(customerSnapshot.docs[0].get("fullName"))) ||
        "Customer"
      );
    }
  }

  return "Customer";
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    assertFirebaseAdminConfig();

    const token = getBearerToken(request.headers.get("authorization"));

    if (!token) {
      return NextResponse.json(
        {
          code: "missing-token",
          message: "Please sign in again.",
        },
        { status: 401 },
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const { threadId } = await context.params;
    const threadSnapshot = await getThreadForParticipant(
      threadId,
      decodedToken.uid,
    );

    if (!threadSnapshot) {
      return NextResponse.json(
        {
          code: "thread-not-found",
          message: "This conversation could not be found.",
        },
        { status: 404 },
      );
    }

    const messagesSnapshot = await threadSnapshot.ref
      .collection("items")
      .orderBy("createdAt", "asc")
      .get();
    const messages = messagesSnapshot.docs.map((documentSnapshot) =>
      serializeMessage(documentSnapshot.data()),
    );
    const threadData = threadSnapshot.data() ?? {};
    const jobId = readText(threadData.jobId);
    const jobSnapshot = jobId
      ? await adminDb.collection("jobs").doc(jobId).get()
      : null;
    const jobData = jobSnapshot?.exists ? (jobSnapshot.data() ?? {}) : {};
    const currentUserIsCustomer =
      readText(threadData.customerAuthUid) === decodedToken.uid;
    const contractorLabel =
      readText(threadData.businessName) ||
      readText(threadData.contractorName) ||
      readText(threadData.contractorId);
    const customerLabel = await getCustomerFirstName({
      threadData,
      jobData,
    });
    const thread = {
      threadId,
      jobId,
      displayName: currentUserIsCustomer
        ? contractorLabel || "Contractor"
        : customerLabel || "Customer",
      customerId: readText(threadData.customerId),
      contractorId: readText(threadData.contractorId),
      contractorName: readText(threadData.contractorName),
      businessName: readText(threadData.businessName),
      selectedTaskIds: readStringList(threadData.selectedTaskIds),
      selectedTaskLabels: readStringList(threadData.selectedTaskLabels),
      currentUserRole: currentUserIsCustomer ? "customer" : "contractor",
      status: readText(threadData.status),
      jobStatus: jobSnapshot?.exists ? readText(jobSnapshot.get("status")) : "",
    };

    await threadSnapshot.ref.set(
      {
        unreadBy: FieldValue.arrayRemove(decodedToken.uid),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, thread, messages });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Message list API failed:", {
      code,
      message,
      error,
    });

    return NextResponse.json(
      {
        code,
        message,
      },
      { status: code === "missing-token" ? 401 : 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertFirebaseAdminConfig();

    const token = getBearerToken(request.headers.get("authorization"));

    if (!token) {
      return NextResponse.json(
        {
          code: "missing-token",
          message: "Please sign in again.",
        },
        { status: 401 },
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const { threadId } = await context.params;
    const threadSnapshot = await getThreadForParticipant(
      threadId,
      decodedToken.uid,
    );

    if (!threadSnapshot) {
      return NextResponse.json(
        {
          code: "thread-not-found",
          message: "This conversation could not be found.",
        },
        { status: 404 },
      );
    }

    const body = (await request.json()) as MessageRequestBody;
    const text = readText(body.text);
    const attachments = readAttachments(body.attachments);

    if (!text && attachments.length === 0) {
      return NextResponse.json(
        {
          code: "empty-message",
          message: "Please enter a message or attach a photo before sending.",
        },
        { status: 400 },
      );
    }

    const senderRole =
      threadSnapshot.get("customerAuthUid") === decodedToken.uid
        ? "customer"
        : "contractor";
    const recipientAuthUid =
      senderRole === "customer"
        ? readText(threadSnapshot.get("contractorAuthUid"))
        : readText(threadSnapshot.get("customerAuthUid"));
    const recipientRole = senderRole === "customer" ? "contractor" : "customer";
    const messageDocument = threadSnapshot.ref.collection("items").doc();
    const messageId = messageDocument.id;

    await messageDocument.set({
      messageId,
      senderAuthUid: decodedToken.uid,
      senderRole,
      text,
      attachments,
      createdAt: FieldValue.serverTimestamp(),
      readBy: [decodedToken.uid],
    });

    const notificationMessage = text || "Photo attachment";
    const threadUpdate: Record<string, unknown> = {
      lastMessage: notificationMessage,
      lastMessageAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (recipientAuthUid) {
      threadUpdate.unreadBy = FieldValue.arrayUnion(recipientAuthUid);
    }

    await threadSnapshot.ref.set(threadUpdate, { merge: true });
    await createNotification({
      recipientAuthUid,
      recipientRole,
      type: "new_message",
      title: "New message",
      message:
        notificationMessage.length > 80
          ? `${notificationMessage.slice(0, 77)}...`
          : notificationMessage,
      jobId: readText(threadSnapshot.get("jobId")),
    });

    return NextResponse.json({ ok: true, messageId });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Message send API failed:", {
      code,
      message,
      error,
    });

    return NextResponse.json(
      {
        code,
        message,
      },
      { status: code === "missing-token" ? 401 : 500 },
    );
  }
}
