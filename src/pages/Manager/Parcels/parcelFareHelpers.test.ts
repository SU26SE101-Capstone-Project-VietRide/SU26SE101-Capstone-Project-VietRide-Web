import { describe, expect, it } from "vitest";
import type { ParcelRouteFare } from "../../../api/vietride";
import {
  buildFareSelection,
  buildNextFareSelection,
  getRouteFareSummary,
  parcelSizeCategories,
} from "./parcelFareHelpers";

const now = new Date("2026-08-10T03:00:00Z");

function fare(
  sizeCategory: ParcelRouteFare["sizeCategory"],
  overrides: Partial<ParcelRouteFare> = {},
): ParcelRouteFare {
  return {
    routeId: "route-1",
    operatorId: "operator-1",
    sizeCategory,
    priceVnd: 50_000,
    effectiveFrom: "2026-08-01T00:00:00Z",
    effectiveUntil: "2026-08-31T23:59:59Z",
    ...overrides,
  };
}

describe("parcel fare route summaries", () => {
  it("marks a complete active window and prefills it for safe updates", () => {
    const fares = parcelSizeCategories.map((category, index) =>
      fare(category, { priceVnd: (index + 1) * 10_000 }),
    );
    const summary = getRouteFareSummary("route-1", fares, now);

    expect(summary.status).toBe("ACTIVE");
    expect(summary.hasScheduledWindow).toBe(false);
    expect(buildFareSelection(summary, now)).toEqual({
      mode: "UPDATE",
      prices: {
        SMALL: "10000",
        MEDIUM: "20000",
        LARGE: "30000",
        EXTRA_LARGE: "40000",
      },
      effectiveFrom: "2026-08-01T00:00:00Z",
      effectiveUntil: "2026-08-31T23:59:59Z",
    });
  });

  it("marks missing size prices as incomplete", () => {
    const summary = getRouteFareSummary(
      "route-1",
      [fare("SMALL"), fare("MEDIUM")],
      now,
    );

    expect(summary.status).toBe("INCOMPLETE");
    expect(buildFareSelection(summary, now).mode).toBe("COMPLETE");
  });

  it("renews an expired window while preserving prices as suggestions", () => {
    const summary = getRouteFareSummary(
      "route-1",
      parcelSizeCategories.map((category) =>
        fare(category, { effectiveUntil: "2026-08-05T00:00:00Z" }),
      ),
      now,
    );
    const selection = buildFareSelection(summary, now);

    expect(summary.status).toBe("EXPIRED");
    expect(selection.mode).toBe("RENEW");
    expect(selection.effectiveFrom).toBe(now.toISOString());
    expect(selection.prices.SMALL).toBe("50000");
  });

  it("only schedules a next window when the selected window has an end", () => {
    const closedSummary = getRouteFareSummary(
      "route-1",
      parcelSizeCategories.map((category) => fare(category)),
      now,
    );
    const openSummary = getRouteFareSummary(
      "route-1",
      parcelSizeCategories.map((category) =>
        fare(category, { effectiveUntil: null }),
      ),
      now,
    );

    expect(buildNextFareSelection(closedSummary)?.effectiveFrom).toBe(
      "2026-09-01T00:00:59.000Z",
    );
    expect(buildNextFareSelection(openSummary)).toBeNull();
  });

  it("does not create another next window when one is already scheduled", () => {
    const summary = getRouteFareSummary(
      "route-1",
      [
        ...parcelSizeCategories.map((category) => fare(category)),
        ...parcelSizeCategories.map((category) =>
          fare(category, {
            effectiveFrom: "2026-09-01T00:00:00Z",
            effectiveUntil: null,
          }),
        ),
      ],
      now,
    );

    expect(summary.hasScheduledWindow).toBe(true);
    expect(buildNextFareSelection(summary)).toBeNull();
  });
});
