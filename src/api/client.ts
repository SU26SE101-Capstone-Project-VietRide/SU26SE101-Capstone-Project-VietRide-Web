import { getAuthSession, refreshAuthSession } from "../auth";

type QueryValue = string | number | boolean | null | undefined;

type ApiErrorField = {
  field?: string;
  message?: string;
};

type ApiErrorBody = {
  code?: string;
  message?: string;
  fields?: ApiErrorField[];
};

type ApiEnvelope<T> = {
  success?: boolean;
  statusCode?: number;
  message?: string;
  data?: T;
  error?: ApiErrorBody;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  authenticated?: boolean;
  headers?: Record<string, string>;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseErrorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) {
    return fallback;
  }

  const message = asString(payload.message);
  if (message) {
    return message;
  }

  const error = payload.error;
  if (isRecord(error)) {
    return asString(error.message) || fallback;
  }

  return fallback;
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function buildQuery(params: Record<string, QueryValue>): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    query.set(key, String(value));
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const session = getAuthSession();
  const shouldAuthenticate = options.authenticated !== false;
  const response = await sendRequest(
    path,
    method,
    options,
    shouldAuthenticate ? session?.accessToken : undefined,
  );

  const payload = await parseResponse(response);

  if (response.status === 401 && shouldAuthenticate && session?.refreshToken) {
    const refreshedSession = await refreshAuthSession();

    if (refreshedSession?.accessToken) {
      const retryResponse = await sendRequest(
        path,
        method,
        options,
        refreshedSession.accessToken,
      );
      const retryPayload = await parseResponse(retryResponse);

      if (!retryResponse.ok) {
        throw new Error(
          parseErrorMessage(
            retryPayload,
            `Request failed: ${retryResponse.status}`,
          ),
        );
      }

      if (isRecord(retryPayload) && "data" in retryPayload) {
        return (retryPayload as ApiEnvelope<T>).data as T;
      }

      return retryPayload as T;
    }
  }

  if (!response.ok) {
    throw new Error(parseErrorMessage(payload, `Request failed: ${response.status}`));
  }

  if (isRecord(payload) && "data" in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }

  return payload as T;
}

export async function apiBlobRequest(
  path: string,
  options: RequestOptions = {},
): Promise<Blob> {
  const method = options.method ?? "GET";
  const session = getAuthSession();
  const shouldAuthenticate = options.authenticated !== false;
  const response = await sendRequest(
    path,
    method,
    options,
    shouldAuthenticate ? session?.accessToken : undefined,
  );

  if (response.status === 401 && shouldAuthenticate && session?.refreshToken) {
    const refreshedSession = await refreshAuthSession();

    if (refreshedSession?.accessToken) {
      const retryResponse = await sendRequest(
        path,
        method,
        options,
        refreshedSession.accessToken,
      );

      if (!retryResponse.ok) {
        const retryPayload = await parseResponse(retryResponse);
        throw new Error(
          parseErrorMessage(
            retryPayload,
            `Request failed: ${retryResponse.status}`,
          ),
        );
      }

      return retryResponse.blob();
    }
  }

  if (!response.ok) {
    const payload = await parseResponse(response);
    throw new Error(parseErrorMessage(payload, `Request failed: ${response.status}`));
  }

  return response.blob();
}

function buildHeaders(options: RequestOptions, accessToken?: string) {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  Object.assign(headers, options.headers);
  return headers;
}

function sendRequest(
  path: string,
  method: RequestOptions["method"],
  options: RequestOptions,
  accessToken?: string,
) {
  const isFormData = options.body instanceof FormData;
  const body =
    options.body === undefined
      ? undefined
      : isFormData
        ? options.body
        : JSON.stringify(options.body);

  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders(options, accessToken),
    body: body as BodyInit | undefined,
  });
}
