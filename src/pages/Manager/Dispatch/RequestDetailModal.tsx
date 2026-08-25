import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  FiClock,
  FiMap,
  FiMapPin,
  FiNavigation,
  FiPhone,
  FiTag,
  FiTruck,
  FiUsers,
  FiXCircle,
} from "react-icons/fi";
import type {
  ShuttleBookingGroup,
  ShuttleDirection,
  ShuttleRequestGroup,
} from "../../../api/vietride";
import FleetMap from "../../../components/FleetMap";
import Modal from "../../../components/Modal";
import { useNowTicker } from "../../../hooks/useNowTicker";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import {
  bookingPassengerLabel,
  bookingTicketCount,
  formatDistance,
  formatTime,
  getBookingDistance,
  getOrderedBookingGroups,
  isInboundDirection,
  shuttleRouteLabel,
  toRequestPickupMarkers,
  toRequestPickupPoints,
} from "./dispatchHelpers";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";

type RequestDetailModalProps = {
  open: boolean;
  onClose: () => void;
  group: ShuttleRequestGroup | null;
  canDispatchShuttle: boolean;
  canCancelShuttle: boolean;
  onAssign: () => void;
  onCancelBooking: (booking: ShuttleBookingGroup, label: string) => void;
  directionLabel: (direction: ShuttleDirection) => string;
};

