import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiArrowLeft,
  FiCheck,
  FiClock,
  FiLoader,
  FiRefreshCw,
  FiShield,
  FiX,
} from "react-icons/fi";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "../../../assets/Login/logo.svg";
import {
  getOperatorSubscription,
  getVnPayReturnStatus,
  type OperatorSubscriptionDetail,
  type VnPayReturnStatus,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import { getAuthUser } from "../../../auth";
import LanguageSwitcher from "../../../components/LanguageSwitcher";
import {
  clearSubscriptionPaymentIntent,
  getSubscriptionPaymentIntent,
} from "./subscriptionPaymentIntent";

type PaymentReturnStatus =
  | "verifying"
  | "success"
  | "processing"
  | "failed"
  | "cancelled"
  | "invalid"
  | "notFound"
  | "error";

const MAX_VERIFICATION_ATTEMPTS = 30;
const VERIFICATION_INTERVAL_MS = 2_000;
const SUCCESS_REDIRECT_DELAY_SECONDS = 5;

// PaymentStatus của Backend (Payment.Domain.Enums.PaymentStatus). Khi không có
// phiên đăng nhập thì đây là nguồn kết luận duy nhất — nó vẫn do IPN cập nhật,
// FE không tự suy ra từ URL.
const PAYMENT_SUCCESS_STATUSES = new Set(["SUCCEEDED"]);
const PAYMENT_FAILURE_STATUSES = new Set(["FAILED", "EXPIRED"]);

export default function SubscriptionPaymentReturn() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const location = useLocation();
  const navigate = useNavigate();
  // rawQuery giữ nguyên chuỗi gốc để gửi lên Backend; `query` chỉ dùng để
  // HIỂN THỊ vài field cho người dùng, không dùng để kết luận trạng thái.
  const rawQuery = location.search;
  const query = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const responseCode = query.get("vnp_ResponseCode");
  const vnpTransactionReference =
    query.get("vnp_TransactionNo") ?? query.get("vnp_TxnRef");
  const paymentIntent = useMemo(() => getSubscriptionPaymentIntent(), []);
  // Chỉ dùng responseCode để quyết định CÓ CẦN xác minh hay không. Kết luận
  // "thành công" luôn phải đến từ Backend (handoff §1: không đánh dấu thành
  // công chỉ dựa vào URL return).
  const [status, setStatus] = useState<PaymentReturnStatus>(() =>
    responseCode ? "verifying" : "invalid",
  );
  const [returnStatus, setReturnStatus] = useState<VnPayReturnStatus | null>(
    null,
  );
  const [subscription, setSubscription] =
    useState<OperatorSubscriptionDetail | null>(null);
  const [error, setError] = useState("");
  // Phiên đăng nhập có thể đã mất trong lúc người dùng ở cổng VNPay (hết hạn,
  // mở từ app ngân hàng, refresh token bị revoke). Trang vẫn phải kết luận được
  // giao dịch, chỉ là không tra thêm được trạng thái gói.
  const [signedOut, setSignedOut] = useState(() => getAuthUser() === null);
  const [redirectSeconds, setRedirectSeconds] = useState(
    SUCCESS_REDIRECT_DELAY_SECONDS,
  );
  const verificationRunRef = useRef(0);

  const verifyPayment = useCallback(async () => {
    const runId = verificationRunRef.current + 1;
    verificationRunRef.current = runId;
    await Promise.resolve();
    if (verificationRunRef.current !== runId) return;

    setStatus("verifying");
    setError("");

    if (import.meta.env.DEV) {
      console.info("[SubscriptionPayment] RETURN_VERIFICATION_START", {
        responseCode,
        transactionReference: vnpTransactionReference,
        paymentId: paymentIntent?.paymentId ?? null,
        upgradeAttemptId: paymentIntent?.upgradeAttemptId ?? null,
        targetPlanId: paymentIntent?.targetPlanId ?? null,
      });
    }

    // Bước 1: đẩy NGUYÊN query VNPay lên Backend để nó xác thực chữ ký và cho
    // biết giao dịch nào đang được nói tới (handoff §2.2). FE không tự tin
    // vnp_ResponseCode trong URL.
    let latestPaymentStatus: string | null = null;
    try {
      const verified = await getVnPayReturnStatus(rawQuery);
      if (verificationRunRef.current !== runId) return;
      setReturnStatus(verified);
      latestPaymentStatus = verified.status;
    } catch (err) {
      if (verificationRunRef.current !== runId) return;

      const code = err instanceof ApiRequestError ? err.code : undefined;
      if (code === "PAYMENT_SIGNATURE_INVALID") {
        clearSubscriptionPaymentIntent();
        setStatus("invalid");
        return;
      }
      if (code === "PAYMENT_NOT_FOUND") {
        clearSubscriptionPaymentIntent();
        setStatus("notFound");
        return;
      }
      if (code === "PAYMENT_AMOUNT_INVALID") {
        clearSubscriptionPaymentIntent();
        setStatus("invalid");
        return;
      }
      if (code === "VNPAY_WEB_DISABLED") {
        setError(err instanceof Error ? err.message : "");
        setStatus("error");
        return;
      }
      // Lỗi khác (mạng/5xx): vẫn xác minh tiếp bằng trạng thái subscription
      if (import.meta.env.DEV) {
        console.warn("[SubscriptionPayment] RETURN_STATUS_LOOKUP_FAILED", {
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // VNPay báo giao dịch KHÔNG thành công thì kết luận ngay — đây là chiều
    // an toàn (không tự nhận thành công), khỏi bắt người dùng chờ hết vòng poll.
    if (responseCode !== "00") {
      clearSubscriptionPaymentIntent();
      setStatus(responseCode === "24" ? "cancelled" : "failed");
      return;
    }

    // responseCode = 00 vẫn CHƯA phải thành công: chỉ khi IPN về và backend đổi
    // trạng thái thì mới được báo thành công (handoff §2.2).
    //
    // Còn phiên đăng nhập → đối chiếu trạng thái subscription (chắc chắn nhất,
    // vì gói đã kích hoạt là bằng chứng cuối cùng). Mất phiên → poll
    // `vnpay-return-status` (endpoint public, cũng chỉ do IPN cập nhật) để vẫn
    // kết luận được thay vì bắt người dùng đăng nhập lại giữa chừng.
    let hasSession = getAuthUser() !== null;
    setSignedOut(!hasSession);
    let lastResultStatus: string | null = null;
    for (let attempt = 1; attempt <= MAX_VERIFICATION_ATTEMPTS; attempt += 1) {
      if (hasSession) {
        try {
          const result = await getOperatorSubscription();
          if (verificationRunRef.current !== runId) return;

          setSubscription(result);
          lastResultStatus = result.status;
          if (import.meta.env.DEV) {
            console.info("[SubscriptionPayment] RETURN_VERIFICATION_RESULT", {
              attempt,
              status: result.status,
              activePlanId: result.plan.planId,
              upgradeAttemptId:
                result.pendingUpgrade?.upgradeAttemptId ?? null,
              paymentId:
                result.pendingUpgrade?.latestPayment?.paymentId ?? null,
              paymentStatus:
                result.pendingUpgrade?.latestPayment?.status ?? null,
            });
          }
          const targetPlanWasActivated =
            !paymentIntent?.targetPlanId ||
            result.plan.planId === paymentIntent.targetPlanId;
          if (
            result.status === "ACTIVE" &&
            !result.pendingUpgrade &&
            targetPlanWasActivated
          ) {
            clearSubscriptionPaymentIntent();
            setStatus("success");
            if (import.meta.env.DEV) {
              console.info("[SubscriptionPayment] RETURN_VERIFIED", {
                attempt,
                activePlanId: result.plan.planId,
              });
            }
            return;
          }
        } catch (err) {
          if (verificationRunRef.current !== runId) return;

          // Phiên hết hạn ngay lúc quay về: KHÔNG báo lỗi và cũng không đá ra
          // /login — chuyển sang xác minh bằng endpoint public để người dùng
          // vẫn thấy kết quả giao dịch vừa trả tiền.
          if (err instanceof ApiRequestError && err.status === 401) {
            hasSession = false;
            setSignedOut(true);
            if (import.meta.env.DEV) {
              console.warn("[SubscriptionPayment] RETURN_SESSION_EXPIRED", {
                attempt,
              });
            }
          } else {
            if (import.meta.env.DEV) {
              console.error("[SubscriptionPayment] RETURN_VERIFICATION_FAILED", {
                attempt,
                message: err instanceof Error ? err.message : String(err),
              });
            }
            setError(
              err instanceof Error ? err.message : t("packages.loadFailed"),
            );
            setStatus("error");
            return;
          }
        }
      }

      if (!hasSession) {
        if (latestPaymentStatus && PAYMENT_SUCCESS_STATUSES.has(latestPaymentStatus)) {
          clearSubscriptionPaymentIntent();
          setStatus("success");
          return;
        }
        if (latestPaymentStatus && PAYMENT_FAILURE_STATUSES.has(latestPaymentStatus)) {
          clearSubscriptionPaymentIntent();
          setStatus("failed");
          return;
        }
        lastResultStatus = latestPaymentStatus;
      }

      if (attempt < MAX_VERIFICATION_ATTEMPTS) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, VERIFICATION_INTERVAL_MS);
        });
        if (verificationRunRef.current !== runId) return;

        if (!hasSession) {
          try {
            const refreshed = await getVnPayReturnStatus(rawQuery);
            if (verificationRunRef.current !== runId) return;
            setReturnStatus(refreshed);
            latestPaymentStatus = refreshed.status;
          } catch {
            // Lỗi tạm thời khi poll lại: giữ nguyên kết quả lần trước và thử tiếp.
          }
        }
      }
    }

    if (verificationRunRef.current === runId) {
      setStatus("processing");
      if (import.meta.env.DEV) {
        console.warn("[SubscriptionPayment] RETURN_STILL_PENDING", {
          attempts: MAX_VERIFICATION_ATTEMPTS,
          status: lastResultStatus,
          paymentId: paymentIntent?.paymentId ?? null,
          upgradeAttemptId: paymentIntent?.upgradeAttemptId ?? null,
        });
      }
    }
  }, [
    paymentIntent?.paymentId,
    paymentIntent?.targetPlanId,
    paymentIntent?.upgradeAttemptId,
    rawQuery,
    responseCode,
    t,
    vnpTransactionReference,
  ]);

  useEffect(() => {
    verificationRunRef.current += 1;
    // Không có query VNPay thì không có gì để xác minh.
    if (!responseCode) return;

    const verificationTimer = window.setTimeout(() => {
      void verifyPayment();
    }, 0);
    return () => {
      window.clearTimeout(verificationTimer);
      verificationRunRef.current += 1;
    };
  }, [responseCode, verifyPayment]);

  useEffect(() => {
    // Mất phiên thì không tự chuyển trang: /manager/packages sẽ lại đá ra
    // /login và người dùng mất luôn kết quả vừa xem.
    if (status !== "success" || signedOut) return;

    const countdownTimer = window.setInterval(() => {
      setRedirectSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1_000);
    const redirectTimer = window.setTimeout(() => {
      navigate("/manager/packages", { replace: true });
    }, SUCCESS_REDIRECT_DELAY_SECONDS * 1_000);

    return () => {
      window.clearInterval(countdownTimer);
      window.clearTimeout(redirectTimer);
    };
  }, [navigate, signedOut, status]);

  let title = t("paymentReturn.verifyingTitle");
  let description = t("paymentReturn.verifyingDescription");
  let icon = <FiLoader className="h-8 w-8 animate-spin" aria-hidden="true" />;
  let iconClassName = "bg-vr-100 text-vr-700";

  if (status === "success") {
    title = t("paymentReturn.successTitle");
    description = t("paymentReturn.successDescription", {
      name: subscription?.plan.name ?? paymentIntent?.targetPlanName ?? "",
    });
    icon = <FiCheck className="h-8 w-8" aria-hidden="true" />;
    iconClassName = "bg-emerald-100 text-emerald-700";
  } else if (status === "processing") {
    title = t("paymentReturn.processingTitle");
    description = t("paymentReturn.processingDescription");
    icon = <FiClock className="h-8 w-8" aria-hidden="true" />;
    iconClassName = "bg-amber-100 text-amber-700";
  } else if (status === "cancelled") {
    title = t("paymentReturn.cancelledTitle");
    description = t("paymentReturn.cancelledDescription");
    icon = <FiX className="h-8 w-8" aria-hidden="true" />;
    iconClassName = "bg-gray-100 text-gray-600";
  } else if (status === "failed") {
    title = t("paymentReturn.failedTitle");
    description = t("paymentReturn.failedDescription", {
      code: responseCode ?? "-",
    });
    icon = <FiX className="h-8 w-8" aria-hidden="true" />;
    iconClassName = "bg-red-100 text-red-700";
  } else if (status === "invalid") {
    title = t("paymentReturn.invalidTitle");
    description = t("paymentReturn.invalidDescription");
    icon = <FiX className="h-8 w-8" aria-hidden="true" />;
    iconClassName = "bg-red-100 text-red-700";
  } else if (status === "notFound") {
    title = t("paymentReturn.notFoundTitle");
    description = t("paymentReturn.notFoundDescription");
    icon = <FiX className="h-8 w-8" aria-hidden="true" />;
    iconClassName = "bg-red-100 text-red-700";
  } else if (status === "error") {
    title = t("paymentReturn.errorTitle");
    description = t("paymentReturn.errorDescription");
    icon = <FiX className="h-8 w-8" aria-hidden="true" />;
    iconClassName = "bg-red-100 text-red-700";
  }

  // Ưu tiên mã giao dịch Backend xác thực được; chỉ rơi về giá trị đọc từ URL
  // khi chưa gọi được status API.
  const transactionReference =
    returnStatus?.vnPayTxnRef ?? vnpTransactionReference;
  // Mất phiên thì không đọc được subscription, nhưng tên gói vừa chọn vẫn còn
  // trong payment intent nên vẫn hiển thị được ngữ cảnh.
  const planName = subscription?.plan.name ?? paymentIntent?.targetPlanName ?? "";
  const canRetry = status === "processing" || status === "error";

  useToastFeedback({ error });
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-vr-500 px-4 py-10 sm:px-6 sm:py-12">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <section className="w-full max-w-xl rounded-[1.75rem] bg-slate-50 px-7 py-9 text-center shadow-xl sm:px-12 sm:py-12">
        <img
          src={logo}
          alt={tc("brand")}
          className="mx-auto h-20 w-20 object-contain"
        />
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-vr-700">
          {t("paymentReturn.pageTitle")}
        </p>

        <div
          className={`mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-full ${iconClassName}`}
        >
          {icon}
        </div>

        <div aria-live="polite">
          <h1 className="mt-5 text-3xl font-bold text-slate-900 sm:text-4xl">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>

        {status === "success" && !signedOut ? (
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-vr-200 bg-vr-50 px-3.5 py-1.5 text-xs font-semibold text-vr-800">
            <FiClock className="h-4 w-4" aria-hidden="true" />
            {t("paymentReturn.redirectingToPackages", {
              seconds: redirectSeconds,
            })}
          </p>
        ) : null}

        {signedOut && status !== "verifying" ? (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm leading-6 text-amber-900">
            {t("paymentReturn.signedOutNote")}
          </p>
        ) : null}

        {transactionReference || responseCode || planName ? (
          <dl className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white text-left text-sm">
            {transactionReference ? (
              <DetailRow
                label={t("paymentReturn.transactionReference")}
                value={transactionReference}
                monospace
              />
            ) : null}
            {responseCode ? (
              <DetailRow
                label={t("paymentReturn.responseCode")}
                value={responseCode}
                monospace
              />
            ) : null}
            {planName ? (
              <DetailRow label={t("paymentReturn.currentPlan")} value={planName} />
            ) : null}
          </dl>
        ) : null}

        <div className="mt-7 flex items-start gap-3 rounded-xl border border-vr-200 bg-vr-50 p-4 text-left text-sm leading-6 text-slate-600">
          <FiShield
            className="mt-0.5 h-5 w-5 shrink-0 text-vr-700"
            aria-hidden="true"
          />
          <span>{t("paymentReturn.securityNote")}</span>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
          {canRetry ? (
            <button
              type="button"
              onClick={() => void verifyPayment()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vr-500/40"
            >
              <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
              {t("paymentReturn.retry")}
            </button>
          ) : null}
          <Link
            to={signedOut ? "/login" : "/manager/packages"}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-vr-500 px-5 py-3.5 font-semibold text-white transition hover:bg-vr-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vr-500/40"
          >
            <FiArrowLeft className="h-5 w-5" aria-hidden="true" />
            {signedOut
              ? t("paymentReturn.signInToContinue")
              : t("paymentReturn.backToPackages")}
          </Link>
        </div>
      </section>
    </main>
  );
}

/**
 * Một dòng chi tiết giao dịch. Giá trị dài (mã giao dịch là UUID 36 ký tự) phải
 * nằm trên MỘT dòng — xuống hàng giữa chuỗi mã khiến người dùng đọc/copy sai —
 * nên cho cuộn ngang trong ô thay vì wrap.
 */
function DetailRow({
  label,
  value,
  monospace = false,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-1 border-b border-slate-100 px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd
        className={`w-full min-w-0 overflow-x-auto whitespace-nowrap font-semibold text-slate-900 sm:w-auto sm:text-right ${
          monospace ? "font-mono text-xs" : ""
        }`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
