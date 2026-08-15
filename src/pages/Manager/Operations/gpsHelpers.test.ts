import { describe, expect, it } from "vitest";
import {
  bearingBetween,
  markPassedStops,
  resolveVehicleHeading,
  routeGeometryPath,
  routeStopMarkers,
  splitRouteAtPosition,
  type TripRouteMarker,
} from "./gpsHelpers";

// Tuyến thẳng theo kinh độ ở vĩ độ TP.HCM — 0.01 độ lng ~ 1.09 km.
const route = [
  { lat: 10.77, lng: 106.7 },
  { lat: 10.77, lng: 106.71 },
  { lat: 10.77, lng: 106.72 },
];

describe("splitRouteAtPosition", () => {
  it("splits the route at the vehicle so both halves share the same joint", () => {
    const { traveled, remaining } = splitRouteAtPosition(route, {
      lat: 10.77,
      lng: 106.715,
    });

    // Điểm cắt phải nằm giữa đoạn thứ hai
    expect(traveled.at(-1)?.lng).toBeCloseTo(106.715, 5);
    // Hai đoạn phải nối liền nhau, không hở
    expect(remaining[0]).toEqual(traveled.at(-1));
    expect(traveled[0]).toEqual(route[0]);
    expect(remaining.at(-1)).toEqual(route.at(-1));
  });

  it("keeps every original vertex before and after the split point", () => {
    const { traveled, remaining } = splitRouteAtPosition(route, {
      lat: 10.77,
      lng: 106.715,
    });

    // Đỉnh giữa (106.71) đã đi qua nên thuộc nửa "đã đi"
    expect(traveled).toContainEqual(route[1]);
    expect(remaining).toContainEqual(route[2]);
  });

  it("treats a vehicle at the very start as having travelled nothing", () => {
    const { traveled, remaining } = splitRouteAtPosition(route, route[0]);

    expect(traveled).toEqual([route[0], route[0]]);
    expect(remaining).toHaveLength(route.length);
  });

  it("gives the whole route back as remaining when the vehicle is far off route", () => {
    // Lệch ~5.5km về phía bắc — vượt ngưỡng 500m
    const { traveled, remaining } = splitRouteAtPosition(route, {
      lat: 10.82,
      lng: 106.71,
    });

    expect(traveled).toEqual([]);
    expect(remaining).toEqual(route);
  });

  it("returns the route untouched when there is no GPS position yet", () => {
    const { traveled, remaining } = splitRouteAtPosition(route, null);

    expect(traveled).toEqual([]);
    expect(remaining).toEqual(route);
  });

  it("does not crash on a route with fewer than two points", () => {
    expect(splitRouteAtPosition([], { lat: 10.77, lng: 106.7 })).toEqual({
      traveled: [],
      remaining: [],
    });
  });
});

describe("routeGeometryPath", () => {
  // Shape contract hiện hành: polyline nằm trong geometry.points. Đọc nhầm ở
  // cấp cao nhất là bản đồ Trung tâm vận hành không vẽ được lộ trình nào.
  it("đọc polyline tuyến từ geometry.points", () => {
    expect(
      routeGeometryPath({
        tripId: "trip-1",
        geometry: {
          source: "ROUTE_POLYLINE",
          points: [
            { latitude: 10.77, longitude: 106.7 },
            { latitude: 10.78, longitude: 106.71 },
          ],
        },
      }),
    ).toEqual([
      { lat: 10.77, lng: 106.7 },
      { lat: 10.78, lng: 106.71 },
    ]);
  });

  it("vẫn đọc được shape phẳng cũ của BE", () => {
    expect(
      routeGeometryPath({
        tripId: "trip-1",
        points: [
          { latitude: 10.78, longitude: 106.71, orderIndex: 1 },
          { latitude: 10.77, longitude: 106.7, orderIndex: 0 },
        ],
      }),
    ).toEqual([
      { lat: 10.77, lng: 106.7 },
      { lat: 10.78, lng: 106.71 },
    ]);
  });

  // Fallback STOPS_ONLY: `points` chỉ là toạ độ điểm dừng (thiếu cả hai bến) —
  // vẽ nó ra là đúng tuyến giả chim bay mà contract cấm
  it("không vẽ points của fallback STOPS_ONLY thành tuyến", () => {
    expect(
      routeGeometryPath({
        tripId: "trip-1",
        geometrySource: "STOPS_ONLY",
        points: [
          { latitude: 10.9, longitude: 106.9 },
          { latitude: 11.5, longitude: 107.4 },
        ],
      }),
    ).toEqual([]);
  });

  it("không nối marker thành tuyến giả khi geometry rỗng", () => {
    expect(
      routeGeometryPath({
        tripId: "trip-1",
        geometry: null,
        originStation: {
          stationId: "station-1",
          name: "Bến A",
          latitude: 10.77,
          longitude: 106.7,
        },
        destinationStation: {
          stationId: "station-2",
          name: "Bến B",
          latitude: 11.5,
          longitude: 107.4,
        },
      }),
    ).toEqual([]);
  });
});

