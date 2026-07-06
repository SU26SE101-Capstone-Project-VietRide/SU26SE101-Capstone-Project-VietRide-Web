import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheckCircle,
  FiDollarSign,
  FiGitBranch,
  FiMapPin,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiShuffle,
  FiTrash2,
} from "react-icons/fi";
import {
  addRouteStop,
  createAlternativeRoute,
  createRouteFareTemplate,
  createOperatorRoute,
  createOperatorStation,
  createOperatorStop,
  getAlternativeRoutes,
  getOperatorRoute,
  getOperatorRoutes,
  getOperatorStop,
  getOperatorStops,
  getRouteFareTemplates,
  removeRouteStop,
  searchStations,
  updateOperatorRoute,
  updateOperatorStop,
  type AlternativeRoute,
  type AlternativeRouteRequest,
  type FareTemplate,
  type FareTemplateRequest,
  type OperatorRoute,
  type OperatorRouteRequest,
  type OperatorStop,
  type OperatorStopRequest,
  type RouteStopRequest,
  type Station,
} from "../../../api/vietride";
import PlacePicker, { type PlaceSelection } from "../../../components/PlacePicker";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

const emptyStopForm: OperatorStopRequest = {
  name: "",
  latitude: 0,
  longitude: 0,
  description: "",
  address: "",
  googlePlaceId: "",
};

const emptyRouteForm: OperatorRouteRequest = {
  name: "",
  originStationId: "",
  destinationStationId: "",
  returnRouteId: "",
  baseFare: 0,
  totalDistanceKm: 0,
  estimatedDurationMinutes: 0,
  isActive: true,
};

const emptyAlternativeForm: AlternativeRouteRequest = {
  name: "",
  description: "",
  destinationStationId: "",
  totalDistanceKm: 0,
  estimatedDurationMinutes: 0,
  isActive: true,
  stops: [],
};

const emptyFareTemplateForm: FareTemplateRequest = {
  stopId: "",
  fareFromThisStop: 0,
  effectiveFrom: "",
  effectiveUntil: "",
};

type RouteStopDraft = RouteStopRequest & {
  routeName: string;
  stopName: string;
};

type StationOption = Station & {
  address?: string;
};

function toNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function routeToForm(route: OperatorRoute): OperatorRouteRequest {
  return {
    name: route.name,
    originStationId: route.originStationId,
    destinationStationId: route.destinationStationId,
    returnRouteId: route.returnRouteId ?? "",
    baseFare: route.baseFare,
    totalDistanceKm: route.totalDistanceKm,
    estimatedDurationMinutes: route.estimatedDurationMinutes,
    isActive: route.isActive,
  };
}

