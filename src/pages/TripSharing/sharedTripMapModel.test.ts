import { describe, expect, it } from "vitest";

import {
  destinationStopColor,
  originStopColor,
  routeRemainingColor,
  routeTraveledColor,
} from "./sharedTripVisualStyle";
import { buildSharedTripMapModel } from "./sharedTripMapModel";
import type { SharedTripContext, SharedTripVehicleLocation } from "./tripShareApi";

const labels = {
  origin: "Bến đi",
  destination: "Bến đến",
  stop: "Điểm dừng",
  vehicle: "Vị trí xe",
};

// Tuyến thẳng theo kinh độ để phép chiếu vị trí xe lên tuyến dễ suy luận.
const coordinates: [number, number][] = [
  [106.0, 10.0],
  [106.1, 10.0],
  [106.2, 10.0],
  [106.3, 10.0],
];

function makeContext(
  overrides: Partial<SharedTripContext["route"]> = {},
): SharedTripContext {
  return {
    status: "IN_PROGRESS",
    expiresAt: "2026-08-16T00:00:00+07:00",
    lastUpdatedAt: null,
    vehicle: { location: null },
    route: {
      originName: "Bến xe Phú Yên",
      destinationName: "Bến xe Miền Đông Mới",
      origin: { latitude: 10.0, longitude: 106.0 },
      destination: { latitude: 10.0, longitude: 106.3 },
      stops: [],
      geometry: { type: "LineString", coordinates },
      ...overrides,
    },
    eta: null,
  };
}

const movingVehicle: SharedTripVehicleLocation = {
  latitude: 10.0,
  longitude: 106.1,
  heading: 90,
  speedKph: 42,
  recordedAt: "2026-08-15T10:00:00+07:00",
};

