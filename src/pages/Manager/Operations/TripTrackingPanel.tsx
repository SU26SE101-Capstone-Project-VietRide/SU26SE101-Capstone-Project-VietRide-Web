import { FiClock, FiExternalLink, FiMap, FiRefreshCw, FiX } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type {
  PublicTrip,
  TrackingEtaResponse,
  TrackingEtaTarget,
  TrackingLatestResponse,
} from "../../../api/vietride";
import type { TripStatusChangedEvent } from "../../../lib/trackingSocket";
import { EtaTimeline } from "./EtaTimeline";
import type { RealtimeStatus, RouteGeometryStatus } from "./gpsHelpers";
import { Button } from "../../../components/ui/Button";
import { EtaQualityBadge } from "../../../components/EtaQualityBadge";

type TripTrackingPanelProps = {
  tripId: string;
  /** Nhãn chuyến đang chọn (tuyến · biển số) hiển thị ở header */
  tripLabel: string;
  /** Id tuyến của chuyến đang chọn — có thì hiện link "Xem tuyến" sang màn Routes */
  routeId?: string | null;
  realtimeStatus: RealtimeStatus;
  /** Kết quả tải lộ trình tuyến — quyết định dòng chú thích dưới bản đồ */
  routeGeometryStatus: RouteGeometryStatus;
  delayInfo: TripStatusChangedEvent | null;
  isApiLoading: boolean;
  apiMessage: string;
  apiError: string;
  latest: TrackingLatestResponse | null;
  trailCount: number;
  /** Số điểm dừng giữa tuyến của CHUYẾN (snapshot TripStop), không phải của tuyến */
  routeStopCount: number;
  eta: TrackingEtaResponse | null;
  etaTargets: TrackingEtaTarget[];
  trip: PublicTrip | null;
  onLoadTracking: () => void;
  /** Bỏ chọn chuyến — quay lại panel KPI + danh sách xe */
  onDeselect: () => void;
};

