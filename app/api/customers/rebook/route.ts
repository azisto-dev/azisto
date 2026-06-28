import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type TaskData = {
  taskId: string;
  category: string;
  subcategory: string;
  subcategoryGroup: string;
  status: string;
  hiredContractorId: string;
};

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return "";
  }

  return authorizationHeader.slice("Bearer ".length).trim();
}

function getErrorDetails(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";
  const message = error instanceof Error ? error.message : "Unknown error";

  return { code, message };
}

function getTimestampMs(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }

  const serialized = serializeTimestamp(value);
  return serialized ? new Date(serialized).getTime() : 0;
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

function readRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

async function findCustomerProfile(firebaseUid: string) {
  const customersCollection = adminDb.collection("customers");
  const authUidSnapshot = await customersCollection
    .where("authUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!authUidSnapshot.empty) {
    return authUidSnapshot.docs[0];
  }

  const firebaseUidSnapshot = await customersCollection
    .where("firebaseUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!firebaseUidSnapshot.empty) {
    return firebaseUidSnapshot.docs[0];
  }

  const legacyDocumentSnapshot = await customersCollection.doc(firebaseUid).get();

  return legacyDocumentSnapshot.exists ? legacyDocumentSnapshot : null;
}

async function getCustomerProfileContext(firebaseUid: string) {
  const customerSnapshot = await findCustomerProfile(firebaseUid);

  if (!customerSnapshot) {
    return null;
  }

  const customerId = readText(customerSnapshot.get("customerId")) || customerSnapshot.id;

  return {
    customerId,
    customerSnapshot,
    customerReference: adminDb.collection("customers").doc(customerId),
  };
}

function serializeTaskData(
  taskSnapshot: FirebaseFirestore.QueryDocumentSnapshot,
): TaskData {
  const data = taskSnapshot.data();

  return {
    taskId: readText(data.taskId) || taskSnapshot.id,
    category: readText(data.category),
    subcategory: readText(data.subcategory),
    subcategoryGroup: readText(data.subcategoryGroup),
    status: readText(data.status),
    hiredContractorId: readText(data.hiredContractorId),
  };
}

function readSubcategoryGroups(value: unknown) {
  if (!Array.isArray(value)) {
    return new Map<string, string>();
  }

  return new Map(
    value
      .map((item) => {
        const record = readRecord(item);
        const subcategory = readText(record.subcategory);
        const group = readText(record.group);

        return subcategory && group ? [subcategory, group] : null;
      })
      .filter((item): item is [string, string] => Boolean(item)),
  );
}

async function getJobWithTasks(jobId: string) {
  const jobSnapshot = await adminDb.collection("jobs").doc(jobId).get();

  if (!jobSnapshot.exists) {
    return null;
  }

  const tasksSnapshot = await jobSnapshot.ref.collection("tasks").get();

  return {
    jobSnapshot,
    jobData: jobSnapshot.data() ?? {},
    tasks: tasksSnapshot.docs.map(serializeTaskData),
  };
}

function taskBelongsToContractor(task: TaskData, contractorId: string) {
  return contractorId ? task.hiredContractorId === contractorId : true;
}

function getRebookTasks(
  jobData: Record<string, unknown>,
  tasks: TaskData[],
  contractorId: string,
) {
  const completedTasks = tasks.filter(
    (task) =>
      taskBelongsToContractor(task, contractorId) && task.status === "completed",
  );
  const contractorTasks = tasks.filter((task) =>
    taskBelongsToContractor(task, contractorId),
  );
  const selectedTasks =
    completedTasks.length > 0
      ? completedTasks
      : contractorTasks.length > 0
        ? contractorTasks
        : tasks;

  if (selectedTasks.length > 0) {
    return selectedTasks
      .map((task) => ({
        label: task.subcategory || task.category,
        group: task.subcategoryGroup,
      }))
      .filter((task) => task.label);
  }

  return readStringList(jobData.selectedSubcategories).map((label) => ({
    label,
    group: readSubcategoryGroups(jobData.selectedSubcategoryGroups).get(label) ?? "",
  }));
}

function getRebookService(
  jobData: Record<string, unknown>,
  selectedTasks: Array<{ label: string; group: string }>,
  tasks: TaskData[],
  contractorId: string,
) {
  const matchingTask = tasks.find((task) => taskBelongsToContractor(task, contractorId));

  return (
    matchingTask?.category ||
    readText(jobData.selectedServiceCategory) ||
    selectedTasks[0]?.label ||
    ""
  );
}

function buildRequestHref(input: {
  jobData: Record<string, unknown>;
  tasks: TaskData[];
  sourceJobId: string;
  contractorId: string;
  fallbackServiceCategories?: string[];
}) {
  const selectedTasks = getRebookTasks(
    input.jobData,
    input.tasks,
    input.contractorId,
  );
  const service =
    getRebookService(
      input.jobData,
      selectedTasks,
      input.tasks,
      input.contractorId,
    ) ||
    input.fallbackServiceCategories?.[0] ||
    "";
  const params = new URLSearchParams();

  params.set("rebook", "1");

  if (input.sourceJobId) {
    params.set("rebookFromJobId", input.sourceJobId);
  }

  if (input.contractorId) {
    params.set("rebookContractorId", input.contractorId);
  }

  if (service) {
    params.set("service", service);
  }

  selectedTasks.forEach((task) => {
    params.append("item", task.label);

    if (task.group) {
      params.append("itemGroup", `${task.label}|||${task.group}`);
    }
  });

  const description =
    readText(input.jobData.jobDescription) ||
    "Rebooking previous AZISTO service. Please update any details before submitting.";
  params.set("description", description);

  ["address", "city", "province", "postalCode"].forEach((field) => {
    const value = readText(input.jobData[field]);

    if (value) {
      params.set(field, value);
    }
  });

  return `/request?${params.toString()}`;
}

