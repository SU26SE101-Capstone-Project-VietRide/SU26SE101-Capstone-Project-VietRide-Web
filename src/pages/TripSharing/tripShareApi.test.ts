import { describe, expect, it } from "vitest";

import { parseSharedTripContext } from "./tripShareApi";

const baseData = {
  status: "IN_PROGRESS",
  expiresAt: "2026-08-16T00:00:00+07:00",
  lastUpdatedAt: null,
  vehicle: { location: null },
  route: {
    originName: "Bến xe Phú Yên",
    destinationName: "Bến xe Miền Đông Mới",
    geometry: null,
  },
  eta: null,
};

describe("parseSharedTripContext — điểm dừng", () => {
  it("BE chưa trả stops thì ra mảng rỗng, không vỡ trang", () => {
    const context = parseSharedTripContext(baseData);

    expect(context.route.stops).toEqual([]);
    expect(context.route.originName).toBe("Bến xe Phú Yên");
  });

  it("sắp xếp điểm dừng theo sequence dù BE trả lộn xộn", () => {
    const context = parseSharedTripContext({
      ...baseData,
      route: {
        ...baseData.route,
        stops: [
          { name: "Phan Thiết", latitude: 10.9, longitude: 108.1, sequence: 2 },
          { name: "Nha Trang", latitude: 12.2, longitude: 109.1, sequence: 1 },
        ],
      },
    });

    expect(context.route.stops.map((stop) => stop.name)).toEqual([
      "Nha Trang",
      "Phan Thiết",
    ]);
  });

  it("bỏ điểm dừng thiếu tên hoặc toạ độ không hợp lệ", () => {
    const context = parseSharedTripContext({
      ...baseData,
      route: {
        ...baseData.route,
        stops: [
          { name: "Hợp lệ", latitude: 12.2, longitude: 109.1, sequence: 1 },
          { name: "", latitude: 12.2, longitude: 109.1, sequence: 2 },
          { name: "Sai toạ độ", latitude: 999, longitude: 109.1, sequence: 3 },
          { name: "Thiếu toạ độ", sequence: 4 },
          "không phải object",
        ],
      },
    });

    expect(context.route.stops).toEqual([
      { name: "Hợp lệ", latitude: 12.2, longitude: 109.1, sequence: 1 },
    ]);
  });

  it("stops không phải mảng thì coi như không có", () => {
    const context = parseSharedTripContext({
      ...baseData,
      route: { ...baseData.route, stops: { name: "sai kiểu" } },
    });

    expect(context.route.stops).toEqual([]);
  });
});
