import { useTranslation } from "react-i18next";
import { FiClock, FiEye, FiMap, FiMapPin, FiTruck, FiUsers } from "react-icons/fi";
import type {
  ShuttleDirection,
  ShuttleRequestGroup,
} from "../../../api/vietride";
import { useNowTicker } from "../../../hooks/useNowTicker";
import {
  bookingPassengerLabel,
  formatDistance,
  formatTime,
  getBookingDistance,
  getGroupKey,
  getOrderedBookingGroups,
  isInboundDirection,
  shuttleRouteLabel,
} from "./dispatchHelpers";

type RequestTableProps = {
  groups: ShuttleRequestGroup[];
  isLoading: boolean;
  canDispatchShuttle: boolean;
  onAssign: (group: ShuttleRequestGroup) => void;
  onOpenDetail: (group: ShuttleRequestGroup) => void;
  directionLabel: (direction: ShuttleDirection) => string;
};

export default function RequestTable({
  groups,
  isLoading,
  canDispatchShuttle,
  onAssign,
  onOpenDetail,
  directionLabel,
}: RequestTableProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  // Hạn điều phối phải so với thời gian thật, không phải lúc mở trang
  const currentTime = useNowTicker();

  if (isLoading && groups.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-gray-500" role="status">
        {t("dispatch.loading")}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <FiTruck className="mx-auto text-gray-300" size={32} aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-gray-700">
          {t("dispatch.noRequests")}
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100" aria-label={t("dispatch.awaiting")}>
      {groups.map((group) => {
        const bookings = getOrderedBookingGroups(group);
        const cutoffPassed =
          isInboundDirection(group.direction) &&
           new Date(group.hardCutoffAt).getTime() <= currentTime;

        return (
          <li key={getGroupKey(group)} className="p-4 sm:p-5">
            <article className="space-y-4">
              <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isInboundDirection(group.direction)
                          ? "bg-blue-50 text-blue-700"
                          : "bg-teal-50 text-teal-700"
                      }`}
                    >
                      {directionLabel(group.direction)}
                    </span>
                    {cutoffPassed && (
                      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                        {t("dispatch.cutoffPassed", {
                          defaultValue: "Đã quá hạn điều phối",
                        })}
                      </span>
                    )}
                  </div>
                  {/* Định danh nhóm yêu cầu là tên tuyến + bến + giờ chuyến
                      chính, không phải UUID chuyến — điều độ viên không đọc
                      được UUID. */}
                  <p className="mt-2 flex items-start gap-1.5 text-base font-bold text-gray-900">
                    <FiMap
                      className="mt-1 shrink-0 text-vr-600"
                      aria-hidden="true"
                    />
                    {shuttleRouteLabel(group, group.stationName)}
                  </p>
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-600">
                    <FiMapPin
                      className="mt-0.5 shrink-0 text-gray-400"
                      aria-hidden="true"
                    />
                    {group.stationName}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {t("dispatch.mainTripAt", {
                      time: formatTime(group.departureDateTime),
                    })}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenDetail(group)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <FiEye aria-hidden="true" /> {tc("details")}
                  </button>
                  {canDispatchShuttle && (
                    <button
                      type="button"
                      onClick={() => onAssign(group)}
                      disabled={cutoffPassed || bookings.length === 0}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-vr-600 px-3 py-2 text-sm font-semibold text-white hover:bg-vr-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FiTruck aria-hidden="true" /> {t("dispatch.assignVehicle")}
                    </button>
                  )}
                </div>
              </header>

              <dl className="grid gap-2.5 rounded-2xl bg-gray-50/80 p-2.5 text-sm sm:grid-cols-3">
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <FiClock className="text-blue-600" aria-hidden="true" />
                    {t("dispatch.mainTripDeparture", {
                      defaultValue: "Khởi hành chuyến chính",
                    })}
                  </dt>
                  <dd className="mt-1 font-semibold text-gray-900">
                    {formatTime(group.departureDateTime)}
                  </dd>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <FiClock className="text-amber-600" aria-hidden="true" />
                    {isInboundDirection(group.direction)
                      ? t("dispatch.dispatchCutoff", {
                          defaultValue: "Hạn hoàn tất trung chuyển",
                        })
                      : t("dispatch.earliestDispatch", {
                          defaultValue: "Bắt đầu trung chuyển từ",
                        })}
                  </dt>
                  <dd className="mt-1 font-semibold text-gray-900">
                    {formatTime(group.hardCutoffAt)}
                  </dd>
                </div>
                <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-3">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <FiUsers className="text-teal-600" aria-hidden="true" />
                    {t("dispatch.pendingPassengers", {
                      defaultValue: "Khách chờ điều phối",
                    })}
                  </dt>
                  <dd className="mt-1 font-semibold text-gray-900">
                    {t("dispatch.pendingPassengerBookingSummary", {
                      passengers: group.pendingPassengerCount,
                      bookings: bookings.length,
                      defaultValue:
                        "{{passengers}} hành khách từ {{bookings}} lượt đặt vé",
                    })}
                  </dd>
                </div>
              </dl>

              <div>
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t("dispatch.suggestedOrder", {
                      defaultValue: "Thứ tự đón/trả được đề xuất",
                    })}
                  </p>
                  <span className="rounded-full bg-vr-50 px-2.5 py-1 text-xs font-semibold text-vr-700">
                    {t("dispatch.stopCount", {
                      count: bookings.length,
                      defaultValue: "{{count}} điểm",
                    })}
                  </span>
                </div>
                <ol className="grid gap-2">
                  {bookings.map((booking, index) => (
                    <li
                      key={booking.bookingId}
                      className="group flex min-w-0 gap-3 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-vr-200 hover:bg-vr-50/30"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vr-50 text-xs font-bold text-vr-700 ring-4 ring-white">
                        {index + 1}
                      </span>
                      <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(150px,0.7fr)_minmax(260px,1.5fr)_auto] sm:items-center">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                            {t("dispatch.stopOrdinal", {
                              index: index + 1,
                              defaultValue: "Điểm {{index}}",
                            })}
                          </p>
                          <p className="mt-0.5 truncate text-sm font-semibold text-gray-800">
                            {bookingPassengerLabel(
                              booking,
                              t("dispatch.bookingOrdinal", { index: index + 1 }),
                            )}
                          </p>
                        </div>
                        <p className="flex min-w-0 items-start gap-1.5 text-sm font-medium text-gray-900">
                          <FiMapPin
                            className="mt-0.5 shrink-0 text-vr-600"
                            aria-hidden="true"
                          />
                          <span>{booking.pickupAddress}</span>
                        </p>
                        <div className="flex flex-wrap gap-1.5 sm:justify-end">
                          <span className="whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                            {booking.passengerCount}{" "}
                            {t("dispatch.passengers", {
                              defaultValue: "khách",
                            })}
                          </span>
                          <span className="whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                            {formatDistance(getBookingDistance(booking))}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
