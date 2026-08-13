import { describe, expect, it } from "vitest";
import {
  bearingDegrees,
  buildPathProgress,
  haversineMeters,
  parseArgs,
  positionAtDistance,
} from "./simulate-trip-gps.mjs";

// Tuyến thẳng theo kinh độ ở vĩ độ TP.HCM — 0.01 độ lng ~ 1.09 km
const path = [
  { latitude: 10.77, longitude: 106.7 },
  { latitude: 10.77, longitude: 106.71 },
  { latitude: 10.77, longitude: 106.72 },
];

describe("parseArgs", () => {
  it("bắt buộc có --trip", () => {
    expect(() => parseArgs([])).toThrow(/--trip/);
  });

  it("đọc tốc độ và nhịp bắn", () => {
    const config = parseArgs(["--trip=trip-1", "--speed=60", "--interval=5"]);

    expect(config).toMatchObject({
      tripId: "trip-1",
      speedKmh: 60,
      intervalSeconds: 5,
    });
  });

  it("từ chối tốc độ không dương", () => {
    expect(() => parseArgs(["--trip=trip-1", "--speed=0"])).toThrow(/speed/);
  });

  it("từ chối --start ngoài 0-100", () => {
    expect(() => parseArgs(["--trip=trip-1", "--start=120"])).toThrow(/start/);
  });
});

describe("buildPathProgress", () => {
  it("cộng dồn quãng đường tới từng đỉnh", () => {
    const { cumulative, totalMeters } = buildPathProgress(path);

    expect(cumulative[0]).toBe(0);
    expect(cumulative[1]).toBeCloseTo(haversineMeters(path[0], path[1]), 5);
    expect(totalMeters).toBeCloseTo(cumulative[1] * 2, 3);
  });
});

describe("positionAtDistance", () => {
  const { cumulative, totalMeters } = buildPathProgress(path);

  it("nội suy đúng giữa hai đỉnh", () => {
    const position = positionAtDistance(path, cumulative, totalMeters / 2);

    expect(position.longitude).toBeCloseTo(106.71, 4);
    // Đi về phía đông ⇒ hướng ~90 độ
    expect(position.headingDeg).toBeCloseTo(90, 0);
  });

  it("kẹp về hai đầu tuyến khi vượt quá", () => {
    expect(positionAtDistance(path, cumulative, -100).longitude).toBeCloseTo(
      106.7,
      5,
    );
    expect(
      positionAtDistance(path, cumulative, totalMeters + 5_000).longitude,
    ).toBeCloseTo(106.72, 5);
  });

  it("không crash với tuyến một điểm", () => {
    const single = [path[0]];
    const progress = buildPathProgress(single);

    expect(positionAtDistance(single, progress.cumulative, 500)).toMatchObject({
      latitude: 10.77,
      longitude: 106.7,
    });
  });
});

describe("bearingDegrees", () => {
  it("trả 0-360 độ với gốc là hướng bắc", () => {
    expect(bearingDegrees(path[0], path[1])).toBeCloseTo(90, 0);
    expect(bearingDegrees(path[1], path[0])).toBeCloseTo(270, 0);
    expect(
      bearingDegrees(path[0], { latitude: 10.78, longitude: 106.7 }),
    ).toBeCloseTo(0, 0);
  });
});