export default function RequestDetailModal({
  open,
  onClose,
  group,
  canDispatchShuttle,
  canCancelShuttle,
  onAssign,
  onCancelBooking,
  directionLabel,
}: RequestDetailModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const currentTime = useNowTicker();
  const bookings = group ? getOrderedBookingGroups(group) : [];
  // Marker/fitPoints phải giữ nguyên identity giữa các lần render, nếu không
  // mỗi lượt tick của `useNowTicker` là một lần fitBounds thừa kéo khung nhìn về
  // giữa lúc điều độ viên đang xem.
  const pickupMarkers = useMemo(
    () => (group ? toRequestPickupMarkers(group) : []),
    [group],
  );
  const pickupPoints = useMemo(
    () => (group ? toRequestPickupPoints(group) : []),
    [group],
  );
  const cutoffPassed = Boolean(
    group &&
      isInboundDirection(group.direction) &&
       new Date(group.hardCutoffAt).getTime() <= currentTime,
  );

  const directionTone = group && isInboundDirection(group.direction)
    ? "bg-blue-100 text-blue-700"
    : "bg-teal-100 text-teal-700";
  const pendingSummary = group
    ? t("dispatch.pendingPassengerBookingSummary", {
        passengers: group.pendingPassengerCount,
        bookings: bookings.length,
        defaultValue:
          "{{passengers}} hành khách từ {{bookings}} lượt đặt vé",
      })
    : undefined;
  const footer = group ? (
    <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button variant="secondary" className="sm:min-w-32" onClick={onClose}>
        {tc("close")}
      </Button>
      {canDispatchShuttle && (
        <Button variant="primary" className="sm:min-w-44" onClick={onAssign} disabled={cutoffPassed || bookings.length === 0}>
          <FiTruck aria-hidden="true" />
          {cutoffPassed
            ? t("dispatch.cutoffPassed", {
                defaultValue: "Đã quá hạn điều phối",
              })
            : t("dispatch.assignVehicle")}
        </Button>
      )}
    </div>
  ) : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("dispatch.detailTitle")}
      subtitle={pendingSummary}
      icon={<FiNavigation size={20} aria-hidden="true" />}
      footer={footer}
      wide
    >
      {group && (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-vr-100 bg-gradient-to-br from-vr-50 via-white to-blue-50 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={directionTone + " inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"}>
                    {directionLabel(group.direction)}
                  </span>
                  {cutoffPassed && (
                    <Badge tone="danger">
                      {t("dispatch.cutoffPassed", {
                        defaultValue: "Đã quá hạn điều phối",
                      })}
                    </Badge>
                  )}
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("dispatch.mainRoute")}
                </p>
                <h3 className="mt-1 flex items-start gap-2 text-lg font-bold text-gray-900 sm:text-xl">
                  <FiMap className="mt-1 shrink-0 text-vr-900" aria-hidden="true" />
                  <span>{shuttleRouteLabel(group, group.stationName)}</span>
                </h3>
                <p className="mt-2 flex items-start gap-2 text-sm text-gray-600">
                  <FiMapPin className="mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />
                  <span>
                    {t("dispatch.station", { defaultValue: "Bến phục vụ" })}:{" "}
                    <span className="font-semibold text-gray-800">
                      {group.stationName}
                    </span>
                  </span>
                </p>
              </div>
              <div className="shrink-0 rounded-xl border border-white/80 bg-white/80 px-3.5 py-2.5 shadow-sm backdrop-blur">
                <p className="text-xs text-gray-500">
                  {t("dispatch.pendingPassengers", {
                    defaultValue: "Khách chờ điều phối",
                  })}
                </p>
                <p className="mt-0.5 text-sm font-bold text-gray-900">
                  {pendingSummary}
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="dispatch-trip-timeline">
            <h3 id="dispatch-trip-timeline" className="mb-3 text-sm font-semibold text-gray-900">
              {t("dispatch.tripInfo")}
            </h3>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3.5">
                <dt className="flex items-center gap-2 text-xs font-medium text-gray-500">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <FiClock aria-hidden="true" />
                  </span>
                  {t("dispatch.mainTripDeparture", {
                    defaultValue: "Khởi hành chuyến chính",
                  })}
                </dt>
                <dd className="mt-2 text-base font-bold text-gray-900">
                  {formatTime(group.departureDateTime)}
                </dd>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3.5">
                <dt className="flex items-center gap-2 text-xs font-medium text-gray-500">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <FiClock aria-hidden="true" />
                  </span>
                  {isInboundDirection(group.direction)
                    ? t("dispatch.dispatchCutoff", {
                        defaultValue: "Hạn hoàn tất trung chuyển",
                      })
                    : t("dispatch.earliestDispatch", {
                        defaultValue: "Bắt đầu trung chuyển từ",
                      })}
                </dt>
                <dd className="mt-2 text-base font-bold text-gray-900">
                  {formatTime(group.hardCutoffAt)}
                </dd>
              </div>
              <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-3.5 sm:col-span-2 lg:col-span-1">
                <dt className="flex items-center gap-2 text-xs font-medium text-gray-500">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                    <FiUsers aria-hidden="true" />
                  </span>
                  {t("dispatch.pendingPassengers", {
                    defaultValue: "Khách chờ điều phối",
                  })}
                </dt>
                <dd className="mt-2 text-base font-bold text-gray-900">
                  {pendingSummary}
                </dd>
              </div>
            </dl>
          </section>

          {/* Bản đồ điểm đón: BE trả sẵn `pickupLat`/`pickupLng` cho từng lượt
              đặt, trước đây màn chỉ hiện địa chỉ dạng chữ nên điều độ viên phải
              tự hình dung các điểm nằm ở đâu mới quyết được có gom chung một xe
              được không. Nhóm yêu cầu chưa có chuyến nên không có xe để bám —
              bản đồ chỉ vẽ điểm đón. */}
          {pickupMarkers.length > 0 && (
            <section aria-labelledby="dispatch-detail-map">
              <h3
                id="dispatch-detail-map"
                className="mb-3 text-sm font-semibold text-gray-900"
              >
                {t("dispatch.pickupMapTitle")}
              </h3>
              <div className="h-72 overflow-hidden rounded-xl border border-gray-200 sm:h-80">
                <FleetMap
                  vehicles={[]}
                  selectedId={null}
                  focusCenter={null}
                  fitPoints={pickupPoints}
                  routeStops={pickupMarkers}
                  onMarkerSelect={() => {}}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {t("dispatch.pickupMapHint")}
              </p>
            </section>
          )}

          <section
            className="rounded-2xl border border-gray-200 bg-gray-50/70 p-3 sm:p-4"
            aria-labelledby="dispatch-detail-bookings"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3
                  id="dispatch-detail-bookings"
                  className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-gray-900"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-vr-100 text-vr-900">
                    <FiNavigation aria-hidden="true" />
                  </span>
                  {t("dispatch.suggestedOrder", {
                    defaultValue: "Thứ tự đón/trả được đề xuất",
                  })}
                </h3>
                <p className="mt-1.5 text-xs text-gray-500 sm:ml-10">
                  {t("dispatch.routeOrderHint", {
                    defaultValue:
                      "Danh sách đã được sắp xếp theo lộ trình vận hành đề xuất.",
                  })}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-vr-100 bg-white px-3 py-1.5 text-xs font-semibold text-vr-900 shadow-sm">
                {t("dispatch.stopCount", {
                  count: bookings.length,
                  defaultValue: "{{count}} điểm",
                })}
              </span>
            </div>

            <ol className="space-y-3">
              {bookings.map((booking, index) => {
                const passengerLabel = bookingPassengerLabel(
                  booking,
                  t("dispatch.bookingOrdinal", { index: index + 1 }),
                );

                return (
                <li
                  key={booking.bookingId}
                  className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm transition hover:border-vr-200 hover:shadow-md sm:p-4"
                >
                  <div className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vr-800 text-sm font-bold text-white shadow-sm ring-4 ring-vr-50">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-600">
                            {t("dispatch.stopOrdinal", {
                              index: index + 1,
                              defaultValue: "Điểm {{index}}",
                            })}
                          </p>
                          <p className="mt-0.5 truncate text-sm font-semibold text-gray-800">
                            {passengerLabel}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="whitespace-nowrap rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                            {booking.passengerCount}{" "}
                            {t("dispatch.passengers", {
                              defaultValue: "khách",
                            })}
                          </span>
                          {canCancelShuttle && (
                            <button
                              type="button"
                              onClick={() =>
                                onCancelBooking(booking, passengerLabel)
                              }
                              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                            >
                              <FiXCircle aria-hidden="true" />
                              {t("dispatch.cancelRequest")}
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-3 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900">
                        <FiMapPin
                          className="mt-0.5 shrink-0 text-vr-900"
                          aria-hidden="true"
                        />
                        <span>{booking.pickupAddress}</span>
                      </p>
                      {/* Danh sách hành khách kèm SĐT: BE trả sẵn trong
                          `passengers[]`. Đây là chỗ duy nhất điều độ viên lấy
                          được số để gọi khi tài xế tới nơi mà không thấy
                          khách — sau khi phân công, lượt đặt rời khỏi hàng đợi
                          chờ và số này không còn tra được ở đâu. */}
                      {booking.passengers.length > 0 && (
                        <ul className="mt-3 space-y-1.5">
                          {booking.passengers.map((passenger, passengerIndex) => (
                            <li
                              key={
                                passenger.passengerUserId ??
                                `${booking.bookingId}-${passengerIndex}`
                              }
                              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm"
                            >
                              <span className="font-semibold text-gray-800">
                                {passenger.displayName?.trim() ||
                                  t("dispatch.unknownPassenger")}
                              </span>
                              {passenger.phone?.trim() ? (
                                <a
                                  href={`tel:${passenger.phone.trim()}`}
                                  className="inline-flex items-center gap-1.5 text-sm font-medium text-vr-900 hover:underline"
                                >
                                  <FiPhone size={13} aria-hidden="true" />
                                  {formatVietnamPhoneForDisplay(passenger.phone)}
                                </a>
                              ) : (
                                <span className="text-xs text-gray-500">
                                  {t("dispatch.noPassengerPhone")}
                                </span>
                              )}
                              {passenger.ticketIds.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                  <FiTag size={12} aria-hidden="true" />
                                  {t("dispatch.ticketCount", {
                                    count: passenger.ticketIds.length,
                                  })}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      <dl className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                        <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
                          <dt className="text-gray-500">
                            {t("dispatch.passengerCount", {
                              defaultValue: "Số khách",
                            })}
                          </dt>
                          <dd className="mt-0.5 font-semibold text-gray-800">
                            {booking.passengerCount}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
                          <dt className="text-gray-500">
                            {t("dispatch.ticketCountLabel")}
                          </dt>
                          <dd className="mt-0.5 font-semibold text-gray-800">
                            {bookingTicketCount(booking)}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
                          <dt className="text-gray-500">
                            {t("dispatch.roadDistance", {
                              defaultValue: "Khoảng cách đường bộ",
                            })}
                          </dt>
                          <dd className="mt-0.5 font-semibold text-gray-800">
                            {formatDistance(getBookingDistance(booking))}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
                          <dt className="text-gray-500">
                            {t("dispatch.requestedAt", {
                              defaultValue: "Yêu cầu lúc",
                            })}
                          </dt>
                          <dd className="mt-0.5 font-semibold text-gray-800">
                            {formatTime(booking.requestedAt)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </li>
                );
              })}
            </ol>
          </section>

        </div>
      )}
    </Modal>
  );
}
