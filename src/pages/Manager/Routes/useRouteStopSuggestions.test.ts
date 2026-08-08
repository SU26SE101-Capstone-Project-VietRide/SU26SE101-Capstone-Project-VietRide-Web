import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OperatorStop } from "../../../api/vietride";
import type { PlaceAlongRoute } from "../../../lib/googlePlacesSearch";
import type { RouteCoordinate } from "./polyline";
import type { RouteStopDraft } from "./types";

vi.mock("../../../lib/googlePlacesSearch", () => ({
  searchPlacesAlongRoute: vi.fn(),
}));

import { searchPlacesAlongRoute } from "../../../lib/googlePlacesSearch";
import {
  __clearPlacesCacheForTest,
  useRouteStopSuggestions,
} from "./useRouteStopSuggestions";

const mockedSearchPlacesAlongRoute = vi.mocked(searchPlacesAlongRoute);

// Đường thẳng (0,105)→(0,106) — giống Task 1, đủ dài để test khoảng cách tới đường.
const pathPoints: RouteCoordinate[] = [
  { latitude: 0, longitude: 105 },
  { latitude: 0, longitude: 106 },
];

function makeOperatorStop(overrides: Partial<OperatorStop>): OperatorStop {
  return {
    id: "stop-1",
    operatorId: "operator-1",
    name: "Stop",
    description: null,
    latitude: 0,
    longitude: 105.2,
    address: null,
    googlePlaceId: null,
    isActive: true,
    ...overrides,
  };
}

const nearStop = makeOperatorStop({ id: "near-stop", name: "Bến gần đường" });
const farStop = makeOperatorStop({
  id: "far-stop",
  name: "Bến xa đường",
  latitude: 1,
  longitude: 105.2,
});

const googlePlace: PlaceAlongRoute = {
  placeId: "google-place-1",
  name: "Trạm dừng Google",
  address: "Đâu đó",
  latitude: 0,
  longitude: 105.6,
  types: ["rest_stop"],
};

// ~2km theo latitude (1 độ latitude ≈ 111.32km) — trong ngưỡng cũ (3km) nhưng
// ngoài ngưỡng mới (1km).
const twoKmOffsetLatitude = 2 / 111.32;

beforeEach(() => {
  __clearPlacesCacheForTest();
  mockedSearchPlacesAlongRoute.mockReset();
  mockedSearchPlacesAlongRoute.mockResolvedValue([]);
});

