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
          <p className="mt-1 truncate text-sm font-semibold text-vr-700" title={tripLabel}>
            {tripLabel}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {t("operations.selectedTripId", { tripId })}
          </p>
          {routeId && (
            <Link
              to={`/manager/routes?routeId=${routeId}`}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-vr-700 hover:text-vr-800 hover:underline"
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
        <button
          type="button"
          disabled={isApiLoading}
          onClick={onLoadTracking}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 text-sm font-semibold text-white hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw size={16} />
          {isApiLoading ? t("gps.loadingTracking") : t("gps.loadTracking")}
        </button>
        <button
          type="button"
          onClick={onDeselect}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <FiX size={16} />
          {t("operations.deselectTrip")}
        </button>
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
          {eta?.eta && eta.eta.delayStatus !== "UNKNOWN" && (
            <p
              className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
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
            </p>
          )}
        </div>
      </div>

      <EtaTimeline trip={trip} etaTargets={etaTargets} />
    </section>
  );
}
