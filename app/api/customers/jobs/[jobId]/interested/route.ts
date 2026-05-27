import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";

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

function readStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
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

async function findCustomerId(firebaseUid: string) {
  const customersCollection = adminDb.collection("customers");
  const authUidSnapshot = await customersCollection
    .where("authUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!authUidSnapshot.empty) {
    const customerId = authUidSnapshot.docs[0].get("customerId");
    return typeof customerId === "string" ? customerId : authUidSnapshot.docs[0].id;
  }

  const legacyFirebaseUidSnapshot = await customersCollection
    .where("firebaseUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!legacyFirebaseUidSnapshot.empty) {
    const customerId = legacyFirebaseUidSnapshot.docs[0].get("customerId");
    return typeof customerId === "string"
      ? customerId
      : legacyFirebaseUidSnapshot.docs[0].id;
  }

  const legacyDocumentSnapshot = await customersCollection.doc(firebaseUid).get();

  if (!legacyDocumentSnapshot.exists) {
    return "";
  }

  const customerId = legacyDocumentSnapshot.get("customerId");
  return typeof customerId === "string" ? customerId : legacyDocumentSnapshot.id;
}

function serializeInterestedContractor(data: Record<string, unknown>) {
  return {
    contractorId: readText(data.contractorId),
    contractorName: readText(data.contractorName),
    businessName: readText(data.businessName),
    city: readText(data.city),
    province: readText(data.province),
    verificationStatus: readText(data.verificationStatus),
    taskIds: readStringList(data.selectedTaskIds),
    taskLabels: readStringList(data.selectedTaskLabels),
    interestedAt: serializeTimestamp(data.interestedAt),
  };
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
    const customerId = await findCustomerId(decodedToken.uid);

    if (!customerId) {
      return NextResponse.json(
        {
          code: "customer-profile-required",
          message: "Please use a customer account to view interested contractors.",
        },
        { status: 403 },
      );
    }

    const { jobId } = await context.params;
    const jobDocument = adminDb.collection("jobs").doc(jobId);
    const jobSnapshot = await jobDocument.get();

    if (!jobSnapshot.exists) {
      return NextResponse.json(
        {
          code: "job-not-found",
          message: "This job could not be found.",
        },
        { status: 404 },
      );
    }

    const ownsJob =
      jobSnapshot.get("customerAuthUid") === decodedToken.uid ||
      jobSnapshot.get("customerId") === customerId;

    if (!ownsJob) {
      return NextResponse.json(
        {
          code: "job-access-denied",
          message: "You can only view contractors for your own jobs.",
        },
        { status: 403 },
      );
    }

    const interestedSnapshot = await jobDocument
      .collection("interestedContractors")
      .get();
    const groupedContractors = new Map<
      string,
      ReturnType<typeof serializeInterestedContractor>
    >();

    interestedSnapshot.docs.forEach((documentSnapshot) => {
      const contractor = serializeInterestedContractor(documentSnapshot.data());

      if (contractor.contractorId) {
        groupedContractors.set(contractor.contractorId, contractor);
      }
    });

    const tasksSnapshot = await jobDocument.collection("tasks").get();

    await Promise.all(
      tasksSnapshot.docs.map(async (taskSnapshot) => {
        const taskData = taskSnapshot.data();
        const taskId = readText(taskData.taskId) || taskSnapshot.id;
        const taskLabel =
          readText(taskData.subcategory) ||
          readText(taskData.category) ||
          taskId;
        const taskInterestedSnapshot = await taskSnapshot.ref
          .collection("interestedContractors")
          .get();

        taskInterestedSnapshot.docs.forEach((documentSnapshot) => {
          const contractor = serializeInterestedContractor(
            documentSnapshot.data(),
          );

          if (!contractor.contractorId) {
            return;
          }

          const existingContractor =
            groupedContractors.get(contractor.contractorId) ?? contractor;
          const taskIds = new Set(existingContractor.taskIds);
          const taskLabels = new Set(existingContractor.taskLabels);

          taskIds.add(taskId);
          taskLabels.add(taskLabel);

          groupedContractors.set(contractor.contractorId, {
            ...existingContractor,
            taskIds: Array.from(taskIds),
            taskLabels: Array.from(taskLabels),
            interestedAt:
              existingContractor.interestedAt || contractor.interestedAt,
          });
        });
      }),
    );

    const interestedContractors = Array.from(groupedContractors.values())
      .sort((firstContractor, secondContractor) =>
        secondContractor.interestedAt.localeCompare(
          firstContractor.interestedAt,
        ),
      );

    return NextResponse.json({ ok: true, interestedContractors });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Customer interested contractors API failed:", {
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
