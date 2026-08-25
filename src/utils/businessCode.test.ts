import {
  displayBusinessCode,
  isValidRouteCode,
  normalizeRouteCode,
  pickSettlementTripCode,
  routeCodePayload,
} from "./businessCode";

describe("displayBusinessCode", () => {
  it("trả mã khi có", () => {
    expect(displayBusinessCode("TRIP-20260824-M5Q7WV3D")).toBe(
      "TRIP-20260824-M5Q7WV3D",
    );
  });

  it("trả '-' cho null, undefined và chuỗi trắng", () => {
    expect(displayBusinessCode(null)).toBe("-");
    expect(displayBusinessCode(undefined)).toBe("-");
    expect(displayBusinessCode("   ")).toBe("-");
  });

  it("cho phép đổi placeholder", () => {
    expect(displayBusinessCode(null, "Chưa có mã")).toBe("Chưa có mã");
  });
});

describe("normalizeRouteCode", () => {
  it("trim và viết hoa", () => {
    expect(normalizeRouteCode("  sg-dl-01 ")).toBe("SG-DL-01");
  });
});

describe("isValidRouteCode", () => {
  it("nhận mã hợp lệ sau khi chuẩn hoá", () => {
    expect(isValidRouteCode("sg-dl-01")).toBe(true);
    expect(isValidRouteCode("A1")).toBe(true);
    expect(isValidRouteCode("A".repeat(20))).toBe(true);
  });

  it("từ chối mã quá ngắn, quá dài, sai ký tự hoặc mở đầu bằng gạch ngang", () => {
    expect(isValidRouteCode("A")).toBe(false);
    expect(isValidRouteCode("A".repeat(21))).toBe(false);
    expect(isValidRouteCode("SG_DL")).toBe(false);
    expect(isValidRouteCode("-SG")).toBe(false);
    expect(isValidRouteCode("SÀI-GÒN")).toBe(false);
  });
});

describe("routeCodePayload", () => {
  it("gửi mã đã chuẩn hoá khi người dùng có nhập", () => {
    expect(routeCodePayload(" sg-dl-01 ")).toEqual({ code: "SG-DL-01" });
  });

  // Bỏ trống = giữ nguyên mã cũ. Gửi "" là ý định xoá mã, BE trả 422.
  it("bỏ hẳn field khi ô mã để trống", () => {
    expect(routeCodePayload("")).toEqual({});
    expect(routeCodePayload("   ")).toEqual({});
    expect("code" in routeCodePayload("")).toBe(false);
  });
});

describe("pickSettlementTripCode", () => {
  it("ưu tiên top-level tripCode của bản admin", () => {
    expect(
      pickSettlementTripCode({
        tripCode: "TRIP-ADMIN",
        trip: { tripCode: "TRIP-SNAPSHOT" },
      }),
    ).toBe("TRIP-ADMIN");
  });

  it("đọc snapshot trip của bản operator khi không có top-level", () => {
    expect(
      pickSettlementTripCode({ trip: { tripCode: "TRIP-SNAPSHOT" } }),
    ).toBe("TRIP-SNAPSHOT");
  });

  it("không vỡ khi trip=null do enrichment fail-soft", () => {
    expect(pickSettlementTripCode({ trip: null })).toBeUndefined();
    expect(pickSettlementTripCode({})).toBeUndefined();
  });
});
