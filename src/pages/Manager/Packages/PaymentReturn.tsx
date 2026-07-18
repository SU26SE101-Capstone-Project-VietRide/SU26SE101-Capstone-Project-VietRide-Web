import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiArrowRight,
  FiCheck,
  FiClock,
  FiLoader,
  FiRefreshCw,
  FiX,
} from "react-icons/fi";
import { Link, useLocation } from "react-router-dom";
import logo from "../../../assets/Login/logo.svg";
import { getOperatorSubscription, type OperatorSubscriptionDetail } from "../../../api/vietride";
import LanguageSwitcher from "../../../components/LanguageSwitcher";

type PaymentReturnStatus =
  | "verifying"
  | "success"
  | "processing"
  | "failed"
  | "cancelled"
  | "invalid"
  | "error";

const MAX_VERIFICATION_ATTEMPTS = 10;
const VERIFICATION_INTERVAL_MS = 2_000;

export default function SubscriptionPaymentReturn() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const location = useLocation();
  const query = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const responseCode = query.get("vnp_ResponseCode");
  const transactionReference =
    query.get("vnp_TransactionNo") ?? query.get("vnp_TxnRef");
  const [status, setStatus] = useState<PaymentReturnStatus>(() => {
    if (!responseCode) return "invalid";
    if (responseCode === "24") return "cancelled";
    if (responseCode !== "00") return "failed";
    return "verifying";
  });
  const [subscription, setSubscription] =
    useState<OperatorSubscriptionDetail | null>(null);
  const [error, setError] = useState("");
  const verificationRunRef = useRef(0);

  const verifyPayment = useCallback(async () => {
    const runId = verificationRunRef.current + 1;
    verificationRunRef.current = runId;
    await Promise.resolve();
    if (verificationRunRef.current !== runId) return;

    setStatus("verifying");
    setError("");

    for (let attempt = 1; attempt <= MAX_VERIFICATION_ATTEMPTS; attempt += 1) {
      try {
        const result = await getOperatorSubscription();
        if (verificationRunRef.current !== runId) return;

        setSubscription(result);
        if (result.status === "ACTIVE" && !result.pendingUpgrade) {
          setStatus("success");
          return;
        }
      } catch (err) {
        if (verificationRunRef.current !== runId) return;
        setError(err instanceof Error ? err.message : t("packages.loadFailed"));
        setStatus("error");
        return;
      }

      if (attempt < MAX_VERIFICATION_ATTEMPTS) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, VERIFICATION_INTERVAL_MS);
        });
      }
    }

    if (verificationRunRef.current === runId) {
      setStatus("processing");
    }
  }, [t]);

  useEffect(() => {
    verificationRunRef.current += 1;
    if (responseCode !== "00") return;

    const verificationTimer = window.setTimeout(() => {
      void verifyPayment();
    }, 0);
    return () => {
      window.clearTimeout(verificationTimer);
      verificationRunRef.current += 1;
    };
  }, [responseCode, verifyPayment]);

  let title = t("paymentReturn.verifyingTitle");
  let description = t("paymentReturn.verifyingDescription");
  let icon = <FiLoader className="h-9 w-9 animate-spin" aria-hidden="true" />;
  let iconClassName = "bg-vr-100 text-vr-700";

  if (status === "success") {
    title = t("paymentReturn.successTitle");
    description = t("paymentReturn.successDescription", {
      name: subscription?.plan.name ?? "",
    });
    icon = <FiCheck className="h-9 w-9" aria-hidden="true" />;
    iconClassName = "bg-emerald-100 text-emerald-700";
  } else if (status === "processing") {
    title = t("paymentReturn.processingTitle");
    description = t("paymentReturn.processingDescription");
    icon = <FiClock className="h-9 w-9" aria-hidden="true" />;
    iconClassName = "bg-amber-100 text-amber-700";
  } else if (status === "cancelled") {
    title = t("paymentReturn.cancelledTitle");
    description = t("paymentReturn.cancelledDescription");
    icon = <FiX className="h-9 w-9" aria-hidden="true" />;
    iconClassName = "bg-gray-100 text-gray-600";
  } else if (status === "failed") {
    title = t("paymentReturn.failedTitle");
    description = t("paymentReturn.failedDescription", {
      code: responseCode ?? "-",
    });
    icon = <FiX className="h-9 w-9" aria-hidden="true" />;
    iconClassName = "bg-red-100 text-red-700";
  } else if (status === "invalid") {
    title = t("paymentReturn.invalidTitle");
    description = t("paymentReturn.invalidDescription");
    icon = <FiX className="h-9 w-9" aria-hidden="true" />;
    iconClassName = "bg-red-100 text-red-700";
  } else if (status === "error") {
    title = t("paymentReturn.errorTitle");
    description = t("paymentReturn.errorDescription");
    icon = <FiX className="h-9 w-9" aria-hidden="true" />;
    iconClassName = "bg-red-100 text-red-700";
  }

  const canRetry = status === "processing" || status === "error";

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 sm:px-6">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <section className="w-full max-w-2xl overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-gray-200 px-6 py-4">
          <img
            src={logo}
            alt={tc("brand")}
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
          />
          <div>
            <p className="text-sm font-medium text-vr-700">VNPay</p>
            <h1 className="text-xl font-bold text-gray-900">
              {t("paymentReturn.pageTitle")}
            </h1>
          </div>
        </header>

        <div className="px-6 py-8 text-center sm:px-10">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${iconClassName}`}
          >
            {icon}
          </div>

          <div className="mt-5" aria-live="polite">
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-600">
              {description}
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-5 border-y border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}

          {responseCode || transactionReference || subscription?.plan.name ? (
            <dl className="mt-7 divide-y divide-gray-100 border-y border-gray-200 text-left text-sm">
              {transactionReference ? (
                <div className="grid gap-1 py-3 sm:grid-cols-2 sm:gap-4">
                  <dt className="text-gray-500">
                    {t("paymentReturn.transactionReference")}
                  </dt>
                  <dd className="break-all font-semibold text-gray-900 sm:text-right">
                    {transactionReference}
                  </dd>
                </div>
              ) : null}
              {responseCode ? (
                <div className="grid gap-1 py-3 sm:grid-cols-2 sm:gap-4">
                  <dt className="text-gray-500">
                    {t("paymentReturn.responseCode")}
                  </dt>
                  <dd className="font-semibold text-gray-900 sm:text-right">
                    {responseCode}
                  </dd>
                </div>
              ) : null}
              {subscription?.plan.name ? (
                <div className="grid gap-1 py-3 sm:grid-cols-2 sm:gap-4">
                  <dt className="text-gray-500">
                    {t("paymentReturn.currentPlan")}
                  </dt>
                  <dd className="font-semibold text-gray-900 sm:text-right">
                    {subscription.plan.name}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
            {canRetry ? (
              <button
                type="button"
                onClick={() => void verifyPayment()}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                <FiRefreshCw aria-hidden="true" />
                {t("paymentReturn.retry")}
              </button>
            ) : null}
            <Link
              to="/manager/packages"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-vr-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-vr-600"
            >
              {t("paymentReturn.backToPackages")}
              <FiArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