describe("routeStopMarkers", () => {
  it("xếp bến đi → điểm dừng theo sequence → bến đến", () => {
    const markers = routeStopMarkers({
      tripId: "trip-1",
      geometry: null,
      originStation: {
        stationId: "station-1",
        name: "Bến A",
        latitude: 10.77,
        longitude: 106.7,
      },
      intermediateStops: [
        {
          stopId: "stop-2",
          name: "Dừng 2",
          sequence: 2,
          latitude: 11.0,
          longitude: 107.0,
        },
        {
          stopId: "stop-1",
          name: "Dừng 1",
          sequence: 1,
          latitude: 10.9,
          longitude: 106.9,
        },
      ],
      destinationStation: {
        stationId: "station-2",
        name: "Bến B",
        latitude: 11.5,
        longitude: 107.4,
      },
    });

    expect(markers.map((marker) => marker.name)).toEqual([
      "Bến A",
      "Dừng 1",
      "Dừng 2",
      "Bến B",
    ]);
    expect(markers.map((marker) => marker.kind)).toEqual([
      "origin",
      "stop",
      "stop",
      "destination",
    ]);
    // Điểm dừng giữa tuyến đánh số 1..N theo thứ tự chạy để hiện trong marker;
    // bến đi/bến đến không đánh số
    expect(markers.map((marker) => marker.orderIndex)).toEqual([
      undefined,
      1,
      2,
      undefined,
    ]);
    expect(markers[0].position).toEqual({ lat: 10.77, lng: 106.7 });
  });

  it("bỏ qua bến thiếu toạ độ hợp lệ (BE trả null)", () => {
    expect(
      routeStopMarkers({
        tripId: "trip-1",
        geometry: null,
        originStation: null,
        intermediateStops: [],
        destinationStation: null,
      }),
    ).toEqual([]);
  });
});

describe("bearingBetween", () => {
  it("trả 90 độ khi đi thẳng về hướng đông", () => {
    expect(
      Math.round(
        bearingBetween({ lat: 10.77, lng: 106.7 }, { lat: 10.77, lng: 106.71 }),
      ),
    ).toBe(90);
  });

  it("trả 0 độ khi đi thẳng lên bắc", () => {
    expect(
      Math.round(
        bearingBetween({ lat: 10.77, lng: 106.7 }, { lat: 10.78, lng: 106.7 }),
      ),
    ).toBe(0);
  });

  it("chuẩn hoá về khoảng 0–360 khi đi hướng tây", () => {
    const heading = bearingBetween(
      { lat: 10.77, lng: 106.7 },
      { lat: 10.77, lng: 106.69 },
    );
    expect(Math.round(heading)).toBe(270);
  });
});

describe("resolveVehicleHeading", () => {
  it("ưu tiên headingDeg do thiết bị gửi", () => {
    expect(
      resolveVehicleHeading(135, [
        { latitude: 10.77, longitude: 106.7 },
        { latitude: 10.77, longitude: 106.69 },
      ]),
    ).toBe(135);
  });

  it("chuẩn hoá headingDeg vượt ngoài 0–360", () => {
    expect(resolveVehicleHeading(450, [])).toBe(90);
    expect(resolveVehicleHeading(-90, [])).toBe(270);
  });

  it("suy hướng từ hai điểm GPS khi thiết bị không gửi", () => {
    const heading = resolveVehicleHeading(undefined, [
      { latitude: 10.77, longitude: 106.71 },
      { latitude: 10.77, longitude: 106.7 },
    ]);
    expect(Math.round(heading ?? -1)).toBe(90);
  });

  it("trả null khi xe gần như đứng yên — marker giữ hướng cũ thay vì quay loạn", () => {
    expect(
      resolveVehicleHeading(undefined, [
        { latitude: 10.77, longitude: 106.7 },
        // ~1m, dưới ngưỡng nhiễu
        { latitude: 10.77, longitude: 106.700009 },
      ]),
    ).toBeNull();
  });

  it("lùi về điểm xa hơn trong trail khi điểm liền kề quá sát", () => {
    const heading = resolveVehicleHeading(undefined, [
      { latitude: 10.77, longitude: 106.71 },
      { latitude: 10.77, longitude: 106.709995 },
      { latitude: 10.77, longitude: 106.7 },
    ]);
    expect(Math.round(heading ?? -1)).toBe(90);
  });

  it("trả null khi chưa có điểm nào", () => {
    expect(resolveVehicleHeading(undefined, [])).toBeNull();
  });
});

describe("markPassedStops", () => {
  const stops: TripRouteMarker[] = [
    { id: "a", kind: "origin", name: "Bến A", position: { lat: 10.77, lng: 106.7 } },
    { id: "b", kind: "stop", name: "Dừng 1", position: { lat: 10.77, lng: 106.71 } },
    { id: "c", kind: "destination", name: "Bến B", position: { lat: 10.77, lng: 106.72 } },
  ];

  it("đánh dấu đúng các điểm nằm sau lưng xe", () => {
    // Xe ở giữa điểm dừng 1 và bến đến
    const marked = markPassedStops(stops, route, { lat: 10.77, lng: 106.715 });
    expect(marked.map((stop) => stop.passed)).toEqual([true, true, false]);
  });

  it("tính bến đi là đã qua khi xe đang đứng ngay tại đó", () => {
    const marked = markPassedStops(stops, route, { lat: 10.77, lng: 106.7 });
    expect(marked.map((stop) => stop.passed)).toEqual([true, false, false]);
  });

  it("không mờ điểm nào khi xe lệch quá xa tuyến", () => {
    // Cách tuyến ~11km — chiếu lên tuyến không còn ý nghĩa
    const marked = markPassedStops(stops, route, { lat: 10.87, lng: 106.715 });
    expect(marked.every((stop) => stop.passed === undefined)).toBe(true);
  });

  it("không mờ điểm nào khi chưa có vị trí xe", () => {
    expect(markPassedStops(stops, route, null)).toEqual(stops);
  });

  it("không mờ điểm nào khi tuyến chưa có đường đi", () => {
    expect(markPassedStops(stops, [], { lat: 10.77, lng: 106.715 })).toEqual(
      stops,
    );
  });
});
