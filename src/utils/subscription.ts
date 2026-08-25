import type {
  OperatorSubscriptionDetail,
  SubscriptionBillingPeriod,
  SubscriptionPlan,
} from "../api/vietride";

// Hàm thuần dùng chung cho subscription — context OperatorSubscription lẫn màn
// Packages đều đọc qua đây, không nơi nào tự suy trạng thái riêng.

// Subscription có đang cấp quyền không.
//
// BE tính sẵn `entitlementActive` (FE-RESPONSE 2026-08-21 §2) — đó là nguồn duy
// nhất đúng, vì tại đúng `expiresAt` BE đã chuyển trạng thái còn đồng hồ client
// thì lệch. Field optional để response/fixture cũ không gãy: thiếu thì mới rơi
// về cách suy cũ theo status.
export function isSubscriptionEntitled(
  subscription: OperatorSubscriptionDetail,
) {
  if (typeof subscription.entitlementActive === "boolean") {
    return subscription.entitlementActive;
  }

  return (
    subscription.status === "ACTIVE" || subscription.status === "PENDING_PAYMENT"
  );
}

// Giá của gói theo kỳ. Hai giá độc lập nên không suy giá năm từ giá tháng.
export function planPriceFor(
  plan: SubscriptionPlan,
  billingPeriod: SubscriptionBillingPeriod,
) {
  return billingPeriod === "YEARLY" ? plan.pricePerYear : plan.pricePerMonth;
}

// Gói riêng chỉ cần MỘT trong hai giá lớn hơn 0, nên hoàn toàn có gói chỉ bán
// theo tháng. Kỳ nào giá bằng 0 thì không bán kỳ đó — UI phải khoá nút kỳ đó
// thay vì hiện "0 đ" rồi để user đâm vào 422 AMOUNT_NOT_PAYABLE.
export function isBillingPeriodSellable(
  plan: SubscriptionPlan,
  billingPeriod: SubscriptionBillingPeriod,
) {
  return planPriceFor(plan, billingPeriod) > 0;
}

export function sellableBillingPeriods(plan: SubscriptionPlan) {
  return (["MONTHLY", "YEARLY"] as const).filter((period) =>
    isBillingPeriodSellable(plan, period),
  );
}

export function isCustomPlan(plan: SubscriptionPlan) {
  return plan.planType === "CUSTOM";
}

// Một hạn mức của gói thấp hơn mức nhà xe ĐANG dùng — nâng cấp vào sẽ nhận
// 422 SUBSCRIPTION_UPGRADE_TARGET_LIMIT_BELOW_USAGE.
export type PlanUsageShortfall = {
  limitKey: keyof SubscriptionPlan["limits"];
  limit: number;
  used: number;
};

// Cặp hạn-mức ↔ mức-đang-dùng. Không có khái niệm "không giới hạn" (đã xác nhận
// với BE, kể cả Custom Plan): mọi hạn mức là số dương thật nên so sánh thẳng.
// Chỉ các key ĐẾM ĐƯỢC của usage — `lastResetAt` là chuỗi, không so sánh được
type CountableUsageKey = {
  [K in keyof OperatorSubscriptionDetail["usage"]]-?: OperatorSubscriptionDetail["usage"][K] extends
    | number
    | undefined
    ? K
    : never;
}[keyof OperatorSubscriptionDetail["usage"]];

const usageByLimitKey: Record<
  keyof SubscriptionPlan["limits"],
  CountableUsageKey
> = {
  maxVehicles: "currentVehicles",
  maxDrivers: "currentDrivers",
  maxAssistants: "currentAssistants",
  maxOperatorUsers: "currentOperatorUsers",
  maxRoutes: "currentRoutes",
  maxTripsPerMonth: "currentTripsThisMonth",
};

// Mọi hạn mức của gói không đủ chứa mức đang dùng. Rỗng = nâng cấp được.
// Đây chỉ là cổng chặn sớm cho đỡ mất một vòng request — usage có thể đổi giữa
// lúc xem và lúc bấm, nên vẫn phải xử lý 422 từ BE.
export function findPlanUsageShortfalls(
  plan: SubscriptionPlan,
  usage: OperatorSubscriptionDetail["usage"],
): PlanUsageShortfall[] {
  return (
    Object.keys(usageByLimitKey) as Array<keyof SubscriptionPlan["limits"]>
  )
    .map((limitKey) => ({
      limitKey,
      limit: plan.limits[limitKey] ?? 0,
      used: usage[usageByLimitKey[limitKey]] ?? 0,
    }))
    .filter((entry) => entry.limit < entry.used);
}

