import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { ApiRequestError, apiRequest, buildQuery } from "./client";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("api client", () => {
  const originalLanguage = i18n.language;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await i18n.changeLanguage(originalLanguage);
  });

  it("preserves API error code and status", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: false,
          statusCode: 403,
          error: {
            code: "TRACKING_ACCESS_DENIED",
            message: "Tracking access denied.",
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = apiRequest("/v1/tracking/shuttle-trips/shuttle-1/latest");

    await expect(request).rejects.toBeInstanceOf(ApiRequestError);
    await expect(request).rejects.toMatchObject({
      status: 403,
      code: "TRACKING_ACCESS_DENIED",
      message: "Tracking access denied.",
    });
  });
  // Các service NestJS dùng code VALIDATION_FAILED (khác VALIDATION_ERROR của
  // .NET) nhưng cùng kiểu envelope: message top-level chung chung, lý do thật
  // nằm ở fields[]. Nếu không gộp hai code này thì toast chỉ hiện câu chung.
  it("uu tiên field message cho VALIDATION_FAILED", async () => {
    await i18n.changeLanguage("vi");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: false,
            statusCode: 400,
            error: {
              code: "VALIDATION_FAILED",
              message: "Validation failed",
              fields: [{ field: "email", message: "'Email' must not be empty." }],
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(apiRequest("/v1/operator/notifications")).rejects.toThrow(
      "Vui lòng nhập email.",
    );
  });

  it("parses field-level details from the error envelope", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: false,
          statusCode: 409,
          error: {
            code: "ROUTE_DUPLICATED",
            message: "Route already exists.",
            fields: [
              {
                field: "existingRouteId",
                message: "2829ae3f-97f8-49d1-9b1a-35623fd96d80",
              },
              "not-a-record",
            ],
          },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = apiRequest("/v1/operator/routes/full", {
      method: "POST",
      body: {},
    });

    await expect(request).rejects.toMatchObject({
      status: 409,
      code: "ROUTE_DUPLICATED",
      fields: [
        {
          field: "existingRouteId",
          message: "2829ae3f-97f8-49d1-9b1a-35623fd96d80",
        },
      ],
    });
  });

  it("defaults fields to an empty array when the error envelope has none", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: false,
          statusCode: 404,
          error: { code: "ROUTE_NOT_FOUND", message: "Route not found." },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/v1/operator/routes/missing")).rejects.toMatchObject(
      {
        code: "ROUTE_NOT_FOUND",
        fields: [],
      },
    );
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
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/admin/operators",
      expect.objectContaining({
        headers: expect.not.objectContaining({
          "Idempotency-Key": expect.any(String),
        }),
      }),
    );
  });

  it("posts JSON bodies with an idempotency key", async () => {
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
          "Idempotency-Key": expect.stringMatching(UUID_V4_PATTERN),
        }),
      }),
    );
  });

  it("preserves one operation key when a mutation is retried after 401", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "expired-access-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "user-1",
          email: "manager@vietride.vn",
          displayName: "Manager",
          phone: "0901234567",
          role: "OPERATOR_ADMIN",
        },
      }),
    );

    const mutationKeys: Array<string | null> = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/v1/operator/routes")) {
          mutationKeys.push(
            new Headers(init?.headers).get("Idempotency-Key"),
          );

          if (mutationKeys.length === 1) {
            return new Response(
              JSON.stringify({
                error: { message: "Access token expired." },
              }),
              { status: 401 },
            );
          }

          return new Response(JSON.stringify({ data: { id: "route-1" } }), {
            status: 201,
          });
        }

        return new Response(
          JSON.stringify({
            data: {
              accessToken: "new-access-token",
              refreshToken: "new-refresh-token",
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
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest<{ id: string }>("/v1/operator/routes", {
      method: "POST",
      body: { name: "Ho Chi Minh - Da Lat" },
    });

    expect(mutationKeys).toHaveLength(2);
    expect(mutationKeys[0]).toMatch(UUID_V4_PATTERN);
    expect(mutationKeys[1]).toBe(mutationKeys[0]);
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
