// Chi tiết một chuyến trung chuyển: thông tin xe/tài xế, các mốc thời gian và
// lộ trình điểm đón lấy từ `GET /v1/tracking/shuttle-trips/{id}/operator-context`.
//
// Component thuần trình bày — trang cha nạp `context` rồi truyền xuống (giống
// RequestDetailModal), để chỗ gọi API vẫn nằm gọn ở một nơi.
//
// LƯU Ý: operator-context CỐ TÌNH không trả tên/SĐT hành khách (xem comment của
// OperatorShuttleContext trong api/vietride.ts). Đừng thêm cột hành khách ở đây.
import { useTranslation } from "react-i18next";
import { FiBell, FiMapPin, FiNavigation, FiRefreshCw } from "react-icons/fi";
import type {
  OperatorShuttleContext,
  OperatorShuttleTrackingStop,
  OperatorShuttleTripListItem,
  OperatorShuttleTripStatus,
  ShuttleDirection,
} from "../../../api/vietride";
import Modal from "../../../components/Modal";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import { formatDistance, formatTime } from "./dispatchHelpers";
import { Button } from "../../../components/ui/Button";

type ShuttleTripDetailModalProps = {
  open: boolean;
  onClose: () => void;
  trip: OperatorShuttleTripListItem | null;
  context: OperatorShuttleContext | null;
  isLoading: boolean;
  error: string;
  directionLabel: (direction: ShuttleDirection) => string;
  /**
   * Điểm đón mà thông báo đang trỏ tới (deep-link có `bookingId`/`pickupOrder`).
   * `null` = mở bằng tay hoặc thông báo không nói về điểm nào cụ thể.
   */
  highlightedStop?: OperatorShuttleTrackingStop | null;
};

const statusBadgeClass: Record<OperatorShuttleTripStatus, string> = {
  SCHEDULED: "bg-amber-50 text-amber-800 ring-1 ring-amber-100",
  IN_PROGRESS: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100",
  COMPLETED: "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
  CANCELLED: "bg-red-50 text-red-700 ring-1 ring-red-100",
};

