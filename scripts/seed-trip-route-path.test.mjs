import { describe, expect, it } from "vitest";
import {
  buildWaypoints,
  isProductionUrl,
  normalizeBaseUrl,
  parseArgs,
} from "./seed-trip-route-path.mjs";

describe("parseArgs", () => {
  it("mặc định là chạy khô", () => {
    expect(parseArgs([])).toMatchObject({
      apply: false,
      force: false,
      travelMode: "TRUCK",
      tripId: "",
    });
  });

  it("đọc chuyến, chế độ ghi và loại xe", () => {
    expect(
      parseArgs(["--trip=trip-1", "--apply", "--force", "--travel-mode=DRIVE"]),
    ).toMatchObject({
      apply: true,
      force: true,
      travelMode: "DRIVE",
      tripId: "trip-1",
    });
  });

  it("từ chối loại xe lạ", () => {
    expect(() => parseArgs(["--travel-mode=BICYCLE"])).toThrow(/travel-mode/);
  });
});

describe("buildWaypoints", () => {
  it("xếp bến đi → điểm dừng theo sequence → bến đến", () => {
    const waypoints = buildWaypoints({
      originStation: { name: "Bến A", latitude: 10.77, longitude: 106.7 },
      intermediateStops: [
        { name: "Dừng 2", sequence: 2, latitude: 11.0, longitude: 107.0 },
        { name: "Dừng 1", sequence: 1, latitude: 10.9, longitude: 106.9 },
      ],
      destinationStation: { name: "Bến B", latitude: 11.5, longitude: 107.4 },
    });

    expect(waypoints.map((point) => point.name)).toEqual([
      "Bến A",
      "Dừng 1",
      "Dừng 2",
      "Bến B",
    ]);
  });

  it("bỏ qua bến null để caller báo thiếu toạ độ", () => {
    expect(
      buildWaypoints({
        originStation: null,
        intermediateStops: [],
        destinationStation: null,
      }),
    ).toEqual([]);
  });
});

describe("normalizeBaseUrl / isProductionUrl", () => {
  it("cắt query, hash và dấu / thừa", () => {
    expect(normalizeBaseUrl("http://localhost:3000/api/?x=1#y")).toBe(
      "http://localhost:3000/api",
    );
  });

  it("nhận diện host production", () => {
    expect(isProductionUrl("https://api.vietride.online")).toBe(true);
    expect(isProductionUrl("http://localhost:3000")).toBe(false);
  });
});
