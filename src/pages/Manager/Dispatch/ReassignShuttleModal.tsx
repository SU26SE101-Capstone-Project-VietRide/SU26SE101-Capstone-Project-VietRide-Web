// Đổi xe / tài xế của một chuyến trung chuyển đã lên lịch.
//
// Khác hộp thoại HUỶ ở chỗ: huỷ thì hành khách mất chuyến, còn đổi phân công thì
// chuyến vẫn chạy — nên đây không phải hành động phá huỷ, nhưng vẫn bắt buộc lý
// do vì BE gửi nguyên văn lý do đó vào thông báo cho hành khách
// (`SHUTTLE_REASSIGNED`).
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiRefreshCw, FiUser, FiTruck } from "react-icons/fi";
import type { OperatorShuttleTripListItem } from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";
import { Button } from "../../../components/ui/Button";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import type { ShuttleDriver, ShuttleVehicle } from "./dispatchHelpers";

export type ReassignShuttleForm = {
  vehicleId: string;
  driverId: string;
  reason: string;
};

type ReassignShuttleModalProps = {
  open: boolean;
  trip: OperatorShuttleTripListItem | null;
  vehicles: ShuttleVehicle[];
  drivers: ShuttleDriver[];
  form: ReassignShuttleForm;
  onFormChange: (form: ReassignShuttleForm) => void;
  onClose: () => void;
  onSubmit: () => void;
  onRefreshResources: () => void;
  resourceError: string;
  submitError: string;
  isLoadingResources: boolean;
  isSubmitting: boolean;
};

export default function ReassignShuttleModal({
  open,
  trip,
  vehicles,
  drivers,
  form,
  onFormChange,
  onClose,
  onSubmit,
  onRefreshResources,
  resourceError,
  submitError,
  isLoadingResources,
  isSubmitting,
}: ReassignShuttleModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [touchedReason, setTouchedReason] = useState(false);

  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === form.vehicleId,
  );

  // Xe mới phải đủ chỗ cho số khách ĐANG được gán. BE cũng chặn bằng
  // `409 SHUTTLE_CAPACITY_EXCEEDED`, nhưng bắt ở đây thì điều độ viên biết
  // trước khi bấm, và biết thiếu bao nhiêu chỗ.
  const exceedsCapacity = Boolean(
    trip && selectedVehicle && trip.passengerCount > selectedVehicle.capacity,
  );

  // Không đổi gì mà vẫn gửi thì BE trả 200 nhưng không phát thông báo — người
  // dùng tưởng đã đổi. Chặn ở đây cho rõ ràng.
  const hasChange = useMemo(() => {
    if (!trip) return false;
    return (
      (Boolean(form.vehicleId) && form.vehicleId !== trip.vehicle.id) ||
      (Boolean(form.driverId) && form.driverId !== trip.driver.id)
    );
  }, [form.driverId, form.vehicleId, trip]);

  const reasonMissing = !form.reason.trim();
  const canSubmit =
    !isSubmitting && !isLoadingResources && hasChange && !reasonMissing && !exceedsCapacity;

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<FiRefreshCw size={20} />}
      title={t("dispatch.reassignTitle")}
      subtitle={trip?.vehicle.licensePlate || undefined}
      footer={
        <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {tc("cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setTouchedReason(true);
              if (canSubmit) onSubmit();
            }}
            disabled={isSubmitting || isLoadingResources}
          >
            {isSubmitting ? tc("processing") : t("dispatch.reassignConfirm")}
          </Button>
        </div>
      }
    >
      {trip && (
        <div className="space-y-4">
          {/* Phân công hiện tại — đổi mà không thấy đang đổi TỪ cái gì thì rất
              dễ chọn nhầm chính cái đang dùng. */}
          <section className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("dispatch.currentAssignment")}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <p className="flex items-center gap-2 text-sm text-gray-800">
                <FiTruck className="shrink-0 text-gray-500" aria-hidden="true" />
                {trip.vehicle.licensePlate || t("dispatch.unknownVehicle")}
              </p>
              <p className="flex items-center gap-2 text-sm text-gray-800">
                <FiUser className="shrink-0 text-gray-500" aria-hidden="true" />
                {trip.driver.displayName?.trim() ||
                  t("dispatch.unassignedDriver")}
                {trip.driver.phone
                  ? ` · ${formatVietnamPhoneForDisplay(trip.driver.phone)}`
                  : ""}
              </p>
            </div>
            <p className="mt-2 text-xs text-gray-600">
              {t("dispatch.reassignPassengerCount", {
                count: trip.passengerCount,
              })}
            </p>
          </section>

          {resourceError && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{resourceError}</span>
              <button
                type="button"
                onClick={onRefreshResources}
                disabled={isLoadingResources}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiRefreshCw
                  size={13}
                  className={isLoadingResources ? "animate-spin" : ""}
                  aria-hidden="true"
                />
                {tc("retry")}
              </button>
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>{t("dispatch.newVehicle")}</span>
              <CustomSelect
                value={form.vehicleId}
                onChange={(event) =>
                  onFormChange({ ...form, vehicleId: event.target.value })
                }
                disabled={isLoadingResources || isSubmitting}
                aria-label={t("dispatch.newVehicle")}
                className={inputClass}
              >
                <option value="">
                  {isLoadingResources
                    ? tc("loading")
                    : t("dispatch.keepCurrentVehicle")}
                </option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {t("dispatch.vehicleOption", {
                      plate: vehicle.plate,
                      model: vehicle.vehicleModel,
                      capacity: vehicle.capacity,
                    })}
                  </option>
                ))}
              </CustomSelect>
            </label>

            <label className="block">
              <span className={labelClass}>{t("dispatch.newDriver")}</span>
              <CustomSelect
                value={form.driverId}
                onChange={(event) =>
                  onFormChange({ ...form, driverId: event.target.value })
                }
                disabled={isLoadingResources || isSubmitting}
                aria-label={t("dispatch.newDriver")}
                className={inputClass}
              >
                <option value="">
                  {isLoadingResources
                    ? tc("loading")
                    : t("dispatch.keepCurrentDriver")}
                </option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name} - {formatVietnamPhoneForDisplay(driver.phone)}
                  </option>
                ))}
              </CustomSelect>
            </label>
          </section>

          {exceedsCapacity && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {t("dispatch.reassignCapacityExceeded", {
                passengers: trip.passengerCount,
                capacity: selectedVehicle?.capacity ?? 0,
              })}
            </p>
          )}

          <label className="block">
            <span className={labelClass}>{t("dispatch.reassignReason")}</span>
            <textarea
              value={form.reason}
              onChange={(event) =>
                onFormChange({ ...form, reason: event.target.value })
              }
              onBlur={() => setTouchedReason(true)}
              rows={3}
              maxLength={500}
              disabled={isSubmitting}
              placeholder={t("dispatch.reassignReasonPlaceholder")}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-gray-500">
              {t("dispatch.reassignReasonHint")}
            </span>
          </label>

          {touchedReason && reasonMissing && (
            <p
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              {t("dispatch.reassignReasonRequired")}
            </p>
          )}

          {!hasChange && !reasonMissing && (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {t("dispatch.reassignNoChange")}
            </p>
          )}

          {submitError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {submitError}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