describe("useRouteStopSuggestions", () => {
  it("không gọi Google và trả rỗng khi enabled=false", async () => {
    const { result } = renderHook(() =>
      useRouteStopSuggestions({
        enabled: false,
        routeKey: "route-1",
        pathPoints,
        stops: [nearStop],
        currentRouteStops: [],
      }),
    );

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoadingPlaces).toBe(false);
    expect(mockedSearchPlacesAlongRoute).not.toHaveBeenCalled();
  });

  it("lọc stop kho theo khoảng cách tới đường và dedupe stop đã gắn", async () => {
    const attachedDraft: RouteStopDraft = {
      stopId: "far-stop",
      orderIndex: 1,
      estimatedDurationFromOriginMinutes: 10,
      distanceFromOriginKm: 5,
      allowPickup: true,
      allowDropoff: true,
      routeName: "Route 1",
      stopName: "Bến xa đường",
      latitude: 1,
      longitude: 105.2,
    };

    const { result } = renderHook(() =>
      useRouteStopSuggestions({
        enabled: true,
        routeKey: "route-1",
        pathPoints,
        stops: [nearStop, farStop],
        currentRouteStops: [attachedDraft],
      }),
    );

    await waitFor(() => {
      expect(result.current.suggestions.some((s) => s.id === "near-stop")).toBe(
        true,
      );
    });

    const ids = result.current.suggestions.map((s) => s.id);
    expect(ids).toContain("near-stop");
    expect(ids).not.toContain("far-stop"); // quá xa đường (>3km)
  });

  it("map place Google thành kind googlePlace và sort theo distanceFromStartKm — gọi 2 query riêng (bến xe, trạm dừng chân)", async () => {
    mockedSearchPlacesAlongRoute.mockResolvedValue([googlePlace]);

    const { result } = renderHook(() =>
      useRouteStopSuggestions({
        enabled: true,
        routeKey: "route-2",
        pathPoints,
        stops: [nearStop],
        currentRouteStops: [],
      }),
    );

    await waitFor(() => {
      expect(result.current.suggestions.length).toBe(2);
    });

    const [first, second] = result.current.suggestions;
    expect(first.kind).toBe("operatorStop");
    expect(first.id).toBe("near-stop");
    expect(second.kind).toBe("googlePlace");
    expect(second.id).toBe("google-place-1");
    expect(first.distanceFromStartKm).toBeLessThan(second.distanceFromStartKm);

    // Places textQuery không hỗ trợ toán tử OR ("|") — phải tách thành 2 lần
    // gọi riêng, cùng polyline, dedupe kết quả theo placeId ở tầng hook.
    expect(mockedSearchPlacesAlongRoute).toHaveBeenCalledTimes(2);
    const calledQueries = mockedSearchPlacesAlongRoute.mock.calls.map(
      (call) => call[1],
    );
    expect(calledQueries.sort()).toEqual(["bến xe", "trạm dừng chân"].sort());
    const calledPolylines = mockedSearchPlacesAlongRoute.mock.calls.map(
      (call) => call[0],
    );
    expect(calledPolylines[0]).toBe(calledPolylines[1]);
  });

  it("gộp + dedupe theo placeId khi 2 query trả về place trùng nhau", async () => {
    const duplicatePlace: PlaceAlongRoute = {
      placeId: "google-place-1",
      name: "Trạm dừng Google (tên khác)",
      address: "Đâu đó khác",
      latitude: 0,
      longitude: 105.6,
      types: ["rest_stop"],
    };

    mockedSearchPlacesAlongRoute.mockImplementation((_polyline, query) => {
      if (query === "bến xe") {
        return Promise.resolve([googlePlace]);
      }
      return Promise.resolve([duplicatePlace]);
    });

    const { result } = renderHook(() =>
      useRouteStopSuggestions({
        enabled: true,
        routeKey: "route-dedupe",
        pathPoints,
        stops: [nearStop],
        currentRouteStops: [],
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingPlaces).toBe(false);
    });

    // 2 query trả về 2 place cùng placeId → chỉ 1 suggestion googlePlace duy nhất
    // (cộng 1 operatorStop suggestion từ nearStop) = 2, không phải 3.
    expect(result.current.suggestions.length).toBe(2);
    const googlePlaceSuggestions = result.current.suggestions.filter(
      (s) => s.kind === "googlePlace",
    );
    expect(googlePlaceSuggestions.length).toBe(1);
    expect(googlePlaceSuggestions[0].id).toBe("google-place-1");
  });

  it("cache Google theo routeKey|pathPoints.length — chỉ gọi 2 lần (1 lần/query)", async () => {
    mockedSearchPlacesAlongRoute.mockResolvedValue([googlePlace]);

    const first = renderHook(() =>
      useRouteStopSuggestions({
        enabled: true,
        routeKey: "route-3",
        pathPoints,
        stops: [nearStop],
        currentRouteStops: [],
      }),
    );

    await waitFor(() => {
      expect(first.result.current.suggestions.length).toBe(2);
    });

    const second = renderHook(() =>
      useRouteStopSuggestions({
        enabled: true,
        routeKey: "route-3",
        pathPoints,
        stops: [nearStop],
        currentRouteStops: [],
      }),
    );

    await waitFor(() => {
      expect(second.result.current.suggestions.length).toBe(2);
    });

    expect(mockedSearchPlacesAlongRoute).toHaveBeenCalledTimes(2);
  });

  // F-1 regression: cache key phải là routeKey THUẦN, không ghép thêm
  // pathPoints.length — polyline đổi độ dài (thêm stop/kéo via-point) không
  // được bắn thêm request Google Places khi routeKey không đổi.
  it("cache theo routeKey thuần — đổi độ dài pathPoints cùng routeKey vẫn KHÔNG gọi Google lần 2", async () => {
    mockedSearchPlacesAlongRoute.mockResolvedValue([googlePlace]);

    const { result, rerender } = renderHook(
      (props: { pathPoints: RouteCoordinate[] }) =>
        useRouteStopSuggestions({
          enabled: true,
          routeKey: "route-4",
          pathPoints: props.pathPoints,
          stops: [nearStop],
          currentRouteStops: [],
        }),
      { initialProps: { pathPoints } },
    );

    await waitFor(() => {
      expect(result.current.suggestions.length).toBe(2);
    });

    expect(mockedSearchPlacesAlongRoute).toHaveBeenCalledTimes(2);

    // Polyline đổi độ dài (thêm 1 điểm) nhưng routeKey giữ nguyên
    const longerPathPoints: RouteCoordinate[] = [
      ...pathPoints,
      { latitude: 0, longitude: 107 },
    ];
    rerender({ pathPoints: longerPathPoints });

    await waitFor(() => {
      expect(result.current.suggestions.length).toBe(2);
    });

    expect(mockedSearchPlacesAlongRoute).toHaveBeenCalledTimes(2);
  });

  it("loại place Google có type trong blocklist (trạm sạc xe điện) dù nằm sát tuyến", async () => {
    const chargingStation: PlaceAlongRoute = {
      ...googlePlace,
      placeId: "charging-station-1",
      name: "Trạm Sạc Xe Điện (TRẠM DỪNG CHÂN)",
      types: ["electric_vehicle_charging_station"],
    };
    mockedSearchPlacesAlongRoute.mockResolvedValue([chargingStation]);

    const { result } = renderHook(() =>
      useRouteStopSuggestions({
        enabled: true,
        routeKey: "route-blocklist",
        pathPoints,
        stops: [nearStop],
        currentRouteStops: [],
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingPlaces).toBe(false);
    });

    const ids = result.current.suggestions.map((s) => s.id);
    expect(ids).not.toContain("charging-station-1");
  });

  it("giữ place Google có type rest_stop (không thuộc blocklist)", async () => {
    mockedSearchPlacesAlongRoute.mockResolvedValue([googlePlace]);

    const { result } = renderHook(() =>
      useRouteStopSuggestions({
        enabled: true,
        routeKey: "route-reststop",
        pathPoints,
        stops: [nearStop],
        currentRouteStops: [],
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingPlaces).toBe(false);
    });

    const ids = result.current.suggestions.map((s) => s.id);
    expect(ids).toContain("google-place-1");
  });

  it("loại place Google cách tuyến 2km — trong ngưỡng cũ (3km) nhưng ngoài ngưỡng mới (1km)", async () => {
    const twoKmAwayPlace: PlaceAlongRoute = {
      ...googlePlace,
      placeId: "google-2km",
      latitude: twoKmOffsetLatitude,
      longitude: 105.5,
    };
    mockedSearchPlacesAlongRoute.mockResolvedValue([twoKmAwayPlace]);

    const { result } = renderHook(() =>
      useRouteStopSuggestions({
        enabled: true,
        routeKey: "route-2km-google",
        pathPoints,
        stops: [nearStop],
        currentRouteStops: [],
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingPlaces).toBe(false);
    });

    const ids = result.current.suggestions.map((s) => s.id);
    expect(ids).not.toContain("google-2km");
  });

  it("loại stop kho cách tuyến 2km — dùng chung ngưỡng mới (1km) với Google Places", async () => {
    const twoKmAwayStop = makeOperatorStop({
      id: "warehouse-2km",
      name: "Bến kho cách 2km",
      latitude: twoKmOffsetLatitude,
      longitude: 105.3,
    });

    const { result } = renderHook(() =>
      useRouteStopSuggestions({
        enabled: true,
        routeKey: "route-2km-warehouse",
        pathPoints,
        stops: [nearStop, twoKmAwayStop],
        currentRouteStops: [],
      }),
    );

    await waitFor(() => {
      expect(result.current.suggestions.some((s) => s.id === "near-stop")).toBe(
        true,
      );
    });

    const ids = result.current.suggestions.map((s) => s.id);
    expect(ids).not.toContain("warehouse-2km");
  });
});
