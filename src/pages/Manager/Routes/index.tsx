import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiMapPin, FiPlus, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import {
  addRouteStop,
  createOperatorRoute,
  getAlternativeRoutes,
  getOperatorRoute,
  getOperatorRoutes,
  getOperatorStations,
  getOperatorStops,
  getPublicLocations,
  removeRouteStop,
  updateOperatorRoute,
  type OperatorRoute,
  type OperatorRouteRequest,
  type OperatorStop,
  type AdminLocation,
  type RouteStopRequest,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import Modal from "../../../components/Modal";
import CustomSelect from "../../../components/CustomSelect";
import {
  inputClass,
  labelClass,
} from "../../../components/form/formClasses";
import {
  estimateCoachDurationMinutes,
  type RouteCoordinate,
} from "./polyline";
import { toNumber } from "../../../utils/number";
import { distanceKmBetween } from "./geometry";
import {
  draftRouteId,
  emptyRouteForm,
  isGuid,
  mergeStations,
  routeToForm,
  toRouteStopRequest,
  toStationOption,
} from "./routeFormUtils";
import type {
  FeedbackScope,
  RouteMapPoint,
  RouteStopDraft,
  StationOption,
} from "./types";
import { useRouteGeometry } from "./useRouteGeometry";
import { useAlternativeRoutes } from "./useAlternativeRoutes";
import { useStationManagement } from "./useStationManagement";
import { useStopForm } from "./useStopForm";
import InlineFeedback from "./InlineFeedback";
import SectionHeader from "./SectionHeader";
import { Input } from "./formControls";
import StationManagementPanel from "./StationManagementPanel";
import RouteFormSection from "./RouteFormSection";
import AlternativeRoutesSection from "./AlternativeRoutesSection";
import StopEditorCard from "./StopEditorCard";
import RouteStopList from "./RouteStopList";
import GeometryPanel from "./GeometryPanel";

export default function RoutesPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const canManageRoutes = getAuthUser()?.role === "OPERATOR_ADMIN";
  const [routes, setRoutes] = useState<OperatorRoute[]>([]);
  const [stops, setStops] = useState<OperatorStop[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [routeStopDrafts, setRouteStopDrafts] = useState<RouteStopDraft[]>([]);
  const [routeForm, setRouteForm] =
    useState<OperatorRouteRequest>(emptyRouteForm);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedStopId, setSelectedStopId] = useState("");
  const [routeStopOrder, setRouteStopOrder] = useState("1");
  const [routeStopDuration, setRouteStopDuration] = useState("0");
  const [routeStopDistance, setRouteStopDistance] = useState("0");
  const [allowPickup, setAllowPickup] = useState(true);
  const [allowDropoff, setAllowDropoff] = useState(true);
  const [message, setMessage] = useState("");
  const [messageScope, setMessageScope] = useState<FeedbackScope>("global");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [routeStopPendingRemoval, setRouteStopPendingRemoval] =
    useState<RouteStopDraft | null>(null);
  const lastEstimatedRoutePairRef = useRef("");
  // Ref giữ giá trị mới nhất để loadData không phải phụ thuộc vào
  // selectedRouteId/selectedStopId/t — tránh refetch toàn bộ khi chọn tuyến/điểm dừng
  const tRef = useRef(t);
  const selectedRouteIdRef = useRef(selectedRouteId);
  const selectedStopIdRef = useRef(selectedStopId);

  useEffect(() => {
    tRef.current = t;
    selectedRouteIdRef.current = selectedRouteId;
    selectedStopIdRef.current = selectedStopId;
  });

  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId) ?? null,
    [routes, selectedRouteId],
  );
  const selectedStop = useMemo(
    () => stops.find((stop) => stop.id === selectedStopId) ?? null,
    [selectedStopId, stops],
  );
  const selectedOriginStation = useMemo(
    () => stations.find((station) => station.id === routeForm.originStationId),
    [routeForm.originStationId, stations],
  );
  const selectedDestinationStation = useMemo(
    () =>
      stations.find((station) => station.id === routeForm.destinationStationId),
    [routeForm.destinationStationId, stations],
  );
  const activeRouteKey = selectedRoute?.id ?? draftRouteId;
  const activeRouteName =
    selectedRoute?.name || routeForm.name.trim() || t("routes.draftRoute");
  const currentRouteStops = useMemo(
    () =>
      routeStopDrafts
        .filter((item) => item.routeId === activeRouteKey)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [activeRouteKey, routeStopDrafts],
  );
  const routeMapPoints = useMemo(() => {
    const origin = stations.find(
      (station) => station.id === routeForm.originStationId,
    );
    const destination = stations.find(
      (station) => station.id === routeForm.destinationStationId,
    );

    return [
      origin
        ? {
            id: `origin-${origin.id}`,
            name: `${t("routes.origin")}: ${origin.name}`,
            latitude: origin.latitude,
            longitude: origin.longitude,
            color: "#0f766e",
          }
        : null,
      ...currentRouteStops.map((stop) => ({
        id: `stop-${stop.stopId}-${stop.orderIndex}`,
        name: `#${stop.orderIndex} · ${stop.stopName}`,
        latitude: stop.latitude,
        longitude: stop.longitude,
        color: stop.allowPickup && stop.allowDropoff ? "#2563eb" : "#f59e0b",
      })),
      destination
        ? {
            id: `destination-${destination.id}`,
            name: `${t("routes.destination")}: ${destination.name}`,
            latitude: destination.latitude,
            longitude: destination.longitude,
            color: "#dc2626",
          }
        : null,
    ].filter((point): point is RouteMapPoint => Boolean(point));
  }, [
    currentRouteStops,
    routeForm.destinationStationId,
    routeForm.originStationId,
    stations,
    t,
  ]);

  const routeWaypoints = useMemo<RouteCoordinate[]>(
    () =>
      routeMapPoints.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    [routeMapPoints],
  );

  const geometry = useRouteGeometry({
    selectedRouteId,
    routeForm,
    routeWaypoints,
    setRouteForm,
    setRoutes,
    setError,
    showMessage,
    t,
  });
  const alternatives = useAlternativeRoutes({
    selectedRouteId,
    originStationId: routeForm.originStationId,
    stops,
    setError,
    showMessage,
    t,
  });
  const stationManager = useStationManagement({
    stations,
    setStations,
    updateRoute,
    setError,
    showMessage,
    t,
  });
  const stopFormControl = useStopForm({
    selectedStopId,
    setSelectedStopId,
    setStops,
    setError,
    showMessage,
    t,
  });
  const { applySavedGeometry } = geometry;
  const { applyAlternatives } = alternatives;
  const { setStopForm } = stopFormControl;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [routeResult, stopResult, stationResult, locationResult] =
        await Promise.all([
          getOperatorRoutes({ page: 1, pageSize: 50 }),
          getOperatorStops({ page: 1, pageSize: 50 }),
          getOperatorStations({ page: 1, pageSize: 100 }),
          getPublicLocations(),
        ]);
      const nextRouteSummary =
        routeResult.items.find(
          (item) => item.id === selectedRouteIdRef.current,
        ) ?? routeResult.items[0];
      const nextRoute = nextRouteSummary
        ? await getOperatorRoute(nextRouteSummary.id)
        : undefined;
      const alternativeResult = nextRoute
        ? await getAlternativeRoutes(nextRoute.id, { page: 1, pageSize: 2 })
        : undefined;
      const nextStop =
        stopResult.items.find((item) => item.id === selectedStopIdRef.current) ??
        stopResult.items[0];

      setRoutes(
        nextRoute
          ? routeResult.items.map((route) =>
              route.id === nextRoute.id ? nextRoute : route,
            )
          : routeResult.items,
      );
      setStops(stopResult.items);
      setStations(
        mergeStations([], stationResult.items.map(toStationOption)).filter(
          (station) => station.id && station.name,
        ),
      );
      setLocations(locationResult.filter((location) => location.isActive));
      setSelectedRouteId(nextRoute?.id ?? "");
      setSelectedStopId(nextStop?.id ?? "");
      applyAlternatives(alternativeResult?.items ?? []);

      if (nextRoute) {
        lastEstimatedRoutePairRef.current = `${nextRoute.originStationId}:${nextRoute.destinationStationId}`;
        setRouteForm(routeToForm(nextRoute));
        applySavedGeometry(nextRoute);
      } else {
        applySavedGeometry(null);
      }

      if (nextStop) {
        setStopForm({
          name: nextStop.name,
          latitude: nextStop.latitude,
          longitude: nextStop.longitude,
          description: nextStop.description ?? "",
          address: nextStop.address ?? "",
          googlePlaceId: nextStop.googlePlaceId,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tRef.current("routes.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [applyAlternatives, applySavedGeometry, setStopForm]);

  // Chỉ chạy khi mount — chi tiết tuyến/điểm dừng đang chọn do handleSelectRoute/handleSelectStop đảm nhiệm
  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  useEffect(() => {
    if (!canManageRoutes || !selectedOriginStation || !selectedDestinationStation) {
      return;
    }

    if (
      selectedOriginStation.id === selectedDestinationStation.id ||
      !selectedOriginStation.latitude ||
      !selectedOriginStation.longitude ||
      !selectedDestinationStation.latitude ||
      !selectedDestinationStation.longitude
    ) {
      return;
    }

    const routePairKey = `${selectedOriginStation.id}:${selectedDestinationStation.id}`;
    const shouldEstimate =
      lastEstimatedRoutePairRef.current !== routePairKey ||
      routeForm.totalDistanceKm === 0 ||
      routeForm.estimatedDurationMinutes === 0;

    if (!shouldEstimate) {
      return;
    }

    const distance = distanceKmBetween(
      selectedOriginStation,
      selectedDestinationStation,
    );
    const totalDistanceKm = Number(distance.toFixed(1));
    const estimatedDurationMinutes = estimateCoachDurationMinutes(distance);

    lastEstimatedRoutePairRef.current = routePairKey;
    setRouteForm((current) => {
      if (
        current.originStationId !== selectedOriginStation.id ||
        current.destinationStationId !== selectedDestinationStation.id
      ) {
        return current;
      }

      return {
        ...current,
        totalDistanceKm,
        estimatedDurationMinutes,
      };
    });
  }, [
    canManageRoutes,
    routeForm.estimatedDurationMinutes,
    routeForm.totalDistanceKm,
    selectedDestinationStation,
    selectedOriginStation,
  ]);

  function runAction(action: () => Promise<void>) {
    setError("");
    setMessage("");
    setMessageScope("global");
    void action().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : t("routes.actionFailed"));
    });
  }

  function showMessage(scope: FeedbackScope, nextMessage: string) {
    setMessageScope(scope);
    setMessage(nextMessage);
  }

  function updateRoute<K extends keyof OperatorRouteRequest>(
    key: K,
    value: OperatorRouteRequest[K],
  ) {
    if (
      (key === "originStationId" || key === "destinationStationId") &&
      routeForm[key] !== value
    ) {
      geometry.invalidateLocalGeometry();
    }

    setRouteForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreateRoute() {
    if (!routeForm.name.trim()) {
      setError(t("routes.routeNameRequired"));
      return;
    }

    if (!routeForm.originStationId || !routeForm.destinationStationId) {
      setError(t("routes.routeStationsRequired"));
      return;
    }

    if (
      !isGuid(routeForm.originStationId) ||
      !isGuid(routeForm.destinationStationId)
    ) {
      setError(t("routes.routeStationIdsInvalid"));
      return;
    }

    if (routeForm.originStationId === routeForm.destinationStationId) {
      setError(t("routes.originDestinationDifferent"));
      return;
    }

    const pendingStops = routeStopDrafts.filter(
      (item) => item.routeId === draftRouteId,
    );
    const created = await createOperatorRoute({
      ...routeForm,
      returnRouteId: routeForm.returnRouteId || null,
    });

    await Promise.all(
      pendingStops.map((item) =>
        addRouteStop(created.id, toRouteStopRequest(item)),
      ),
    );

    setRoutes((prev) => [created, ...prev]);
    setSelectedRouteId(created.id);
    setRouteForm(routeToForm(created));
    alternatives.resetAlternatives();
    applySavedGeometry(created);
    setRouteStopDrafts((prev) => [
      ...prev.filter((item) => item.routeId !== draftRouteId),
      ...pendingStops.map((item) => ({
        ...item,
        routeId: created.id,
        routeName: created.name,
      })),
    ]);
    showMessage("route", t("routes.routeCreated"));
  }

  async function handleSelectRoute(routeId: string) {
    setSelectedRouteId(routeId);

    if (!routeId) {
      lastEstimatedRoutePairRef.current = "";
      setRouteForm(emptyRouteForm);
      alternatives.resetAlternatives();
      applySavedGeometry(null);
      return;
    }

    const [route, alternativeResult] = await Promise.all([
      getOperatorRoute(routeId),
      getAlternativeRoutes(routeId, { page: 1, pageSize: 2 }),
    ]);
    applyAlternatives(alternativeResult.items);
    alternatives.setAlternativeStopId("");
    setRoutes((prev) =>
      prev.some((item) => item.id === route.id)
        ? prev.map((item) => (item.id === route.id ? route : item))
        : [route, ...prev],
    );
    lastEstimatedRoutePairRef.current = `${route.originStationId}:${route.destinationStationId}`;
    setRouteForm(routeToForm(route));
    applySavedGeometry(route);
  }

  async function handleUpdateRoute() {
    if (!selectedRouteId) {
      setError(t("routes.selectRouteFirst"));
      return;
    }

    if (!routeForm.name.trim()) {
      setError(t("routes.routeNameRequired"));
      return;
    }

    if (routeForm.originStationId === routeForm.destinationStationId) {
      setError(t("routes.originDestinationDifferent"));
      return;
    }

    if (
      !isGuid(routeForm.originStationId) ||
      !isGuid(routeForm.destinationStationId)
    ) {
      setError(t("routes.routeStationIdsInvalid"));
      return;
    }

    const updated = await updateOperatorRoute(selectedRouteId, {
      ...routeForm,
      returnRouteId: routeForm.returnRouteId || null,
    });
    setRoutes((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
    setRouteForm(routeToForm(updated));
    applySavedGeometry(updated);
    showMessage("route", t("routes.routeUpdated"));
  }

  async function handleAddRouteStop() {
    if (!selectedStop) {
      setError(t("routes.routeStopRequired"));
      return;
    }

    const orderIndex = toNumber(routeStopOrder);
    const duplicateOrder = routeStopDrafts.some(
      (item) =>
        item.routeId === activeRouteKey && item.orderIndex === orderIndex,
    );

    if (duplicateOrder) {
      setError(t("routes.duplicateStopOrder"));
      return;
    }

    const request: RouteStopRequest = {
      stopId: selectedStop.id,
      orderIndex,
      estimatedDurationFromOriginMinutes: toNumber(routeStopDuration),
      distanceFromOriginKm: toNumber(routeStopDistance),
      allowPickup,
      allowDropoff,
    };

    if (selectedRoute) {
      await addRouteStop(selectedRoute.id, request);
      geometry.invalidateLocalGeometry(selectedRoute.id);
    }

    setRouteStopDrafts((prev) => [
      ...prev,
      {
        ...request,
        routeId: activeRouteKey,
        routeName: activeRouteName,
        stopName: selectedStop.name,
        latitude: selectedStop.latitude,
        longitude: selectedStop.longitude,
      },
    ]);
    setRouteStopOrder(String(orderIndex + 1));
    showMessage(
      "routeStop",
      selectedRoute
        ? t("routes.routeStopAdded")
        : t("routes.routeStopDraftAdded"),
    );
  }

  async function handleEstimateRouteStopMetrics() {
    const origin = stations.find(
      (station) => station.id === routeForm.originStationId,
    );

    if (!origin || !selectedStop) {
      setError(t("routes.estimateRequiresOriginAndStop"));
      return;
    }

    if (
      !origin.latitude ||
      !origin.longitude ||
      !selectedStop.latitude ||
      !selectedStop.longitude
    ) {
      setError(t("routes.estimateRequiresCoordinates"));
      return;
    }

    const distance = distanceKmBetween(origin, selectedStop);
    const durationMinutes = estimateCoachDurationMinutes(distance);

    setRouteStopDistance(distance.toFixed(1));
    setRouteStopDuration(String(durationMinutes));
    showMessage("routeStop", t("routes.estimatedRouteStopMetrics"));
  }

  async function handleRemoveRouteStop(item: RouteStopDraft) {
    if (item.routeId === draftRouteId) {
      setRouteStopDrafts((prev) =>
        prev.filter(
          (draft) =>
            draft.routeId !== draftRouteId ||
            draft.stopId !== item.stopId ||
            draft.orderIndex !== item.orderIndex,
        ),
      );
      setRouteStopPendingRemoval(null);
      showMessage("routeStop", t("routes.routeStopRemoved"));
      return;
    }

    if (!selectedRoute) {
      setError(t("routes.selectRouteFirst"));
      return;
    }

    await removeRouteStop(selectedRoute.id, item.stopId);
    geometry.invalidateLocalGeometry(selectedRoute.id);
    setRouteStopDrafts((prev) =>
      prev.filter(
        (draft) =>
          draft.routeId !== selectedRoute.id ||
          draft.stopId !== item.stopId ||
          draft.orderIndex !== item.orderIndex,
      ),
    );
    setRouteStopPendingRemoval(null);
    showMessage("routeStop", t("routes.routeStopRemoved"));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("routes.manageTitle")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            {t("routes.manageSubtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => runAction(loadData)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <FiRefreshCw size={16} />
          {tc("refresh")}
        </button>
      </div>

      {message && messageScope === "global" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[440px_minmax(0,1fr)]">
        <main className="min-w-0 space-y-5">
          {/* Danh mục bến: thao tác một lần cho mỗi bến nên thu gọn mặc định */}
          <StationManagementPanel
            canManageRoutes={canManageRoutes}
            stations={stations}
            locations={locations}
            manager={stationManager}
            onRunAction={runAction}
            feedbackMessage={messageScope === "station" ? message : ""}
          />

          <RouteFormSection
            canManageRoutes={canManageRoutes}
            routes={routes}
            stations={stations}
            selectedRouteId={selectedRouteId}
            form={routeForm}
            onUpdateField={updateRoute}
            onSelectRoute={(routeId) =>
              runAction(() => handleSelectRoute(routeId))
            }
            onCreateRoute={() => runAction(handleCreateRoute)}
            onUpdateRoute={() => runAction(handleUpdateRoute)}
            feedbackMessage={messageScope === "route" ? message : ""}
          />

          <AlternativeRoutesSection
            canManageRoutes={canManageRoutes}
            hasSelectedRoute={Boolean(selectedRouteId)}
            stations={stations}
            stops={stops}
            alternatives={alternatives}
            onRunAction={runAction}
            feedbackMessage={messageScope === "alternative" ? message : ""}
          />

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <SectionHeader
              icon={<FiMapPin />}
              title={t("routes.routeStopsTitle")}
              subtitle={t("routes.routeStopsHint")}
            />
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelClass}>{t("routes.stop")}</label>
                <CustomSelect
                  className={inputClass}
                  value={selectedStopId}
                  onChange={(event) =>
                    runAction(() =>
                      stopFormControl.handleSelectStop(event.target.value),
                    )
                  }
                >
                  <option value="">{t("routes.selectStop")}</option>
                  {stops.map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name}
                    </option>
                  ))}
                </CustomSelect>
              </div>
              {canManageRoutes && (
                <StopEditorCard
                  selectedStopPlace={stopFormControl.selectedStopPlace}
                  onSelectPlace={stopFormControl.applyStopPlace}
                  description={stopFormControl.stopForm.description ?? ""}
                  onChangeDescription={(value) =>
                    stopFormControl.updateStop("description", value)
                  }
                  onCreateStop={() =>
                    runAction(stopFormControl.handleCreateStop)
                  }
                  onUpdateStop={() =>
                    runAction(stopFormControl.handleUpdateStop)
                  }
                  canUpdate={Boolean(selectedStopId)}
                  feedbackMessage={messageScope === "stop" ? message : ""}
                />
              )}
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label={t("routes.stopOrder")}
                  value={routeStopOrder}
                  onChange={setRouteStopOrder}
                  type="number"
                  disabled={!canManageRoutes}
                />
                <Input
                  label={t("routes.durationFromOrigin")}
                  value={routeStopDuration}
                  onChange={setRouteStopDuration}
                  type="number"
                  disabled={!canManageRoutes}
                />
                <Input
                  label={t("routes.distanceFromOrigin")}
                  value={routeStopDistance}
                  onChange={setRouteStopDistance}
                  type="number"
                  disabled={!canManageRoutes}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={allowPickup}
                  disabled={!canManageRoutes}
                  onChange={(event) => setAllowPickup(event.target.checked)}
                />
                {t("routes.allowPickup")}
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={allowDropoff}
                  disabled={!canManageRoutes}
                  onChange={(event) => setAllowDropoff(event.target.checked)}
                />
                {t("routes.allowDropoff")}
              </label>
              {canManageRoutes && (
                <>
                  <button
                    type="button"
                    onClick={() => runAction(handleAddRouteStop)}
                    disabled={!selectedStopId}
                    className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:opacity-50"
                  >
                    <FiPlus size={16} />
                    {t("routes.addStopToRoute")}
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction(handleEstimateRouteStopMetrics)}
                    disabled={!routeForm.originStationId || !selectedStopId}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <FiRefreshCw size={16} />
                    {t("routes.estimateRouteStopMetrics")}
                  </button>
                </>
              )}
            </div>
            <RouteStopList
              activeRouteName={activeRouteName}
              items={currentRouteStops}
              canManageRoutes={canManageRoutes}
              onRequestRemove={setRouteStopPendingRemoval}
            />
            <InlineFeedback
              message={messageScope === "routeStop" ? message : ""}
            />
          </section>
        </main>

        <GeometryPanel
          canManageRoutes={canManageRoutes}
          geometry={geometry}
          points={routeMapPoints}
          waypointCount={routeWaypoints.length}
          hasSelectedRoute={Boolean(selectedRouteId)}
          hasSavedPolyline={Boolean(selectedRoute?.pathPolyline)}
          onRunAction={runAction}
          feedbackMessage={messageScope === "geometry" ? message : ""}
        />
      </div>

      {isLoading && (
        <p className="text-sm text-gray-500">{t("routes.loading")}</p>
      )}

      <Modal
        open={Boolean(routeStopPendingRemoval)}
        onClose={() => setRouteStopPendingRemoval(null)}
        title={t("routes.removeRouteStopTitle")}
        subtitle={t("routes.removeRouteStopSubtitle")}
        icon={<FiTrash2 />}
        footer={
          <>
            <button
              type="button"
              onClick={() => setRouteStopPendingRemoval(null)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (routeStopPendingRemoval) {
                  runAction(() =>
                    handleRemoveRouteStop(routeStopPendingRemoval),
                  );
                }
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              {tc("delete")}
            </button>
          </>
        }
      >
        <p className="text-sm leading-6 text-gray-600">
          {t("routes.removeRouteStopConfirm", {
            stopName: routeStopPendingRemoval?.stopName ?? "",
          })}
        </p>
      </Modal>
    </div>
  );
}
