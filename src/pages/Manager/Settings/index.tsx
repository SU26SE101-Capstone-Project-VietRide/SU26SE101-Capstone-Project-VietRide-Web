import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiPercent,
  FiBookOpen,
  FiPackage,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiCheck,
  FiX,
} from "react-icons/fi";
import CurrencyInput from "../../../components/CurrencyInput";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import Modal from "../../../components/Modal";
import Pagination from "../../../components/Pagination";
import {
  operatorConfigs,
  type HolidayPricingPeriod,
  type OperatorConfig,
} from "../../../data/mockData";
import { formatDateOnly } from "../../../utils/date";

const CURRENT_OPERATOR_ID = "op1";

type TabId = "pricing" | "booking" | "parcel";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? "bg-vr-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelClass}>
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + " đ";
}

const defaultConfig =
  operatorConfigs.find((c) => c.operatorId === CURRENT_OPERATOR_ID) ??
  operatorConfigs[0];

export default function ManagerSettings() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [tab, setTab] = useState<TabId>("pricing");

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "pricing", label: t("settings.tabPricing"), icon: <FiPercent /> },
    { id: "booking", label: t("settings.tabBooking"), icon: <FiBookOpen /> },
    { id: "parcel", label: t("settings.tabParcel"), icon: <FiPackage /> },
  ];
  const [config, setConfig] = useState<OperatorConfig>({ ...defaultConfig });
  const [savedSnapshot, setSavedSnapshot] = useState<OperatorConfig>({
    ...defaultConfig,
  });
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] =
    useState<HolidayPricingPeriod | null>(null);
  const [periodForm, setPeriodForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    surchargePercent: "15",
  });
  const [periodPage, setPeriodPage] = useState(1);
  const pageSize = 8;
  const paginatedHolidayPeriods = useMemo(
    () =>
      config.holidayPeriods.slice(
        (periodPage - 1) * pageSize,
        periodPage * pageSize,
      ),
    [config.holidayPeriods, periodPage],
  );

  const updateConfig = <K extends keyof OperatorConfig>(
    key: K,
    value: OperatorConfig[K],
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    setSavedSnapshot({ ...config });
    alert(t("settings.saveSuccess"));
  };

  const handleReset = () => {
    setConfig({ ...savedSnapshot });
  };

  const openAddPeriod = () => {
    setEditingPeriod(null);
    setPeriodForm({
      name: "",
      startDate: "",
      endDate: "",
      surchargePercent: String(config.defaultHolidaySurchargePercent),
    });
    setPeriodModalOpen(true);
  };

  const openEditPeriod = (period: HolidayPricingPeriod) => {
    setEditingPeriod(period);
    setPeriodForm({
      name: period.name,
      startDate: period.startDate,
      endDate: period.endDate,
      surchargePercent: String(period.surchargePercent),
    });
    setPeriodModalOpen(true);
  };

  const handleSavePeriod = () => {
    const surchargePercent = Number(periodForm.surchargePercent);
    if (
      !periodForm.name ||
      !periodForm.startDate ||
      !periodForm.endDate ||
      Number.isNaN(surchargePercent)
    ) {
      return;
    }

    if (editingPeriod) {
      setConfig((prev) => ({
        ...prev,
        holidayPeriods: prev.holidayPeriods.map((p) =>
          p.id === editingPeriod.id
            ? {
                ...p,
                name: periodForm.name,
                startDate: periodForm.startDate,
                endDate: periodForm.endDate,
                surchargePercent,
              }
            : p,
        ),
      }));
    } else {
      const newPeriod: HolidayPricingPeriod = {
        id: `hp${Date.now()}`,
        name: periodForm.name,
        startDate: periodForm.startDate,
        endDate: periodForm.endDate,
        surchargePercent,
        active: true,
      };
      setConfig((prev) => ({
        ...prev,
        holidayPeriods: [...prev.holidayPeriods, newPeriod],
      }));
    }

    setPeriodModalOpen(false);
    setEditingPeriod(null);
  };

  const handleDeletePeriod = (id: string) => {
    if (confirm(t("settings.confirmDeletePeriod"))) {
      setConfig((prev) => ({
        ...prev,
        holidayPeriods: prev.holidayPeriods.filter((p) => p.id !== id),
      }));
    }
  };

  const handleTogglePeriod = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      holidayPeriods: prev.holidayPeriods.map((p) =>
        p.id === id ? { ...p, active: !p.active } : p,
      ),
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-gray-600">{t("settings.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => setTab(tabItem.id)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
              tab === tabItem.id
                ? "border-vr-300 bg-vr-50 font-medium text-vr-800"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {tabItem.icon}
            {tabItem.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {tab === "pricing" && (
          <div className="space-y-6">
            <div className="rounded-lg border border-vr-200 bg-vr-50 p-4">
              <p className="text-sm text-vr-900">{t("settings.pricingInfo")}</p>
            </div>

            <div>
              <h3 className="mb-4 text-base font-semibold text-gray-800">
                {t("settings.holidaySurcharge")}
              </h3>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field
                  label={t("settings.autoApply")}
                  hint={t("settings.autoApplyHint")}
                >
                  <div className="pt-1">
                    <Toggle
                      checked={config.autoApplyHolidayPricing}
                      onChange={() =>
                        updateConfig(
                          "autoApplyHolidayPricing",
                          !config.autoApplyHolidayPricing,
                        )
                      }
                    />
                  </div>
                </Field>
                <Field
                  label={t("settings.defaultSurcharge")}
                  required
                  hint={t("settings.defaultSurchargeHint")}
                >
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className={inputClass}
                      value={config.defaultHolidaySurchargePercent}
                      onChange={(e) =>
                        updateConfig(
                          "defaultHolidaySurchargePercent",
                          Number(e.target.value),
                        )
                      }
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      %
                    </span>
                  </div>
                </Field>
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-800">
                  {t("settings.periodList")}
                </h3>
                <button
                  type="button"
                  onClick={openAddPeriod}
                  className="flex items-center gap-1.5 rounded-lg bg-vr-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-vr-600"
                >
                  <FiPlus size={14} />
                  {t("settings.addPeriod")}
                </button>
              </div>

              {config.holidayPeriods.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
                  {t("settings.periodEmpty")}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-4 py-3 text-left font-semibold text-gray-900">
                          {t("settings.periodName")}
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-900">
                          {t("settings.periodTime")}
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-900">
                          {t("settings.surcharge")}
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-900">
                          {tc("status")}
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-900">
                          {tc("actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedHolidayPeriods.map((period) => (
                        <tr key={period.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {period.name}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {formatDateOnly(period.startDate)} –{" "}
                            {formatDateOnly(period.endDate)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                              +{period.surchargePercent}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                                period.active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {period.active ? (
                                <>
                                  <FiCheck /> {t("settings.applying")}
                                </>
                              ) : (
                                <>
                                  <FiX /> {t("settings.paused")}
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleTogglePeriod(period.id)}
                                title={period.active ? tc("off") : tc("on")}
                                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                              >
                                {period.active ? (
                                  <FiCheck />
                                ) : (
                                  <FiX />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditPeriod(period)}
                                title={tc("edit")}
                                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                              >
                                <FiEdit2 />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePeriod(period.id)}
                                title={tc("delete")}
                                className="rounded-lg p-2 text-gray-600 hover:bg-red-100 hover:text-red-600"
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination
                    page={periodPage}
                    pageSize={pageSize}
                    totalItems={config.holidayPeriods.length}
                    onPageChange={setPeriodPage}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "booking" && (
          <div>
            <h3 className="mb-5 text-base font-semibold text-gray-800">
              {t("settings.bookingPolicy")}
            </h3>
            <p className="mb-5 text-sm text-gray-500">
              {t("settings.bookingScope")}
            </p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field
                label={t("settings.cancelHours")}
                required
                hint={t("settings.cancelHoursHint")}
              >
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={config.cancelHoursBefore}
                  onChange={(e) =>
                    updateConfig("cancelHoursBefore", Number(e.target.value))
                  }
                />
              </Field>
              <Field label={t("settings.refundPercent")} required>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={inputClass}
                  value={config.refundPercent}
                  onChange={(e) =>
                    updateConfig("refundPercent", Number(e.target.value))
                  }
                />
              </Field>
              <Field
                label={t("settings.holdMinutes")}
                hint={t("settings.holdMinutesHint")}
              >
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={config.holdSeatMinutes}
                  onChange={(e) =>
                    updateConfig("holdSeatMinutes", Number(e.target.value))
                  }
                />
              </Field>
              <Field label={t("settings.minAdvanceHours")}>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={config.minAdvanceBookingHours}
                  onChange={(e) =>
                    updateConfig(
                      "minAdvanceBookingHours",
                      Number(e.target.value),
                    )
                  }
                />
              </Field>
              <Field label={t("settings.maxTickets")}>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={config.maxTicketsPerBooking}
                  onChange={(e) =>
                    updateConfig(
                      "maxTicketsPerBooking",
                      Number(e.target.value),
                    )
                  }
                />
              </Field>
              <Field label={t("settings.guestBooking")}>
                <div className="pt-1">
                  <Toggle
                    checked={config.allowGuestBooking}
                    onChange={() =>
                      updateConfig(
                        "allowGuestBooking",
                        !config.allowGuestBooking,
                      )
                    }
                  />
                </div>
              </Field>
            </div>
          </div>
        )}

        {tab === "parcel" && (
          <div>
            <h3 className="mb-5 text-base font-semibold text-gray-800">
              {t("settings.parcelPolicy")}
            </h3>
            <p className="mb-5 text-sm text-gray-500">
              {t("settings.parcelScope")}
            </p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label={t("settings.requireOtp")}>
                <div className="pt-1">
                  <Toggle
                    checked={config.requireOtpOnDelivery}
                    onChange={() =>
                      updateConfig(
                        "requireOtpOnDelivery",
                        !config.requireOtpOnDelivery,
                      )
                    }
                  />
                </div>
              </Field>
              <Field label={t("settings.maxWeight")}>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={config.maxParcelWeightKg}
                  onChange={(e) =>
                    updateConfig("maxParcelWeightKg", Number(e.target.value))
                  }
                />
              </Field>
              <Field
                label={t("settings.baseFee")}
                hint={t("settings.baseFeeHint")}
              >
                <CurrencyInput
                  className={inputClass}
                  value={config.parcelBaseFeeVnd}
                  onChange={(e) =>
                    updateConfig("parcelBaseFeeVnd", Number(e.target.value))
                  }
                />
              </Field>
              <Field label={t("settings.insuranceThreshold")}>
                <CurrencyInput
                  className={inputClass}
                  value={config.insuranceThresholdVnd}
                  onChange={(e) =>
                    updateConfig(
                      "insuranceThresholdVnd",
                      Number(e.target.value),
                    )
                  }
                />
              </Field>
              <Field label={t("settings.autoCloseDays")}>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={config.autoCloseParcelDays}
                  onChange={(e) =>
                    updateConfig("autoCloseParcelDays", Number(e.target.value))
                  }
                />
              </Field>
            </div>
            <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              {t("settings.feeSummary", {
                fee: formatVnd(config.parcelBaseFeeVnd),
                threshold: formatVnd(config.insuranceThresholdVnd),
              })}
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-5">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {t("settings.undo")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-medium text-white hover:bg-vr-600"
          >
            {t("settings.saveConfig")}
          </button>
        </div>
      </div>

      <Modal
        open={periodModalOpen}
        onClose={() => {
          setPeriodModalOpen(false);
          setEditingPeriod(null);
        }}
        title={
          editingPeriod
            ? t("settings.editPeriod")
            : t("settings.addPeriodTitle")
        }
      >
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t("settings.periodNameLabel")}</label>
            <input
              type="text"
              placeholder={t("settings.periodNamePlaceholder")}
              className={inputClass}
              value={periodForm.name}
              onChange={(e) =>
                setPeriodForm({ ...periodForm, name: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t("settings.fromDate")}</label>
              <CustomDateTimeInput
                type="date"
                className={inputClass}
                value={periodForm.startDate}
                onChange={(e) =>
                  setPeriodForm({ ...periodForm, startDate: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelClass}>{t("settings.toDate")}</label>
              <CustomDateTimeInput
                type="date"
                className={inputClass}
                value={periodForm.endDate}
                onChange={(e) =>
                  setPeriodForm({ ...periodForm, endDate: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>
              {t("settings.surchargePercent")}
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                className={inputClass}
                value={periodForm.surchargePercent}
                onChange={(e) =>
                  setPeriodForm({
                    ...periodForm,
                    surchargePercent: e.target.value,
                  })
                }
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                %
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {t("settings.surchargeHint")}
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setPeriodModalOpen(false);
                setEditingPeriod(null);
              }}
              className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={handleSavePeriod}
              className="flex-1 rounded-lg bg-vr-500 py-2 text-sm font-medium text-white hover:bg-vr-600"
            >
              {editingPeriod ? tc("update") : t("settings.add")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
