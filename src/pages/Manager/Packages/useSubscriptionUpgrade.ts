// Hook cục bộ màn Packages: toàn bộ state của luồng nâng cấp hai bước
// (báo giá → thanh toán) theo FE-RESPONSE 2026-08-21.
import { useCallback, useRef, useState } from "react";
import { ApiRequestError } from "../../../api/client";
import {
  confirmSubscriptionUpgradePayment,
  createSubscriptionUpgradeQuote,
  type SubscriptionBillingPeriod,
  type SubscriptionPlan,
  type SubscriptionUpgradeQuote,
} from "../../../api/vietride";
import {
  clearSubscriptionUpgradeQuoteIntent,
  getSubscriptionUpgradeQuoteIntent,
  saveSubscriptionPaymentIntent,
  saveSubscriptionUpgradeQuoteIntent,
} from "./subscriptionPaymentIntent";

// Chữ ký hàm dịch tối thiểu hook cần — nhận từ useTranslation("manager") ở index
type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

// "select" = đang chọn kỳ + phương thức; "quote" = đã có báo giá, chờ trả tiền
export type UpgradeStep = "select" | "quote";

type UseSubscriptionUpgradeParams = {
  // Kỳ của subscription hiện tại — nâng cấp giữa chu kỳ phải giữ nguyên kỳ này
  // (chặn trước 422 SUBSCRIPTION_UPGRADE_BILLING_PERIOD_MISMATCH)
  lockedBillingPeriod: SubscriptionBillingPeriod | null;
  // Gọi lại khi lỗi cho biết state server đã đổi.
  onSubscriptionChanged: () => Promise<unknown>;
  t: TranslateFn;
};

// Các mã lỗi nói "báo giá không còn tin được nữa" — đều quy về một hành vi:
// bỏ quote, quay lại bước chọn, để người dùng báo giá lại.
const staleQuoteCodes = new Set([
  "SUBSCRIPTION_UPGRADE_QUOTE_STALE",
  "SUBSCRIPTION_UPGRADE_EXPIRED",
  "SUBSCRIPTION_UPGRADE_AMOUNT_NOT_PAYABLE",
]);

// Lỗi nói "state server đã đổi, đóng modal và tải lại đi"
const reloadAndCloseCodes = new Set([
  "SUBSCRIPTION_UPGRADE_TARGET_PLAN_INACTIVE",
  "RESOURCE_NOT_FOUND",
]);

