import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, buildQuery } from "./client";

describe("api client", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("builds query strings without empty values", () => {
    expect(
      buildQuery({
        page: 1,
        pageSize: 20,
        search: "",
        status: "PENDING",
        operatorId: undefined,
      }),
    ).toBe("?page=1&pageSize=20&status=PENDING");
  });

  it("unwraps API data and sends bearer token", async () => {
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

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          statusCode: 200,
          message: "OK",
          data: { operatorId: "op-1" },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await apiRequest<{ operatorId: string }>("/v1/admin/operators");

    expect(data.operatorId).toBe("op-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/admin/operators",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("posts JSON bodies", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ data: { ok: true } }), {
        status: 201,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest<{ ok: boolean }>("/v1/operators/register", {
      method: "POST",
      body: { name: "VietRide" },
      authenticated: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operators/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "VietRide" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("refreshes an expired token and retries the request once", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "expired-access-token",
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

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            statusCode: 401,
            error: {
              code: "AUTH_TOKEN_INVALID",
              message:
                "Authorization header is required or access token is invalid.",
            },
          }),
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
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
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { operatorId: "op-1" } }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const data = await apiRequest<{ operatorId: string }>("/v1/admin/operators");

    expect(data.operatorId).toBe("op-1");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/auth/refresh",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refreshToken: "refresh-token" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.vietride.online/v1/admin/operators",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer new-access-token",
        }),
      }),
    );
  });
});
