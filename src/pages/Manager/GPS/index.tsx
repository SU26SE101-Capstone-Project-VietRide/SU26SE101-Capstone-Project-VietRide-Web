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
import type { LatLngExpression } from "leaflet";
import {
  getTrackingTripEta,
  getTrackingTripLatest,
  getTrackingTripTrail,
  type TrackingEtaResponse,
  type TrackingLatestResponse,
  type TrackingTrailPoint,
} from "../../../api/vietride";
import Modal from "../../../components/Modal";
import FleetMap, { type FleetVehicleMapPoint } from "./FleetMap";
import CustomSelect from "../../../components/CustomSelect";

const fleetSeed: FleetVehicleMapPoint[] = [
  {
    id: "1",
    plate: "51B-12345",
    driver: "Nguyễn Văn An",
    route: "HCM → Đà Lạt",
    speedKmh: 72,
    status: "moving",
    position: [10.7769, 106.7009],
  },
  {
    id: "2",
    plate: "51B-22334",
    driver: "Trần Minh Tuấn",
    route: "HCM → Nha Trang",
    speedKmh: 0,
    status: "idle",
    position: [10.8014, 106.652],
  },
  {
    id: "3",
    plate: "51B-33445",
    driver: "Lê Hoàng Nam",
    route: "HCM → Vũng Tàu",
    speedKmh: 58,
    status: "moving",
    position: [10.7377, 106.6297],
  },
  {
    id: "4",
    plate: "51B-44556",
    driver: "Phạm Quốc Huy",
    route: "HCM → Cần Thơ",
    speedKmh: null,
    status: "offline",
    position: [10.8231, 106.6297],
  },
  {
    id: "5",
    plate: "29A-11223",
    driver: "Đỗ Văn Long",
    route: "HN → Sapa",
    speedKmh: 64,
    status: "moving",
    position: [10.714, 106.7561],
  },
  {
    id: "6",
    plate: "51B-55667",
    driver: "Võ Thị Mai",
    route: "HCM → Đà Lạt",
    speedKmh: 0,
    status: "idle",
    position: [10.7626, 106.6602],
  },
  {
    id: "7",
    plate: "51B-66778",
    driver: "Hoàng Đức",
    route: "HCM → Đà Lạt",
    speedKmh: 81,
    status: "moving",
    position: [10.8412, 106.8098],
  },
  {
    id: "8",
    plate: "51B-77889",
    driver: "Bùi Thanh Sơn",
    route: "HCM → Nha Trang",
    speedKmh: 45,
    status: "moving",
    position: [10.6989, 106.7721],
  },
];

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

  const firstVehicle = fleetSeed[0];
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | FleetVehicleMapPoint["status"]
  >("all");
  const [selectedId, setSelectedId] = useState<string | null>(firstVehicle.id);
  const [focusCenter, setFocusCenter] = useState<LatLngExpression | null>(
    firstVehicle.position,
  );
  const [mapReady, setMapReady] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(() => new Date());
  const [openIncident, setOpenIncident] = useState(false);
  const [tripId, setTripId] = useState("");
  const [stopId, setStopId] = useState("");
  const [latest, setLatest] = useState<TrackingLatestResponse | null>(null);
  const [trail, setTrail] = useState<TrackingTrailPoint[]>([]);
  const [eta, setEta] = useState<TrackingEtaResponse | null>(null);
  const [apiMessage, setApiMessage] = useState("");
  const [apiError, setApiError] = useState("");
  const [isApiLoading, setIsApiLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const severityLevels = useMemo(
    () => [
      t("gps.severityLow"),
      t("gps.severityMedium"),
      t("gps.severityHigh"),
    ],
    [t],
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => setMapReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const filtered = useMemo(() => {
    return fleetSeed.filter((v) => {
      const q = searchTerm.trim().toLowerCase();
      const matchQ =
        !q ||
        v.plate.toLowerCase().includes(q) ||
        v.driver.toLowerCase().includes(q) ||
        v.route.toLowerCase().includes(q);
      const matchF = filterStatus === "all" || v.status === filterStatus;
      return matchQ && matchF;
    });
  }, [searchTerm, filterStatus]);

  const metrics = useMemo(() => {
    const total = fleetSeed.length;
    const moving = fleetSeed.filter((v) => v.status === "moving").length;
    const idle = fleetSeed.filter((v) => v.status === "idle").length;
    const offline = fleetSeed.filter((v) => v.status === "offline").length;
    return { total, moving, idle, offline };
  }, []);

  const selectVehicle = useCallback((id: string) => {
    setSelectedId(id);
    const v = fleetSeed.find((x) => x.id === id);
    if (v) setFocusCenter(v.position);
  }, []);

  async function loadTripTracking() {
    if (!tripId.trim()) {
      setApiError(t("gps.tripIdRequired"));
      return;
    }

    setIsApiLoading(true);
    setApiError("");
    setApiMessage("");

    try {
      const [latestResult, trailResult, etaResult] = await Promise.all([
        getTrackingTripLatest(tripId.trim()),
        getTrackingTripTrail(tripId.trim(), {
          page: 1,
          pageSize: 20,
          sortBy: "recordedAt",
          sortDir: "desc",
        }),
        stopId.trim()
          ? getTrackingTripEta(tripId.trim(), stopId.trim())
          : Promise.resolve<TrackingEtaResponse | null>(null),
      ]);

      setLatest(latestResult);
      setTrail(trailResult.items);
      setEta(etaResult);

      if (latestResult.latest) {
        setFocusCenter([
          latestResult.latest.latitude,
          latestResult.latest.longitude,
        ]);
      }

      setLastRefresh(new Date());
      setApiMessage(t("gps.trackingLoaded"));
    } catch (err) {
      setApiError(err instanceof Error ? err.message : t("gps.trackingLoadFailed"));
    } finally {
      setIsApiLoading(false);
    }
  }

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
            onClick={() => setLastRefresh(new Date())}
            className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-slate-50 font-bold rounded-lg transition flex items-center gap-2"
          >
            <FiRefreshCw size={16} />
            {tc("refresh")}
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

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              {t("gps.tripId")}
            </label>
            <input
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
              value={tripId}
              onChange={(event) => setTripId(event.target.value)}
              placeholder="tripId"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              {t("gps.stopId")}
            </label>
            <input
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
              value={stopId}
              onChange={(event) => setStopId(event.target.value)}
              placeholder={t("gps.stopIdOptional")}
            />
          </div>
          <button
            type="button"
            disabled={isApiLoading}
            onClick={() => void loadTripTracking()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-60"
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

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-xs font-medium text-gray-500">
              {t("gps.latestLocation")}
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {latest?.latest
                ? `${latest.latest.latitude}, ${latest.latest.longitude}`
                : "-"}
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-xs font-medium text-gray-500">
              {t("gps.trailPoints")}
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {trail.length}
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-xs font-medium text-gray-500">
              {t("gps.eta")}
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
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
          ) : (
            <FleetMap
              vehicles={filtered}
              selectedId={selectedId}
              focusCenter={focusCenter}
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
                const v = fleetSeed.find((x) => x.id === selectedId);
                if (!v) return null;
                return (
                  <div className="space-y-2">
                    <p>{t("gps.pingInfo", { plate: v.plate })}</p>
                    <button
                      type="button"
                      onClick={() => setOpenIncident(true)}
                      className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700 hover:bg-red-100 transition"
                    >
                      {t("gps.reportIncident")}
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </aside>
      </div>

      <Modal
        open={openIncident}
        onClose={() => setOpenIncident(false)}
        icon={<FiAlertTriangle size={20} />}
        title={t("gps.incidentTitle")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenIncident(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenIncident(false);
                alert(t("gps.incidentSubmitted"));
              }}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
            >
              {t("gps.submitReport")}
            </button>
          </>
        }
      >
        {(() => {
          const v = fleetSeed.find((x) => x.id === selectedId);
          if (!v) return null;
          return (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm font-semibold text-red-900">
                  {t("gps.vehicleLabel")}{" "}
                  <span className="font-mono">{v.plate}</span>
                </p>
                <p className="text-sm text-red-800 mt-1">
                  {t("gps.driverLabel")} {v.driver}
                </p>
                <p className="text-sm text-red-800">
                  {t("gps.routeLabel")} {v.route}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {t("gps.incidentType")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <CustomSelect
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
                  defaultValue="breakdown"
                >
                  <option value="breakdown">
                    {t("gps.incidentBreakdown")}
                  </option>
                  <option value="accident">
                    {t("gps.incidentAccident")}
                  </option>
                  <option value="delay">{t("gps.incidentDelay")}</option>
                  <option value="deviation">
                    {t("gps.incidentDeviation")}
                  </option>
                  <option value="safety">{t("gps.incidentSafety")}</option>
                  <option value="gps">{t("gps.incidentGps")}</option>
                </CustomSelect>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {t("gps.severity")}
                </label>
                <div className="flex gap-3">
                  {severityLevels.map((level, idx) => (
                    <label key={idx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="severity"
                        defaultChecked={idx === 1}
                        className="text-vr-600"
                      />
                      <span className="text-sm text-gray-700">{level}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {t("gps.incidentDescription")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35 min-h-[100px]"
                  placeholder={t("gps.incidentDescriptionPlaceholder")}
                  rows={4}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {t("gps.actionsTaken")}
                </label>
                <textarea
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35 min-h-[80px]"
                  placeholder={t("gps.actionsTakenPlaceholder")}
                  rows={3}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {t("gps.handlerContact")}
                </label>
                <input
                  type="tel"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
                  placeholder={t("gps.reporterPhonePlaceholder")}
                />
              </div>

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">
                    {t("gps.incidentNoticeLabel")}
                  </span>{" "}
                  {t("gps.incidentNotice")}
                </p>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
