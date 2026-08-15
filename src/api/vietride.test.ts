import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptOperatorVoucherConsent,
  activateAdminCampaign,
  activateOperatorDriverSchedule,
  approveRagDocument,
  checkDriverScheduleAvailability,
  checkShuttleTripAvailability,
  updateOperatorDriverScheduleCrew,
  batchUpdateOperatorParcelRouteFares,
  chatWithRag,
  confirmOperatorParcelRefund,
  createAdminSubscriptionPlan,
  createAdminLocation,
  createAdminPolicy,
  deleteAdminPolicy,
  deleteAdminVoucher,
  createAdminUser,
  createOperatorDriverSchedule,
  createOperatorRouteFull,
  createOperatorVoucher,
  createParcel,
  deactivateAdminCampaign,
  deactivateOperatorDriverSchedule,
  deleteOperatorDriverSchedule,
  exportOperatorReport,
  exportOperatorParcelReport,
  getAdminCampaigns,
  getAdminDashboardSummary,
  getAdminActivityLogs,
  getAdminOutboxDlq,
  getAdminPlatformWallet,
  getAdminPlatformReport,
  getAdminPlatformWalletTransactions,
  getAdminPolicies,
  getAdminRevenueAnalytics,
  getAdminStations,
  getAdminStationSummary,
  getAdminTripSettlements,
  getAdminLocations,
  getAdminSubscriptionPlans,
  getAdminUsers,
  getAdminVoucherConsents,
  getAdminVouchers,
  getAvailableVouchers,
  getBookingHealth,
  getDriverMeSchedule,
  getFirebaseCustomToken,
  getInternalTripCargoCapacity,
  getInternalTripParcelAvailability,
  getOperatorRoute,
  getOperatorRoutes,
  getOperatorVoucherSummary,
  getAdminVoucherSummary,
  getOperatorParcelRouteFares,
  getOperatorParcelRouteFareSummary,
  getAdminOperatorSummary,
  exportAdminOperators,
  getOperatorRouteStopMetrics,
  getOperatorDriverSchedules,
  getOperatorFleetLatest,
  getOperatorShuttleContext,
  getOperatorIncident,
  getOperatorIncidents,
  getOperatorShuttleRequests,
  getOperatorShuttleTrips,
  cancelOperatorShuttleRequest,
  cancelOperatorShuttleTrip,
  getOperatorInvoice,
  getOperatorInvoices,
  getOperatorBooking,
  getOperatorBookings,
  getOperatorLedger,
  getNotifications,
  getOperatorSubscription,
  getOperatorSubscriptionPlans,
  getVnPayReturnStatus,
  getOperatorTripSettlements,
  getOperatorWallet,
  getOperatorWalletTransactions,
  getOperatorStations,
  getOperatorStop,
  getOperatorVehicle,
  getOperatorVoucherConsents,
  getOperatorVouchers,
  getOperatorParcel,
  getOperatorParcelReportSummary,
  getOperatorParcelStats,
  getOperatorParcels,
  getOperatorPolicies,
  getOperatorRevenueAnalytics,
  getOperatorTrips,
  getParcelAvailableTrips,
  getPromotions,
  getPublicLocations,
  getPublicTrip,
  getPublicTripSeatMap,
  getRagDocuments,
  getRagFeedback,
  getRagRuntimeConfigs,
  getTrackingTripEta,
  getTrackingTripEtas,
  getTrackingTripLatest,
  getTrackingTripTrail,
  getTripHealth,
  getVehicleTypes,
  lockInternalRoundTripSeats,
  lockAdminUser,
  markNotificationRead,
  sendOperatorNotification,
  mergeAdminStations,
  downloadOperatorInvoice,
  adjustAdminOperatorWallet,
  adjustAdminPlatformWallet,
  overrideOperatorParcelCapacity,
  rejectOperatorVoucherConsent,
  remeasureInternalTripCargo,
  registerOperator,
  reloadRagRuntimeConfigs,
  resendVerificationEmail,
  requestForgotPassword,
  requestOperatorParcelTransfer,
  resendOperatorParcelDeliveryEmail,
  resetPassword,
  resolveOperatorIncident,
  reviewOperatorParcel,
  returnOperatorParcel,
  disruptOperatorTripNoSubstitution,
  reweighAssistantParcel,
  searchPublicTrips,
  searchStations,
  settleAdminTripSettlement,
  updateAdminLocation,
  updateAdminPolicy,
  updateAdminStation,
  updateAdminSubscriptionPlan,
  updateAdminVoucher,
  deleteAlternativeRoute,
  setAlternativeRouteActive,
  updateAlternativeRouteGeometry,
  updateOperatorVoucher,
  updateOperatorDriverSchedule,
  updateOperatorParcelStatus,
  updateOperatorRouteFull,
  updateOperatorRouteGeometry,
  retryAdminInvoice,
  substituteOperatorTripVehicle,
  retryOperatorSubscriptionPayment,
  upgradeOperatorSubscription,
  unlockAdminUser,
} from "./vietride";

