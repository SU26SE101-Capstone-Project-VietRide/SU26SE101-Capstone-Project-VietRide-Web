import { describe, expect, it } from "vitest";
import {
  buildShuttlePickups,
  isProductionBaseUrl,
  parseArgs,
  pickAvailableSeats,
  pickDriver,
  pickTrip,
  pickVehicle,
} from "./seed-shuttle-dispatch.mjs";

describe("parseArgs", () => {
  it("mặc định chạy khô với 3 booking 1 ghế", () => {
    expect(parseArgs([])).toMatchObject({
      apply: false,
      allowProduction: false,
      bookings: 3,
      seats: 1,
    });
  });

  it("từ chối số booking ngoài khoảng cho phép", () => {
    expect(() => parseArgs(["--bookings=0"])).toThrow(/1\.\.10/);
    expect(() => parseArgs(["--bookings=11"])).toThrow(/1\.\.10/);
  });

  it("bắt --start phải đi kèm --assign vì không có gì để khởi hành", () => {
    expect(() => parseArgs(["--start"])).toThrow(/--assign/);
    expect(parseArgs(["--assign", "--start"]).startShuttle).toBe(true);
  });

  it("từ chối tham số lạ thay vì im lặng bỏ qua", () => {
    expect(() => parseArgs(["--aply"])).toThrow(/không hiểu/);
  });
});

describe("isProductionBaseUrl", () => {
  it("nhận diện host production", () => {
    expect(isProductionBaseUrl("https://api.vietride.online")).toBe(true);
    expect(isProductionBaseUrl("http://localhost:3000")).toBe(false);
  });
});

describe("pickTrip", () => {
  const now = new Date("2026-08-15T08:00:00Z").getTime();
  const trip = (tripId, minutesFromNow, status = "SCHEDULED") => ({
    tripId,
    status,
    departureAt: new Date(now + minutesFromNow * 60_000).toISOString(),
  });

  it("bỏ chuyến quá sát giờ vì BE đã đóng cửa nhận trung chuyển", () => {
    expect(pickTrip([trip("a", 30)], now)).toBeNull();
  });

  it("chọn chuyến gần nhất trong số các chuyến còn đủ thời gian", () => {
    const chosen = pickTrip([trip("xa", 600), trip("gan", 180)], now);
    expect(chosen?.tripId).toBe("gan");
  });

  it("bỏ chuyến không ở trạng thái SCHEDULED", () => {
    expect(pickTrip([trip("a", 300, "IN_PROGRESS")], now)).toBeNull();
  });
});

describe("buildShuttlePickups", () => {
  const station = { latitude: 10.8, longitude: 106.63, city: "TP.HCM" };

  it("rải mỗi điểm một chỗ, không trùng toạ độ", () => {
    const pickups = buildShuttlePickups(station, 4);
    const unique = new Set(pickups.map((p) => `${p.latitude},${p.longitude}`));

    expect(pickups).toHaveLength(4);
    expect(unique.size).toBe(4);
  });

  it("giữ mọi điểm trong bán kính hợp lý quanh bến", () => {
    for (const pickup of buildShuttlePickups(station, 5)) {
      const latKm = Math.abs(pickup.latitude - station.latitude) * 111;
      const lngKm =
        Math.abs(pickup.longitude - station.longitude) *
        111 *
        Math.cos((station.latitude * Math.PI) / 180);
      expect(Math.hypot(latKm, lngKm)).toBeLessThanOrEqual(5.1);
    }
  });

  it("địa chỉ có tên đường và thành phố của bến", () => {
    const [first] = buildShuttlePickups(station, 1);
    expect(first.address).toMatch(/TP\.HCM$/);
  });
});

describe("pickAvailableSeats", () => {
  const seatMap = [
    { seatNumber: "A01", status: "BOOKED" },
    { seatNumber: "A02", status: "AVAILABLE" },
    { seatNumber: "A03", status: "AVAILABLE" },
    { seatNumber: "A04", status: "HELD" },
  ];

  it("bỏ ghế đã bán và ghế đang giữ", () => {
    expect(pickAvailableSeats(seatMap, 2)).toEqual([
      { seatNumber: "A02" },
      { seatNumber: "A03" },
    ]);
  });

  it("không phát lại ghế đã cấp cho booking trước", () => {
    expect(pickAvailableSeats(seatMap, 1, ["A02"])).toEqual([
      { seatNumber: "A03" },
    ]);
  });

  it("báo lỗi rõ khi không còn đủ ghế", () => {
    expect(() => pickAvailableSeats(seatMap, 3)).toThrow(/không còn đủ ghế/i);
  });
});

describe("pickVehicle / pickDriver", () => {
  it("chọn xe nhỏ nhất còn đủ chỗ, giữ xe lớn cho nhóm đông", () => {
    const vehicles = [
      { vehicleId: "to", status: "ACTIVE", totalSeats: 16 },
      { vehicleId: "vua", status: "ACTIVE", totalSeats: 7 },
      { vehicleId: "nho", status: "ACTIVE", totalSeats: 4 },
    ];
    expect(pickVehicle(vehicles, 5)?.vehicleId).toBe("vua");
  });

  it("bỏ xe không ACTIVE", () => {
    expect(
      pickVehicle([{ vehicleId: "x", status: "MAINTENANCE", totalSeats: 16 }], 2),
    ).toBeNull();
  });

  it("chỉ nhận tài xế ACTIVE", () => {
    const users = [
      { userId: "a", role: "DRIVER", status: "LOCKED" },
      { userId: "b", role: "DRIVER", status: "ACTIVE" },
    ];
    expect(pickDriver(users)?.userId).toBe("b");
  });
});
