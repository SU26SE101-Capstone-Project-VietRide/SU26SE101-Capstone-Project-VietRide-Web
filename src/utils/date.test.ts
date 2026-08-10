import { describe, expect, it } from "vitest";
import { toExclusiveUtcDayEnd, toUtcDayStart } from "./date";

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
