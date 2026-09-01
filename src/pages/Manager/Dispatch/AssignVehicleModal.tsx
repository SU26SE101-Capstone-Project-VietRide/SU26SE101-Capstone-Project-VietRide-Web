import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FiArrowDown, FiArrowUp, FiMap, FiRefreshCw } from "react-icons/fi";
import type {
  ResourceAvailabilityResult,
  ShuttleDirection,
  ShuttleRequestGroup,
  ShuttleRoutePreviewResult,
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
import { Button } from "../../../components/ui/Button";
import ShuttleRoutePreviewPanel from "./ShuttleRoutePreviewPanel";

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
  routePreview: ShuttleRoutePreviewResult | null;
  isPreviewingRoute: boolean;
  onPreviewRoute: () => void;
  isAssignmentStale: boolean;
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
  routePreview,
  isPreviewingRoute,
  onPreviewRoute,
  isAssignmentStale,
}: AssignVehicleModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const suggestedBookings = useMemo(
    () => (group ? getOrderedBookingGroups(group) : []),
    [group],
  );
  const bookings = useMemo(() => {
    const bookingById = new Map(
      suggestedBookings.map((booking) => [booking.bookingId, booking]),
    );
    const selected = form.selectedBookingIds
      .map((bookingId) => bookingById.get(bookingId))
      .filter((booking) => booking !== undefined);
    const selectedIds = new Set(form.selectedBookingIds);
    return [
      ...selected,
      ...suggestedBookings.filter(
        (booking) => !selectedIds.has(booking.bookingId),
      ),
    ];
  }, [form.selectedBookingIds, suggestedBookings]);
  const selectableBookingIds = useMemo(
    () =>
      suggestedBookings
        .filter((booking) => getBookingDistance(booking) !== null)
        .map((booking) => booking.bookingId),
    [suggestedBookings],
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

  function moveBooking(bookingId: string, offset: -1 | 1) {
    const currentIndex = form.selectedBookingIds.indexOf(bookingId);
    const nextIndex = currentIndex + offset;
    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= form.selectedBookingIds.length
    ) {
      return;
    }

    const nextIds = [...form.selectedBookingIds];
    [nextIds[currentIndex], nextIds[nextIndex]] = [
      nextIds[nextIndex],
      nextIds[currentIndex],
    ];
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
                  {t("dispatch.selectionOrderHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateSelectedBookings(
                    allSelectableBookingsSelected ? [] : selectableBookingIds,
                  )
                }
                disabled={
                  isSubmitting ||
                  selectableBookingIds.length === 0 ||
                  isAssignmentStale
                }
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
                const selectedIndex = form.selectedBookingIds.indexOf(
                  booking.bookingId,
                );
                const selected = selectedIndex >= 0;

                return (
                  <li key={booking.bookingId}>
                    <div
                      className={`flex items-start gap-2 rounded-lg border p-3 ${
                        selected
                          ? "border-vr-300 bg-vr-50"
                          : "border-gray-200 bg-white"
                      } ${distanceUnavailable ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <label
                        htmlFor={checkboxId}
                        className={`flex min-w-0 flex-1 gap-3 ${
                          distanceUnavailable
                            ? "cursor-not-allowed"
                            : "cursor-pointer"
                        }`}
                      >
                        <Checkbox
                          id={checkboxId}
                          className="mt-1"
                          checked={selected}
                          onChange={(checked) =>
                            toggleBooking(booking.bookingId, checked)
                          }
                          disabled={
                            distanceUnavailable ||
                            isSubmitting ||
                            isAssignmentStale
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-vr-900">
                              {selected ? selectedIndex + 1 : "–"}
                            </span>
                            <span className="truncate text-xs font-semibold text-gray-700">
                              {bookingPassengerLabel(
                                booking,
                                t("dispatch.bookingOrdinal", {
                                  index: selected ? selectedIndex + 1 : index + 1,
                                }),
                              )}
                            </span>
                          </span>
                          <span className="mt-1 block text-sm font-medium text-gray-900">
                            {booking.pickupAddress}
                          </span>
                          <span className="mt-1 block text-xs text-gray-500">
                            {booking.passengerCount}{" "}
                            {t("dispatch.passengers", {
                              defaultValue: "khách",
                            })}
                            {" · "}
                            {distanceUnavailable
                              ? t("dispatch.distanceUnavailable", {
                                  defaultValue: "Chưa có khoảng cách đường bộ",
                                })
                              : formatDistance(distance)}
                          </span>
                        </span>
                      </label>
                      {selected && (
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => moveBooking(booking.bookingId, -1)}
                            disabled={
                              selectedIndex === 0 ||
                              isSubmitting ||
                              isAssignmentStale
                            }
                            aria-label={t("dispatch.moveBookingUp", {
                              index: selectedIndex + 1,
                            })}
                            className="rounded-md border border-vr-200 bg-white p-1.5 text-vr-800 hover:bg-vr-100 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            <FiArrowUp aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveBooking(booking.bookingId, 1)}
                            disabled={
                              selectedIndex ===
                                form.selectedBookingIds.length - 1 ||
                              isSubmitting ||
                              isAssignmentStale
                            }
                            aria-label={t("dispatch.moveBookingDown", {
                              index: selectedIndex + 1,
                            })}
                            className="rounded-md border border-vr-200 bg-white p-1.5 text-vr-800 hover:bg-vr-100 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            <FiArrowDown aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
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
              />
            </label>
          </div>

          <section
            aria-labelledby="dispatch-route-preview"
            className="space-y-3 rounded-xl border border-vr-100 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3
                  id="dispatch-route-preview"
                  className="flex items-center gap-2 text-sm font-semibold text-gray-900"
                >
                  <FiMap className="text-vr-700" aria-hidden="true" />
                  {t("dispatch.routePreviewTitle")}
                </h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {t("dispatch.routePreviewHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={onPreviewRoute}
                disabled={
                  isSubmitting ||
                  isPreviewingRoute ||
                  form.selectedBookingIds.length === 0 ||
                  isAssignmentStale
                }
                className="min-h-10 rounded-lg border border-vr-200 px-3 py-2 text-xs font-semibold text-vr-900 hover:bg-vr-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {routePreview
                  ? t("dispatch.routePreviewAgain")
                  : t("dispatch.routePreviewAction")}
              </button>
            </div>
            <ShuttleRoutePreviewPanel
              result={routePreview}
              loading={isPreviewingRoute}
            />
          </section>

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
                form.selectedBookingIds.length === 0 ||
                routePreview === null ||
                isAssignmentStale
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
            <Button
              variant="primary"
              className="flex-1"
              type="submit"
              disabled={
                isSubmitting ||
                isLoadingResources ||
                form.selectedBookingIds.length === 0 ||
                exceedsCapacity ||
                routePreview === null ||
                availability?.available !== true ||
                isAssignmentStale
              }
            >
              {isSubmitting
                ? t("dispatch.assigning", { defaultValue: "Đang phân công..." })
                : t("dispatch.assignVehicle")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
