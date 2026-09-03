// Test hook nâng cấp hai bước và các hành vi lỗi của báo giá/thanh toán.
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/vietride", () => ({
  createSubscriptionUpgradeQuote: vi.fn(),
  confirmSubscriptionUpgradePayment: vi.fn(),
}));

import { ApiRequestError } from "../../../api/client";
import {
  confirmSubscriptionUpgradePayment,
  createSubscriptionUpgradeQuote,
  type SubscriptionPlan,
  type SubscriptionUpgradeQuote,
} from "../../../api/vietride";
import { useSubscriptionUpgrade } from "./useSubscriptionUpgrade";

const plan: SubscriptionPlan = {
  planId: "plan-pro",
  name: "Professional",
  pricePerMonth: 300_000,
  pricePerYear: 3_000_000,
  limits: {
    maxVehicles: 20,
    maxDrivers: 30,
    maxAssistants: 20,
    maxOperatorUsers: 10,
    maxRoutes: 10,
    maxTripsPerMonth: 500,
  },
  modules: { enableParcel: true, enableShuttle: true, enableRag: true },
  isActive: true,
};

const quote: SubscriptionUpgradeQuote = {
  upgradeAttemptId: "attempt-1",
  sourcePlanId: "plan-starter",
  targetPlanId: plan.planId,
  billingPeriod: "MONTHLY",
  paymentMethod: "VNPAY",
  prorationApplied: true,
  currentCyclePrice: 300_000,
  targetCyclePrice: 500_000,
  unusedCredit: 150_000,
  proratedTargetAmount: 250_000,
  amountDue: 100_000,
  periodFrom: "2026-08-21T10:00:00Z",
  periodTo: "2026-09-05T10:00:00Z",
  quotedAt: "2026-08-21T10:00:00Z",
  dueAt: "2099-01-01T00:00:00Z",
  currency: "VND",
  status: "INITIATED",
};

function renderUpgrade(lockedBillingPeriod: "MONTHLY" | "YEARLY" | null = null) {
  const onSubscriptionChanged = vi.fn().mockResolvedValue(undefined);
  const view = renderHook(() =>
    useSubscriptionUpgrade({
      lockedBillingPeriod,
      onSubscriptionChanged,
      t: (key: string) => key,
    }),
  );

  return { ...view, onSubscriptionChanged };
}

async function openAndQuote(result: {
  current: ReturnType<typeof useSubscriptionUpgrade>;
}) {
  act(() => result.current.open(plan, "MONTHLY"));
  await act(async () => {
    await result.current.requestQuote();
  });
}

