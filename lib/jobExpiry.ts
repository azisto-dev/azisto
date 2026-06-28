export const JOB_EXPIRY_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const JOB_EXPIRY_NOTICE_WINDOW_MS = 24 * 60 * 60 * 1000;

type TimestampLike = {
  toDate?: () => Date;
  toMillis?: () => number;
};

export function getTimestampMs(value: unknown) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === "object" && value !== null) {
    const timestamp = value as TimestampLike;

    if (typeof timestamp.toMillis === "function") {
      return timestamp.toMillis();
    }

    if (typeof timestamp.toDate === "function") {
      return timestamp.toDate().getTime();
    }
  }

  return 0;
}

export function getJobExpiresAtMs(data: Record<string, unknown>) {
  const savedExpiry = getTimestampMs(data.expiresAt);

  if (savedExpiry) {
    return savedExpiry;
  }

  const postedAt = getTimestampMs(data.repostedAt) || getTimestampMs(data.createdAt);
  return postedAt ? postedAt + JOB_EXPIRY_DURATION_MS : 0;
}

export function isJobExpired(
  data: Record<string, unknown>,
  now = Date.now(),
) {
  const expiresAt = getJobExpiresAtMs(data);
  return expiresAt > 0 && expiresAt <= now;
}

export function isJobExpiringSoon(
  data: Record<string, unknown>,
  now = Date.now(),
) {
  const expiresAt = getJobExpiresAtMs(data);
  const remainingMs = expiresAt - now;

  return remainingMs > 0 && remainingMs <= JOB_EXPIRY_NOTICE_WINDOW_MS;
}
