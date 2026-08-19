import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight } from "react-icons/fi";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useToastFeedback } from "../hooks/useToastFeedback";
import {
  getAuthUser,
  getHomePathForRole,
  login,
  RETIRED_ROLE_ERROR,
} from "../auth";
import Checkbox from "../components/form/Checkbox";
import { isRecord } from "../utils/typeGuards";
import { Button } from "../components/ui/Button";

/**
 * `PrivateRoute` và `EntryRedirect` đá về đây kèm `state.from` = trang người
 * dùng đang muốn vào. Không đọc nó thì người vừa thanh toán VNPay xong, bấm
 * "quay lại quản lý gói" mà phiên đã hết, đăng nhập lại sẽ rơi về dashboard chứ
 * không về `/manager/packages` — mất luôn mạch việc đang làm.
 *
 * Chỉ nhận path nội bộ: `state` nằm trong history nên sửa được từ ngoài, URL
 * tuyệt đối hay `//host` lọt qua đây là thành open redirect. `/login` cũng loại
 * để không tự quay vòng.
 */
function resolveRedirectTarget(state: unknown): string {
  if (!isRecord(state) || !isRecord(state.from)) return "";

  const { pathname, search, hash } = state.from;
  if (typeof pathname !== "string") return "";
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return "";
  if (pathname === "/login") return "";

  return `${pathname}${typeof search === "string" ? search : ""}${
    typeof hash === "string" ? hash : ""
  }`;
}

export default function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Đổi mật khẩu xong BE thu hồi hết refresh token nên Profile buộc phải đá về
  // đây. Không đọc `state.message` thì người dùng bị văng ra mà không hiểu vì
  // sao — tưởng hệ thống lỗi.
  const location = useLocation();
  // useState giữ giá trị của lần render đầu: replaceState bên dưới xoá
  // location.state, đọc trực tiếp sẽ mất thông báo ngay ở render kế tiếp.
  const [notice] = useState(() =>
    typeof location.state === "object" &&
    location.state !== null &&
    "message" in location.state &&
    typeof location.state.message === "string"
      ? location.state.message
      : "",
  );
  // Cùng lý do với `notice`: phải chốt ở lần render đầu, replaceState bên dưới
  // xoá location.state.
  const [redirectTo] = useState(() => resolveRedirectTarget(location.state));
  useEffect(() => {
    if (!notice) return;
    // Xoá state khỏi history: F5 hoặc back không được hiện lại thông báo cũ.
    window.history.replaceState({}, "");
  }, [notice]);
  useToastFeedback({ message: notice, error });

  useEffect(() => {
    const redirectIfAuthenticated = () => {
      const user = getAuthUser();
      if (user) {
        navigate(redirectTo || getHomePathForRole(user.role), { replace: true });
      }
    };

    redirectIfAuthenticated();
    window.addEventListener("storage", redirectIfAuthenticated);

    return () =>
      window.removeEventListener("storage", redirectIfAuthenticated);
  }, [navigate, redirectTo]);

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
      // Sai vai trò cho `redirectTo` thì PrivateRoute tự đẩy về home của role,
      // nên ở đây không cần kiểm tra quyền lần nữa.
      navigate(redirectTo || getHomePathForRole(session.user.role), {
        replace: true,
      });

      if (rememberMe) {
        localStorage.setItem("rememberEmail", email);
      }
    } catch (err) {
      if (err instanceof Error && err.message === RETIRED_ROLE_ERROR) {
        setError(t("errors.roleRetired"));
      } else {
        setError(err instanceof Error ? err.message : t("errors.failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-vr-500 px-4 py-10 sm:px-6 sm:py-12">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <div className="relative w-full max-w-lg">
        <div className="flex w-full justify-center">
          
            <div className="w-full rounded-4xl bg-slate-50 px-8 py-10 shadow-2xl shadow-vr-900/20 sm:px-10 sm:py-12">
              <h1 className="text-2xl text-center font-bold tracking-tight text-vr-800 sm:text-4xl">
                {t("title")}
              </h1>
              <p className="mt-2 text-center text-sm leading-relaxed text-gray-500">
                {t("subtitle")}
              </p>

              <form onSubmit={handleLogin} className="space-y-4 mt-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">
                    {t("email")} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative w-full max-w-lg">
                    <FiMail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("emailPlaceholder")}
                      className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-slate-900 shadow-sm placeholder:text-gray-500 focus:border-vr-500 focus:outline-none focus:ring-2 focus:ring-vr-500/25"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">
                    {t("password")} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative w-full max-w-lg">
                    <FiLock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t("passwordPlaceholder")}
                      className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-11 text-slate-900 shadow-sm placeholder:text-gray-500 focus:border-vr-500 focus:outline-none focus:ring-2 focus:ring-vr-500/25"
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

                {/* Ghi nhớ đăng nhập + Quên mật khẩu nằm cùng hàng dưới ô mật khẩu */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Checkbox
                    checked={rememberMe}
                    onChange={setRememberMe}
                    label={t("rememberMe")}
                  />
                  <Link
                    to="/forgot-password"
                    className="text-sm font-semibold text-vr-900 hover:text-vr-900"
                  >
                    {t("forgotPassword")}
                  </Link>
                </div>

                <Button variant="primary" className="w-full" type="submit" disabled={loading}>
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
                </Button>
              </form>

              <p className="mt-8 text-center text-sm text-gray-500">
                {t("noAccount")}{" "}
                <Link
                  to="/register"
                  className="font-semibold text-vr-900 underline-offset-2 hover:underline"
                >
                  {t("register")}
                </Link>
              </p>
            </div>

        </div>
      </div>
    </div>
  );
}



