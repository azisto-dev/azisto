import type { User } from "firebase/auth";

type ApiErrorBody = {
  code?: unknown;
  message?: unknown;
};

const errorBodyCache = new WeakMap<
  Response,
  Promise<ApiErrorBody | null>
>();

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
  const cachedBody = errorBodyCache.get(response);

  if (cachedBody) {
    return cachedBody;
  }

  if (response.bodyUsed) {
    return null;
  }

  const bodyPromise = (async () => {
    try {
      const text = await response.clone().text();

      if (!text) {
        return null;
      }

      return JSON.parse(text) as ApiErrorBody;
    } catch {
      return null;
    }
  })();

  errorBodyCache.set(response, bodyPromise);
  return bodyPromise;
}

async function isExpiredTokenResponse(response: Response) {
  if (response.status === 401) {
    return true;
  }

  if (response.ok) {
    return false;
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
  const message =
    typeof body?.message === "string"
      ? body.message
      : fallbackMessage || response.statusText || "The request failed.";

  throw new ApiRequestError(
    typeof body?.code === "string" ? body.code : `api/${response.status}`,
    message,
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
