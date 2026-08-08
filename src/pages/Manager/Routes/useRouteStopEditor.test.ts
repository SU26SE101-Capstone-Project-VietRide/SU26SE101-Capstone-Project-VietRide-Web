// Test cho addStopFromSuggestion + re-index tự động của useRouteStopEditor
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OperatorStop } from "../../../api/vietride";
import { createOperatorStop } from "../../../api/vietride";
import type { RouteStopDraft, StopSuggestion } from "./types";
import { useRouteStopEditor } from "./useRouteStopEditor";

vi.mock("../../../api/vietride", () => ({
  createOperatorStop: vi.fn(),
}));

const translate = (key: string) => key;

// Đường thẳng cùng vĩ độ (lat=0) để khoảng cách từ điểm đầu tỉ lệ đơn giản với
// kinh độ — dễ tính tay, tránh sai lệch do xấp xỉ lượng giác trong projectPointOntoPolyline.
const pathPoints = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 10 },
];

function buildParams(overrides?: {
  onStopCreated?: (stop: OperatorStop) => void;
  setError?: (message: string) => void;
}) {
  return {
    selectedRoute: { id: "route-1" } as never,
    stations: [],
    originStationId: "",
    activeRouteKey: "route-1",
    activeRouteName: "Tuyến 1",
    invalidateLocalGeometry: vi.fn(),
    markRouteDirty: vi.fn(),
    setError: overrides?.setError ?? vi.fn(),
    showMessage: vi.fn(),
    t: translate,
    getPathPoints: () => pathPoints,
    onStopCreated: overrides?.onStopCreated,
  };
}

function existingDraft(
  overrides: Partial<RouteStopDraft>,
): RouteStopDraft {
  return {
    stopId: "stop-existing",
    orderIndex: 1,
    estimatedDurationFromOriginMinutes: 10,
    distanceFromOriginKm: 5,
    allowPickup: true,
    allowDropoff: true,
    routeId: "route-1",
    routeName: "Tuyến 1",
    stopName: "Điểm cũ",
    latitude: 10,
    longitude: 106,
    ...overrides,
  };
}

