import { describe, expect, it } from "vitest";
import { parcelReasonLabel } from "./parcelReason";

// Câu tiếng Anh do BE ghi vào cột reason phải quy được về mã, nếu không nó hiện
// nguyên văn tiếng Anh trên timeline của màn Hàng hóa và màn Sự cố kiện hàng.
describe("parcelReasonLabel", () => {
  const dictionary: Record<string, string> = {
    "parcels.statusHistoryReasons.PARCEL_UNRESOLVED_DURING_DESTINATION_RECONCILIATION":
      "Đối soát tại điểm đến kết thúc mà vẫn chưa xác định được kiện hàng.",
    "parcels.statusHistoryReasons.TRIP_CANCELLED": "Chuyến bị hủy",
  };
  const t = (key: string, options?: Record<string, unknown>) =>
    dictionary[key] ?? String(options?.defaultValue ?? key);

  it("dịch câu của BE", () => {
    expect(
      parcelReasonLabel(
        t,
        "Parcel was unresolved during destination reconciliation.",
      ),
    ).toBe("Đối soát tại điểm đến kết thúc mà vẫn chưa xác định được kiện hàng.");
  });

  it("dịch cả mã enum thường của BE", () => {
    expect(parcelReasonLabel(t, "TRIP_CANCELLED")).toBe("Chuyến bị hủy");
  });

  // Mock i18n của các test màn này trả về CHÍNH KHOÁ kể cả khi có
  // `defaultValue`, nên chữ tự nhập không được phép đi qua `t`.
  it("giữ nguyên chữ tự nhập và bỏ qua chuỗi rỗng", () => {
    expect(parcelReasonLabel(t, "Khách hẹn lấy chiều mai")).toBe(
      "Khách hẹn lấy chiều mai",
    );
    expect(parcelReasonLabel(t, "   ")).toBe("");
    expect(parcelReasonLabel(t, null)).toBe("");
  });
});
