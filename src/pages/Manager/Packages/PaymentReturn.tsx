import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiArrowLeft,
  FiCheck,
  FiClock,
  FiCreditCard,
  FiLoader,
  FiRefreshCw,
  FiShield,
  FiX,
} from "react-icons/fi";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "../../../assets/Login/logo.svg";
import { getOperatorSubscription, type OperatorSubscriptionDetail } from "../../../api/vietride";
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
  | "error";

const MAX_VERIFICATION_ATTEMPTS = 30;
const VERIFICATION_INTERVAL_MS = 2_000;
const SUCCESS_REDIRECT_DELAY_SECONDS = 5;

export default function SubscriptionPaymentReturn() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const location = useLocation();
  const navigate = useNavigate();
  const query = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const responseCode = query.get("vnp_ResponseCode");
  const transactionReference =
    query.get("vnp_TransactionNo") ?? query.get("vnp_TxnRef");
  const paymentIntent = useMemo(() => getSubscriptionPaymentIntent(), []);
  const [status, setStatus] = useState<PaymentReturnStatus>(() => {
    if (!responseCode) return "invalid";
    if (responseCode === "24") return "cancelled";
    if (responseCode !== "00") return "failed";
    return "verifying";
  });
  const [subscription, setSubscription] =
    useState<OperatorSubscriptionDetail | null>(null);
  const [error, setError] = useState("");
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
        transactionReference,
        paymentId: paymentIntent?.paymentId ?? null,
        upgradeAttemptId: paymentIntent?.upgradeAttemptId ?? null,
        targetPlanId: paymentIntent?.targetPlanId ?? null,
      });
    }

    let lastResultStatus: string | null = null;
    for (let attempt = 1; attempt <= MAX_VERIFICATION_ATTEMPTS; attempt += 1) {
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
        if (import.meta.env.DEV) {
          console.error("[SubscriptionPayment] RETURN_VERIFICATION_FAILED", {
            attempt,
            message: err instanceof Error ? err.message : String(err),
          });
        }
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
    responseCode,
    t,
    transactionReference,
  ]);

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

  useEffect(() => {
    if (responseCode && responseCode !== "00") {
      clearSubscriptionPaymentIntent();
    }
  }, [responseCode]);

  useEffect(() => {
    if (status !== "success") return;

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
  }, [navigate, status]);

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

  useToastFeedback({ error });
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-5 sm:px-6 sm:py-8">
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-vr-500/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-48 -right-32 h-[30rem] w-[30rem] rounded-full bg-cyan-400/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col sm:min-h-[calc(100vh-4rem)]">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/15">
              <img
                src={logo}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
              />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">{tc("brand")}</p>
              <p className="text-xs text-slate-400">VNPay</p>
            </div>
          </div>
          <LanguageSwitcher compact />
        </header>

        <div className="flex flex-1 items-center justify-center py-8 sm:py-12">
          <section className="grid w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl shadow-black/30 md:grid-cols-[0.82fr_1.18fr]">
            <header className="relative overflow-hidden bg-gradient-to-br from-vr-900 via-vr-800 to-slate-900 px-7 py-8 text-white sm:px-10 sm:py-11 md:min-h-[34rem]">
              <div
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full border-[44px] border-white/5"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-vr-400/10 blur-2xl"
                aria-hidden="true"
              />

              <div className="relative flex h-full flex-col">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner">
                  <FiCreditCard className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-vr-200">
                  VNPay
                </p>
                <h1 className="mt-3 max-w-sm text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                  {t("paymentReturn.pageTitle")}
                </h1>

                <div className="mt-8 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-sm leading-6 text-slate-200 md:mt-auto">
                  <FiShield
                    className="mt-0.5 h-5 w-5 shrink-0 text-vr-200"
                    aria-hidden="true"
                  />
                  <span>{t("paymentReturn.securityNote")}</span>
                </div>
              </div>
            </header>

            <div className="flex flex-col px-6 py-8 sm:px-10 sm:py-11">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl ring-8 ring-slate-50 ${iconClassName}`}
              >
                {icon}
              </div>

              <div className="mt-6" aria-live="polite">
                <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  {title}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  {description}
                </p>
                {status === "success" ? (
                  <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-vr-50 px-3 py-1.5 text-xs font-semibold text-vr-800">
                    <FiClock className="h-4 w-4" aria-hidden="true" />
                    {t("paymentReturn.redirectingToPackages", {
                      seconds: redirectSeconds,
                    })}
                  </p>
                ) : null}
              </div>

              {responseCode || transactionReference || subscription?.plan.name ? (
                <dl className="mt-7 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-slate-50 px-5 text-left text-sm">
                  {transactionReference ? (
                    <div className="grid gap-1 py-4 sm:grid-cols-2 sm:gap-4">
                      <dt className="text-slate-500">
                        {t("paymentReturn.transactionReference")}
                      </dt>
                      <dd className="break-all font-semibold text-slate-950 sm:text-right">
                        {transactionReference}
                      </dd>
                    </div>
                  ) : null}
                  {responseCode ? (
                    <div className="grid gap-1 py-4 sm:grid-cols-2 sm:gap-4">
                      <dt className="text-slate-500">
                        {t("paymentReturn.responseCode")}
                      </dt>
                      <dd className="font-semibold text-slate-950 sm:text-right">
                        {responseCode}
                      </dd>
                    </div>
                  ) : null}
                  {subscription?.plan.name ? (
                    <div className="grid gap-1 py-4 sm:grid-cols-2 sm:gap-4">
                      <dt className="text-slate-500">
                        {t("paymentReturn.currentPlan")}
                      </dt>
                      <dd className="font-semibold text-slate-950 sm:text-right">
                        {subscription.plan.name}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              <div className="mt-auto flex flex-col-reverse gap-3 pt-8 sm:flex-row">
                {canRetry ? (
                  <button
                    type="button"
                    onClick={() => void verifyPayment()}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vr-600 focus-visible:ring-offset-2"
                  >
                    <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
                    {t("paymentReturn.retry")}
                  </button>
                ) : null}
                <Link
                  to="/manager/packages"
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-vr-700 px-5 py-3 font-semibold text-white shadow-lg shadow-vr-900/15 transition hover:-translate-y-0.5 hover:bg-vr-800 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vr-600 focus-visible:ring-offset-2"
                >
                  <FiArrowLeft className="h-5 w-5" aria-hidden="true" />
                  {t("paymentReturn.backToPackages")}
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
