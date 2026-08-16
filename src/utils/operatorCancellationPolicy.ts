import type { CancellationPolicyRule } from "../api/vietride";

export type CancellationPolicyDraft = {
  id: string;
  hoursBeforeDeparture: string;
  feePercent: string;
};

export type CancellationPolicyParseError =
  | "empty-field"
  | "invalid-number"
  | "out-of-range"
  | "duplicate-hours";

export type CancellationPolicyParseResult =
  | { ok: true; value: CancellationPolicyRule[] | null }
  | { ok: false; error: CancellationPolicyParseError };

export function draftsFromCancellationPolicy(
  policy: CancellationPolicyRule[] | null | undefined,
): CancellationPolicyDraft[] {
  return (policy ?? []).map((rule, index) => ({
    id: `existing-${index}-${rule.hoursBeforeDeparture}-${rule.feePercent}`,
    hoursBeforeDeparture: String(rule.hoursBeforeDeparture),
    feePercent: String(rule.feePercent),
  }));
}

export function createCancellationPolicyDraft(): CancellationPolicyDraft {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    hoursBeforeDeparture: "",
    feePercent: "",
  };
}

/** Common operator ladder from the Identity contract example. */
export const COMMON_CANCELLATION_TEMPLATE: CancellationPolicyRule[] = [
  { hoursBeforeDeparture: 1, feePercent: 100 },
  { hoursBeforeDeparture: 2, feePercent: 50 },
  { hoursBeforeDeparture: 24, feePercent: 10 },
];

export function draftsFromCancellationTemplate(): CancellationPolicyDraft[] {
  return COMMON_CANCELLATION_TEMPLATE.map((rule, index) => ({
    id: `template-${index}-${rule.hoursBeforeDeparture}-${rule.feePercent}`,
    hoursBeforeDeparture: String(rule.hoursBeforeDeparture),
    feePercent: String(rule.feePercent),
  }));
}

export type CancellationWindow = {
  fromExclusive: number | null;
  toInclusive: number | null;
  feePercent: number;
  isDefaultFullRefund: boolean;
};

/** Turns stored tiers into exclusive time windows operators can read. */
export function buildCancellationWindows(
  rules: CancellationPolicyRule[] | null | undefined,
): CancellationWindow[] {
  const sorted = [...(rules ?? [])].sort(
    (left, right) => left.hoursBeforeDeparture - right.hoursBeforeDeparture,
  );

  if (sorted.length === 0) {
    return [{
      fromExclusive: null,
      toInclusive: null,
      feePercent: 0,
      isDefaultFullRefund: true,
    }];
  }

  const windows: CancellationWindow[] = sorted.map((rule, index) => ({
    fromExclusive: index === 0 ? null : sorted[index - 1].hoursBeforeDeparture,
    toInclusive: rule.hoursBeforeDeparture,
    feePercent: rule.feePercent,
    isDefaultFullRefund: false,
  }));

  const lastHours = sorted[sorted.length - 1].hoursBeforeDeparture;
  windows.push({
    fromExclusive: lastHours,
    toInclusive: null,
    feePercent: 0,
    isDefaultFullRefund: true,
  });

  return windows;
}

export function previewFeePercent(draft: CancellationPolicyDraft): number | null {
  const feePercent = parseNonNegativeInt(draft.feePercent);
  if (feePercent === null || feePercent > 100) {
    return null;
  }
  return feePercent;
}

function parseNonNegativeInt(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** Matches Identity `NormalizeCancellationPolicy`: ints, hours ≥ 0, fee 0–100. */
export function parseCancellationPolicyDrafts(
  drafts: CancellationPolicyDraft[],
): CancellationPolicyParseResult {
  if (drafts.length === 0) {
    return { ok: true, value: null };
  }

  const rules: CancellationPolicyRule[] = [];
  const seenHours = new Set<number>();

  for (const draft of drafts) {
    const hoursText = draft.hoursBeforeDeparture.trim();
    const feeText = draft.feePercent.trim();
    if (!hoursText || !feeText) {
      return { ok: false, error: "empty-field" };
    }

    const hoursBeforeDeparture = parseNonNegativeInt(hoursText);
    const feePercent = parseNonNegativeInt(feeText);
    if (hoursBeforeDeparture === null || feePercent === null) {
      return { ok: false, error: "invalid-number" };
    }

    if (feePercent > 100) {
      return { ok: false, error: "out-of-range" };
    }

    if (seenHours.has(hoursBeforeDeparture)) {
      return { ok: false, error: "duplicate-hours" };
    }

    seenHours.add(hoursBeforeDeparture);
    rules.push({ hoursBeforeDeparture, feePercent });
  }

  rules.sort((left, right) => left.hoursBeforeDeparture - right.hoursBeforeDeparture);
  return { ok: true, value: rules };
}
