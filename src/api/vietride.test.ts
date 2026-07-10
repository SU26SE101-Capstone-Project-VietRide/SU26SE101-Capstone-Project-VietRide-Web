import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptOperatorVoucherConsent,
  activateAdminCampaign,
  activateOperatorDriverSchedule,
  approveRagDocument,
  chatWithRag,
  confirmOperatorParcelRefund,
  createAdminLocation,
  deleteAdminVoucher,
  createAdminUser,
  createOperatorDriverSchedule,
  createOperatorVoucher,
  createParcel,
  deactivateAdminCampaign,
  exportOperatorParcelReport,
  getAdminCampaigns,
  getAdminLocations,
  getAdminVoucherConsents,
  getAdminVouchers,
  getAvailableVouchers,
  getBookingHealth,
  getDriverMeSchedule,
  getInternalTripCargoCapacity,
  getInternalTripParcelAvailability,
  getOperatorRoute,
  getOperatorStop,
  getOperatorVehicle,
  getOperatorVoucherConsents,
  getOperatorVouchers,
  getOperatorParcelReportSummary,
  getParcelAvailableTrips,
  getPromotions,
  getPublicLocations,
  getPublicTrip,
  getPublicTripSeatMap,
  getRagDocuments,
  getRagFeedback,
  getRagRuntimeConfigs,
  getTrackingTripEta,
  getTrackingTripLatest,
  getTrackingTripTrail,
  getTripHealth,
  getVehicleTypes,
  lockInternalRoundTripSeats,
  overrideOperatorParcelCapacity,
  rejectOperatorVoucherConsent,
  remeasureInternalTripCargo,
  registerOperator,
  reloadRagRuntimeConfigs,
  requestForgotPassword,
  requestOperatorParcelTransfer,
  resetPassword,
  reviewOperatorParcel,
  returnOperatorParcel,
  reweighAssistantParcel,
  searchPublicTrips,
  updateAdminLocation,
  updateAdminVoucher,
  updateAlternativeRouteGeometry,
  updateOperatorVoucher,
  updateOperatorParcelStatus,
  updateOperatorRouteGeometry,
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

  it("creates an admin location", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "system-admin-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "admin-1",
          email: "admin@vietride.vn",
          displayName: "Admin",
          role: "SYSTEM_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: {
            id: "loc-1",
            name: "Mien Dong",
            latitude: 10.1,
            longitude: 106.1,
          },
        }),
        { status: 201 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await createAdminLocation({
      name: "Mien Dong",
      address: "292 Dinh Bo Linh",
      city: "Ho Chi Minh City",
      province: "Ho Chi Minh City",
      latitude: 10.1,
      longitude: 106.1,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/admin/locations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Mien Dong",
          address: "292 Dinh Bo Linh",
          city: "Ho Chi Minh City",
          province: "Ho Chi Minh City",
          latitude: 10.1,
          longitude: 106.1,
        }),
      }),
    );
  });

  it("creates and activates an operator driver schedule", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-admin-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-admin",
          email: "admin@operator.vn",
          displayName: "Operator Admin",
          role: "OPERATOR_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/activate")) {
        return new Response(
          JSON.stringify({
            data: {
              id: "schedule-1",
              routeId: "route-1",
              vehicleId: "vehicle-1",
              driverUserId: "driver-1",
              departureTime: "08:00:00",
              validFrom: "2026-07-11",
              isActive: true,
            },
          }),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify({
          data: {
            id: "schedule-1",
            routeId: "route-1",
            vehicleId: "vehicle-1",
            driverUserId: "driver-1",
            departureTime: "08:00:00",
            validFrom: "2026-07-11",
            isActive: false,
          },
        }),
        { status: 201 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await createOperatorDriverSchedule({
      routeId: "route-1",
      vehicleId: "vehicle-1",
      driverUserId: "driver-1",
      assistantUserId: "assistant-1",
      departureTime: "08:00:00",
      validFrom: "2026-07-11",
      validUntil: null,
      dayOfWeek: [1, 2, 3],
      isActive: true,
    });
    await activateOperatorDriverSchedule("schedule-1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/operator/driver-schedules",
      expect.objectContaining({
        body: JSON.stringify({
          routeId: "route-1",
          vehicleId: "vehicle-1",
          driverUserId: "driver-1",
          assistantUserId: "assistant-1",
          departureTime: "08:00:00",
          validFrom: "2026-07-11",
          validUntil: null,
          dayOfWeek: [1, 2, 3],
          isActive: true,
        }),
        method: "POST",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/operator/driver-schedules/schedule-1/activate",
      expect.objectContaining({
        method: "PATCH",
      }),
    );
  });

  it("calls new trip, geometry, and driver schedule endpoints", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "ops@operator.vn",
          displayName: "Ops",
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

    await getDriverMeSchedule({ page: 1, pageSize: 10 });
    await updateOperatorRouteGeometry("route-1", {
      pathPolyline: "abc",
    });
    await updateAlternativeRouteGeometry("alt-1", {
      pathPolyline: "def",
    });
    await getInternalTripParcelAvailability({ routeId: "route-1" });
    await getInternalTripCargoCapacity("trip-1");
    await remeasureInternalTripCargo("trip-1", {
      parcelId: "parcel-1",
      weightKg: 12,
      volumeM3: 0.5,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/driver/me/schedule?page=1&pageSize=10",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/operator/routes/route-1/geometry",
      expect.objectContaining({
        body: JSON.stringify({ pathPolyline: "abc" }),
        method: "PUT",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.vietride.online/v1/operator/alternative-routes/alt-1/geometry",
      expect.objectContaining({
        body: JSON.stringify({ pathPolyline: "def" }),
        method: "PUT",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.vietride.online/internal/v1/trips/parcel-availability?routeId=route-1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "https://api.vietride.online/internal/v1/trips/trip-1/cargo/capacity",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "https://api.vietride.online/internal/v1/trips/trip-1/cargo/remeasure",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls trip and booking endpoints used by the three dashboard roles", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "role-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "user-1",
          email: "admin@vietride.vn",
          displayName: "Admin",
          role: "SYSTEM_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ data: { items: [] } }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await getAdminLocations({ page: 1, pageSize: 20, search: "HCM" });
    await updateAdminLocation("location-1", {
      name: "Ho Chi Minh",
      latitude: 10.8,
      longitude: 106.7,
    });
    await getOperatorStop("stop-1");
    await getOperatorRoute("route-1");
    await getOperatorVehicle("vehicle-1");
    await getVehicleTypes({ page: 1, pageSize: 20, search: "BUS" });
    await getPublicLocations();
    await searchPublicTrips({
      originStationId: "station-a",
      destinationStationId: "station-b",
      departureDate: "2026-07-20",
      passengerCount: 1,
    });
    await getPublicTrip("trip-1");
    await getPublicTripSeatMap("trip-1");
    await getTripHealth();
    await getBookingHealth();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/admin/locations?page=1&pageSize=20&search=HCM",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/admin/locations/location-1",
      expect.objectContaining({
        body: JSON.stringify({
          name: "Ho Chi Minh",
          latitude: 10.8,
          longitude: 106.7,
        }),
        method: "PATCH",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.vietride.online/v1/operator/stops/stop-1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.vietride.online/v1/operator/routes/route-1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "https://api.vietride.online/v1/operator/vehicles/vehicle-1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "https://api.vietride.online/v1/vehicle-types?page=1&pageSize=20&search=BUS",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "https://api.vietride.online/v1/locations",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      "https://api.vietride.online/v1/trips/search?originStationId=station-a&destinationStationId=station-b&departureDate=2026-07-20&passengerCount=1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      9,
      "https://api.vietride.online/v1/trips/trip-1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      10,
      "https://api.vietride.online/v1/trips/trip-1/seat-map",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      11,
      "https://api.vietride.online/v1/trip/health",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      12,
      "https://api.vietride.online/v1/booking/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("calls public forgot and reset password endpoints", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: {
            email: "ops@operator.vn",
            otpTtlMinutes: 5,
            status: "ACTIVE",
            userId: "user-1",
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await requestForgotPassword({ email: "ops@operator.vn" });
    await resetPassword({
      email: "ops@operator.vn",
      code: "123456",
      newPassword: "Password123",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/auth/forgot-password",
      expect.objectContaining({
        body: JSON.stringify({ email: "ops@operator.vn" }),
        method: "POST",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/auth/reset-password",
      expect.objectContaining({
        body: JSON.stringify({
          email: "ops@operator.vn",
          code: "123456",
          newPassword: "Password123",
        }),
        method: "POST",
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

  it("creates and updates operator vouchers with service scope", async () => {
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
            id: "voucher-1",
            code: "OP-PARCEL",
            name: "Parcel discount",
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await createOperatorVoucher({
      code: "OP-PARCEL",
      name: "Parcel discount",
      type: "PERCENT_OFF",
      value: 10,
      minOrderAmount: 50000,
      maxDiscountAmount: 20000,
      totalUsageLimit: 100,
      perUserLimit: 1,
      validFrom: "2026-07-01T00:00:00.000Z",
      validUntil: "2026-07-31T16:59:59.000Z",
      applicableServices: ["PARCEL"],
      applicableRouteIds: [],
      fundingType: "OPERATOR_FUNDED",
    });
    await updateOperatorVoucher("voucher-1", {
      name: "Parcel discount updated",
      value: 15,
      minOrderAmount: 60000,
      maxDiscountAmount: 25000,
      totalUsageLimit: 120,
      perUserLimit: 1,
      validFrom: "2026-07-01T00:00:00.000Z",
      validUntil: "2026-08-31T16:59:59.000Z",
      applicableRouteIds: [],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/operator/vouchers",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"applicableServices":["PARCEL"]'),
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/operator/vouchers/voucher-1",
      expect.objectContaining({
        method: "PATCH",
        body: expect.not.stringContaining("applicableServices"),
      }),
    );
  });

  it("calls operator voucher consent APIs for operator roles", async () => {
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
      return new Response(
        JSON.stringify({
          data: {
            items: [],
            page: 1,
            pageSize: 20,
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

    await getOperatorVoucherConsents("PENDING");

    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-admin-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "user-2",
          email: "admin@operator.vn",
          displayName: "Operator Admin",
          role: "OPERATOR_ADMIN",
        },
      }),
    );
    await acceptOperatorVoucherConsent("consent-1");
    await rejectOperatorVoucherConsent("consent-1", "Not suitable");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/operator/voucher-consents?status=PENDING",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer operator-staff-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/operator/voucher-consents/consent-1/accept",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer operator-admin-token",
          "Idempotency-Key": expect.any(String),
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.vietride.online/v1/operator/voucher-consents/consent-1/reject",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Not suitable" }),
        headers: expect.objectContaining({
          Authorization: "Bearer operator-admin-token",
          "Idempotency-Key": expect.any(String),
        }),
      }),
    );
  });

  it("calls admin voucher consent and campaign APIs for system admin", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "system-admin-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "user-1",
          email: "admin@vietride.vn",
          displayName: "System Admin",
          role: "SYSTEM_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: {
            items: [],
            page: 1,
            pageSize: 20,
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

    await getAdminVouchers({ page: 1, pageSize: 20, fundingType: "OPERATOR_FUNDED" });
    await updateAdminVoucher("voucher-1", {
      name: "Summer parcel",
      value: 15,
      minOrderAmount: 50000,
      maxDiscountAmount: 30000,
      totalUsageLimit: 2000,
      perUserLimit: 2,
      validUntil: "2026-08-31T16:59:59.000Z",
      newUserOnly: false,
      applicablePaymentMethods: ["VNPAY"],
      applicableServices: ["PARCEL"],
      applicableRouteIds: null,
    });
    await deleteAdminVoucher("voucher-1");
    await getAdminVoucherConsents("voucher-1", { page: 1, pageSize: 20 });
    await getAdminCampaigns();
    await activateAdminCampaign("campaign-1");
    await deactivateAdminCampaign("campaign-1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/admin/vouchers?page=1&pageSize=20&fundingType=OPERATOR_FUNDED",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer system-admin-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/admin/vouchers/voucher-1",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"applicableServices":["PARCEL"]'),
        headers: expect.objectContaining({
          "Idempotency-Key": expect.any(String),
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.vietride.online/v1/admin/vouchers/voucher-1",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          "Idempotency-Key": expect.any(String),
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.vietride.online/v1/admin/vouchers/voucher-1/consents?page=1&pageSize=20",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "https://api.vietride.online/v1/admin/campaigns",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "https://api.vietride.online/v1/admin/campaigns/campaign-1/activate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": expect.any(String),
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "https://api.vietride.online/v1/admin/campaigns/campaign-1/deactivate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": expect.any(String),
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
      lengthCm: 50,
      widthCm: 30,
      heightCm: 20,
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
      "https://api.vietride.online/v1/parcels/available-trips?originStationId=station-a&destinationStationId=station-b&departureDate=2026-07-20&lengthCm=50&widthCm=30&heightCm=20&estimatedWeightKg=5&sizeCategory=MEDIUM&page=1&pageSize=10",
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
    await exportOperatorParcelReport({
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
    await confirmOperatorParcelRefund(
      "parcel-1",
      { reason: "Refund confirmed by operator" },
      "refund-idem-1",
    );
    await overrideOperatorParcelCapacity(
      "parcel-1",
      { reason: "Manual capacity verified" },
      "capacity-idem-1",
    );
    await requestOperatorParcelTransfer(
      "parcel-1",
      {
        targetTripId: "trip-2",
        reason: "Trip disrupted",
      },
      "transfer-idem-1",
    );
    await returnOperatorParcel(
      "parcel-1",
      { returnReason: "Recipient unavailable" },
      "return-idem-1",
    );
    await updateOperatorParcelStatus(
      "parcel-1",
      {
        targetStatus: "RETURNED",
        reason: "Returned at counter",
      },
      "status-idem-1",
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
      "https://api.vietride.online/v1/operator/parcels/reports/export?format=csv&from=2026-07-01&to=2026-07-31",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "text/csv",
          Authorization: "Bearer operator-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.vietride.online/v1/operator/parcels/parcel-1/review",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
          "Idempotency-Key": "review-idem-1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.vietride.online/v1/operator/parcels/parcel-1/confirm-refund",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Refund confirmed by operator" }),
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
          "Idempotency-Key": "refund-idem-1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "https://api.vietride.online/v1/operator/parcels/parcel-1/override-capacity",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Manual capacity verified" }),
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
          "Idempotency-Key": "capacity-idem-1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "https://api.vietride.online/v1/operator/parcels/parcel-1/request-transfer",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          targetTripId: "trip-2",
          reason: "Trip disrupted",
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
          "Idempotency-Key": "transfer-idem-1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "https://api.vietride.online/v1/operator/parcels/parcel-1/return",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ returnReason: "Recipient unavailable" }),
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
          "Idempotency-Key": "return-idem-1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      "https://api.vietride.online/v1/operator/parcels/parcel-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          targetStatus: "RETURNED",
          reason: "Returned at counter",
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
          "Idempotency-Key": "status-idem-1",
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
        actualLengthCm: 35,
        actualWidthCm: 25,
        actualHeightCm: 18,
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
          actualLengthCm: 35,
          actualWidthCm: 25,
          actualHeightCm: 18,
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

  it("calls RAG APIs for system admin", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "system-admin-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "user-1",
          email: "admin@vietride.vn",
          displayName: "System Admin",
          role: "SYSTEM_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.headers && JSON.stringify(init.headers).includes("text/event-stream")) {
        return new Response("event: done\ndata: {}\n\n", { status: 200 });
      }

      return new Response(
        JSON.stringify({
          data: {
            items: [],
            page: 1,
            pageSize: 20,
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

    await chatWithRag({ message: "Chính sách hủy vé là gì?" });
    await getRagDocuments({
      page: 1,
      pageSize: 20,
      status: "APPROVED",
      accessLevel: "PUBLIC",
    });
    await getRagFeedback({ page: 1, pageSize: 20 });
    await approveRagDocument("77777777-7777-4777-8777-777777777777");
    await getRagRuntimeConfigs();
    await reloadRagRuntimeConfigs();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/rag/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "text/event-stream",
          Authorization: "Bearer system-admin-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/rag/documents?page=1&pageSize=20&status=APPROVED&accessLevel=PUBLIC",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.vietride.online/v1/rag/feedback?page=1&pageSize=20",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.vietride.online/v1/rag/documents/77777777-7777-4777-8777-777777777777/approve",
      expect.objectContaining({
        method: "PUT",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "https://api.vietride.online/v1/admin/rag-config",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "https://api.vietride.online/v1/admin/rag-config/reload",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("calls Tracking APIs for operator roles", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
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
      return new Response(
        JSON.stringify({
          data: {
            items: [],
            page: 1,
            pageSize: 20,
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

    await getTrackingTripLatest("11111111-1111-4111-8111-111111111111");
    await getTrackingTripTrail("11111111-1111-4111-8111-111111111111", {
      page: 1,
      pageSize: 20,
      sortBy: "recordedAt",
      sortDir: "desc",
    });
    await getTrackingTripEta(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/tracking/trips/11111111-1111-4111-8111-111111111111/latest",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/tracking/trips/11111111-1111-4111-8111-111111111111/trail?page=1&pageSize=20&sortBy=recordedAt&sortDir=desc",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.vietride.online/v1/tracking/trips/11111111-1111-4111-8111-111111111111/eta?stopId=22222222-2222-4222-8222-222222222222",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });
});
