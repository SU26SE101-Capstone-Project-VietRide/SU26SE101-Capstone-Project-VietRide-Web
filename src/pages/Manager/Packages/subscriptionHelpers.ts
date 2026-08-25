import { formatCurrency } from "../../../utils/currency";
import type {
  OperatorSubscriptionDetail,
  SubscriptionBillingPeriod,
  SubscriptionPendingUpgrade,
  SubscriptionPlan,
} from "../../../api/vietride";

// Helper thuần cho màn Packages — không phụ thuộc React.

export function formatNumber(n: number) {
  return n.toLocaleString("vi-VN");
}

export function formatPrice(
  plan: SubscriptionPlan,
  billingPeriod: SubscriptionBillingPeriod,
) {
  const amount =
    billingPeriod === "YEARLY" ? plan.pricePerYear : plan.pricePerMonth;
  return formatCurrency(amount);
}

export function planLimit(
  plan: SubscriptionPlan,
  key: keyof SubscriptionPlan["limits"],
) {
  return plan.limits[key] ?? 0;
}

export function isPayablePlan(plan: SubscriptionPlan) {
  return plan.pricePerMonth > 0 || plan.pricePerYear > 0;
}

// Số giây còn lại tới một mốc ISO. Dùng chung cho hạn thanh toán của
// pendingUpgrade lẫn hạn `dueAt` của báo giá nâng cấp.
export function getRemainingSecondsUntil(
  dueAt: string | null | undefined,
  nowMs: number,
) {
  const dueAtMs = dueAt ? Date.parse(dueAt) : Number.NaN;
  if (!Number.isFinite(dueAtMs)) return 0;

  return Math.max(0, Math.ceil((dueAtMs - nowMs) / 1000));
}

export function getRemainingPaymentSeconds(
  pendingUpgrade: SubscriptionPendingUpgrade | null,
  nowMs: number,
) {
  if (!pendingUpgrade) return 0;

  if (pendingUpgrade.dueAt && Number.isFinite(Date.parse(pendingUpgrade.dueAt))) {
    return getRemainingSecondsUntil(pendingUpgrade.dueAt, nowMs);
  }

  return Math.max(0, Math.floor(pendingUpgrade.remainingSeconds));
}

export function formatRemainingPaymentTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function normalizePendingPaymentDeadline(
  subscription: OperatorSubscriptionDetail,
) {
  const pendingUpgrade = subscription.pendingUpgrade;
  if (
    !pendingUpgrade ||
    pendingUpgrade.dueAt ||
    pendingUpgrade.remainingSeconds <= 0
  ) {
    return subscription;
  }

  return {
    ...subscription,
    pendingUpgrade: {
      ...pendingUpgrade,
      dueAt: new Date(
        Date.now() + pendingUpgrade.remainingSeconds * 1_000,
      ).toISOString(),
    },
  };
}

export function hasUnexpectedSubscriptionPeriod(
  subscription: OperatorSubscriptionDetail,
) {
  if (!isPayablePlan(subscription.plan)) return false;
  if (
    !subscription.billingPeriod ||
    !subscription.startedAt ||
    !subscription.expiresAt
  ) {
    return true;
  }

  const startedAt = Date.parse(subscription.startedAt);
  const expiresAt = Date.parse(subscription.expiresAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(expiresAt)) return true;

  const durationInDays = (expiresAt - startedAt) / (24 * 60 * 60 * 1000);
  return subscription.billingPeriod === "YEARLY"
    ? durationInDays < 360 || durationInDays > 370
    : durationInDays < 27 || durationInDays > 32;
}
