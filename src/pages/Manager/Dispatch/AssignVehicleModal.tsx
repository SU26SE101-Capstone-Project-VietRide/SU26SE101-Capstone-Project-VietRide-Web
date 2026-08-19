import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FiRefreshCw } from "react-icons/fi";
import type {
  ResourceAvailabilityResult,
  ShuttleDirection,
  ShuttleRequestGroup,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import Modal from "../../../components/Modal";
import ResourceConflictPanel from "../../../components/ResourceConflictPanel";
import Checkbox from "../../../components/form/Checkbox";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import {
  bookingPassengerLabel,
  formatDistance,
  formatTime,
  getBookingDistance,
  getOrderedBookingGroups,
  getOrderedSelectedBookingIds,
  getSelectedPassengerCount,
  isInboundDirection,
  shuttleRouteLabel,
  type ShuttleDriver,
  type ShuttleVehicle,
} from "./dispatchHelpers";

export type AssignVehicleForm = {
  vehicleId: string;
  driverId: string;
  scheduledDepartureTime: string;
  scheduledEndTime: string;
  selectedBookingIds: string[];
  notes: string;
};

type AssignVehicleModalProps = {
  open: boolean;
  onClose: () => void;
  group: ShuttleRequestGroup | null;
  vehicles: ShuttleVehicle[];
  drivers: ShuttleDriver[];
  form: AssignVehicleForm;
  onFormChange: (form: AssignVehicleForm) => void;
  onSubmit: () => void;
  onRefreshResources: () => void;
  directionLabel: (direction: ShuttleDirection) => string;
  resourceError: string;
  submitError: string;
  isLoadingResources: boolean;
  isSubmitting: boolean;
  availability: ResourceAvailabilityResult | null;
  isCheckingAvailability: boolean;
  onCheckAvailability: () => void;
};

export default function AssignVehicleModal({
  open,
  onClose,
  group,
  vehicles,
  drivers,
  form,
  onFormChange,
  onSubmit,
  onRefreshResources,
  directionLabel,
  resourceError,
  submitError,
  isLoadingResources,
  isSubmitting,
  availability,
  isCheckingAvailability,
  onCheckAvailability,
}: AssignVehicleModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const bookings = useMemo(
    () => (group ? getOrderedBookingGroups(group) : []),
    [group],
  );
  const selectableBookingIds = useMemo(
    () =>
      bookings
        .filter((booking) => getBookingDistance(booking) !== null)
        .map((booking) => booking.bookingId),
    [bookings],
  );
  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === form.vehicleId,
  );
  const selectedPassengerCount = group
    ? getSelectedPassengerCount(group, form.selectedBookingIds)
    : 0;
  const exceedsCapacity = Boolean(
    selectedVehicle && selectedPassengerCount > selectedVehicle.capacity,
  );
  const allSelectableBookingsSelected =
    selectableBookingIds.length > 0 &&
    selectableBookingIds.every((bookingId) =>
      form.selectedBookingIds.includes(bookingId),
    );

  function updateSelectedBookings(nextIds: string[]) {
    if (!group) {
      return;
    }

    onFormChange({
      ...form,
      selectedBookingIds: getOrderedSelectedBookingIds(group, nextIds),
    });
  }

  function toggleBooking(bookingId: string, checked: boolean) {
    const nextIds = checked
      ? [...form.selectedBookingIds, bookingId]
      : form.selectedBookingIds.filter((id) => id !== bookingId);
    updateSelectedBookings(nextIds);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("dispatch.assignTitle")}
      wide
    >
      {group && (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <section className="rounded-xl border border-vr-200 bg-vr-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-vr-900">
                  {directionLabel(group.direction)}
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {shuttleRouteLabel(group, group.stationName)}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {group.stationName}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {t("dispatch.mainTripAt", {
                    time: formatTime(group.departureDateTime),
                  })}
                </p>
              </div>
              <div className="text-right text-xs text-gray-600">
                <p>
                  {isInboundDirection(group.direction)
                    ? t("dispatch.dispatchCutoff", {
                        defaultValue: "Hạn hoàn tất trung chuyển",
                      })
                    : t("dispatch.earliestDispatch", {
                        defaultValue: "Bắt đầu trung chuyển từ",
                      })}
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {formatTime(group.hardCutoffAt)}
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="dispatch-booking-selection">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3
                  id="dispatch-booking-selection"
                  className="text-sm font-semibold text-gray-900"
                >
                  {t("dispatch.selectBookings", {
                    defaultValue: "Chọn lượt đặt vé cần điều phối",
                  })}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {t("dispatch.selectionFollowsSuggestion", {
                    defaultValue:
                      "Thứ tự gửi sang hệ thống luôn theo lộ trình được đề xuất.",
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateSelectedBookings(
                    allSelectableBookingsSelected ? [] : selectableBookingIds,
                  )
                }
                disabled={isSubmitting || selectableBookingIds.length === 0}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {allSelectableBookingsSelected
                  ? t("dispatch.clearSelection", {
                      defaultValue: "Bỏ chọn tất cả",
                    })
                  : t("dispatch.selectAll", { defaultValue: "Chọn tất cả" })}
              </button>
            </div>

            <ol className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {bookings.map((booking, index) => {
                const distance = getBookingDistance(booking);
                const checkboxId = `dispatch-booking-${booking.bookingId}`;
                const distanceUnavailable = distance === null;

                return (
                  <li key={booking.bookingId}>
                    <label
                      htmlFor={checkboxId}
                      className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
                        form.selectedBookingIds.includes(booking.bookingId)
                          ? "border-vr-300 bg-vr-50"
                          : "border-gray-200 bg-white"
                      } ${distanceUnavailable ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <Checkbox
                        id={checkboxId}
                        className="mt-1"
                        checked={form.selectedBookingIds.includes(
                          booking.bookingId,
                        )}
                        onChange={(checked) =>
                          toggleBooking(booking.bookingId, checked)
                        }
                        disabled={distanceUnavailable || isSubmitting}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-vr-900">
                            {index + 1}
                          </span>
                          <span className="truncate text-xs font-semibold text-gray-700">
                            {bookingPassengerLabel(
                              booking,
                              t("dispatch.bookingOrdinal", { index: index + 1 }),
                            )}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm font-medium text-gray-900">
                          {booking.pickupAddress}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                          {booking.passengerCount}{" "}
                          {t("dispatch.passengers", { defaultValue: "khách" })}
                          {" · "}
                          {distanceUnavailable
                            ? t("dispatch.distanceUnavailable", {
                                defaultValue: "Chưa có khoảng cách đường bộ",
                              })
                            : formatDistance(distance)}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Danh sách xe/tài xế hỏng thì trước đây select chỉ trống trơn và lỗi
              chỉ thoáng qua ở toast ngoài modal — người dùng không biết vì sao
              và cũng không có cách thử lại. */}
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
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {t("dispatch.selectVehicle")}
              </label>
              <CustomSelect
                value={form.vehicleId}
                onChange={(event) =>
                  onFormChange({ ...form, vehicleId: event.target.value })
                }
                disabled={isLoadingResources || isSubmitting}
                aria-label={t("dispatch.selectVehicle")}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-vr-500"
              >
                <option value="">
                  {isLoadingResources
                    ? t("dispatch.loading", { defaultValue: "Đang tải..." })
                    : t("dispatch.selectVehiclePlaceholder")}
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
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {t("dispatch.driverLabel")}
              </label>
              <CustomSelect
                value={form.driverId}
                onChange={(event) =>
                  onFormChange({ ...form, driverId: event.target.value })
                }
                disabled={isLoadingResources || isSubmitting}
                aria-label={t("dispatch.driverLabel")}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-vr-500"
              >
                <option value="">
                  {isLoadingResources
                    ? t("dispatch.loading", { defaultValue: "Đang tải..." })
                    : t("dispatch.selectDriverPlaceholder")}
                </option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name} - {formatVietnamPhoneForDisplay(driver.phone)}
                  </option>
                ))}
              </CustomSelect>
            </div>
          </section>

          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              exceedsCapacity
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-gray-200 bg-gray-50 text-gray-700"
            }`}
            role={exceedsCapacity ? "alert" : "status"}
          >
            {t("dispatch.selectedCapacity", {
              defaultValue: "Đã chọn {{passengers}} khách / {{capacity}} chỗ",
              passengers: selectedPassengerCount,
              capacity: selectedVehicle?.capacity ?? "-",
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                {t("dispatch.scheduledDeparture")}
              </span>
              <CustomDateTimeInput
                type="datetime-local"
                value={form.scheduledDepartureTime}
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    scheduledDepartureTime: event.target.value,
                  })
                }
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-vr-500 disabled:bg-gray-100"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                {t("dispatch.scheduledEnd")}
              </span>
              <CustomDateTimeInput
                type="datetime-local"
                value={form.scheduledEndTime}
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    scheduledEndTime: event.target.value,
                  })
                }
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-vr-500 disabled:bg-gray-100"
              />
            </label>
          </div>

          <div>
            <label
              htmlFor="dispatch-notes"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              {tc("note")}
            </label>
            <textarea
              id="dispatch-notes"
              name="notes"
              value={form.notes}
              onChange={(event) =>
                onFormChange({ ...form, notes: event.target.value })
              }
              placeholder={t("dispatch.driverNotesPlaceholder")}
              rows={3}
              maxLength={1_000}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-vr-500 disabled:bg-gray-100"
            />
            <p className="mt-1 text-right text-xs text-gray-600">
              {form.notes.length}/1000
            </p>
          </div>

          {/* Lỗi submit phải nằm ngay cạnh nút gửi: toast ngoài modal biến mất
              sau vài giây trong khi người dùng vẫn đang nhìn form. */}
          {submitError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {submitError}
            </p>
          )}

          <ResourceConflictPanel
            result={availability}
            loading={isCheckingAvailability}
          />

          <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row">
            <button
              type="button"
              onClick={onCheckAvailability}
              disabled={
                isSubmitting ||
                isCheckingAvailability ||
                isLoadingResources ||
                form.selectedBookingIds.length === 0
              }
              className="min-h-11 flex-1 rounded-lg border border-vr-200 px-4 py-2 font-medium text-vr-900 hover:bg-vr-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("resourceConflict.check")}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-11 flex-1 rounded-lg border border-gray-200 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                isLoadingResources ||
                form.selectedBookingIds.length === 0 ||
                exceedsCapacity
              }
              className="min-h-11 flex-1 rounded-lg bg-vr-800 px-4 py-2 font-semibold text-white transition hover:bg-vr-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? t("dispatch.assigning", { defaultValue: "Đang phân công..." })
                : t("dispatch.assignVehicle")}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
