import { isRecord } from "../../../utils/typeGuards";
import type { SubscriptionUpgradeQuote } from "../../../api/vietride";

const STORAGE_KEY = "vietride.subscription-payment-intent";
const QUOTE_STORAGE_KEY = "vietride.subscription-upgrade-quote";

export type SubscriptionPaymentIntent = {
  paymentId: string;
  upgradeAttemptId: string;
  targetPlanId: string;
  targetPlanName: string;
};

export function saveSubscriptionPaymentIntent(
  intent: SubscriptionPaymentIntent,
) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
}

export function getSubscriptionPaymentIntent(): SubscriptionPaymentIntent | null {
  const value = sessionStorage.getItem(STORAGE_KEY);
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !isRecord(parsed) ||
      typeof parsed.paymentId !== "string" ||
      typeof parsed.upgradeAttemptId !== "string" ||
      typeof parsed.targetPlanId !== "string" ||
      typeof parsed.targetPlanName !== "string"
    ) {
      return null;
    }

    return {
      paymentId: parsed.paymentId,
      upgradeAttemptId: parsed.upgradeAttemptId,
      targetPlanId: parsed.targetPlanId,
      targetPlanName: parsed.targetPlanName,
    };
  } catch {
    return null;
  }
}

export function clearSubscriptionPaymentIntent() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export type SubscriptionUpgradeQuoteIntent = {
  quote: SubscriptionUpgradeQuote;
  targetPlanName: string;
};

function isSubscriptionUpgradeQuote(
  value: unknown,
): value is SubscriptionUpgradeQuote {
  if (!isRecord(value)) return false;

  return (
    typeof value.upgradeAttemptId === "string" &&
    typeof value.sourcePlanId === "string" &&
    typeof value.targetPlanId === "string" &&
    (value.billingPeriod === "MONTHLY" || value.billingPeriod === "YEARLY") &&
    value.paymentMethod === "VNPAY" &&
    typeof value.prorationApplied === "boolean" &&
    typeof value.currentCyclePrice === "number" &&
    typeof value.targetCyclePrice === "number" &&
    typeof value.unusedCredit === "number" &&
    typeof value.proratedTargetAmount === "number" &&
    typeof value.amountDue === "number" &&
    typeof value.periodFrom === "string" &&
    typeof value.periodTo === "string" &&
    typeof value.quotedAt === "string" &&
    typeof value.dueAt === "string" &&
    typeof value.currency === "string" &&
    typeof value.status === "string"
  );
}

export function saveSubscriptionUpgradeQuoteIntent(
  intent: SubscriptionUpgradeQuoteIntent,
) {
  sessionStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(intent));
}

export function getSubscriptionUpgradeQuoteIntent(): SubscriptionUpgradeQuoteIntent | null {
  const value = sessionStorage.getItem(QUOTE_STORAGE_KEY);
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !isRecord(parsed) ||
      !isSubscriptionUpgradeQuote(parsed.quote) ||
      typeof parsed.targetPlanName !== "string"
    ) {
      clearSubscriptionUpgradeQuoteIntent();
      return null;
    }

    const dueAtMs = Date.parse(parsed.quote.dueAt);
    if (!Number.isFinite(dueAtMs) || dueAtMs <= Date.now()) {
      clearSubscriptionUpgradeQuoteIntent();
      return null;
    }

    return {
      quote: parsed.quote,
      targetPlanName: parsed.targetPlanName,
    };
  } catch {
    clearSubscriptionUpgradeQuoteIntent();
    return null;
  }
}

export function clearSubscriptionUpgradeQuoteIntent() {
  sessionStorage.removeItem(QUOTE_STORAGE_KEY);
}
