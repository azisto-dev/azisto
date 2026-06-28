import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";
import { readJobProofPhotos } from "@/lib/jobProofPhotos";
import {
  firebaseQuotaMessage,
  isQuotaExceededMessage,
} from "@/lib/apiErrors";
import {
  getJobExpiresAtMs,
  isJobExpired,
  isJobExpiringSoon,
} from "@/lib/jobExpiry";
import { getParentJobStatus } from "@/lib/jobLifecycle";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";

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

function readSchedule(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const data = value as Record<string, unknown>;

  return {
    mode: readText(data.mode),
    date: readText(data.date),
    timeWindow: readText(data.timeWindow),
    urgency: readText(data.urgency),
  };
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

function serializeExpiry(data: Record<string, unknown>) {
  const expiresAtMs = getJobExpiresAtMs(data);
  return expiresAtMs ? new Date(expiresAtMs).toISOString() : "";
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
    return readText(authUidSnapshot.docs[0].get("customerId")) || authUidSnapshot.docs[0].id;
  }

  const legacyFirebaseUidSnapshot = await customersCollection
    .where("firebaseUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!legacyFirebaseUidSnapshot.empty) {
    return (
      readText(legacyFirebaseUidSnapshot.docs[0].get("customerId")) ||
      legacyFirebaseUidSnapshot.docs[0].id
    );
  }

  const legacyDocumentSnapshot = await customersCollection.doc(firebaseUid).get();

  return legacyDocumentSnapshot.exists
    ? readText(legacyDocumentSnapshot.get("customerId")) ||
        legacyDocumentSnapshot.id
    : "";
}

