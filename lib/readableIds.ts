import { randomInt } from "node:crypto";
import { adminDb } from "@/lib/firebaseAdmin";

const readableIdRetryLimit = 25;

export function generateSixDigitId(prefix: string) {
  const numberPart = randomInt(100000, 1000000);
  return `${prefix}-${numberPart}`;
}

export async function ensureUniqueReadableId(
  collectionName: string,
  fieldName: string,
  prefix: string,
) {
  for (let attempt = 0; attempt < readableIdRetryLimit; attempt += 1) {
    const readableId = generateSixDigitId(prefix);
    const existingDocumentSnapshot = await adminDb
      .collection(collectionName)
      .doc(readableId)
      .get();
    const existingIdSnapshot = await adminDb
      .collection(collectionName)
      .where(fieldName, "==", readableId)
      .limit(1)
      .get();

    if (!existingDocumentSnapshot.exists && existingIdSnapshot.empty) {
      return readableId;
    }
  }

  throw new Error(
    `Could not create a unique ${fieldName} after ${readableIdRetryLimit} attempts.`,
  );
}
