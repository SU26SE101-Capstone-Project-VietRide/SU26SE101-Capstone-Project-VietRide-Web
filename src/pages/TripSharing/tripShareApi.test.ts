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

describe("parseSharedTripContext — toạ độ hai bến", () => {
  it("đọc origin/destination BE mới bổ sung", () => {
    const context = parseSharedTripContext({
      ...baseData,
      route: {
        ...baseData.route,
        origin: { latitude: 13.09, longitude: 109.3 },
        destination: { latitude: 10.88, longitude: 106.79 },
      },
    });

    expect(context.route.origin).toEqual({ latitude: 13.09, longitude: 109.3 });
    expect(context.route.destination).toEqual({
      latitude: 10.88,
      longitude: 106.79,
    });
  });

  it("thiếu bến hoặc bến null thì trả null chứ không dựng toạ độ rỗng", () => {
    const context = parseSharedTripContext({
      ...baseData,
      route: { ...baseData.route, origin: null },
    });

    expect(context.route.origin).toBeNull();
    expect(context.route.destination).toBeNull();
  });

  it("bỏ toạ độ ngoài dải hợp lệ thay vì chấm marker sai chỗ", () => {
    const context = parseSharedTripContext({
      ...baseData,
      route: {
        ...baseData.route,
        origin: { latitude: 91, longitude: 109.3 },
        destination: { latitude: 10.88, longitude: "106.79" },
      },
    });

    expect(context.route.origin).toBeNull();
    expect(context.route.destination).toBeNull();
  });
});
