import { describe, expect, it } from "vitest";
import {
  buildCancellationWindows,
  createCancellationPolicyDraft,
  draftsFromCancellationPolicy,
  parseCancellationPolicyDrafts,
} from "./operatorCancellationPolicy";

describe("operatorCancellationPolicy", () => {
  it("turns a missing policy into an empty draft list", () => {
    expect(draftsFromCancellationPolicy(null)).toEqual([]);
    expect(draftsFromCancellationPolicy(undefined)).toEqual([]);
  });

  it("sends null when the operator has no refund tiers", () => {
    expect(parseCancellationPolicyDrafts([])).toEqual({ ok: true, value: null });
  });

  it("sorts valid tiers the same way Identity does", () => {
    expect(
      parseCancellationPolicyDrafts([
        { id: "late", hoursBeforeDeparture: "24", feePercent: "10" },
        { id: "soon", hoursBeforeDeparture: "2", feePercent: "50" },
      ]),
    ).toEqual({
      ok: true,
      value: [
        { hoursBeforeDeparture: 2, feePercent: 50 },
        { hoursBeforeDeparture: 24, feePercent: 10 },
      ],
    });
  });

  it("explains stored tiers as exclusive remaining-time windows", () => {
    expect(buildCancellationWindows([
      { hoursBeforeDeparture: 24, feePercent: 10 },
      { hoursBeforeDeparture: 2, feePercent: 50 },
      { hoursBeforeDeparture: 1, feePercent: 100 },
    ])).toEqual([
      { fromExclusive: null, toInclusive: 1, feePercent: 100, isDefaultFullRefund: false },
      { fromExclusive: 1, toInclusive: 2, feePercent: 50, isDefaultFullRefund: false },
      { fromExclusive: 2, toInclusive: 24, feePercent: 10, isDefaultFullRefund: false },
      { fromExclusive: 24, toInclusive: null, feePercent: 0, isDefaultFullRefund: true },
    ]);
  });

  it("rejects blank, non-integer, out-of-range, and duplicate hour values", () => {
    expect(
      parseCancellationPolicyDrafts([createCancellationPolicyDraft()]),
    ).toEqual({ ok: false, error: "empty-field" });
    expect(
      parseCancellationPolicyDrafts([
        { id: "a", hoursBeforeDeparture: "1.5", feePercent: "10" },
      ]),
    ).toEqual({ ok: false, error: "invalid-number" });
    expect(
      parseCancellationPolicyDrafts([
        { id: "a", hoursBeforeDeparture: "2", feePercent: "150" },
      ]),
    ).toEqual({ ok: false, error: "out-of-range" });
    expect(
      parseCancellationPolicyDrafts([
        { id: "a", hoursBeforeDeparture: "2", feePercent: "10" },
        { id: "b", hoursBeforeDeparture: "2", feePercent: "20" },
      ]),
    ).toEqual({ ok: false, error: "duplicate-hours" });
  });
});
