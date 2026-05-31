export const firebaseQuotaMessage =
  "Firebase quota temporarily exceeded. Please wait a minute and refresh.";
export const connectionInterruptedMessage =
  "Connection temporarily interrupted. Retrying soon.";

export function isQuotaExceededMessage(value: unknown) {
  const normalizedValue =
    typeof value === "string" ? value.toLowerCase() : "";

  return (
    normalizedValue.includes("resource_exhausted") ||
    normalizedValue.includes("resource-exhausted") ||
    normalizedValue.includes("quota exceeded") ||
    normalizedValue.includes("quota temporarily exceeded")
  );
}

export function isQuotaExceededError(error: unknown) {
  return (
    error instanceof Error &&
    isQuotaExceededMessage(`${error.name} ${error.message}`)
  );
}

export function isNetworkError(error: unknown) {
  const normalizedValue =
    error instanceof Error
      ? `${error.name} ${"code" in error ? String(error.code) : ""} ${error.message}`.toLowerCase()
      : String(error).toLowerCase();

  return (
    normalizedValue.includes("network-request-failed") ||
    normalizedValue.includes("failed to fetch") ||
    normalizedValue.includes("networkerror") ||
    normalizedValue.includes("enotfound") ||
    normalizedValue.includes("getaddrinfo") ||
    normalizedValue.includes("www.googleapis.com")
  );
}

export function isAuthenticationError(error: unknown) {
  const normalizedValue =
    error instanceof Error
      ? `${error.name} ${"code" in error ? String(error.code) : ""} ${error.message}`.toLowerCase()
      : String(error).toLowerCase();

  return (
    normalizedValue.includes("auth/id-token-expired") ||
    normalizedValue.includes("id-token-expired") ||
    normalizedValue.includes("auth/user-token-expired") ||
    normalizedValue.includes("missing-token") ||
    normalizedValue.includes("api/401")
  );
}

export function isTransientApiError(error: unknown) {
  return (
    isQuotaExceededError(error) ||
    isNetworkError(error) ||
    isAuthenticationError(error)
  );
}

export function getRetryBackoffMs(
  error: unknown,
  networkBackoffMs = 60_000,
) {
  if (isQuotaExceededError(error)) {
    return 5 * 60_000;
  }

  if (isAuthenticationError(error)) {
    return 2 * 60_000;
  }

  if (isNetworkError(error)) {
    return networkBackoffMs;
  }

  return 0;
}
