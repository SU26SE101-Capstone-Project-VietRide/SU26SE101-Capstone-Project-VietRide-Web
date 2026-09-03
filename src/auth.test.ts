import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "./i18n";
import {
  clearAuthSession,
  getAuthUser,
  getHomePathForRole,
  login,
  logout,
  refreshAuthSession,
  register,
} from "./auth";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("auth", () => {
  beforeEach(() => {
    clearAuthSession();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/auth/login",
      expect.objectContaining({
        headers: expect.not.objectContaining({
          "Idempotency-Key": expect.any(String),
        }),
      }),
    );
  });

  it("registers with a UUID v4 idempotency key", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          statusCode: 201,
          message: "Registered",
          data: null,
        }),
        { status: 201 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await register({
      displayName: "Nguyen Van A",
      email: "user@vietride.vn",
      phone: "0901234567",
      password: "secret123",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/auth/register",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": expect.stringMatching(UUID_V4_PATTERN),
        }),
      }),
    );
  });

  // login/register không đi qua apiRequest nên trước đây bỏ qua bảng dịch,
  // khiến toast hiện nguyên văn tiếng Anh của BE.
  describe("dịch message lỗi theo error.code", () => {
    let originalLanguage: string;

    beforeEach(async () => {
      originalLanguage = i18n.language;
      await i18n.changeLanguage("vi");
    });

    afterEach(async () => {
      await i18n.changeLanguage(originalLanguage);
    });

    const errorEnvelope = (code: string, message: string, status: number) =>
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              statusCode: status,
              error: { code, message },
            }),
            { status },
          ),
      );

    it.each([
      [
        "AUTH_INVALID_CREDENTIALS",
        "Invalid email or password.",
        401,
        "Email hoặc mật khẩu không đúng.",
      ],
      [
        "AUTH_ACCOUNT_LOCKED",
        "Account is locked. Please contact support.",
        403,
        "Tài khoản đã bị khoá.",
      ],
    ])("login: %s", async (code, english, status, vietnamese) => {
      vi.stubGlobal("fetch", errorEnvelope(code, english, status));

      await expect(
        login({ email: "user@vietride.vn", password: "wrong-password" }),
      ).rejects.toThrow(vietnamese);
    });

    it("register: đọc error.message thay vì rơi về 'Register failed'", async () => {
      vi.stubGlobal(
        "fetch",
        errorEnvelope(
          "AUTH_EMAIL_ALREADY_REGISTERED",
          "Email is already registered.",
          409,
        ),
      );

      await expect(
        register({
          displayName: "Nguyen Van A",
          email: "user@vietride.vn",
          phone: "0901234567",
          password: "secret123",
        }),
      ).rejects.toThrow("Email này đã được đăng ký.");
    });

    it("giữ nguyên message tiếng Anh khi đang ở ngôn ngữ EN", async () => {
      await i18n.changeLanguage("en");
      vi.stubGlobal(
        "fetch",
        errorEnvelope("AUTH_INVALID_CREDENTIALS", "Invalid email or password.", 401),
      );

      await expect(
        login({ email: "user@vietride.vn", password: "wrong-password" }),
      ).rejects.toThrow("Invalid email or password.");
    });
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
        headers: expect.objectContaining({
          "Idempotency-Key": expect.stringMatching(UUID_V4_PATTERN),
        }),
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

  it("accepts operator staff and sends them to the read-only claim queue", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          statusCode: 200,
          data: {
            accessToken: "staff-access-token",
            refreshToken: "staff-refresh-token",
            expiresInSeconds: 3600,
            user: {
              id: "staff-1",
              email: "staff@vietride.vn",
              displayName: "Operator staff",
              phone: "0901234567",
              role: "OPERATOR_STAFF",
            },
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const session = await login({
      email: "staff@vietride.vn",
      password: "secret123",
    });

    expect(session.user.role).toBe("OPERATOR_STAFF");
    expect(getHomePathForRole(session.user.role)).toBe("/manager/claims");
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
        headers: expect.not.objectContaining({
          "Idempotency-Key": expect.any(String),
        }),
      }),
    );
  });

  it("uses the session refreshed by another tab while holding the refresh lock", async () => {
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

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", {
      locks: {
        request: vi.fn(async (_name: string, callback: () => Promise<unknown>) => {
          localStorage.setItem(
            "auth",
            JSON.stringify({
              accessToken: "other-tab-access-token",
              refreshToken: "other-tab-refresh-token",
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
          return callback();
        }),
      },
    });

    const session = await refreshAuthSession();

    expect(session?.accessToken).toBe("other-tab-access-token");
    expect(fetchMock).not.toHaveBeenCalled();
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
