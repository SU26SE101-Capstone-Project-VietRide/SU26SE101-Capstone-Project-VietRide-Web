import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdminUser,
  createParcel,
  getAvailableVouchers,
  getOperatorVouchers,
  getOperatorParcelReportSummary,
  getParcelAvailableTrips,
  getPromotions,
  lockInternalRoundTripSeats,
  registerOperator,
  reviewOperatorParcel,
  reweighAssistantParcel,
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

  it("loads public promotions without an auth token", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: [
            {
              voucherId: "voucher-1",
              code: "BOOK10",
              name: "Booking promotion",
              type: "PERCENT_OFF",
              value: 10,
              applicableServices: ["BOOKING"],
              validUntil: "2026-07-31T16:59:59Z",
            },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await getPromotions("BOOKING");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/promotions?service=BOOKING",
      expect.objectContaining({
        method: "GET",
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
      }),
    );
  });

  it("loads available vouchers with query filters for an authenticated user", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-staff-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "user-1",
          email: "staff@operator.vn",
          displayName: "Operator Staff",
          role: "OPERATOR_STAFF",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await getAvailableVouchers({
      service: "BOOKING",
      tripId: "trip-1",
      paymentMethod: "VNPAY",
      orderAmount: 100000,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/vouchers/available?service=BOOKING&tripId=trip-1&paymentMethod=VNPAY&orderAmount=100000",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer operator-staff-token",
        }),
      }),
    );
  });

  it("loads operator vouchers for the manager role", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "user-1",
          email: "manager@operator.vn",
          displayName: "Operator Manager",
          role: "OPERATOR_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: {
            items: [],
            page: 1,
            pageSize: 100,
            totalItems: 0,
            totalPages: 0,
            hasPreviousPage: false,
            hasNextPage: false,
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await getOperatorVouchers({ page: 1, pageSize: 100 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operator/vouchers?page=1&pageSize=100",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
        }),
      }),
    );
  });

  it("calls passenger parcel APIs with auth and idempotency headers", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "passenger-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "user-1",
          email: "customer@vietride.vn",
          displayName: "Customer",
          role: "OPERATOR_STAFF",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ data: { items: [] } }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await getParcelAvailableTrips({
      originStationId: "station-a",
      destinationStationId: "station-b",
      departureDate: "2026-07-20",
      estimatedWeightKg: 5,
      sizeCategory: "MEDIUM",
      page: 1,
      pageSize: 10,
    });
    await createParcel(
      {
        tripId: "trip-1",
        itemName: "Documents",
        description: "Signed papers",
        sizeCategory: "MEDIUM",
        estimatedWeightKg: 5,
        recipient: {
          fullName: "Nguyen Van B",
          phoneNumber: "0901234567",
        },
        deliveryMethod: "TERMINAL_PICKUP",
        paymentMethod: "VNPAY",
      },
      "parcel-idem-1",
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/parcels/available-trips?originStationId=station-a&destinationStationId=station-b&departureDate=2026-07-20&estimatedWeightKg=5&sizeCategory=MEDIUM&page=1&pageSize=10",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer passenger-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/parcels",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer passenger-token",
          "Idempotency-Key": "parcel-idem-1",
        }),
      }),
    );
  });

  it("calls operator parcel report and review APIs for operator admin", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "user-1",
          email: "manager@operator.vn",
          displayName: "Operator Manager",
          role: "OPERATOR_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: {
            parcelId: "parcel-1",
            status: "APPROVED",
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await getOperatorParcelReportSummary({
      from: "2026-07-01",
      to: "2026-07-31",
    });
    await reviewOperatorParcel(
      "parcel-1",
      {
        decision: "APPROVED",
        depositAmount: 50000,
        paymentMethod: "VNPAY",
      },
      "review-idem-1",
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/operator/parcels/reports/summary?from=2026-07-01&to=2026-07-31",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/operator/parcels/parcel-1/review",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
          "Idempotency-Key": "review-idem-1",
        }),
      }),
    );
  });

  it("calls assistant parcel reweigh API with assistant auth", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "assistant-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "user-1",
          email: "assistant@operator.vn",
          displayName: "Trip Assistant",
          role: "OPERATOR_STAFF",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: {
            parcelId: "parcel-1",
            status: "REWEIGHED",
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await reweighAssistantParcel(
      "parcel-1",
      {
        actualWeightKg: 7,
        actualSizeCategory: "LARGE",
        paymentMethod: "VNPAY",
      },
      "assistant-idem-1",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/assistant/parcels/parcel-1/reweigh",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          actualWeightKg: 7,
          actualSizeCategory: "LARGE",
          paymentMethod: "VNPAY",
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer assistant-token",
          "Idempotency-Key": "assistant-idem-1",
        }),
      }),
    );
  });
});
