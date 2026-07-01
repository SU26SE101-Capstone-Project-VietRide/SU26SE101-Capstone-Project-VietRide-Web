import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheckCircle,
  FiGitBranch,
  FiMapPin,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShuffle,
} from "react-icons/fi";
import {
  addRouteStop,
  createAlternativeRoute,
  createOperatorRoute,
  createOperatorStation,
  createOperatorStop,
  getOperatorRoutes,
  getOperatorStops,
  searchStations,
  type AlternativeRouteRequest,
  type OperatorRoute,
  type OperatorRouteRequest,
  type OperatorStop,
  type OperatorStopRequest,
  type RouteStopRequest,
  type Station,
} from "../../../api/vietride";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

const emptyStationSearch = {
  q: "",
  city: "",
  province: "",
};

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

type RouteStopDraft = RouteStopRequest & {
  routeName: string;
  stopName: string;
};

function toNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

export default function RoutesPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [routes, setRoutes] = useState<OperatorRoute[]>([]);
  const [stops, setStops] = useState<OperatorStop[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [routeStopDrafts, setRouteStopDrafts] = useState<RouteStopDraft[]>([]);
  const [stationSearch, setStationSearch] = useState(emptyStationSearch);
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
      setRoutes(routeResult.items);
      setStops(stopResult.items);
      setSelectedRouteId((current) => current || routeResult.items[0]?.id || "");
      setSelectedStopId((current) => current || stopResult.items[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("routes.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

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

  async function handleSearchStations() {
    if (!stationSearch.q.trim() && !stationSearch.city.trim()) {
      setError(t("routes.stationSearchRequired"));
      return;
    }

    const result = await searchStations({
      q: stationSearch.q,
      city: stationSearch.city,
      province: stationSearch.province,
    });
    setStations(result);
    setSelectedStationId(result[0]?.id ?? "");
    setMessage(
      result.length
        ? t("routes.stationSearchFound", { count: result.length })
        : t("routes.stationSearchEmpty"),
    );
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
      city: station?.city,
      province: station?.province,
      latitude: station?.latitude,
      longitude: station?.longitude,
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
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Input
                label={t("routes.stationName")}
                value={stationSearch.q}
                onChange={(value) =>
                  setStationSearch((prev) => ({ ...prev, q: value }))
                }
                placeholder="Mien Dong"
              />
              <Input
                label={t("routes.city")}
                value={stationSearch.city}
                onChange={(value) =>
                  setStationSearch((prev) => ({ ...prev, city: value }))
                }
                placeholder="Ho Chi Minh City"
              />
              <Input
                label={t("routes.province")}
                value={stationSearch.province}
                onChange={(value) =>
                  setStationSearch((prev) => ({ ...prev, province: value }))
                }
                placeholder="Ho Chi Minh"
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
                onClick={() => runAction(handleSearchStations)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <FiSearch size={16} />
                {t("routes.searchStations")}
              </button>
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
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input
                label={t("routes.stopName")}
                value={stopForm.name}
                onChange={(value) => updateStop("name", value)}
                placeholder="District 1 pickup"
              />
              <Input
                label={t("routes.placeId")}
                value={stopForm.googlePlaceId}
                onChange={(value) => updateStop("googlePlaceId", value)}
                placeholder="place-id"
              />
              <Input
                label={t("routes.address")}
                value={stopForm.address}
                onChange={(value) => updateStop("address", value)}
                placeholder="123 Nguyen Hue"
              />
              <Input
                label={t("routes.description")}
                value={stopForm.description}
                onChange={(value) => updateStop("description", value)}
                placeholder={t("routes.stopDescriptionPlaceholder")}
              />
              <NumberInput
                label={t("routes.latitude")}
                value={stopForm.latitude}
                onChange={(value) => updateStop("latitude", value)}
              />
              <NumberInput
                label={t("routes.longitude")}
                value={stopForm.longitude}
                onChange={(value) => updateStop("longitude", value)}
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
              <select
                className={inputClass + " min-w-64"}
                value={selectedRouteId}
                onChange={(event) => setSelectedRouteId(event.target.value)}
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
                  onChange={(event) => setSelectedStopId(event.target.value)}
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
                    className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                  >
                    <p className="font-semibold text-gray-900">
                      #{item.orderIndex} · {item.stopName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.distanceFromOriginKm} km ·{" "}
                      {item.estimatedDurationFromOriginMinutes} min
                    </p>
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
                  onClick={() => setSelectedStopId(stop.id)}
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
