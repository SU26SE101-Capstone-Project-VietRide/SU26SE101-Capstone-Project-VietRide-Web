import { translateApiErrorMessage } from "../utils/apiErrorMessage";
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

export type ApiRequestErrorField = {
  field: string;
  message: string;
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  // Chi tiết lỗi theo field từ envelope `error.fields` (vd ROUTE_DUPLICATED
  // trả `existingRouteId` để FE dẫn tới tuyến có sẵn)
  readonly fields: ApiRequestErrorField[];
  // `meta.traceId` của envelope. Màn KHÔNG hiện nó như một phần thông báo lỗi;
  // nó chỉ dành cho khu vực kỹ thuật/gửi support khi lỗi đến từ upstream.
  readonly traceId?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
    fields: ApiRequestErrorField[] = [],
    displayMessage = message,
    traceId?: string,
  ) {
    super(displayMessage);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.traceId = traceId;
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

function parseErrorFields(payload: unknown): ApiRequestErrorField[] | undefined {
  if (
    !isRecord(payload) ||
    !isRecord(payload.error) ||
    !Array.isArray(payload.error.fields)
  ) {
    return undefined;
  }

  const fields = payload.error.fields
    .filter(isRecord)
    .map((entry) => ({
      field: asString(entry.field),
      message: asString(entry.message),
    }))
    .filter((entry) => entry.field || entry.message);

  return fields.length > 0 ? fields : undefined;
}

function parseTraceId(payload: unknown): string | undefined {
  if (!isRecord(payload) || !isRecord(payload.meta)) {
    return undefined;
  }

  return asString(payload.meta.traceId) || undefined;
}

function createApiRequestError(payload: unknown, status: number): ApiRequestError {
  const code = parseErrorCode(payload);
  const message = parseErrorMessage(payload, `Request failed: ${status}`);
  const fields = (parseErrorFields(payload) ?? []).map((field) => ({
    ...field,
    message: translateApiErrorMessage(undefined, field.message),
  }));
  // VALIDATION_ERROR / VALIDATION_FAILED có message top-level chung chung ("One
  // or more validation errors occurred." / "Validation failed"); lý do cụ thể
  // nằm ở error.fields[].message (BE trả field nào sai và tại sao) nên ưu tiên
  // hiện field message thay vì bản dịch chung.
  const isValidationCode =
    code === "VALIDATION_ERROR" || code === "VALIDATION_FAILED";
  const displayMessage =
    isValidationCode && fields.length > 0
      ? fields.map((field) => field.message).filter(Boolean).join(" ")
      : translateApiErrorMessage(code, message, status);
  return new ApiRequestError(
    message,
    status,
    code,
    fields,
    displayMessage,
    parseTraceId(payload),
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
  const result = await apiFileRequest(path, options);
  return result.blob;
}

export type ApiFileResponse = {
  blob: Blob;
  fileName?: string;
};

function fileNameFromContentDisposition(value: string | null) {
  if (!value) return undefined;

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return utf8Match[1].trim().replace(/^"|"$/g, "");
    }
  }

  return value.match(/filename\s*=\s*"?([^";]+)"?/i)?.[1]?.trim();
}

async function toFileResponse(response: Response): Promise<ApiFileResponse> {
  return {
    blob: await response.blob(),
    fileName: fileNameFromContentDisposition(
      response.headers.get("Content-Disposition"),
    ),
  };
}

export async function apiFileRequest(
  path: string,
  options: RequestOptions = {},
): Promise<ApiFileResponse> {
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

      return toFileResponse(retryResponse);
    }
  }

  if (!response.ok) {
    const payload = await parseResponse(response);
    throw createApiRequestError(payload, response.status);
  }

  return toFileResponse(response);
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
    throw new Error(
      translateApiErrorMessage(
        "UPSTREAM_UNAVAILABLE",
        "Streaming response body is unavailable",
      ),
    );
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
