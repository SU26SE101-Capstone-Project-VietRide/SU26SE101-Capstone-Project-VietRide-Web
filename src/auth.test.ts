import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthSession,
  getAuthUser,
  getHomePathForRole,
  login,
  logout,
  refreshAuthSession,
} from "./auth";

describe("auth", () => {
  beforeEach(() => {
    clearAuthSession();
    vi.restoreAllMocks();
  });

  it("stores login session from the API response", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          statusCode: 0,
          message: "OK",
          data: {
            accessToken: "access-token",
            refreshToken: "refresh-token",
            expiresInSeconds: 3600,
            user: {
              id: "user-1",
              email: "manager@vietride.vn",
              displayName: "Manager",
              phone: "0901234567",
              role: "OPERATOR_ADMIN",
            },
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await login({
      email: "manager@vietride.vn",
      password: "secret123",
    });

    expect(session.user.role).toBe("OPERATOR_ADMIN");
    expect(getAuthUser()?.email).toBe("manager@vietride.vn");
    expect(getHomePathForRole(session.user.role)).toBe("/manager/dashboard");
  });

  it("calls logout with refresh token and clears the session", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "user-1",
          email: "admin@vietride.vn",
          displayName: "Admin",
          phone: "0901234567",
          role: "SYSTEM_ADMIN",
        },
      }),
    );

    await logout();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/auth/logout",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refreshToken: "refresh-token" }),
      }),
    );
    expect(getAuthUser()).toBeNull();
  });

  it("uses the backend error message when login is rejected", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: false,
          statusCode: 403,
          error: {
            code: "FORBIDDEN",
            message: "Operator registration is not approved.",
          },
        }),
        { status: 403 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      login({ email: "operator@vietride.vn", password: "secret123" }),
    ).rejects.toThrow("Operator registration is not approved.");
  });

  it("normalizes legacy roles from stored sessions", () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "user-1",
          email: "admin@vietride.vn",
          displayName: "Admin",
          phone: "0901234567",
          role: "admin",
        },
      }),
    );

    expect(getAuthUser()?.role).toBe("SYSTEM_ADMIN");
  });

  it("refreshes and stores a new auth session", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "old-access-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "user-1",
          email: "admin@vietride.vn",
          displayName: "Admin",
          phone: "0901234567",
          role: "SYSTEM_ADMIN",
        },
      }),
    );

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          statusCode: 0,
          message: "OK",
          data: {
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
            expiresInSeconds: 3600,
            user: {
              id: "user-1",
              email: "admin@vietride.vn",
              displayName: "Admin",
              phone: "0901234567",
              role: "SYSTEM_ADMIN",
            },
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await refreshAuthSession();

    expect(session?.accessToken).toBe("new-access-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/auth/refresh",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refreshToken: "refresh-token" }),
      }),
    );
  });

  it("shares a single refresh request across concurrent callers", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "old-access-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "user-1",
          email: "admin@vietride.vn",
          displayName: "Admin",
          phone: "0901234567",
          role: "SYSTEM_ADMIN",
        },
      }),
    );

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          statusCode: 0,
          message: "OK",
          data: {
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
            expiresInSeconds: 3600,
            user: {
              id: "user-1",
              email: "admin@vietride.vn",
              displayName: "Admin",
              phone: "0901234567",
              role: "SYSTEM_ADMIN",
            },
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const sessions = await Promise.all([
      refreshAuthSession(),
      refreshAuthSession(),
      refreshAuthSession(),
      refreshAuthSession(),
      refreshAuthSession(),
    ]);

    // Gọi nhiều lần nhưng chỉ được bắn đúng một request, nếu không BE sẽ coi
    // các lần sau là reuse và revoke toàn bộ token family.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    sessions.forEach((session) => {
      expect(session?.accessToken).toBe("new-access-token");
    });
  });
});
