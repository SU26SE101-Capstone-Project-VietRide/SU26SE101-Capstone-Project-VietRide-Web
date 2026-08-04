import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import { useTranslation } from "react-i18next";
import {
  FiAlertTriangle,
  FiBox,
  FiCheck,
  FiClock,
  FiCreditCard,
  FiDownload,
  FiEye,
  FiShoppingCart,
  FiTrendingUp,
  FiXCircle,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import {
  getOperatorSubscription,
  getOperatorSubscriptionPlans,
  getOperatorInvoices,
  getOperatorInvoice,
  downloadOperatorInvoice,
  retryOperatorSubscriptionPayment,
  upgradeOperatorSubscription,
  type OperatorSubscriptionDetail,
  type OperatorInvoice,
  type OperatorInvoiceDetail,
  type SubscriptionBillingPeriod,
  type SubscriptionPendingUpgrade,
  type SubscriptionPlan,
} from "../../../api/vietride";
import { formatDateOnly } from "../../../utils/date";
import Pagination from "../../../components/Pagination";
import { saveSubscriptionPaymentIntent } from "./subscriptionPaymentIntent";

const PENDING_PAYMENT_REFRESH_INTERVAL_MS = 5_000;

function formatNumber(n: number) {
  return n.toLocaleString("vi-VN");
}

function formatPrice(
  plan: SubscriptionPlan,
  billingPeriod: SubscriptionBillingPeriod,
) {
  const amount =
    billingPeriod === "YEARLY" ? plan.pricePerYear : plan.pricePerMonth;
  return `${formatNumber(amount)} VND`;
}

function planLimit(
  plan: SubscriptionPlan,
  key: keyof SubscriptionPlan["limits"],
) {
  return plan.limits[key] ?? 0;
}

function isPayablePlan(plan: SubscriptionPlan) {
  return plan.pricePerMonth > 0 || plan.pricePerYear > 0;
}

function getRemainingPaymentSeconds(
  pendingUpgrade: SubscriptionPendingUpgrade | null,
  nowMs: number,
) {
  if (!pendingUpgrade) return 0;

  const dueAtMs = pendingUpgrade.dueAt
    ? Date.parse(pendingUpgrade.dueAt)
    : Number.NaN;
  if (Number.isFinite(dueAtMs)) {
    return Math.max(0, Math.ceil((dueAtMs - nowMs) / 1000));
  }

  return Math.max(0, Math.floor(pendingUpgrade.remainingSeconds));
}

function formatRemainingPaymentTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function normalizePendingPaymentDeadline(
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

type IdempotentAction = {
  signature: string;
  idempotencyKey: string;
};

function hasUnexpectedSubscriptionPeriod(
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

export default function ManagerPackages() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
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
    setPlans(planResult);
    return normalizedSubscription;
  }, []);

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
  }, [hasPendingPayment]);

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

    const request = {
      planId: selectedPlan.planId,
      billingPeriod,
      paymentMethod: "VNPAY" as const,
      returnUrl: `${window.location.origin}/payments/return`,
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
          targetPlanId: result.pendingTargetPlan.planId,
          targetPlanName: result.pendingTargetPlan.name,
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
              <FiBox className="mt-1 text-2xl text-vr-700" />
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
                        : "text-vr-700"
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
                  <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    {t("packages.retryPaymentUnavailable")}
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
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 font-semibold text-white transition-colors hover:bg-vr-600"
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
                onClick={() => openPurchase(plan)}
                disabled={
                  !canPurchasePackage || Boolean(subscription?.pendingUpgrade)
                }
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-vr-500 py-2 font-medium text-white transition-colors hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiShoppingCart className="text-lg" />
                {t("packages.buyPackage")}
              </button>
            </div>
          ))}
        </div>
      </div>

      <OperatorInvoiceSection />

      <Modal
        open={purchaseOpen}
        onClose={closePurchase}
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
              onClick={closePurchase}
              className="cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
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

          <section className="border-t border-gray-200 pt-5">
            <h3 className="text-base font-bold text-gray-900">
              {t("packages.paymentMethod")}
            </h3>
            <div className="mt-4">
              <div className="flex items-start gap-3 rounded-lg border border-vr-400 bg-vr-50 p-4 text-left">
                <FiCreditCard className="mt-0.5 shrink-0 text-vr-600" />
                <span>
                  <span className="block font-semibold text-gray-900">
                    {t("packages.paymentMethods.VNPAY.title")}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {t("packages.paymentMethods.VNPAY.hint")}
                  </span>
                </span>
              </div>
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

