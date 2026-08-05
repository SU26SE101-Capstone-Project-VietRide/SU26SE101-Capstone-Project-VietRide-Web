import {
  FiActivity,
  FiAlertTriangle,
  FiFilter,
  FiMapPin,
  FiNavigation,
  FiPauseCircle,
  FiRefreshCw,
  FiSearch,
  FiTruck,
} from "react-icons/fi";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Socket } from "socket.io-client";
import {
  getOperatorTrips,
  getTrackingTripLatest,
  getTrackingTripRouteGeometry,
  getTrackingTripTrail,
  type OperatorTripListItem,
  type TrackingEtaResponse,
  type TripRouteGeometry,
  type TrackingLatestResponse,
  type TrackingTrailPoint,
} from "../../../api/vietride";
import FleetMap, { type FleetVehicleMapPoint } from "./FleetMap";
import CustomSelect from "../../../components/CustomSelect";
import type { GoogleMapCoordinate } from "../../../lib/googleMaps";
import {
  createTrackingSocket,
  joinTripTracking,
  type TrackingEtaUpdateEvent,
  type TrackingLatestLocation,
  type TripStatusChangedEvent,
} from "../../../lib/trackingSocket";

type RealtimeStatus = "idle" | "connecting" | "connected" | "error";
function getFleetStatus(location: TrackingLatestLocation): FleetVehicleMapPoint["status"] {
  if (location.speedKmh == null) return "offline";
  return location.speedKmh > 2 ? "moving" : "idle";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function decodeGooglePolyline(encoded: string): GoogleMapCoordinate[] {
  const coordinates: GoogleMapCoordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({ lat: latitude / 1e5, lng: longitude / 1e5 });
  }

  return coordinates;
}

function routeGeometryPath(geometry: TripRouteGeometry | null): GoogleMapCoordinate[] {
  if (!geometry) return [];

  if (geometry.points?.length) {
    return [...geometry.points]
      .sort((left, right) => (left.orderIndex ?? 0) - (right.orderIndex ?? 0))
      .map((point) => ({ lat: point.latitude, lng: point.longitude }));
  }

  const geoJson = geometry.geoJson;
  const source = isRecord(geoJson) && isRecord(geoJson.geometry) ? geoJson.geometry : geoJson;
  if (isRecord(source) && source.type === "LineString" && Array.isArray(source.coordinates)) {
    return source.coordinates.flatMap((point): GoogleMapCoordinate[] => {
      if (!Array.isArray(point) || point.length < 2) return [];
      const [longitude, latitude] = point;
      if (typeof longitude !== "number" || typeof latitude !== "number") return [];
      return [{ lat: latitude, lng: longitude }];
    });
  }

  return geometry.encodedPolyline ? decodeGooglePolyline(geometry.encodedPolyline) : [];
}

function statusLabel(
  s: FleetVehicleMapPoint["status"],
  t: (key: string) => string,
) {
  if (s === "moving") return t("gps.moving");
  if (s === "idle") return t("gps.stopped");
  return t("gps.signalLostStatus");
}

function statusDotClass(s: FleetVehicleMapPoint["status"]) {
  if (s === "moving") return "bg-emerald-500";
  if (s === "idle") return "bg-amber-500";
  return "bg-gray-400";
}

function statusRowBadge(s: FleetVehicleMapPoint["status"]) {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold";
  if (s === "moving")
    return `${base} bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100`;
  if (s === "idle")
    return `${base} bg-amber-50 text-amber-800 ring-1 ring-amber-100`;
  return `${base} bg-gray-100 text-gray-600 ring-1 ring-gray-200`;
}

