import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  assertFirebaseAdminConfig,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

type PhotoRequestBody = {
  taskId?: unknown;
  type?: unknown;
  url?: unknown;
  storagePath?: unknown;
  lat?: unknown;
  lng?: unknown;
};

const beforePhotoStatuses = new Set([
  "accepted",
  "hired",
  "on_the_way",
  "in_progress",
]);
const afterPhotoStatuses = new Set(["in_progress", "completed"]);

function getBearerToken(authorizationHeader: string | null) {
  return authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : "";
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readCoordinate(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const coordinate = typeof value === "number" ? value : Number(value);

  return Number.isFinite(coordinate) ? coordinate : null;
}

function getErrorDetails(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "unknown";

  return {
    code,
    message: error instanceof Error ? error.message : "Unknown error",
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
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
    const { jobId } = await context.params;
    const body = (await request.json()) as PhotoRequestBody;
    const taskId = readText(body.taskId);
    const type = body.type === "after" ? "after" : body.type === "before" ? "before" : "";
    const url = readText(body.url);
    const storagePath = readText(body.storagePath);

    if (!type || !url || !storagePath) {
      return NextResponse.json(
        {
          code: "invalid-photo",
          message: "Photo type, URL, and storage path are required.",
        },
        { status: 400 },
      );
    }

    const expectedPathPrefix = `jobProofPhotos/${jobId}/${taskId || "parent"}/${type}/`;

    if (
      !storagePath.startsWith(expectedPathPrefix) ||
      !url.startsWith("https://")
    ) {
      return NextResponse.json(
        {
          code: "invalid-photo-path",
          message: "This job photo path is not valid.",
        },
        { status: 400 },
      );
    }

    const jobDocument = adminDb.collection("jobs").doc(jobId);
    const jobSnapshot = await jobDocument.get();

    if (!jobSnapshot.exists) {
      return NextResponse.json(
        { code: "job-not-found", message: "This job could not be found." },
        { status: 404 },
      );
    }

    const targetDocument = taskId
      ? jobDocument.collection("tasks").doc(taskId)
      : jobDocument;
    const targetSnapshot = taskId ? await targetDocument.get() : jobSnapshot;

    if (!targetSnapshot.exists) {
      return NextResponse.json(
        { code: "task-not-found", message: "This task could not be found." },
        { status: 404 },
      );
    }

    if (targetSnapshot.get("hiredContractorAuthUid") !== decodedToken.uid) {
      return NextResponse.json(
        {
          code: "job-access-denied",
          message: "You can only add proof photos to work assigned to you.",
        },
        { status: 403 },
      );
    }

    const status = readText(targetSnapshot.get("status"));
    const allowedStatuses =
      type === "before" ? beforePhotoStatuses : afterPhotoStatuses;

    if (!allowedStatuses.has(status)) {
      return NextResponse.json(
        {
          code: "photo-status-not-allowed",
          message:
            type === "before"
              ? "Before photos can be taken after you accept the job."
              : "After photos can be taken once the job is in progress.",
        },
        { status: 409 },
      );
    }

    const photo = {
      url,
      storagePath,
      takenAt: new Date().toISOString(),
      takenByUid: decodedToken.uid,
      lat: readCoordinate(body.lat),
      lng: readCoordinate(body.lng),
      source: "camera",
      type,
    };

    await targetDocument.set(
      {
        [type === "before" ? "beforePhotos" : "afterPhotos"]:
          FieldValue.arrayUnion(photo),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, photo });
  } catch (error) {
    const { code, message } = getErrorDetails(error);

    console.error("Job proof photo API failed:", { code, message, error });

    return NextResponse.json(
      { code, message },
      { status: code === "missing-token" ? 401 : 500 },
    );
  }
}
