// Hook cục bộ màn Packages: toàn bộ state của luồng nâng cấp hai bước
// (báo giá → thanh toán) theo FE-RESPONSE 2026-08-21.
//
// Vì sao hai bước: `billingPeriod` và `paymentMethod` là THAM SỐ của quote, nên
// đổi một trong hai làm báo giá cũ vô nghĩa — người dùng phải chọn xong mới báo
// giá, và đổi lại thì phải quote lần nữa. Hook tự huỷ quote khi lựa chọn đổi.
import { useCallback, useRef, useState } from "react";
import { ApiRequestError } from "../../../api/client";
import {
  confirmSubscriptionUpgradePayment,
  createSubscriptionUpgradeQuote,
  getOperatorWallet,
  type SubscriptionBillingPeriod,
  type SubscriptionPaymentMethod,
  type SubscriptionPlan,
  type SubscriptionUpgradeQuote,
} from "../../../api/vietride";
import { saveSubscriptionPaymentIntent } from "./subscriptionPaymentIntent";

// Chữ ký hàm dịch tối thiểu hook cần — nhận từ useTranslation("manager") ở index
type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

// "select" = đang chọn kỳ + phương thức; "quote" = đã có báo giá, chờ trả tiền
export type UpgradeStep = "select" | "quote";