function errorCodeOf(error: unknown) {
  return error instanceof ApiRequestError ? (error.code ?? "") : "";
}

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useSubscriptionUpgrade({
  lockedBillingPeriod,
  onSubscriptionChanged,
  t,
}: UseSubscriptionUpgradeParams) {
  const [initialQuoteIntent] = useState(() =>
    getSubscriptionUpgradeQuoteIntent(),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<UpgradeStep>(
    initialQuoteIntent ? "quote" : "select",
  );
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(
    null,
  );
  const [billingPeriod, setBillingPeriodState] =
    useState<SubscriptionBillingPeriod>(
      initialQuoteIntent?.quote.billingPeriod ?? "MONTHLY",
    );
  const [quote, setQuote] = useState<SubscriptionUpgradeQuote | null>(
    initialQuoteIntent?.quote ?? null,
  );
  const [quoteTargetPlanName, setQuoteTargetPlanName] = useState(
    initialQuoteIntent?.targetPlanName ?? "",
  );
  const [isQuoting, setIsQuoting] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState("");

  const inFlightRef = useRef(false);
  // Key của lượt quote hiện tại: giữ ổn định theo bộ chọn để bấm "Xem báo giá"
  // nhiều lần không đẻ ra nhiều upgrade attempt.
  const quoteIntentRef = useRef<{ signature: string; key: string } | null>(
    null,
  );

  const open = useCallback(
    (plan: SubscriptionPlan, defaultPeriod: SubscriptionBillingPeriod) => {
      if (quote) {
        setStep("quote");
        setError("");
        setIsOpen(true);
        return;
      }

      setSelectedPlan(plan);
      setBillingPeriodState(lockedBillingPeriod ?? defaultPeriod);
      setQuote(null);
      setStep("select");
      setError("");
      quoteIntentRef.current = null;
      setIsOpen(true);
    },
    [lockedBillingPeriod, quote],
  );

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const reopenQuote = useCallback(() => {
    if (!quote || !selectedPlan) return;
    setStep("quote");
    setError("");
    setIsOpen(true);
  }, [quote, selectedPlan]);

  const restoreSavedQuotePlan = useCallback(
    (plans: SubscriptionPlan[]) => {
      if (!quote || selectedPlan) return;
      const plan = plans.find((item) => item.planId === quote.targetPlanId);
      if (plan) setSelectedPlan(plan);
    },
    [quote, selectedPlan],
  );

  // Đổi lựa chọn = báo giá cũ hết nghĩa. Huỷ luôn thay vì để người dùng trả tiền
  // theo một báo giá không khớp với thứ họ vừa chọn.
  const discardQuote = useCallback(() => {
    setQuote(null);
    setQuoteTargetPlanName("");
    setStep("select");
    quoteIntentRef.current = null;
    clearSubscriptionUpgradeQuoteIntent();
  }, []);

  const setBillingPeriod = useCallback(
    (period: SubscriptionBillingPeriod) => {
      setBillingPeriodState(period);
      discardQuote();
    },
    [discardQuote],
  );

  // Hết hạn `dueAt` thì bỏ báo giá đã lưu. Không tự gọi lại API: tab có thể đã
  // bị bỏ đó cả buổi.
  const expireQuote = useCallback(() => {
    setQuote(null);
    setStep("select");
    quoteIntentRef.current = null;
    setError(t("packages.quoteExpiredHint"));
  }, [t]);

  async function requestQuote() {
    if (!selectedPlan || inFlightRef.current) return;

    const request = {
      planId: selectedPlan.planId,
      billingPeriod,
      paymentMethod: "VNPAY" as const,
    };
    const signature = JSON.stringify(request);
    if (quoteIntentRef.current?.signature !== signature) {
      quoteIntentRef.current = { signature, key: crypto.randomUUID() };
    }

    inFlightRef.current = true;
    setIsQuoting(true);
    setError("");

    try {
      const result = await createSubscriptionUpgradeQuote(
        request,
        quoteIntentRef.current.key,
      );
      setQuote(result);
      setQuoteTargetPlanName(selectedPlan.name);
      saveSubscriptionUpgradeQuoteIntent({
        quote: result,
        targetPlanName: selectedPlan.name,
      });
      setStep("quote");
    } catch (err) {
      quoteIntentRef.current = null;
      await handleUpgradeError(err, t("packages.quoteFailed"));
    } finally {
      inFlightRef.current = false;
      setIsQuoting(false);
    }
  }

  async function confirmPayment() {
    if (!quote || inFlightRef.current) return;

    inFlightRef.current = true;
    setIsPaying(true);
    setError("");

    try {
      // Key MỚI mỗi lần bấm. Dùng lại key đã nhận 402 sẽ được replay đúng
      // response 402 cũ trong 24 giờ — nạp tiền xong confirm lại vẫn hỏng.
      const result = await confirmSubscriptionUpgradePayment(
        quote.upgradeAttemptId,
        crypto.randomUUID(),
      );

      if (!result.paymentRedirectUrl) {
        setError(t("packages.missingPaymentRedirect"));
        return;
      }

      saveSubscriptionPaymentIntent({
        paymentId: result.paymentId ?? "",
        upgradeAttemptId: quote.upgradeAttemptId,
        targetPlanId: quote.targetPlanId,
        targetPlanName: selectedPlan?.name ?? "",
      });
      clearSubscriptionUpgradeQuoteIntent();
      setQuoteTargetPlanName("");
      window.location.assign(result.paymentRedirectUrl);
    } catch (err) {
      await handleUpgradeError(err, t("packages.paymentFailed"));
    } finally {
      inFlightRef.current = false;
      setIsPaying(false);
    }
  }

  // Ánh xạ mã lỗi → hành vi UI (bảng §7 của FE-RESPONSE). Bốn mã về báo giá
  // quy về cùng một xử lý, chỉ khác câu thông báo.
  // Mọi nhánh ở đây đều là lỗi nên đi vào `error`.
  async function handleUpgradeError(err: unknown, fallback: string) {
    const code = errorCodeOf(err);
    const localized = t(`packages.upgradeError.${code}`, {
      defaultValue: messageOf(err, fallback),
    });

    // Báo giá không còn tin được → về bước chọn, lỗi hiện NGAY TRONG modal
    // (chỗ người dùng đang nhìn) thay vì một toast dễ trôi qua
    if (staleQuoteCodes.has(code)) {
      discardQuote();
      await onSubscriptionChanged();
      setError(localized);
      return;
    }

    // BE hiện không trả attempt INITIATED trong GET subscription. Giữ modal
    // và lỗi tại chỗ để người dùng không chỉ thấy một toast rồi mất ngữ cảnh.
    if (code === "SUBSCRIPTION_UPGRADE_ALREADY_ACTIVE") {
      await onSubscriptionChanged();
      setError(localized);
      return;
    }

    // State server đã đổi → đóng modal, lỗi nổi lên thành toast đỏ của trang
    if (reloadAndCloseCodes.has(code)) {
      close();
      await onSubscriptionChanged();
      setError(localized);
      return;
    }

    if (
      code === "SUBSCRIPTION_UPGRADE_TARGET_LIMIT_BELOW_USAGE" ||
      code === "SUBSCRIPTION_UPGRADE_BILLING_PERIOD_MISMATCH"
    ) {
      discardQuote();
      setError(localized);
      return;
    }

    setError(messageOf(err, fallback));
  }

  return {
    isOpen,
    step,
    selectedPlan,
    billingPeriod,
    quote,
    quoteTargetPlanName,
    isQuoting,
    isPaying,
    error,
    // Nâng cấp giữa chu kỳ: kỳ bị khoá theo subscription hiện tại
    isBillingPeriodLocked: lockedBillingPeriod !== null,
    open,
    close,
    reopenQuote,
    restoreSavedQuotePlan,
    setBillingPeriod,
    discardQuote,
    expireQuote,
    requestQuote,
    confirmPayment,
    clearFeedback: () => {
      setError("");
    },
  };
}

export type UseSubscriptionUpgradeResult = ReturnType<
  typeof useSubscriptionUpgrade
>;
