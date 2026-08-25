// Test hook nâng cấp hai bước: quote là tham số hoá theo kỳ + phương thức nên
// đổi lựa chọn phải huỷ báo giá; và mỗi mã lỗi phải dẫn tới một hành vi cụ thể.
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/vietride", () => ({
  createSubscriptionUpgradeQuote: vi.fn(),
  confirmSubscriptionUpgradePayment: vi.fn(),
  getOperatorWallet: vi.fn(),
}));

import { ApiRequestError } from "../../../api/client";
import {
  confirmSubscriptionUpgradePayment,
  createSubscriptionUpgradeQuote,
  getOperatorWallet,
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
  paymentMethod: "WALLET",
  prorationApplied: true,
  currentCyclePrice: 300_000,
  targetCyclePrice: 500_000,
  unusedCredit: 150_000,
  proratedTargetAmount: 250_000,
  amountDue: 100_000,
  periodFrom: "2026-08-21T10:00:00Z",
  periodTo: "2026-09-05T10:00:00Z",
  quotedAt: "2026-08-21T10:00:00Z",
  dueAt: "2026-08-21T10:15:00Z",
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
    vi.mocked(getOperatorWallet).mockResolvedValue({
      operatorId: "operator-1",
      balance: 5_000_000,
      pendingHoldAmount: 0,
      eligibleAmount: 0,
      updatedAt: "2026-08-21T10:00:00Z",
    });
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

  it("discards the quote when the payment method changes", async () => {
    const { result } = renderUpgrade();
    await openAndQuote(result);

    expect(result.current.step).toBe("quote");

    // paymentMethod nằm TRONG quote — đổi nó là báo giá cũ hết nghĩa
    act(() => result.current.setPaymentMethod("VNPAY"));

    expect(result.current.quote).toBeNull();
    expect(result.current.step).toBe("select");
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
    // Bấm "Xem báo giá" hai lần cho cùng một lựa chọn không được đẻ hai attempt
    expect(secondKey).toBe(firstKey);
  });

  it("mints a new idempotency key for every payment attempt", async () => {
    const { result } = renderUpgrade();
    vi.mocked(confirmSubscriptionUpgradePayment).mockRejectedValue(
      new ApiRequestError("insufficient", 402, "WALLET_INSUFFICIENT_BALANCE"),
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
    // Dùng lại key đã nhận 402 sẽ được replay đúng response cũ trong 24 giờ
    expect(secondKey).not.toBe(firstKey);
  });

  it("keeps the quote and reports the shortfall on 402", async () => {
    const { result } = renderUpgrade();
    vi.mocked(getOperatorWallet).mockResolvedValue({
      operatorId: "operator-1",
      balance: 40_000,
      pendingHoldAmount: 0,
      eligibleAmount: 0,
      updatedAt: "2026-08-21T10:00:00Z",
    });
    vi.mocked(confirmSubscriptionUpgradePayment).mockRejectedValue(
      new ApiRequestError("insufficient", 402, "WALLET_INSUFFICIENT_BALANCE"),
    );

    await openAndQuote(result);
    await act(async () => {
      await result.current.confirmPayment();
    });

    expect(result.current.walletShortfall).toBe(60_000);
    // Chưa trừ tiền, báo giá còn hiệu lực → giữ nguyên attempt và bước
    expect(result.current.quote?.upgradeAttemptId).toBe("attempt-1");
    expect(result.current.step).toBe("quote");
    expect(result.current.error).toBe("");
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
    // Đây là LỖI nên phải đi kênh error (hiện đỏ trong modal), không phải
    // notice — notice nổi lên thành toast dấu tích xanh, sai hoàn toàn ngữ nghĩa
    expect(result.current.error).toBe(
      "packages.upgradeError.SUBSCRIPTION_UPGRADE_QUOTE_STALE",
    );
    expect(result.current.notice).toBe("");
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

  it("refreshes and closes after the wallet debit succeeds", async () => {
    const { result, onSubscriptionChanged } = renderUpgrade();
    // Không có paymentRedirectUrl = ví đã trừ xong (200), không phải VNPAY
    vi.mocked(confirmSubscriptionUpgradePayment).mockResolvedValue({
      upgradeAttemptId: "attempt-1",
      status: "ACTIVE",
      paymentRedirectUrl: null,
    });

    await openAndQuote(result);
    await act(async () => {
      await result.current.confirmPayment();
    });

    await waitFor(() => expect(onSubscriptionChanged).toHaveBeenCalled());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.notice).toBe("packages.walletPaymentSuccess");
  });
});