function serializeJob(data: Record<string, unknown>, reviewed = false) {
  return {
    jobId: readText(data.jobId),
    customerId: readText(data.customerId),
    selectedServiceCategory: readText(data.selectedServiceCategory),
    selectedSubcategories: readStringList(data.selectedSubcategories),
    city: readText(data.city),
    province: readText(data.province),
    scheduleMode: readText(data.scheduleMode),
    preferredDate: readText(data.preferredDate),
    preferredTime: readText(data.preferredTime),
    preferredTimeWindow: readText(data.preferredTimeWindow),
    urgency: readText(data.urgency),
    schedule: readSchedule(data.schedule),
    status: readText(data.status),
    contractorDecisionStatus: readText(data.contractorDecisionStatus),
    matchingStatus: readText(data.matchingStatus),
    hiredContractorId: readText(data.hiredContractorId),
    hiredContractorName: readText(data.hiredContractorName),
    hiredBusinessName: readText(data.hiredBusinessName),
    beforePhotos: readJobProofPhotos(data.beforePhotos),
    afterPhotos: readJobProofPhotos(data.afterPhotos),
    reviewed,
    expiresAt: serializeExpiry(data),
    expiryNoticeSentAt: serializeTimestamp(data.expiryNoticeSentAt),
    repostedAt: serializeTimestamp(data.repostedAt),
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
}

function serializeTask(data: Record<string, unknown>, reviewed = false) {
  return {
    taskId: readText(data.taskId),
    parentJobId: readText(data.parentJobId),
    category: readText(data.category),
    subcategory: readText(data.subcategory),
    status: readText(data.status),
    contractorDecisionStatus: readText(data.contractorDecisionStatus),
    hiredContractorId: readText(data.hiredContractorId),
    hiredContractorAuthUid: readText(data.hiredContractorAuthUid),
    beforePhotos: readJobProofPhotos(data.beforePhotos),
    afterPhotos: readJobProofPhotos(data.afterPhotos),
    reviewed,
    expiresAt: serializeExpiry(data),
    repostedAt: serializeTimestamp(data.repostedAt),
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
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
    const customerId = await findCustomerId(decodedToken.uid);

    if (!customerId) {
      return NextResponse.json(
        {
          code: "customer-profile-required",
          message: "Please use a customer account to view your jobs.",
        },
        { status: 403 },
      );
    }

    const [jobsSnapshot, reviewsSnapshot] = await Promise.all([
      adminDb
        .collection("jobs")
        .where("customerAuthUid", "==", decodedToken.uid)
        .get(),
      adminDb
        .collection("reviews")
        .where("customerAuthUid", "==", decodedToken.uid)
        .get(),
    ]);
    const reviewedTargets = new Set(
      reviewsSnapshot.docs.map(
        (reviewSnapshot) =>
          `${readText(reviewSnapshot.get("jobId"))}:${readText(
            reviewSnapshot.get("taskId"),
          )}`,
      ),
    );
    const jobs = (
      await Promise.all(
        jobsSnapshot.docs.map(async (documentSnapshot) => {
          const tasksSnapshot = await documentSnapshot.ref.collection("tasks").get();
          const jobId =
            readText(documentSnapshot.get("jobId")) || documentSnapshot.id;
          const parentData = documentSnapshot.data();
          const taskDataById = new Map(
            tasksSnapshot.docs.map((taskSnapshot) => [
              taskSnapshot.id,
              taskSnapshot.data(),
            ]),
          );
          const expiryWrites: Promise<FirebaseFirestore.WriteResult>[] = [];

          tasksSnapshot.docs.forEach((taskSnapshot) => {
            const taskData = taskSnapshot.data();

            if (
              readText(taskData.status) === "open" &&
              isJobExpired({ ...parentData, ...taskData })
            ) {
              taskDataById.set(taskSnapshot.id, {
                ...taskData,
                status: "expired",
                matchingStatus: "closed",
              });
              expiryWrites.push(
                taskSnapshot.ref.set(
                  {
                    status: "expired",
                    matchingStatus: "closed",
                    expiredAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                  },
                  { merge: true },
                ),
              );
            }
          });

          let effectiveParentData = parentData;
          const effectiveTaskStatuses = tasksSnapshot.docs.map(
            (taskSnapshot) =>
              readText(taskDataById.get(taskSnapshot.id)?.status) || "open",
          );

          if (effectiveTaskStatuses.length > 0) {
            const nextParentStatus = getParentJobStatus(effectiveTaskStatuses);

            if (
              nextParentStatus.status !== readText(parentData.status) ||
              nextParentStatus.overallStatus !==
                readText(parentData.overallStatus)
            ) {
              effectiveParentData = {
                ...parentData,
                ...nextParentStatus,
              };
              expiryWrites.push(
                documentSnapshot.ref.set(
                  {
                    ...nextParentStatus,
                    ...(nextParentStatus.status === "expired"
                      ? { expiredAt: FieldValue.serverTimestamp() }
                      : {}),
                    updatedAt: FieldValue.serverTimestamp(),
                  },
                  { merge: true },
                ),
              );
            }
          } else if (
            readText(parentData.status) === "open" &&
            isJobExpired(parentData)
          ) {
            effectiveParentData = {
              ...parentData,
              status: "expired",
              overallStatus: "expired",
              matchingStatus: "closed",
            };
            expiryWrites.push(
              documentSnapshot.ref.set(
                {
                  status: "expired",
                  overallStatus: "expired",
                  matchingStatus: "closed",
                  expiredAt: FieldValue.serverTimestamp(),
                  updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
              ),
            );
          }

          if (
            ["open", "partially_hired"].includes(
              readText(effectiveParentData.status),
            ) &&
            isJobExpiringSoon(effectiveParentData) &&
            !effectiveParentData.expiryNoticeSentAt
          ) {
            await createNotification({
              dedupeKey: `job_expiry_notice_${jobId}`,
              recipientAuthUid: decodedToken.uid,
              recipientRole: "customer",
              type: "job_expiry_notice",
              title: "Job expiring soon",
              message:
                "Your posted job is expiring soon. Do you want to repost it or make any changes?",
              jobId,
            });
            await documentSnapshot.ref.set(
              {
                expiryNoticeSentAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true },
            );
            effectiveParentData = {
              ...effectiveParentData,
              expiryNoticeSentAt: new Date(),
            };
          }

          if (expiryWrites.length > 0) {
            await Promise.all(expiryWrites);
          }

          const tasks = tasksSnapshot.docs
            .map((taskSnapshot) => {
              const taskId =
                readText(taskSnapshot.get("taskId")) || taskSnapshot.id;
              return serializeTask(
                taskDataById.get(taskSnapshot.id) ?? taskSnapshot.data(),
                reviewedTargets.has(`${jobId}:${taskId}`),
              );
            })
            .sort((firstTask, secondTask) =>
              firstTask.taskId.localeCompare(secondTask.taskId),
            );
          const completedTasks = tasks.filter(
            (task) => task.status === "completed" && task.hiredContractorId,
          );
          const reviewed =
            reviewedTargets.has(`${jobId}:`) ||
            (completedTasks.length > 0 &&
              completedTasks.every((task) => task.reviewed));

          return {
            ...serializeJob(effectiveParentData, reviewed),
            overallStatus: readText(effectiveParentData.overallStatus),
            requiresMultipleContractors:
              documentSnapshot.get("requiresMultipleContractors") === true,
            taskCount:
              typeof documentSnapshot.get("taskCount") === "number"
                ? documentSnapshot.get("taskCount")
                : tasks.length,
            tasks,
          };
        }),
      )
    )
      .sort((firstJob, secondJob) =>
        secondJob.createdAt.localeCompare(firstJob.createdAt),
      );

    return NextResponse.json({ ok: true, jobs });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Customer jobs API failed:", {
      code,
      message,
      error,
    });

    if (isQuotaExceededMessage(`${code} ${message}`)) {
      return NextResponse.json(
        { code: "resource-exhausted", message: firebaseQuotaMessage },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        code,
        message,
      },
      { status: code === "missing-token" ? 401 : 500 },
    );
  }
}
