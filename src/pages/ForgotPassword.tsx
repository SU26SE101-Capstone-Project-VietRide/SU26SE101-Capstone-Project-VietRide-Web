import { useEffect, useRef, useState, type FormEvent } from "react";

import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiArrowLeft, FiArrowRight, FiKey, FiLock, FiMail } from "react-icons/fi";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useToastFeedback } from "../hooks/useToastFeedback";
import { requestForgotPassword, resetPassword } from "../api/vietride";
import { createIdempotencyKey } from "../api/idempotency";
import { clearAuthSession } from "../auth";
import logo from "../assets/Login/logo.svg";
import login_2 from "../assets/Login/login_2.png";

export default function ForgotPassword() {
  const { t } = useTranslation("login");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const forgotKeyRef = useRef<string | null>(null);
  const resetKeyRef = useRef<string | null>(null);
  useToastFeedback({ message, error });

  useEffect(() => {
    if (otpSecondsLeft <= 0) return;
    const timer = window.setInterval(() => setOtpSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [otpSecondsLeft]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError(t("errors.required"));
      return;
    }

    if (!trimmedEmail.includes("@")) {
      setError(t("errors.invalidEmail"));
      return;
    }

    if (!otpRequested) {
      setLoading(true);

      try {
        const key = forgotKeyRef.current ?? createIdempotencyKey();
        forgotKeyRef.current = key;
        const result = await requestForgotPassword({ email: trimmedEmail }, key);
        setOtpRequested(true);
        setEmail(result.email);
        setOtpSecondsLeft(result.otpTtlMinutes * 60);
        setMessage(
          t("forgotPasswordPage.otpSent", {
            minutes: result.otpTtlMinutes,
          }),
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("forgotPasswordPage.requestFailed"),
        );
      } finally {
        setLoading(false);
      }

      return;
    }

    if (!code.trim() || !newPassword || !confirmPassword) {
      setError(t("errors.required"));
      return;
    }

    if (!/^\d{6}$/.test(code.trim())) {
      setError(t("forgotPasswordPage.invalidCode"));
      return;
    }

    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError(t("forgotPasswordPage.passwordRules"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("forgotPasswordPage.passwordMismatch"));
      return;
    }

    setLoading(true);

    try {
      const key = resetKeyRef.current ?? createIdempotencyKey();
      resetKeyRef.current = key;
      await resetPassword({
        email: trimmedEmail,
        code: code.trim(),
        newPassword,
      }, key);
      clearAuthSession();
      navigate("/login", { replace: true, state: { message: t("forgotPasswordPage.resetSuccess") } });
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("forgotPasswordPage.resetFailed"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-vr-500 px-4 py-8 sm:px-6">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center">
        <div className="grid w-full overflow-hidden rounded-[1.75rem] bg-white shadow-2xl shadow-vr-900/15 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative hidden min-h-[620px] overflow-hidden bg-vr-900 lg:block">
            <img
              src={login_2}
              alt={t("hero.station")}
              className="h-full w-full object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-vr-900/85 via-vr-900/25 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-10 text-white">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-vr-100">
                {tc("brand")}
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-tight">
                {t("forgotPasswordPage.heroTitle")}
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-vr-50/85">
                {t("forgotPasswordPage.heroSubtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center px-6 py-10 sm:px-10">
            <div className="w-full max-w-md">
              <div className="mb-6 flex justify-center">
                <img
                  src={logo}
                  alt={tc("brand")}
                  className="h-20 w-20 object-contain"
                />
              </div>

              <h1 className="text-center text-3xl font-bold tracking-tight text-vr-900">
                {t("forgotPasswordPage.title")}
              </h1>
              <p className="mt-2 text-center text-sm leading-6 text-gray-500">
                {t("forgotPasswordPage.subtitle")}
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">
                    {t("email")} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FiMail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      disabled={otpRequested || loading}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder={t("emailPlaceholder")}
                      className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-slate-900 shadow-sm placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-2 focus:ring-vr-500/25 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                </div>

                {otpRequested && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-800">
                        {t("forgotPasswordPage.code")}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <FiKey className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={code}
                          onChange={(event) => setCode(event.target.value)}
                          placeholder={t("forgotPasswordPage.codePlaceholder")}
                          maxLength={6}
                          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-slate-900 shadow-sm placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-2 focus:ring-vr-500/25"
                        />
                      </div>
                    
                      {otpSecondsLeft > 0 && <p className="mt-1 text-xs text-gray-500">{Math.floor(otpSecondsLeft / 60)}:{String(otpSecondsLeft % 60).padStart(2, "0")}</p>}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-800">
                        {t("forgotPasswordPage.newPassword")}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <FiLock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          placeholder={t("forgotPasswordPage.newPasswordPlaceholder")}
                          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-slate-900 shadow-sm placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-2 focus:ring-vr-500/25"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-800">
                        {t("forgotPasswordPage.confirmPassword")}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <FiLock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(event) =>
                            setConfirmPassword(event.target.value)
                          }
                          placeholder={t(
                            "forgotPasswordPage.confirmPasswordPlaceholder",
                          )}
                          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-slate-900 shadow-sm placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-2 focus:ring-vr-500/25"
                        />
                      </div>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-vr-600 py-3.5 text-base font-bold text-white shadow-sm shadow-vr-900/15 transition hover:bg-vr-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {loading ? (
                    <>
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {t("submitting")}
                    </>
                  ) : (
                    <>
                      {otpRequested
                        ? t("forgotPasswordPage.resetSubmit")
                        : t("forgotPasswordPage.submit")}
                      <FiArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </form>

              <Link
                to="/login"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-vr-700 hover:text-vr-900"
              >
                <FiArrowLeft /> {t("backToLogin")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