async function findMostRecentCompletedJobForContractor(
  customerAuthUid: string,
  contractorId: string,
) {
  const jobsSnapshot = await adminDb
    .collection("jobs")
    .where("customerAuthUid", "==", customerAuthUid)
    .get();
  const candidates = await Promise.all(
    jobsSnapshot.docs.map(async (jobSnapshot) => {
      const tasksSnapshot = await jobSnapshot.ref.collection("tasks").get();
      const tasks = tasksSnapshot.docs.map(serializeTaskData);
      const jobData = jobSnapshot.data();
      const taskMatch = tasks.some(
        (task) =>
          task.hiredContractorId === contractorId &&
          task.status === "completed",
      );
      const parentMatch =
        readText(jobData.hiredContractorId) === contractorId &&
        readText(jobData.status) === "completed";

      if (!taskMatch && !parentMatch) {
        return null;
      }

      return {
        jobSnapshot,
        jobData,
        tasks,
        sortMs:
          getTimestampMs(jobData.completedAt) ||
          getTimestampMs(jobData.updatedAt) ||
          getTimestampMs(jobData.createdAt),
      };
    }),
  );

  return candidates
    .filter((candidate): candidate is NonNullable<typeof candidate> =>
      Boolean(candidate),
    )
    .sort((first, second) => second.sortMs - first.sortMs)
    .at(0) ?? null;
}

function getContractorServiceCategories(data: Record<string, unknown>) {
  const selectedServices = readStringList(data.selectedServices);

  if (selectedServices.length > 0) {
    return selectedServices;
  }

  return Object.keys(readRecord(data.selectedSubcategoriesByService))
    .map((service) => service.trim())
    .filter(Boolean);
}

async function getContractorServiceCategoriesById(contractorId: string) {
  if (!contractorId) {
    return [];
  }

  const contractorSnapshot = await adminDb
    .collection("contractors")
    .doc(contractorId)
    .get();

  return contractorSnapshot.exists
    ? getContractorServiceCategories(contractorSnapshot.data() ?? {})
    : [];
}

export async function POST(request: NextRequest) {
  try {
    assertFirebaseAdminConfig();

    const token = getBearerToken(request.headers.get("authorization"));

    if (!token) {
      return NextResponse.json(
        { code: "missing-token", message: "Please sign in again." },
        { status: 401 },
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const customerContext = await getCustomerProfileContext(decodedToken.uid);

    if (!customerContext) {
      return NextResponse.json(
        {
          code: "customer-profile-required",
          message: "Please use a customer account to rebook.",
        },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      sourceJobId?: unknown;
      contractorId?: unknown;
    } | null;
    const sourceJobId = readText(body?.sourceJobId);
    const contractorId = readText(body?.contractorId);
    let source:
      | {
          jobData: Record<string, unknown>;
          tasks: TaskData[];
          sourceJobId: string;
        }
      | null = null;

    if (sourceJobId) {
      const jobWithTasks = await getJobWithTasks(sourceJobId);

      if (!jobWithTasks) {
        return NextResponse.json(
          { code: "job-not-found", message: "This job could not be found." },
          { status: 404 },
        );
      }

      if (readText(jobWithTasks.jobData.customerAuthUid) !== decodedToken.uid) {
        return NextResponse.json(
          {
            code: "job-access-denied",
            message: "You can only rebook from your own jobs.",
          },
          { status: 403 },
        );
      }

      source = {
        jobData: jobWithTasks.jobData,
        tasks: jobWithTasks.tasks,
        sourceJobId:
          readText(jobWithTasks.jobData.jobId) || jobWithTasks.jobSnapshot.id,
      };
    } else if (contractorId) {
      const recentJob = await findMostRecentCompletedJobForContractor(
        decodedToken.uid,
        contractorId,
      );

      if (recentJob) {
        source = {
          jobData: recentJob.jobData,
          tasks: recentJob.tasks,
          sourceJobId:
            readText(recentJob.jobData.jobId) || recentJob.jobSnapshot.id,
        };
      }
    }

    if (!source && !contractorId) {
      return NextResponse.json(
        {
          code: "missing-rebook-source",
          message: "Choose a previous job or contractor to rebook.",
        },
        { status: 400 },
      );
    }

    const fallbackServiceCategories = contractorId
      ? await getContractorServiceCategoriesById(contractorId)
      : [];

    return NextResponse.json({
      ok: true,
      href: buildRequestHref({
        jobData: source?.jobData ?? {},
        tasks: source?.tasks ?? [],
        sourceJobId: source?.sourceJobId ?? "",
        contractorId,
        fallbackServiceCategories,
      }),
    });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Customer rebook API failed:", { code, message, error });

    return NextResponse.json(
      { code, message },
      { status: code === "missing-token" ? 401 : 500 },
    );
  }
}
