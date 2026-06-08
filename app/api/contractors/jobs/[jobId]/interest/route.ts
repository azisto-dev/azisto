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

type InterestRequestBody = {
  taskIds?: unknown;
};

const activeContractorStatuses = new Set([
  "hired_pending_contractor",
  "accepted",
  "hired",
  "on_the_way",
  "in_progress",
]);

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

async function getActiveContractorParentJobIds(contractorId: string) {
  const parentJobIds = new Set<string>();
  const jobsSnapshot = await adminDb
    .collection("jobs")
    .where("hiredContractorId", "==", contractorId)
    .get();
  const taskParentJobsSnapshot = await adminDb
    .collection("jobs")
    .where("hiredContractorIds", "array-contains", contractorId)
    .get();

  jobsSnapshot.docs.forEach((jobSnapshot) => {
    if (
      [
        "hired_pending_contractor",
        "accepted",
        "hired",
        "on_the_way",
        "in_progress",
      ].includes(readText(jobSnapshot.get("status")))
    ) {
      parentJobIds.add(readText(jobSnapshot.get("jobId")) || jobSnapshot.id);
    }
  });

  await Promise.all(
    taskParentJobsSnapshot.docs.map(async (jobSnapshot) => {
      const tasksSnapshot = await jobSnapshot.ref.collection("tasks").get();

      tasksSnapshot.docs.forEach((taskSnapshot) => {
        if (
          readText(taskSnapshot.get("hiredContractorId")) === contractorId &&
          [
            "hired_pending_contractor",
            "accepted",
            "hired",
            "on_the_way",
            "in_progress",
          ].includes(readText(taskSnapshot.get("status")))
        ) {
          parentJobIds.add(readText(taskSnapshot.get("parentJobId")) || jobSnapshot.id);
        }
      });
    }),
  );

  return parentJobIds;
}

function getContractorServiceSelections(contractorData: Record<string, unknown>) {
  const selectedServices = new Set(readStringList(contractorData.selectedServices));
  const selectedSubcategoriesByService =
    typeof contractorData.selectedSubcategoriesByService === "object" &&
    contractorData.selectedSubcategoriesByService !== null
      ? (contractorData.selectedSubcategoriesByService as Record<string, unknown>)
      : {};

  return { selectedServices, selectedSubcategoriesByService };
}

