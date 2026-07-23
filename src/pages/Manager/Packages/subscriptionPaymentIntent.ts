const STORAGE_KEY = "vietride.subscription-payment-intent";

export type SubscriptionPaymentIntent = {
  paymentId: string;
  upgradeAttemptId: string;
  targetPlanId: string;
  targetPlanName: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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
