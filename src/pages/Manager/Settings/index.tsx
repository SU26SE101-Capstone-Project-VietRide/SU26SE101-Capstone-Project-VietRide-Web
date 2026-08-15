import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLatestRequest } from "../../../hooks/useLatestRequest";
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiX } from "react-icons/fi";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useToast } from "../../../components/toast/useToast";
import Modal from "../../../components/Modal";
import Pagination from "../../../components/Pagination";
import type { HolidayPricingPeriod, OperatorConfig } from "./types";
import { formatDateOnly } from "../../../utils/date";
import {
  createOperatorFareSurchargePeriod,
  deleteOperatorFareSurchargePeriod,
  getOperatorFareSurchargePeriods,
  getOperatorFareSurchargeSettings,
  updateOperatorFareSurchargePeriod,
  updateOperatorFareSurchargeSettings,
  type FareSurchargeStatus,
} from "../../../api/vietride";
import { fetchAllPages } from "../../../api/pagination";
import {
  inputClass,
  labelClass,
} from "../../../components/form/formClasses";

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

/** BE: `status = UPCOMING | APPLYING | EXPIRED | DISABLED`. */
const periodStatusTone: Record<FareSurchargeStatus, string> = {
  APPLYING: "bg-green-100 text-green-800",
  UPCOMING: "bg-blue-100 text-blue-800",
  EXPIRED: "bg-gray-100 text-gray-600",
  DISABLED: "bg-gray-100 text-gray-600",
};

/** Tên dịp: BE trim rồi giới hạn 1..120 ký tự. */
const PERIOD_NAME_MAX_LENGTH = 120;

/**
 * Màn này CHỈ cấu hình phụ thu theo dịp — đó là thứ duy nhất BE cho nhà xe tự
 * đặt (`/v1/operator/fare-surcharges`). Các mục "chính sách đặt vé" và "chính
 * sách gửi hàng" từng hiển thị ở đây chạy bằng mock: BE không có endpoint, bấm
 * lưu không đi đâu cả, và riêng phần hàng hoá còn mô tả sai cách tính giá (BE
 * tính theo tuyến: max(minimumPriceVnd, chargeableWeightKg × pricePerKgVnd),
 * cấu hình ở màn Hàng hoá). Đã gỡ để UI không hứa thứ hệ thống không làm.
 */
const emptyConfig: OperatorConfig = {
  autoApplyHolidayPricing: false,
  holidayPeriods: [],
};

