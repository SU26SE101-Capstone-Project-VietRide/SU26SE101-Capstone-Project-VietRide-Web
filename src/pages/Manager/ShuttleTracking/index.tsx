import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiRequestError } from "../../../api/client";
import type { Socket } from "socket.io-client";
import { FiMapPin, FiNavigation, FiRefreshCw, FiX } from "react-icons/fi";
import {
  getShuttleTripEta,
  getShuttleTripLatest,
  type ShuttleTrackingEta,
  type ShuttleTrackingLatest,
} from "../../../api/vietride";
import {
  createTrackingSocket,
  joinShuttleTracking,
  type ShuttleEtaUpdateEvent,
  type ShuttleGpsUpdateEvent,
} from "../../../lib/trackingSocket";
import {
  getRecentShuttleTrips,
  type RecentShuttleTrip,
} from "../../../utils/shuttleTrackingHistory";
import GoogleMapCanvas from "../../../components/GoogleMapCanvas";
import { formatDateTime } from "../../../utils/date";

type RealtimeStatus = "idle" | "connecting" | "connected" | "error";
function getTrackingErrorMessage(
  error: unknown,
  fallback: string,
  denied: string,
): string {
  if (
    error instanceof ApiRequestError &&
    error.code === "TRACKING_ACCESS_DENIED"
  ) {
    return denied;
  }

  return error instanceof Error ? error.message : fallback;
}

const defaultCenter = { lat: 10.7769, lng: 106.7009 };

function realtimeBadgeClass(status: RealtimeStatus) {
  if (status === "connected") return "bg-emerald-50 text-emerald-700";
  if (status === "connecting") return "bg-amber-50 text-amber-700";
  if (status === "error") return "bg-red-50 text-red-700";
  return "bg-gray-100 text-gray-600";
}

function realtimeDotClass(status: RealtimeStatus) {
  if (status === "connected") return "bg-emerald-500";
  if (status === "connecting") return "animate-pulse bg-amber-500";
  if (status === "error") return "bg-red-500";
  return "bg-gray-400";
}

export type ShuttleTrackingProps = {
  embedded?: boolean;
};

