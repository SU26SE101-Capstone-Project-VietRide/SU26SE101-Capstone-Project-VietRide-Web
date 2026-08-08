// Test luồng lọc phương án trùng đường loại trừ của useRouteGeometry (dùng khi
// soạn tuyến thay thế: excludedPathPoints = polyline tuyến chính). Chỉ mock
// requestRoadGeometry — các helper so trùng/dedupe dùng bản thật để test đúng
// ngưỡng khoảng cách như production.
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RouteCoordinate } from "./polyline";
import type { TranslateFn } from "./types";

vi.mock("./geometry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./geometry")>();
  return { ...actual, requestRoadGeometry: vi.fn() };
});

import { requestRoadGeometry, type RoadRouteOption } from "./geometry";
import { useRouteGeometry } from "./useRouteGeometry";

const mockedRequestRoadGeometry = vi.mocked(requestRoadGeometry);

// Hai lộ trình cùng cặp đầu-cuối nhưng đi 2 hành lang khác hẳn nhau (trung
// điểm cách nhau >2km và tổng km lệch >1.5% — ngoài ngưỡng "trùng ~")
const viaNorthPath: RouteCoordinate[] = [
  { latitude: 10.77, longitude: 106.69 },
  { latitude: 11.5, longitude: 107.2 },
  { latitude: 11.94, longitude: 108.44 },
];
const viaSouthPath: RouteCoordinate[] = [
  { latitude: 10.77, longitude: 106.69 },
  { latitude: 10.95, longitude: 107.9 },
  { latitude: 11.94, longitude: 108.44 },
];
const waypoints: RouteCoordinate[] = [
  { latitude: 10.77, longitude: 106.69 },
  { latitude: 11.94, longitude: 108.44 },
];

const northOption: RoadRouteOption = {
  points: viaNorthPath,
  totalDistanceKm: 355.4,
  estimatedDurationMinutes: 345,
};
const southOption: RoadRouteOption = {
  points: viaSouthPath,
  totalDistanceKm: 410.2,
  estimatedDurationMinutes: 372,
};

function renderGeometry(excludedPathPoints?: RouteCoordinate[]) {
  return renderHook(() =>
    useRouteGeometry({
      selectedRouteId: "route-1",
      routeWaypoints: waypoints,
      isWorkspaceActive: true,
      excludedPathPoints,
      setRouteForm: vi.fn(),
      setRoutes: vi.fn(),
      setError: vi.fn(),
      t: ((key: string) => key) as TranslateFn,
    }),
  );
}

describe("useRouteGeometry — excludedPathPoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("drops fetched options matching the excluded path and keeps the rest", async () => {
    // Mode mặc định TRUCK → hook gọi TRUCK + DRIVE (so detour); trả cùng bộ
    mockedRequestRoadGeometry.mockResolvedValue([northOption, southOption]);

    const { result } = renderGeometry(viaNorthPath);

    await waitFor(() => {
      expect(result.current.routeOptions).toEqual([southOption]);
    });
    expect(result.current.allOptionsExcluded).toBe(false);
  });

  it("flags allOptionsExcluded when every option matches the excluded path", async () => {
    mockedRequestRoadGeometry.mockResolvedValue([northOption]);

    const { result } = renderGeometry(viaNorthPath);

    await waitFor(() => {
      expect(result.current.allOptionsExcluded).toBe(true);
    });
    expect(result.current.routeOptions).toEqual([]);
  });

  it("keeps every option when no excluded path is provided", async () => {
    mockedRequestRoadGeometry.mockResolvedValue([northOption, southOption]);

    const { result } = renderGeometry();

    await waitFor(() => {
      expect(result.current.routeOptions).toEqual([northOption, southOption]);
    });
    expect(result.current.allOptionsExcluded).toBe(false);
  });
});
