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
});
