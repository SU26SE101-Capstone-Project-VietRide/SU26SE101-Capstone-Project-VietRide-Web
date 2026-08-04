import { describe, expect, it } from "vitest";
import { formatCurrency } from "./currency";

describe("formatCurrency", () => {
  it("uses the single VietRide currency format", () => {
    expect(formatCurrency(138_050_000)).toBe("138.050.000 ₫");
    expect(formatCurrency("250000")).toBe("250.000 ₫");
    expect(formatCurrency("250.000")).toBe("250.000 ₫");
    expect(formatCurrency(-50_000)).toBe("-50.000 ₫");
  });

  it("uses the fallback for invalid values", () => {
    expect(formatCurrency(undefined)).toBe("-");
    expect(formatCurrency("not-a-number", "0 ₫")).toBe("0 ₫");
  });
});
