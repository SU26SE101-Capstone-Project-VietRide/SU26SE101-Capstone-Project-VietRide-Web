// Thẻ theo dõi một chuyến trung chuyển: danh tính lấy từ biển số + tài xế,
// vị trí/ETA tải theo yêu cầu.
import { useTranslation } from "react-i18next";
import {
  FiMapPin,
  FiNavigation,
  FiRefreshCw,
  FiUserCheck,
  FiUsers,
  FiXCircle,
} from "react-icons/fi";
import type {
  OperatorShuttleTripListItem,
  OperatorShuttleTripStatus,
  ShuttleDirection,
} from "../../../api/vietride";
import { useNowTicker } from "../../../hooks/useNowTicker";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import {
  formatClock,
  formatDistance,
  formatTime,
  isStaleSignal,
  isTrackableShuttleStatus,
  nextPickupLabel,
  type ShuttleTripTracking,
} from "./dispatchHelpers";

type ShuttleTrackingCardProps = {
  trip: OperatorShuttleTripListItem;
  tracking: ShuttleTripTracking | undefined;
  canCancelShuttle: boolean;
  /** Xe đang được bám trên bản đồ */
  isSelected: boolean;
  /** Đã có toạ độ nên mới có marker để bám — chưa có thì ẩn nút xem bản đồ */
  hasPosition: boolean;
  onSelect: (shuttleTripId: string) => void;
  onRefresh: (shuttleTripId: string) => void;
  onCancel: (trip: OperatorShuttleTripListItem) => void;
  /** Chỉ OPERATOR_ADMIN mới đổi được phân công (BE khoá theo role) */
  canReassignShuttle: boolean;
  onReassign: (trip: OperatorShuttleTripListItem) => void;
  onOpenDetail: (trip: OperatorShuttleTripListItem) => void;
  directionLabel: (direction: ShuttleDirection) => string;
};

// Chỉ chuyến chưa kết thúc mới huỷ được; COMPLETED/CANCELLED gọi lên BE sẽ trả
// SHUTTLE_TRIP_INVALID_STATE nên không hiện nút.
const CANCELLABLE_STATUSES: ReadonlyArray<OperatorShuttleTripStatus> = [
  "SCHEDULED",
  "IN_PROGRESS",
];

const statusBadgeClass: Record<OperatorShuttleTripStatus, string> = {
  SCHEDULED: "bg-amber-50 text-amber-800 ring-1 ring-amber-100",
  IN_PROGRESS: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100",
  COMPLETED: "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
  CANCELLED: "bg-red-50 text-red-700 ring-1 ring-red-100",
};

