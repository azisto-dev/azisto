import type { User } from "firebase/auth";

export type BadgeCounts = {
  messages: number;
  notifications: number;
};

function readCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function fetchBadgeCounts(user: User): Promise<BadgeCounts> {
  const token = await user.getIdToken();
  const response = await fetch("/api/badges", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const responseBody = (await response.json().catch(() => null)) as {
    messages?: unknown;
    notifications?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(
      typeof responseBody?.message === "string"
        ? responseBody.message
        : "Unable to load badge counts.",
    );
  }

  return {
    messages: readCount(responseBody?.messages),
    notifications: readCount(responseBody?.notifications),
  };
}