type UseSubscriptionUpgradeParams = {
  // Kỳ của subscription hiện tại — nâng cấp giữa chu kỳ phải giữ nguyên kỳ này
  // (chặn trước 422 SUBSCRIPTION_UPGRADE_BILLING_PERIOD_MISMATCH)
  lockedBillingPeriod: SubscriptionBillingPeriod | null;
  // Gọi lại sau khi ví trừ xong / khi lỗi cho biết state server đã đổi
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
  "SUBSCRIPTION_UPGRADE_ALREADY_ACTIVE",
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
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<UpgradeStep>("select");
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(
    null,
  );
  const [billingPeriod, setBillingPeriodState] =
    useState<SubscriptionBillingPeriod>("MONTHLY");
  const [paymentMethod, setPaymentMethodState] =
    useState<SubscriptionPaymentMethod>("WALLET");
  const [quote, setQuote] = useState<SubscriptionUpgradeQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  // Ví không đủ tiền (402): số còn thiếu để hiện panel nạp tiền. null = chưa dính.
  const [walletShortfall, setWalletShortfall] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const inFlightRef = useRef(false);
  // Key của lượt quote hiện tại: giữ ổn định theo bộ chọn để bấm "Xem báo giá"
  // nhiều lần không đẻ ra nhiều upgrade attempt.
  const quoteIntentRef = useRef<{ signature: string; key: string } | null>(
    null,
  );

  const loadWalletBalance = useCallback(async () => {
    try {
      const wallet = await getOperatorWallet();
      setWalletBalance(wallet.balance);
      return wallet.balance;
    } catch {
      // Không đọc được số dư thì chỉ mất phần hiển thị — vẫn cho thanh toán,
      // BE là nơi chốt đủ hay thiếu tiền.
      setWalletBalance(null);
      return null;
    }
  }, []);

  const open = useCallback(
    (plan: SubscriptionPlan, defaultPeriod: SubscriptionBillingPeriod) => {
      setSelectedPlan(plan);
      setBillingPeriodState(lockedBillingPeriod ?? defaultPeriod);
      setPaymentMethodState("WALLET");
      setQuote(null);
      setStep("select");
      setWalletShortfall(null);
      setError("");
      setNotice("");
      quoteIntentRef.current = null;
      setIsOpen(true);
      void loadWalletBalance();
    },
    [loadWalletBalance, lockedBillingPeriod],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setQuote(null);
    setWalletShortfall(null);
    quoteIntentRef.current = null;
  }, []);

  // Đổi lựa chọn = báo giá cũ hết nghĩa. Huỷ luôn thay vì để người dùng trả tiền
  // theo một báo giá không khớp với thứ họ vừa chọn.
  const discardQuote = useCallback(() => {
    setQuote(null);
    setWalletShortfall(null);
    setStep("select");
    quoteIntentRef.current = null;
  }, []);

  const setBillingPeriod = useCallback(
    (period: SubscriptionBillingPeriod) => {
      setBillingPeriodState(period);
      discardQuote();
    },
    [discardQuote],
  );

  const setPaymentMethod = useCallback(
    (method: SubscriptionPaymentMethod) => {
      setPaymentMethodState(method);
      discardQuote();
    },
    [discardQuote],
  );

  // Hết hạn `dueAt` khi modal đang mở — khối tiền xám hoá, nút đổi thành "báo
  // giá lại". KHÔNG tự gọi lại API: tab có thể đã bị bỏ đó cả buổi.
  const expireQuote = useCallback(() => {
    setQuote(null);
    setWalletShortfall(null);
    setStep("select");
    quoteIntentRef.current = null;
    setError(t("packages.quoteExpiredHint"));
  }, [t]);

  async function requestQuote() {
    if (!selectedPlan || inFlightRef.current) return;

    const request = {
      planId: selectedPlan.planId,
      billingPeriod,
      paymentMethod,
    };
    const signature = JSON.stringify(request);
    if (quoteIntentRef.current?.signature !== signature) {
      quoteIntentRef.current = { signature, key: crypto.randomUUID() };
    }

    inFlightRef.current = true;
    setIsQuoting(true);
    setError("");
    setNotice("");

    try {
      const result = await createSubscriptionUpgradeQuote(
        request,
        quoteIntentRef.current.key,
      );
      setQuote(result);
      setStep("quote");
      setWalletShortfall(null);
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
    setNotice("");

    try {
      // Key MỚI mỗi lần bấm. Dùng lại key đã nhận 402 sẽ được replay đúng
      // response 402 cũ trong 24 giờ — nạp tiền xong confirm lại vẫn hỏng.
      const result = await confirmSubscriptionUpgradePayment(
        quote.upgradeAttemptId,
        crypto.randomUUID(),
      );

      // apiRequest không lộ HTTP status: có redirect url = VNPAY (202),
      // không có = ví đã trừ xong (200).
      if (result.paymentRedirectUrl) {
        saveSubscriptionPaymentIntent({
          paymentId: result.paymentId ?? "",
          upgradeAttemptId: quote.upgradeAttemptId,
          targetPlanId: quote.targetPlanId,
          targetPlanName: selectedPlan?.name ?? "",
        });
        window.location.assign(result.paymentRedirectUrl);
        return;
      }

      await onSubscriptionChanged();
      close();
      setNotice(t("packages.walletPaymentSuccess"));
    } catch (err) {
      if (errorCodeOf(err) === "WALLET_INSUFFICIENT_BALANCE") {
        // Chưa trừ đồng nào, báo giá vẫn còn hiệu lực → giữ nguyên attempt và
        // đồng hồ, chỉ chuyển sang panel thiếu tiền.
        const balance = await loadWalletBalance();
        setWalletShortfall(Math.max(0, quote.amountDue - (balance ?? 0)));
        setError("");
        return;
      }

      await handleUpgradeError(err, t("packages.paymentFailed"));
    } finally {
      inFlightRef.current = false;
      setIsPaying(false);
    }
  }

  // Ánh xạ mã lỗi → hành vi UI (bảng §7 của FE-RESPONSE). Bốn mã về báo giá
  // quy về cùng một xử lý, chỉ khác câu thông báo.
  // MỌI nhánh ở đây đều là LỖI nên đi vào `error`, không phải `notice`.
  // `notice` chỉ dành cho tin tốt (ví trừ xong) — đẩy lỗi vào đó thì trang hiện
  // toast dấu tích xanh cho một thông báo hỏng việc.
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
    paymentMethod,
    quote,
    isQuoting,
    isPaying,
    walletBalance,
    walletShortfall,
    error,
    notice,
    // Nâng cấp giữa chu kỳ: kỳ bị khoá theo subscription hiện tại
    isBillingPeriodLocked: lockedBillingPeriod !== null,
    open,
    close,
    setBillingPeriod,
    setPaymentMethod,
    discardQuote,
    expireQuote,
    requestQuote,
    confirmPayment,
    clearFeedback: () => {
      setError("");
      setNotice("");
    },
  };
}

export type UseSubscriptionUpgradeResult = ReturnType<
  typeof useSubscriptionUpgrade
>;
