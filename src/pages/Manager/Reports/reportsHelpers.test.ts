import { describe, expect, it } from "vitest";
import { currentMonthValue, monthOptions } from "./reportsHelpers";

// Không pin TZ máy chạy test cụ thể sang Asia/Ho_Chi_Minh (không có trong
// vitest.config.ts) — thay vào đó assert tính NHẤT QUÁN nội tại: value phải
// khớp đúng lịch địa phương của chính label hiển thị, ở BẤT KỲ timezone nào.
// Bug cũ: value tính qua `date.toISOString().slice(0, 7)` (round-trip UTC)
// luôn lùi 1 tháng so với label (tính bằng getMonth()/getFullYear() local)
// tại mọi timezone có offset dương như +07:00 — dropdown ghi "8/2026" nhưng
// gửi API "2026-07".
function pad(value: number) {
  return String(value).padStart(2, "0");
}

describe("currentMonthValue / monthOptions", () => {
  it("matches the local calendar month (getFullYear/getMonth), not a UTC round-trip", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

    expect(currentMonthValue()).toBe(expected);
  });

  it("keeps every option's value in sync with its own displayed label", () => {
    const options = monthOptions();
    expect(options).toHaveLength(12);

    for (const option of options) {
      const [labelMonth, labelYear] = option.label.split("/");
      expect(option.value).toBe(`${labelYear}-${pad(Number(labelMonth))}`);
    }
  });
});
