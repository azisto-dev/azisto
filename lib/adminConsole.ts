import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";

export function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function readStringList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

export function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function serializeTimestamp(value: unknown) {
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

export function getAdminLimit(value: string | null, fallback = 25) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed)
    ? Math.min(50, Math.max(1, parsed))
    : fallback;
}

export function sortByNewest<T extends { createdAt?: string; updatedAt?: string }>(
  records: T[],
) {
  return records.sort((first, second) =>
    (second.updatedAt || second.createdAt || "").localeCompare(
      first.updatedAt || first.createdAt || "",
    ),
  );
}

export function documentData(
  snapshot: QueryDocumentSnapshot<DocumentData>,
) {
  return snapshot.data() as Record<string, unknown>;
}

export type LinkedFile = {
  label: string;
  url: string;
  storagePath: string;
  fileName: string;
  uploadedAt: string;
  status: string;
  documentKey: string;
};

function labelFromKey(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function collectLinkedFiles(
  value: unknown,
  path: string[] = [],
): LinkedFile[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectLinkedFiles(item, [...path, String(index)]),
    );
  }

  const record = readRecord(value);

  if (Object.keys(record).length === 0) {
    return [];
  }

  const directUrl =
    readText(record.fileUrl) ||
    readText(record.url) ||
    readText(record.clearanceLetterUrl);
  const directPath =
    readText(record.storagePath) ||
    readText(record.fileStoragePath);
  const directFile = directUrl || directPath
    ? [
        {
          label: labelFromKey(path.at(-1) || "Document"),
          url: directUrl,
          storagePath: directPath,
          fileName: readText(record.fileName),
          uploadedAt:
            readText(record.uploadedAt) ||
            serializeTimestamp(record.uploadedAt),
          status:
            readText(record.reviewStatus) ||
            readText(record.status) ||
            "uploaded",
          documentKey: path.join("."),
        },
      ]
    : [];
  const keyedFiles = Object.entries(record).flatMap(([key, item]) => {
    if (!key.endsWith("Url") || typeof item !== "string" || !item.trim()) {
      return [];
    }

    const prefix = key.slice(0, -"Url".length);
    return [
      {
        label: labelFromKey(prefix),
        url: item.trim(),
        storagePath: readText(record[`${prefix}StoragePath`]),
        fileName: readText(record[`${prefix}FileName`]),
        uploadedAt:
          readText(record[`${prefix}UploadedAt`]) ||
          serializeTimestamp(record[`${prefix}UploadedAt`]),
        status: readText(record.status) || "uploaded",
        documentKey: path.join("."),
      },
    ];
  });
  const nestedFiles = Object.entries(record).flatMap(([key, item]) => {
    if (
      key.endsWith("Url") ||
      key.endsWith("StoragePath") ||
      key.endsWith("FileName") ||
      key.endsWith("UploadedAt")
    ) {
      return [];
    }

    return collectLinkedFiles(item, [...path, key]);
  });

  return [...directFile, ...keyedFiles, ...nestedFiles].filter(
    (file, index, files) =>
      files.findIndex(
        (candidate) =>
          `${candidate.url}|${candidate.storagePath}` ===
          `${file.url}|${file.storagePath}`,
      ) === index,
  );
}
