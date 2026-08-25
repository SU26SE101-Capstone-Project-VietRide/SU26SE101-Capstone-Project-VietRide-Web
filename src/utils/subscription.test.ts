import { describe, expect, it } from "vitest";
import type {
  OperatorSubscriptionDetail,
  SubscriptionPlan,
} from "../api/vietride";
import {
  findPlanUsageShortfalls,
  isBillingPeriodSellable,
  isCustomPlan,
  isSubscriptionEntitled,
  planPriceFor,
  producesPayableUpgrade,
  findUsagePressure,
  sellableBillingPeriods,
  suggestedCustomPlanQuota,
} from "./subscription";

function plan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return {
    planId: "plan-1",
    name: "Nâng cao",
    pricePerMonth: 500000,
    pricePerYear: 5000000,
    limits: {
      maxVehicles: 50,
      maxDrivers: 60,
      maxAssistants: 20,
      maxOperatorUsers: 10,
      maxRoutes: 40,
      maxTripsPerMonth: 5000,
    },
    modules: { enableParcel: true, enableShuttle: true, enableRag: true },
    isActive: true,
    ...overrides,
  };
}

const usage: OperatorSubscriptionDetail["usage"] = {
  currentVehicles: 12,
  currentDrivers: 18,
  currentAssistants: 4,
  currentOperatorUsers: 3,
  currentRoutes: 7,
  currentTripsThisMonth: 240,
};

function subscription(
  overrides: Partial<OperatorSubscriptionDetail> = {},
): OperatorSubscriptionDetail {
  return {
    subscriptionId: "sub-1",
    status: "ACTIVE",
    billingPeriod: "MONTHLY",
    startedAt: "2026-08-06T00:00:00Z",
    expiresAt: "2026-09-05T00:00:00Z",
    plan: plan(),
    usage,
    ...overrides,
  };
}

describe("isSubscriptionEntitled", () => {
  it("trusts entitlementActive from the backend over the status", () => {
    // BE chuyển trạng thái tại đúng expiresAt; status có thể còn đọc là ACTIVE
    // trong response cũ mà quyền lợi đã tắt — field của BE thắng.
    expect(
      isSubscriptionEntitled(
        subscription({ status: "ACTIVE", entitlementActive: false }),
      ),
    ).toBe(false);
    expect(
      isSubscriptionEntitled(
        subscription({ status: "EXPIRED", entitlementActive: true }),
      ),
    ).toBe(true);
  });

  it("falls back to the status when the backend omits the field", () => {
    expect(isSubscriptionEntitled(subscription({ status: "ACTIVE" }))).toBe(
      true,
    );
    expect(
      isSubscriptionEntitled(subscription({ status: "PENDING_PAYMENT" })),
    ).toBe(true);
    expect(isSubscriptionEntitled(subscription({ status: "EXPIRED" }))).toBe(
      false,
    );
  });
});

describe("giá theo kỳ", () => {
  it("reads each period price on its own", () => {
    const custom = plan({ pricePerMonth: 1800000, pricePerYear: 0 });
    expect(planPriceFor(custom, "MONTHLY")).toBe(1800000);
    // Không suy giá năm từ giá tháng nhân hệ số
    expect(planPriceFor(custom, "YEARLY")).toBe(0);
  });

  it("treats a zero price as a period that is not for sale", () => {
    // Gói riêng chỉ cần một giá > 0 — kỳ còn lại phải bị khoá, không hiện "0 đ"
    const monthlyOnly = plan({ pricePerMonth: 1800000, pricePerYear: 0 });
    expect(isBillingPeriodSellable(monthlyOnly, "MONTHLY")).toBe(true);
    expect(isBillingPeriodSellable(monthlyOnly, "YEARLY")).toBe(false);
    expect(sellableBillingPeriods(monthlyOnly)).toEqual(["MONTHLY"]);
    expect(sellableBillingPeriods(plan())).toEqual(["MONTHLY", "YEARLY"]);
  });
});

describe("isCustomPlan", () => {
  it("treats a plan without planType as standard", () => {
    expect(isCustomPlan(plan())).toBe(false);
    expect(isCustomPlan(plan({ planType: "STANDARD" }))).toBe(false);
    expect(isCustomPlan(plan({ planType: "CUSTOM" }))).toBe(true);
  });
});

describe("findPlanUsageShortfalls", () => {
  it("returns nothing when every limit covers current usage", () => {
    expect(findPlanUsageShortfalls(plan(), usage)).toEqual([]);
  });

  it("reports each limit that sits below current usage", () => {
    const tooSmall = plan({
      limits: {
        maxVehicles: 50,
        maxDrivers: 60,
        maxAssistants: 20,
        maxOperatorUsers: 10,
        maxRoutes: 5,
        maxTripsPerMonth: 100,
      },
    });

    expect(findPlanUsageShortfalls(tooSmall, usage)).toEqual([
      { limitKey: "maxRoutes", limit: 5, used: 7 },
      { limitKey: "maxTripsPerMonth", limit: 100, used: 240 },
    ]);
  });

  it("allows a limit that exactly matches current usage", () => {
    const exact = plan({
      limits: { ...plan().limits, maxRoutes: 7 },
    });

    expect(findPlanUsageShortfalls(exact, usage)).toEqual([]);
  });
});

