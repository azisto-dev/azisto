import type { User } from "firebase/auth";

export type SessionProfile = {
  role: "customer" | "contractor" | "unknown";
  customerId: string;
  contractorId: string;
  verificationStatus: string;
  authUid: string;
};

export async function fetchSessionProfile(user: User): Promise<SessionProfile> {
  const token = await user.getIdToken();
  const response = await fetch("/api/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const responseBody = (await response.json().catch(() => null)) as
    | (Partial<SessionProfile> & {
        message?: unknown;
      })
    | null;

  if (!response.ok) {
    throw new Error(
      typeof responseBody?.message === "string"
        ? responseBody.message
        : "Unable to load your account profile.",
    );
  }

  return {
    role:
      responseBody?.role === "customer" || responseBody?.role === "contractor"
        ? responseBody.role
        : "unknown",
    customerId:
      typeof responseBody?.customerId === "string"
        ? responseBody.customerId
        : "",
    contractorId:
      typeof responseBody?.contractorId === "string"
        ? responseBody.contractorId
        : "",
    verificationStatus:
      typeof responseBody?.verificationStatus === "string"
        ? responseBody.verificationStatus
        : "",
    authUid:
      typeof responseBody?.authUid === "string" ? responseBody.authUid : "",
  };
}

export function getDefaultRouteForSession(profile: SessionProfile) {
  if (profile.role === "contractor") {
    return "/home";
  }

  if (profile.role === "customer") {
    return "/home";
  }

  return "/account-type";
}
