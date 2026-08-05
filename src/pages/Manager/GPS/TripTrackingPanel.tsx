import { FiRefreshCw } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import type {
  OperatorTripListItem,
  TrackingEtaResponse,
  TrackingLatestResponse,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import type { TripStatusChangedEvent } from "../../../lib/trackingSocket";
import type { RealtimeStatus } from "./gpsHelpers";

type TripTrackingPanelProps = {
  tripId: string;
  realtimeStatus: RealtimeStatus;
  delayInfo: TripStatusChangedEvent | null;
  tripOptions: OperatorTripListItem[];
  isApiLoading: boolean;
  apiMessage: string;
  apiError: string;
  latest: TrackingLatestResponse | null;
  trailCount: number;
  eta: TrackingEtaResponse | null;
  onSelectTrip: (tripId: string) => void;
  onLoadTracking: () => void;
};

export default function TripTrackingPanel({
  tripId,
  realtimeStatus,
  delayInfo,
  tripOptions,
  isApiLoading,
  apiMessage,
  apiError,
  latest,
  trailCount,
  eta,
  onSelectTrip,
  onLoadTracking,
}: TripTrackingPanelProps) {
  const { t } = useTranslation("manager");

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {t("gps.realTrackingTitle")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t("gps.realTrackingHint")}
          </p>
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
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("gps.delayedBanner", {
            minutes: delayInfo.delayMinutes,
            time: new Date(delayInfo.updatedAt).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            {t("gps.tripId")}
          </label>
          <CustomSelect
            aria-label={t("gps.tripId")}
            className="h-12 w-full rounded-lg border border-gray-200 bg-white px-4 text-base font-medium text-gray-800 shadow-sm hover:border-vr-300 focus:border-vr-500 focus:ring-2 focus:ring-vr-500/25"
            value={tripId}
            onChange={(event) => onSelectTrip(event.target.value)}
          >
            <option value="">{t("gps.selectTripPlaceholder")}</option>
            {tripOptions.map((trip) => (
              <option key={trip.tripId} value={trip.tripId}>
                {trip.route.name || `${trip.route.originName} - ${trip.route.destinationName}`} · {trip.vehicle.licensePlate} · {new Date(trip.departureAt).toLocaleString("vi-VN")}
              </option>
            ))}
          </CustomSelect>
        </div>
        <button
          type="button"
          disabled={isApiLoading}
          onClick={onLoadTracking}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-vr-500 px-5 text-sm font-semibold text-white hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw size={16} />
          {isApiLoading ? t("gps.loadingTracking") : t("gps.loadTracking")}
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

      <div className="mt-5 grid gap-3 md:grid-cols-3">
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
        </div>
      </div>
    </section>
  );
}