describe("useRouteStopEditor - addStopFromSuggestion", () => {
  beforeEach(() => {
    vi.mocked(createOperatorStop).mockReset();
  });

  it("a) thêm operatorStop giữa 2 stop sẵn có → re-index 1,2,3 theo km", async () => {
    const { result } = renderHook(() => useRouteStopEditor(buildParams()));

    act(() => {
      result.current.setRouteStopDrafts([
        existingDraft({
          stopId: "stop-near-start",
          orderIndex: 1,
          distanceFromStartKm: 100,
        }),
        existingDraft({
          stopId: "stop-near-end",
          orderIndex: 2,
          distanceFromStartKm: 1000,
        }),
      ]);
    });

    // Nằm đúng giữa path (longitude 5/10) → distanceFromStartKm tính ra ~556km,
    // nằm giữa 100 và 1000 ở trên bất kể sai số xấp xỉ lượng giác.
    const suggestion: StopSuggestion = {
      kind: "operatorStop",
      id: "stop-middle",
      name: "Điểm giữa",
      address: "Địa chỉ giữa",
      latitude: 0,
      longitude: 5,
      distanceFromStartKm: 25,
    };

    await act(async () => {
      await result.current.addStopFromSuggestion(suggestion, {
        allowPickup: true,
        allowDropoff: true,
      });
    });

    const drafts = result.current.currentRouteStops;
    expect(drafts).toHaveLength(3);
    expect(drafts.map((item) => item.stopId)).toEqual([
      "stop-near-start",
      "stop-middle",
      "stop-near-end",
    ]);
    expect(drafts.map((item) => item.orderIndex)).toEqual([1, 2, 3]);
  });

  it("e) thêm gợi ý vào tuyến có sẵn draft kiểu server (chỉ distanceFromOriginKm) → re-index đúng theo km, không nhảy lên đầu", async () => {
    const { result } = renderHook(() => useRouteStopEditor(buildParams()));

    // Draft nạp từ server: không có distanceFromStartKm, chỉ có distanceFromOriginKm
    // (field của RouteStopRequest) — case sử dụng chính khi mở 1 tuyến đã lưu.
    act(() => {
      result.current.setRouteStopDrafts([
        existingDraft({
          stopId: "stop-50km",
          orderIndex: 1,
          distanceFromOriginKm: 50,
        }),
        existingDraft({
          stopId: "stop-120km",
          orderIndex: 2,
          distanceFromOriginKm: 120,
        }),
      ]);
    });

    const suggestion: StopSuggestion = {
      kind: "operatorStop",
      id: "stop-80km",
      name: "Điểm 80km",
      address: "Địa chỉ 80km",
      // longitude 8/10 của path [0,0]→[0,10] (~1112km) → distanceFromStartKm ~890km,
      // không dùng ở case này để test đúng field distanceFromOriginKm — dùng path
      // riêng để suy ra ~80km thay vì phụ thuộc projectPointOntoPolyline thật.
      latitude: 0,
      longitude: 0.72,
      distanceFromStartKm: 80,
    };

    await act(async () => {
      await result.current.addStopFromSuggestion(suggestion, {
        allowPickup: true,
        allowDropoff: true,
      });
    });

    const drafts = result.current.currentRouteStops;
    expect(drafts).toHaveLength(3);
    expect(drafts.map((item) => item.stopId)).toEqual([
      "stop-50km",
      "stop-80km",
      "stop-120km",
    ]);
    expect(drafts.map((item) => item.orderIndex)).toEqual([1, 2, 3]);
  });

  it("b) googlePlace → createOperatorStop được gọi + onStopCreated nhận stop", async () => {
    const createdStop: OperatorStop = {
      id: "new-stop",
      operatorId: "op-1",
      name: "Địa điểm Google",
      latitude: 10.5,
      longitude: 106.5,
      googlePlaceId: "place-1",
      isActive: true,
    } as OperatorStop;

    vi.mocked(createOperatorStop).mockResolvedValue(createdStop);

    const onStopCreated = vi.fn();
    const { result } = renderHook(() =>
      useRouteStopEditor(buildParams({ onStopCreated })),
    );

    const suggestion: StopSuggestion = {
      kind: "googlePlace",
      id: "place-1",
      name: "Địa điểm Google",
      address: "123 Đường ABC",
      latitude: 10.5,
      longitude: 106.5,
      distanceFromStartKm: 25,
      googlePlaceId: "place-1",
    };

    await act(async () => {
      await result.current.addStopFromSuggestion(suggestion, {
        allowPickup: true,
        allowDropoff: true,
      });
    });

    await waitFor(() => {
      expect(createOperatorStop).toHaveBeenCalledWith({
        name: "Địa điểm Google",
        address: "123 Đường ABC",
        latitude: 10.5,
        longitude: 106.5,
        googlePlaceId: "place-1",
        description: "",
      });
    });
    expect(onStopCreated).toHaveBeenCalledWith(createdStop);
    expect(result.current.currentRouteStops).toHaveLength(1);
    expect(result.current.currentRouteStops[0].stopId).toBe("new-stop");
  });

  it("c) trùng stopId → setError, không thêm", async () => {
    const setError = vi.fn();
    const { result } = renderHook(() =>
      useRouteStopEditor(buildParams({ setError })),
    );

    act(() => {
      result.current.setRouteStopDrafts([
        existingDraft({ stopId: "stop-dup", orderIndex: 1 }),
      ]);
    });

    const suggestion: StopSuggestion = {
      kind: "operatorStop",
      id: "stop-dup",
      name: "Điểm trùng",
      address: "Địa chỉ trùng",
      latitude: 10.2,
      longitude: 106.2,
      distanceFromStartKm: 10,
    };

    await act(async () => {
      await result.current.addStopFromSuggestion(suggestion, {
        allowPickup: true,
        allowDropoff: true,
      });
    });

    expect(setError).toHaveBeenCalledWith("routes.duplicateStopInRoute");
    expect(result.current.currentRouteStops).toHaveLength(1);
    expect(createOperatorStop).not.toHaveBeenCalled();
  });

  // nit regression: chấm googlePlace trùng googlePlaceId với draft đã có
  // (thêm trước đó) → setError duplicate, KHÔNG gọi createOperatorStop tạo
  // OperatorStop thứ hai cho cùng một địa điểm Google.
  it("g) googlePlace trùng googlePlaceId với draft đã thêm → setError, không tạo stop mới", async () => {
    const setError = vi.fn();
    const { result } = renderHook(() =>
      useRouteStopEditor(buildParams({ setError })),
    );

    act(() => {
      result.current.setRouteStopDrafts([
        existingDraft({
          stopId: "existing-google-stop",
          orderIndex: 1,
          googlePlaceId: "place-dup",
        }),
      ]);
    });

    const suggestion: StopSuggestion = {
      kind: "googlePlace",
      id: "place-dup",
      name: "Địa điểm trùng",
      address: "Địa chỉ",
      latitude: 0,
      longitude: 3,
      distanceFromStartKm: 30,
      googlePlaceId: "place-dup",
    };

    await act(async () => {
      await result.current.addStopFromSuggestion(suggestion, {
        allowPickup: true,
        allowDropoff: true,
      });
    });

    expect(setError).toHaveBeenCalledWith("routes.duplicateStopInRoute");
    expect(createOperatorStop).not.toHaveBeenCalled();
    expect(result.current.currentRouteStops).toHaveLength(1);
  });

  it("d) remove → re-index còn lại 1..N", async () => {
    const { result } = renderHook(() => useRouteStopEditor(buildParams()));

    act(() => {
      result.current.setRouteStopDrafts([
        existingDraft({ stopId: "stop-1", orderIndex: 1 }),
        existingDraft({ stopId: "stop-2", orderIndex: 2 }),
        existingDraft({ stopId: "stop-3", orderIndex: 3 }),
      ]);
    });

    await act(async () => {
      await result.current.handleRemoveRouteStop(
        result.current.currentRouteStops[1],
      );
    });

    const remaining = result.current.currentRouteStops;
    expect(remaining.map((item) => item.stopId)).toEqual([
      "stop-1",
      "stop-3",
    ]);
    expect(remaining.map((item) => item.orderIndex)).toEqual([1, 2]);
  });

  // I-1 regression: getPathPoints phải được GỌI LÚC addStopFromSuggestion chạy
  // (đọc giá trị tươi tại thời điểm đó), không phải chụp giá trị lúc hook nhận
  // params. Mô phỏng bằng closure đọc một biến ngoài bị đổi SAU khi hook đã
  // render — nếu code chụp giá trị cũ (vd tham số `pathPoints` trực tiếp thay vì
  // getter) thì test này sẽ dùng path ngắn ban đầu và distanceFromOriginKm nhỏ
  // hẳn (clamp về điểm cuối path ~111km) thay vì path mới ~556km.
  it("f) getPathPoints đọc polyline TƯƠI tại thời điểm gọi, không chụp lúc hook render", async () => {
    let currentPath = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    ];
    const { result } = renderHook(() =>
      useRouteStopEditor({
        ...buildParams(),
        getPathPoints: () => currentPath,
      }),
    );

    // Đổi path SAU khi hook đã render — mô phỏng geometry.routePathPoints vừa
    // cập nhật ở cùng render mà stopEditor được tạo trước đó trong file thật
    currentPath = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 10 },
    ];

    const suggestion: StopSuggestion = {
      kind: "operatorStop",
      id: "stop-fresh",
      name: "Điểm mới",
      address: "Địa chỉ",
      latitude: 0,
      longitude: 5,
      distanceFromStartKm: 0,
    };

    await act(async () => {
      await result.current.addStopFromSuggestion(suggestion, {
        allowPickup: true,
        allowDropoff: true,
      });
    });

    const draft = result.current.currentRouteStops[0];
    // Path cũ (0→1 độ kinh, dài ~111km) sẽ clamp về ~111km; path mới (0→10 độ,
    // dài ~1112km) cho điểm giữa ~556km — ngưỡng 300 phân biệt rõ 2 trường hợp.
    expect(draft.distanceFromOriginKm).toBeGreaterThan(300);
  });
});
