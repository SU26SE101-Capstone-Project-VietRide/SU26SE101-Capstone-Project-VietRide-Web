export type AuthRole = "SYSTEM_ADMIN" | "OPERATOR_ADMIN" | "OPERATOR_STAFF";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  phone: string;
  role: AuthRole;
  operatorId?: string;
  status?: string;
};

type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = LoginRequest & {
  displayName: string;
  phone: string;
};

type LoginData = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  user: AuthUser;
};

type ApiEnvelope<T> = {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const AUTH_STORAGE_KEY = "auth";
const LEGACY_USER_KEY = "user";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeRole(value: unknown): AuthRole | null {
  const roleMap: Record<string, AuthRole> = {
    SYSTEM_ADMIN: "SYSTEM_ADMIN",
    OPERATOR_ADMIN: "OPERATOR_ADMIN",
    OPERATOR_STAFF: "OPERATOR_STAFF",
    OPERATION_ADMIN: "OPERATOR_ADMIN",
    OPERATION_STAFF: "OPERATOR_STAFF",
    admin: "SYSTEM_ADMIN",
    manager: "OPERATOR_ADMIN",
    operator: "OPERATOR_STAFF",
    operationAdmin: "OPERATOR_ADMIN",
    operationStaff: "OPERATOR_STAFF",
  };

  if (typeof value === "string") {
    return roleMap[value] ?? null;
  }

  return null;
}

function parseUser(value: unknown): AuthUser | null {
  if (!isRecord(value)) {
    return null;
  }

  const role = normalizeRole(value.role);
  if (!role) {
    return null;
  }

  return {
    id: asString(value.id),
    email: asString(value.email),
    displayName: asString(value.displayName),
    phone: asString(value.phone),
    role,
    operatorId: asString(value.operatorId) || undefined,
    status: asString(value.status) || undefined,
  };
}

function parseLoginData(value: unknown): LoginData | null {
  if (!isRecord(value)) {
    return null;
  }

  const user = parseUser(value.user);
  if (!user) {
    return null;
  }

  return {
    accessToken: asString(value.accessToken),
    refreshToken: asString(value.refreshToken),
    expiresInSeconds:
      typeof value.expiresInSeconds === "number" ? value.expiresInSeconds : 0,
    user,
  };
}

async function parseJsonResponse(response: Response): Promise<unknown> {
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

async function postJson<TResponse>(
  path: string,
  body: unknown,
  parseData: (value: unknown) => TResponse | null,
  token?: string,
): Promise<ApiEnvelope<TResponse>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const payload = await parseJsonResponse(response);
  if (!isRecord(payload)) {
    throw new Error("Invalid server response");
  }

  const data = parseData(payload.data);
  const message = asString(payload.message);
  const apiError = isRecord(payload.error) ? payload.error : null;
  const errorMessage = apiError ? asString(apiError.message) : "";

  if (!response.ok || !data) {
    throw new Error(errorMessage || message || "Request failed");
  }

  return {
    success: payload.success === true,
    statusCode:
      typeof payload.statusCode === "number"
        ? payload.statusCode
        : response.status,
    message,
    data,
  };
}

export function getAuthSession(): LoginData | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return parseLoginData(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function getAuthUser(): AuthUser | null {
  return getAuthSession()?.user ?? null;
}

export function getHomePathForRole(role: AuthRole): string {
  return role === "SYSTEM_ADMIN" ? "/admin/dashboard" : "/manager/dashboard";
}

export function saveAuthSession(session: LoginData): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  localStorage.setItem(LEGACY_USER_KEY, JSON.stringify(session.user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
}

export async function login(request: LoginRequest): Promise<LoginData> {
  const response = await postJson("/v1/auth/login", request, parseLoginData);
  saveAuthSession(response.data);
  return response.data;
}

// BE xoay vòng refresh token và có reuse detection: dùng lại một token đã xoay
// sẽ khiến BE revoke toàn bộ token family. Nếu nhiều request cùng 401 và mỗi
// request tự gọi /auth/refresh, các lần gọi sau sẽ mang token cũ và bị coi là
// reuse. Vì vậy mọi lời gọi phải chia sẻ chung một promise refresh duy nhất.
let refreshInFlight: Promise<LoginData | null> | null = null;

export function refreshAuthSession(): Promise<LoginData | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

async function performRefresh(): Promise<LoginData | null> {
  const session = getAuthSession();
  if (!session?.refreshToken) {
    return null;
  }

  try {
    const response = await postJson(
      "/v1/auth/refresh",
      { refreshToken: session.refreshToken },
      parseLoginData,
    );
    saveAuthSession(response.data);
    return response.data;
  } catch {
    clearAuthSession();
    return null;
  }
}

export async function register(request: RegisterRequest): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/v1/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const payload = await parseJsonResponse(response);
  const message = isRecord(payload) ? asString(payload.message) : "";

  if (!response.ok) {
    throw new Error(message || "Register failed");
  }
}

export async function logout(): Promise<void> {
  const session = getAuthSession();

  try {
    if (session?.refreshToken) {
      await fetch(`${API_BASE_URL}/v1/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    }
  } finally {
    clearAuthSession();
  }
}
