import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight } from "react-icons/fi";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { getHomePathForRole, login } from "../auth";
import logo from "../assets/Login/logo.svg";
import login_1 from "../assets/Login/login_1.png";
import login_2 from "../assets/Login/login_2.png";
import login_3 from "../assets/Login/login_3.png";
import login_4 from "../assets/Login/login_4.png";
import login_5 from "../assets/Login/login_5.png";

const SLIDE_INTERVAL_MS = 5000;

const HERO_SLIDE_KEYS = [
  "hero.bus",
  "hero.station",
  "hero.highway",
  "hero.urban",
  "hero.tourism",
] as const;

const HERO_SLIDE_SRC = [login_1, login_2, login_3, login_4, login_5];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("login");
  const { t: tc } = useTranslation("common");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const registered = isRecord(location.state) && location.state.registered === true;

  useEffect(() => {
    const id = window.setInterval(() => {
      setSlideIndex((i) => (i + 1) % HERO_SLIDE_KEYS.length);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    setCapsLock(e.getModifierState("CapsLock"));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!email || !password) {
        setError(t("errors.required"));
        setLoading(false);
        return;
      }

      if (!email.includes("@")) {
        setError(t("errors.invalidEmail"));
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError(t("errors.passwordMin"));
        setLoading(false);
        return;
      }

      const session = await login({ email, password });
      navigate(getHomePathForRole(session.user.role), { replace: true });

      if (rememberMe) {
        localStorage.setItem("rememberEmail", email);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-vr-500 px-4 py-10 sm:px-6 sm:py-12">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <div className="relative">
        <div className="flex w-full flex-col overflow-hidden rounded-[1.75rem] bg-vr-500  md:flex-row">
          <div className="w-[40%] flex items-center justify-center ">
            <div className="order-2 w-[70%] flex flex-col justify-center rounded-4xl bg-slate-50 px-8 py-10 sm:px-10 sm:py-12 md:order-1">
              <div className="mb-5 flex items-center justify-center gap-3">
                <img
                  src={logo}
                  alt={tc("brand")}
                  className="h-20 w-20 object-contain"
                />
              </div>

              <h1 className="text-2xl text-center font-bold tracking-tight text-vr-800 sm:text-4xl">
                {t("title")}
              </h1>
              <p className="mt-2 text-center text-[13px] leading-relaxed text-gray-500">
                {t("subtitle")}
              </p>

              {error && (
                <div
                  className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </div>
              )}
              {registered && !error && (
                <div
                  className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                  role="status"
                >
                  {t("registerSuccess")}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4 mt-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">
                    {t("email")} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FiMail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("emailPlaceholder")}
                      className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-slate-900 shadow-sm placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-2 focus:ring-vr-500/25"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm font-semibold text-slate-800">
                      {t("password")} <span className="text-red-500">*</span>
                    </label>
                    <a
                      href="#"
                      className="text-sm font-semibold text-vr-700 hover:text-vr-900"
                    >
                      {t("forgotPassword")}
                    </a>
                  </div>
                  <div className="relative">
                    <FiLock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t("passwordPlaceholder")}
                      className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-11 text-slate-900 shadow-sm placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-2 focus:ring-vr-500/25"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                      aria-label={
                        showPassword ? t("hidePassword") : t("showPassword")
                      }
                    >
                      {showPassword ? (
                        <FiEyeOff size={18} />
                      ) : (
                        <FiEye size={18} />
                      )}
                    </button>
                  </div>
                  {capsLock && (
                    <p className="mt-1.5 text-xs font-medium text-amber-600">
                      {t("capsLockOn")}
                    </p>
                  )}
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-vr-600 focus:ring-vr-500"
                  />
                  {t("rememberMe")}
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-vr-500 py-3.5 text-[18px] font-bold text-white shadow-sm shadow-vr-900/15 transition hover:bg-vr-600 hover:text-white disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none"
                >
                  {loading ? (
                    <>
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {t("submitting")}
                    </>
                  ) : (
                    <>
                      {t("submit")}
                      <FiArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-8 text-center text-sm text-gray-500">
                {t("noAccount")}{" "}
                <Link
                  to="/register"
                  className="font-semibold text-vr-700 underline-offset-2 hover:underline"
                >
                  {t("register")}
                </Link>
              </p>
            </div>
          </div>

          <div className="relative order-1  shrink-0 md:order-2 md:min-h-0 md:flex-1">
            <div className="absolute inset-0 bg-vr-500">
              {HERO_SLIDE_SRC.map((src, i) => (
                <div
                  key={src}
                  className="absolute inset-0 transition-opacity duration-[900ms] ease-in-out"
                  style={{ opacity: i === slideIndex ? 1 : 0 }}
                  aria-hidden={i !== slideIndex}
                >
                  <img
                    src={src}
                    alt={t(HERO_SLIDE_KEYS[i])}
                    className="h-full w-full object-fill"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                </div>
              ))}
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-10 p-6 text-white md:p-8">
              <p className="text-3xl font-serif leading-none text-amber-400 opacity-90 md:text-4xl">
                &ldquo;
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
