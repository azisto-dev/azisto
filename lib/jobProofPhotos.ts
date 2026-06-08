// Temporary testing switch. Set to true to restore mandatory proof-photo gates.
export const ENABLE_JOB_PHOTO_ENFORCEMENT = false;

export type JobProofPhoto = {
  url: string;
  storagePath: string;
  takenAt: string;
  takenByUid: string;
  lat: number | null;
  lng: number | null;
  source: "camera";
  type: "before" | "after";
};

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readCoordinate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readTimestamp(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

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

export function readJobProofPhotos(value: unknown): JobProofPhoto[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const data = item as Record<string, unknown>;
    const url = readText(data.url);
    const storagePath = readText(data.storagePath);
    const type = data.type === "after" ? "after" : "before";

    if (!url || !storagePath) {
      return [];
    }

    return [
      {
        url,
        storagePath,
        takenAt: readTimestamp(data.takenAt),
        takenByUid: readText(data.takenByUid),
        lat: readCoordinate(data.lat),
        lng: readCoordinate(data.lng),
        source: "camera" as const,
        type,
      },
    ];
  });
}
