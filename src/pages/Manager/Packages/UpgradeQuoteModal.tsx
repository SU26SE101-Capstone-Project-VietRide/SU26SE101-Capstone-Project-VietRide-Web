// Modal nâng cấp hai bước: chọn kỳ + phương thức → báo giá → thanh toán.
// Thay PurchasePlanModal (luồng cũ bấm-một-nhịp-ra-VNPAY).
//
// Đồng hồ `dueAt` giữ báo giá đúng hạn kể cả khi modal đang đóng.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertTriangle,
  FiClock,
  FiCreditCard,
  FiLoader,
  FiZap,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import type { SubscriptionBillingPeriod } from "../../../api/vietride";
import { formatCurrency } from "../../../utils/currency";
import { formatDateOnly } from "../../../utils/date";
import { planPriceFor, sellableBillingPeriods } from "../../../utils/subscription";
import {
  formatRemainingPaymentTime,
  getRemainingSecondsUntil,
} from "./subscriptionHelpers";
import type { UseSubscriptionUpgradeResult } from "./useSubscriptionUpgrade";

// Dưới ngưỡng này đồng hồ chuyển đỏ — sắp phải báo giá lại
const urgentSecondsThreshold = 60;

type UpgradeQuoteModalProps = {
  upgrade: UseSubscriptionUpgradeResult;
  // Tên gói đang cấp quyền — dùng cho dòng "giá trị gói cũ còn lại"
  currentPlanName: string;
};