describe("useSubscriptionUpgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(createSubscriptionUpgradeQuote).mockResolvedValue(quote);
  });

  it("locks the billing period to the current cycle when one is given", () => {
    const { result } = renderUpgrade("YEARLY");

    // Mở với kỳ mặc định MONTHLY nhưng đang nâng cấp giữa chu kỳ YEARLY →
    // phải khoá về YEARLY, chặn trước 422 BILLING_PERIOD_MISMATCH
    act(() => result.current.open(plan, "MONTHLY"));

    expect(result.current.billingPeriod).toBe("YEARLY");
    expect(result.current.isBillingPeriodLocked).toBe(true);
  });

  it("reuses one idempotency key while the selection stays the same", async () => {
    const { result } = renderUpgrade();
    await openAndQuote(result);
    await act(async () => {
      await result.current.requestQuote();
    });

    const [, firstKey] = vi.mocked(createSubscriptionUpgradeQuote).mock
      .calls[0];
    const [, secondKey] = vi.mocked(createSubscriptionUpgradeQuote).mock
      .calls[1];
    expect(createSubscriptionUpgradeQuote).toHaveBeenCalledWith(
      {
        planId: "plan-pro",
        billingPeriod: "MONTHLY",
        paymentMethod: "VNPAY",
      },
      expect.any(String),
    );
    // Bấm "Xem báo giá" hai lần cho cùng một lựa chọn không được đẻ hai attempt
    expect(secondKey).toBe(firstKey);
  });

  it("keeps a quote when the modal closes and can reopen it", async () => {
    const { result } = renderUpgrade();
    await openAndQuote(result);

    act(() => result.current.close());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.quote?.upgradeAttemptId).toBe("attempt-1");
    expect(sessionStorage.getItem("vietride.subscription-upgrade-quote")).toContain(
      "attempt-1",
    );

    act(() => result.current.reopenQuote());

    expect(result.current.isOpen).toBe(true);
    expect(result.current.step).toBe("quote");
  });

  it("restores a saved quote after the Packages page mounts again", async () => {
    const firstView = renderUpgrade();
    await openAndQuote(firstView.result);
    firstView.unmount();

    const secondView = renderUpgrade();
    act(() => secondView.result.current.restoreSavedQuotePlan([plan]));
    act(() => secondView.result.current.reopenQuote());

    expect(secondView.result.current.isOpen).toBe(true);
    expect(secondView.result.current.selectedPlan?.planId).toBe(plan.planId);
    expect(secondView.result.current.quote?.upgradeAttemptId).toBe("attempt-1");
  });

  it("drops an expired saved quote when the Packages page mounts", () => {
    sessionStorage.setItem(
      "vietride.subscription-upgrade-quote",
      JSON.stringify({
        quote: { ...quote, dueAt: "2020-01-01T00:00:00Z" },
        targetPlanName: plan.name,
      }),
    );

    const { result } = renderUpgrade();

    expect(result.current.quote).toBeNull();
    expect(
      sessionStorage.getItem("vietride.subscription-upgrade-quote"),
    ).toBeNull();
  });

  it("keeps an active-upgrade conflict visible inside the modal", async () => {
    const { result } = renderUpgrade();
    vi.mocked(createSubscriptionUpgradeQuote).mockRejectedValue(
      new ApiRequestError(
        "active",
        409,
        "SUBSCRIPTION_UPGRADE_ALREADY_ACTIVE",
      ),
    );

    act(() => result.current.open(plan, "MONTHLY"));
    await act(async () => {
      await result.current.requestQuote();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.error).toBe(
      "packages.upgradeError.SUBSCRIPTION_UPGRADE_ALREADY_ACTIVE",
    );
  });

  it("mints a new idempotency key for every payment attempt", async () => {
    const { result } = renderUpgrade();
    vi.mocked(confirmSubscriptionUpgradePayment).mockRejectedValue(
      new ApiRequestError("payment failed", 502, "PAYMENT_VNPAY_ERROR"),
    );
    await openAndQuote(result);

    await act(async () => {
      await result.current.confirmPayment();
    });
    await act(async () => {
      await result.current.confirmPayment();
    });

    const [, firstKey] = vi.mocked(confirmSubscriptionUpgradePayment).mock
      .calls[0];
    const [, secondKey] = vi.mocked(confirmSubscriptionUpgradePayment).mock
      .calls[1];
    expect(secondKey).not.toBe(firstKey);
  });

  it("drops the quote and refreshes when the backend says it is stale", async () => {
    const { result, onSubscriptionChanged } = renderUpgrade();
    vi.mocked(confirmSubscriptionUpgradePayment).mockRejectedValue(
      new ApiRequestError(
        "stale",
        409,
        "SUBSCRIPTION_UPGRADE_QUOTE_STALE",
      ),
    );

    await openAndQuote(result);
    await act(async () => {
      await result.current.confirmPayment();
    });

    expect(result.current.quote).toBeNull();
    expect(result.current.step).toBe("select");
    expect(onSubscriptionChanged).toHaveBeenCalled();
    expect(result.current.error).toBe(
      "packages.upgradeError.SUBSCRIPTION_UPGRADE_QUOTE_STALE",
    );
  });

  it("closes and refreshes when the target plan went off sale", async () => {
    const { result, onSubscriptionChanged } = renderUpgrade();
    vi.mocked(confirmSubscriptionUpgradePayment).mockRejectedValue(
      new ApiRequestError(
        "inactive",
        409,
        "SUBSCRIPTION_UPGRADE_TARGET_PLAN_INACTIVE",
      ),
    );

    await openAndQuote(result);
    await act(async () => {
      await result.current.confirmPayment();
    });

    expect(result.current.isOpen).toBe(false);
    expect(onSubscriptionChanged).toHaveBeenCalled();
  });

  it("keeps the modal open when VNPay does not return a redirect URL", async () => {
    const { result, onSubscriptionChanged } = renderUpgrade();
    vi.mocked(confirmSubscriptionUpgradePayment).mockResolvedValue({
      upgradeAttemptId: "attempt-1",
      status: "PENDING_PAYMENT",
      paymentRedirectUrl: null,
    });

    await openAndQuote(result);
    await act(async () => {
      await result.current.confirmPayment();
    });

    expect(onSubscriptionChanged).not.toHaveBeenCalled();
    expect(result.current.isOpen).toBe(true);
    expect(result.current.error).toBe("packages.missingPaymentRedirect");
  });
});
