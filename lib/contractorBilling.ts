import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export type ContractorDocument = DocumentSnapshot;

export function readBillingText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function findContractorProfileByAuthUid(
  firebaseUid: string,
): Promise<ContractorDocument | null> {
  const contractors = adminDb.collection("contractors");
  const authUidSnapshot = await contractors
    .where("authUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!authUidSnapshot.empty) {
    return authUidSnapshot.docs[0];
  }

  const legacyUidSnapshot = await contractors
    .where("firebaseUid", "==", firebaseUid)
    .limit(1)
    .get();

  if (!legacyUidSnapshot.empty) {
    return legacyUidSnapshot.docs[0];
  }

  const legacyDocument = await contractors.doc(firebaseUid).get();
  return legacyDocument.exists ? legacyDocument : null;
}

export async function findContractorProfileForStripe({
  contractorId,
  contractorAuthUid,
  stripeCustomerId,
}: {
  contractorId?: string;
  contractorAuthUid?: string;
  stripeCustomerId?: string;
}): Promise<ContractorDocument | null> {
  const contractors = adminDb.collection("contractors");

  if (contractorId) {
    const directDocument = await contractors.doc(contractorId).get();

    if (directDocument.exists) {
      return directDocument;
    }

    const contractorIdSnapshot = await contractors
      .where("contractorId", "==", contractorId)
      .limit(1)
      .get();

    if (!contractorIdSnapshot.empty) {
      return contractorIdSnapshot.docs[0];
    }
  }

  if (contractorAuthUid) {
    const authProfile =
      await findContractorProfileByAuthUid(contractorAuthUid);

    if (authProfile) {
      return authProfile;
    }
  }

  if (stripeCustomerId) {
    const customerSnapshot = await contractors
      .where("stripeCustomerId", "==", stripeCustomerId)
      .limit(1)
      .get();

    if (!customerSnapshot.empty) {
      return customerSnapshot.docs[0];
    }
  }

  return null;
}
