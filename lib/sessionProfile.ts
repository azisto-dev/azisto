import type { User } from "firebase/auth";
import {
  firebaseQuotaMessage,
  isQuotaExceededMessage,
} from "@/lib/apiErrors";

export type SessionProfile = {
  role: "customer" | "contractor" | "unknown";
  customerId: string;
  contractorId: string;
  verificationStatus: string;
  authUid: string;
  displayName: string;
  quotaExceeded?: boolean;
};

const sessionProfileCache = new Map<
  string,
  {
    expiresAt: number;
    profile: SessionProfile;
  }
>();
const sessionProfileCacheTtlMs = 60_000;

export async function fetchSessionProfile(user: User): Promise<SessionProfile> {
  const cachedProfile = sessionProfileCache.get(user.uid);

  if (cachedProfile && cachedProfile.expiresAt > Date.now()) {
    return cachedProfile.profile;
  }

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
    const message =
      typeof responseBody?.message === "string"
        ? responseBody.message
        : "Unable to load your account profile.";

    if (isQuotaExceededMessage(message)) {
      const fallbackProfile: SessionProfile = {
        role: "unknown",
        customerId: "",
        contractorId: "",
        verificationStatus: "",
        authUid: user.uid,
        displayName: "",
        quotaExceeded: true,
      };

      sessionProfileCache.set(user.uid, {
        expiresAt: Date.now() + sessionProfileCacheTtlMs,
        profile: fallbackProfile,
      });

      return fallbackProfile;
    }

    throw new Error(
      isQuotaExceededMessage(message) ? firebaseQuotaMessage : message,
    );
  }

  const profile: SessionProfile = {
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
    displayName:
      typeof responseBody?.displayName === "string"
        ? responseBody.displayName
        : "",
  };

  sessionProfileCache.set(user.uid, {
    expiresAt: Date.now() + sessionProfileCacheTtlMs,
    profile,
  });

  return profile;
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
