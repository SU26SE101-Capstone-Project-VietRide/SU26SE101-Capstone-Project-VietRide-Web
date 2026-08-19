import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertTriangle,
  FiBox,
  FiCheck,
  FiClock,
  FiShoppingCart,
  FiXCircle,
} from "react-icons/fi";
import {
  getOperatorSubscription,
  getOperatorSubscriptionPlans,
  retryOperatorSubscriptionPayment,
  upgradeOperatorSubscription,
  type OperatorSubscriptionDetail,
  type SubscriptionBillingPeriod,
  type SubscriptionPlan,
} from "../../../api/vietride";
import { formatDateOnly } from "../../../utils/date";
import { saveSubscriptionPaymentIntent } from "./subscriptionPaymentIntent";
import {
  formatNumber,
  formatRemainingPaymentTime,
  getRemainingPaymentSeconds,
  hasUnexpectedSubscriptionPeriod,
  isPayablePlan,
  normalizePendingPaymentDeadline,
  planLimit,
} from "./subscriptionHelpers";
import { PendingUpgradeItem, UsageItem } from "./packageDetails";
import OperatorInvoiceSection from "./OperatorInvoiceSection";
import PlanCard from "./PlanCard";
import PurchasePlanModal from "./PurchasePlanModal";
import { useOperatorSubscription } from "../../../contexts/operatorSubscriptionContext";

const PENDING_PAYMENT_REFRESH_INTERVAL_MS = 5_000;

type IdempotentAction = {
  signature: string;
  idempotencyKey: string;
};