export default function GPSTracking() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | FleetVehicleMapPoint["status"]
  >("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusCenter, setFocusCenter] = useState<GoogleMapCoordinate | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(() => new Date());
  const [tripId, setTripId] = useState("");
  const [tripOptions, setTripOptions] = useState<OperatorTripListItem[]>([]);
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicleMapPoint[]>([]);
  const [routeGeometry, setRouteGeometry] = useState<TripRouteGeometry | null>(null);
  const [isFleetLoading, setIsFleetLoading] = useState(false);
  const [latest, setLatest] = useState<TrackingLatestResponse | null>(null);
  const [trail, setTrail] = useState<TrackingTrailPoint[]>([]);
  const [eta, setEta] = useState<TrackingEtaResponse | null>(null);
  const [apiMessage, setApiMessage] = useState("");
  const [apiError, setApiError] = useState("");
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("idle");
  const [delayInfo, setDelayInfo] = useState<TripStatusChangedEvent | null>(
    null,
  );
  const listRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMapReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const trailPath = useMemo(
    () => [...trail].reverse().map((point) => ({ lat: point.latitude, lng: point.longitude })),
    [trail],
  );

  const filtered = useMemo(() => {
    return fleetVehicles.filter((v) => {
      const q = searchTerm.trim().toLowerCase();
      const matchQ =
        !q ||
        v.plate.toLowerCase().includes(q) ||
        v.driver.toLowerCase().includes(q) ||
        v.route.toLowerCase().includes(q);
      const matchF = filterStatus === "all" || v.status === filterStatus;
      return matchQ && matchF;
    });
  }, [fleetVehicles, searchTerm, filterStatus]);

  const metrics = useMemo(() => {
    const total = fleetVehicles.length;
    const moving = fleetVehicles.filter((v) => v.status === "moving").length;
    const idle = fleetVehicles.filter((v) => v.status === "idle").length;
    const offline = fleetVehicles.filter((v) => v.status === "offline").length;
    return { total, moving, idle, offline };
  }, [fleetVehicles]);

  const selectVehicle = useCallback((id: string) => {
    setSelectedId(id);
    const vehicle = fleetVehicles.find((item) => item.id === id);
    if (vehicle) setFocusCenter(vehicle.position);
  }, [fleetVehicles]);

  const loadFleet = useCallback(async () => {
    setIsFleetLoading(true);
    setApiError("");

    try {
      const result = await getOperatorTrips({ page: 1, pageSize: 100 });
      const vehicles = await Promise.all(
        result.items.map(async (trip) => {
          try {
            const latestResult = await getTrackingTripLatest(trip.tripId);
            const location = latestResult.latest;
            if (!location) return null;
            return {
              id: trip.tripId,
              plate: trip.vehicle.licensePlate,
              driver: trip.driver?.displayName ?? "Chưa phân công",
              route:
                trip.route.name ||
                `${trip.route.originName} - ${trip.route.destinationName}`,
              speedKmh: location.speedKmh ?? null,
              status: getFleetStatus(location),
              position: { lat: location.latitude, lng: location.longitude },
            } satisfies FleetVehicleMapPoint;
          } catch {
            return null;
          }
        }),
      );
      const nextVehicles = vehicles.filter(
        (vehicle): vehicle is FleetVehicleMapPoint => vehicle !== null,
      );
      setTripOptions(result.items);
      setFleetVehicles(nextVehicles);
      setSelectedId((current) =>
        current && nextVehicles.some((vehicle) => vehicle.id === current)
          ? current
          : nextVehicles[0]?.id ?? null,
      );
      setFocusCenter(nextVehicles[0]?.position ?? null);
      setLastRefresh(new Date());
    } catch (error: unknown) {
      setTripOptions([]);
      setFleetVehicles([]);
      setSelectedId(null);
      setFocusCenter(null);
      setApiError(
        error instanceof Error ? error.message : t("gps.trackingLoadFailed"),
      );
    } finally {
      setIsFleetLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadFleet();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [loadFleet]);

  async function selectTrip(nextTripId: string) {
    setTripId(nextTripId);
    setDelayInfo(null);
    setEta(null);
    setRouteGeometry(null);
    if (!nextTripId) return;

    try {
      const geometry = await getTrackingTripRouteGeometry(nextTripId);
      setRouteGeometry(geometry);
    } catch {
      setRouteGeometry(null);
    }
  }
  async function loadTripTracking() {
    if (!tripId.trim()) {
      setApiError(t("gps.tripIdRequired"));
      return;
    }

    setIsApiLoading(true);
    setApiError("");
    setApiMessage("");

    try {
      const [latestResult, trailResult, geometryResult] = await Promise.all([
        getTrackingTripLatest(tripId.trim()),
        getTrackingTripTrail(tripId.trim(), {
          page: 1,
          pageSize: 20,
          sortBy: "recordedAt",
          sortDir: "desc",
        }),
        getTrackingTripRouteGeometry(tripId.trim()),
      ]);

      setLatest(latestResult);
      setTrail(trailResult.items);
      setEta(null);
      setRouteGeometry(geometryResult);

      if (latestResult.latest) {
        setFocusCenter({
          lat: latestResult.latest.latitude,
          lng: latestResult.latest.longitude,
        });
      }

      setLastRefresh(new Date());
      setApiMessage(t("gps.trackingLoaded"));
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : t("gps.trackingLoadFailed"),
      );
    } finally {
      setIsApiLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const nextStatus: RealtimeStatus = tripId.trim() ? "connecting" : "idle";
    const statusTimer = window.setTimeout(() => {
      if (!cancelled) setRealtimeStatus(nextStatus);
    }, 0);

    if (!tripId.trim()) {
      return () => {
        cancelled = true;
        window.clearTimeout(statusTimer);
      };
    }

    const socket = createTrackingSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      void joinTripTracking(socket, tripId.trim()).then((ack) => {
        if (cancelled) return;
        if (ack.success) {
          setRealtimeStatus("connected");
        } else {
          setRealtimeStatus("error");
          setApiError(t("gps.realtimeJoinFailed"));
        }
      });
    });

    socket.on("connect_error", () => {
      if (!cancelled) setRealtimeStatus("error");
    });

    socket.on("disconnect", () => {
      if (!cancelled) setRealtimeStatus("error");
    });

    socket.on("gps:update", (event: TrackingLatestLocation) => {
      if (cancelled) return;
      setLatest({ latest: event });
      setTrail((current) => [
        event,
        ...current.filter((point) => point.recordedAt !== event.recordedAt),
      ].slice(0, 100));
      setFleetVehicles((current) =>
        current.map((vehicle) =>
          vehicle.id === event.tripId
            ? {
                ...vehicle,
                position: { lat: event.latitude, lng: event.longitude },
                speedKmh: event.speedKmh ?? null,
                status: getFleetStatus(event),
              }
            : vehicle,
        ),
      );
      setFocusCenter({ lat: event.latitude, lng: event.longitude });
      setLastRefresh(new Date());
    });

    socket.on("eta:update", (event: TrackingEtaUpdateEvent) => {
      if (cancelled) return;
      setEta({ eta: event });
    });

    socket.on("trip:statusChanged", (event: TripStatusChangedEvent) => {
      if (cancelled) return;
      setDelayInfo(event.status === "DELAYED" ? event : null);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(statusTimer);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tripId, t]);

  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-vehicle-id="${selectedId}"]`,
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  return (
    <div className="flex flex-col gap-5 pb-2">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("gps.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 sm:text-base">
            {t("gps.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">
            {t("gps.updated")}{" "}
            {lastRefresh.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
          <button
            type="button"
            onClick={() => void loadFleet()}
            disabled={isFleetLoading}
            aria-busy={isFleetLoading}
            className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 disabled:cursor-wait disabled:opacity-70 text-slate-50 font-bold rounded-lg transition flex items-center gap-2"
          >
            <FiRefreshCw size={16} />
            {isFleetLoading ? "Đang tải..." : tc("refresh")}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-gray-500">
                {t("gps.totalOnMap")}
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {metrics.total}
              </p>
              <p className="mt-1 text-xs text-gray-500">{t("gps.tracking")}</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiTruck size={20} />
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-gray-500">
                {t("gps.moving")}
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                {metrics.moving}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {t("gps.hasMovement")}
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <FiNavigation size={20} />
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-gray-500">
                {t("gps.stopped")}
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-700">
                {metrics.idle}
              </p>
              <p className="mt-1 text-xs text-gray-500">{t("gps.zeroSpeed")}</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <FiPauseCircle size={20} />
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-gray-500">
                {t("gps.alerts")}
              </p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {metrics.offline}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {t("gps.signalLost")}
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <FiAlertTriangle size={20} />
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t("gps.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50/50 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-vr-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-vr-500/35"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <FiFilter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <CustomSelect
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(e.target.value as typeof filterStatus)
                }
                className="appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-8 text-sm font-medium text-gray-800 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
              >
                <option value="all">{t("gps.allStatus")}</option>
                <option value="moving">{t("gps.moving")}</option>
                <option value="idle">{t("gps.stopped")}</option>
                <option value="offline">{t("gps.signalLostStatus")}</option>
              </CustomSelect>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FiActivity size={16} />
              {t("gps.history24h")}
            </button>
          </div>
        </div>
      </div>

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
              onChange={(event) => void selectTrip(event.target.value)}
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
            onClick={() => void loadTripTracking()}
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
              {trail.length}
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

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[1fr_380px]">
        <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-inner xl:min-h-[min(72vh,640px)]">
          {!mapReady ? (
            <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-gray-500">
              {t("gps.loadingMap")}
            </div>
          ) : isFleetLoading ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-2 text-sm text-gray-500">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-vr-500" aria-hidden="true" />
              <span>{t("gps.loadingFleet")}</span>
            </div>
          ) : tripOptions.length === 0 ? (
            <div className="flex h-full min-h-[420px] items-center justify-center px-6 text-center text-sm text-gray-500">
              {apiError || t("gps.noTrips")}
            </div>
          ) : fleetVehicles.length === 0 ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-gray-500">
              <FiTruck size={28} className="text-gray-400" aria-hidden="true" />
              <span className="font-semibold text-gray-700">{t("gps.noLiveSignal")}</span>
              <span>{t("gps.noLiveSignalHint")}</span>
            </div>
          ) : (
            <FleetMap
              vehicles={filtered}
              selectedId={selectedId}
              focusCenter={focusCenter}
              routePath={routeGeometryPath(routeGeometry)}
              trailPath={trailPath}
              onMarkerSelect={selectVehicle}
            />
          )}
          <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-wrap gap-2">
            <div className="pointer-events-auto rounded-lg border border-gray-200/90 bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur-sm">
              <p className="font-semibold text-gray-800">{t("gps.legend")}</p>
              <div className="mt-1.5 flex flex-col gap-1 text-gray-600">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  {t("gps.moving")}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  {t("gps.stopped")}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                  {t("gps.signalLostStatus")}
                </span>
              </div>
            </div>
          </div>
        </div>

        <aside className="flex max-h-[min(72vh,640px)] min-h-[320px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-gray-900">
                {t("gps.vehicleList")}
              </h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                {filtered.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              {t("gps.selectVehicle")}
            </p>
          </div>
          <div ref={listRef} className="flex-1 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-gray-500">
                {t("gps.noMatch")}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {filtered.map((v) => {
                  const active = v.id === selectedId;
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        data-vehicle-id={v.id}
                        onClick={() => selectVehicle(v.id)}
                        className={`flex w-full flex-col gap-2 rounded-lg border px-3 py-2.5 text-left transition ${
                          active
                            ? "border-vr-300 bg-vr-50/80 ring-1 ring-vr-200"
                            : "border-transparent hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${statusDotClass(v.status)}`}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-900">
                                {v.plate}
                              </p>
                              <p className="truncate text-xs text-gray-500">
                                {v.driver}
                              </p>
                            </div>
                          </div>
                          <span className={statusRowBadge(v.status)}>
                            {statusLabel(v.status, t)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1 truncate">
                            <FiMapPin size={12} className="shrink-0" />
                            <span className="truncate">{v.route}</span>
                          </span>
                          <span className="shrink-0 font-medium text-gray-700">
                            {v.speedKmh == null ? "—" : `${v.speedKmh} km/h`}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {selectedId && (
            <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-3 text-xs text-gray-600">
              {(() => {
                const v = fleetVehicles.find((x) => x.id === selectedId);
                if (!v) return null;
                return <p>{t("gps.pingInfo", { plate: v.plate })}</p>;
              })()}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
