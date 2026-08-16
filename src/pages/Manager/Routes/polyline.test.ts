import { describe, expect, it } from "vitest";
import {
  decodeGooglePolyline,
  encodeGooglePolyline,
  limitPolylinePoints,
  MAX_POLYLINE_POINTS,
  estimateCoachDurationMinutes,
  parseGoogleDurationSeconds,
  projectPointOntoPolyline,
} from "./polyline";

describe("Google encoded polyline", () => {
  const points = [
    { latitude: 38.5, longitude: -120.2 },
    { latitude: 40.7, longitude: -120.95 },
    { latitude: 43.252, longitude: -126.453 },
  ];

  it("encodes coordinates using precision 5", () => {
    expect(encodeGooglePolyline(points)).toBe(
      "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
    );
  });

  it("decodes a precision-5 polyline", () => {
    expect(decodeGooglePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual(
      points,
    );
  });

  it("rejects an incomplete polyline", () => {
    expect(() => decodeGooglePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`"))
      .toThrow("Invalid encoded polyline");
  });

  it("uses a coach operating speed instead of optimistic car duration", () => {
    expect(estimateCoachDurationMinutes(435.4, 19_500)).toBe(581);
  });

  it("keeps a slower duration returned by the road router", () => {
    expect(estimateCoachDurationMinutes(100, 12_000)).toBe(200);
  });

  it("parses the protobuf duration returned by Google Routes", () => {
    expect(parseGoogleDurationSeconds("543.5s")).toBe(543.5);
  });

  it("rejects an invalid Google Routes duration", () => {
    expect(parseGoogleDurationSeconds("9 minutes")).toBe(0);
  });
});

describe("projectPointOntoPolyline", () => {
  // Đường thẳng nằm ngang ~111 km trên xích đạo: (0,105) → (0,106)
  const path = [
    { latitude: 0, longitude: 105 },
    { latitude: 0, longitude: 105.5 },
    { latitude: 0, longitude: 106 },
  ];

  it("điểm giữa tuyến: km tích luỹ ~ nửa chiều dài, khoảng cách tới đường ~0", () => {
    const result = projectPointOntoPolyline(path, { latitude: 0, longitude: 105.5 });
    expect(result.distanceFromStartKm).toBeGreaterThan(54);
    expect(result.distanceFromStartKm).toBeLessThan(58);
    expect(result.distanceToPathKm).toBeLessThan(0.1);
  });

  it("điểm lệch khỏi đường 0.1 độ vĩ: distanceToPathKm ~11 km, km tích luỹ theo chân chiếu", () => {
    const result = projectPointOntoPolyline(path, { latitude: 0.1, longitude: 105.25 });
    expect(result.distanceToPathKm).toBeGreaterThan(10);
    expect(result.distanceToPathKm).toBeLessThan(12.5);
    expect(result.distanceFromStartKm).toBeGreaterThan(26);
    expect(result.distanceFromStartKm).toBeLessThan(30);
  });

  it("điểm trước đầu tuyến: kẹp về 0 km", () => {
    const result = projectPointOntoPolyline(path, { latitude: 0, longitude: 104.5 });
    expect(result.distanceFromStartKm).toBe(0);
  });

  it("path < 2 điểm: trả 0/Infinity, không throw", () => {
    const result = projectPointOntoPolyline([], { latitude: 0, longitude: 105 });
    expect(result.distanceFromStartKm).toBe(0);
    expect(result.distanceToPathKm).toBe(Number.POSITIVE_INFINITY);
  });
});

// BE tu choi polyline giai ma ra qua 10.000 diem (ROUTE_GEOMETRY_INVALID). Google
// Routes tra HIGH_QUALITY nen tuyen lien tinh vai tram km vuot nguong rat de.
describe("gioi han so diem truoc khi gui BE", () => {
  function fakeRoute(count: number) {
    return Array.from({ length: count }, (_, index) => ({
      latitude: 10 + index / 1e5,
      longitude: 106 + index / 1e5,
    }));
  }

  it("giu nguyen tuyen ngan", () => {
    const points = fakeRoute(50);
    expect(limitPolylinePoints(points)).toHaveLength(50);
  });

  it("rut gon tuyen dai xuong duoi nguong cua BE", () => {
    const limited = limitPolylinePoints(fakeRoute(40_000));
    expect(limited).toHaveLength(MAX_POLYLINE_POINTS);
    expect(MAX_POLYLINE_POINTS).toBeLessThan(10_000);
  });

  it("luon giu diem dau va diem cuoi", () => {
    const points = fakeRoute(40_000);
    const limited = limitPolylinePoints(points);
    expect(limited[0]).toEqual(points[0]);
    expect(limited[limited.length - 1]).toEqual(points[points.length - 1]);
  });

  it("encode tu dong rut gon nen chuoi gui di khong bao gio qua nguong", () => {
    const encoded = encodeGooglePolyline(fakeRoute(40_000));
    expect(decodeGooglePolyline(encoded)).toHaveLength(MAX_POLYLINE_POINTS);
  });
});