export default function ManagerPackages() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const { syncSubscription } = useOperatorSubscription();
  const [subscription, setSubscription] =
    useState<OperatorSubscriptionDetail | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(
    null,
  );
  const [billingPeriod, setBillingPeriod] =
    useState<SubscriptionBillingPeriod>("YEARLY");
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const upgradeInFlightRef = useRef(false);
  const upgradeIntentRef = useRef<IdempotentAction | null>(null);
  const retryInFlightRef = useRef(false);
  const retryIntentRef = useRef<IdempotentAction | null>(null);

  const currentPlan = subscription?.plan ?? null;
  const pendingUpgrade = subscription?.pendingUpgrade ?? null;
  const hasPendingPayment =
    subscription?.status === "PENDING_PAYMENT" || Boolean(pendingUpgrade);
  const hasUnresolvedPendingPayment =
    subscription?.status === "PENDING_PAYMENT" && !pendingUpgrade;
  const pendingTargetPlanId =
    pendingUpgrade?.targetPlan?.planId ?? pendingUpgrade?.targetPlanId ?? "";
  const pendingTargetPlanName =
    pendingUpgrade?.targetPlan?.name ??
    plans.find((plan) => plan.planId === pendingTargetPlanId)?.name ??
    "-";
  const pendingPaymentId = pendingUpgrade?.latestPayment?.paymentId ?? "-";
  const remainingPaymentSeconds = getRemainingPaymentSeconds(
    pendingUpgrade,
    clockMs,
  );
  const canRetryPendingPayment = Boolean(
    pendingUpgrade &&
    remainingPaymentSeconds > 0 &&
    pendingUpgrade.latestPayment?.canRetry === true,
  );
  const isCancelledSubscription = subscription?.status === "CANCELLED";
  const isExpiredSubscription = subscription?.status === "EXPIRED";
  const isInactiveSubscription =
    isCancelledSubscription || isExpiredSubscription;
  const hasCurrentPlanEntitlement =
    subscription?.status === "ACTIVE" ||
    (subscription?.status === "PENDING_PAYMENT" && Boolean(currentPlan));
  const canPurchasePackage =
    subscription?.status === "ACTIVE" || isInactiveSubscription;
  const canRepurchaseCurrentPlan = Boolean(
    currentPlan && isInactiveSubscription && isPayablePlan(currentPlan),
  );
  const isCurrentTrialPlan = Boolean(
    currentPlan && !isPayablePlan(currentPlan),
  );
  const hasSubscriptionPeriodIssue = Boolean(
    subscription &&
    !hasUnresolvedPendingPayment &&
    hasUnexpectedSubscriptionPeriod(subscription),
  );
  const availablePlans = useMemo(
    () =>
      plans.filter(
        (plan) =>
          plan.isActive &&
          isPayablePlan(plan) &&
          plan.planId !== currentPlan?.planId,
      ),
    [currentPlan?.planId, plans],
  );

  const loadSubscriptionData = useCallback(async () => {
    const [subscriptionResult, planResult] = await Promise.all([
      getOperatorSubscription(),
      getOperatorSubscriptionPlans(),
    ]);
    const normalizedSubscription =
      normalizePendingPaymentDeadline(subscriptionResult);

    setSubscription(normalizedSubscription);
    syncSubscription(normalizedSubscription);
    setPlans(planResult);
    return normalizedSubscription;
  }, [syncSubscription]);

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialSubscriptionData() {
      try {
        await loadSubscriptionData();
      } catch (err) {
        if (isCurrent) {
          setError(
            err instanceof Error ? err.message : t("packages.loadFailed"),
          );
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    void loadInitialSubscriptionData();
    return () => {
      isCurrent = false;
    };
  }, [loadSubscriptionData, t]);

  useEffect(() => {
    if (!hasPendingPayment) return;

    let isCurrent = true;
    let isRefreshing = false;

    const refreshPendingSubscription = async () => {
      if (isRefreshing) return;
      isRefreshing = true;

      try {
        const result = normalizePendingPaymentDeadline(
          await getOperatorSubscription(),
        );
        if (!isCurrent) return;

        setSubscription(result);
        syncSubscription(result);
        if (import.meta.env.DEV) {
          console.info("[SubscriptionPayment] PENDING_SYNC_RESULT", {
            status: result.status,
            activePlanId: result.plan.planId,
            upgradeAttemptId: result.pendingUpgrade?.upgradeAttemptId ?? null,
            paymentId: result.pendingUpgrade?.latestPayment?.paymentId ?? null,
            paymentStatus: result.pendingUpgrade?.latestPayment?.status ?? null,
          });
        }
      } catch (refreshError) {
        if (isCurrent && import.meta.env.DEV) {
          console.warn("[SubscriptionPayment] PENDING_SYNC_FAILED", {
            message:
              refreshError instanceof Error
                ? refreshError.message
                : String(refreshError),
          });
        }
      } finally {
        isRefreshing = false;
      }
    };

    const timer = window.setInterval(
      () => void refreshPendingSubscription(),
      PENDING_PAYMENT_REFRESH_INTERVAL_MS,
    );

    return () => {
      isCurrent = false;
      window.clearInterval(timer);
    };
  }, [hasPendingPayment, syncSubscription]);

  useEffect(() => {
    if (!pendingUpgrade) return;

    const timer = window.setInterval(() => setClockMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [pendingUpgrade]);

  useEffect(() => {
    const hasVnPayParams = Array.from(
      new URLSearchParams(window.location.search).keys(),
    ).some((key) => key.startsWith("vnp_"));
    if (!hasVnPayParams) return;

    window.location.replace(
      `/payments/return${window.location.search}${window.location.hash}`,
    );
  }, []);

  function openPurchase(plan: SubscriptionPlan) {
    const isCurrentPlan = plan.planId === currentPlan?.planId;
    if (isCurrentPlan && !canRepurchaseCurrentPlan) {
      return;
    }

    if (!isPayablePlan(plan)) {
      setError(t("packages.planNotPayable"));
      return;
    }

    setSelectedPlan(plan);
    setBillingPeriod(subscription?.billingPeriod ?? "YEARLY");
    upgradeIntentRef.current = null;
    setPurchaseOpen(true);
    setMessage("");
    setError("");
  }

  function closePurchase() {
    upgradeIntentRef.current = null;
    setPurchaseOpen(false);
  }

  async function handleUpgrade() {
    if (!selectedPlan || upgradeInFlightRef.current) {
      return;
    }

    const payableAmount =
      billingPeriod === "YEARLY"
        ? selectedPlan.pricePerYear
        : selectedPlan.pricePerMonth;
    const isCurrentPlan = selectedPlan.planId === currentPlan?.planId;
    if ((isCurrentPlan && !canRepurchaseCurrentPlan) || payableAmount <= 0) {
      setError(t("packages.planNotPayable"));
      return;
    }

    upgradeInFlightRef.current = true;
    setIsUpgrading(true);
    setError("");

    // Không gửi returnUrl nữa — Backend tự chọn mode OPERATOR_WEB và dùng
    // VNPAY_WEB_RETURN_URL của server (handoff §2.1, §4).
    const request = {
      planId: selectedPlan.planId,
      billingPeriod,
      paymentMethod: "VNPAY" as const,
    };
    const requestSignature = JSON.stringify(request);
    if (upgradeIntentRef.current?.signature !== requestSignature) {
      upgradeIntentRef.current = {
        signature: requestSignature,
        idempotencyKey: crypto.randomUUID(),
      };
    }

    try {
      const result = await upgradeOperatorSubscription(
        request,
        upgradeIntentRef.current.idempotencyKey,
      );
      upgradeIntentRef.current = null;

      if (result.paymentRedirectUrl) {
        saveSubscriptionPaymentIntent({
          paymentId: result.paymentId,
          upgradeAttemptId: result.upgradeAttemptId,
          // pendingTargetPlan không có trong response mẫu 202 của handoff doc —
          // fallback về gói người dùng vừa chọn để không mất ngữ cảnh.
          targetPlanId: result.pendingTargetPlan?.planId ?? selectedPlan.planId,
          targetPlanName: result.pendingTargetPlan?.name ?? selectedPlan.name,
        });
        setMessage(t("packages.upgradePending"));
        window.location.assign(result.paymentRedirectUrl);
        return;
      }

      setError(t("packages.missingPaymentRedirect"));
    } catch (err) {
      const fallbackError =
        err instanceof Error ? err.message : t("packages.upgradeFailed");

      try {
        const refreshedSubscription = await loadSubscriptionData();
        if (
          refreshedSubscription.status === "PENDING_PAYMENT" ||
          refreshedSubscription.pendingUpgrade
        ) {
          upgradeIntentRef.current = null;
          setPurchaseOpen(false);
          setMessage(t("packages.paymentAlreadyPending"));
        } else {
          setError(fallbackError);
        }
      } catch {
        setError(fallbackError);
      }
    } finally {
      upgradeInFlightRef.current = false;
      setIsUpgrading(false);
    }
  }

  async function handleRetryPayment() {
    if (
      !pendingUpgrade ||
      !canRetryPendingPayment ||
      retryInFlightRef.current
    ) {
      return;
    }

    const retrySignature = `${pendingUpgrade.upgradeAttemptId}:${pendingPaymentId}`;
    if (retryIntentRef.current?.signature !== retrySignature) {
      retryIntentRef.current = {
        signature: retrySignature,
        idempotencyKey: crypto.randomUUID(),
      };
    }

    retryInFlightRef.current = true;
    setIsRetryingPayment(true);
    setError("");

    try {
      const result = await retryOperatorSubscriptionPayment(
        pendingUpgrade.upgradeAttemptId,
        retryIntentRef.current.idempotencyKey,
      );
      retryIntentRef.current = null;

      if (!result.paymentRedirectUrl) {
        setError(t("packages.missingPaymentRedirect"));
        return;
      }

      saveSubscriptionPaymentIntent({
        paymentId: result.paymentId,
        upgradeAttemptId: pendingUpgrade.upgradeAttemptId,
        targetPlanId: pendingTargetPlanId,
        targetPlanName: pendingTargetPlanName,
      });
      setMessage(t("packages.retryPaymentCreated"));
      window.location.assign(result.paymentRedirectUrl);
    } catch (err) {
      const fallbackError =
        err instanceof Error ? err.message : t("packages.retryPaymentFailed");

      try {
        const refreshedSubscription = await loadSubscriptionData();
        const refreshedAttemptId =
          refreshedSubscription.pendingUpgrade?.upgradeAttemptId;
        if (refreshedAttemptId !== pendingUpgrade.upgradeAttemptId) {
          retryIntentRef.current = null;
        }
      } catch {
        // Keep the same key so a network retry remains idempotent.
      }
      setError(fallbackError);
    } finally {
      retryInFlightRef.current = false;
      setIsRetryingPayment(false);
    }
  }

  useToastFeedback({ message, error });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t("packages.title")}
        </h1>
        <p className="mt-1 text-gray-600">{t("packages.subtitle")}</p>
      </div>


      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
          {t("packages.loading")}
        </div>
      ) : null}

      {subscription && currentPlan ? (
        <div
          className={`rounded-lg border p-6 ${
            hasPendingPayment
              ? "border-amber-200 bg-amber-50/70"
              : isCancelledSubscription
                ? "border-red-200 bg-red-50/70"
                : isExpiredSubscription
                  ? "border-amber-200 bg-amber-50/70"
                  : "border-vr-200 bg-vr-50/70"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <FiBox className="mt-1 text-2xl text-vr-900" />
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {t(
                    isCancelledSubscription
                      ? "packages.cancelledPackage"
                      : isExpiredSubscription
                        ? "packages.expiredPackage"
                        : "packages.currentPackage",
                    { name: currentPlan.name },
                  )}
                </h3>
                {subscription.expiresAt ? (
                  <p className="mt-1 text-sm text-gray-600">
                    {t("packages.expiresOn", {
                      date: formatDateOnly(subscription.expiresAt),
                    })}
                  </p>
                ) : null}
                <p
                  className={`mt-1 text-xs font-semibold uppercase ${
                    isCancelledSubscription
                      ? "text-red-700"
                      : hasPendingPayment || isExpiredSubscription
                        ? "text-amber-700"
                        : "text-vr-900"
                  }`}
                >
                  {tc(`enumLabels.${subscription.status}`, {
                    defaultValue: subscription.status,
                  })}{" "}
                  ·{" "}
                  {subscription.billingPeriod
                    ? tc(`enumLabels.${subscription.billingPeriod}`, {
                        defaultValue: subscription.billingPeriod,
                      })
                    : "-"}
                </p>
                {hasCurrentPlanEntitlement ? (
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
                ) : null}
              </div>
            </div>
            {hasPendingPayment ? (
              <FiClock className="text-3xl text-amber-600" />
            ) : isCancelledSubscription ? (
              <FiXCircle className="text-3xl text-red-600" />
            ) : isExpiredSubscription ? (
              <FiClock className="text-3xl text-amber-600" />
            ) : subscription.status === "ACTIVE" ? (
              <FiCheck className="text-3xl text-emerald-600" />
            ) : (
              <FiClock className="text-3xl text-gray-500" />
            )}
          </div>
          {hasUnresolvedPendingPayment ? (
            <div
              role="status"
              className="mt-4 rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm text-amber-800"
            >
              {t("packages.pendingPaymentOutOfSync")}
            </div>
          ) : null}
          {pendingUpgrade ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-white p-4 text-sm text-amber-900">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-bold">
                    {t("packages.pendingUpgradeTitle")}
                  </p>
                  <p className="mt-1 text-amber-800">
                    {t("packages.activePlanDuringPayment", {
                      name: currentPlan.name,
                    })}
                  </p>
                </div>
                {canRetryPendingPayment ? (
                  <button
                    type="button"
                    onClick={() => void handleRetryPayment()}
                    disabled={isRetryingPayment}
                    className="cursor-pointer rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isRetryingPayment
                      ? t("packages.retryingPayment")
                      : t("packages.retryPayment")}
                  </button>
                ) : (
                  // Hai tình huống khác hẳn nhau, trước đây gộp vào một câu
                  // "Chưa thể tạo lại hoặc yêu cầu đã hết hạn" nên người dùng
                  // không biết phải chờ hay phải mua lại.
                  <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    {remainingPaymentSeconds > 0
                      ? t("packages.retryPaymentPending")
                      : t("packages.retryPaymentExpired")}
                  </span>
                )}
              </div>
              <dl className="mt-4 grid gap-3 border-t border-amber-100 pt-4 sm:grid-cols-2 lg:grid-cols-5">
                <PendingUpgradeItem
                  label={t("packages.pendingTargetPlan")}
                  value={pendingTargetPlanName}
                />
                <PendingUpgradeItem
                  label={t("packages.billingPeriod")}
                  value={t(`packages.billing.${pendingUpgrade.billingPeriod}`)}
                />
                <PendingUpgradeItem
                  label={t("packages.amount")}
                  value={`${formatNumber(pendingUpgrade.amount)} đ`}
                />
                <PendingUpgradeItem
                  label={t("packages.paymentId")}
                  value={pendingPaymentId}
                />
                <PendingUpgradeItem
                  label={t("packages.remainingPaymentTime")}
                  value={formatRemainingPaymentTime(remainingPaymentSeconds)}
                />
              </dl>
            </div>
          ) : null}
          {isCurrentTrialPlan ? (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              {t("packages.freeTrialNotice")}
            </div>
          ) : null}
          {hasSubscriptionPeriodIssue ? (
            <div
              role="alert"
              className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm text-amber-800"
            >
              <FiAlertTriangle className="mt-0.5 shrink-0" />
              <span>{t("packages.subscriptionPeriodMismatch")}</span>
            </div>
          ) : null}
          {isInactiveSubscription ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
              <span>
                {t(
                  isCurrentTrialPlan
                    ? "packages.trialEndedHint"
                    : "packages.inactivePackageHint",
                )}
              </span>
              {canRepurchaseCurrentPlan ? (
                <button
                  type="button"
                  onClick={() => openPurchase(currentPlan)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-vr-800 px-4 py-2 font-semibold text-white transition-colors hover:bg-vr-900"
                >
                  <FiShoppingCart />
                  {t("packages.repurchasePackage")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <h2 className="mb-4 text-xl font-bold text-gray-900">
          {t("packages.available")}
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {availablePlans.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500 md:col-span-2 lg:col-span-3">
              {t("packages.noOtherPayablePlans")}
            </div>
          ) : null}
          {availablePlans.map((plan) => (
            <PlanCard
              key={plan.planId}
              plan={plan}
              billingPeriod={billingPeriod}
              purchaseDisabled={
                !canPurchasePackage || Boolean(subscription?.pendingUpgrade)
              }
              onPurchase={openPurchase}
            />
          ))}
        </div>
      </div>

      <OperatorInvoiceSection />

      <PurchasePlanModal
        open={purchaseOpen}
        onClose={closePurchase}
        onConfirm={() => void handleUpgrade()}
        selectedPlan={selectedPlan}
        billingPeriod={billingPeriod}
        onBillingPeriodChange={setBillingPeriod}
        isUpgrading={isUpgrading}
      />
    </div>
  );
}
