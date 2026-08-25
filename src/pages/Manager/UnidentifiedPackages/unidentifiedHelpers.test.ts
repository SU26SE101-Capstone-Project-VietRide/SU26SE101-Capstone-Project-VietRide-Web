import { describe, expect, it } from "vitest";
import {
  hasPackageAction,
  packageStatusTone,
  parseRegisterPackageDraft,
  type RegisterPackageDraft,
} from "./unidentifiedHelpers";

function draft(overrides: Partial<RegisterPackageDraft> = {}): RegisterPackageDraft {
  return {
    temporaryExceptionTag: "TMP-BEN-B-001",
    tripId: "",
    locationType: "WAREHOUSE",
    locationId: "36000000-0000-4000-8000-000000000502",
    locationSnapshot: "",
    description: "Thùng carton nâu",
    observedWeightKg: "",
    evidenceReferences: ["https://cdn.example/a.jpg"],
    ...overrides,
  };
}

describe("hasPackageAction", () => {
  it("chỉ mở nút ghép theo danh sách BE trả về", () => {
    expect(hasPackageAction(["MATCH"], "MATCH")).toBe(true);
    // Package đã ghép: BE trả availableActions rỗng, ghép lại sẽ ra 500
    expect(hasPackageAction([], "MATCH")).toBe(false);
    expect(hasPackageAction(undefined, "MATCH")).toBe(false);
  });
});

describe("parseRegisterPackageDraft", () => {
  it("dựng request tối thiểu, bỏ hẳn các trường tuỳ chọn để trống", () => {
    expect(parseRegisterPackageDraft(draft())).toEqual({
      ok: true,
      value: {
        temporaryExceptionTag: "TMP-BEN-B-001",
        locationType: "WAREHOUSE",
        locationId: "36000000-0000-4000-8000-000000000502",
        description: "Thùng carton nâu",
        evidenceReferences: ["https://cdn.example/a.jpg"],
      },
    });
  });

  it("gửi đủ các trường tuỳ chọn khi có nhập", () => {
    const result = parseRegisterPackageDraft(
      draft({
        tripId: "36000000-0000-4000-8000-000000000401",
        locationSnapshot: " Kho bến B ",
        observedWeightKg: "4.2",
        evidenceReferences: [
          "https://cdn.example/a.jpg",
          "https://cdn.example/b.jpg",
        ],
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        tripId: "36000000-0000-4000-8000-000000000401",
        locationSnapshot: "Kho bến B",
        observedWeightKg: 4.2,
        evidenceReferences: [
          "https://cdn.example/a.jpg",
          "https://cdn.example/b.jpg",
        ],
      }),
    });
  });

  it("bắt buộc mã tạm và mô tả — Domain ném exception không coded", () => {
    expect(
      parseRegisterPackageDraft(draft({ temporaryExceptionTag: "  " })),
    ).toEqual({ ok: false, error: "tag-required" });
    expect(parseRegisterPackageDraft(draft({ description: "" }))).toEqual({
      ok: false,
      error: "description-required",
    });
  });

  // Khác custody scan: entity này đòi mã địa điểm kể cả khi ở trên xe.
  it("bắt buộc mã địa điểm kể cả với VEHICLE", () => {
    expect(
      parseRegisterPackageDraft(
        draft({ locationType: "VEHICLE", locationId: "" }),
      ),
    ).toEqual({ ok: false, error: "location-id-invalid" });
  });

  it("chặn UUID rỗng cho địa điểm và chuyến", () => {
    expect(
      parseRegisterPackageDraft(
        draft({ locationId: "00000000-0000-0000-0000-000000000000" }),
      ),
    ).toEqual({ ok: false, error: "location-id-invalid" });
    expect(parseRegisterPackageDraft(draft({ tripId: "trip-1" }))).toEqual({
      ok: false,
      error: "trip-id-invalid",
    });
  });

  it("cân nặng nếu có phải lớn hơn 0", () => {
    expect(parseRegisterPackageDraft(draft({ observedWeightKg: "0" }))).toEqual({
      ok: false,
      error: "weight-invalid",
    });
    expect(parseRegisterPackageDraft(draft({ observedWeightKg: "-2" }))).toEqual({
      ok: false,
      error: "weight-invalid",
    });
  });

  it("bắt buộc ít nhất một ảnh", () => {
    expect(
      parseRegisterPackageDraft(draft({ evidenceReferences: [] })),
    ).toEqual({ ok: false, error: "evidence-required" });
  });
});

describe("packageStatusTone", () => {
  it("kiện chờ ghép là việc cần làm, không phải lỗi", () => {
    expect(packageStatusTone("UNIDENTIFIED")).toBe("warning");
    expect(packageStatusTone("MATCHED")).toBe("success");
    expect(packageStatusTone("FORWARDED")).toBe("info");
    expect(packageStatusTone("RETURNED")).toBe("neutral");
  });
});
