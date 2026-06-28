import { FieldValue } from "firebase-admin/firestore";
import type { MulticastMessage } from "firebase-admin/messaging";
import { adminDb, adminMessaging } from "@/lib/firebaseAdmin";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  type: string;
  jobId?: string;
  threadId?: string;
  contractorId?: string;
};

const invalidTokenCodes = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
  "messaging/invalid-argument",
]);

function stringifyData(payload: PushPayload) {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]),
  );
}

async function getActiveTokenDocs(authUid: string) {
  const snapshot = await adminDb
    .collection("pushTokens")
    .where("authUid", "==", authUid)
    .get();

  return snapshot.docs.filter(
    (doc) =>
      doc.get("platform") === "web" && !doc.get("disabledAt") && doc.get("token"),
  );
}

async function disableToken(tokenId: string, reason: string) {
  await adminDb.collection("pushTokens").doc(tokenId).set(
    {
      disabledAt: FieldValue.serverTimestamp(),
      disabledReason: reason,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function sendChunk(
  docs: Awaited<ReturnType<typeof getActiveTokenDocs>>,
  payload: PushPayload,
) {
  if (docs.length === 0) {
    return;
  }

  const message: MulticastMessage = {
    tokens: docs.map((doc) => String(doc.get("token"))),
    data: stringifyData(payload),
    webpush: {
      fcmOptions: {
        link: payload.url,
      },
    },
  };

  const response = await adminMessaging.sendEachForMulticast(message);
  const writes: Array<Promise<unknown>> = [];

  response.responses.forEach((result, index) => {
    const tokenDoc = docs[index];

    if (result.success) {
      writes.push(
        tokenDoc.ref.set(
          {
            lastUsedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
      );
      return;
    }

    const code = result.error?.code ?? "messaging/send-failed";

    if (invalidTokenCodes.has(code)) {
      writes.push(disableToken(tokenDoc.id, code));
    }
  });

  await Promise.all(writes);
}

export async function sendPushToUser(authUid: string, payload: PushPayload) {
  if (!authUid) {
    return;
  }

  try {
    const docs = await getActiveTokenDocs(authUid);

    for (let index = 0; index < docs.length; index += 500) {
      await sendChunk(docs.slice(index, index + 500), payload);
    }
  } catch (error) {
    console.error("Push notification send failed:", {
      authUid,
      type: payload.type,
      error,
    });
  }
}

export async function sendPushToMany(
  authUids: string[],
  payload: PushPayload,
) {
  const uniqueAuthUids = Array.from(new Set(authUids.filter(Boolean)));

  await Promise.all(
    uniqueAuthUids.map((authUid) => sendPushToUser(authUid, payload)),
  );
}