export default function ShuttleTracking({
  embedded = false,
}: ShuttleTrackingProps) {
  const { t } = useTranslation("manager");

  const [recentTrips, setRecentTrips] = useState<RecentShuttleTrip[]>(() =>
    getRecentShuttleTrips(),
  );
  const [inputShuttleTripId, setInputShuttleTripId] = useState("");
  const [activeShuttleTripId, setActiveShuttleTripId] = useState("");
  const [latest, setLatest] = useState<ShuttleTrackingLatest | null>(null);
  const [eta, setEta] = useState<ShuttleTrackingEta | null>(null);
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const socketRef = useRef<Socket | null>(null);

  async function startTracking(shuttleTripId: string) {
    const trimmed = shuttleTripId.trim();
    if (!trimmed) {
      setError(t("shuttleTracking.shuttleTripIdRequired"));
      return;
    }

    setError("");
    setLatest(null);
    setEta(null);
    setIsLoading(true);
    setInputShuttleTripId(trimmed);

    try {
      const [latestResult, etaResult] = await Promise.all([
        getShuttleTripLatest(trimmed),
        getShuttleTripEta(trimmed),
      ]);
      setLatest(latestResult);
      setEta(etaResult);
    } catch (err) {
      setError(
        getTrackingErrorMessage(
          err,
          t("shuttleTracking.loadFailed"),
          t("shuttleTracking.operatorTrackingDenied"),
        ),
      );
    } finally {
      setIsLoading(false);
    }

    setActiveShuttleTripId(trimmed);
  }

  function stopTracking() {
    setActiveShuttleTripId("");
    setLatest(null);
    setEta(null);
    setError("");
  }

  useEffect(() => {
    let cancelled = false;
    const nextStatus: RealtimeStatus = activeShuttleTripId
      ? "connecting"
      : "idle";
    const statusTimer = window.setTimeout(() => {
      if (!cancelled) setRealtimeStatus(nextStatus);
    }, 0);

    if (!activeShuttleTripId) {
      return () => {
        cancelled = true;
        window.clearTimeout(statusTimer);
      };
    }

    const socket = createTrackingSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      void joinShuttleTracking(socket, activeShuttleTripId).then((ack) => {
        if (cancelled) return;
        if (ack.success) {
          setRealtimeStatus("connected");
        } else {
          setRealtimeStatus("error");
          setError(
            ack.error === "TRACKING_ACCESS_DENIED"
              ? t("shuttleTracking.operatorTrackingDenied")
              : t("shuttleTracking.realtimeJoinFailed"),
          );
        }
      });
    });

    socket.on("connect_error", () => {
      if (!cancelled) setRealtimeStatus("error");
    });

    socket.on("disconnect", () => {
      if (!cancelled) setRealtimeStatus("error");
    });

    socket.on("shuttle:gps:update", (event: ShuttleGpsUpdateEvent) => {
      if (cancelled) return;
      setLatest(event);
    });

    socket.on("shuttle:eta:update", (event: ShuttleEtaUpdateEvent) => {
      if (cancelled) return;
      setEta(event);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(statusTimer);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeShuttleTripId, t]);

  const markers = latest
    ? [
        {
          id: latest.shuttleTripId,
          color: "#3b82f6",
          title: latest.shuttleTripId,
          description: [
            `${latest.latitude}, ${latest.longitude}`,
            latest.speedKmh == null
              ? t("shuttleTracking.noEtaYet")
              : t("shuttleTracking.speedValue", { speed: latest.speedKmh }),
          ],
          position: { lat: latest.latitude, lng: latest.longitude },
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5 pb-2">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("shuttleTracking.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 sm:text-base">
            {t("shuttleTracking.subtitle")}
          </p>
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              {t("shuttleTracking.shuttleTripIdLabel")}
            </label>
            <input
              type="text"
              value={inputShuttleTripId}
              onChange={(event) => setInputShuttleTripId(event.target.value)}
              placeholder={t("shuttleTracking.shuttleTripIdPlaceholder")}
              className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-vr-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-vr-500/35"
            />
          </div>
          {activeShuttleTripId ? (
            <button
              type="button"
              onClick={stopTracking}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <FiX size={16} />
              {t("shuttleTracking.stopTracking")}
            </button>
          ) : (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void startTracking(inputShuttleTripId)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiNavigation size={16} />
              {t("shuttleTracking.track")}
            </button>
          )}
        </div>

        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-gray-500">
              {t("shuttleTracking.recentTrips")}
            </p>
            <button
              type="button"
              onClick={() => setRecentTrips(getRecentShuttleTrips())}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title={t("shuttleTracking.recentTrips")}
              aria-label={t("shuttleTracking.recentTrips")}
            >
              <FiRefreshCw size={12} />
            </button>
          </div>
          {recentTrips.length === 0 ? (
            <p className="text-xs text-gray-400">
              {t("shuttleTracking.noRecentTrips")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {recentTrips.map((item) => (
                <button
                  key={item.shuttleTripId}
                  type="button"
                  onClick={() => void startTracking(item.shuttleTripId)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    activeShuttleTripId === item.shuttleTripId
                      ? "border-vr-300 bg-vr-50 text-vr-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                  title={item.shuttleTripId}
                >
                  {item.shuttleTripId.slice(0, 8)}…
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </section>

      {activeShuttleTripId && (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="relative min-h-[380px] overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-inner">
            <GoogleMapCanvas
              ariaLabel={t("shuttleTracking.title")}
              center={
                latest
                  ? { lat: latest.latitude, lng: latest.longitude }
                  : defaultCenter
              }
              className="h-full min-h-[380px] w-full"
              emptyState={t("shuttleTracking.noLocationYet")}
              focusCenter={
                latest ? { lat: latest.latitude, lng: latest.longitude } : null
              }
              markers={markers}
              scrollWheelZoom
              zoom={13}
            />
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-gray-900">
                  {activeShuttleTripId.slice(0, 8)}…
                </h2>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${realtimeBadgeClass(realtimeStatus)}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${realtimeDotClass(realtimeStatus)}`}
                  />
                  {realtimeStatus === "connected"
                    ? t("shuttleTracking.realtimeConnected")
                    : realtimeStatus === "connecting"
                      ? t("shuttleTracking.realtimeConnecting")
                      : realtimeStatus === "error"
                        ? t("shuttleTracking.realtimeDisconnected")
                        : ""}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <FiMapPin size={12} />
                    {t("shuttleTracking.latestLocation")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {latest
                      ? `${latest.latitude}, ${latest.longitude}`
                      : t("shuttleTracking.noLocationYet")}
                  </p>
                  {latest && (
                    <>
                      {latest.speedKmh != null && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {t("shuttleTracking.speedLabel")}:{" "}
                          {t("shuttleTracking.speedValue", {
                            speed: latest.speedKmh,
                          })}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-gray-500">
                        {t("shuttleTracking.recordedAt", {
                          time: formatDateTime(latest.recordedAt),
                        })}
                      </p>
                    </>
                  )}
                </div>

                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-xs font-medium text-gray-500">
                    {t("shuttleTracking.nextPickup")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {eta
                      ? t("shuttleTracking.etaValue", {
                          minutes: eta.etaMinutes,
                          distance: eta.distanceMeters,
                        })
                      : t("shuttleTracking.noEtaYet")}
                  </p>
                  {eta && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      {t("shuttleTracking.pickupOrderValue", {
                        order: eta.nextPickupOrder,
                      })}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => void startTracking(activeShuttleTripId)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiRefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                {t("shuttleTracking.track")}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
