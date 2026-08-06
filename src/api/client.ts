import { getAuthSession, refreshAuthSession } from "../auth";
import {
  addIdempotencyHeader,
  type HttpMethod,
} from "./idempotency";
import { isRecord } from "../utils/typeGuards";

type QueryValue = string | number | boolean | null | undefined;

export type ApiErrorField = {
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

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields: ApiErrorField[];

  constructor(
    message: string,
    status: number,
    code?: string,
    fields: ApiErrorField[] = [],
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  authenticated?: boolean;
  headers?: Record<string, string>;
  cache?: RequestCache;
  signal?: AbortSignal;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

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

function parseErrorCode(payload: unknown): string | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return undefined;
  }

  const code = asString(payload.error.code);
  return code || undefined;
}

function createApiRequestError(payload: unknown, status: number): ApiRequestError {
  const fields = isRecord(payload) && isRecord(payload.error) && Array.isArray(payload.error.fields)
    ? payload.error.fields.filter(isRecord).map((field) => ({
        field: asString(field.field) || undefined,
        message: asString(field.message) || undefined,
      }))
    : [];

  return new ApiRequestError(
    parseErrorMessage(payload, `Request failed: ${status}`),
    status,
    parseErrorCode(payload),
    fields,
  );
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
  const requestOptions = prepareRequestOptions(path, method, options);
  const session = getAuthSession();
  const shouldAuthenticate = options.authenticated !== false;
  const response = await sendRequest(
    path,
    method,
    requestOptions,
    shouldAuthenticate ? session?.accessToken : undefined,
  );

  const payload = await parseResponse(response);

  if (response.status === 401 && shouldAuthenticate && session?.refreshToken) {
    const refreshedSession = await refreshAuthSession();

    if (refreshedSession?.accessToken) {
      const retryResponse = await sendRequest(
        path,
        method,
        requestOptions,
        refreshedSession.accessToken,
      );
      const retryPayload = await parseResponse(retryResponse);

      if (!retryResponse.ok) {
        throw createApiRequestError(retryPayload, retryResponse.status);
      }

      if (isRecord(retryPayload) && "data" in retryPayload) {
        return (retryPayload as ApiEnvelope<T>).data as T;
      }

      return retryPayload as T;
    }
  }

  if (!response.ok) {
    throw createApiRequestError(payload, response.status);
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
  const requestOptions = prepareRequestOptions(path, method, options);
  const session = getAuthSession();
  const shouldAuthenticate = options.authenticated !== false;
  const response = await sendRequest(
    path,
    method,
    requestOptions,
    shouldAuthenticate ? session?.accessToken : undefined,
  );

  if (response.status === 401 && shouldAuthenticate && session?.refreshToken) {
    const refreshedSession = await refreshAuthSession();

    if (refreshedSession?.accessToken) {
      const retryResponse = await sendRequest(
        path,
        method,
        requestOptions,
        refreshedSession.accessToken,
      );

      if (!retryResponse.ok) {
        const retryPayload = await parseResponse(retryResponse);
        throw createApiRequestError(retryPayload, retryResponse.status);
      }

      return retryResponse.blob();
    }
  }

  if (!response.ok) {
    const payload = await parseResponse(response);
    throw createApiRequestError(payload, response.status);
  }

  return response.blob();
}

export type ApiSseEvent = {
  event: string;
  data: unknown;
};

export async function apiSseRequest(
  path: string,
  options: RequestOptions,
  onEvent: (event: ApiSseEvent) => void,
): Promise<void> {
  const method = options.method ?? "GET";
  const requestOptions = prepareRequestOptions(path, method, options);
  const session = getAuthSession();
  const shouldAuthenticate = options.authenticated !== false;
  let response = await sendRequest(
    path,
    method,
    requestOptions,
    shouldAuthenticate ? session?.accessToken : undefined,
  );

  if (response.status === 401 && shouldAuthenticate && session?.refreshToken) {
    const refreshedSession = await refreshAuthSession();
    if (refreshedSession?.accessToken) {
      response = await sendRequest(
        path,
        method,
        requestOptions,
        refreshedSession.accessToken,
      );
    }
  }

  if (!response.ok) {
    const payload = await parseResponse(response);
    throw createApiRequestError(payload, response.status);
  }

  if (!response.body) {
    throw new Error("Streaming response body is unavailable");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let dataLines: string[] = [];

  const dispatch = () => {
    if (dataLines.length === 0) {
      eventName = "message";
      return;
    }

    const rawData = dataLines.join("\n");
    let data: unknown = rawData;
    try {
      data = JSON.parse(rawData) as unknown;
    } catch {
      // Plain-text SSE data is valid and should be forwarded unchanged.
    }
    onEvent({ event: eventName, data });
    eventName = "message";
    dataLines = [];
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = done ? "" : (lines.pop() ?? "");

    for (const line of lines) {
      if (line === "") {
        dispatch();
      } else if (line.startsWith("event:")) {
        eventName = line.slice(6).trim() || "message";
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (done) {
      if (buffer) {
        dataLines.push(buffer.startsWith("data:") ? buffer.slice(5).trimStart() : buffer);
      }
      dispatch();
      break;
    }
  }
}

function prepareRequestOptions(
  path: string,
  method: HttpMethod,
  options: RequestOptions,
): RequestOptions {
  const headers = addIdempotencyHeader(path, method, options.headers);

  if (headers === options.headers) {
    return options;
  }

  return {
    ...options,
    headers,
  };
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
    ...(options.cache ? { cache: options.cache } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });
}