export default function RoutesPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [routes, setRoutes] = useState<OperatorRoute[]>([]);
  const [stops, setStops] = useState<OperatorStop[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [stationPlaceDraft, setStationPlaceDraft] =
    useState<PlaceSelection | null>(null);
  const [routeStopDrafts, setRouteStopDrafts] = useState<RouteStopDraft[]>([]);
  const [selectedStationId, setSelectedStationId] = useState("");
  const [stopForm, setStopForm] = useState<OperatorStopRequest>(emptyStopForm);
  const [routeForm, setRouteForm] =
    useState<OperatorRouteRequest>(emptyRouteForm);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedStopId, setSelectedStopId] = useState("");
  const [routeStopOrder, setRouteStopOrder] = useState("1");
  const [routeStopDuration, setRouteStopDuration] = useState("0");
  const [routeStopDistance, setRouteStopDistance] = useState("0");
  const [allowPickup, setAllowPickup] = useState(true);
  const [allowDropoff, setAllowDropoff] = useState(true);
  const [alternativeForm, setAlternativeForm] =
    useState<AlternativeRouteRequest>(emptyAlternativeForm);
  const [alternativeRoutes, setAlternativeRoutes] = useState<AlternativeRoute[]>(
    [],
  );
  const [fareTemplates, setFareTemplates] = useState<FareTemplate[]>([]);
  const [fareTemplateForm, setFareTemplateForm] =
    useState<FareTemplateRequest>(emptyFareTemplateForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId) ?? null,
    [routes, selectedRouteId],
  );
  const selectedStop = useMemo(
    () => stops.find((stop) => stop.id === selectedStopId) ?? null,
    [selectedStopId, stops],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [routeResult, stopResult] = await Promise.all([
        getOperatorRoutes({ page: 1, pageSize: 50 }),
        getOperatorStops({ page: 1, pageSize: 50 }),
      ]);
      const nextRoute =
        routeResult.items.find((item) => item.id === selectedRouteId) ??
        routeResult.items[0];
      const nextStop =
        stopResult.items.find((item) => item.id === selectedStopId) ??
        stopResult.items[0];

      setRoutes(routeResult.items);
      setStops(stopResult.items);
      setSelectedRouteId(nextRoute?.id ?? "");
      setSelectedStopId(nextStop?.id ?? "");

      if (nextRoute) {
        setRouteForm(routeToForm(nextRoute));
      }

      if (nextStop) {
        setStopForm({
          name: nextStop.name,
          latitude: nextStop.latitude,
          longitude: nextStop.longitude,
          description: nextStop.description,
          address: nextStop.address,
          googlePlaceId: nextStop.googlePlaceId,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("routes.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [selectedRouteId, selectedStopId, t]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  function runAction(action: () => Promise<void>) {
    setError("");
    setMessage("");
    void action().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : t("routes.actionFailed"));
    });
  }

  function updateStop<K extends keyof OperatorStopRequest>(
    key: K,
    value: OperatorStopRequest[K],
  ) {
    setStopForm((prev) => ({ ...prev, [key]: value }));
  }

  const selectedStationPlace = useMemo<PlaceSelection | null>(() => {
    const station = stations.find((item) => item.id === selectedStationId);

    if (!station) {
      return stationPlaceDraft;
    }

    return {
      placeId: station.id,
      name: station.name,
      address: station.address ?? `${station.name}, ${station.city || station.province}`,
      city: station.city,
      province: station.province,
      latitude: station.latitude,
      longitude: station.longitude,
    };
  }, [selectedStationId, stationPlaceDraft, stations]);

  const selectedStopPlace = useMemo<PlaceSelection | null>(() => {
    if (!stopForm.latitude || !stopForm.longitude) {
      return null;
    }

    return {
      placeId: stopForm.googlePlaceId || `${stopForm.latitude},${stopForm.longitude}`,
      name: stopForm.name,
      address: stopForm.address,
      city: "",
      province: "",
      latitude: stopForm.latitude,
      longitude: stopForm.longitude,
    };
  }, [stopForm]);

  async function applyStationPlace(place: PlaceSelection) {
    setStationPlaceDraft(place);
    setSelectedStationId("");

    const result = await searchStations({
      q: place.name,
      city: place.city,
      province: place.province,
    });

    if (!result.length) {
      setStations([]);
      setError(t("routes.platformStationNotFound"));
      return;
    }

    setStations(result);
    setSelectedStationId(result[0]?.id ?? "");
    setMessage(t("routes.stationSearchFound", { count: result.length }));
  }

  function applyStopPlace(place: PlaceSelection) {
    setStopForm((current) => ({
      ...current,
      name: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      googlePlaceId: place.placeId,
    }));
  }

  function updateRoute<K extends keyof OperatorRouteRequest>(
    key: K,
    value: OperatorRouteRequest[K],
  ) {
    setRouteForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateAlternative<K extends keyof AlternativeRouteRequest>(
    key: K,
    value: AlternativeRouteRequest[K],
  ) {
    setAlternativeForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateFareTemplate<K extends keyof FareTemplateRequest>(
    key: K,
    value: FareTemplateRequest[K],
  ) {
    setFareTemplateForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAttachStation() {
    if (!selectedStationId) {
      setError(t("routes.stationRequired"));
      return;
    }

    const station = stations.find((item) => item.id === selectedStationId);
    await createOperatorStation({
      stationId: selectedStationId,
      displayNameOverride: station?.name,
      counterLocation: "",
      contactPhone: "",
      instructions: "",
      name: station?.name,
      city: station?.city,
      province: station?.province,
      latitude: station?.latitude,
      longitude: station?.longitude,
      addressStreet: station?.address ?? station?.name,
      contactEmail: "",
      operatingHours: "",
      facilities: "",
      supportsShuttle: false,
    });
    setMessage(t("routes.stationAttached"));
  }

  async function handleCreateStop() {
    if (!stopForm.name.trim() || !stopForm.address.trim()) {
      setError(t("routes.stopRequired"));
      return;
    }

    if (!stopForm.latitude || !stopForm.longitude) {
      setError(t("routes.coordinatesRequired"));
      return;
    }

    const created = await createOperatorStop(stopForm);
    setStops((prev) => [created, ...prev]);
    setSelectedStopId(created.id);
    setStopForm(emptyStopForm);
    setMessage(t("routes.stopCreated"));
  }

  async function handleUpdateStop() {
    if (!selectedStopId) {
      setError(t("routes.selectStopFirst"));
      return;
    }

    if (!stopForm.name.trim() || !stopForm.address.trim()) {
      setError(t("routes.stopRequired"));
      return;
    }

    const updated = await updateOperatorStop(selectedStopId, stopForm);
    setStops((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
    setMessage(t("routes.stopUpdated"));
  }

  async function handleSelectStop(stopId: string) {
    setSelectedStopId(stopId);

    if (!stopId) {
      setStopForm(emptyStopForm);
      return;
    }

    const stop = await getOperatorStop(stopId);
    setStops((prev) =>
      prev.some((item) => item.id === stop.id)
        ? prev.map((item) => (item.id === stop.id ? stop : item))
        : [stop, ...prev],
    );
    setStopForm({
      name: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
      description: stop.description,
      address: stop.address,
      googlePlaceId: stop.googlePlaceId,
    });
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

    if (routeForm.originStationId === routeForm.destinationStationId) {
      setError(t("routes.originDestinationDifferent"));
      return;
    }

    const created = await createOperatorRoute({
      ...routeForm,
      returnRouteId: routeForm.returnRouteId || undefined,
    });
    setRoutes((prev) => [created, ...prev]);
    setSelectedRouteId(created.id);
    setRouteForm(emptyRouteForm);
    setMessage(t("routes.routeCreated"));
  }

  async function handleSelectRoute(routeId: string) {
    setSelectedRouteId(routeId);

    if (!routeId) {
      setRouteForm(emptyRouteForm);
      setFareTemplates([]);
      setAlternativeRoutes([]);
      return;
    }

    const [route, fareResult, alternativeResult] = await Promise.all([
      getOperatorRoute(routeId),
      getRouteFareTemplates(routeId, { page: 1, pageSize: 50 }),
      getAlternativeRoutes(routeId, { page: 1, pageSize: 50 }),
    ]);
    setRoutes((prev) =>
      prev.some((item) => item.id === route.id)
        ? prev.map((item) => (item.id === route.id ? route : item))
        : [route, ...prev],
    );
    setRouteForm(routeToForm(route));
    setFareTemplates(fareResult.items);
    setAlternativeRoutes(alternativeResult.items);
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

    const updated = await updateOperatorRoute(selectedRouteId, {
      ...routeForm,
      returnRouteId: routeForm.returnRouteId || undefined,
    });
    setRoutes((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
    setRouteForm(routeToForm(updated));
    setMessage(t("routes.routeUpdated"));
  }

  async function handleAddRouteStop() {
    if (!selectedRoute || !selectedStop) {
      setError(t("routes.routeStopRequired"));
      return;
    }

    const orderIndex = toNumber(routeStopOrder);
    const duplicateOrder = routeStopDrafts.some(
      (item) => item.routeName === selectedRoute.name && item.orderIndex === orderIndex,
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

    await addRouteStop(selectedRoute.id, request);
    setRouteStopDrafts((prev) => [
      ...prev,
      { ...request, routeName: selectedRoute.name, stopName: selectedStop.name },
    ]);
    setRouteStopOrder(String(orderIndex + 1));
    setMessage(t("routes.routeStopAdded"));
  }

  async function handleRemoveRouteStop(stopId: string) {
    if (!selectedRoute) {
      setError(t("routes.selectRouteFirst"));
      return;
    }

    await removeRouteStop(selectedRoute.id, stopId);
    setRouteStopDrafts((prev) =>
      prev.filter(
        (item) => item.routeName !== selectedRoute.name || item.stopId !== stopId,
      ),
    );
    setMessage(t("routes.routeStopRemoved"));
  }

  async function handleCreateFareTemplate() {
    if (!selectedRoute) {
      setError(t("routes.selectRouteFirst"));
      return;
    }

    if (!fareTemplateForm.stopId || fareTemplateForm.fareFromThisStop <= 0) {
      setError(t("routes.fareTemplateRequired"));
      return;
    }

    const created = await createRouteFareTemplate(
      selectedRoute.id,
      fareTemplateForm,
    );
    setFareTemplates((prev) => [created, ...prev]);
    setFareTemplateForm(emptyFareTemplateForm);
    setMessage(t("routes.fareTemplateCreated"));
  }

  async function handleCreateAlternativeRoute() {
    if (!selectedRoute) {
      setError(t("routes.selectRouteFirst"));
      return;
    }

    if (!alternativeForm.name.trim() || !alternativeForm.destinationStationId) {
      setError(t("routes.alternativeRequired"));
      return;
    }

    await createAlternativeRoute(selectedRoute.id, {
      ...alternativeForm,
      stops: routeStopDrafts
        .filter((item) => item.routeName === selectedRoute.name)
        .map((item) => ({
          stopId: item.stopId,
          orderIndex: item.orderIndex,
          estimatedDurationFromOriginMinutes:
            item.estimatedDurationFromOriginMinutes,
          distanceFromOriginKm: item.distanceFromOriginKm,
        })),
    });
    const alternativeResult = await getAlternativeRoutes(selectedRoute.id, {
      page: 1,
      pageSize: 50,
    });
    setAlternativeRoutes(alternativeResult.items);
    setAlternativeForm(emptyAlternativeForm);
    setMessage(t("routes.alternativeCreated"));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-vr-700">
            3.3.1
          </p>
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

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label={t("routes.stations")} value={stations.length} />
        <MetricCard label={t("routes.routes")} value={routes.length} />
        <MetricCard label={t("routes.stops")} value={stops.length} />
        <MetricCard
          label={t("routes.routeStopOrders")}
          value={routeStopDrafts.length}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-5">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <SectionHeader
              icon={<FiSearch />}
              title={t("routes.stationManagement")}
              subtitle={t("routes.stationManagementHint")}
            />
            <div className="mt-4">
              <PlacePicker
                label={t("routes.stationName")}
                placeholder="Mien Dong, Ho Chi Minh City"
                selectedPlace={selectedStationPlace}
                onSelect={(place) => {
                  runAction(() => applyStationPlace(place));
                }}
              />
            </div>
            <div className="mt-4 flex flex-col gap-3 lg:flex-row">
              <select
                className={inputClass + " lg:flex-1"}
                value={selectedStationId}
                onChange={(event) => setSelectedStationId(event.target.value)}
              >
                <option value="">{t("routes.selectStation")}</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name} · {station.city || station.province}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => runAction(handleAttachStation)}
                disabled={!selectedStationId}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:opacity-50"
              >
                <FiCheckCircle size={16} />
                {t("routes.attachStation")}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <SectionHeader
              icon={<FiMapPin />}
              title={t("routes.stopManagement")}
              subtitle={t("routes.stopManagementHint")}
            />
            <div className="mt-4">
              <PlacePicker
                label={t("routes.stopName")}
                placeholder="Điểm đón, bến xe, địa chỉ..."
                selectedPlace={selectedStopPlace}
                onSelect={applyStopPlace}
              />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input
                label={t("routes.description")}
                value={stopForm.description}
                onChange={(value) => updateStop("description", value)}
                placeholder={t("routes.stopDescriptionPlaceholder")}
              />
            </div>
            <button
              type="button"
              onClick={() => runAction(handleCreateStop)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
            >
              <FiPlus size={16} />
              {t("routes.createStop")}
            </button>
            <button
              type="button"
              onClick={() => runAction(handleUpdateStop)}
              disabled={!selectedStopId}
              className="ml-2 mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <FiSave size={16} />
              {t("routes.updateStop")}
            </button>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <SectionHeader
              icon={<FiGitBranch />}
              title={t("routes.routeManagement")}
              subtitle={t("routes.routeManagementHint")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input
                label={t("routes.routeName")}
                value={routeForm.name}
                onChange={(value) => updateRoute("name", value)}
                placeholder="HCMC - Da Lat"
              />
              <Input
                label={t("routes.originStationId")}
                value={routeForm.originStationId}
                onChange={(value) => updateRoute("originStationId", value)}
              />
              <Input
                label={t("routes.destinationStationId")}
                value={routeForm.destinationStationId}
                onChange={(value) => updateRoute("destinationStationId", value)}
              />
              <Input
                label={t("routes.returnRouteId")}
                value={routeForm.returnRouteId ?? ""}
                onChange={(value) => updateRoute("returnRouteId", value)}
              />
              <NumberInput
                label={t("routes.baseFare")}
                value={routeForm.baseFare}
                onChange={(value) => updateRoute("baseFare", value)}
              />
              <NumberInput
                label={t("routes.totalDistance")}
                value={routeForm.totalDistanceKm}
                onChange={(value) => updateRoute("totalDistanceKm", value)}
              />
              <NumberInput
                label={t("routes.durationMinutes")}
                value={routeForm.estimatedDurationMinutes}
                onChange={(value) =>
                  updateRoute("estimatedDurationMinutes", value)
                }
              />
              <label className="flex items-end gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={routeForm.isActive}
                  onChange={(event) => updateRoute("isActive", event.target.checked)}
                />
                {t("routes.activeRoute")}
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => runAction(handleCreateRoute)}
                className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
              >
                <FiPlus size={16} />
                {t("routes.createRoute")}
              </button>
              <button
                type="button"
                onClick={() => runAction(handleUpdateRoute)}
                disabled={!selectedRouteId}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <FiSave size={16} />
                {t("routes.updateRoute")}
              </button>
              <select
                className={inputClass + " min-w-64"}
                value={selectedRouteId}
                onChange={(event) =>
                  runAction(() => handleSelectRoute(event.target.value))
                }
              >
                <option value="">{t("routes.selectRoute")}</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name} · {route.totalDistanceKm} km
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <SectionHeader
              icon={<FiShuffle />}
              title={t("routes.stopOrderManagement")}
              subtitle={t("routes.stopOrderManagementHint")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div>
                <label className={labelClass}>{t("routes.stop")}</label>
                <select
                  className={inputClass}
                  value={selectedStopId}
                  onChange={(event) =>
                    runAction(() => handleSelectStop(event.target.value))
                  }
                >
                  <option value="">{t("routes.selectStop")}</option>
                  {stops.map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label={t("routes.stopOrder")}
                value={routeStopOrder}
                onChange={setRouteStopOrder}
                type="number"
              />
              <Input
                label={t("routes.durationFromOrigin")}
                value={routeStopDuration}
                onChange={setRouteStopDuration}
                type="number"
              />
              <Input
                label={t("routes.distanceFromOrigin")}
                value={routeStopDistance}
                onChange={setRouteStopDistance}
                type="number"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={allowPickup}
                  onChange={(event) => setAllowPickup(event.target.checked)}
                />
                {t("routes.allowPickup")}
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={allowDropoff}
                  onChange={(event) => setAllowDropoff(event.target.checked)}
                />
                {t("routes.allowDropoff")}
              </label>
              <button
                type="button"
                onClick={() => runAction(handleAddRouteStop)}
                disabled={!selectedRouteId || !selectedStopId}
                className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:opacity-50"
              >
                <FiPlus size={16} />
                {t("routes.addStopToRoute")}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <SectionHeader
              icon={<FiDollarSign />}
              title={t("routes.fareTemplates")}
              subtitle={t("routes.fareTemplatesHint")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div>
                <label className={labelClass}>{t("routes.stop")}</label>
                <select
                  className={inputClass}
                  value={fareTemplateForm.stopId}
                  onChange={(event) =>
                    updateFareTemplate("stopId", event.target.value)
                  }
                >
                  <option value="">{t("routes.selectStop")}</option>
                  {stops.map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name}
                    </option>
                  ))}
                </select>
              </div>
              <NumberInput
                label={t("routes.fareFromStop")}
                value={fareTemplateForm.fareFromThisStop}
                onChange={(value) =>
                  updateFareTemplate("fareFromThisStop", value)
                }
              />
              <Input
                label={t("routes.effectiveFrom")}
                value={fareTemplateForm.effectiveFrom}
                onChange={(value) => updateFareTemplate("effectiveFrom", value)}
                type="datetime-local"
              />
              <Input
                label={t("routes.effectiveUntil")}
                value={fareTemplateForm.effectiveUntil}
                onChange={(value) => updateFareTemplate("effectiveUntil", value)}
                type="datetime-local"
              />
            </div>
            <button
              type="button"
              onClick={() => runAction(handleCreateFareTemplate)}
              disabled={!selectedRouteId}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:opacity-50"
            >
              <FiPlus size={16} />
              {t("routes.createFareTemplate")}
            </button>
            <div className="mt-4 space-y-2">
              {fareTemplates.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                >
                  <p className="font-semibold text-gray-900">
                    {stops.find((stop) => stop.id === item.stopId)?.name ??
                      item.stopId}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.fareFromThisStop.toLocaleString()} ·{" "}
                    {item.effectiveFrom || "--"} - {item.effectiveUntil || "--"}
                  </p>
                </div>
              ))}
              {!fareTemplates.length && (
                <p className="text-sm text-gray-500">
                  {t("routes.noFareTemplates")}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <SectionHeader
              icon={<FiShuffle />}
              title={t("routes.alternativeRoutes")}
              subtitle={t("routes.alternativeRoutesHint")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input
                label={t("routes.alternativeName")}
                value={alternativeForm.name}
                onChange={(value) => updateAlternative("name", value)}
              />
              <Input
                label={t("routes.destinationStationId")}
                value={alternativeForm.destinationStationId}
                onChange={(value) =>
                  updateAlternative("destinationStationId", value)
                }
              />
              <Input
                label={t("routes.description")}
                value={alternativeForm.description}
                onChange={(value) => updateAlternative("description", value)}
              />
              <NumberInput
                label={t("routes.totalDistance")}
                value={alternativeForm.totalDistanceKm}
                onChange={(value) => updateAlternative("totalDistanceKm", value)}
              />
              <NumberInput
                label={t("routes.durationMinutes")}
                value={alternativeForm.estimatedDurationMinutes}
                onChange={(value) =>
                  updateAlternative("estimatedDurationMinutes", value)
                }
              />
              <label className="flex items-end gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={alternativeForm.isActive}
                  onChange={(event) =>
                    updateAlternative("isActive", event.target.checked)
                  }
                />
                {t("routes.activeRoute")}
              </label>
            </div>
            <button
              type="button"
              onClick={() => runAction(handleCreateAlternativeRoute)}
              disabled={!selectedRouteId}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <FiPlus size={16} />
              {t("routes.createAlternative")}
            </button>
            <div className="mt-4 space-y-2">
              {alternativeRoutes.map((route) => (
                <div
                  key={route.id}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                >
                  <p className="font-semibold text-gray-900">{route.name}</p>
                  <p className="text-xs text-gray-500">
                    {route.totalDistanceKm} km ·{" "}
                    {route.estimatedDurationMinutes} min
                  </p>
                </div>
              ))}
              {!alternativeRoutes.length && (
                <p className="text-sm text-gray-500">
                  {t("routes.noAlternativeRoutes")}
                </p>
              )}
            </div>
          </section>
        </main>

        <aside className="space-y-5">
          <Panel title={t("routes.scopeRules")} icon={<FiCheckCircle />}>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>{t("routes.ruleOperatorScope")}</li>
              <li>{t("routes.ruleUniqueOrder")}</li>
              <li>{t("routes.ruleDifferentStations")}</li>
              <li>{t("routes.ruleRequiredCoordinates")}</li>
            </ul>
          </Panel>

          <Panel title={t("routes.routePreview")} icon={<FiGitBranch />}>
            <p className="text-sm font-semibold text-gray-900">
              {selectedRoute?.name ?? t("routes.noRouteSelected")}
            </p>
            <div className="mt-3 space-y-2">
              {routeStopDrafts
                .filter((item) => item.routeName === selectedRoute?.name)
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((item) => (
                  <div
                    key={`${item.stopId}-${item.orderIndex}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        #{item.orderIndex} · {item.stopName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.distanceFromOriginKm} km ·{" "}
                        {item.estimatedDurationFromOriginMinutes} min
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => runAction(() => handleRemoveRouteStop(item.stopId))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                      aria-label={t("routes.removeRouteStop")}
                      title={t("routes.removeRouteStop")}
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                ))}
              {routeStopDrafts.filter(
                (item) => item.routeName === selectedRoute?.name,
              ).length === 0 && (
                <p className="text-sm text-gray-500">
                  {t("routes.noStopsAttached")}
                </p>
              )}
            </div>
          </Panel>

          <Panel title={t("routes.latestStops")} icon={<FiMapPin />}>
            <div className="space-y-2">
              {stops.slice(0, 5).map((stop) => (
                <button
                  key={stop.id}
                  type="button"
                  onClick={() => runAction(() => handleSelectStop(stop.id))}
                  className="block w-full rounded-lg border border-gray-100 px-3 py-2 text-left text-sm hover:border-vr-200 hover:bg-vr-50"
                >
                  <span className="font-semibold text-gray-900">{stop.name}</span>
                  <span className="block text-xs text-gray-500">
                    {stop.address}
                  </span>
                </button>
              ))}
              {!stops.length && (
                <p className="text-sm text-gray-500">{t("routes.noStops")}</p>
              )}
            </div>
          </Panel>
        </aside>
      </div>

      {isLoading && (
        <p className="text-sm text-gray-500">{t("routes.loading")}</p>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
        <span className="text-vr-700">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        value={value}
        type={type}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        value={value}
        type="number"
        onChange={(event) => onChange(toNumber(event.target.value))}
      />
    </div>
  );
}
