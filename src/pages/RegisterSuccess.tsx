import { useTranslation } from "react-i18next";
import { FiArrowRight, FiCheck, FiClock, FiMail } from "react-icons/fi";
import { Link, useLocation } from "react-router-dom";
import LanguageSwitcher from "../components/LanguageSwitcher";
import logo from "../assets/Login/logo.svg";

export default function RegisterSuccess() {
  const { t } = useTranslation("login");
  const { t: tc } = useTranslation("common");
  const location = useLocation();
  const email = getRegistrationEmail(location.state);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-vr-500 px-4 py-10 sm:px-6">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <section className="w-full max-w-xl rounded-[1.75rem] bg-slate-50 px-7 py-9 text-center shadow-xl sm:px-12 sm:py-12">
        <img
          src={logo}
          alt={tc("brand")}
          className="mx-auto h-20 w-20 object-contain"
        />

        <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <FiCheck className="h-8 w-8" aria-hidden="true" />
        </div>

        <h1 className="mt-5 text-3xl font-bold text-slate-900 sm:text-4xl">
          {t("registrationCompleteTitle")}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
          {t("registrationCompleteDescription")}
        </p>

        <div className="mt-7 rounded-xl border border-vr-200 bg-vr-50 p-5 text-left">
          <div className="flex items-center gap-3 font-semibold text-vr-800">
            <FiClock className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{t("registrationPendingApproval")}</span>
          </div>
          <p className="mt-2 pl-8 text-sm leading-6 text-slate-600">
            {t("registrationPendingNote")}
          </p>
        </div>

        {email && (
          <div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-600">
            <FiMail className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t("registrationEmailLabel")}:</span>
            <strong className="break-all text-slate-900">{email}</strong>
          </div>
        )}

        <Link
          to="/login"
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-vr-500 px-5 py-3.5 font-semibold text-white transition hover:bg-vr-600"
        >
          {t("goToLogin")}
          <FiArrowRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}

function getRegistrationEmail(state: unknown): string {
  if (typeof state !== "object" || state === null || !("email" in state)) {
    return "";
  }

  return typeof state.email === "string" ? state.email : "";
}
