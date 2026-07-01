import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiArrowLeft, FiArrowRight, FiLock } from "react-icons/fi";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { setInitialPassword } from "../api/vietride";
import logo from "../assets/Login/logo.svg";

export default function SetInitialPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation("login");
  const { t: tc } = useTranslation("common");
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get("token") ?? "";
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!token.trim() || !password || !confirmPassword) {
      setError(t("initialPassword.errors.required"));
      return;
    }

    if (password.length < 6) {
      setError(t("errors.passwordMin"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("initialPassword.errors.mismatch"));
      return;
    }

    setLoading(true);

    try {
      await setInitialPassword({
        token: token.trim(),
        password,
      });
      navigate("/login", {
        replace: true,
        state: { registered: true },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("initialPassword.errors.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-vr-500 px-4 py-10">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md rounded-[1.75rem] bg-white px-6 py-10 shadow-2xl shadow-vr-900/15 sm:px-10">
        <div className="mb-6 flex justify-center">
          <img src={logo} alt={tc("brand")} className="h-20 w-20 object-contain" />
        </div>

        <h1 className="text-center text-3xl font-bold tracking-tight text-vr-900">
          {t("initialPassword.title")}
        </h1>
        <p className="mt-2 text-center text-sm leading-6 text-gray-500">
          {t("initialPassword.subtitle")}
        </p>

        {error && (
          <div
            className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field
            label={t("initialPassword.token")}
            value={token}
            onChange={setToken}
            placeholder={t("initialPassword.tokenPlaceholder")}
          />
          <Field
            label={t("initialPassword.newPassword")}
            value={password}
            onChange={setPassword}
            placeholder={t("initialPassword.newPasswordPlaceholder")}
            type="password"
          />
          <Field
            label={t("initialPassword.confirmPassword")}
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder={t("initialPassword.confirmPasswordPlaceholder")}
            type="password"
          />

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-vr-600 py-3.5 text-base font-bold text-white shadow-sm shadow-vr-900/15 transition hover:bg-vr-700 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none"
          >
            {loading ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {t("submitting")}
              </>
            ) : (
              <>
                {t("initialPassword.savePassword")}
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
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-800">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <FiLock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-slate-900 shadow-sm placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-2 focus:ring-vr-500/25"
        />
      </div>
    </div>
  );
}