describe("suggestedCustomPlanQuota", () => {
  it("starts from the larger of the current limit and current usage", () => {
    // Gói cho 40 tuyến, đang chạy 7 → gợi ý 40, đừng tụt xuống mức đang dùng.
    // Ngược lại, gói chỉ cho 2 tài khoản nhân sự mà đang dùng 3 (dữ liệu cũ
    // vượt hạn mức) → gợi ý 3: xin thấp hơn thì admin không duyệt được.
    const tight = plan({
      limits: { ...plan().limits, maxOperatorUsers: 2 },
    });

    expect(suggestedCustomPlanQuota(tight, usage)).toEqual({
      maxVehicles: 50,
      maxDrivers: 60,
      maxAssistants: 20,
      maxOperatorUsers: 3,
      maxRoutes: 40,
      maxTripsPerMonth: 5000,
    });
  });
});

describe("producesPayableUpgrade", () => {
  const current = plan({ pricePerMonth: 500_000, pricePerYear: 5_000_000 });

  it("is payable only when the target costs more for the same period", () => {
    // amountDue = (giá mới − giá cũ) × tỉ lệ thời gian còn lại, nên chỉ cần so
    // giá ở cùng kỳ là biết BE có tạo được báo giá hay không
    const bigger = plan({ pricePerMonth: 900_000, pricePerYear: 9_000_000 });
    expect(producesPayableUpgrade(current, bigger, "MONTHLY")).toBe(true);
    expect(producesPayableUpgrade(current, bigger, "YEARLY")).toBe(true);
  });

  it("rejects a cheaper target — proration would owe nothing", () => {
    const cheaper = plan({ pricePerMonth: 200_000, pricePerYear: 2_000_000 });
    expect(producesPayableUpgrade(current, cheaper, "MONTHLY")).toBe(false);
  });

  it("rejects an equally priced target", () => {
    // Bằng giá thì amountDue = 0 → BE trả AMOUNT_NOT_PAYABLE
    expect(producesPayableUpgrade(current, plan(), "YEARLY")).toBe(false);
  });

  it("judges each period on its own price", () => {
    // Đắt hơn theo tháng nhưng rẻ hơn theo năm — mỗi kỳ một kết quả
    const mixed = plan({ pricePerMonth: 600_000, pricePerYear: 4_000_000 });
    expect(producesPayableUpgrade(current, mixed, "MONTHLY")).toBe(true);
    expect(producesPayableUpgrade(current, mixed, "YEARLY")).toBe(false);
  });
});

describe("findUsagePressure", () => {
  it("stays quiet while everything is comfortably under the limit", () => {
    // usage cao nhất là 240/5000 chuyến — chưa tới 80% ở đâu cả
    expect(findUsagePressure(plan(), usage)).toEqual([]);
  });

  it("warns at 80% before the operator is actually blocked", () => {
    const tight = plan({ limits: { ...plan().limits, maxRoutes: 8 } });

    // 7/8 = 87,5% → cảnh báo nhưng CHƯA chặn
    expect(findUsagePressure(tight, usage)).toEqual([
      { limitKey: "maxRoutes", limit: 8, used: 7, reached: false },
    ]);
  });

  it("marks a limit as reached once usage catches up to it", () => {
    const full = plan({ limits: { ...plan().limits, maxRoutes: 7 } });

    expect(findUsagePressure(full, usage)[0].reached).toBe(true);
  });

  it("puts the blocking limits first, then the tightest", () => {
    const tight = plan({
      limits: {
        ...plan().limits,
        maxRoutes: 8,
        maxVehicles: 12,
        maxDrivers: 20,
      },
    });

    // maxVehicles 12/12 đã chặn → lên đầu. Còn lại xếp theo mức căng:
    // tài xế 18/20 = 90% trước tuyến 7/8 = 87,5%.
    expect(
      findUsagePressure(tight, usage).map((entry) => entry.limitKey),
    ).toEqual(["maxVehicles", "maxDrivers", "maxRoutes"]);
  });

  it("ignores a zero limit instead of reporting it as full", () => {
    // Hạn mức 0 là dữ liệu hỏng, không phải "hết chỗ" — báo động giả trên mọi
    // dòng thì banner mất hết giá trị
    const broken = plan({ limits: { ...plan().limits, maxAssistants: 0 } });

    expect(
      findUsagePressure(broken, usage).some(
        (entry) => entry.limitKey === "maxAssistants",
      ),
    ).toBe(false);
  });
});