function canPerformTask(
  contractorData: Record<string, unknown>,
  taskData: Record<string, unknown>,
) {
  const { selectedServices, selectedSubcategoriesByService } =
    getContractorServiceSelections(contractorData);
  const category = readText(taskData.category);
  const subcategory = readText(taskData.subcategory);
  const savedSubcategories = readStringList(selectedSubcategoriesByService[category]);

  if (selectedServices.size === 0 || !category || !selectedServices.has(category)) {
    return false;
  }

  if (savedSubcategories.length > 0) {
    return savedSubcategories.includes(subcategory);
  }

  return true;
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
    const body = (await request.json().catch(() => ({}))) as InterestRequestBody;
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

    if (
      !jobSnapshot.exists ||
      (jobSnapshot.get("status") !== "open" &&
        jobSnapshot.get("overallStatus") !== "partially_hired")
    ) {
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
    const activeParentJobIds = await getActiveContractorParentJobIds(contractorId);

    if (
      Array.from(activeParentJobIds).some(
        (activeParentJobId) => activeParentJobId && activeParentJobId !== jobId,
      )
    ) {
      return NextResponse.json(
        {
          code: "active-job-exists",
          message:
            "You already have an active job. Complete it before accepting a new job.",
        },
        { status: 409 },
      );
    }

    const requestedTaskIds = Array.from(new Set(readStringList(body.taskIds)));
    let tasksSnapshot = await jobDocument.collection("tasks").get();

    if (tasksSnapshot.empty) {
      const selectedSubcategories = readStringList(
        jobSnapshot.get("selectedSubcategories"),
      );
      const selectedServiceCategory = readText(
        jobSnapshot.get("selectedServiceCategory"),
      );
      const taskSubcategories =
        selectedSubcategories.length > 0
          ? selectedSubcategories
          : [selectedServiceCategory || "General task"];
      const batch = adminDb.batch();

      taskSubcategories.forEach((subcategory, index) => {
        const taskId = `${jobId}-${index + 1}`;

        batch.set(jobDocument.collection("tasks").doc(taskId), {
          taskId,
          parentJobId: jobId,
          category: selectedServiceCategory,
          subcategory,
          jobDescription: readText(jobSnapshot.get("jobDescription")),
          city: readText(jobSnapshot.get("city")),
          province: readText(jobSnapshot.get("province")),
          postalCode: readText(jobSnapshot.get("postalCode")),
          preferredDate: readText(jobSnapshot.get("preferredDate")),
          preferredTime: readText(jobSnapshot.get("preferredTime")),
          urgency: readText(jobSnapshot.get("urgency")) || "Flexible",
          status: "open",
          interestedContractorIds: [],
          interestedContractorAuthUids: [],
          hiredContractorId: null,
          hiredContractorAuthUid: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      tasksSnapshot = await jobDocument.collection("tasks").get();
    }

    if (requestedTaskIds.length === 0) {
      return NextResponse.json(
        {
          code: "task-selection-required",
          message: "Please choose at least one task before submitting interest.",
        },
        { status: 400 },
      );
    }

    const openTasks = tasksSnapshot.docs.filter(
      (taskSnapshot) => readText(taskSnapshot.get("status")) === "open",
    );
    const selectedTasks = openTasks.filter((taskSnapshot) => {
      const taskId = readText(taskSnapshot.get("taskId")) || taskSnapshot.id;

      if (!requestedTaskIds.includes(taskId)) {
        return false;
      }

      return canPerformTask(contractorProfile.data() ?? {}, taskSnapshot.data());
    });

    if (selectedTasks.length !== requestedTaskIds.length) {
      return NextResponse.json(
        {
          code: "no-open-matching-tasks",
          message:
            "Please choose only open tasks that match the services saved in your contractor profile.",
        },
        { status: 400 },
      );
    }

    const interestDocument = jobDocument
      .collection("interestedContractors")
      .doc(contractorId);
    const interestSnapshot = await interestDocument.get();
    const selectedTaskIds = selectedTasks.map(
      (taskSnapshot) => readText(taskSnapshot.get("taskId")) || taskSnapshot.id,
    );
    const selectedTaskLabels = selectedTasks.map(
      (taskSnapshot) =>
        readText(taskSnapshot.get("subcategory")) ||
        readText(taskSnapshot.get("category")) ||
        readText(taskSnapshot.get("taskId")) ||
        taskSnapshot.id,
    );

    if (interestSnapshot.exists) {
      await Promise.all(
        selectedTasks.map((taskSnapshot) =>
          taskSnapshot.ref.collection("interestedContractors").doc(contractorId).set(
            {
              contractorUid: decodedToken.uid,
              contractorId,
              contractorName: readText(contractorProfile.get("contactName")),
              businessName: readText(contractorProfile.get("businessName")),
              phoneNumber: readText(contractorProfile.get("phoneNumber")),
              city: readText(contractorProfile.get("city")),
              province: readText(contractorProfile.get("province")),
              verificationStatus: readText(contractorProfile.get("verificationStatus")),
              taskId: readText(taskSnapshot.get("taskId")) || taskSnapshot.id,
              taskLabel:
                readText(taskSnapshot.get("subcategory")) ||
                readText(taskSnapshot.get("category")),
              interestedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          ),
        ),
      );
      await Promise.all(
        selectedTasks.map((taskSnapshot) =>
          taskSnapshot.ref.set(
            {
              interestedContractorIds: FieldValue.arrayUnion(contractorId),
              interestedContractorAuthUids: FieldValue.arrayUnion(decodedToken.uid),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          ),
        ),
      );
      await jobDocument.set(
        {
          interestedContractorIds: FieldValue.arrayUnion(contractorId),
          interestedContractorAuthUids: FieldValue.arrayUnion(decodedToken.uid),
          ...(selectedTaskIds.length > 0
            ? {
                [`selectedTaskIdsByContractor.${contractorId}`]:
                  FieldValue.arrayUnion(...selectedTaskIds),
              }
            : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      await interestDocument.set(
        {
          ...(selectedTaskIds.length > 0
            ? { selectedTaskIds: FieldValue.arrayUnion(...selectedTaskIds) }
            : {}),
          ...(selectedTaskLabels.length > 0
            ? { selectedTaskLabels: FieldValue.arrayUnion(...selectedTaskLabels) }
            : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return NextResponse.json({
        ok: true,
        alreadySubmitted: true,
        selectedTaskIds,
      });
    }

    const contractorInterestData = {
      contractorUid: decodedToken.uid,
      contractorId,
      contractorName: readText(contractorProfile.get("contactName")),
      businessName: readText(contractorProfile.get("businessName")),
      phoneNumber: readText(contractorProfile.get("phoneNumber")),
      city: readText(contractorProfile.get("city")),
      province: readText(contractorProfile.get("province")),
      verificationStatus: readText(contractorProfile.get("verificationStatus")),
      selectedTaskIds,
      selectedTaskLabels,
      interestedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await interestDocument.set(contractorInterestData);
    await Promise.all(
      selectedTasks.map((taskSnapshot) =>
        taskSnapshot.ref.collection("interestedContractors").doc(contractorId).set({
          ...contractorInterestData,
          taskId: readText(taskSnapshot.get("taskId")) || taskSnapshot.id,
          taskLabel:
            readText(taskSnapshot.get("subcategory")) ||
            readText(taskSnapshot.get("category")),
        }),
      ),
    );
    await Promise.all(
      selectedTasks.map((taskSnapshot) =>
        taskSnapshot.ref.set(
          {
            interestedContractorIds: FieldValue.arrayUnion(contractorId),
            interestedContractorAuthUids: FieldValue.arrayUnion(decodedToken.uid),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
      ),
    );
    await jobDocument.set(
      {
        interestedContractorIds: FieldValue.arrayUnion(contractorId),
        interestedContractorAuthUids: FieldValue.arrayUnion(decodedToken.uid),
        ...(selectedTaskIds.length > 0
          ? {
              [`selectedTaskIdsByContractor.${contractorId}`]:
                FieldValue.arrayUnion(...selectedTaskIds),
            }
          : {}),
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

    return NextResponse.json({
      ok: true,
      alreadySubmitted: false,
      selectedTaskIds,
    });
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

export async function DELETE(request: NextRequest, context: RouteContext) {
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
          message: "Please use a contractor account to update job interest.",
        },
        { status: 403 },
      );
    }

    const { jobId } = await context.params;
    const contractorId =
      readText(contractorProfile.get("contractorId")) || contractorProfile.id;
    const jobDocument = adminDb.collection("jobs").doc(jobId);
    const [jobSnapshot, tasksSnapshot] = await Promise.all([
      jobDocument.get(),
      jobDocument.collection("tasks").get(),
    ]);

    if (!jobSnapshot.exists) {
      return NextResponse.json(
        {
          code: "job-not-found",
          message: "This job is no longer available.",
        },
        { status: 404 },
      );
    }

    const contractorHasAcceptedTask = tasksSnapshot.docs.some(
      (taskSnapshot) =>
        readText(taskSnapshot.get("hiredContractorId")) === contractorId &&
        activeContractorStatuses.has(readText(taskSnapshot.get("status"))),
    );
    const contractorHasAcceptedParent =
      readText(jobSnapshot.get("hiredContractorId")) === contractorId &&
      activeContractorStatuses.has(readText(jobSnapshot.get("status")));

    if (contractorHasAcceptedTask || contractorHasAcceptedParent) {
      return NextResponse.json(
        {
          code: "job-already-accepted",
          message:
            "Accepted jobs are managed from the Active Jobs tab in your dashboard.",
        },
        { status: 409 },
      );
    }

    const batch = adminDb.batch();

    batch.update(jobDocument, {
      interestedContractorIds: FieldValue.arrayRemove(contractorId),
      interestedContractorAuthUids: FieldValue.arrayRemove(decodedToken.uid),
      [`selectedTaskIdsByContractor.${contractorId}`]: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.delete(
      jobDocument.collection("interestedContractors").doc(contractorId),
    );

    tasksSnapshot.docs.forEach((taskSnapshot) => {
      batch.update(taskSnapshot.ref, {
        interestedContractorIds: FieldValue.arrayRemove(contractorId),
        interestedContractorAuthUids: FieldValue.arrayRemove(decodedToken.uid),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.delete(
        taskSnapshot.ref
          .collection("interestedContractors")
          .doc(contractorId),
      );
    });

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Remove contractor job interest API failed:", {
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
