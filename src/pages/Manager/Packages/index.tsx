import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertTriangle,
  FiBox,
  FiCalendar,
  FiCheck,
  FiClock,
  FiMap,
  FiShoppingCart,
  FiTruck,
  FiUserCheck,
  FiUserPlus,
  FiUsers,
  FiXCircle,
} from "react-icons/fi";
import {
  getOperatorSubscription,
  getOperatorSubscriptionPlans,
  retryOperatorSubscriptionPayment,
  type OperatorSubscriptionDetail,
  type SubscriptionBillingPeriod,
  type SubscriptionPlan,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import {
  findPlanUsageShortfalls,
  findUsagePressure,
  producesPayableUpgrade,
} from "../../../utils/subscription";
import { formatDateOnly } from "../../../utils/date";
import { saveSubscriptionPaymentIntent } from "./subscriptionPaymentIntent";
import {
  formatNumber,
  formatRemainingPaymentTime,
  getRemainingPaymentSeconds,
  getRemainingSecondsUntil,
  hasUnexpectedSubscriptionPeriod,
  isPayablePlan,
  normalizePendingPaymentDeadline,
  planLimit,
} from "./subscriptionHelpers";
import { PendingUpgradeItem, UsageItem } from "./packageDetails";
import OperatorInvoiceSection from "./OperatorInvoiceSection";
import { Badge } from "../../../components/ui/Badge";
import PlanCard from "./PlanCard";
import UpgradeQuoteModal from "./UpgradeQuoteModal";
import CustomRequestSection from "./CustomRequestSection";
import UsagePressureBanner from "./UsagePressureBanner";
import CustomRequestModal from "./CustomRequestModal";
import { useSubscriptionUpgrade } from "./useSubscriptionUpgrade";
import { useOperatorCustomPlanRequests } from "./useOperatorCustomPlanRequests";
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
  // Kỳ người dùng CHỦ ĐỘNG chọn ở toggle bảng giá. null = chưa đụng tới, lúc đó
  // lấy mặc định theo kỳ đang trả (xem `billingPeriod` bên dưới).
  const [browsedBillingPeriod, setBrowsedBillingPeriod] =
    useState<SubscriptionBillingPeriod | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const planListRef = useRef<HTMLDivElement>(null);
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
  // Gói đã ngừng bán thì KHÔNG mua lại được — thiếu điều kiện isActive thì FE
  // sẽ mời "mua lại" rồi ăn 409 SUBSCRIPTION_UPGRADE_TARGET_PLAN_INACTIVE.
  // Gói riêng gần như chắc chắn bị tắt sau khi nhà xe lên gói riêng lớn hơn.
  const isCurrentPlanOnSale = Boolean(currentPlan?.isActive);
  const canRepurchaseCurrentPlan = Boolean(
    currentPlan &&
    isInactiveSubscription &&
    isCurrentPlanOnSale &&
    isPayablePlan(currentPlan),
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

  // Chỉ nâng cấp giữa chu kỳ ĐANG TRẢ TIỀN mới phải giữ nguyên kỳ hiện tại
  // (chặn trước 422 BILLING_PERIOD_MISMATCH). Bản dùng thử và subscription đã
  // hết hiệu lực đều mở CHU KỲ MỚI nên được chọn kỳ tự do — xem §5 spec.
  const lockedBillingPeriod =
    subscription?.status === "ACTIVE" && !isCurrentTrialPlan
      ? (subscription.billingPeriod ?? null)
      : null;
  // Bảng giá mặc định hiện ĐÚNG kỳ đang trả: thấy giá nào thì mua được giá đó.
  // Trước đây mặc định cứng YEARLY nên nhà xe trả theo tháng vẫn thấy giá năm,
  // bấm vào mới biết chỉ mua được theo tháng — hai chỗ nói hai kiểu.
  const billingPeriod =
    browsedBillingPeriod ?? lockedBillingPeriod ?? "YEARLY";
  // Đang xem một kỳ khác kỳ mua được — phải nói ra, không thì giá hiển thị là
  // giá người ta không trả được
  const isBrowsingUnavailablePeriod =
    lockedBillingPeriod !== null && billingPeriod !== lockedBillingPeriod;

  const upgrade = useSubscriptionUpgrade({
    lockedBillingPeriod,
    onSubscriptionChanged: loadSubscriptionData,
    t,
  });
  const savedQuoteRemainingSeconds = getRemainingSecondsUntil(
    upgrade.quote?.dueAt,
    clockMs,
  );
  const customRequests = useOperatorCustomPlanRequests(t);
  // Hạn mức của gói ĐANG DÙNG mà nhà xe sắp/đã chạm — báo trước thay vì để họ
  // phát hiện lúc thao tác bị chặn giữa chừng (handoff §1 mục 1)
  const usagePressures =
    subscription && currentPlan && hasCurrentPlanEntitlement
      ? findUsagePressure(currentPlan, subscription.usage)
      : [];
  const [customRequestOpen, setCustomRequestOpen] = useState(false);

  const { load: loadCustomRequests } = customRequests;
  useEffect(() => {
    void loadCustomRequests();
  }, [loadCustomRequests]);

  const { restoreSavedQuotePlan } = upgrade;
  useEffect(() => {
    restoreSavedQuotePlan(plans);
  }, [plans, restoreSavedQuotePlan]);

  // Gói riêng vừa được duyệt — tra từ plan list theo approvedPlanId. Không thấy
  // nghĩa là admin đã ngừng bán nó, lúc đó chỉ hiện trạng thái chứ không mời mua.
  const approvedCustomPlan =
    customRequests.latestRequest?.status === "APPROVED"
      ? (plans.find(
          (plan) =>
            plan.planId === customRequests.latestRequest?.approvedPlanId &&
            plan.isActive,
        ) ?? null)
      : null;
  const approvedCustomPlanUpgradeDisabled = Boolean(
    approvedCustomPlan &&
      lockedBillingPeriod !== null &&
      currentPlan &&
      !producesPayableUpgrade(currentPlan, approvedCustomPlan, lockedBillingPeriod),
  );

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
    if (!pendingUpgrade && !upgrade.quote) return;

    const timer = window.setInterval(() => setClockMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [pendingUpgrade, upgrade.quote]);

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

    if (
      lockedBillingPeriod !== null &&
      currentPlan &&
      !producesPayableUpgrade(currentPlan, plan, lockedBillingPeriod)
    ) {
      setError(t("packages.notAnUpgradeHint"));
      return;
    }

    setMessage("");
    setError("");
    upgrade.open(plan, billingPeriod);
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

      // Có response từ server thì request đã kết thúc: lần bấm tiếp theo là
      // action mới và phải dùng key mới. Chỉ lỗi mạng (không có response) mới
      // giữ lại key để retry đúng request chưa rõ kết quả.
      if (err instanceof ApiRequestError) {
        retryIntentRef.current = null;
      }

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

  // Lỗi nâng cấp hiện trong modal khi modal còn mở; nếu modal đã đóng thì nổi
  // lên cùng kênh toast của trang.
  useToastFeedback({
    message: customRequests.notice || message,
    error: error || customRequests.error || (upgrade.isOpen ? "" : upgrade.error),
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t("packages.title")}
        </h1>
        <p className="mt-1 text-gray-600">{t("packages.subtitle")}</p>
      </div>

      {upgrade.quote && !upgrade.isOpen && !pendingUpgrade ? (
        <div
          role="alert"
          data-testid="saved-upgrade-quote"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-amber-700 ring-1 ring-amber-200">
                <FiClock />
              </span>
              <div className="min-w-0">
                <p className="font-bold">{t("packages.savedQuoteTitle")}</p>
                <p className="mt-1 text-sm text-amber-800">
                  {t("packages.savedQuoteHint", {
                    name: upgrade.quoteTargetPlanName || "-",
                  })}
                </p>
                <p className="mt-2 text-sm font-semibold tabular-nums">
                  {formatNumber(upgrade.quote.amountDue)} đ ·{" "}
                  {t("packages.remainingPaymentTime")}: {" "}
                  {formatRemainingPaymentTime(savedQuoteRemainingSeconds)}
                </p>
              </div>
            </div>
            <button
              type="button"
              data-testid="resume-saved-upgrade-quote"
              onClick={upgrade.reopenQuote}
              disabled={
                !upgrade.selectedPlan || savedQuoteRemainingSeconds <= 0
              }
              className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("packages.resumeSavedQuote")}
            </button>
          </div>
        </div>
      ) : null}


      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
          {t("packages.loading")}
        </div>
      ) : null}

      {subscription && currentPlan ? (
        <div
          className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${
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
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-xl text-vr-800 shadow-sm ring-1 ring-vr-100">
                <FiBox />
              </span>
              <div className="min-w-0">
                <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-gray-900">
                  {t(
                    isCancelledSubscription
                      ? "packages.cancelledPackage"
                      : isExpiredSubscription
                        ? "packages.expiredPackage"
                        : "packages.currentPackage",
                    { name: currentPlan.name },
                  )}
                  {/* Gói đã tắt vẫn cấp quyền tới hết hạn nhưng KHÔNG mua lại
                      được — báo trước, đừng để tới lúc hết hạn mới lộ ra. */}
                  {!isCurrentPlanOnSale ? (
                    <Badge tone="warning">
                      {t("packages.planNoLongerOnSale")}
                    </Badge>
                  ) : null}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {subscription.expiresAt ? (
                    <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200/70">
                      {t("packages.expiresOn", {
                        date: formatDateOnly(subscription.expiresAt),
                      })}
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                    isCancelledSubscription
                      ? "bg-red-100 text-red-700"
                      : hasPendingPayment || isExpiredSubscription
                        ? "bg-amber-100 text-amber-700"
                        : "bg-vr-100 text-vr-900"
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
                  </span>
                </div>
              </div>
            </div>
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl ${
                hasPendingPayment || isExpiredSubscription
                  ? "bg-amber-100 text-amber-600"
                  : isCancelledSubscription
                    ? "bg-red-100 text-red-600"
                    : subscription.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-gray-100 text-gray-500"
              }`}
            >
              {hasPendingPayment ? (
                <FiClock />
              ) : isCancelledSubscription ? (
                <FiXCircle />
              ) : isExpiredSubscription ? (
                <FiClock />
              ) : subscription.status === "ACTIVE" ? (
                <FiCheck />
              ) : (
                <FiClock />
              )}
            </span>
          </div>
          {hasCurrentPlanEntitlement ? (
            <div className="mt-5 border-t border-vr-200/70 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {t("packages.usageLimits")}
              </p>
              <div
                data-testid="current-plan-quota-grid"
                className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6"
              >
                <UsageItem
                  icon={<FiTruck />}
                  label={t("packages.vehiclesUsed")}
                  used={subscription.usage.currentVehicles}
                  limit={planLimit(currentPlan, "maxVehicles")}
                />
                <UsageItem
                  icon={<FiMap />}
                  label={t("packages.routesUsed")}
                  used={subscription.usage.currentRoutes}
                  limit={planLimit(currentPlan, "maxRoutes")}
                />
                <UsageItem
                  icon={<FiUserCheck />}
                  label={t("packages.driversUsed")}
                  used={subscription.usage.currentDrivers}
                  limit={planLimit(currentPlan, "maxDrivers")}
                />
                <UsageItem
                  icon={<FiUserPlus />}
                  label={t("packages.assistantsUsed")}
                  used={subscription.usage.currentAssistants}
                  limit={planLimit(currentPlan, "maxAssistants")}
                />
                <UsageItem
                  icon={<FiUsers />}
                  label={t("packages.operatorUsersUsed")}
                  used={subscription.usage.currentOperatorUsers}
                  limit={planLimit(currentPlan, "maxOperatorUsers")}
                />
                <UsageItem
                  icon={<FiCalendar />}
                  label={t("packages.tripsUsed")}
                  used={subscription.usage.currentTripsThisMonth}
                  limit={planLimit(currentPlan, "maxTripsPerMonth")}
                />
              </div>
            </div>
          ) : null}
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

      {subscription ? (
        <UsagePressureBanner
          pressures={usagePressures}
          // Chỉ mời chọn gói khi thật sự có gói chứa nổi quy mô hiện tại
          hasUpgradeOption={availablePlans.some(
            (plan) =>
              findPlanUsageShortfalls(plan, subscription.usage).length === 0,
          )}
          onChoosePlan={() =>
            planListRef.current?.scrollIntoView({ behavior: "smooth" })
          }
        />
      ) : null}

      <div ref={planListRef}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-900">
            {t("packages.available")}
          </h2>
          <div className="flex flex-col items-end gap-1">
            <div
              role="group"
              aria-label={t("packages.billingPeriod")}
              className="inline-flex divide-x divide-gray-200 overflow-hidden rounded-lg border border-gray-200"
            >
              {(["MONTHLY", "YEARLY"] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  data-testid={`plan-list-period-${period}`}
                  aria-pressed={billingPeriod === period}
                  onClick={() => setBrowsedBillingPeriod(period)}
                  className={`px-3 py-1.5 text-sm font-semibold transition-colors ${
                    billingPeriod === period
                      ? "bg-vr-800 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t(`packages.billing.${period}`)}
                </button>
              ))}
            </div>
            {/* Hai giá độc lập — nói rõ để không ai tưởng giá năm = giá tháng × 12 */}
            <p className="text-xs text-gray-500">
              {t("packages.independentPricesHint")}
            </p>
            {isBrowsingUnavailablePeriod ? (
              <p
                data-testid="browsing-unavailable-period"
                className="text-xs font-semibold text-amber-700"
              >
                {t("packages.browsingUnavailablePeriod", {
                  period: t(`packages.billing.${lockedBillingPeriod}`),
                })}
              </p>
            ) : null}
          </div>
        </div>
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
                !canPurchasePackage ||
                Boolean(subscription?.pendingUpgrade) ||
                Boolean(upgrade.quote)
              }
              usageShortfalls={
                subscription
                  ? findPlanUsageShortfalls(plan, subscription.usage)
                  : []
              }
              // Giữa chu kỳ, gói không đắt hơn gói đang dùng thì proration ra
              // số tiền ≤ 0 và BE từ chối ngay ở bước báo giá
              notAnUpgrade={
                lockedBillingPeriod !== null &&
                currentPlan !== null &&
                !producesPayableUpgrade(currentPlan, plan, lockedBillingPeriod)
              }
              onPurchase={openPurchase}
            />
          ))}
        </div>
      </div>

      {subscription && currentPlan ? (
        <CustomRequestSection
          queue={customRequests}
          approvedPlan={approvedCustomPlan}
          upgradeDisabled={approvedCustomPlanUpgradeDisabled}
          // Đang có yêu cầu chờ duyệt thì không cho gửi thêm (BE chỉ nhận một)
          canRequest={canPurchasePackage && !customRequests.pendingRequest}
          onOpenForm={() => setCustomRequestOpen(true)}
          onUpgradeToApprovedPlan={openPurchase}
        />
      ) : null}

      <OperatorInvoiceSection />

      <UpgradeQuoteModal
        upgrade={upgrade}
        currentPlanName={currentPlan?.name ?? "-"}
      />

      {customRequestOpen && subscription && currentPlan ? (
        <CustomRequestModal
          currentPlan={currentPlan}
          usage={subscription.usage}
          isSubmitting={customRequests.isSubmitting}
          onClose={() => setCustomRequestOpen(false)}
          onSubmit={(payload) => {
            void customRequests.submit(payload).then((ok) => {
              if (ok) setCustomRequestOpen(false);
            });
          }}
        />
      ) : null}
    </div>
  );
}
