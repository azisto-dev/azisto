import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type ThreadRequestBody = {
  jobId?: unknown;
  contractorAuthUid?: unknown;
  contractorId?: unknown;
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

async function findContractorProfileByAuthUid(firebaseUid: string) {
  const contractorsCollection = adminDb.collection("contractors");
  const authUidSnapshot = await contractorsCollection
    .where("authUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!authUidSnapshot.empty) {
    return authUidSnapshot.docs[0];
  }

  const legacyFirebaseUidSnapshot = await contractorsCollection
    .where("firebaseUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!legacyFirebaseUidSnapshot.empty) {
    return legacyFirebaseUidSnapshot.docs[0];
  }

  const legacyDocumentSnapshot = await contractorsCollection.doc(firebaseUid).get();

  return legacyDocumentSnapshot.exists ? legacyDocumentSnapshot : null;
}

async function findContractorProfileByContractorId(contractorId: string) {
  if (!contractorId) {
    return null;
  }

  const directDocumentSnapshot = await adminDb
    .collection("contractors")
    .doc(contractorId)
    .get();

  if (directDocumentSnapshot.exists) {
    return directDocumentSnapshot;
  }

  const contractorIdSnapshot = await adminDb
    .collection("contractors")
    .where("contractorId", "==", contractorId)
    .limit(1)
    .get();

  return contractorIdSnapshot.empty ? null : contractorIdSnapshot.docs[0];
}

async function findContractorProfile(body: ThreadRequestBody, callerUid: string) {
  const contractorId = readText(body.contractorId);
  const contractorAuthUid = readText(body.contractorAuthUid);

  if (contractorId) {
    return findContractorProfileByContractorId(contractorId);
  }

  if (contractorAuthUid) {
    return findContractorProfileByAuthUid(contractorAuthUid);
  }

  return findContractorProfileByAuthUid(callerUid);
}

async function serializeThread(
  data: Record<string, unknown>,
  currentUserUid: string,
) {
  const currentUserIsCustomer = readText(data.customerAuthUid) === currentUserUid;
  const contractorLabel =
    readText(data.businessName) ||
    readText(data.contractorName) ||
    readText(data.contractorId);
  const customerLabel = readText(data.customerId);
  const jobId = readText(data.jobId);
  const jobSnapshot = jobId
    ? await adminDb.collection("jobs").doc(jobId).get()
    : null;

  return {
    threadId: readText(data.threadId),
    jobId,
    displayName: currentUserIsCustomer
      ? contractorLabel || "Contractor"
      : customerLabel || "Customer",
    customerId: readText(data.customerId),
    contractorId: readText(data.contractorId),
    contractorName: readText(data.contractorName),
    businessName: readText(data.businessName),
    lastMessage: readText(data.lastMessage),
    lastMessageAt: serializeTimestamp(data.lastMessageAt),
    status: readText(data.status),
    jobStatus: jobSnapshot?.exists ? readText(jobSnapshot.get("status")) : "",
    unreadCount: 0,
    updatedAt: serializeTimestamp(data.updatedAt),
  };
}

export async function POST(request: NextRequest) {
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
    const body = (await request.json()) as ThreadRequestBody;
    const jobId = readText(body.jobId);

    if (!jobId) {
      return NextResponse.json(
        {
          code: "missing-job-id",
          message: "A job ID is required to start a conversation.",
        },
        { status: 400 },
      );
    }

    const jobSnapshot = await adminDb.collection("jobs").doc(jobId).get();

    if (!jobSnapshot.exists) {
      return NextResponse.json(
        {
          code: "job-not-found",
          message: "This job could not be found.",
        },
        { status: 404 },
      );
    }

    const contractorProfile = await findContractorProfile(body, decodedToken.uid);

    if (!contractorProfile) {
      return NextResponse.json(
        {
          code: "contractor-profile-required",
          message: "A contractor profile is required to start this conversation.",
        },
        { status: 403 },
      );
    }

    const customerAuthUid = readText(jobSnapshot.get("customerAuthUid"));
    const customerId = readText(jobSnapshot.get("customerId"));
    const contractorAuthUid =
      readText(contractorProfile.get("authUid")) ||
      readText(contractorProfile.get("firebaseUid"));
    const contractorId =
      readText(contractorProfile.get("contractorId")) || contractorProfile.id;
    const callerIsCustomer = decodedToken.uid === customerAuthUid;
    const callerIsContractor = decodedToken.uid === contractorAuthUid;
    const jobStatus = readText(jobSnapshot.get("status"));
    const callerIsHiredContractor =
      decodedToken.uid === readText(jobSnapshot.get("hiredContractorAuthUid"));

    if (!callerIsCustomer && !callerIsContractor) {
      return NextResponse.json(
        {
          code: "thread-access-denied",
          message: "You can only start conversations for your own jobs or contractor profile.",
        },
        { status: 403 },
      );
    }

    if (jobStatus !== "open" && !callerIsCustomer && !callerIsHiredContractor) {
      return NextResponse.json(
        {
          code: "thread-access-denied",
          message: "This job is only available to the customer and hired contractor.",
        },
        { status: 403 },
      );
    }

    const threadId = `${jobId}_${contractorId}`;
    const threadDocument = adminDb.collection("messages").doc(threadId);
    const threadSnapshot = await threadDocument.get();

    if (threadSnapshot.exists) {
      return NextResponse.json({ ok: true, threadId });
    }

    await threadDocument.set({
      threadId,
      jobId,
      customerAuthUid,
      customerId,
      contractorAuthUid,
      contractorId,
      contractorName: readText(contractorProfile.get("contactName")),
      businessName: readText(contractorProfile.get("businessName")),
      participants: [customerAuthUid, contractorAuthUid],
      lastMessage: "",
      lastMessageAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      status: "open",
    });

    return NextResponse.json({ ok: true, threadId });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Message thread create API failed:", {
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

export async function GET(request: NextRequest) {
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
    const threadsSnapshot = await adminDb
      .collection("messages")
      .where("participants", "array-contains", decodedToken.uid)
      .get();
    const threads = (
      await Promise.all(
        threadsSnapshot.docs.map((documentSnapshot) =>
          serializeThread(documentSnapshot.data(), decodedToken.uid),
        ),
      )
    ).sort((firstThread, secondThread) =>
      secondThread.updatedAt.localeCompare(firstThread.updatedAt),
    );

    return NextResponse.json({ ok: true, threads });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Message threads list API failed:", {
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
