import { describe, expect, it } from "vitest";
import {
  toCreateRequest,
  toForm,
  toIsoLocal,
  type VoucherForm,
} from "./voucherHelpers";

// Không pin TZ máy chạy test sang Asia/Ho_Chi_Minh (vitest.config.ts cố tình
// không pin — xem Reports/reportsHelpers.test.ts). Vì vậy đừng hardcode
// "T08:30": chuỗi BE "…+07:00" chỉ ra 08:30 khi máy chạy ở +07, còn CI chạy
// UTC thì ra 01:30 và test đỏ dù code đúng. Thay vào đó assert tính NHẤT QUÁN:
// giá trị datetime-local phải khớp đúng lịch địa phương của chính mốc thời
// gian đó, ở BẤT KỲ timezone nào.
function pad(value: number) {
  return String(value).padStart(2, "0");
}

function localInputValue(date: Date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

const form: VoucherForm = {
  code: "SUMMER",
  name: "Summer voucher",
  type: "PERCENT_OFF",
  value: "10",
  minOrderAmount: "0",
  maxDiscountAmount: "50000",
  totalUsageLimit: "100",
  perUserLimit: "1",
  validFrom: "2026-09-01T08:30",
  validUntil: "2026-09-10T18:45",
  applicableService: "BOOKING",
  applicableRouteIds: "",
};

describe("voucher date helpers", () => {
  it("sends the selected validUntil date and time as a timestamp", () => {
    const request = toCreateRequest(form);
    const expected = new Date(2026, 8, 10, 18, 45).toISOString();

    expect(request.validUntil).toBe(expected);
    expect(request.validUntil).toMatch(/T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("keeps the operator-only API defaults after hiding admin scope fields", () => {
    const request = toCreateRequest(form);

    expect(request.fundingType).toBe("OPERATOR_FUNDED");
    expect(request.applicableServices).toEqual(["BOOKING"]);
    expect(request.applicableRouteIds).toEqual([]);
  });

  it("maps BE timestamps back to local date and datetime inputs", () => {
    const validFrom = "2026-09-01T08:30:00+07:00";
    const validUntil = "2026-09-10T23:59:59.999+07:00";
    const voucher = {
      ...form,
      id: "voucher-1",
      validFrom,
      validUntil,
      value: 10,
      minOrderAmount: 0,
      maxDiscountAmount: 50000,
      totalUsageLimit: 100,
      perUserLimit: 1,
      applicableRouteIds: [],
      applicableServices: ["BOOKING" as const],
    };

    const mapped = toForm(voucher);

    expect(mapped.validFrom).toBe(localInputValue(new Date(validFrom)));
    expect(mapped.validUntil).toBe(localInputValue(new Date(validUntil)));

    // Đưa lại lên BE phải ra đúng mốc thời gian ban đầu — bắt được lỗi lệch
    // offset mà so sánh chuỗi thuần không thấy (validUntil bị cắt giây nên
    // chỉ round-trip validFrom).
    expect(toIsoLocal(mapped.validFrom)).toBe(new Date(validFrom).toISOString());
  });
});