describe("buildSharedTripMapModel", () => {
  it("vẽ bến đi/bến đến theo toạ độ BE trả, không suy từ hai đầu tuyến", () => {
    const model = buildSharedTripMapModel(makeContext(), null, labels);

    const origin = model.markers.find((marker) => marker.id === "route-origin");
    const destination = model.markers.find(
      (marker) => marker.id === "route-destination",
    );

    expect(origin?.position).toEqual({ lat: 10.0, lng: 106.0 });
    expect(origin?.icon?.fillColor).toBe(originStopColor);
    expect(origin?.infoTitle).toBe("Bến xe Phú Yên");
    expect(destination?.position).toEqual({ lat: 10.0, lng: 106.3 });
    expect(destination?.icon?.fillColor).toBe(destinationStopColor);
    expect(model.hasRoute).toBe(true);
  });

  it("vẽ điểm dừng giữa tuyến thành đĩa đánh số theo thứ tự chạy", () => {
    const model = buildSharedTripMapModel(
      makeContext({
        stops: [
          { name: "Trạm Nha Trang", latitude: 10.0, longitude: 106.1, sequence: 1 },
          { name: "Trạm Phan Thiết", latitude: 10.0, longitude: 106.2, sequence: 2 },
        ],
      }),
      null,
      labels,
    );

    const stops = model.markers.filter((marker) =>
      marker.id.startsWith("route-stop-"),
    );

    expect(stops).toHaveLength(2);
    expect(stops.map((stop) => stop.label?.text)).toEqual(["1", "2"]);
    expect(stops.map((stop) => stop.infoTitle)).toEqual([
      "Trạm Nha Trang",
      "Trạm Phan Thiết",
    ]);
    expect(stops[0]?.icon?.strokeColor).toBe(originStopColor);
    expect(model.hasStops).toBe(true);
  });

  it("không có điểm dừng thì không vẽ marker điểm dừng", () => {
    const model = buildSharedTripMapModel(makeContext(), null, labels);

    expect(
      model.markers.some((marker) => marker.id.startsWith("route-stop-")),
    ).toBe(false);
    expect(model.hasStops).toBe(false);
  });

  it("cắt tuyến tại vị trí xe: đoạn đã đi đậm, đoạn còn lại nhạt", () => {
    const model = buildSharedTripMapModel(makeContext(), movingVehicle, labels);

    const traveled = model.polylines.find(
      (line) => line.id === "shared-route-traveled",
    );
    const remaining = model.polylines.find(
      (line) => line.id === "shared-route-remaining",
    );

    expect(traveled?.color).toBe(routeTraveledColor);
    expect(remaining?.color).toBe(routeRemainingColor);
    // Đoạn đã đi kết thúc tại hình chiếu của xe lên tuyến
    expect(traveled?.path.at(-1)).toEqual({ lat: 10.0, lng: 106.1 });
    expect(remaining?.path[0]).toEqual({ lat: 10.0, lng: 106.1 });
    expect(model.hasTraveledSegment).toBe(true);
  });

  it("chưa có GPS thì cả tuyến là đoạn còn lại và không có marker xe", () => {
    const model = buildSharedTripMapModel(makeContext(), null, labels);

    expect(model.polylines.map((line) => line.id)).toEqual([
      "shared-route-remaining",
    ]);
    expect(model.hasTraveledSegment).toBe(false);
    expect(model.hasVehicle).toBe(false);
    expect(model.markers.some((marker) => marker.id === "vehicle")).toBe(false);
  });

  it("marker xe gồm đĩa trạng thái và mũi tên xoay theo hướng chạy", () => {
    const model = buildSharedTripMapModel(makeContext(), movingVehicle, labels);

    const disc = model.markers.find((marker) => marker.id === "vehicle");
    const arrow = model.markers.find((marker) => marker.id === "vehicle-arrow");

    expect(disc?.position).toEqual({ lat: 10.0, lng: 106.1 });
    expect(disc?.title).toBe("Vị trí xe");
    expect(arrow?.icon?.rotation).toBe(90);
    // Mũi tên phải nằm trên đĩa, đĩa nằm trên marker tuyến
    expect(arrow?.zIndex).toBeGreaterThan(disc?.zIndex ?? 0);
    expect(model.hasVehicle).toBe(true);
  });

  it("xe đứng yên đổi màu đĩa sang trạng thái dừng", () => {
    const moving = buildSharedTripMapModel(makeContext(), movingVehicle, labels);
    const stopped = buildSharedTripMapModel(
      makeContext(),
      { ...movingVehicle, speedKph: 0 },
      labels,
    );

    const movingFill = moving.markers.find((m) => m.id === "vehicle")?.icon
      ?.fillColor;
    const stoppedFill = stopped.markers.find((m) => m.id === "vehicle")?.icon
      ?.fillColor;

    expect(movingFill).not.toBe(stoppedFill);
  });

  it("không có context thì không vẽ gì", () => {
    const model = buildSharedTripMapModel(null, null, labels);

    expect(model.markers).toHaveLength(0);
    expect(model.polylines).toHaveLength(0);
    expect(model.hasRoute).toBe(false);
    expect(model.hasEndpoints).toBe(false);
  });

  // Bốn luật dưới đây do BE chốt khi bổ sung route.origin/destination/stops
  // (2026-08-15) — giữ test để đổi code không lặng lẽ phá contract.
  describe("tuyến chưa lưu polyline (geometry = null)", () => {
    const withoutGeometry = () =>
      makeContext({
        geometry: null,
        stops: [
          { name: "Trạm Nha Trang", latitude: 10.0, longitude: 106.1, sequence: 1 },
        ],
      });

    it("vẫn chấm đủ bến và điểm dừng", () => {
      const model = buildSharedTripMapModel(withoutGeometry(), null, labels);

      expect(model.markers.map((marker) => marker.id)).toEqual([
        "route-origin",
        "route-stop-0",
        "route-destination",
      ]);
      expect(model.hasEndpoints).toBe(true);
      expect(model.hasStops).toBe(true);
    });

    it("KHÔNG tự nối các marker thành đường thẳng giả", () => {
      const model = buildSharedTripMapModel(withoutGeometry(), null, labels);

      expect(model.polylines).toHaveLength(0);
      expect(model.routePath).toHaveLength(0);
      expect(model.hasRoute).toBe(false);
    });

    it("vẫn đưa mọi marker vào khung nhìn để chúng không nằm ngoài màn hình", () => {
      const model = buildSharedTripMapModel(withoutGeometry(), null, labels);

      expect(model.focusPoints).toEqual([
        { lat: 10.0, lng: 106.0 },
        { lat: 10.0, lng: 106.1 },
        { lat: 10.0, lng: 106.3 },
      ]);
    });
  });

  it("bỏ marker của bến mà BE trả null, không đoán toạ độ thay", () => {
    const model = buildSharedTripMapModel(
      makeContext({ origin: null }),
      null,
      labels,
    );

    expect(model.markers.find((marker) => marker.id === "route-origin")).toBeUndefined();
    expect(
      model.markers.find((marker) => marker.id === "route-destination")?.position,
    ).toEqual({ lat: 10.0, lng: 106.3 });
    // Còn một bến thì chú giải vẫn phải giải thích pin đang hiện.
    expect(model.hasEndpoints).toBe(true);
  });

  it("xếp marker theo chiều chạy: bến đi → điểm dừng → bến đến", () => {
    const model = buildSharedTripMapModel(
      // BE trả lệch thứ tự để chắc chắn marker bám `sequence` chứ không bám
      // thứ tự phần tử trong mảng.
      makeContext({
        stops: [
          { name: "Trạm B", latitude: 10.0, longitude: 106.2, sequence: 2 },
          { name: "Trạm A", latitude: 10.0, longitude: 106.1, sequence: 1 },
        ],
      }),
      null,
      labels,
    );

    expect(model.markers.map((marker) => marker.title)).toEqual([
      "Bến xe Phú Yên",
      "Trạm A",
      "Trạm B",
      "Bến xe Miền Đông Mới",
    ]);
    // Số trên đĩa phải là 1 cho Trạm A, 2 cho Trạm B.
    expect(model.markers[1]?.label?.text).toBe("1");
    expect(model.markers[2]?.label?.text).toBe("2");
  });
});
