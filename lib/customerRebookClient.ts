import type { User } from "firebase/auth";

async function getJsonResponse(response: Response, fallbackMessage: string) {
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string" ? body.message : fallbackMessage,
    );
  }

  return body;
}

export async function createRebookRequest(
  user: User,
  input: {
    sourceJobId?: string;
    contractorId?: string;
  },
) {
  const token = await user.getIdToken();
  const response = await fetch("/api/customers/rebook", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const body = (await getJsonResponse(
    response,
    "Unable to prepare this booking.",
  )) as { href?: unknown };

  return typeof body.href === "string" ? body.href : "/request";
}