function setOperatorAdminSession() {
  localStorage.setItem(
    "auth",
    JSON.stringify({
      accessToken: "operator-token",
      refreshToken: "refresh-token",
      expiresInSeconds: 3600,
      user: {
        id: "operator-1",
        email: "ops@operator.vn",
        displayName: "Operator Admin",
        role: "OPERATOR_ADMIN",
      },
    }),
  );
}

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

  it("lists admin users with Day 40 filters and maps API id to userId", async () => {
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
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            items: [
              {
                id: "user-1",
                email: "passenger@example.test",
                displayName: "Test Passenger",
                role: "PASSENGER",
                status: "ACTIVE",
                operatorId: null,
              },
            ],
            page: 2,
            pageSize: 20,
            totalItems: 21,
            totalPages: 2,
            hasNextPage: false,
            hasPreviousPage: true,
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAdminUsers({
      search: "passenger",
      role: "PASSENGER",
      status: "ACTIVE",
      includeDeleted: true,
      page: 2,
      pageSize: 20,
      sortBy: "displayName",
      sortDir: "asc",
    });

    expect(result.items[0]?.userId).toBe("user-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/admin/users?search=passenger&role=PASSENGER&status=ACTIVE&includeDeleted=true&page=2&pageSize=20&sortBy=displayName&sortDir=asc",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer system-admin-token",
        }),
      }),
    );
  });

  it("calls Day 40 admin mutations, audit query, and platform report", async () => {
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
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return new Response(JSON.stringify({ data: {} }), { status: 200 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await lockAdminUser("user-1", "lock-key");
    await unlockAdminUser("user-1", "unlock-key");
    await getAdminActivityLogs({
      userId: "admin-1",
      action: "LOCK_USER",
      from: "2026-07-17T00:00:00Z",
      to: "2026-07-18T00:00:00Z",
      page: 1,
      pageSize: 20,
    });
    await updateAdminStation(
      "station-1",
      {
        name: "Ben xe Mien Dong",
        city: "Thành phố Hồ Chí Minh",
        ward: "Phường Bến Nghé",
        supportsShuttle: true,
      },
      "station-key",
    );
    await mergeAdminStations("station-1", "station-2", "merge-key");
    await getAdminPlatformReport({
      from: "2026-07-01T00:00:00Z",
      to: "2026-07-18T00:00:00Z",
    });

    const expectedUrls = [
      "https://api.vietride.online/v1/admin/users/user-1/lock",
      "https://api.vietride.online/v1/admin/users/user-1/unlock",
      "https://api.vietride.online/v1/admin/activity-logs?userId=admin-1&action=LOCK_USER&from=2026-07-17T00%3A00%3A00Z&to=2026-07-18T00%3A00%3A00Z&page=1&pageSize=20",
      "https://api.vietride.online/v1/admin/stations/station-1",
      "https://api.vietride.online/v1/admin/stations/station-1/merge",
      "https://api.vietride.online/v1/admin/reports/platform?from=2026-07-01T00%3A00%3A00Z&to=2026-07-18T00%3A00%3A00Z",
    ];

    expectedUrls.forEach((url, index) => {
      expect(fetchMock.mock.calls[index]?.[0]).toBe(url);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expectedUrls[0],
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Idempotency-Key": "lock-key" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expectedUrls[1],
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Idempotency-Key": "unlock-key" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      expectedUrls[3],
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Ben xe Mien Dong",
          city: "Thành phố Hồ Chí Minh",
          ward: "Phường Bến Nghé",
          supportsShuttle: true,
        }),
        headers: expect.objectContaining({ "Idempotency-Key": "station-key" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      expectedUrls[4],
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ duplicateId: "station-2" }),
        headers: expect.objectContaining({ "Idempotency-Key": "merge-key" }),
      }),
    );
  });

  it("calls Day 41 operator XLSX exports and the Day 43 admin DLQ facade", async () => {
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
          role: "SYSTEM_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL) => {
        if (String(input).includes("/v1/admin/outbox/dlq")) {
          return new Response(
            JSON.stringify({
              data: {
                items: [],
                nextCursor: null,
                unavailableServices: [],
              },
            }),
            { status: 200 },
          );
        }

        return new Response("xlsx-content", {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const reportTypes = [
      "bookings",
      "parcels",
      "revenue",
      "occupancy",
      "cancellation",
      "refunds",
    ] as const;

    for (const reportType of reportTypes) {
      await exportOperatorReport(reportType, {
        from: "2026-07-01",
        to: "2026-07-18",
      });
    }

    await getAdminOutboxDlq({
      cursor: "opaque-cursor",
      pageSize: 50,
      service: "booking",
      eventType: "booking.booking_confirmed",
      sortDir: "desc",
    });

    reportTypes.forEach((reportType, index) => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        index + 1,
        `https://api.vietride.online/v1/operator/reports/${reportType}/export?from=2026-07-01&to=2026-07-18`,
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Accept:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            Authorization: "Bearer access-token",
          }),
        }),
      );
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "https://api.vietride.online/v1/admin/outbox/dlq?cursor=opaque-cursor&pageSize=50&service=booking&eventType=booking.booking_confirmed&sortDir=desc",
      expect.objectContaining({
        method: "GET",
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
      code: "HCM",
      name: "Ho Chi Minh City",
      type: "MUNICIPALITY",
      sortOrder: 1,
      isActive: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/admin/locations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          code: "HCM",
          name: "Ho Chi Minh City",
          type: "MUNICIPALITY",
          sortOrder: 1,
          isActive: true,
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
      baseFare: 275_000,
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
          baseFare: 275_000,
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

  it("loads operator stations and driver schedules", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "ops@operator.vn",
          displayName: "Operator Admin",
          role: "OPERATOR_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ data: { items: [] } }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await getOperatorStations({ page: 1, pageSize: 100, search: "Mien Dong" });
    await getOperatorDriverSchedules({
      page: 1,
      pageSize: 100,
      routeId: "route-1",
      driverUserId: "driver-1",
      isActive: true,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/operator/stations?page=1&pageSize=100&search=Mien+Dong",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/operator/driver-schedules?page=1&pageSize=100&routeId=route-1&driverUserId=driver-1&isActive=true",
      expect.objectContaining({ method: "GET" }),
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

    // Endpoint lọc theo khoảng ngày, không phân trang (handoff mục 10.1).
    await getDriverMeSchedule({ from: "2026-08-11", to: "2026-08-25" });
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
      "https://api.vietride.online/v1/driver/me/schedule?from=2026-08-11&to=2026-08-25",
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

  // Tuyến thay thế xoá MỀM: DELETE chỉ hạ isActive, khôi phục bằng PATCH partial
  // chỉ có mỗi `isActive` (BE giữ nguyên tên/bến/km/phút/stop/polyline đã lưu).
  it("deactivates and restores an alternative route without touching its other fields", async () => {
    setOperatorAdminSession();
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { isActive: true } }), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await deleteAlternativeRoute("alt-1");
    await setAlternativeRouteActive("alt-1", true);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/operator/alternative-routes/alt-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/operator/alternative-routes/alt-1",
      expect.objectContaining({
        body: JSON.stringify({ isActive: true }),
        method: "PATCH",
      }),
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
      name: "Ho Chi Minh City",
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
        body: JSON.stringify({ name: "Ho Chi Minh City" }),
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

  it("searches public stations with the city/ward contract", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchStations({
      q: "Bến Thành",
      city: "Thành phố Hồ Chí Minh",
      ward: "Phường Bến Nghé",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/stations/search?q=B%E1%BA%BFn+Th%C3%A0nh&city=Th%C3%A0nh+ph%E1%BB%91+H%E1%BB%93+Ch%C3%AD+Minh&ward=Ph%C6%B0%E1%BB%9Dng+B%E1%BA%BFn+Ngh%C3%A9",
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

  it("resends the registration verification code", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: null }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await resendVerificationEmail({
      email: "ops@operator.vn",
      purpose: "REGISTRATION",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/auth/resend-verification-email",
      expect.objectContaining({
        body: JSON.stringify({
          email: "ops@operator.vn",
          purpose: "REGISTRATION",
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
      addressProvince: "Ho Chi Minh City",
      representativeName: "Nguyen Van A",
      representativePhone: "0901234567",
      password: "secret123",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operators/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "VietRide Express",
          contactEmail: "ops@operator.vn",
          contactPhone: "0901234567",
          businessRegistrationNumber: "0312345678",
          taxCode: "0301234567",
          addressStreet: "123 Nguyen Van Linh",
          addressWard: "Ward 1",
              addressProvince: "Ho Chi Minh City",
          representativeName: "Nguyen Van A",
          representativePhone: "0901234567",
          password: "secret123",
        }),
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
    await getAdminVoucherConsents("voucher-1");
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
      "https://api.vietride.online/v1/admin/vouchers/voucher-1/consents",
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
        reason: "Approved against route fare snapshot",
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

  it("gửi đúng allow-list mới của các list endpoint đã siết strict-query", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "system-admin-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "admin-1",
          email: "admin@vietride.vn",
          displayName: "System Admin",
          role: "SYSTEM_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async (input: string) => {
      void input;
      return Response.json({ success: true, data: {} }, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await getAdminStations({
      page: 1,
      pageSize: 20,
      search: "mien dong",
      isActive: true,
      supportsShuttle: true,
      sortBy: "updatedAt",
      sortDir: "desc",
    });
    await getAdminStationSummary();
    await getAdminLocations({
      page: 1,
      pageSize: 50,
      type: "WARD",
      parentCode: "79",
      isActive: true,
    });
    await getAdminVouchers({ page: 1, pageSize: 20, service: "BOOKING" });
    await getOperatorRoutes({ page: 1, pageSize: 20, isActive: false });

    const urls = fetchMock.mock.calls.map((call) => call[0]);
    expect(urls[0]).toBe(
      "https://api.vietride.online/v1/admin/stations?page=1&pageSize=20&search=mien+dong&isActive=true&supportsShuttle=true&sortBy=updatedAt&sortDir=desc",
    );
    expect(urls[1]).toBe(
      "https://api.vietride.online/v1/admin/stations/summary",
    );
    expect(urls[2]).toBe(
      "https://api.vietride.online/v1/admin/locations?page=1&pageSize=50&type=WARD&parentCode=79&isActive=true",
    );
    expect(urls[3]).toBe(
      "https://api.vietride.online/v1/admin/vouchers?page=1&pageSize=20&service=BOOKING",
    );
    // `/v1/operator/routes` không nhận `status` — chỉ boolean `isActive`
    expect(urls[4]).toBe(
      "https://api.vietride.online/v1/operator/routes?page=1&pageSize=20&isActive=false",
    );
  });

  it("gửi đúng query của đợt search/filter enhancements P0-P2", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "system-admin-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "admin-1",
          email: "admin@vietride.vn",
          displayName: "System Admin",
          role: "SYSTEM_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async (input: string) => {
      void input;
      return Response.json({ success: true, data: {} }, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await getOperatorVouchers({
      page: 1,
      pageSize: 20,
      type: "PERCENT_OFF",
      validAt: "2026-08-14",
      sortBy: "usedCount",
      sortDir: "desc",
    });
    await getOperatorVoucherSummary();
    await getAdminVoucherSummary();
    await getOperatorParcelRouteFares({
      page: 1,
      pageSize: 20,
      effectiveAt: "2026-08-14",
      status: "ACTIVE",
      sortBy: "priceVnd",
      sortDir: "asc",
    });
    await getOperatorParcelRouteFareSummary();
    await getOperatorParcels({
      page: 1,
      pageSize: 20,
      search: "Nguyen Van A",
      from: "2026-08-01",
      to: "2026-08-14",
      dateField: "finalPaymentDeadline",
      sizeCategory: "LARGE",
      routeId: "route-1",
      sortBy: "finalPaymentDeadline",
      sortDir: "asc",
    });
    await getOperatorDriverSchedules({
      page: 1,
      pageSize: 20,
      dayOfWeek: 5,
      departureFrom: "05:00",
      departureTo: "11:00",
      effectiveAt: "2026-08-14",
      sortBy: "departureTime",
      sortDir: "asc",
    });
    await getAdminOperatorSummary();

    const urls = fetchMock.mock.calls.map((call) => call[0]);
    const base = "https://api.vietride.online";
    expect(urls[0]).toBe(
      `${base}/v1/operator/vouchers?page=1&pageSize=20&type=PERCENT_OFF&validAt=2026-08-14&sortBy=usedCount&sortDir=desc`,
    );
    expect(urls[1]).toBe(`${base}/v1/operator/vouchers/summary`);
    expect(urls[2]).toBe(`${base}/v1/admin/vouchers/summary`);
    expect(urls[3]).toBe(
      `${base}/v1/operator/parcel-route-fares?page=1&pageSize=20&effectiveAt=2026-08-14&status=ACTIVE&sortBy=priceVnd&sortDir=asc`,
    );
    expect(urls[4]).toBe(`${base}/v1/operator/parcel-route-fares/summary`);
    expect(urls[5]).toBe(
      `${base}/v1/operator/parcels?page=1&pageSize=20&search=Nguyen+Van+A&from=2026-08-01&to=2026-08-14&dateField=finalPaymentDeadline&sizeCategory=LARGE&routeId=route-1&sortBy=finalPaymentDeadline&sortDir=asc`,
    );
    expect(urls[6]).toBe(
      `${base}/v1/operator/driver-schedules?page=1&pageSize=20&dayOfWeek=5&departureFrom=05%3A00&departureTo=11%3A00&effectiveAt=2026-08-14&sortBy=departureTime&sortDir=asc`,
    );
    expect(urls[7]).toBe(`${base}/v1/admin/operators/summary`);
  });

  it("tải CSV nhà xe từ BE với đúng filter, không kèm page/pageSize", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "system-admin-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "admin-1",
          email: "admin@vietride.vn",
          displayName: "System Admin",
          role: "SYSTEM_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(
      async () =>
        new Response("operatorId,name\n", {
          status: 200,
          headers: { "Content-Type": "text/csv; charset=utf-8" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const blob = await exportAdminOperators({
      status: "APPROVED",
      isActive: true,
      from: "2026-08-01",
      to: "2026-08-31",
      dateField: "approvedAt",
      sortBy: "name",
      sortDir: "asc",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/admin/operators/export?status=APPROVED&isActive=true&from=2026-08-01&to=2026-08-31&dateField=approvedAt&sortBy=name&sortDir=asc",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Accept: "text/csv" }),
      }),
    );
    // jsdom và node dùng hai lớp Blob khác realm nên không assert instanceof
    expect(blob.type).toContain("text/csv");
  });

  it("maps RAG document search to the `q` query param", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "system-admin-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "admin-1",
          email: "admin@vietride.vn",
          displayName: "System Admin",
          role: "SYSTEM_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          success: true,
          data: {
            items: [],
            page: 1,
            pageSize: 8,
            totalItems: 0,
            totalPages: 0,
            hasPreviousPage: false,
            hasNextPage: false,
          },
        },
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getRagDocuments({ page: 1, pageSize: 8, search: "chính sách" });

    // Service RAG đặt tên tham số tìm kiếm là `q`; gửi `search` sẽ bị Zod strip
    // và ô tìm kiếm im lặng không lọc gì.
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/rag/documents?page=1&pageSize=8&q=ch%C3%ADnh+s%C3%A1ch",
      expect.objectContaining({ method: "GET" }),
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

  it("calls Subscription APIs for system admin and operator admin", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "subscription-token",
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
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const planRequest = {
      name: "Professional",
      description: "For growing operators",
      pricePerMonth: 3000000,
      pricePerYear: 30000000,
      maxVehicles: 20,
      maxDrivers: 40,
      maxAssistants: 40,
      maxOperatorUsers: 10,
      maxRoutes: 10,
      maxTripsPerMonth: 1000,
      enableParcel: true,
      enableShuttle: true,
      enableRag: true,
      isActive: true,
    };

    await getAdminSubscriptionPlans({ includeInactive: true });
    await createAdminSubscriptionPlan(
      planRequest,
      "11111111-1111-4111-8111-111111111111",
    );
    await updateAdminSubscriptionPlan(
      "plan-1",
      planRequest,
      "22222222-2222-4222-8222-222222222222",
    );
    await getOperatorSubscription();
    await getOperatorSubscriptionPlans();
    await upgradeOperatorSubscription(
      {
        planId: "plan-1",
        billingPeriod: "YEARLY",
        paymentMethod: "VNPAY",
      },
      "33333333-3333-4333-8333-333333333333",
    );
    await retryOperatorSubscriptionPayment(
      "upgrade-attempt-1",
      "44444444-4444-4444-8444-444444444444",
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/admin/subscription-plans?includeInactive=true",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer subscription-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/admin/subscription-plans",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(planRequest),
        headers: expect.objectContaining({
          "Idempotency-Key": "11111111-1111-4111-8111-111111111111",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.vietride.online/v1/admin/subscription-plans/plan-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(planRequest),
        headers: expect.objectContaining({
          "Idempotency-Key": "22222222-2222-4222-8222-222222222222",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.vietride.online/v1/operator/subscription",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "https://api.vietride.online/v1/operator/subscription-plans",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "https://api.vietride.online/v1/operator/subscription/upgrade",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          planId: "plan-1",
          billingPeriod: "YEARLY",
          paymentMethod: "VNPAY",
        }),
        headers: expect.objectContaining({
          "Idempotency-Key": "33333333-3333-4333-8333-333333333333",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "https://api.vietride.online/v1/operator/subscription/upgrade/upgrade-attempt-1/retry-payment",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "44444444-4444-4444-8444-444444444444",
        }),
      }),
    );
  });

  it("forwards the raw VNPay return query untouched and without an Authorization header", async () => {
    // Có token trong localStorage nhưng endpoint này là public — chữ ký
    // vnp_SecureHash mới là thứ xác thực, nên KHÔNG được gắn Authorization.
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "operator@vietride.vn",
          displayName: "Operator",
          role: "OPERATOR_ADMIN",
        },
      }),
    );

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return new Response(
          JSON.stringify({
            data: {
              vnPayTxnRef: "VR-SUBSCRIPTION-001",
              paymentId: "payment-1",
              referenceType: "SUBSCRIPTION",
              referenceId: "subscription-1",
              status: "PENDING_REDIRECT",
            },
          }),
          { status: 200 },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    // Chuỗi cố ý giữ thứ tự param và ký tự đã encode y như VNPay trả về:
    // parse rồi dựng lại sẽ đổi thứ tự/encoding và làm sai chữ ký.
    const rawQuery =
      "?vnp_Amount=1000000&vnp_ResponseCode=00&vnp_TxnRef=VR-SUBSCRIPTION-001&vnp_PayDate=20260810101500&vnp_SecureHash=abc%2Fdef%2B123";

    const result = await getVnPayReturnStatus(rawQuery);

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.vietride.online/v1/payments/vnpay-return-status${rawQuery}`,
      expect.objectContaining({ method: "GET" }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers ?? {};
    expect(headers).not.toHaveProperty("Authorization");
    expect(result.vnPayTxnRef).toBe("VR-SUBSCRIPTION-001");
  });

  it("accepts a VNPay return query without a leading question mark", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: { status: "PENDING_REDIRECT" } }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getVnPayReturnStatus("vnp_ResponseCode=00&vnp_TxnRef=VR-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/payments/vnpay-return-status?vnp_ResponseCode=00&vnp_TxnRef=VR-1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("calls operator and admin wallet, settlement, ledger, and invoice APIs", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "finance-token",
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

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(
        JSON.stringify({
          data: {
            items: [],
            page: 1,
            pageSize: 20,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await getOperatorWallet();
    await getOperatorWalletTransactions({ page: 1, pageSize: 20 });
    await getOperatorTripSettlements({ status: "ELIGIBLE" });
    await getOperatorLedger({ entryType: "BOOKING_REVENUE" });
    await getOperatorInvoices({ status: "ISSUED" });
    await getOperatorInvoice("invoice-1");
    await downloadOperatorInvoice("invoice-1");
    await getAdminTripSettlements({ stuckOnly: true, severity: "HIGH" });
    await settleAdminTripSettlement("settlement-1", "settle-idem");
    await getAdminPlatformWallet();
    await getAdminPlatformWalletTransactions({ type: "DEBIT" });
    await adjustAdminPlatformWallet(
      { type: "CREDIT", amount: 100000, note: "Manual adjustment" },
      "platform-idem",
    );
    await adjustAdminOperatorWallet(
      "operator-1",
      { type: "DEBIT", amount: 50000, note: "Correction" },
      "operator-idem",
    );
    await retryAdminInvoice("invoice-1", "invoice-idem");

    const expectedUrls = [
      "https://api.vietride.online/v1/operator/wallet",
      "https://api.vietride.online/v1/operator/wallet/transactions?page=1&pageSize=20",
      "https://api.vietride.online/v1/operator/trip-settlements?status=ELIGIBLE",
      "https://api.vietride.online/v1/operator/ledger?entryType=BOOKING_REVENUE",
      "https://api.vietride.online/v1/operator/invoices?status=ISSUED",
      "https://api.vietride.online/v1/operator/invoices/invoice-1",
      "https://api.vietride.online/v1/operator/invoices/invoice-1/download",
      "https://api.vietride.online/v1/admin/trip-settlements?stuckOnly=true&severity=HIGH",
      "https://api.vietride.online/v1/admin/trip-settlements/settlement-1/settle",
      "https://api.vietride.online/v1/admin/platform-wallet",
      "https://api.vietride.online/v1/admin/platform-wallet/transactions?type=DEBIT",
      "https://api.vietride.online/v1/admin/platform-wallet/adjust",
      "https://api.vietride.online/v1/admin/operators/operator-1/wallet/adjust",
      "https://api.vietride.online/v1/admin/invoices/invoice-1/retry",
    ];

    expectedUrls.forEach((url, index) => {
      expect(fetchMock.mock.calls[index]?.[0]).toBe(url);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      9,
      expectedUrls[8],
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Idempotency-Key": "settle-idem" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      12,
      expectedUrls[11],
      expect.objectContaining({
        body: JSON.stringify({
          type: "CREDIT",
          amount: 100000,
          note: "Manual adjustment",
        }),
        headers: expect.objectContaining({
          "Idempotency-Key": "platform-idem",
        }),
      }),
    );
  });

  it("sends search, dateField and date range query params on the operator wallet transparency endpoints", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "wallet-transparency-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-admin-1",
          email: "operator@vietride.vn",
          displayName: "Operator Admin",
          role: "OPERATOR_ADMIN",
        },
      }),
    );

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            items: [],
            page: 1,
            pageSize: 10,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getOperatorWalletTransactions({
      page: 1,
      pageSize: 10,
      search: "BK-100",
      dateField: "createdAt",
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-08-01T00:00:00.000Z",
    });
    await getOperatorTripSettlements({
      page: 1,
      pageSize: 10,
      search: "trip-1",
      dateField: "settledAt",
    });
    await getOperatorLedger({
      page: 1,
      pageSize: 10,
      search: "PCL-9",
      dateField: "occurredAt",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/operator/wallet/transactions?page=1&pageSize=10&search=BK-100&dateField=createdAt&from=2026-07-01T00%3A00%3A00.000Z&to=2026-08-01T00%3A00%3A00.000Z",
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/operator/trip-settlements?page=1&pageSize=10&search=trip-1&dateField=settledAt",
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.vietride.online/v1/operator/ledger?page=1&pageSize=10&search=PCL-9&dateField=occurredAt",
      expect.anything(),
    );
  });

  it("lists the current user's notifications and marks one as read", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "notification-token",
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

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/read")) {
        return new Response(null, { status: 204 });
      }

      return new Response(
        JSON.stringify({
          data: {
            items: [],
            page: 1,
            pageSize: 20,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await getNotifications({
      unreadOnly: true,
      page: 1,
      pageSize: 20,
      sortBy: "createdAt",
      sortDir: "desc",
    });
    await markNotificationRead("7e7d44b8-3d84-4dd5-b0a2-1f445de7c701");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/notifications?unreadOnly=true&page=1&pageSize=20&sortBy=createdAt&sortDir=desc",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer notification-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/notifications/7e7d44b8-3d84-4dd5-b0a2-1f445de7c701/read",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("requests a Firebase custom token with operator authentication", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-admin-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "user-1",
          email: "admin@operator.vn",
          displayName: "Operator Admin",
          role: "OPERATOR_ADMIN",
          operatorId: "operator-1",
        },
      }),
    );
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ data: { token: "firebase-custom-token" } }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getFirebaseCustomToken("VEHICLE_IMAGE")).resolves.toEqual({
      token: "firebase-custom-token",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/firebase/custom-token",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ purpose: "VEHICLE_IMAGE" }),
        headers: expect.objectContaining({
          Authorization: "Bearer operator-admin-token",
        }),
      }),
    );
  });

  it("lists operator bookings with server filters and loads booking details", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-user-1",
          email: "staff@operator.vn",
          displayName: "Operator Staff",
          role: "OPERATOR_STAFF",
          operatorId: "operator-1",
        },
      }),
    );
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            items: [],
            page: 1,
            pageSize: 20,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getOperatorBookings({
      status: "CONFIRMED",
      bookingCode: "BK-1001",
      page: 2,
      pageSize: 20,
      sortBy: "createdAt",
      sortDir: "desc",
    });
    await getOperatorBooking("booking-1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/operator/bookings?status=CONFIRMED&bookingCode=BK-1001&page=2&pageSize=20&sortBy=createdAt&sortDir=desc",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/operator/bookings/booking-1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("sends required idempotency keys for operator trip terminal operations", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-admin-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-admin-1",
          email: "admin@operator.vn",
          displayName: "Operator Admin",
          role: "OPERATOR_ADMIN",
          operatorId: "operator-1",
        },
      }),
    );
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ data: { tripId: "trip-1", status: "DISRUPTED" } }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await substituteOperatorTripVehicle(
      "trip-1",
      {
        replacementVehicleId: "vehicle-2",
        estimatedRecoveryDepartureAt: "2026-08-02T04:30:00.000Z",
        notifyPassengers: true,
        replacementCrew: {
          driverId: "driver-2",
          assistantId: null,
        },
        reason: "Vehicle breakdown",
      },
      "substitute-key",
    );
    await disruptOperatorTripNoSubstitution(
      "trip-1",
      { reason: "No replacement vehicle" },
      "disrupt-key",
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/operator/trips/trip-1/substitute-vehicle",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          replacementVehicleId: "vehicle-2",
          estimatedRecoveryDepartureAt: "2026-08-02T04:30:00.000Z",
          notifyPassengers: true,
          replacementCrew: {
            driverId: "driver-2",
            assistantId: null,
          },
          reason: "Vehicle breakdown",
        }),
        headers: expect.objectContaining({
          "Idempotency-Key": "substitute-key",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/operator/trips/trip-1/disrupt-no-substitution",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "disrupt-key",
        }),
      }),
    );
  });
});

describe("operator parcel queues", () => {
  it("builds the operator parcel queue query", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: { id: "user-1", email: "manager@operator.vn", displayName: "Operator Manager", role: "OPERATOR_ADMIN" },
      }),
    );
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ data: { items: [], page: 2, pageSize: 20, totalItems: 0, totalPages: 0, hasPreviousPage: true, hasNextPage: false } }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getOperatorParcels({
      status: "PENDING_OPERATOR_ACTION",
      pendingActionType: "CAPACITY_EXCEEDED",
      tripId: "trip-1",
      page: 2,
      pageSize: 20,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operator/parcels?status=PENDING_OPERATOR_ACTION&pendingActionType=CAPACITY_EXCEEDED&tripId=trip-1&page=2&pageSize=20",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("reads the operator-scoped parcel detail with its status history", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: { id: "user-1", email: "manager@operator.vn", displayName: "Operator Manager", role: "OPERATOR_ADMIN" },
      }),
    );
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            parcelId: "parcel-1",
            parcelCode: "VR-PCL-20260812-ABCDEFGH",
            status: "DELIVERED_PENDING_CONFIRM",
            statusHistory: [
              {
                status: "LOADED",
                occurredAt: "2026-08-12T08:00:00+07:00",
                actorType: "CREW",
                actorId: "user-9",
                source: "ASSISTANT_APP",
                reason: null,
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const detail = await getOperatorParcel("parcel-1");

    expect(detail.statusHistory).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operator/parcels/parcel-1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("resends the delivery confirmation email without a body", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: { id: "user-1", email: "manager@operator.vn", displayName: "Operator Manager", role: "OPERATOR_ADMIN" },
      }),
    );
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            parcelId: "parcel-1",
            status: "DELIVERED_PENDING_CONFIRM",
            expiresAt: "2026-08-13T12:00:00+07:00",
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await resendOperatorParcelDeliveryEmail(
      "parcel-1",
      "7c072cc3-bdcb-41cc-9048-5c173e77b3e9",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operator/parcels/parcel-1/resend-delivery-email",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "7c072cc3-bdcb-41cc-9048-5c173e77b3e9",
        }),
      }),
    );
  });
});
describe("operator notification announcements", () => {
  it("sends a trip announcement with an idempotency key", async () => {
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
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: { announcementId: "announcement-1", recipientCount: 12 },
        }),
        { status: 202 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendOperatorNotification(
      {
        scope: "TRIP",
        tripId: "trip-1",
        title: "Departure updated",
        body: "The trip will leave 15 minutes later.",
      },
      "announcement-key",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operator/notifications",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          scope: "TRIP",
          tripId: "trip-1",
          title: "Departure updated",
          body: "The trip will leave 15 minutes later.",
        }),
        headers: expect.objectContaining({
          "Idempotency-Key": "announcement-key",
        }),
      }),
    );
  });
});


describe("UI gaps API contracts", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "admin-token",
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
  });

  it("calls dashboard, revenue, trip, and operator revenue endpoints with required filters", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: { items: [] } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getAdminDashboardSummary({ from: "2026-01-01", to: "2026-12-31" });
    await getAdminRevenueAnalytics({
      from: "2026-01-01",
      to: "2026-12-31",
      groupBy: "month",
      top: 5,
    });
    await getOperatorRevenueAnalytics({ month: "2026-07" });
    await getOperatorTrips({
      status: "IN_PROGRESS",
      page: 2,
      pageSize: 20,
      sortBy: "departureTime",
      sortDir: "desc",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/admin/dashboard/summary?from=2026-01-01&to=2026-12-31",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/admin/revenue/analytics?from=2026-01-01&to=2026-12-31&groupBy=month&top=5",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.vietride.online/v1/operator/revenue/analytics?month=2026-07",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.vietride.online/v1/operator/trips?status=IN_PROGRESS&page=2&pageSize=20&sortBy=departureTime&sortDir=desc",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("uses the parcel fare batch endpoint and parcel statistics filters", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: { items: [] } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = {
      effectiveFrom: "2026-07-01T00:00:00Z",
      effectiveUntil: null,
      items: [
        {
          sizeCategory: "SMALL" as const,
          priceVnd: 50000,
        },
      ],
    };
    await batchUpdateOperatorParcelRouteFares(
      "route-1",
      request,
      "parcel-fare-key",
    );
    await getOperatorParcelStats({
      groupBy: "status",
      from: "2026-07-01",
      to: "2026-07-31",
      limit: 10,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/operator/parcel-route-fares/route-1/batch",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify(request),
        headers: expect.objectContaining({
          "Idempotency-Key": "parcel-fare-key",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/operator/parcel-stats?groupBy=status&from=2026-07-01&to=2026-07-31&limit=10",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("calls admin and operator policy APIs without internal endpoints", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: { items: [] } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const createRequest = {
      title: "Cancellation policy",
      description: "Refund rules",
      category: "CANCELLATION",
      content: "Policy content",
      policyType: "FOR_OPERATOR" as const,
      active: true,
    };
    await getAdminPolicies({ policyType: "FOR_OPERATOR", page: 1, pageSize: 10 });
    await createAdminPolicy(createRequest);
    await updateAdminPolicy("policy-1", { title: "Updated policy", version: 1 });
    await deleteAdminPolicy("policy-1");
    await getOperatorPolicies({ page: 2, pageSize: 10 });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/admin/policies?policyType=FOR_OPERATOR&page=1&pageSize=10",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/admin/policies",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(createRequest),
        headers: expect.objectContaining({
          "Idempotency-Key": expect.any(String),
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.vietride.online/v1/admin/policies/policy-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.vietride.online/v1/admin/policies/policy-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "https://api.vietride.online/v1/operator/policies?page=2&pageSize=10",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("loads operator fleet latest positions", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "ops@operator.vn",
          displayName: "Operator Admin",
          role: "OPERATOR_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: { items: [], generatedAt: "2026-08-06T03:00:02Z" },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await getOperatorFleetLatest({ status: "IN_PROGRESS" });
    await getOperatorFleetLatest();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/tracking/operator/fleet-latest?status=IN_PROGRESS",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/tracking/operator/fleet-latest",
      expect.objectContaining({ method: "GET" }),
    );
  });

  // Shuttle chỉ vào fleet khi opt-in `include=shuttle`; không truyền thì
  // response giữ nguyên như cũ (chỉ main Trip).
  it("opts shuttle vehicles into the operator fleet response", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "ops@operator.vn",
          displayName: "Operator Admin",
          role: "OPERATOR_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: { items: [], generatedAt: "2026-08-15T15:00:00.000Z" },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await getOperatorFleetLatest({ include: "shuttle" });
    await getOperatorFleetLatest({ include: "shuttle", status: "IN_PROGRESS" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/tracking/operator/fleet-latest?include=shuttle",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/tracking/operator/fleet-latest?include=shuttle&status=IN_PROGRESS",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("loads the operator shuttle tracking context", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "ops@operator.vn",
          displayName: "Operator Admin",
          role: "OPERATOR_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: {
            shuttleTripId: "36000000-0000-4000-8000-000000000001",
            mainTripId: "36000000-0000-4000-8000-000000000101",
            direction: "INBOUND_TO_STATION",
            status: "IN_PROGRESS",
            stops: [],
            station: null,
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const context = await getOperatorShuttleContext(
      "36000000-0000-4000-8000-000000000001",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/tracking/shuttle-trips/36000000-0000-4000-8000-000000000001/operator-context",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
        }),
      }),
    );
    // `station: null` là hợp lệ, không được coi là lỗi
    expect(context.station).toBeNull();
  });

  it("lists operator incidents with enum filters and a date range", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "ops@operator.vn",
          displayName: "Operator Admin",
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

    await getOperatorIncidents({
      page: 1,
      pageSize: 20,
      status: "OPEN",
      category: "VEHICLE_BREAKDOWN",
      from: "2026-08-01",
      to: "2026-08-10",
    });
    await getOperatorIncident("incident-1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/operator/incidents?page=1&pageSize=20&status=OPEN&category=VEHICLE_BREAKDOWN&from=2026-08-01&to=2026-08-10",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/operator/incidents/incident-1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("resolves an operator incident with a stable idempotency key", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "ops@operator.vn",
          displayName: "Operator Admin",
          role: "OPERATOR_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              incidentId: "incident-1",
              status: "RESOLVED",
              resolvedAt: "2026-08-12T14:35:12+07:00",
              resolutionNote: "Đã điều xe thay thế",
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveOperatorIncident(
      "incident-1",
      { resolutionNote: "Đã điều xe thay thế" },
      "2cfb8d76-50eb-4ac4-9e60-15b43d66bb67",
    );

    expect(result.status).toBe("RESOLVED");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operator/incidents/incident-1/resolve",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ resolutionNote: "Đã điều xe thay thế" }),
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
          "Idempotency-Key": "2cfb8d76-50eb-4ac4-9e60-15b43d66bb67",
        }),
      }),
    );
  });

  it("lists operator shuttle trips with paging, date range and multi status", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "ops@operator.vn",
          displayName: "Operator Admin",
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

    await getOperatorShuttleTrips({
      page: 2,
      pageSize: 10,
      from: "2026-08-01",
      to: "2026-08-10",
      status: "SCHEDULED,IN_PROGRESS",
    });
    await getOperatorShuttleTrips();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/operator/shuttle-trips?page=2&pageSize=10&from=2026-08-01&to=2026-08-10&status=SCHEDULED%2CIN_PROGRESS",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer operator-token",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/operator/shuttle-trips",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("reads pending shuttle requests as a full PagedResult", async () => {
    setOperatorAdminSession();
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: {
            items: [],
            page: 1,
            pageSize: 20,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getOperatorShuttleRequests({ page: 1, pageSize: 20 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operator/shuttle-requests?page=1&pageSize=20",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.totalPages).toBe(0);
    expect(result.hasNextPage).toBe(false);
    expect(result.hasPreviousPage).toBe(false);
  });

  it("cancels a pending shuttle request with direction, reason and an idempotency key", async () => {
    setOperatorAdminSession();
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: {
            shuttleTripId: "00000000-0000-0000-0000-000000000000",
            status: "CANCELLED",
            changedPassengerCount: 2,
            transitionedAt: "2026-08-11T10:00:00+07:00",
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await cancelOperatorShuttleRequest(
      "trip-1",
      "booking-1",
      "INBOUND_TO_STATION",
      { reason: "Không còn đủ xe" },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operator/shuttle-requests/trip-1/booking-1/cancel?direction=INBOUND_TO_STATION",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Không còn đủ xe" }),
        headers: expect.objectContaining({
          "Idempotency-Key": expect.any(String),
        }),
      }),
    );
  });

  it("cancels a shuttle trip with a reason and an idempotency key", async () => {
    setOperatorAdminSession();
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: {
            shuttleTripId: "shuttle-1",
            status: "CANCELLED",
            changedPassengerCount: 2,
            transitionedAt: null,
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await cancelOperatorShuttleTrip(
      "shuttle-1",
      { reason: "Điều phối nhầm xe" },
      "cancel-shuttle-key",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operator/shuttle-trips/shuttle-1/cancel",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Điều phối nhầm xe" }),
        headers: expect.objectContaining({
          "Idempotency-Key": "cancel-shuttle-key",
        }),
      }),
    );
  });

  it("requests trip eta without stopId to auto-select the next stop", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "ops@operator.vn",
          displayName: "Operator Staff",
          role: "OPERATOR_STAFF",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ data: { eta: null } }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await getTrackingTripEta("11111111-1111-4111-8111-111111111111");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/tracking/trips/11111111-1111-4111-8111-111111111111/eta",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("requests trip eta for an explicit stop or station target", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "ops@operator.vn",
          displayName: "Operator Staff",
          role: "OPERATOR_STAFF",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ data: { eta: null } }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await getTrackingTripEta("11111111-1111-4111-8111-111111111111", {
      targetKind: "STOP",
      stopId: "22222222-2222-4222-8222-222222222222",
    });
    await getTrackingTripEta("11111111-1111-4111-8111-111111111111", {
      targetKind: "STATION",
      stationId: "33333333-3333-4333-8333-333333333333",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/tracking/trips/11111111-1111-4111-8111-111111111111/eta?targetKind=STOP&stopId=22222222-2222-4222-8222-222222222222",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/tracking/trips/11111111-1111-4111-8111-111111111111/eta?targetKind=STATION&stationId=33333333-3333-4333-8333-333333333333",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("requests the preferred batch ETA endpoint", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "ops@operator.vn",
          displayName: "Operator Staff",
          role: "OPERATOR_STAFF",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ data: { etas: [] } }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await getTrackingTripEtas("11111111-1111-4111-8111-111111111111");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/tracking/trips/11111111-1111-4111-8111-111111111111/etas",
      expect.objectContaining({ method: "GET" }),
    );
  });


  it("updates a driver schedule with applyTo scope", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "ops@operator.vn",
          displayName: "Operator Admin",
          role: "OPERATOR_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ data: { id: "schedule-1" } }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await updateOperatorDriverSchedule("schedule-1", "ALL_PENDING", {
      departureTime: "08:00:00",
      dayOfWeek: [1, 3, 5],
      assistantUserId: null,
      vehicleId: "vehicle-1",
      validUntil: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operator/driver-schedules/schedule-1?applyTo=ALL_PENDING",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          departureTime: "08:00:00",
          dayOfWeek: [1, 3, 5],
          assistantUserId: null,
          vehicleId: "vehicle-1",
          validUntil: null,
        }),
        headers: expect.objectContaining({
          "Idempotency-Key": expect.any(String),
        }),
      }),
    );
  });

  // Hai endpoint preview availability là read-only nên BE không nhận
  // Idempotency-Key (handoff API-driver-resource-availability mục 7.2 và 8.2).
  it.each([
    [
      "driver schedule",
      () =>
        checkDriverScheduleAvailability({
          routeId: "route-1",
          vehicleId: "vehicle-1",
          driverUserId: "driver-1",
          assistantUserId: null,
          dayOfWeek: [1, 3, 5],
          departureTime: "08:00:00",
          validFrom: "2026-08-12",
          validUntil: "2026-12-31",
        }),
      "https://api.vietride.online/v1/operator/driver-schedules/availability-check",
    ],
    [
      "shuttle trip",
      () =>
        checkShuttleTripAvailability({
          mainTripId: "trip-1",
          direction: "INBOUND_TO_STATION",
          driverUserId: "driver-1",
          vehicleId: "vehicle-1",
          scheduledDepartureTime: "2026-08-12T13:30:00+07:00",
          scheduledEndTime: "2026-08-12T14:20:00+07:00",
          orderedBookingIds: ["booking-1", "booking-2"],
        }),
      "https://api.vietride.online/v1/operator/shuttle-trips/availability-check",
    ],
  ])(
    "previews %s availability without an idempotency key",
    async (_label, call, expectedUrl) => {
      setOperatorAdminSession();
      const fetchMock = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            data: { available: true, turnaroundMinutes: 30, conflicts: [], hasMore: false },
          }),
          { status: 200 },
        );
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await call();

      expect(result.available).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({ method: "POST" }),
      );
      const [, requestInit] = fetchMock.mock.calls[0] as unknown as [
        string,
        { headers: Record<string, string> },
      ];
      expect(
        Object.keys(requestInit.headers).some(
          (header) => header.toLowerCase() === "idempotency-key",
        ),
      ).toBe(false);
    },
  );

  // Preview trả HTTP 200 kể cả khi có conflict — không được coi 200 là hợp lệ.
  it("returns conflicts on a 200 preview response", async () => {
    setOperatorAdminSession();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              available: false,
              turnaroundMinutes: 30,
              conflicts: [
                {
                  resourceRole: "ASSISTANT",
                  resourceId: "assistant-1",
                  reason: "REPOSITION_REQUIRED",
                  conflictingSourceType: "TRIP",
                  conflictingSourceId: "trip-9",
                  sampleRequestedStartAt: "2026-08-12T10:01:00+07:00",
                  blockingUntil: "2026-08-12T12:30:00+07:00",
                  earliestFeasibleStartAt: null,
                  requiredTravelMinutes: 120,
                  turnaroundMinutes: 30,
                },
              ],
              hasMore: true,
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await checkShuttleTripAvailability({
      mainTripId: "trip-1",
      direction: "OUTBOUND_FROM_STATION",
      driverUserId: "driver-1",
      vehicleId: "vehicle-1",
      scheduledDepartureTime: "2026-08-12T13:30:00+07:00",
      scheduledEndTime: "2026-08-12T14:20:00+07:00",
      orderedBookingIds: ["booking-1"],
    });

    expect(result.available).toBe(false);
    expect(result.hasMore).toBe(true);
    expect(result.conflicts[0].resourceRole).toBe("ASSISTANT");
    expect(result.conflicts[0].earliestFeasibleStartAt).toBeNull();
  });

  it("updates driver schedule crew through the alias endpoint", async () => {
    setOperatorAdminSession();
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ data: { id: "schedule-1" } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateOperatorDriverScheduleCrew("schedule-1", {
      driverUserId: "driver-2",
      assistantUserId: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operator/driver-schedules/schedule-1/crew",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ driverUserId: "driver-2", assistantUserId: null }),
        headers: expect.objectContaining({
          "Idempotency-Key": expect.any(String),
        }),
      }),
    );
  });

  it("deactivates a driver schedule without an idempotency key", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "ops@operator.vn",
          displayName: "Operator Admin",
          role: "OPERATOR_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({ data: { id: "schedule-1", isActive: false } }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await deactivateOperatorDriverSchedule("schedule-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operator/driver-schedules/schedule-1/deactivate",
      expect.objectContaining({ method: "PATCH" }),
    );
    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(
      Object.keys(requestInit.headers).some(
        (header) => header.toLowerCase() === "idempotency-key",
      ),
    ).toBe(false);
  });

  it("soft-deletes a driver schedule with an idempotency key", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "ops@operator.vn",
          displayName: "Operator Admin",
          role: "OPERATOR_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ data: { deleted: true } }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await deleteOperatorDriverSchedule("schedule-1");

    expect(result).toEqual({ deleted: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operator/driver-schedules/schedule-1",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          "Idempotency-Key": expect.any(String),
        }),
      }),
    );
  });

  it("creates and replaces a route atomically via the full endpoints", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "ops@operator.vn",
          displayName: "Operator Admin",
          role: "OPERATOR_ADMIN",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({ data: { id: "route-1", stops: [] } }),
        { status: 201 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const fullRequest = {
      name: "Hồ Chí Minh - Đà Lạt",
      originStationId: "station-1",
      destinationStationId: "station-2",
      returnRouteId: null,
      baseFare: 250000,
      isActive: true,
      pathPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
      manualMetrics: null,
      stops: [
        {
          stopId: "stop-1",
          orderIndex: 1,
          estimatedDurationFromOriginMinutes: null,
          distanceFromOriginKm: null,
          allowPickup: true,
          allowDropoff: true,
        },
      ],
    };

    await createOperatorRouteFull(fullRequest);
    await updateOperatorRouteFull("route-1", fullRequest);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.vietride.online/v1/operator/routes/full",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(fullRequest),
        headers: expect.objectContaining({
          "Idempotency-Key": expect.any(String),
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vietride.online/v1/operator/routes/route-1/full",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify(fullRequest),
      }),
    );
  });

  it("loads ordered route stop metrics", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        accessToken: "operator-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
        user: {
          id: "operator-1",
          email: "ops@operator.vn",
          displayName: "Operator Staff",
          role: "OPERATOR_STAFF",
        },
      }),
    );
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: [
            {
              stopId: "stop-1",
              stopName: "Điểm đón Quận 1",
              orderIndex: 1,
              distanceFromOriginKm: 32.5,
              estimatedDurationFromOriginMinutes: 45,
            },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await getOperatorRouteStopMetrics("route-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vietride.online/v1/operator/routes/route-1/stop-metrics",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
