export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const IDEMPOTENT_MUTATION_METHODS = new Set<HttpMethod>([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

const IDEMPOTENCY_EXEMPT_OPERATIONS = new Set([
  "POST /v1/auth/login",
  "POST /v1/auth/google",
  "POST /v1/auth/refresh",
  "POST /v1/firebase/custom-token",
  "POST /v1/admin/rag-config/reload",
  "POST /v1/payments/vnpay-ipn",
  "POST /v1/payments/vnpay-topup-ipn",
  "POST /v1/payments/subscription-vnpay-ipn",
  "POST /internal/v1/operators/summaries/batch",
  "POST /internal/v1/vouchers/validate",
  // BE SkipIdempotency (contract mục 4.4): create driver-schedule.
  "POST /v1/operator/driver-schedules",
]);

// Exempt theo pattern cho path có id động — BE SkipIdempotency (mục 4.4):
// activate/deactivate driver-schedule.
const IDEMPOTENCY_EXEMPT_PATTERNS: ReadonlyArray<{
  method: HttpMethod;
  pattern: RegExp;
}> = [
  {
    method: "PATCH",
    pattern: /^\/v1\/operator\/driver-schedules\/[^/]+\/(?:activate|deactivate)$/,
  },
];

function normalizePath(path: string): string {
  const pathname = new URL(path, "https://client.vietride.local").pathname;
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function hasIdempotencyHeader(headers?: Record<string, string>): boolean {
  return Object.keys(headers ?? {}).some(
    (header) => header.toLowerCase() === "idempotency-key",
  );
}

function requiresIdempotencyKey(path: string, method: HttpMethod): boolean {
  if (!IDEMPOTENT_MUTATION_METHODS.has(method)) {
    return false;
  }

  const pathname = normalizePath(path);

  if (IDEMPOTENCY_EXEMPT_OPERATIONS.has(`${method} ${pathname}`)) {
    return false;
  }

  return !IDEMPOTENCY_EXEMPT_PATTERNS.some(
    (exempt) => exempt.method === method && exempt.pattern.test(pathname),
  );
}

export function createIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("Secure UUID v4 generation is unavailable.");
  }

  return globalThis.crypto.randomUUID();
}

export function addIdempotencyHeader(
  path: string,
  method: HttpMethod,
  headers?: Record<string, string>,
): Record<string, string> | undefined {
  if (!requiresIdempotencyKey(path, method) || hasIdempotencyHeader(headers)) {
    return headers;
  }

  return {
    ...headers,
    "Idempotency-Key": createIdempotencyKey(),
  };
}
