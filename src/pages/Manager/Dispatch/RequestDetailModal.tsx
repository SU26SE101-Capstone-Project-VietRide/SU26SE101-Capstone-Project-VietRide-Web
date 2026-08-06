import { useTranslation } from "react-i18next";
import { FiMapPin } from "react-icons/fi";
import type {
  ShuttleDirection,
  ShuttleRequestGroup,
} from "../../../api/vietride";
import { DetailItem, DetailSection } from "../../../components/DetailLayout";
import Modal from "../../../components/Modal";
import {
  formatDistance,
  formatTime,
  getBookingDistance,
  getOrderedBookingGroups,
  isInboundDirection,
} from "./dispatchHelpers";

type RequestDetailModalProps = {
  open: boolean;
  onClose: () => void;
  group: ShuttleRequestGroup | null;
  canDispatchShuttle: boolean;
  onAssign: () => void;
  directionLabel: (direction: ShuttleDirection) => string;
};

export default function RequestDetailModal({
  open,
  onClose,
  group,
  canDispatchShuttle,
  onAssign,
  directionLabel,
}: RequestDetailModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const bookings = group ? getOrderedBookingGroups(group) : [];
  const cutoffPassed = Boolean(
    group &&
      isInboundDirection(group.direction) &&
      new Date(group.hardCutoffAt).getTime() <= Date.now(),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("dispatch.detailTitle")}
      wide
    >
      {group && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem
              label={t("dispatch.tripCode")}
              value={<span className="break-all font-mono">{group.mainTripId}</span>}
            />
            <DetailItem
              label={t("dispatch.type")}
              value={directionLabel(group.direction)}
            />
          </div>

          <DetailSection
            title={t("dispatch.tripInfo")}
            columns="three"
          >
            <DetailItem
              label={t("dispatch.station", { defaultValue: "Bến phục vụ" })}
              value={group.stationName}
            />
            <DetailItem
              label={t("dispatch.mainTripDeparture", {
                defaultValue: "Khởi hành chuyến chính",
              })}
              value={formatTime(group.departureDateTime)}
            />
            <DetailItem
              label={
                isInboundDirection(group.direction)
                  ? t("dispatch.dispatchCutoff", {
                      defaultValue: "Hạn hoàn tất trung chuyển",
                    })
                  : t("dispatch.earliestDispatch", {
                      defaultValue: "Bắt đầu trung chuyển từ",
                    })
              }
              value={formatTime(group.hardCutoffAt)}
            />
          </DetailSection>

          <section aria-labelledby="dispatch-detail-bookings">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3
                  id="dispatch-detail-bookings"
                  className="text-sm font-semibold text-gray-900"
                >
                  {t("dispatch.suggestedOrder", {
                    defaultValue: "Thứ tự đón/trả được đề xuất",
                  })}
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  {group.pendingPassengerCount}{" "}
                  {t("dispatch.passengers", { defaultValue: "khách" })} ·{" "}
                  {bookings.length}{" "}
                  {t("dispatch.bookingGroups", {
                    defaultValue: "lượt đặt vé",
                  })}
                </p>
              </div>
            </div>

            <ol className="space-y-2">
              {bookings.map((booking, index) => (
                <li
                  key={booking.bookingId}
                  className="rounded-xl border border-gray-200 p-3 sm:p-4"
                >
                  <div className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vr-50 text-sm font-bold text-vr-700">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-mono text-xs text-gray-500">
                        {booking.bookingId}
                      </p>
                      <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-gray-900">
                        <FiMapPin
                          className="mt-0.5 shrink-0 text-vr-600"
                          aria-hidden="true"
                        />
                        {booking.pickupAddress}
                      </p>
                      <dl className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-3">
                        <div>
                          <dt className="text-gray-400">
                            {t("dispatch.passengerCount", {
                              defaultValue: "Số khách",
                            })}
                          </dt>
                          <dd className="mt-0.5 font-semibold text-gray-800">
                            {booking.passengerCount}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-400">
                            {t("dispatch.roadDistance", {
                              defaultValue: "Khoảng cách đường bộ",
                            })}
                          </dt>
                          <dd className="mt-0.5 font-semibold text-gray-800">
                            {formatDistance(getBookingDistance(booking))}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-400">
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
              ))}
            </ol>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 flex-1 rounded-lg border border-gray-200 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("close")}
            </button>
            {canDispatchShuttle && (
              <button
                type="button"
                onClick={onAssign}
                disabled={cutoffPassed || bookings.length === 0}
                className="min-h-11 flex-1 rounded-lg bg-vr-600 px-4 py-2 font-semibold text-white transition hover:bg-vr-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cutoffPassed
                  ? t("dispatch.cutoffPassed", {
                      defaultValue: "Đã quá hạn điều phối",
                    })
                  : t("dispatch.assignVehicle")}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
