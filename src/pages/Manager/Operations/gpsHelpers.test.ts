import { describe, expect, it } from "vitest";
import { splitRouteAtPosition } from "./gpsHelpers";

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
