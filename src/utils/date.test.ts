import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatDateTimeYmd,
  toExclusiveUtcDayEnd,
  toUtcDayStart,
} from "./date";

describe("formatDateTimeYmd", () => {
  // Dùng cạnh ô datetime-local (hiện "2026-09-01 15:00"), nên phải cùng thứ tự
  // với nó chứ không theo dd-MM-yyyy của bảng.
  it("giữ thứ tự yyyy-MM-dd HH:mm giống ô nhập ngày giờ", () => {
    expect(formatDateTimeYmd("2026-09-01T15:00")).toBe("2026-09-01 15:00");
    expect(formatDateTime("2026-09-01T15:00")).toBe("01-09-2026 15:00");
  });

  it("trả nguyên giá trị khi không parse được", () => {
    expect(formatDateTimeYmd("")).toBe("-");
    expect(formatDateTimeYmd("khong-phai-ngay")).toBe("khong-phai-ngay");
  });
});

describe("toUtcDayStart / toExclusiveUtcDayEnd", () => {
  it("converts a Vietnam calendar day to its UTC half-open range (API-timezone-consistency.md §5.5)", () => {
    // departureDate=2026-08-10 => [2026-08-09T17:00:00Z, 2026-08-10T17:00:00Z)
    expect(toUtcDayStart("2026-08-10")).toBe("2026-08-09T17:00:00.000Z");
    expect(toExclusiveUtcDayEnd("2026-08-10")).toBe("2026-08-10T17:00:00.000Z");
  });

  it("returns undefined for an empty date so buildQuery drops the param", () => {
    expect(toUtcDayStart("")).toBeUndefined();
    expect(toExclusiveUtcDayEnd("")).toBeUndefined();
  });
});
