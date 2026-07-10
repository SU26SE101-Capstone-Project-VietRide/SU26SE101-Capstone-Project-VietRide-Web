import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheckCircle,
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
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import {
  addRouteStop,
  createOperatorRoute,
  createOperatorStation,
  createOperatorStop,
  getOperatorRoute,
  getOperatorRoutes,
  getOperatorStations,
  getOperatorStop,
  getOperatorStops,
  removeRouteStop,
  searchStations,
  updateOperatorRoute,
  updateOperatorStop,
  type OperatorRoute,
  type OperatorRouteRequest,
  type OperatorStation,
  type OperatorStop,
  type OperatorStopRequest,
  type RouteStopRequest,
  type Station,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import CurrencyInput from "../../../components/CurrencyInput";
import PlacePicker, {
  type PlaceSelection,
} from "../../../components/PlacePicker";
import CustomSelect from "../../../components/CustomSelect";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";
const draftRouteId = "__draft_route__";
const defaultRouteMapCenter: LatLngExpression = [10.7769, 106.7009];
const averageRouteSpeedKmh = 45;

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

type RouteStopDraft = RouteStopRequest & {
  routeId?: string;
  routeName: string;
  stopName: string;
  latitude: number;
  longitude: number;
};

type StationOption = Station & {
  address?: string;
};

type StationRouteRole = "" | "origin" | "destination";
type FeedbackScope = "global" | "station" | "stop" | "route" | "routeStop";

function toNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function isGuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceKmBetween(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) {
  const earthRadiusKm = 6371;
  const latDistance = toRadians(second.latitude - first.latitude);
  const lonDistance = toRadians(second.longitude - first.longitude);
  const firstLat = toRadians(first.latitude);
  const secondLat = toRadians(second.latitude);
  const haversine =
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(lonDistance / 2) ** 2;

  return (
    2 *
    earthRadiusKm *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
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

function toStationOption(operatorStation: OperatorStation): StationOption {
  const station = operatorStation.station;

  return {
    id: operatorStation.stationId || station?.id || operatorStation.id || "",
    name:
      operatorStation.displayNameOverride ||
      station?.name ||
      operatorStation.name ||
      "",
    slug: station?.slug,
    address:
      station?.address ||
      station?.addressStreet ||
      operatorStation.addressStreet ||
      "",
    addressStreet:
      station?.addressStreet || operatorStation.addressStreet || "",
    city: station?.city || operatorStation.city || "",
    province: station?.province || operatorStation.province || "",
    latitude: station?.latitude ?? operatorStation.latitude ?? 0,
    longitude: station?.longitude ?? operatorStation.longitude ?? 0,
    supportsShuttle:
      station?.supportsShuttle ?? operatorStation.supportsShuttle ?? false,
    isActive: station?.isActive ?? operatorStation.isActive,
    createdAt: station?.createdAt ?? operatorStation.createdAt,
    updatedAt: station?.updatedAt ?? operatorStation.updatedAt,
  };
}

function toRouteStopRequest(draft: RouteStopDraft): RouteStopRequest {
  return {
    stopId: draft.stopId,
    orderIndex: draft.orderIndex,
    estimatedDurationFromOriginMinutes:
      draft.estimatedDurationFromOriginMinutes,
    distanceFromOriginKm: draft.distanceFromOriginKm,
    allowPickup: draft.allowPickup,
    allowDropoff: draft.allowDropoff,
  };
}

function mergeStations(current: StationOption[], incoming: StationOption[]) {
  const stationMap = new Map(current.map((station) => [station.id, station]));

  incoming.forEach((station) => {
    stationMap.set(station.id, { ...stationMap.get(station.id), ...station });
  });

  return Array.from(stationMap.values());
}

export default function RoutesPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const canManageRoutes = getAuthUser()?.role === "OPERATOR_ADMIN";
  const [routes, setRoutes] = useState<OperatorRoute[]>([]);
  const [stops, setStops] = useState<OperatorStop[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [stationPlaceDraft, setStationPlaceDraft] =
    useState<PlaceSelection | null>(null);
  const [stationRouteRole, setStationRouteRole] =
    useState<StationRouteRole>("");
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
  const [message, setMessage] = useState("");
  const [messageScope, setMessageScope] = useState<FeedbackScope>("global");
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
    ].filter(
      (
        point,
      ): point is {
        id: string;
        name: string;
        latitude: number;
        longitude: number;
        color: string;
      } => Boolean(point),
    );
  }, [
    currentRouteStops,
    routeForm.destinationStationId,
    routeForm.originStationId,
    stations,
    t,
  ]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [routeResult, stopResult, stationResult] = await Promise.all([
        getOperatorRoutes({ page: 1, pageSize: 50 }),
        getOperatorStops({ page: 1, pageSize: 50 }),
        getOperatorStations({ page: 1, pageSize: 100 }),
      ]);
      const nextRoute =
        routeResult.items.find((item) => item.id === selectedRouteId) ??
        routeResult.items[0];
      const nextStop =
        stopResult.items.find((item) => item.id === selectedStopId) ??
        stopResult.items[0];

      setRoutes(routeResult.items);
      setStops(stopResult.items);
      setStations(
        mergeStations([], stationResult.items.map(toStationOption)).filter(
          (station) => station.id && station.name,
        ),
      );
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
    setMessageScope("global");
    void action().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : t("routes.actionFailed"));
    });
  }

  function showMessage(scope: FeedbackScope, nextMessage: string) {
    setMessageScope(scope);
    setMessage(nextMessage);
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
      address:
        station.address ??
        `${station.name}, ${station.city || station.province}`,
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
      placeId:
        stopForm.googlePlaceId || `${stopForm.latitude},${stopForm.longitude}`,
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
      showMessage("station", t("routes.platformStationNotFound"));
      return;
    }

    setStations((current) => mergeStations(current, result));
    setSelectedStationId(result[0]?.id ?? "");
    showMessage("station", t("routes.stationSearchFound", { count: result.length }));
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

  function assignStationToRoute(stationId: string) {
    if (stationRouteRole === "origin") {
      updateRoute("originStationId", stationId);
      return;
    }

    if (stationRouteRole === "destination") {
      updateRoute("destinationStationId", stationId);
    }
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
    assignStationToRoute(selectedStationId);
    showMessage("station", t("routes.stationAttached"));
  }

  async function handleCreateAndAttachStation() {
    if (!stationPlaceDraft) {
      setError(t("routes.stationPlaceRequired"));
      return;
    }

    const city = stationPlaceDraft.city.trim();
    const province = stationPlaceDraft.province.trim() || city;

    if (!city || !province) {
      setError(t("routes.stationLocationRequired"));
      return;
    }

    const created = await createOperatorStation({
      displayNameOverride: stationPlaceDraft.name,
      counterLocation: "",
      contactPhone: "",
      instructions: "",
      name: stationPlaceDraft.name,
      city,
      province,
      latitude: stationPlaceDraft.latitude,
      longitude: stationPlaceDraft.longitude,
      addressStreet: stationPlaceDraft.address,
      contactEmail: "",
      operatingHours: "",
      facilities: "",
      supportsShuttle: false,
    });

    const station = created.station ?? {
      id: created.stationId,
      name: created.name ?? stationPlaceDraft.name,
      city: created.city ?? city,
      province: created.province ?? province,
      latitude: created.latitude ?? stationPlaceDraft.latitude,
      longitude: created.longitude ?? stationPlaceDraft.longitude,
      address: created.addressStreet ?? stationPlaceDraft.address,
    };

    setStations((current) => mergeStations(current, [station]));
    setSelectedStationId(station.id);
    assignStationToRoute(station.id);
    showMessage("station", t("routes.stationCreatedAndAttached"));
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
    showMessage("stop", t("routes.stopCreated"));
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
    showMessage("stop", t("routes.stopUpdated"));
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
      returnRouteId: routeForm.returnRouteId || undefined,
    });

    await Promise.all(
      pendingStops.map((item) =>
        addRouteStop(created.id, toRouteStopRequest(item)),
      ),
    );

    setRoutes((prev) => [created, ...prev]);
    setSelectedRouteId(created.id);
    setRouteForm(routeToForm(created));
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
      setRouteForm(emptyRouteForm);
      return;
    }

    const route = await getOperatorRoute(routeId);
    setRoutes((prev) =>
      prev.some((item) => item.id === route.id)
        ? prev.map((item) => (item.id === route.id ? route : item))
        : [route, ...prev],
    );
    setRouteForm(routeToForm(route));
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
      returnRouteId: routeForm.returnRouteId || undefined,
    });
    setRoutes((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
    setRouteForm(routeToForm(updated));
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
    const durationMinutes = Math.max(
      1,
      Math.round((distance / averageRouteSpeedKmh) * 60),
    );

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
      showMessage("routeStop", t("routes.routeStopRemoved"));
      return;
    }

    if (!selectedRoute) {
      setError(t("routes.selectRouteFirst"));
      return;
    }

    await removeRouteStop(selectedRoute.id, item.stopId);
    setRouteStopDrafts((prev) =>
      prev.filter(
        (draft) =>
          draft.routeId !== selectedRoute.id ||
          draft.stopId !== item.stopId ||
          draft.orderIndex !== item.orderIndex,
      ),
    );
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
            {canManageRoutes && (
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
            )}
            <div className="mt-4 flex flex-col gap-3 lg:flex-row">
              <CustomSelect
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
              </CustomSelect>
              {canManageRoutes && (
                <>
                  <CustomSelect
                    className={inputClass + " lg:w-56"}
                    value={stationRouteRole}
                    onChange={(event) =>
                      setStationRouteRole(
                        event.target.value as StationRouteRole,
                      )
                    }
                  >
                    <option value="">{t("routes.stationRouteRoleNone")}</option>
                    <option value="origin">{t("routes.useAsOrigin")}</option>
                    <option value="destination">
                      {t("routes.useAsDestination")}
                    </option>
                  </CustomSelect>
                  <button
                    type="button"
                    onClick={() => runAction(handleAttachStation)}
                    disabled={!selectedStationId}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:opacity-50"
                  >
                    <FiCheckCircle size={16} />
                    {t("routes.attachStation")}
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction(handleCreateAndAttachStation)}
                    disabled={!stationPlaceDraft || Boolean(selectedStationId)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-vr-200 px-4 py-2 text-sm font-semibold text-vr-700 hover:bg-vr-50 disabled:opacity-50"
                  >
                    <FiMapPin size={16} />
                    {t("routes.createAndAttachStation")}
                  </button>
                </>
              )}
            </div>
            {canManageRoutes && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateRoute("originStationId", selectedStationId)
                  }
                  disabled={!selectedStationId}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {t("routes.useAsOrigin")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateRoute("destinationStationId", selectedStationId)
                  }
                  disabled={!selectedStationId}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {t("routes.useAsDestination")}
                </button>
              </div>
            )}
            <InlineFeedback
              message={messageScope === "station" ? message : ""}
            />
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <SectionHeader
              icon={<FiMapPin />}
              title={t("routes.stopManagement")}
              subtitle={t("routes.stopManagementHint")}
            />
            {canManageRoutes && (
              <div className="mt-4">
                <PlacePicker
                  label={t("routes.stopName")}
                  placeholder="Điểm đón, bến xe, địa chỉ..."
                  selectedPlace={selectedStopPlace}
                  onSelect={applyStopPlace}
                />
              </div>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input
                label={t("routes.description")}
                value={stopForm.description}
                onChange={(value) => updateStop("description", value)}
                placeholder={t("routes.stopDescriptionPlaceholder")}
                disabled={!canManageRoutes}
              />
            </div>
            {canManageRoutes && (
              <>
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
              </>
            )}
            <InlineFeedback message={messageScope === "stop" ? message : ""} />
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
                disabled={!canManageRoutes}
              />
              <StationSelect
                label={t("routes.originStationId")}
                stations={stations}
                value={routeForm.originStationId}
                placeholder={t("routes.selectOriginStation")}
                onChange={(value) => updateRoute("originStationId", value)}
                disabled={!canManageRoutes}
              />
              <StationSelect
                label={t("routes.destinationStationId")}
                stations={stations}
                value={routeForm.destinationStationId}
                placeholder={t("routes.selectDestinationStation")}
                onChange={(value) => updateRoute("destinationStationId", value)}
                disabled={!canManageRoutes}
              />
              <Input
                label={t("routes.returnRouteId")}
                value={routeForm.returnRouteId ?? ""}
                onChange={(value) => updateRoute("returnRouteId", value)}
                disabled={!canManageRoutes}
              />
              <NumberInput
                label={t("routes.baseFare")}
                value={routeForm.baseFare}
                onChange={(value) => updateRoute("baseFare", value)}
                disabled={!canManageRoutes}
                currency
              />
              <NumberInput
                label={t("routes.totalDistance")}
                value={routeForm.totalDistanceKm}
                onChange={(value) => updateRoute("totalDistanceKm", value)}
                disabled={!canManageRoutes}
              />
              <NumberInput
                label={t("routes.durationMinutes")}
                value={routeForm.estimatedDurationMinutes}
                onChange={(value) =>
                  updateRoute("estimatedDurationMinutes", value)
                }
                disabled={!canManageRoutes}
              />
              <label className="flex items-end gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={routeForm.isActive}
                  disabled={!canManageRoutes}
                  onChange={(event) =>
                    updateRoute("isActive", event.target.checked)
                  }
                />
                {t("routes.activeRoute")}
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {canManageRoutes && (
                <>
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
                </>
              )}
              <CustomSelect
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
              </CustomSelect>
            </div>
            <InlineFeedback message={messageScope === "route" ? message : ""} />
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
                <CustomSelect
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
                </CustomSelect>
              </div>
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
            <InlineFeedback
              message={messageScope === "routeStop" ? message : ""}
            />
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
              {activeRouteName}
            </p>
            <RouteDesignMap
              points={routeMapPoints}
              emptyText={t("routes.mapNoPoints")}
            />
            <div className="mt-3 space-y-2">
              {currentRouteStops.map((item) => (
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
                  {canManageRoutes && (
                    <button
                      type="button"
                      onClick={() =>
                        runAction(() => handleRemoveRouteStop(item))
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                      aria-label={t("routes.removeRouteStop")}
                      title={t("routes.removeRouteStop")}
                    >
                      <FiTrash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              {currentRouteStops.length === 0 && (
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
                  <span className="font-semibold text-gray-900">
                    {stop.name}
                  </span>
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

function RouteDesignMap({
  points,
  emptyText,
}: {
  points: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    color: string;
  }>;
  emptyText: string;
}) {
  const center: LatLngExpression =
    points.length > 0
      ? [
          points.reduce((total, point) => total + point.latitude, 0) /
            points.length,
          points.reduce((total, point) => total + point.longitude, 0) /
            points.length,
        ]
      : defaultRouteMapCenter;
  const linePositions: LatLngExpression[] = points.map((point) => [
    point.latitude,
    point.longitude,
  ]);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
      <div className="h-64">
        <MapContainer
          key={`${points.map((point) => point.id).join("-") || "empty-route-map"}`}
          center={center}
          zoom={points.length > 1 ? 10 : 13}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {linePositions.length > 1 && (
            <Polyline
              positions={linePositions}
              pathOptions={{ color: "#0f766e" }}
            />
          )}
          {points.map((point) => (
            <CircleMarker
              key={point.id}
              center={[point.latitude, point.longitude]}
              radius={8}
              pathOptions={{
                color: point.color,
                fillColor: point.color,
                fillOpacity: 0.85,
              }}
            >
              <Tooltip>{point.name}</Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      {points.length === 0 && (
        <p className="border-t border-gray-100 bg-white px-3 py-2 text-xs text-gray-500">
          {emptyText}
        </p>
      )}
    </div>
  );
}

function InlineFeedback({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {message}
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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        value={value}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function StationSelect({
  label,
  stations,
  value,
  placeholder,
  onChange,
  disabled = false,
}: {
  label: string;
  stations: StationOption[];
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const hasSelectedValue =
    value && !stations.some((station) => station.id === value);

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <CustomSelect
        className={inputClass}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {hasSelectedValue && <option value={value}>{value}</option>}
        {stations.map((station) => (
          <option key={station.id} value={station.id}>
            {station.name} · {station.city || station.province}
          </option>
        ))}
      </CustomSelect>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  disabled = false,
  currency = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  currency?: boolean;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {currency ? (
        <CurrencyInput
          className={inputClass}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(toNumber(event.target.value))}
        />
      ) : (
        <input
          className={inputClass}
          value={value}
          type="number"
          disabled={disabled}
          onChange={(event) => onChange(toNumber(event.target.value))}
        />
      )}
    </div>
  );
}