// `ShuttleStopStatus` để mở kiểu string (BE có thể thêm giá trị mới), nên tra
// bảng màu bằng lookup có nhánh dự phòng thay vì Record đầy đủ.
function stopStatusClass(status: string) {
  switch (status) {
    case "PICKED_UP":
    case "DELIVERED":
      return "bg-emerald-50 text-emerald-800";
    case "NO_SHOW":
      return "bg-amber-50 text-amber-800";
    case "CANCELLED":
      return "bg-red-50 text-red-700";
    case "PENDING":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function ShuttleTripDetailModal({
  open,
  onClose,
  trip,
  context,
  isLoading,
  error,
  directionLabel,
  highlightedStop = null,
}: ShuttleTripDetailModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  // Sắp theo `pickupOrder` (thứ tự nghiệp vụ) chứ không tin thứ tự mảng BE trả.
  const stops = [...(context?.stops ?? [])].sort(
    (left, right) => left.pickupOrder - right.pickupOrder,
  );

  // So bằng chính đối tượng điểm đón đã chọn: `pickupOrder` không phải khoá duy
  // nhất tuyệt đối (điểm bến cũng mang số thứ tự), so bằng tham chiếu thì không
  // thể tô nhầm sang điểm khác.
  const isHighlighted = (stop: OperatorShuttleTrackingStop) =>
    highlightedStop !== null && stop === highlightedStop;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiNavigation size={20} />}
      title={t("dispatch.tripDetailTitle")}
      subtitle={trip?.vehicle.licensePlate || t("dispatch.unknownVehicle")}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {tc("close")}
        </Button>
      }
    >
      {trip && (
        <div className="space-y-5">
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-900">
                  {trip.vehicle.licensePlate || t("dispatch.unknownVehicle")}
                </p>
                <p className="mt-0.5 text-sm text-gray-600">
                  {trip.driver.displayName?.trim() ||
                    t("dispatch.unassignedDriver")}
                  {trip.driver.phone
                    ? ` · ${formatVietnamPhoneForDisplay(trip.driver.phone)}`
                    : ""}
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass[trip.status]}`}
              >
                {t(`dispatch.shuttleStatus.${trip.status}`)}
              </span>
            </div>

            <dl className="mt-4 grid gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm sm:grid-cols-3">
              <DetailItem
                label={t("dispatch.type")}
                value={directionLabel(trip.direction)}
              />
              <DetailItem
                label={t("dispatch.passengerCount")}
                value={String(trip.passengerCount)}
              />
              <DetailItem
                label={t("dispatch.stopCount")}
                value={String(trip.stopCount)}
              />
              <DetailItem
                label={t("dispatch.scheduledDeparture")}
                value={formatTime(trip.scheduledDepartureTime)}
              />
              <DetailItem
                label={t("dispatch.scheduledEndTime")}
                value={formatTime(trip.scheduledEndTime)}
              />
              <DetailItem
                label={t("dispatch.actualDepartureTime")}
                value={formatTime(trip.actualDepartureTime ?? undefined)}
              />
              <DetailItem
                label={t("dispatch.completedAt")}
                value={formatTime(trip.completedAt ?? undefined)}
              />
              {context?.station && (
                <DetailItem
                  label={t("dispatch.stationLabel")}
                  value={context.station.name}
                />
              )}
            </dl>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-base font-semibold text-gray-900">
              {t("dispatch.tripDetailStops")}
            </h3>

            {error ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : isLoading ? (
              <p className="mt-3 inline-flex items-center gap-2 text-sm text-gray-500">
                <FiRefreshCw className="animate-spin" size={14} />
                {t("dispatch.loading")}
              </p>
            ) : stops.length === 0 ? (
              <p className="mt-3 rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                {t("dispatch.tripDetailNoStops")}
              </p>
            ) : (
              <ol className="mt-3 space-y-2">
                {stops.map((stop) => (
                  <li
                    key={`${stop.pickupOrder}-${stop.bookingId ?? "station"}`}
                    className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                      isHighlighted(stop)
                        ? "border-vr-300 bg-vr-50 ring-2 ring-vr-100"
                        : "border-gray-100 bg-gray-50/70"
                    }`}
                  >
                    <div className="flex min-w-0 gap-3">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-vr-900 ring-1 ring-vr-100">
                        {stop.pickupOrder}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                          <FiMapPin
                            size={13}
                            className="shrink-0 text-gray-500"
                            aria-hidden="true"
                          />
                          {/* Điểm bến không có `serviceAddress`; lùi về tên bến
                              của context rồi mới tới nhãn chung. */}
                          {stop.serviceAddress?.trim() ||
                            (stop.isStation
                              ? context?.station?.name ||
                                t("dispatch.shuttleStationFallback")
                              : t("dispatch.pickupOrderValue", {
                                  order: stop.pickupOrder,
                                }))}
                        </p>
                        {stop.roadDistanceMeters !== undefined && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            {formatDistance(stop.roadDistanceMeters)}
                          </p>
                        )}
                        {/* Nói rõ VÌ SAO điểm này được tô sáng — nếu không, một
                            ô màu khác lạ giữa danh sách chỉ gây hoang mang. */}
                        {isHighlighted(stop) && (
                          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-vr-100 px-2 py-0.5 text-xs font-semibold text-vr-900">
                            <FiBell size={11} aria-hidden="true" />
                            {t("dispatch.notifiedStopBadge")}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${stopStatusClass(stop.status)}`}
                    >
                      {t(`dispatch.stopStatus.${stop.status}`, {
                        defaultValue: stop.status,
                      })}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-gray-800" title={value}>
        {value}
      </dd>
    </div>
  );
}
