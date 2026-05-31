import type { User } from "firebase/auth";
import {
  isNetworkError,
  isQuotaExceededMessage,
} from "@/lib/apiErrors";
import {
  authenticatedFetch,
  throwApiResponseError,
} from "@/lib/authenticatedFetch";

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
const sessionProfileRequests = new Map<string, Promise<SessionProfile>>();

export async function fetchSessionProfile(user: User): Promise<SessionProfile> {
  const cachedProfile = sessionProfileCache.get(user.uid);

  if (cachedProfile && cachedProfile.expiresAt > Date.now()) {
    return cachedProfile.profile;
  }

  const pendingRequest = sessionProfileRequests.get(user.uid);

  if (pendingRequest) {
    return pendingRequest;
  }

  const nextRequest = (async () => {
    try {
      const response = await authenticatedFetch(user, "/api/me");
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
          if (cachedProfile) {
            return cachedProfile.profile;
          }

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

        await throwApiResponseError(response, message);
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
    } catch (error) {
      if (cachedProfile && isNetworkError(error)) {
        return cachedProfile.profile;
      }

      throw error;
    } finally {
      sessionProfileRequests.delete(user.uid);
    }
  })();

  sessionProfileRequests.set(user.uid, nextRequest);

  return nextRequest;
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
