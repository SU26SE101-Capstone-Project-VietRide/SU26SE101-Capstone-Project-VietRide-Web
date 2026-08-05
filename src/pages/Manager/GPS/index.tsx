import {
  FiAlertTriangle,
  FiNavigation,
  FiPauseCircle,
  FiRefreshCw,
  FiTruck,
} from "react-icons/fi";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import FleetFilterBar from "./FleetFilterBar";
import FleetMapLegend from "./FleetMapLegend";
import FleetMetricCard from "./FleetMetricCard";
import FleetVehicleList from "./FleetVehicleList";
import TripTrackingPanel from "./TripTrackingPanel";
import type { GoogleMapCoordinate } from "../../../lib/googleMaps";
import {
  createTrackingSocket,
  joinTripTracking,
  type TrackingEtaUpdateEvent,
  type TrackingLatestLocation,
  type TripStatusChangedEvent,
} from "../../../lib/trackingSocket";
import {
  getFleetStatus,
  routeGeometryPath,
  type RealtimeStatus,
} from "./gpsHelpers";

export default function GPSTracking() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  // Giữ tham chiếu t mới nhất để effect socket không reconnect khi đổi ngôn ngữ
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
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
              driver:
                trip.driver?.displayName ??
                tRef.current("gps.unassignedDriver"),
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
      // Geometry tuyến đã được tải khi chọn chuyến (selectTrip) — không gọi lại ở đây
      const [latestResult, trailResult] = await Promise.all([
        getTrackingTripLatest(tripId.trim()),
        getTrackingTripTrail(tripId.trim(), {
          page: 1,
          pageSize: 20,
          sortBy: "recordedAt",
          sortDir: "desc",
        }),
      ]);

      setLatest(latestResult);
      setTrail(trailResult.items);
      setEta(null);

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

    socket.on("connect", () => {
      void joinTripTracking(socket, tripId.trim()).then((ack) => {
        if (cancelled) return;
        if (ack.success) {
          setRealtimeStatus("connected");
        } else {
          setRealtimeStatus("error");
          setApiError(tRef.current("gps.realtimeJoinFailed"));
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
    };
  }, [tripId]);

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
            {isFleetLoading ? t("gps.loadingTracking") : tc("refresh")}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FleetMetricCard
          label={t("gps.totalOnMap")}
          value={metrics.total}
          hint={t("gps.tracking")}
          valueClass="text-gray-900"
          iconClass="bg-vr-50 text-vr-700"
          icon={<FiTruck size={20} />}
        />
        <FleetMetricCard
          label={t("gps.moving")}
          value={metrics.moving}
          hint={t("gps.hasMovement")}
          valueClass="text-emerald-700"
          iconClass="bg-emerald-50 text-emerald-600"
          icon={<FiNavigation size={20} />}
        />
        <FleetMetricCard
          label={t("gps.stopped")}
          value={metrics.idle}
          hint={t("gps.zeroSpeed")}
          valueClass="text-amber-700"
          iconClass="bg-amber-50 text-amber-600"
          icon={<FiPauseCircle size={20} />}
        />
        <FleetMetricCard
          label={t("gps.alerts")}
          value={metrics.offline}
          hint={t("gps.signalLost")}
          valueClass="text-red-600"
          iconClass="bg-red-50 text-red-600"
          icon={<FiAlertTriangle size={20} />}
        />
      </div>

      <FleetFilterBar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
      />

      <TripTrackingPanel
        tripId={tripId}
        realtimeStatus={realtimeStatus}
        delayInfo={delayInfo}
        tripOptions={tripOptions}
        isApiLoading={isApiLoading}
        apiMessage={apiMessage}
        apiError={apiError}
        latest={latest}
        trailCount={trail.length}
        eta={eta}
        onSelectTrip={(nextTripId) => void selectTrip(nextTripId)}
        onLoadTracking={() => void loadTripTracking()}
      />

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
          <FleetMapLegend />
        </div>

        <FleetVehicleList
          vehicles={filtered}
          fleetVehicles={fleetVehicles}
          selectedId={selectedId}
          onSelect={selectVehicle}
        />
      </div>
    </div>
  );
}
