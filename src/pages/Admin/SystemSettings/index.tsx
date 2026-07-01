import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiAlertTriangle, FiSave, FiSliders } from "react-icons/fi";

type SettingsForm = {
  bookingHoldMinutes: string;
  paymentTimeoutMinutes: string;
  gpsLostThresholdMinutes: string;
  maxRefundDays: string;
  autoApproveLowRiskDocuments: boolean;
  enableAiAssistant: boolean;
  enableManualSettlement: boolean;
};

const initialSettings: SettingsForm = {
  bookingHoldMinutes: "15",
  paymentTimeoutMinutes: "10",
  gpsLostThresholdMinutes: "5",
  maxRefundDays: "7",
  autoApproveLowRiskDocuments: false,
  enableAiAssistant: true,
  enableManualSettlement: true,
};

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100";

const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";

function isPositiveRange(value: string, min: number, max: number) {
  const next = Number(value);
  return Number.isFinite(next) && next >= min && next <= max;
}

export default function SystemSettings() {
  const { t } = useTranslation("admin");
  const [form, setForm] = useState<SettingsForm>(initialSettings);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const update = (key: keyof SettingsForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveSettings = () => {
    setError("");
    setMessage("");

    if (
      !isPositiveRange(form.bookingHoldMinutes, 1, 120) ||
      !isPositiveRange(form.paymentTimeoutMinutes, 1, 60) ||
      !isPositiveRange(form.gpsLostThresholdMinutes, 1, 30) ||
      !isPositiveRange(form.maxRefundDays, 0, 30)
    ) {
      setError(t("systemSettings.invalidRange"));
      return;
    }

    setMessage(t("systemSettings.saved"));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("systemSettings.title")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">{t("systemSettings.subtitle")}</p>
        </div>
        <div className="inline-flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          <FiAlertTriangle className="mt-0.5 shrink-0" />
          <span>{t("systemSettings.riskyHint")}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-vr-50 p-2 text-vr-700">
              <FiSliders size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t("systemSettings.parameters")}</h2>
              <p className="text-sm text-gray-500">{t("systemSettings.parametersHint")}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClass}>{t("systemSettings.bookingHold")}</span>
              <input className={inputClass} value={form.bookingHoldMinutes} onChange={(event) => update("bookingHoldMinutes", event.target.value)} type="number" />
            </label>
            <label>
              <span className={labelClass}>{t("systemSettings.paymentTimeout")}</span>
              <input className={inputClass} value={form.paymentTimeoutMinutes} onChange={(event) => update("paymentTimeoutMinutes", event.target.value)} type="number" />
            </label>
            <label>
              <span className={labelClass}>{t("systemSettings.gpsLostThreshold")}</span>
              <input className={inputClass} value={form.gpsLostThresholdMinutes} onChange={(event) => update("gpsLostThresholdMinutes", event.target.value)} type="number" />
            </label>
            <label>
              <span className={labelClass}>{t("systemSettings.maxRefundDays")}</span>
              <input className={inputClass} value={form.maxRefundDays} onChange={(event) => update("maxRefundDays", event.target.value)} type="number" />
            </label>
          </div>
        </section>

        <aside className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-bold text-gray-900">{t("systemSettings.flags")}</h2>
          <div className="mt-4 space-y-4">
            {[
              ["autoApproveLowRiskDocuments", t("systemSettings.autoApproveDocs")],
              ["enableAiAssistant", t("systemSettings.aiAssistant")],
              ["enableManualSettlement", t("systemSettings.manualSettlement")],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 bg-slate-50 px-3 py-3">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-vr-600"
                  checked={Boolean(form[key as keyof SettingsForm])}
                  onChange={(event) =>
                    update(key as keyof SettingsForm, event.target.checked)
                  }
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={saveSettings}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-vr-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-vr-700"
          >
            <FiSave size={16} />
            {t("systemSettings.save")}
          </button>
        </aside>
      </div>
    </div>
  );
}
