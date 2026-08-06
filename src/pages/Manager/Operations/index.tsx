import {
  FiAlertTriangle,
  FiNavigation,
  FiPauseCircle,
  FiRefreshCw,
  FiTruck,
} from "react-icons/fi";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  getOperatorFleetLatest,
  getOperatorRouteChangeProposals,
  getOperatorTrips,
  getOperatorUsers,
  getOperatorVehicles,
  getTrackingTripEta,
  getTrackingTripLatest,
  getTrackingTripRouteGeometry,
  getTrackingTripTrail,
  type OperatorTripListItem,
  type OperatorUser,
  type OperatorVehicle,
  type TrackingEtaResponse,
  type TripRouteGeometry,
  type TrackingLatestResponse,
  type TrackingTrailPoint,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import FleetMap, { type FleetVehicleMapPoint } from "./FleetMap";
import FleetFilterBar from "./FleetFilterBar";
import FleetMapLegend from "./FleetMapLegend";
import FleetMetricCard from "./FleetMetricCard";
import FleetVehicleList from "./FleetVehicleList";
import ProposalsPanel from "./ProposalsPanel";
import TripActionsPanel from "./TripActionsPanel";
import TripTrackingPanel from "./TripTrackingPanel";
import type { GoogleMapCoordinate } from "../../../lib/googleMaps";
import {
  createTrackingSocket,
  joinTripTracking,
  type FleetGpsUpdateEvent,
  type TrackingEtaUpdateEvent,
  type TrackingLatestLocation,
  type TripStatusChangedEvent,
} from "../../../lib/trackingSocket";
import {
  applyFleetGpsUpdate,
  buildFleetVehicles,
  getFleetStatus,
  routeGeometryPath,
  type RealtimeStatus,
} from "./gpsHelpers";
import { useFleetSocket } from "./useFleetSocket";

// Nhãn hiển thị chuyến trong header panel theo dõi
function tripLabel(trip: OperatorTripListItem): string {
  const routeName =
    trip.route.name || `${trip.route.originName} - ${trip.route.destinationName}`;
  return `${routeName} · ${trip.vehicle.licensePlate}`;
}