function OperatorInvoiceSection() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [invoices, setInvoices] = useState<OperatorInvoice[]>([]);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState("");
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<OperatorInvoiceDetail | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState("");
  const pageSize = 8;

  useEffect(() => {
    let ignore = false;

    async function loadInvoices() {
      setLoading(true);
      setError("");

      try {
        const result = await getOperatorInvoices({
          page,
          pageSize,
          sortBy: "createdAt",
          sortDir: "desc",
        });
        if (!ignore) {
          setInvoices(result.items);
          setTotalItems(result.totalItems);
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : t("packages.invoiceLoadFailed"),
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadInvoices();
    return () => {
      ignore = true;
    };
  }, [page, t]);

  async function openInvoiceDetail(invoiceId: string) {
    setDetailLoadingId(invoiceId);
    setError("");
    try {
      setDetail(await getOperatorInvoice(invoiceId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("packages.invoiceDetailFailed"),
      );
    } finally {
      setDetailLoadingId("");
    }
  }

  async function downloadInvoice(invoiceId: string) {
    setDownloadingId(invoiceId);
    setError("");

    try {
      const result = await downloadOperatorInvoice(invoiceId);
      const link = document.createElement("a");
      link.href = result.downloadUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("packages.invoiceDownloadFailed"),
      );
    } finally {
      setDownloadingId("");
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-xl font-bold text-gray-900">
          {t("packages.invoices")}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {t("packages.invoicesHint")}
        </p>
      </div>
      {error && (
        <div
          role="alert"
          className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600">
              <th className="px-4 py-3">{t("packages.invoiceNumber")}</th>
              <th className="px-4 py-3">{t("packages.period")}</th>
              <th className="px-4 py-3">{t("packages.amount")}</th>
              <th className="px-4 py-3">{t("packages.invoiceStatus")}</th>
              <th className="px-4 py-3">Tệp hóa đơn</th>
              <th className="px-4 py-3 text-center">{t("packages.action")}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && invoices.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-gray-500"
                >
                  {t("packages.noInvoices")}
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr
                  key={invoice.invoiceId}
                  className="border-t border-gray-100"
                >
                  <td className="px-4 py-3 font-semibold">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDateOnly(invoice.periodFrom)} -{" "}
                    {formatDateOnly(invoice.periodTo)}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {formatNumber(invoice.amount)} đ
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        invoice.status === "ISSUED"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {tc(`enumLabels.${invoice.status}`, {
                        defaultValue: invoice.status,
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {tc(`enumLabels.${invoice.pdfGenerationStatus}`, {
                      defaultValue: invoice.pdfGenerationStatus,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        disabled={detailLoadingId === invoice.invoiceId}
                        onClick={() =>
                          void openInvoiceDetail(invoice.invoiceId)
                        }
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-vr-700 hover:bg-vr-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title={t("packages.viewInvoice")}
                        aria-label={t("packages.viewInvoice")}
                      >
                        <FiEye />
                      </button>
                      <button
                        type="button"
                        disabled={
                          invoice.status !== "ISSUED" ||
                          invoice.pdfGenerationStatus !== "COMPLETED" ||
                          downloadingId === invoice.invoiceId
                        }
                        onClick={() => void downloadInvoice(invoice.invoiceId)}
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-vr-700 hover:bg-vr-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title={t("packages.downloadInvoice")}
                        aria-label={t("packages.downloadInvoice")}
                      >
                        <FiDownload />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={setPage}
      />
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        wide
        icon={<FiCreditCard size={20} />}
        title={t("packages.invoiceDetailTitle")}
        subtitle={detail?.invoiceNumber}
        footer={
          <button
            type="button"
            onClick={() => setDetail(null)}
            className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            {t("packages.close")}
          </button>
        }
      >
        {detail ? <InvoiceDetailContent detail={detail} /> : null}
      </Modal>
    </section>
  );
}

function InvoiceDetailContent({ detail }: { detail: OperatorInvoiceDetail }) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const buyer = detail.buyerSnapshot;
  const address = [
    buyer.addressStreet,
    buyer.addressWard,
    buyer.addressDistrict,
    buyer.addressProvince,
  ]
    .filter(Boolean)
    .join(", ");
  const statusLabel = tc(`enumLabels.${detail.status}`, {
    defaultValue: detail.status,
  });
  const billingLabel = tc(`enumLabels.${detail.billingPeriod}`, {
    defaultValue: detail.billingPeriod,
  });

  return (
    <div className="space-y-6 pb-2">
      <div className="rounded-xl border border-vr-100 bg-gradient-to-br from-vr-50 via-white to-slate-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-vr-600">
              {t("packages.invoiceNumber")}
            </p>
            <p className="mt-2 font-mono text-lg font-bold tracking-tight text-gray-900">
              {detail.invoiceNumber}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {detail.planName} · {billingLabel}
            </p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
            {statusLabel}
          </span>
        </div>
        <div className="mt-5 flex flex-col gap-1 border-t border-vr-100 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <span className="text-sm font-medium text-gray-500">
            {t("packages.amount")}
          </span>
          <span className="text-2xl font-bold tracking-tight text-vr-700">
            {formatNumber(detail.amount)} đ
          </span>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-3">
          <span className="h-5 w-1 rounded-full bg-vr-500" />
          <h3 className="font-bold text-gray-900">
            {t("packages.packageColumn")}
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <InfoItem
            label={t("packages.packageColumn")}
            value={detail.planName}
          />
          <InfoItem label={t("packages.billingPeriod")} value={billingLabel} />
          <InfoItem
            label={t("packages.period")}
            value={
              formatDateOnly(detail.periodFrom) +
              " - " +
              formatDateOnly(detail.periodTo)
            }
          />
        </div>
      </section>

      <section className="border-t border-gray-100 pt-5">
        <div className="mb-3 flex items-center gap-3">
          <span className="h-5 w-1 rounded-full bg-vr-500" />
          <h3 className="font-bold text-gray-900">{t("packages.buyerInfo")}</h3>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="grid gap-x-6 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-y-0">
            <div className="space-y-4 p-4 sm:border-r sm:border-gray-100">
              <InfoItem
                label={t("packages.buyerName")}
                value={buyer.name || "-"}
              />
              <InfoItem
                label={t("packages.businessRegistrationNumber")}
                value={buyer.businessRegistrationNumber || "-"}
              />
              <InfoItem
                label={t("packages.contactPhone")}
                value={formatVietnamPhoneForDisplay(buyer.contactPhone)}
              />
            </div>
            <div className="space-y-4 p-4">
              <InfoItem
                label={t("packages.taxCode")}
                value={buyer.taxCode || "-"}
              />
              <InfoItem
                label={t("packages.contactEmail")}
                value={buyer.contactEmail || "-"}
              />
              <InfoItem label={t("packages.address")} value={address || "-"} />
            </div>
          </div>
        </div>
      </section>
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

function PendingUpgradeItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs text-amber-700">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-gray-900">{value}</dd>
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
    <div className="min-w-0 rounded-lg bg-gray-50 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}

