import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdminUser,
  lockInternalRoundTripSeats,
  registerOperator,
} from "./vietride";

describe("vietride API", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("creates an admin-managed user", async () => {
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
          data: {
            userId: "user-2",
            email: "manager@operator.vn",
            displayName: "Operator Manager",
            role: "OPERATOR_ADMIN",
            status: "ACTIVE",
          },
        }),
        { status: 201 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await createAdminUser({
      email: "manager@operator.vn",
      displayName: "Operator Manager",
      role: "OPERATOR_ADMIN",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/admin/users",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "manager@operator.vn",
          displayName: "Operator Manager",
          role: "OPERATOR_ADMIN",
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("registers an operator without an auth token", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: {
            operatorId: "operator-1",
            message: "Created",
          },
        }),
        { status: 201 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await registerOperator({
      name: "VietRide Express",
      contactEmail: "ops@operator.vn",
      contactPhone: "0901234567",
      businessRegistrationNumber: "0312345678",
      taxCode: "0301234567",
      addressStreet: "123 Nguyen Van Linh",
      addressWard: "Ward 1",
      addressDistrict: "District 1",
      addressProvince: "Ho Chi Minh City",
      representativeName: "Nguyen Van A",
      representativePosition: "Owner",
      representativePhone: "0901234567",
      representativeEmail: "owner@operator.vn",
      password: "secret123",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operators/register",
      expect.objectContaining({
        method: "POST",
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
      }),
    );
  });

  it("locks round-trip seats with an idempotency key", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: {
            outbound: {
              tripId: "trip-out",
              seatLockToken: "out-token",
              lockedSeats: ["A1"],
              expiresAt: "2026-06-23T10:00:00Z",
            },
            return: {
              tripId: "trip-back",
              seatLockToken: "back-token",
              lockedSeats: ["A1"],
              expiresAt: "2026-06-23T10:00:00Z",
            },
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await lockInternalRoundTripSeats(
      {
        outbound: {
          tripId: "trip-out",
          seatNumbers: ["A1"],
        },
        return: {
          tripId: "trip-back",
          seatNumbers: ["A1"],
        },
        holdOwnerId: "user-1",
        ttlSeconds: 300,
      },
      "idem-1",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/internal/v1/trips/round-trip/lock-seats",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-1",
        }),
      }),
    );
  });
});
