import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiArrowLeft,
  FiArrowRight,
  FiLock,
  FiMail,
  FiPhone,
  FiUser,
} from "react-icons/fi";
import LanguageSwitcher from "../components/LanguageSwitcher";
import logo from "../assets/Login/logo.svg";
import login_3 from "../assets/Login/login_3.png";
import { registerOperator, type RegisterOperatorRequest } from "../api/vietride";

const emptyOperatorForm: RegisterOperatorRequest = {
  name: "",
  contactEmail: "",
  contactPhone: "",
  businessRegistrationNumber: "",
  taxCode: "",
  addressStreet: "",
  addressWard: "",
  addressDistrict: "",
  addressProvince: "",
  representativeName: "",
  representativePosition: "",
  representativePhone: "",
  representativeEmail: "",
  password: "",
};

export default function Register() {
  const navigate = useNavigate();
  const { t } = useTranslation("login");
  const { t: tc } = useTranslation("common");
  const [form, setForm] = useState<RegisterOperatorRequest>(emptyOperatorForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const updateForm = (key: keyof RegisterOperatorRequest, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const requiredValues = [
      form.name,
      form.contactEmail,
      form.contactPhone,
      form.businessRegistrationNumber,
      form.taxCode,
      form.addressStreet,
      form.addressWard,
      form.addressDistrict,
      form.addressProvince,
      form.representativeName,
      form.representativePhone,
      form.representativeEmail,
      form.password,
    ];

    if (requiredValues.some((value) => !value.trim())) {
      setError(t("errors.required"));
      return;
    }

    if (!form.contactEmail.includes("@") || !form.representativeEmail.includes("@")) {
      setError(t("errors.invalidEmail"));
      return;
    }

    if (form.password.length < 6) {
      setError(t("errors.passwordMin"));
      return;
    }

    setLoading(true);

    try {
      await registerOperator(form);
      navigate("/login", { replace: true, state: { registered: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.registerFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-vr-500 px-4 py-8 sm:px-6">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <div className="grid w-full overflow-hidden rounded-[1.75rem] bg-white shadow-2xl shadow-vr-900/15 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative hidden min-h-[680px] overflow-hidden bg-vr-900 lg:block">
            <img
              src={login_3}
              alt={t("hero.highway")}
              className="h-full w-full object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-vr-900/85 via-vr-900/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-10 text-white">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-vr-100">
                {tc("brand")}
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-tight">
                {t("registerHeroTitle")}
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-vr-50/85">
                {t("registerHeroSubtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center px-6 py-10 sm:px-10">
            <div className="w-full max-w-md">
              <div className="mb-7 flex items-center justify-center">
                <img
                  src={logo}
                  alt={tc("brand")}
                  className="h-20 w-20 object-contain"
                />
              </div>

              <h1 className="text-center text-3xl font-bold tracking-tight text-vr-900">
                {t("registerTitle")}
              </h1>
              <p className="mt-2 text-center text-sm leading-6 text-gray-500">
                {t("registerSubtitle")}
              </p>

              {error && (
                <div
                  className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleRegister} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field
                      icon={<FiUser />}
                      label="Operator name"
                      value={form.name}
                      onChange={(value) => updateForm("name", value)}
                      placeholder="VietRide Express"
                    />
                  </div>
                  <Field
                    icon={<FiMail />}
                    label="Contact email"
                    value={form.contactEmail}
                    onChange={(value) => updateForm("contactEmail", value)}
                    placeholder="ops@operator.vn"
                    type="email"
                  />
                  <Field
                    icon={<FiPhone />}
                    label="Contact phone"
                    value={form.contactPhone}
                    onChange={(value) => updateForm("contactPhone", value)}
                    placeholder={t("phonePlaceholder")}
                    type="tel"
                  />
                  <Field
                    icon={<FiUser />}
                    label="Business registration number"
                    value={form.businessRegistrationNumber}
                    onChange={(value) =>
                      updateForm("businessRegistrationNumber", value)
                    }
                    placeholder="0312345678"
                  />
                  <Field
                    icon={<FiUser />}
                    label="Tax code"
                    value={form.taxCode}
                    onChange={(value) => updateForm("taxCode", value)}
                    placeholder="0301234567"
                  />
                  <div className="sm:col-span-2">
                    <Field
                      icon={<FiUser />}
                      label="Street address"
                      value={form.addressStreet}
                      onChange={(value) => updateForm("addressStreet", value)}
                      placeholder="123 Nguyen Van Linh"
                    />
                  </div>
                  <Field
                    icon={<FiUser />}
                    label="Ward"
                    value={form.addressWard}
                    onChange={(value) => updateForm("addressWard", value)}
                    placeholder="Ward 1"
                  />
                  <Field
                    icon={<FiUser />}
                    label="District"
                    value={form.addressDistrict}
                    onChange={(value) => updateForm("addressDistrict", value)}
                    placeholder="District 1"
                  />
                  <Field
                    icon={<FiUser />}
                    label="Province"
                    value={form.addressProvince}
                    onChange={(value) => updateForm("addressProvince", value)}
                    placeholder="Ho Chi Minh City"
                  />
                  <Field
                    icon={<FiUser />}
                    label="Representative name"
                    value={form.representativeName}
                    onChange={(value) => updateForm("representativeName", value)}
                    placeholder={t("displayNamePlaceholder")}
                  />
                  <Field
                    icon={<FiUser />}
                    label="Representative position"
                    value={form.representativePosition}
                    onChange={(value) =>
                      updateForm("representativePosition", value)
                    }
                    placeholder="Operations manager"
                  />
                  <Field
                    icon={<FiPhone />}
                    label="Representative phone"
                    value={form.representativePhone}
                    onChange={(value) => updateForm("representativePhone", value)}
                    placeholder={t("phonePlaceholder")}
                    type="tel"
                  />
                  <Field
                    icon={<FiMail />}
                    label="Representative email"
                    value={form.representativeEmail}
                    onChange={(value) => updateForm("representativeEmail", value)}
                    placeholder="owner@operator.vn"
                    type="email"
                  />
                  <div className="sm:col-span-2">
                    <Field
                      icon={<FiLock />}
                      label={t("password")}
                      value={form.password}
                      onChange={(value) => updateForm("password", value)}
                      placeholder={t("passwordPlaceholder")}
                      type="password"
                    />
                  </div>
                </div>

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
                      {t("registerSubmit")}
                      <FiArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 font-semibold text-vr-700 hover:text-vr-900"
                >
                  <FiArrowLeft /> {t("backToLogin")}
                </Link>
                <span className="text-gray-500">
                  {t("hasAccount")}{" "}
                  <Link
                    to="/login"
                    className="font-semibold text-vr-700 underline-offset-2 hover:underline"
                  >
                    {t("submit")}
                  </Link>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type FieldProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
};

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: FieldProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-800">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-gray-400">
          {icon}
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-slate-900 shadow-sm placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-2 focus:ring-vr-500/25"
        />
      </div>
    </div>
  );
}
