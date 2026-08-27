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
import { __clearGeometryOptionsCacheForTest } from "./useRouteGeometry";
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
    // Cache phương án nay ở module-level (+ sessionStorage) để không gọi lại
    // Goong khi quay lại tuyến — test phải tự dọn giữa các case.
    __clearGeometryOptionsCacheForTest();
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

// Kéo nắn: Google Maps giữ đường bám mặt đường suốt thao tác, không có đoạn
// chim bay nào. Muốn preview cũng là đường bộ thật mà vẫn kịp theo tay thì nó
// phải nhỏ — chỉ tính lại CHẶNG đang nắn (2 waypoint + 1 via) rồi ghép vào
// đường hiện có, thay vì tính lại cả tuyến qua mọi điểm dừng.
describe("useRouteGeometry — preview khi kéo điểm nắn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Cache phương án nay ở module-level (+ sessionStorage) để không gọi lại
    // Goong khi quay lại tuyến — test phải tự dọn giữa các case.
    __clearGeometryOptionsCacheForTest();
  });

  // Đường bộ "đã áp" gồm 5 đỉnh; điểm dừng giữa tuyến nằm ở đỉnh thứ 4
  const roadPath: RouteCoordinate[] = [
    { latitude: 10.0, longitude: 106.0 },
    { latitude: 10.0, longitude: 106.1 },
    { latitude: 10.0, longitude: 106.2 },
    { latitude: 10.0, longitude: 106.3 },
    { latitude: 10.0, longitude: 106.4 },
  ];
  const legWaypoints: RouteCoordinate[] = [
    { latitude: 10.0, longitude: 106.0 },
    { latitude: 10.0, longitude: 106.3 },
    { latitude: 10.0, longitude: 106.4 },
  ];

  function renderWithAppliedPath() {
    const view = renderHook(() =>
      useRouteGeometry({
        selectedRouteId: "route-1",
        routeWaypoints: legWaypoints,
        isWorkspaceActive: true,
        setRouteForm: vi.fn(),
        setRoutes: vi.fn(),
        setError: vi.fn(),
        t: ((key: string) => key) as TranslateFn,
      }),
    );

    act(() => {
      view.result.current.applyComputedGeometry(roadPath);
    });

    return view;
  }

  // Toạ độ bến hiếm khi nằm đúng trên mặt đường (Directions nắn nó về đỉnh
  // đường gần nhất — đo thật trên Phú Nhuận là lệch tới 660m). Preview lấy đỉnh
  // polyline làm đầu chặng, còn phép tính lúc thả chuột lại hỏi từ chính toạ độ
  // bến: hai bộ điểm khác nhau cho hai hình đường khác nhau, và người dùng thấy
  // đường nhảy ngay khi buông tay.
  it("previews from the route terminus, not the snapped polyline vertex", async () => {
    // Bến đi nằm LỆCH khỏi đỉnh đầu của đường đã áp
    const offRoadOrigin = { latitude: 10.02, longitude: 105.98 };
    const view = renderHook(() =>
      useRouteGeometry({
        selectedRouteId: "route-1",
        routeWaypoints: [offRoadOrigin, { latitude: 10.0, longitude: 106.4 }],
        isWorkspaceActive: true,
        setRouteForm: vi.fn(),
        setRoutes: vi.fn(),
        setError: vi.fn(),
        t: ((key: string) => key) as TranslateFn,
      }),
    );

    act(() => {
      view.result.current.applyComputedGeometry(roadPath);
    });
    mockedRequestRoadGeometry.mockClear();
    mockedRequestRoadGeometry.mockResolvedValue([
      {
        points: roadPath,
        totalDistanceKm: 42,
        estimatedDurationMinutes: 55,
      },
    ]);

    act(() => {
      const index = view.result.current.handleBeginViaPointDrag({
        latitude: 10.0,
        longitude: 106.15,
      });
      view.result.current.handleDragViaPoint(index, {
        latitude: 10.2,
        longitude: 106.15,
      });
    });

    await waitFor(() => {
      expect(mockedRequestRoadGeometry).toHaveBeenCalledTimes(1);
    });

    // Không có điểm dừng giữa tuyến → chặng nắn trải hết đường, nên hai đầu
    // phải là ĐÚNG hai bến, y như phép tính lúc thả chuột
    const [points] = mockedRequestRoadGeometry.mock.calls[0];
    expect(points[0]).toEqual(offRoadOrigin);
    expect(points[points.length - 1]).toEqual({
      latitude: 10.0,
      longitude: 106.4,
    });
  });

  it("only recomputes the dragged leg and splices the road geometry back in", async () => {
    const { result } = renderWithAppliedPath();
    mockedRequestRoadGeometry.mockClear();
    // Hình đường bộ Google trả cho chặng 106.0 → 106.3 khi ghé qua điểm kéo
    mockedRequestRoadGeometry.mockResolvedValue([
      {
        points: [
          { latitude: 10.0, longitude: 106.0 },
          { latitude: 10.2, longitude: 106.1 },
          { latitude: 10.2, longitude: 106.2 },
          { latitude: 10.0, longitude: 106.3 },
        ],
        totalDistanceKm: 42,
        estimatedDurationMinutes: 55,
      },
    ]);

    act(() => {
      const index = result.current.handleBeginViaPointDrag({
        latitude: 10.0,
        longitude: 106.15,
      });
      result.current.handleDragViaPoint(index, {
        latitude: 10.2,
        longitude: 106.15,
      });
    });

    await waitFor(() => {
      expect(mockedRequestRoadGeometry).toHaveBeenCalledTimes(1);
    });

    // Request chỉ gồm hai mỏ neo của chặng — KHÔNG phải cả tuyến. Mỏ neo sau là
    // điểm dừng ở 106.3, nên đoạn 106.3 → 106.4 không nằm trong request.
    const [points, , opts] = mockedRequestRoadGeometry.mock.calls[0];
    expect(points).toEqual([
      { latitude: 10.0, longitude: 106.0 },
      { latitude: 10.0, longitude: 106.3 },
    ]);
    expect(opts?.intermediates).toEqual([
      { latitude: 10.2, longitude: 106.15 },
    ]);

    // Đường vẽ ra = hình chặng mới ghép vào chỗ cũ; đỉnh 106.4 sau điểm dừng
    // còn nguyên, và không có đỉnh nào là "nối thẳng qua con trỏ"
    await waitFor(() => {
      expect(result.current.routePathPoints).toEqual([
        { latitude: 10.0, longitude: 106.0 },
        { latitude: 10.2, longitude: 106.1 },
        { latitude: 10.2, longitude: 106.2 },
        { latitude: 10.0, longitude: 106.3 },
        { latitude: 10.0, longitude: 106.4 },
      ]);
    });
  });

  it("throttles the drag preview instead of firing one request per mouse move", async () => {
    const { result } = renderWithAppliedPath();
    mockedRequestRoadGeometry.mockClear();
    mockedRequestRoadGeometry.mockResolvedValue([
      {
        points: roadPath,
        totalDistanceKm: 40,
        estimatedDurationMinutes: 50,
      },
    ]);

    act(() => {
      const index = result.current.handleBeginViaPointDrag({
        latitude: 10.0,
        longitude: 106.15,
      });
      // Ba nhịp chuột liên tiếp trong cùng một khung throttle
      result.current.handleDragViaPoint(index, {
        latitude: 10.2,
        longitude: 106.15,
      });
      result.current.handleDragViaPoint(index, {
        latitude: 10.3,
        longitude: 106.15,
      });
      result.current.handleDragViaPoint(index, {
        latitude: 10.4,
        longitude: 106.15,
      });
    });

    await waitFor(() => {
      expect(mockedRequestRoadGeometry).toHaveBeenCalledTimes(1);
    });
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
    // Cache phương án nay ở module-level (+ sessionStorage) để không gọi lại
    // Goong khi quay lại tuyến — test phải tự dọn giữa các case.
    __clearGeometryOptionsCacheForTest();
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
