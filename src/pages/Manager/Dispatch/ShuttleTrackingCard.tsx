// Card theo dõi một chuyến trung chuyển (vị trí mới nhất + ETA) — tách từ index.tsx.
import { useTranslation } from "react-i18next";
import { FiRefreshCw, FiX } from "react-icons/fi";
import { formatTime, type TrackedShuttleTrip } from "./dispatchHelpers";

type ShuttleTrackingCardProps = {
  item: TrackedShuttleTrip;
  onRefresh: (shuttleTripId: string) => void;
  onRemove: (shuttleTripId: string) => void;
};

export default function ShuttleTrackingCard({
  item,
  onRefresh,
  onRemove,
}: ShuttleTrackingCardProps) {
  const { t } = useTranslation("manager");

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-gray-500">
            {item.shuttleTripId}
          </p>
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {t("dispatch.trip")}: {item.mainTripId}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onRefresh(item.shuttleTripId)}
            disabled={item.isRefreshing}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            title={t("dispatch.refreshTracking")}
            aria-label={t("dispatch.refreshTracking")}
          >
            <FiRefreshCw
              size={14}
              className={item.isRefreshing ? "animate-spin" : ""}
            />
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.shuttleTripId)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
            title={t("dispatch.removeTracking")}
            aria-label={t("dispatch.removeTracking")}
          >
            <FiX size={14} />
          </button>
        </div>
      </div>

      {item.error && (
        <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
          {item.error}
        </p>
      )}

      <div className="mt-3 space-y-2">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs font-medium text-gray-500">
            {t("dispatch.latestLocation")}
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {item.latest
              ? `${item.latest.latitude}, ${item.latest.longitude}`
              : t("dispatch.noLocationYet")}
          </p>
          {item.latest && (
            <p className="mt-0.5 text-xs text-gray-500">
              {t("dispatch.recordedAt", {
                time: formatTime(item.latest.recordedAt),
              })}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs font-medium text-gray-500">
            {t("dispatch.nextPickup")}
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {item.eta
              ? t("dispatch.etaValue", {
                  minutes: item.eta.etaMinutes,
                  distance: item.eta.distanceMeters,
                })
              : t("dispatch.noEtaYet")}
          </p>
          {item.eta && (
            <p className="mt-0.5 text-xs text-gray-500">
              {t("dispatch.pickupOrderValue", {
                order: item.eta.nextPickupOrder,
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
