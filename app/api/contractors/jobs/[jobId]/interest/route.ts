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
    jobId: string;
  }>;
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

function getErrorDetails(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";
  const message = error instanceof Error ? error.message : "Unknown error";

  return { code, message };
}

async function findContractorProfile(firebaseUid: string) {
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

  const legacyDocumentSnapshot = await contractorsCollection
    .doc(firebaseUid)
    .get();

  return legacyDocumentSnapshot.exists ? legacyDocumentSnapshot : null;
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
    const contractorProfile = await findContractorProfile(decodedToken.uid);

    if (!contractorProfile) {
      return NextResponse.json(
        {
          code: "contractor-profile-required",
          message: "Please use a contractor account to express interest.",
        },
        { status: 403 },
      );
    }

    const { jobId } = await context.params;
    const jobDocument = adminDb.collection("jobs").doc(jobId);
    const jobSnapshot = await jobDocument.get();

    if (!jobSnapshot.exists || jobSnapshot.get("status") !== "open") {
      return NextResponse.json(
        {
          code: "job-not-open",
          message: "This job is no longer open.",
        },
        { status: 404 },
      );
    }

    const contractorId =
      readText(contractorProfile.get("contractorId")) || contractorProfile.id;
    const interestDocument = jobDocument
      .collection("interestedContractors")
      .doc(contractorId);
    const interestSnapshot = await interestDocument.get();

    if (interestSnapshot.exists) {
      await jobDocument.set(
        {
          interestedContractorIds: FieldValue.arrayUnion(contractorId),
          interestedContractorAuthUids: FieldValue.arrayUnion(decodedToken.uid),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return NextResponse.json({ ok: true, alreadySubmitted: true });
    }

    await interestDocument.set({
      contractorUid: decodedToken.uid,
      contractorId,
      contractorName: readText(contractorProfile.get("contactName")),
      businessName: readText(contractorProfile.get("businessName")),
      phoneNumber: readText(contractorProfile.get("phoneNumber")),
      city: readText(contractorProfile.get("city")),
      province: readText(contractorProfile.get("province")),
      verificationStatus: readText(contractorProfile.get("verificationStatus")),
      interestedAt: FieldValue.serverTimestamp(),
    });
    await jobDocument.set(
      {
        interestedContractorIds: FieldValue.arrayUnion(contractorId),
        interestedContractorAuthUids: FieldValue.arrayUnion(decodedToken.uid),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await createNotification({
      recipientAuthUid: readText(jobSnapshot.get("customerAuthUid")),
      recipientRole: "customer",
      type: "contractor_interest",
      title: "New contractor interest",
      message: `${
        readText(contractorProfile.get("businessName")) ||
        readText(contractorProfile.get("contactName")) ||
        "A contractor"
      } is interested in your job.`,
      jobId,
    });

    return NextResponse.json({ ok: true, alreadySubmitted: false });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Contractor job interest API failed:", {
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