export default function TripTrackingPanel({
  tripId,
  tripLabel,
  routeId = null,
  realtimeStatus,
  routeGeometryStatus,
  delayInfo,
  isApiLoading,
  apiMessage,
  apiError,
  latest,
  trailCount,
  routeStopCount,
  eta,
  etaTargets,
  trip,
  onLoadTracking,
  onDeselect,
}: TripTrackingPanelProps) {
  const { t } = useTranslation("manager");

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900">
            {t("gps.realTrackingTitle")}
          </h2>
          <p className="mt-1 truncate text-sm font-semibold text-vr-900" title={tripLabel}>
            {tripLabel}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {t("operations.selectedTripId", { tripId })}
          </p>
          {routeId && (
            <Link
              to={`/manager/routes?routeId=${routeId}`}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-vr-900 hover:text-vr-800 hover:underline"
            >
              <FiExternalLink size={12} />
              {t("operations.viewRoute")}
            </Link>
          )}
        </div>
        {tripId && (
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              realtimeStatus === "connected"
                ? "bg-emerald-50 text-emerald-700"
                : realtimeStatus === "connecting"
                  ? "bg-amber-50 text-amber-700"
                  : realtimeStatus === "error"
                    ? "bg-red-50 text-red-700"
                    : "bg-gray-100 text-gray-600"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                realtimeStatus === "connected"
                  ? "bg-emerald-500"
                  : realtimeStatus === "connecting"
                    ? "animate-pulse bg-amber-500"
                    : realtimeStatus === "error"
                      ? "bg-red-500"
                      : "bg-gray-400"
              }`}
            />
            {realtimeStatus === "connected"
              ? t("gps.realtimeConnected")
              : realtimeStatus === "connecting"
                ? t("gps.realtimeConnecting")
                : realtimeStatus === "error"
                  ? t("gps.realtimeDisconnected")
                  : ""}
          </span>
        )}
      </div>
      {delayInfo && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          <FiClock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {t("gps.delayedBanner", {
              minutes: delayInfo.delayMinutes,
              time: new Date(delayInfo.updatedAt).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            })}
          </span>
        </div>
      )}

      {/* Lộ trình vẽ trên bản đồ: nói rõ đang tải, không có dữ liệu hay lỗi —
          trước đây cả ba trường hợp đều chỉ là một bản đồ trống không giải thích. */}
      {routeGeometryStatus !== "ready" && routeGeometryStatus !== "idle" && (
        <div
          className={`mb-3 flex items-start gap-2 rounded-lg border px-4 py-2.5 text-xs ${
            routeGeometryStatus === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-gray-200 bg-gray-50 text-gray-600"
          }`}
        >
          <FiMap size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {routeGeometryStatus === "loading"
              ? t("operations.routeGeometryLoading")
              : routeGeometryStatus === "estimated"
                ? t("operations.routeGeometryEstimated")
                : routeGeometryStatus === "empty"
                  ? t("operations.routeGeometryEmpty")
                  : t("operations.routeGeometryError")}
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={isApiLoading} onClick={onLoadTracking}>
          <FiRefreshCw size={16} />
          {isApiLoading ? t("gps.loadingTracking") : t("gps.loadTracking")}
        </Button>
        <Button variant="secondary" onClick={onDeselect}>
          <FiX size={16} />
          {t("operations.deselectTrip")}
        </Button>
      </div>

      {apiMessage && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {apiMessage}
        </div>
      )}
      {apiError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <div className="mt-5 grid gap-3">
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-sm font-medium text-gray-500">
            {t("gps.latestLocation")}
          </p>
          <p className="mt-1 text-base font-semibold text-gray-900">
            {latest?.latest
              ? `${latest.latest.latitude}, ${latest.latest.longitude}`
              : "-"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-sm font-medium text-gray-500">
            {t("gps.trailPoints")}
          </p>
          <p className="mt-1 text-base font-semibold text-gray-900">
            {trailCount}
          </p>
        </div>
        {/* Điểm dừng lấy từ snapshot lúc TẠO CHUYẾN: thêm điểm dừng vào tuyến
            sau đó không ghi ngược vào chuyến đã sinh, nên chuyến cũ hiện 0 và
            bản đồ không có chấm số nào. Nói thẳng ra để khỏi tưởng lỗi hiển thị. */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-sm font-medium text-gray-500">
            {t("gps.routeStopCount")}
          </p>
          <p className="mt-1 text-base font-semibold text-gray-900">
            {routeStopCount}
          </p>
          {routeStopCount === 0 && (
            <p className="mt-1 text-xs leading-5 text-gray-500">
              {t("gps.routeStopCountEmptyHint")}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-sm font-medium text-gray-500">{t("gps.eta")}</p>
          <p className="mt-1 text-base font-semibold text-gray-900">
            {eta?.eta
              ? `${eta.eta.etaMinutes} min · ${eta.eta.distanceMeters} m`
              : "-"}
          </p>
          {eta?.eta?.stopName && (
            <p className="mt-0.5 text-xs text-gray-500">
              {t("gps.etaToStop", { stopName: eta.eta.stopName })}
            </p>
          )}
          {/* Hai pill cùng hàng: trễ/đúng giờ là KẾT QUẢ, chất lượng ước tính
              là ĐỘ TIN CẬY của chính con số ETA — đọc cạnh nhau mới đủ nghĩa. */}
          {eta?.eta && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {eta.eta.delayStatus !== "UNKNOWN" && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    eta.eta.delayStatus === "DELAYED"
                      ? "bg-amber-50 text-amber-800 ring-1 ring-amber-100"
                      : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                  }`}
                >
                  {eta.eta.delayStatus === "DELAYED"
                    ? eta.eta.delayMinutes != null
                      ? t("gps.etaDelayed", { minutes: eta.eta.delayMinutes })
                      : t("gps.etaDelayedNoMinutes")
                    : t("gps.etaOnTime")}
                </span>
              )}
              <EtaQualityBadge quality={eta.eta.estimateQuality} />
            </div>
          )}
        </div>
      </div>

      <EtaTimeline trip={trip} etaTargets={etaTargets} />
    </section>
  );
}