export default function UpgradeQuoteModal({
  upgrade,
  currentPlanName,
}: UpgradeQuoteModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const {
    isOpen,
    step,
    selectedPlan,
    billingPeriod,
    quote,
    isQuoting,
    isPaying,
    error,
    isBillingPeriodLocked,
  } = upgrade;

  const [clockMs, setClockMs] = useState(() => Date.now());

  useEffect(() => {
    if (!quote) return;

    const timer = window.setInterval(() => setClockMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [quote]);

  const remainingSeconds = quote
    ? getRemainingSecondsUntil(quote.dueAt, clockMs)
    : 0;

  // Hết giờ khi modal đang mở → bỏ báo giá, quay về bước chọn
  const { expireQuote } = upgrade;
  useEffect(() => {
    if (quote && remainingSeconds <= 0) {
      expireQuote();
    }
  }, [expireQuote, quote, remainingSeconds]);

  if (!selectedPlan) return null;

  const sellablePeriods = sellableBillingPeriods(selectedPlan);
  function renderPeriodButton(period: SubscriptionBillingPeriod) {
    // Kỳ nào giá bằng 0 thì gói này không bán kỳ đó (gói riêng chỉ cần một giá
    // lớn hơn 0) — khoá luôn thay vì hiện "0 đ" rồi để user đâm vào 422
    const sellable = sellablePeriods.includes(period);
    const disabled = !sellable || isBillingPeriodLocked;
    const active = billingPeriod === period;

    return (
      <button
        key={period}
        type="button"
        data-testid={`upgrade-period-${period}`}
        aria-pressed={active}
        disabled={disabled}
        onClick={() => upgrade.setBillingPeriod(period)}
        // Kỳ ĐANG CHỌN không bị làm mờ dù đang khoá — làm mờ cả hai thì người
        // dùng không đọc ra mình sắp trả theo kỳ nào.
        className={`rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
          active
            ? "border-vr-400 bg-vr-50 text-vr-900"
            : "border-gray-200 bg-white text-gray-700 hover:border-vr-200 hover:bg-vr-50/60 disabled:opacity-50"
        }`}
      >
        <span className="flex items-center gap-2">
          {t(`packages.billing.${period}`)}
          {active && isBillingPeriodLocked ? (
            <span className="rounded-full bg-vr-100 px-2 py-0.5 text-[11px] font-semibold text-vr-900">
              {t("packages.currentPeriodBadge")}
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-xs font-normal text-gray-500">
          {sellable
            ? formatCurrency(planPriceFor(selectedPlan!, period))
            : t("packages.periodNotSold")}
        </span>
      </button>
    );
  }

  return (
    <Modal
      open={isOpen}
      onClose={upgrade.close}
      wide
      icon={<FiZap size={20} />}
      title={t("packages.upgradeTitle", { name: selectedPlan.name })}
      subtitle={
        step === "select"
          ? t("packages.upgradeSelectSubtitle")
          : t("packages.upgradeQuoteSubtitle")
      }
      footer={
        step === "select" ? (
          <>
            <Button variant="secondary" onClick={upgrade.close}>
              {tc("cancel")}
            </Button>
            <Button
              variant="primary"
              data-testid="upgrade-request-quote"
              onClick={() => void upgrade.requestQuote()}
              disabled={isQuoting || sellablePeriods.length === 0}
            >
              {isQuoting ? <FiLoader className="animate-spin" /> : null}
              {t("packages.viewQuote")}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              data-testid="close-upgrade-quote"
              onClick={upgrade.close}
            >
              {tc("close")}
            </Button>
            <Button
              variant="primary"
              data-testid="upgrade-confirm-payment"
              onClick={() => void upgrade.confirmPayment()}
              disabled={isPaying || !quote}
            >
              {isPaying ? <FiLoader className="animate-spin" /> : null}
              {t("packages.payNow")}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-6">
        {error ? (
          <div
            data-testid="upgrade-error"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <FiAlertTriangle className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {step === "select" ? (
          <>
            <section>
              <h3 className="text-base font-bold text-gray-900">
                {t("packages.billingPeriod")}
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(["MONTHLY", "YEARLY"] as const).map(renderPeriodButton)}
              </div>
              {isBillingPeriodLocked ? (
                <p className="mt-2 text-xs text-gray-500">
                  {t("packages.billingPeriodLockedHint")}
                </p>
              ) : null}
            </section>

            <section className="border-t border-gray-200 pt-5">
              <h3 className="text-base font-bold text-gray-900">
                {t("packages.paymentMethod")}
              </h3>
              <div
                data-testid="upgrade-method-VNPAY"
                className="mt-4 flex items-start gap-3 rounded-lg border border-vr-400 bg-vr-50 p-4 text-left"
              >
                <FiCreditCard className="mt-0.5 shrink-0 text-vr-900" />
                <span className="min-w-0">
                  <span className="block font-semibold text-gray-900">
                    {t("packages.paymentMethods.VNPAY.title")}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {t("packages.paymentMethods.VNPAY.hint")}
                  </span>
                </span>
              </div>
            </section>
          </>
        ) : null}

        {step === "quote" && quote ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-600">
                {t("packages.quoteValidUntil")}
              </span>
              <Badge tone={remainingSeconds <= urgentSecondsThreshold ? "danger" : "warning"}>
                <FiClock size={12} />
                <span data-testid="quote-countdown">
                  {formatRemainingPaymentTime(remainingSeconds)}
                </span>
              </Badge>
            </div>

            {/* Hiển thị ĐÚNG số BE trả — không tự cộng trừ lại từ các field khác */}
            <section
              data-testid="quote-breakdown"
              className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm tabular-nums"
            >
              {quote.prorationApplied ? (
                <>
                  <div className="flex justify-between gap-4 py-1">
                    <span className="text-gray-600">
                      {t("packages.quoteProratedTarget", {
                        name: selectedPlan.name,
                      })}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(quote.proratedTargetAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 py-1">
                    <span className="text-gray-600">
                      {t("packages.quoteUnusedCredit", {
                        name: currentPlanName,
                      })}
                    </span>
                    <span className="font-semibold text-amber-700">
                      −{formatCurrency(quote.unusedCredit)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="pb-2 text-xs text-gray-500">
                  {t("packages.quoteFullPriceHint")}
                </p>
              )}

              <div className="mt-2 flex justify-between gap-4 border-t border-gray-300 pt-3">
                <span className="font-semibold text-gray-900">
                  {t("packages.quoteAmountDue")}
                </span>
                <span
                  data-testid="quote-amount-due"
                  className="text-lg font-bold text-vr-900"
                >
                  {formatCurrency(quote.amountDue)}
                </span>
              </div>

              <div className="mt-3 flex justify-between gap-4 border-t border-dashed border-gray-300 pt-3 text-xs text-gray-500">
                <span>{t("packages.quoteAppliesTo")}</span>
                <span>
                  {formatDateOnly(quote.periodFrom)} →{" "}
                  {formatDateOnly(quote.periodTo)}
                </span>
              </div>
            </section>

            {quote.prorationApplied ? (
              <section
                data-testid="deduction-formula"
                className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-sm text-gray-700"
              >
                <h3 className="font-bold text-gray-900">
                  {t("packages.deductionFormulaTitle")}
                </h3>
                <p className="mt-2 text-xs leading-5 text-gray-600">
                  {t("packages.deductionFormulaIntro")}
                </p>
                <ol className="mt-3 space-y-2 text-xs leading-5">
                  <li>
                    <span className="font-semibold text-gray-800">1. </span>
                    {t("packages.deductionRemainingRate")}
                  </li>
                  <li>
                    <span className="font-semibold text-gray-800">2. </span>
                    {t("packages.deductionRemainingValues")}
                  </li>
                  <li>
                    <span className="font-semibold text-gray-800">3. </span>
                    {t("packages.deductionAmountDue")}
                  </li>
                </ol>
                <div className="mt-3 rounded-md bg-white px-3 py-2 text-center font-semibold tabular-nums text-vr-900 shadow-sm ring-1 ring-blue-100">
                  {formatCurrency(quote.proratedTargetAmount)} −{" "}
                  {formatCurrency(quote.unusedCredit)} ={" "}
                  {formatCurrency(quote.amountDue)}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {t("packages.deductionRoundingHint")}
                </p>
              </section>
            ) : null}

          </>
        ) : null}
      </div>
    </Modal>
  );
}
