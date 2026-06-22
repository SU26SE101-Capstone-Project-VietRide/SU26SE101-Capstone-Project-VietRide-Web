import { getAuthSession } from "../auth";

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
  method?: "GET" | "POST" | "PATCH" | "DELETE";
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
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.authenticated !== false && session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  Object.assign(headers, options.headers);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new Error(parseErrorMessage(payload, `Request failed: ${response.status}`));
  }

  if (isRecord(payload) && "data" in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }

  return payload as T;
}
