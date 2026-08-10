// Test luồng lọc phương án trùng đường loại trừ của useRouteGeometry (dùng khi
// soạn tuyến thay thế: excludedPathPoints = polyline tuyến chính). Chỉ mock
// requestRoadGeometry — các helper so trùng/dedupe dùng bản thật để test đúng
// ngưỡng khoảng cách như production.
import { act, renderHook, waitFor } from "@testing-library/react";
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

// Regression: thêm/gỡ điểm dừng (useRouteStopEditor) gọi invalidateLocalGeometry
// với keepViaPoints — trước đây hàm này luôn xoá sạch viaPoints + không tự áp
// lại đường, khiến (1) điểm nắn user vừa kéo bị mất khi đổi tab/thêm điểm dừng
// và (2) đường không còn "đã áp" (routePathPoints rỗng) nên không kéo nắn tiếp
// được cho tới khi user bấm chọn lại phương án.
describe("useRouteGeometry — invalidateLocalGeometry({ keepViaPoints: true })", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps user-dragged via points and auto-applies the recomputed option after a stop-triggered invalidate", async () => {
    mockedRequestRoadGeometry.mockResolvedValue([northOption]);

    const { result, rerender } = renderHook(
      (props: { routeWaypoints: RouteCoordinate[] }) =>
        useRouteGeometry({
          selectedRouteId: "route-1",
          routeWaypoints: props.routeWaypoints,
          isWorkspaceActive: true,
          setRouteForm: vi.fn(),
          setRoutes: vi.fn(),
          setError: vi.fn(),
          t: ((key: string) => key) as TranslateFn,
        }),
      { initialProps: { routeWaypoints: waypoints } },
    );

    await waitFor(() => {
      expect(result.current.routeOptions).toEqual([northOption]);
    });

    // User kéo thêm 1 điểm nắn — áp đường mới + ghi nhận vào viaPoints
    const viaPoint: RouteCoordinate = { latitude: 11.3, longitude: 107.3 };
    const bentOption: RoadRouteOption = {
      points: [waypoints[0], viaPoint, waypoints[1]],
      totalDistanceKm: 320,
      estimatedDurationMinutes: 300,
    };
    mockedRequestRoadGeometry.mockResolvedValue([bentOption]);
    act(() => {
      result.current.handleAddViaPoint(viaPoint);
    });

    await waitFor(() => {
      expect(result.current.viaPoints).toEqual([viaPoint]);
    });
    expect(result.current.routePathPoints).toEqual(bentOption.points);

    // Thêm 1 điểm dừng: routeWaypoints đổi (bao gồm điểm dừng mới) NGAY trong
    // cùng lượt cập nhật với invalidateLocalGeometry({keepViaPoints:true}) —
    // đúng batching thật của addStopFromSuggestion (không có await xen giữa).
    const newStop: RouteCoordinate = { latitude: 11.6, longitude: 107.8 };
    const nextWaypoints = [waypoints[0], newStop, waypoints[1]];
    const recomputedWithStopAndVia: RoadRouteOption = {
      points: [waypoints[0], viaPoint, newStop, waypoints[1]],
      totalDistanceKm: 330,
      estimatedDurationMinutes: 310,
    };
    mockedRequestRoadGeometry.mockResolvedValue([recomputedWithStopAndVia]);

    act(() => {
      result.current.invalidateLocalGeometry("route-1", {
        keepViaPoints: true,
      });
      rerender({ routeWaypoints: nextWaypoints });
    });

    // Điểm nắn không bị xoá — vẫn còn ngay sau invalidate
    expect(result.current.viaPoints).toEqual([viaPoint]);

    // Auto-fetch chạy lại (debounce 400ms) với waypoint mới, kèm điểm nắn cũ —
    // kết quả phải tự áp NGAY vào routePathPoints, không chờ user bấm chọn,
    // nên vẫn kéo nắn tiếp được (hasSavedOrDraftPath ở RouteDesignMap dựa vào đây).
    await waitFor(
      () => {
        expect(result.current.routePathPoints).toEqual(
          recomputedWithStopAndVia.points,
        );
      },
      { timeout: 3000 },
    );
    expect(result.current.isGeometryDirty).toBe(true);
    expect(mockedRequestRoadGeometry).toHaveBeenLastCalledWith(
      nextWaypoints,
      "routes.routingFailed",
      expect.objectContaining({ intermediates: [viaPoint] }),
    );
  });
});
