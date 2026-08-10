import { describe, expect, it } from "vitest";
import type { AdminLocation } from "../api/vietride";
import {
  addressSegments,
  matchProvinceCode,
  matchWardId,
  normalizeLocationName,
} from "./locationMatching";

function location(
  id: string,
  code: string,
  name: string,
  type = "WARD",
): AdminLocation {
  return { id, code, name, type, sortOrder: 0, isActive: true };
}

const provinces = [
  location("p-79", "79", "Thành phố Hồ Chí Minh", "MUNICIPALITY"),
  location("p-68", "68", "Lâm Đồng", "PROVINCE"),
];

describe("normalizeLocationName", () => {
  it("bỏ dấu, hạ chữ thường và cắt tiền tố cấp hành chính", () => {
    expect(normalizeLocationName("Phường Vũng Tàu")).toBe("vung tau");
    expect(normalizeLocationName("Thành phố Hồ Chí Minh")).toBe("ho chi minh");
    expect(normalizeLocationName("Xã Đại Lào")).toBe("dai lao");
  });
});

describe("addressSegments", () => {
  it("tách theo dấu phẩy và bỏ phần quốc gia", () => {
    expect(
      addressSegments("Xuân Hương - Đà Lạt, Lâm Đồng, Việt Nam"),
    ).toEqual(["xuan huong da lat", "lam dong"]);
  });
});

describe("matchProvinceCode", () => {
  it("khớp tỉnh từ một mảnh của địa chỉ", () => {
    expect(
      matchProvinceCode("1 Quang Trung, Lâm Đồng, Việt Nam", "", provinces),
    ).toBe("68");
  });

  it("dùng được cả trường city riêng của Google", () => {
    expect(
      matchProvinceCode("1 Quang Trung", "Thành phố Hồ Chí Minh", provinces),
    ).toBe("79");
  });

  it("trả rỗng khi không mảnh nào khớp", () => {
    expect(matchProvinceCode("1 Quang Trung, Hà Nội", "", provinces)).toBe("");
  });
});

describe("matchWardId", () => {
  const wards = [
    location("w-1", "68001", "Phường Xuân Hương - Đà Lạt"),
    location("w-2", "68002", "Phường 1"),
    location("w-3", "68003", "Xã Đại Lào"),
  ];

  it("khớp phường dù địa chỉ Google thiếu tiền tố", () => {
    expect(
      matchWardId("1 Quang Trung, Xuân Hương - Đà Lạt, Lâm Đồng", wards),
    ).toBe("w-1");
  });

  it("không để mảnh số ngắn khớp bừa vào Phường 1", () => {
    expect(matchWardId("1 Quang Trung, Lâm Đồng", wards)).toBe("");
  });

  it("trả rỗng khi khớp nhiều hơn một phường/xã", () => {
    const ambiguous = [
      location("w-a", "68010", "Phường Lộc Sơn"),
      location("w-b", "68011", "Xã Lộc Sơn"),
    ];
    expect(matchWardId("Lộc Sơn, Lâm Đồng", ambiguous)).toBe("");
  });

  it("trả rỗng khi không có phường/xã nào khớp", () => {
    expect(matchWardId("Somewhere else, Hà Nội", wards)).toBe("");
  });
});
