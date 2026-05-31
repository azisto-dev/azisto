import type { User } from "firebase/auth";

type ApiErrorBody = {
  code?: unknown;
  message?: unknown;
};

export class ApiRequestError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 0) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
  }
}

async function readErrorBody(response: Response) {
  return (await response.clone().json().catch(() => null)) as ApiErrorBody | null;
}

async function isExpiredTokenResponse(response: Response) {
  if (response.status === 401) {
    return true;
  }

  const body = await readErrorBody(response);
  const normalizedValue = `${body?.code ?? ""} ${body?.message ?? ""}`.toLowerCase();

  return (
    normalizedValue.includes("auth/id-token-expired") ||
    normalizedValue.includes("id-token-expired") ||
    normalizedValue.includes("auth/user-token-expired")
  );
}

export async function throwApiResponseError(
  response: Response,
  fallbackMessage: string,
): Promise<never> {
  const body = await readErrorBody(response);

  throw new ApiRequestError(
    typeof body?.code === "string" ? body.code : `api/${response.status}`,
    typeof body?.message === "string" ? body.message : fallbackMessage,
    response.status,
  );
}

export async function authenticatedFetch(
  user: User,
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  async function request(forceRefresh: boolean) {
    const token = await user.getIdToken(forceRefresh);

    return fetch(input, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }

  const response = await request(false);

  if (await isExpiredTokenResponse(response)) {
    return request(true);
  }

  return response;
}
