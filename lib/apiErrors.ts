export const firebaseQuotaMessage =
  "Firebase quota temporarily exceeded. Please wait a minute and refresh.";

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
