import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FiBox, FiCheck, FiShoppingCart, FiTrendingUp } from "react-icons/fi";
import Modal from "../../../components/Modal";
import {
  getOperatorSubscription,
  getOperatorSubscriptionPlans,
  upgradeOperatorSubscription,
  type OperatorSubscriptionDetail,
  type SubscriptionBillingPeriod,
  type SubscriptionPlan,
} from "../../../api/vietride";
import { formatDateOnly } from "../../../utils/date";

function formatNumber(n: number) {
  return n.toLocaleString("vi-VN");
}

function formatPrice(plan: SubscriptionPlan, billingPeriod: SubscriptionBillingPeriod) {
  const amount =
    billingPeriod === "YEARLY" ? plan.pricePerYear : plan.pricePerMonth;
  return `${formatNumber(amount)} VND`;
}

function planLimit(plan: SubscriptionPlan, key: keyof SubscriptionPlan["limits"]) {
  return plan.limits[key] ?? 0;
}

export default function ManagerPackages() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [subscription, setSubscription] =
    useState<OperatorSubscriptionDetail | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [billingPeriod, setBillingPeriod] =
    useState<SubscriptionBillingPeriod>("YEARLY");
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const currentPlan = subscription?.plan ?? null;
  const activePlans = useMemo(
    () => plans.filter((plan) => plan.isActive),
    [plans],
  );

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialSubscriptionData() {
      try {
        const [subscriptionResult, planResult] = await Promise.all([
          getOperatorSubscription(),
          getOperatorSubscriptionPlans(),
        ]);
        if (isCurrent) {
          setSubscription(subscriptionResult);
          setPlans(planResult);
        }
      } catch (err) {
        if (isCurrent) {
          setError(
            err instanceof Error ? err.message : t("packages.loadFailed"),
          );
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialSubscriptionData();

    return () => {
      isCurrent = false;
    };
  }, [t]);

  function openPurchase(plan: SubscriptionPlan) {
    setSelectedPlan(plan);
    setBillingPeriod(subscription?.billingPeriod ?? "YEARLY");
    setPurchaseOpen(true);
    setMessage("");
    setError("");
  }

  async function handleUpgrade() {
    if (!selectedPlan) {
      return;
    }

    setIsUpgrading(true);
    setError("");

    try {
      const result = await upgradeOperatorSubscription({
        planId: selectedPlan.planId,
        billingPeriod,
        returnUrl: window.location.href,
      });

      setMessage(t("packages.upgradePending"));

      if (result.paymentRedirectUrl) {
        window.location.assign(result.paymentRedirectUrl);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("packages.upgradeFailed"),
      );
    } finally {
      setIsUpgrading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t("packages.title")}
        </h1>
        <p className="mt-1 text-gray-600">{t("packages.subtitle")}</p>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
          {t("packages.loading")}
        </div>
      ) : null}

      {subscription && currentPlan ? (
        <div className="rounded-lg border border-vr-200 bg-vr-50/70 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <FiBox className="mt-1 text-2xl text-vr-700" />
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {t("packages.currentPackage", { name: currentPlan.name })}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  {t("packages.expiresOn", {
                    date: formatDateOnly(subscription.expiresAt),
                  })}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase text-vr-700">
                  {subscription.status} · {subscription.billingPeriod}
                </p>
                <div className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
                  <UsageItem
                    label={t("packages.vehiclesUsed")}
                    used={subscription.usage.currentVehicles}
                    limit={planLimit(currentPlan, "maxVehicles")}
                  />
                  <UsageItem
                    label={t("packages.routesUsed")}
                    used={subscription.usage.currentRoutes}
                    limit={planLimit(currentPlan, "maxRoutes")}
                  />
                  <UsageItem
                    label={t("packages.tripsUsed")}
                    used={subscription.usage.currentTripsThisMonth}
                    limit={planLimit(currentPlan, "maxTripsPerMonth")}
                  />
                </div>
              </div>
            </div>
            <FiCheck className="text-3xl text-emerald-600" />
          </div>
          {subscription.pendingUpgrade ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t("packages.pendingPayment", {
                paymentId: subscription.pendingUpgrade.paymentId,
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <h2 className="mb-4 text-xl font-bold text-gray-900">
          {t("packages.available")}
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {activePlans.map((plan) => (
            <div
              key={plan.planId}
              className="flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
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
                <p className="mt-1 text-sm text-gray-500">{billingPeriod}</p>
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
                onClick={() => openPurchase(plan)}
                disabled={Boolean(subscription?.pendingUpgrade)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-vr-500 py-2 font-medium text-white transition-colors hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiShoppingCart className="text-lg" />
                {t("packages.buyPackage")}
              </button>
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        wide
        icon={<FiBox size={20} />}
        title={t("packages.purchaseTitle", {
          name: selectedPlan?.name || "",
        })}
        subtitle={selectedPlan?.description}
        footer={
          <>
            <button
              type="button"
              onClick={() => setPurchaseOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => void handleUpgrade()}
              disabled={isUpgrading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiShoppingCart />
              {t("packages.confirmPurchase")}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="text-base font-bold text-gray-900">
              {t("packages.packageInfo")}
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <InfoItem
                label={t("packages.packageColumn")}
                value={selectedPlan?.name || "-"}
              />
              <InfoItem
                label={t("packages.basePrice")}
                value={
                  selectedPlan ? formatPrice(selectedPlan, billingPeriod) : "-"
                }
              />
            </div>
          </section>

          <section className="border-t border-gray-200 pt-5">
            <h3 className="text-base font-bold text-gray-900">
              {t("packages.billingPeriod")}
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(["MONTHLY", "YEARLY"] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setBillingPeriod(period)}
                  className={`rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
                    billingPeriod === period
                      ? "border-vr-400 bg-vr-50 text-vr-900"
                      : "border-gray-200 bg-white text-gray-700 hover:border-vr-200 hover:bg-vr-50/60"
                  }`}
                >
                  {t(`packages.billing.${period}`)}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            {t("packages.vnpayNote")}
          </section>
        </div>
      </Modal>
    </div>
  );
}

function UsageItem({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  return (
    <div>
      <p className="text-gray-600">{label}</p>
      <p className="font-semibold text-gray-900">
        {formatNumber(used)}/{formatNumber(limit)}
      </p>
    </div>
  );
}

function LimitRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-vr-500">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 font-semibold text-gray-900">{value}</p>
    </div>
  );
}