export default function ManagerSettings() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const toast = useToast();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const [config, setConfig] = useState<OperatorConfig>({ ...emptyConfig });
  const [savedSnapshot, setSavedSnapshot] = useState<OperatorConfig>({
    ...emptyConfig,
  });
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [deletePeriodTarget, setDeletePeriodTarget] = useState<HolidayPricingPeriod | null>(null);
  const [editingPeriod, setEditingPeriod] =
    useState<HolidayPricingPeriod | null>(null);
  const [periodForm, setPeriodForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    surchargePercent: "15",
  });
  const [periodPage, setPeriodPage] = useState(1);
  const [fareLoading, setFareLoading] = useState(true);
  const [fareError, setFareError] = useState("");
  useToastFeedback({ error: fareError });
  const pageSize = 8;
  const startRequest = useLatestRequest();
  const loadFareData = useCallback(async () => {
    const isLatest = startRequest();
    setFareLoading(true);
    setFareError("");
    try {
      const [setting, periodItems] = await Promise.all([
        getOperatorFareSurchargeSettings(),
        fetchAllPages((params) => getOperatorFareSurchargePeriods(params)),
      ]);
      if (!isLatest()) return;
      setConfig((prev) => ({
        ...prev,
        autoApplyHolidayPricing: setting.isEnabled,
        holidayPeriods: periodItems.map((period) => ({
          id: period.periodId,
          name: period.name,
          startDate: period.startDate,
          endDate: period.endDate,
          surchargePercent: period.surchargePercent,
          active: period.isActive,
          // BE tự tính theo ngày Asia/Ho_Chi_Minh — không suy lại ở FE để hai
          // bên không lệch nhau lúc giao ngày.
          status: period.status,
        })),
      }));
    } catch (err) {
      if (!isLatest()) return;
      setFareError(
        err instanceof Error ? err.message : tRef.current("settings.loadFailed"),
      );
    } finally {
      if (isLatest()) setFareLoading(false);
    }
  }, [startRequest]);

  useEffect(() => {
    queueMicrotask(() => void loadFareData());
  }, [loadFareData]);

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

  const handleSave = async () => {
    setFareError("");
    try {
      await updateOperatorFareSurchargeSettings({
        isEnabled: config.autoApplyHolidayPricing,
      });
      setSavedSnapshot({ ...config });
      toast.success(t("settings.saveSuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.saveFailed"));
    }
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
      surchargePercent: "",
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

  const handleSavePeriod = async () => {
    setFareError("");
    const name = periodForm.name.trim();
    const surchargePercent = Number(periodForm.surchargePercent);
    // Cùng luật với BE (contract mục fare-surcharges): tên 1..120 sau khi trim,
    // % là SỐ NGUYÊN 1..100, và startDate <= endDate. Chặn tại đây để người dùng
    // thấy lỗi ngay thay vì ăn 422 VALIDATION_ERROR sau một vòng mạng.
    if (
      !name ||
      name.length > PERIOD_NAME_MAX_LENGTH ||
      !periodForm.startDate ||
      !periodForm.endDate ||
      periodForm.startDate > periodForm.endDate ||
      !Number.isInteger(surchargePercent) ||
      surchargePercent < 1 ||
      surchargePercent > 100
    ) {
      toast.error(t("settings.periodInvalid"));
      return;
    }

    try {
      if (editingPeriod) {
        await updateOperatorFareSurchargePeriod(editingPeriod.id, {
          name,
          startDate: periodForm.startDate,
          endDate: periodForm.endDate,
          surchargePercent,
          isActive: editingPeriod.active,
        });
      } else {
        await createOperatorFareSurchargePeriod({
          name,
          startDate: periodForm.startDate,
          endDate: periodForm.endDate,
          surchargePercent,
          isActive: true,
        });
      }
      setPeriodModalOpen(false);
      setEditingPeriod(null);
      toast.success(t(editingPeriod ? "settings.periodUpdateSuccess" : "settings.periodCreateSuccess"));
      await loadFareData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.saveFailed"));
    }
  };
  function handleDeletePeriod(period: HolidayPricingPeriod) {
    setDeletePeriodTarget(period);
  }

  const confirmDeletePeriod = async () => {
    if (!deletePeriodTarget) return;
    setFareError("");
    try {
      await deleteOperatorFareSurchargePeriod(deletePeriodTarget.id);
      setDeletePeriodTarget(null);
      toast.success(t("settings.periodDeleteSuccess"));
      await loadFareData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.saveFailed"));
    }
  };
  const handleTogglePeriod = async (id: string) => {
    const period = config.holidayPeriods.find((item) => item.id === id);
    if (!period) return;

    setFareError("");
    try {
      await updateOperatorFareSurchargePeriod(id, {
        name: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
        surchargePercent: period.surchargePercent,
        isActive: !period.active,
      });
      toast.success(
        t(
          period.active
            ? "settings.periodDisableSuccess"
            : "settings.periodEnableSuccess",
        ),
      );
      await loadFareData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.saveFailed"));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t("settings.title")}
        </h1>
        <p className="mt-1 text-sm text-gray-600">{t("settings.subtitle")}</p>
      </div>


      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="space-y-6">
            <div>
              <h3 className="mb-4 text-base font-semibold text-gray-800">
                {fareLoading ? tc("loading") : t("settings.holidaySurcharge")}
              </h3>
              {/* Chỉ có đúng một cờ bật/tắt: DTO của BE
                  (GET/PUT /v1/operator/fare-surcharges/settings) là `{ isEnabled }`.
                  Không có "% phụ thu mặc định" — mức phụ thu luôn thuộc về từng
                  dịp, ngoài dịp thì giá giữ nguyên. */}
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
                            {/* Dùng `status` của BE, không suy từ mỗi cờ bật/tắt:
                                dịp đã bật nhưng chưa tới ngày là UPCOMING, hết
                                ngày là EXPIRED — trước đây cả hai đều hiện
                                "Đang áp dụng". */}
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${periodStatusTone[period.status]}`}
                            >
                              {period.status === "APPLYING" ? (
                                <FiCheck />
                              ) : period.status === "DISABLED" ? (
                                <FiX />
                              ) : null}
                              {t(`settings.periodStatuses.${period.status}`)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => void handleTogglePeriod(period.id)}
                                title={period.active ? tc("off") : tc("on")}
                                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                              >
                                {period.active ? <FiCheck /> : <FiX />}
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
                                onClick={() => handleDeletePeriod(period)}
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
        wide
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
            <label className={labelClass}>
              {t("settings.periodNameLabel")}
            </label>
            <input
              type="text"
              placeholder={t("settings.periodNamePlaceholder")}
              maxLength={PERIOD_NAME_MAX_LENGTH}
              className={inputClass}
              value={periodForm.name}
              onChange={(e) =>
                setPeriodForm({ ...periodForm, name: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      <Modal
        open={deletePeriodTarget !== null}
        onClose={() => setDeletePeriodTarget(null)}
        title={tc("delete")}
        subtitle={t("settings.confirmDeletePeriod")}
        footer={
          <>
            <button type="button" onClick={() => setDeletePeriodTarget(null)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">{tc("cancel")}</button>
            <button type="button" onClick={() => void confirmDeletePeriod()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">{tc("delete")}</button>
          </>
        }
      >
        <p className="text-sm text-gray-700">{deletePeriodTarget?.name}</p>
      </Modal>
    </div>
  );
}



