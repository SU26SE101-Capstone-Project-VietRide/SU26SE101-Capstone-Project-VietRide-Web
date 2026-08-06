import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiClock, FiEye, FiMapPin, FiTruck, FiUsers } from "react-icons/fi";
import type {
  ShuttleDirection,
  ShuttleRequestGroup,
} from "../../../api/vietride";
import {
  formatDistance,
  formatTime,
  getBookingDistance,
  getGroupKey,
  getOrderedBookingGroups,
  isInboundDirection,
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
  const [currentTime] = useState(() => Date.now());

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
                  <p className="mt-2 break-all font-mono text-xs text-gray-500">
                    {t("dispatch.tripLabel")} {group.mainTripId}
                  </p>
                  <p className="mt-1 flex items-start gap-1.5 font-semibold text-gray-900">
                    <FiMapPin className="mt-0.5 shrink-0 text-vr-600" aria-hidden="true" />
                    {group.stationName}
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

              <dl className="grid gap-3 rounded-xl bg-gray-50 p-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <FiClock aria-hidden="true" />
                    {t("dispatch.mainTripDeparture", {
                      defaultValue: "Khởi hành chuyến chính",
                    })}
                  </dt>
                  <dd className="mt-1 font-semibold text-gray-900">
                    {formatTime(group.departureDateTime)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">
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
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <FiUsers aria-hidden="true" />
                    {t("dispatch.pendingPassengers", {
                      defaultValue: "Khách chờ điều phối",
                    })}
                  </dt>
                  <dd className="mt-1 font-semibold text-gray-900">
                    {group.pendingPassengerCount} · {bookings.length}{" "}
                    {t("dispatch.bookingGroups", {
                      defaultValue: "lượt đặt vé",
                    })}
                  </dd>
                </div>
              </dl>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("dispatch.suggestedOrder", {
                    defaultValue: "Thứ tự đón/trả được đề xuất",
                  })}
                </p>
                <ol className="grid gap-2 lg:grid-cols-2">
                  {bookings.map((booking, index) => (
                    <li
                      key={booking.bookingId}
                      className="flex min-w-0 gap-3 rounded-lg border border-gray-200 p-3"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vr-50 text-xs font-bold text-vr-700">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="break-all font-mono text-xs text-gray-500">
                          {booking.bookingId}
                        </p>
                        <p className="mt-1 text-sm font-medium text-gray-900">
                          {booking.pickupAddress}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {booking.passengerCount}{" "}
                          {t("dispatch.passengers", { defaultValue: "khách" })}
                          {" · "}
                          {formatDistance(getBookingDistance(booking))}
                        </p>
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
