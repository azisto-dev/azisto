import { getTimestampMs } from "@/lib/jobExpiry";

export const CANCELLED_VISIBILITY_MS = 60 * 60 * 1000;

export function isCancellationVisible(
  data: Record<string, unknown>,
  nowMs = Date.now(),
) {
  return (
    data.status === "cancelled" &&
    getTimestampMs(data.cancelledVisibleUntil) > nowMs
  );
}