export default function ShuttleTrackingCard({
  trip,
  tracking,
  canCancelShuttle,
  canReassignShuttle,
  onReassign,
  isSelected,
  hasPosition,
  onSelect,
  onRefresh,
  onCancel,
  onOpenDetail,
  directionLabel,
}: ShuttleTrackingCardProps) {
  const { t } = useTranslation("manager");
  // "Tín hiệu cũ" phải tính theo thời gian thật: thẻ đứng im trên màn trực ban
  // cả buổi, chụp `Date.now()` một lần lúc render đầu là không bao giờ báo cũ.
  const now = useNowTicker();
  const isRefreshing = tracking?.isRefreshing ?? false;
  const signalLost = isStaleSignal(tracking?.latest, now);
  const speedKmh = tracking?.latest?.speedKmh;
  const driverName = trip.driver.displayName?.trim();
  const canCancel =
    canCancelShuttle && CANCELLABLE_STATUSES.includes(trip.status);
  // BE chỉ cho đổi phân công khi chuyến CHƯA chạy — `IN_PROGRESS` gọi lên sẽ
  // nhận `409 SHUTTLE_TRIP_INVALID_STATE`, nên không bày nút ra làm gì.
  const canReassign = canReassignShuttle && trip.status === "SCHEDULED";
  // Chuyến đã kết thúc không còn nguồn GPS: thẻ chuyển sang dạng tổng kết
  // (giờ chạy thật + giờ hoàn tất) và bỏ nút làm mới vị trí — bấm cũng chỉ
  // nhận về `latest = null`, hiện ra như thể màn hỏng.
  const isTrackable = isTrackableShuttleStatus(trip.status);

  return (
    <article
      className={`flex flex-col rounded-xl border bg-white p-4 shadow-sm transition ${
        isSelected
          ? "border-vr-500 ring-2 ring-vr-100"
          : "border-gray-200"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-gray-900">
              {trip.vehicle.licensePlate || t("dispatch.unknownVehicle")}
            </h3>
            <span
              className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass[trip.status]}`}
            >
              {t(`dispatch.shuttleStatus.${trip.status}`)}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-gray-600">
            {driverName || t("dispatch.unassignedDriver")}
            {trip.driver.phone
              ? ` · ${formatVietnamPhoneForDisplay(trip.driver.phone)}`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasPosition && (
            <button
              type="button"
              onClick={() => onSelect(trip.shuttleTripId)}
              aria-pressed={isSelected}
              className={`inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition ${
                isSelected
                  ? "border-vr-500 bg-vr-800 text-white"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
              title={t("dispatch.showOnMap")}
              aria-label={t("dispatch.showOnMap")}
            >
              <FiMapPin size={15} />
            </button>
          )}
          {isTrackable && (
            <button
              type="button"
              onClick={() => onRefresh(trip.shuttleTripId)}
              disabled={isRefreshing}
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              title={t("dispatch.refreshTracking")}
              aria-label={t("dispatch.refreshTracking")}
            >
              <FiRefreshCw
                size={15}
                className={isRefreshing ? "animate-spin" : ""}
              />
            </button>
          )}
          {canReassign && (
            <button
              type="button"
              onClick={() => onReassign(trip)}
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50"
              title={t("dispatch.reassignTitle")}
              aria-label={t("dispatch.reassignTitle")}
            >
              <FiUserCheck size={15} />
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={() => onCancel(trip)}
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50"
              title={t("dispatch.cancelShuttleTrip")}
              aria-label={t("dispatch.cancelShuttleTrip")}
            >
              <FiXCircle size={15} />
            </button>
          )}
        </div>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs">
        <div>
          <dt className="text-gray-500">{t("dispatch.type")}</dt>
          <dd className="mt-0.5 font-semibold text-gray-800">
            {directionLabel(trip.direction)}
          </dd>
        </div>
        <div>
          {/* Giờ kết thúc dự kiến là mốc quyết định chuyến trung chuyển có kịp
              chuyến chính hay không — trước đây chỉ nằm trong modal chi tiết. */}
          <dt className="text-gray-500">{t("dispatch.scheduledWindow")}</dt>
          <dd className="mt-0.5 font-semibold text-gray-800">
            {formatTime(trip.scheduledDepartureTime)} →{" "}
            {formatClock(trip.scheduledEndTime)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-gray-500">
            <FiUsers size={12} aria-hidden="true" />
            {t("dispatch.passengerCount")}
          </dt>
          <dd className="mt-0.5 font-semibold text-gray-800">
            {trip.passengerCount}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-gray-500">
            <FiMapPin size={12} aria-hidden="true" />
            {t("dispatch.stopCount")}
          </dt>
          <dd className="mt-0.5 font-semibold text-gray-800">
            {trip.stopCount}
          </dd>
        </div>
      </dl>

      {tracking?.error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {tracking.error}
        </p>
      )}

      {/* Chuyến đã xong/đã huỷ: thay khối theo dõi trực tiếp bằng mốc thời gian
          thực tế. Không có nguồn GPS nào để chờ nên nói "chưa gửi tín hiệu" ở
          đây là sai. */}
      {!isTrackable ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-gray-100 px-3 py-2.5 text-xs">
          <div>
            <dt className="text-gray-500">
              {t("dispatch.actualDepartureTime")}
            </dt>
            <dd className="mt-0.5 font-semibold text-gray-800">
              {formatTime(trip.actualDepartureTime ?? undefined)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">{t("dispatch.completedAt")}</dt>
            <dd className="mt-0.5 font-semibold text-gray-800">
              {formatTime(trip.completedAt ?? undefined)}
            </dd>
          </div>
        </dl>
      ) : !tracking?.latest && !tracking?.eta && !tracking?.error ? (
        <p className="mt-3 rounded-lg border border-dashed border-gray-200 px-3 py-3 text-center text-xs text-gray-500">
          {t("dispatch.trackingWaitingSignalHint")}
        </p>
      ) : (
        <div className="mt-3 space-y-2 text-xs">
          {/* Trước đây ô này in toạ độ thô ("10.762622, 106.660172") — không ai
              đọc được, mà vị trí thì đã có marker trên bản đồ. Thay bằng thứ
              đọc lướt là ra: xe đang chạy hay đang đứng, tín hiệu còn tươi
              không. */}
          <div
            className={`rounded-lg border px-3 py-2 ${
              signalLost ? "border-amber-200 bg-amber-50" : "border-gray-100"
            }`}
          >
            <p className="flex flex-wrap items-center gap-1.5 font-medium text-gray-500">
              {t("dispatch.vehicleSignal")}
              {tracking?.isLive && !signalLost && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700"
                  title={t("dispatch.realtime.connected")}
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  {t("dispatch.liveBadge")}
                </span>
              )}
              {signalLost && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                  {t("dispatch.signalLostBadge")}
                </span>
              )}
            </p>
            <p className="mt-0.5 font-semibold text-gray-900">
              {!tracking?.latest
                ? t("dispatch.noLocationYet")
                : speedKmh == null
                  ? t("dispatch.speedUnknown")
                  : speedKmh > 2
                    ? t("dispatch.speedValue", { speed: Math.round(speedKmh) })
                    : t("dispatch.vehicleStopped")}
            </p>
            {tracking?.latest && (
              <p className="mt-0.5 text-gray-500">
                {t("dispatch.recordedAt", {
                  time: formatTime(tracking.latest.recordedAt),
                })}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-gray-100 px-3 py-2">
            <p className="flex items-center gap-1 font-medium text-gray-500">
              <FiNavigation size={12} aria-hidden="true" />
              {t("dispatch.nextPickup")}
            </p>
            <p className="mt-0.5 font-semibold text-gray-900">
              {tracking?.eta
                ? t("dispatch.etaValue", {
                    minutes: tracking.eta.etaMinutes,
                    distance: formatDistance(tracking.eta.distanceMeters),
                  })
                : t("dispatch.noEtaYet")}
            </p>
            {/* Giờ đến dự kiến dạng đồng hồ: "còn 12 phút" không so được với
                hạn chuyến chính, "đến lúc 05:42" thì so được ngay. */}
            {tracking?.eta && (
              <p className="mt-0.5 font-medium text-gray-700">
                {t("dispatch.etaArrivalAt", {
                  time: formatClock(tracking.eta.estimatedArrivalTime),
                })}
              </p>
            )}
            {tracking?.eta && (
              // Địa chỉ điểm đón lấy từ operator-context, đối chiếu bằng
              // `pickupOrder`. Chưa nạp được context thì lùi về số thứ tự chứ
              // không bỏ trống.
              <p className="mt-0.5 text-gray-500">
                {nextPickupLabel(tracking.context, tracking.eta, (order) =>
                  t("dispatch.pickupOrderValue", { order }),
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Đẩy xuống đáy thẻ: các thẻ trong lưới cao thấp khác nhau (chuyến đang
          chạy có thêm khối vị trí/ETA), mt-auto giữ hàng nút thẳng nhau. */}
      <div className="mt-auto pt-3">
        <button
          type="button"
          onClick={() => onOpenDetail(trip)}
          className="w-full cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-vr-300 hover:text-vr-900"
        >
          {t("dispatch.viewTripDetail")}
        </button>
      </div>
    </article>
  );
}
