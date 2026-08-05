import { useTranslation } from "react-i18next";
import { FiBox, FiShoppingCart, FiTrendingUp } from "react-icons/fi";
import type {
  SubscriptionBillingPeriod,
  SubscriptionPlan,
} from "../../../api/vietride";
import { formatNumber, formatPrice, planLimit } from "./subscriptionHelpers";
import { LimitRow } from "./packageDetails";

type PlanCardProps = {
  plan: SubscriptionPlan;
  billingPeriod: SubscriptionBillingPeriod;
  purchaseDisabled: boolean;
  onPurchase: (plan: SubscriptionPlan) => void;
};

export default function PlanCard({
  plan,
  billingPeriod,
  purchaseDisabled,
  onPurchase,
}: PlanCardProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500">
            {t("packages.packageLabel")}
          </p>
          <h3 className="text-lg font-bold text-gray-900">
            {plan.name}
          </h3>
        </div>
        <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
          {tc("active")}
        </span>
      </div>

      <p className="mb-4 text-sm text-gray-600">
        {plan.description || "-"}
      </p>

      <div className="mb-6 border-b border-gray-200 pb-6">
        <p className="text-3xl font-bold text-vr-600">
          {formatPrice(plan, billingPeriod)}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {tc(`enumLabels.${billingPeriod}`, {
            defaultValue: billingPeriod,
          })}
        </p>
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
                  ? "bg-vr-50 text-vr-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {key}
            </span>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onPurchase(plan)}
        disabled={purchaseDisabled}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-vr-500 py-2 font-medium text-white transition-colors hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FiShoppingCart className="text-lg" />
        {t("packages.buyPackage")}
      </button>
    </div>
  );
}
