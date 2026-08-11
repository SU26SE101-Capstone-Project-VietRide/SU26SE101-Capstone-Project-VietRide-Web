import { describe, expect, it } from "vitest";
import { toCreateRequest, toForm, type VoucherForm } from "./voucherHelpers";

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
  fundingType: "OPERATOR_FUNDED",
};

describe("voucher date helpers", () => {
  it("sends the selected validUntil date and time as a timestamp", () => {
    const request = toCreateRequest(form);
    const expected = new Date(2026, 8, 10, 18, 45).toISOString();

    expect(request.validUntil).toBe(expected);
    expect(request.validUntil).toMatch(/T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("maps BE timestamps back to local date and datetime inputs", () => {
    const voucher = {
      ...form,
      id: "voucher-1",
      validFrom: "2026-09-01T08:30:00+07:00",
      validUntil: "2026-09-10T23:59:59.999+07:00",
      value: 10,
      minOrderAmount: 0,
      maxDiscountAmount: 50000,
      totalUsageLimit: 100,
      perUserLimit: 1,
      applicableRouteIds: [],
      applicableServices: ["BOOKING" as const],
    };

    const mapped = toForm(voucher);

    expect(mapped.validFrom).toContain("T08:30");
    expect(mapped.validUntil).toContain("2026-09-10T23:59");
  });
});
