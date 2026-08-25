import { useTranslation } from "react-i18next";
import { FiBox, FiShoppingCart, FiTrendingUp } from "react-icons/fi";
import type {
  SubscriptionBillingPeriod,
  SubscriptionPlan,
} from "../../../api/vietride";
import { formatNumber, formatPrice, planLimit } from "./subscriptionHelpers";
import { LimitRow } from "./packageDetails";
import { Badge } from "../../../components/ui/Badge";
import {
  isBillingPeriodSellable,
  isCustomPlan,
  sellableBillingPeriods,
  type PlanUsageShortfall,
} from "../../../utils/subscription";

type PlanCardProps = {
  plan: SubscriptionPlan;
  billingPeriod: SubscriptionBillingPeriod;
  purchaseDisabled: boolean;
  // Các hạn mức của gói thấp hơn mức nhà xe đang dùng. Có phần tử nào là nâng
  // cấp vào sẽ nhận 422 — khoá nút ngay và nói rõ vướng ở đâu, đỡ để người dùng
  // bấm vào rồi mới biết.
  usageShortfalls?: PlanUsageShortfall[];
  // true = nâng cấp giữa chu kỳ nhưng gói này KHÔNG đắt hơn gói đang dùng, nên
  // proration ra số tiền ≤ 0 và BE từ chối báo giá (422 AMOUNT_NOT_PAYABLE)
  notAnUpgrade?: boolean;
  onPurchase: (plan: SubscriptionPlan) => void;
};

export default function PlanCard({
  plan,
  billingPeriod,
  purchaseDisabled,
  usageShortfalls = [],
  notAnUpgrade = false,
  onPurchase,
}: PlanCardProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const moduleLabels: Record<string, string> = {
    enableParcel: t("packages.parcelModule"),
    enableShuttle: t("packages.shuttleModule"),
    enableRag: t("packages.ragModule"),
  };

  const isCustom = isCustomPlan(plan);
  // Kỳ đang xem có bán không — gói riêng chỉ cần một giá lớn hơn 0, nên hiện
  // "0 đ" cho kỳ còn lại là mời người dùng đi vào 422 AMOUNT_NOT_PAYABLE
  const periodOnSale = isBillingPeriodSellable(plan, billingPeriod);
  const otherSellablePeriod = sellableBillingPeriods(plan).find(
    (period) => period !== billingPeriod,
  );
  const hasShortfall = usageShortfalls.length > 0;
  const blocked = hasShortfall || !periodOnSale || notAnUpgrade;

  return (
    <div
      data-testid={`plan-card-${plan.planId}`}
      className={`flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md ${
        hasShortfall || notAnUpgrade ? "opacity-60" : ""
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            {t("packages.packageLabel")}
          </p>
          <h3 className="text-lg font-bold text-gray-900">
            {plan.name}
          </h3>
        </div>
        {/* Gói riêng: badge nhận diện. KHÔNG bao giờ hiện ownerOperatorId. */}
        <Badge tone={isCustom ? "brand" : "success"}>
          {isCustom ? t("packages.customPlanBadge") : tc("active")}
        </Badge>
      </div>

      <p className="mb-4 text-sm text-gray-600">
        {plan.description || "-"}
      </p>

      {isCustom ? (
        <p className="mb-4 text-xs text-vr-900">
          {t("packages.customPlanPrivateHint")}
        </p>
      ) : null}

      <div className="mb-6 border-b border-gray-200 pb-6">
        {periodOnSale ? (
          <>
            <p className="text-3xl font-bold text-vr-900">
              {formatPrice(plan, billingPeriod)}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {tc(`enumLabels.${billingPeriod}`, {
                defaultValue: billingPeriod,
              })}
            </p>
          </>
        ) : (
          <p className="text-sm font-semibold text-gray-500">
            {otherSellablePeriod
              ? t("packages.onlySoldPerPeriod", {
                  period: t(`packages.billing.${otherSellablePeriod}`),
                })
              : t("packages.notPayable")}
          </p>
        )}
      </div>

      <div className="mb-6 space-y-3">
        <LimitRow
          icon={<FiBox size={16} />}
          label={t("packages.vehicleCount")}
          value={t("packages.maxVehicles", {
            n: planLimit(plan, "maxVehicles"),
          })}
        />
        <LimitRow
          icon={<FiTrendingUp size={16} />}
          label={t("packages.routesLabel")}
          value={t("packages.maxRoutes", {
            n: planLimit(plan, "maxRoutes"),
          })}
        />
        <LimitRow
          icon={<FiTrendingUp size={16} />}
          label={t("packages.tripsPerMonth")}
          value={formatNumber(planLimit(plan, "maxTripsPerMonth"))}
        />
      </div>

      <div className="mb-6 flex-1">
        <p className="mb-2 text-xs font-medium text-gray-600">
          {t("packages.features")}
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(plan.modules).map(([key, enabled]) => (
            <span
              key={key}
              className={`rounded-full px-2 py-1 font-semibold ${
                enabled
                  ? "bg-vr-50 text-vr-900"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {moduleLabels[key] ?? key}
            </span>
          ))}
        </div>
      </div>

      {/* Vướng cả hai lý do thì chỉ nói lý do KHÓ gỡ hơn: hạn mức thấp hơn mức
          đang dùng vẫn chặn kể cả sau khi hết chu kỳ, còn "không đắt hơn" thì
          hết hạn là mua được. Xếp chồng hai cảnh báo chỉ làm rối. */}
      {notAnUpgrade && !hasShortfall ? (
        <p
          data-testid={`plan-not-upgrade-${plan.planId}`}
          className="mb-3 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600"
        >
          {t("packages.notAnUpgradeHint")}
        </p>
      ) : null}

      {hasShortfall ? (
        <p
          data-testid={`plan-shortfall-${plan.planId}`}
          className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {usageShortfalls
            .map((shortfall) =>
              t("packages.limitBelowUsage", {
                label: t(`packages.limitLabels.${shortfall.limitKey}`),
                limit: formatNumber(shortfall.limit),
                used: formatNumber(shortfall.used),
              }),
            )
            .join(" ")}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => onPurchase(plan)}
        disabled={purchaseDisabled || blocked}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-vr-800 py-2 font-medium text-white transition-colors hover:bg-vr-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FiShoppingCart className="text-lg" />
        {t("packages.buyPackage")}
      </button>
    </div>
  );
}