export default function OperationsPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  // Giữ tham chiếu t mới nhất để effect socket không reconnect khi đổi ngôn ngữ
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | FleetVehicleMapPoint["status"]
  >("all");
  // Một state duy nhất cho cả marker/list và panel theo dõi (khoá chung tripId)
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [focusCenter, setFocusCenter] = useState<GoogleMapCoordinate | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(() => new Date());
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
  // Chỉ đồng bộ ?tripId= từ URL vào state một lần sau lượt tải fleet đầu tiên
  const urlSyncDoneRef = useRef(false);
  // Xe + nhân sự cho form thay xe trong TripActionsPanel — tải một lần lúc mount
  const [operatorVehicles, setOperatorVehicles] = useState<OperatorVehicle[]>([]);
  const [operatorStaff, setOperatorStaff] = useState<OperatorUser[]>([]);
  // Chỉ OPERATOR_ADMIN được thay xe / huỷ chuyến / duyệt đề xuất lộ trình
  const canMutate = getAuthUser()?.role === "OPERATOR_ADMIN";
  // Số đề xuất lộ trình PENDING cho badge — chỉ tải với OPERATOR_ADMIN
  const [pendingProposalCount, setPendingProposalCount] = useState(0);
  // Panel đề xuất lộ trình mở khi URL có ?panel=proposals (F5 giữ trạng thái)
  const showProposalsPanel =
    canMutate && searchParams.get("panel") === "proposals";

  // Đếm proposal PENDING qua totalItems với pageSize tối thiểu — rẻ hơn tải cả trang
  const refreshPendingProposalCount = useCallback(() => {
    if (!canMutate) return;
    void getOperatorRouteChangeProposals({ page: 1, pageSize: 1, status: "PENDING" })
      .then((result) => setPendingProposalCount(result.totalItems))
      .catch(() => {
        // Badge chỉ mang tính thông tin — lỗi đếm không chặn màn
      });
  }, [canMutate]);

  // Badge tải một lần lúc mount; cập nhật realtime qua socket fleet
  // (routeProposal:created/resolved) — không còn interval poll 60s.
  useEffect(() => {
    refreshPendingProposalCount();
  }, [refreshPendingProposalCount]);

  const setProposalsPanelOpen = useCallback(
    (open: boolean) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (open) next.set("panel", "proposals");
          else next.delete("panel");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    let ignore = false;
    void Promise.all([
      getOperatorVehicles({ page: 1, pageSize: 100 }),
      getOperatorUsers({ page: 1, pageSize: 100 }),
    ])
      .then(([vehicleResult, userResult]) => {
        if (ignore) return;
        setOperatorVehicles(vehicleResult.items);
        setOperatorStaff(userResult.items);
      })
      .catch(() => {
        // Thiếu danh sách xe/nhân sự chỉ ảnh hưởng form thay xe — không chặn cả màn
      });
    return () => {
      ignore = true;
    };
  }, []);

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
    // "lost" (mất tín hiệu GPS) gộp chung vào ô cảnh báo với "offline"
    const offline = fleetVehicles.filter(
      (v) => v.status === "offline" || v.status === "lost",
    ).length;
    return { total, moving, idle, offline };
  }, [fleetVehicles]);

  const selectedTrip = useMemo(
    () =>
      selectedTripId
        ? tripOptions.find((trip) => trip.tripId === selectedTripId) ?? null
        : null,
    [selectedTripId, tripOptions],
  );

  // Chọn / bỏ chọn chuyến: cập nhật state + URL + tải geometry tuyến
  const selectTrip = useCallback(
    (nextTripId: string | null) => {
      setSelectedTripId(nextTripId);
      setDelayInfo(null);
      setEta(null);
      setRouteGeometry(null);
      setLatest(null);
      setTrail([]);
      setApiMessage("");
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (nextTripId) {
            next.set("tripId", nextTripId);
            // Chọn chuyến thì đóng panel đề xuất — cột phải chuyển sang chi tiết chuyến
            next.delete("panel");
          } else {
            next.delete("tripId");
          }
          return next;
        },
        { replace: true },
      );
      if (!nextTripId) return;

      void getTrackingTripRouteGeometry(nextTripId)
        .then((geometry) => setRouteGeometry(geometry))
        .catch(() => setRouteGeometry(null));
    },
    [setSearchParams],
  );

  // Click marker trên map hoặc chọn trong list = chọn chuyến theo dõi luôn
  const selectVehicle = useCallback(
    (id: string) => {
      selectTrip(id);
      const vehicle = fleetVehicles.find((item) => item.id === id);
      // Xe mất tín hiệu không có toạ độ — giữ nguyên focus hiện tại
      if (vehicle?.position) setFocusCenter(vehicle.position);
    },
    [fleetVehicles, selectTrip],
  );

  const loadFleet = useCallback(async () => {
    setIsFleetLoading(true);
    setApiError("");

    try {
      // 2 request thay vì N+1: trips (metadata/crew) + fleet-latest (vị trí batch),
      // merge theo tripId. Chuyến thiếu trong fleet-latest = mất tín hiệu GPS —
      // vẫn giữ trong danh sách với trạng thái "lost".
      const [result, fleetResult] = await Promise.all([
        getOperatorTrips({ status: "IN_PROGRESS", page: 1, pageSize: 100 }),
        getOperatorFleetLatest({ status: "IN_PROGRESS" }),
      ]);
      const nextVehicles = buildFleetVehicles(
        result.items,
        fleetResult.items,
        tRef.current("gps.unassignedDriver"),
      );
      setTripOptions(result.items);
      setFleetVehicles(nextVehicles);
      setFocusCenter(
        nextVehicles.find((vehicle) => vehicle.position)?.position ?? null,
      );
      setLastRefresh(new Date());
      return result.items;
    } catch (error: unknown) {
      setTripOptions([]);
      setFleetVehicles([]);
      setFocusCenter(null);
      setApiError(
        error instanceof Error ? error.message : t("gps.trackingLoadFailed"),
      );
      return [] as OperatorTripListItem[];
    } finally {
      setIsFleetLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadFleet().then((trips) => {
        if (urlSyncDoneRef.current) return;
        urlSyncDoneRef.current = true;
        // Deep-link ?tripId=... — id không tồn tại trong danh sách thì bỏ qua im lặng
        const urlTripId = searchParams.get("tripId");
        if (urlTripId && trips.some((trip) => trip.tripId === urlTripId)) {
          selectTrip(urlTripId);
        }
      });
    }, 0);

    return () => window.clearTimeout(timerId);
    // searchParams chỉ đọc một lần lúc vào màn — không đưa vào deps để tránh reload fleet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFleet, selectTrip]);

  // Poll fallback khi socket fleet mất kết nối: chỉ refresh vị trí batch,
  // không tải lại trips (metadata ít đổi, chờ reconnect refresh đủ).
  const pollFleetLatest = useCallback(() => {
    void getOperatorFleetLatest({ status: "IN_PROGRESS" })
      .then((fleetResult) => {
        setFleetVehicles((current) =>
          fleetResult.items.reduce(applyFleetGpsUpdate, current),
        );
        setLastRefresh(new Date());
      })
      .catch(() => {
        // Poll fallback chỉ mang tính bù đắp — lỗi thì chờ lượt sau/reconnect
      });
  }, []);

  const handleFleetGpsUpdate = useCallback((event: FleetGpsUpdateEvent) => {
    setFleetVehicles((current) => applyFleetGpsUpdate(current, event));
    setLastRefresh(new Date());
  }, []);

  const handleFleetReconnect = useCallback(() => {
    // Bù event đã lỡ trong lúc mất kết nối: 1 lần refresh vị trí + badge đề xuất
    pollFleetLatest();
    refreshPendingProposalCount();
  }, [pollFleetLatest, refreshPendingProposalCount]);

  useFleetSocket({
    onFleetGpsUpdate: handleFleetGpsUpdate,
    onProposalActivity: refreshPendingProposalCount,
    onFallbackPoll: pollFleetLatest,
    onReconnect: handleFleetReconnect,
  });

  // ETA REST khi chọn chuyến — socket eta:update mới hơn được ưu tiên
  // (chỉ đổ kết quả REST khi chưa có ETA nào). 403/404/không active bỏ qua im lặng.
  useEffect(() => {
    const tripId = selectedTripId?.trim() ?? "";
    if (!tripId) return;
    let cancelled = false;
    void getTrackingTripEta(tripId)
      .then((result) => {
        if (cancelled) return;
        setEta((current) => current ?? result);
      })
      .catch(() => {
        // ETA chỉ mang tính thông tin — lỗi giữ nguyên "-"
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTripId]);

  async function loadTripTracking() {
    const tripId = selectedTripId?.trim() ?? "";
    if (!tripId) {
      setApiError(t("gps.tripIdRequired"));
      return;
    }

    setIsApiLoading(true);
    setApiError("");
    setApiMessage("");

    try {
      // Geometry tuyến đã được tải khi chọn chuyến (selectTrip) — không gọi lại ở đây
      const [latestResult, trailResult] = await Promise.all([
        getTrackingTripLatest(tripId),
        getTrackingTripTrail(tripId, {
          page: 1,
          pageSize: 20,
          sortBy: "recordedAt",
          sortDir: "desc",
        }),
      ]);

      setLatest(latestResult);
      setTrail(trailResult.items);
      // Refresh ETA cùng lượt tải thủ công — lỗi (403/404/không active) giữ nguyên giá trị cũ
      void getTrackingTripEta(tripId)
        .then((etaResult) => setEta(etaResult))
        .catch(() => {});

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
    const tripId = selectedTripId?.trim() ?? "";
    const nextStatus: RealtimeStatus = tripId ? "connecting" : "idle";
    const statusTimer = window.setTimeout(() => {
      if (!cancelled) setRealtimeStatus(nextStatus);
    }, 0);

    if (!tripId) {
      return () => {
        cancelled = true;
        window.clearTimeout(statusTimer);
      };
    }

    const socket = createTrackingSocket();

    socket.on("connect", () => {
      void joinTripTracking(socket, tripId).then((ack) => {
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
  }, [selectedTripId]);

  return (
    <div className="flex flex-col gap-5 pb-2">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("operations.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 sm:text-base">
            {t("operations.subtitle")}
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

      <FleetFilterBar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
      />

      {apiError && !selectedTripId && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Trái: bản đồ đội xe chiếm phần lớn màn hình */}
        <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-inner xl:min-h-[min(72vh,640px)]">
          {/* Badge đề xuất lộ trình chờ duyệt — góc trên bản đồ, chỉ OPERATOR_ADMIN */}
          {canMutate && (
            <button
              type="button"
              onClick={() => setProposalsPanelOpen(!showProposalsPanel)}
              className={`absolute right-3 top-3 z-10 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                pendingProposalCount > 0
                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border-gray-200 bg-white/95 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t("operations.proposalsBadge", { count: pendingProposalCount })}
            </button>
          )}
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
              selectedId={selectedTripId}
              focusCenter={focusCenter}
              routePath={routeGeometryPath(routeGeometry)}
              trailPath={trailPath}
              onMarkerSelect={selectVehicle}
            />
          )}
          <FleetMapLegend />
        </div>

        {/* Phải: panel ngữ cảnh — đề xuất lộ trình khi mở, chi tiết chuyến khi chọn, KPI + danh sách xe mặc định */}
        {showProposalsPanel ? (
          <div className="flex min-h-0 flex-col gap-4 xl:max-h-[min(72vh,640px)] xl:overflow-y-auto">
            <ProposalsPanel
              onClose={() => setProposalsPanelOpen(false)}
              // "Xem trên bản đồ": chọn chuyến đó trên Operations — selectTrip tự đóng panel (xoá ?panel=)
              onViewTrip={selectVehicle}
              onProposalsChanged={refreshPendingProposalCount}
            />
          </div>
        ) : selectedTripId ? (
          // Cột phải scroll được khi panel theo dõi + panel hành động dài hơn bản đồ
          <div className="flex min-h-0 flex-col gap-4 xl:max-h-[min(72vh,640px)] xl:overflow-y-auto">
            <TripTrackingPanel
              tripId={selectedTripId}
              tripLabel={selectedTrip ? tripLabel(selectedTrip) : selectedTripId}
              routeId={selectedTrip?.route.routeId ?? null}
              realtimeStatus={realtimeStatus}
              delayInfo={delayInfo}
              isApiLoading={isApiLoading}
              apiMessage={apiMessage}
              apiError={apiError}
              latest={latest}
              trailCount={trail.length}
              eta={eta}
              onLoadTracking={() => void loadTripTracking()}
              onDeselect={() => selectTrip(null)}
            />
            <TripActionsPanel
              // key theo tripId: đổi chuyến thì remount, xoá sạch form/kết quả của chuyến trước
              key={selectedTripId}
              tripId={selectedTripId}
              trip={selectedTrip}
              vehicles={operatorVehicles}
              staff={operatorStaff}
              canMutate={canMutate}
              onTripReplaced={(newTripId) => {
                // Chuyển selection + URL sang chuyến mới, rồi tải lại fleet để list có chuyến đó.
                // Đổi lộ trình giữ nguyên tripId — selectTrip vẫn tải lại geometry lộ trình mới.
                selectTrip(newTripId);
                void loadFleet();
                // Đổi lộ trình trực tiếp có thể supersede đề xuất PENDING — cập nhật badge
                refreshPendingProposalCount();
              }}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
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
            <FleetVehicleList
              vehicles={filtered}
              fleetVehicles={fleetVehicles}
              selectedId={selectedTripId}
              onSelect={selectVehicle}
            />
          </div>
        )}
      </div>
    </div>
  );
}
