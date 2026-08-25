import { describe, expect, it } from "vitest";
import {
  isUsableUuid,
  locationLabel,
  requiresLocationId,
  slaTone,
  splitRemainingMinutes,
} from "./parcelReliability";

describe("splitRemainingMinutes", () => {
  it("tách giờ/phút và giữ dấu để màn chọn được câu chữ", () => {
    expect(splitRemainingMinutes(135)).toEqual({
      overdue: false,
      hours: 2,
      minutes: 15,
    });
    // Quá hạn: BE trả số âm, không được nuốt mất dấu
    expect(splitRemainingMinutes(-90)).toEqual({
      overdue: true,
      hours: 1,
      minutes: 30,
    });
  });
});

describe("locationLabel", () => {
  it("ưu tiên tên, thiếu thì tới loại, cuối cùng mới tới nhãn chung", () => {
    expect(locationLabel({ name: "Bến C" }, "Chưa rõ")).toBe("Bến C");
    expect(
      locationLabel({ name: "  ", type: "WAREHOUSE" }, "Chưa rõ", (type) =>
        type === "WAREHOUSE" ? "Kho" : type,
      ),
    ).toBe("Kho");
    expect(locationLabel(null, "Chưa rõ")).toBe("Chưa rõ");
  });

  it("không bao giờ để lộ UUID của địa điểm", () => {
    const label = locationLabel(
      { id: "00000000-0000-0000-0000-000000000501" },
      "Chưa rõ",
    );
    expect(label).toBe("Chưa rõ");
  });
});

describe("requiresLocationId", () => {
  it("chỉ VEHICLE là không cần mã địa điểm", () => {
    expect(requiresLocationId("VEHICLE")).toBe(false);
    expect(requiresLocationId("WAREHOUSE")).toBe(true);
    expect(requiresLocationId("ROUTE_STOP")).toBe(true);
  });
});

describe("isUsableUuid", () => {
  it("chặn UUID rỗng — BE chưa guard và sẽ trả 500", () => {
    expect(isUsableUuid("00000000-0000-0000-0000-000000000000")).toBe(false);
  });

  it("chặn chuỗi không phải UUID", () => {
    expect(isUsableUuid("")).toBe(false);
    expect(isUsableUuid("user-9")).toBe(false);
  });

  it("nhận UUID hợp lệ, bỏ khoảng trắng thừa", () => {
    expect(isUsableUuid(" 36000000-0000-4000-8000-000000000901 ")).toBe(true);
  });
});

describe("slaTone", () => {
  it("chỉ nhuộm đỏ SLA đã vỡ, sắp đến hạn chỉ là cảnh báo", () => {
    expect(slaTone("BREACHED")).toBe("danger");
    expect(slaTone("DUE_SOON")).toBe("warning");
    expect(slaTone("ON_TRACK")).toBe("success");
    expect(slaTone("CLOSED")).toBe("neutral");
    expect(slaTone(undefined)).toBe("neutral");
  });
});