// Gợi ý hạn mức cho form xin gói riêng: lấy số LỚN HƠN giữa hạn mức gói đang
// dùng và mức đang dùng thực tế. Người ta xin gói riêng vì gói hiện tại chật —
// xuất phát từ con số đó rồi nâng lên hợp lý hơn là để trống bắt tự nghĩ, và
// không bao giờ gợi ý một con số thấp hơn thứ họ đang chạy (admin sẽ bị BE chặn).
export function suggestedCustomPlanQuota(
  plan: SubscriptionPlan,
  usage: OperatorSubscriptionDetail["usage"],
) {
  return (
    Object.keys(usageByLimitKey) as Array<keyof SubscriptionPlan["limits"]>
  ).reduce(
    (quota, limitKey) => ({
      ...quota,
      [limitKey]: Math.max(
        plan.limits[limitKey] ?? 0,
        usage[usageByLimitKey[limitKey]] ?? 0,
      ),
    }),
    {} as Record<keyof SubscriptionPlan["limits"], number>,
  );
}

// Nâng cấp giữa chu kỳ (paid-active) có tạo ra số tiền phải trả không?
//
// Cả giá gói mới lẫn giá trị còn lại của gói cũ đều được nhân CÙNG một tỉ lệ
// thời gian còn lại `f`:
//     amountDue = giá_mới × f − giá_cũ × f = (giá_mới − giá_cũ) × f
// nên "có tiền phải trả" tương đương đúng với "gói mới đắt hơn gói cũ ở cùng
// kỳ" — không cần biết còn bao nhiêu ngày.
//
// Gói không đắt hơn thì BE trả 422 SUBSCRIPTION_UPGRADE_AMOUNT_NOT_PAYABLE
// ("The selected target plan does not produce a payable upgrade amount").
// Chặn ở FE để user khỏi đi một vòng mới biết.
//
// CHỈ áp dụng khi có proration. Bản dùng thử và subscription đã hết hạn mở chu
// kỳ MỚI nên phải trả nguyên giá gói mới, luôn > 0.
export function producesPayableUpgrade(
  currentPlan: SubscriptionPlan,
  targetPlan: SubscriptionPlan,
  billingPeriod: SubscriptionBillingPeriod,
) {
  return (
    planPriceFor(targetPlan, billingPeriod) >
    planPriceFor(currentPlan, billingPeriod)
  );
}

// Ngưỡng coi là "sắp chạm" hạn mức. 80% cho người ta thời gian xoay xở trước
// khi thật sự bị chặn thao tác.
export const usageWarningRatio = 0.8;

export type UsagePressure = {
  limitKey: keyof SubscriptionPlan["limits"];
  limit: number;
  used: number;
  // true = đã dùng hết hoặc vượt; false = mới sắp chạm
  reached: boolean;
};

// Những hạn mức của gói ĐANG DÙNG mà nhà xe sắp chạm hoặc đã chạm.
// Khác `findPlanUsageShortfalls` (soi một gói định mua): hàm này soi gói hiện
// tại để cảnh báo trước khi họ bị chặn giữa chừng — handoff §1 mục 1.
export function findUsagePressure(
  plan: SubscriptionPlan,
  usage: OperatorSubscriptionDetail["usage"],
): UsagePressure[] {
  return (
    Object.keys(usageByLimitKey) as Array<keyof SubscriptionPlan["limits"]>
  )
    .map((limitKey) => {
      const limit = plan.limits[limitKey] ?? 0;
      const used = usage[usageByLimitKey[limitKey]] ?? 0;

      return { limitKey, limit, used, reached: used >= limit };
    })
    // Hạn mức 0 là dữ liệu hỏng chứ không phải "hết chỗ" — bỏ qua để khỏi báo
    // động giả trên mọi dòng
    .filter((entry) => entry.limit > 0)
    .filter((entry) => entry.used >= entry.limit * usageWarningRatio)
    // Đã chạm xếp trước sắp chạm, trong mỗi nhóm thì cái căng hơn lên trên
    .sort(
      (first, second) =>
        Number(second.reached) - Number(first.reached) ||
        second.used / second.limit - first.used / first.limit,
    );
}
