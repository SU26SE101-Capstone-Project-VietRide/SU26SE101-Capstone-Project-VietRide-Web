import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiRefreshCw, FiSearch, FiTrash2 } from "react-icons/fi";
import {
  MapContainer,
  CircleMarker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  addRouteStop,
  createAlternativeRoute,
  createOperatorRoute,
  createOperatorStation,
  createOperatorStop,
  createRouteFareTemplate,
  deleteAlternativeRoute,
  getAlternativeRoutes,
  getOperatorRoutes,
  getOperatorStops,
  getRouteFareTemplates,
  removeRouteStop,
  searchStations,
  updateAlternativeRoute,
  updateOperatorRoute,
  updateOperatorStop,
  type AlternativeRoute,
  type AlternativeRouteRequest,
  type FareTemplate,
  type OperatorRoute,
  type OperatorRouteRequest,
  type OperatorStop,
  type OperatorStopRequest,
  type Station,
} from "../../../api/vietride";

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

const SETUP_STEPS = [
  {
    id: "stations",
    title: "1. Bến hoạt động",
    description: "Tìm bến có sẵn hoặc gắn bến vào nhà xe.",
  },
  {
    id: "pickupStops",
    title: "2. Điểm đón",
    description: "Tạo các điểm chỉ cho phép đón khách.",
  },
  {
    id: "dropoffStops",
    title: "3. Điểm trả",
    description: "Tạo các điểm chỉ cho phép trả khách.",
  },
  {
    id: "routes",
    title: "4. Tuyến đường",
    description: "Tạo tuyến chính từ bến đi đến bến đến.",
  },
  {
    id: "routeStops",
    title: "5. Gắn điểm vào tuyến",
    description: "Thêm điểm đón/trả vào tuyến theo đúng thứ tự.",
  },
  {
    id: "fares",
    title: "6. Giá vé",
    description: "Cấu hình giá cơ bản và giá theo điểm đón.",
  },
] as const;

type SetupStepId = (typeof SETUP_STEPS)[number]["id"];

type LocationSelection = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  googlePlaceId: string;
  city?: string;
  province?: string;
};

type NominatimPlace = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
  };
};

function toNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function placeToSelection(place: NominatimPlace): LocationSelection {
  const address = place.address ?? {};
  return {
    name: place.name || place.display_name.split(",")[0] || "Selected place",
    address: place.display_name,
    latitude: toNumber(place.lat),
    longitude: toNumber(place.lon),
    googlePlaceId: `osm:${place.place_id}`,
    city: address.city || address.town || address.village || address.county,
    province: address.state,
  };
}

function createStopForm(mode: "pickup" | "dropoff"): OperatorStopRequest {
  return {
    ...emptyStopForm,
    description:
      mode === "pickup"
        ? "Pickup point - allowPickup only"
        : "Dropoff point - allowDropoff only",
  };
}

export default function RoutesPage() {
  const { t } = useTranslation("manager");
  const [activeStep, setActiveStep] = useState<SetupStepId>("stations");
  const [routes, setRoutes] = useState<OperatorRoute[]>([]);
  const [stops, setStops] = useState<OperatorStop[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [fareTemplates, setFareTemplates] = useState<FareTemplate[]>([]);
  const [alternatives, setAlternatives] = useState<AlternativeRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedStopId, setSelectedStopId] = useState("");
  const [selectedAlternativeId, setSelectedAlternativeId] = useState("");
  const [stationSearch, setStationSearch] = useState("");
  const [stationCity, setStationCity] = useState("");
  const [stationProvince, setStationProvince] = useState("");
  const [operatorStationId, setOperatorStationId] = useState("");
  const [pickupStopForm, setPickupStopForm] = useState<OperatorStopRequest>(
    createStopForm("pickup"),
  );
  const [dropoffStopForm, setDropoffStopForm] = useState<OperatorStopRequest>(
    createStopForm("dropoff"),
  );
  const [pickupStopId, setPickupStopId] = useState("");
  const [dropoffStopId, setDropoffStopId] = useState("");
  const [routeForm, setRouteForm] =
    useState<OperatorRouteRequest>(emptyRouteForm);
  const [fareStopId, setFareStopId] = useState("");
  const [fareAmount, setFareAmount] = useState("0");
  const [fareFrom, setFareFrom] = useState("");
  const [fareUntil, setFareUntil] = useState("");
  const [routeStopOrder, setRouteStopOrder] = useState("0");
  const [routeStopDuration, setRouteStopDuration] = useState("0");
  const [routeStopDistance, setRouteStopDistance] = useState("0");
  const [alternativeForm, setAlternativeForm] =
    useState<AlternativeRouteRequest>(emptyAlternativeForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId) ?? null,
    [routes, selectedRouteId],
  );

  const activeStepIndex = SETUP_STEPS.findIndex((step) => step.id === activeStep);
  const activeStepInfo = SETUP_STEPS[activeStepIndex] ?? SETUP_STEPS[0];

  async function loadRoutesAndStops() {
    setIsLoading(true);
    setError("");

    try {
      const [routeResult, stopResult] = await Promise.all([
        getOperatorRoutes({ page: 1, pageSize: 50 }),
        getOperatorStops({ page: 1, pageSize: 50 }),
      ]);
      setRoutes(routeResult.items);
      setStops(stopResult.items);

      const nextRouteId = selectedRouteId || routeResult.items[0]?.id || "";
      setSelectedRouteId(nextRouteId);
      setSelectedStopId(stopResult.items[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load routes");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadRouteChildren(routeId: string) {
    if (!routeId) {
      setFareTemplates([]);
      setAlternatives([]);
      return;
    }

    const [fareResult, alternativeResult] = await Promise.all([
      getRouteFareTemplates(routeId, { page: 1, pageSize: 50 }),
      getAlternativeRoutes(routeId, { page: 1, pageSize: 50 }),
    ]);

    setFareTemplates(fareResult.items);
    setAlternatives(alternativeResult.items);
    setSelectedAlternativeId(alternativeResult.items[0]?.id || "");
  }

  useEffect(() => {
    let ignore = false;

    async function loadInitialData() {
      try {
        const [routeResult, stopResult] = await Promise.all([
          getOperatorRoutes({ page: 1, pageSize: 50 }),
          getOperatorStops({ page: 1, pageSize: 50 }),
        ]);

        if (ignore) {
          return;
        }

        setRoutes(routeResult.items);
        setStops(stopResult.items);
        setSelectedRouteId(routeResult.items[0]?.id || "");
        setSelectedStopId(stopResult.items[0]?.id || "");
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load routes");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadChildren() {
      if (!selectedRouteId) {
        setFareTemplates([]);
        setAlternatives([]);
        return;
      }

      try {
        const [fareResult, alternativeResult] = await Promise.all([
          getRouteFareTemplates(selectedRouteId, { page: 1, pageSize: 50 }),
          getAlternativeRoutes(selectedRouteId, { page: 1, pageSize: 50 }),
        ]);

        if (ignore) {
          return;
        }

        setFareTemplates(fareResult.items);
        setAlternatives(alternativeResult.items);
        setSelectedAlternativeId(alternativeResult.items[0]?.id || "");
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : "Failed to load route data",
          );
        }
      }
    }

    void loadChildren();

    return () => {
      ignore = true;
    };
  }, [selectedRouteId]);

  function updatePickupStop<K extends keyof OperatorStopRequest>(
    key: K,
    value: OperatorStopRequest[K],
  ) {
    setPickupStopForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateDropoffStop<K extends keyof OperatorStopRequest>(
    key: K,
    value: OperatorStopRequest[K],
  ) {
    setDropoffStopForm((prev) => ({ ...prev, [key]: value }));
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
    await runStationSearch({
      q: stationSearch,
      city: stationCity,
      province: stationProvince,
    });
  }

  async function runStationSearch(params: {
    q?: string;
    city?: string;
    province?: string;
  }) {
    setError("");
    const result = await searchStations(params);
    setStations(result);
    setOperatorStationId(result[0]?.id || "");

    if (result.length === 0) {
      setMessage(
        "No station found. Attach requires an existing stationId from /v1/stations/search.",
      );
    } else {
      setMessage(`Found ${result.length} station(s). Select one and click Attach.`);
    }
  }

  async function handleCreateOperatorStation() {
    if (!operatorStationId.trim()) {
      setError("Attach station requires a stationId. Search and select a station first.");
      return;
    }

    await createOperatorStation({
      stationId: operatorStationId.trim(),
      displayNameOverride:
        stations.find((station) => station.id === operatorStationId)?.name || "",
    });
    setMessage("Operator station created.");
  }

  async function handleCreatePickupStop() {
    const created = await createOperatorStop(pickupStopForm);
    setMessage("Pickup stop created.");
    setSelectedStopId(created.id);
    setPickupStopId(created.id);
    setPickupStopForm(createStopForm("pickup"));
    await loadRoutesAndStops();
  }

  async function handleCreateDropoffStop() {
    const created = await createOperatorStop(dropoffStopForm);
    setMessage("Dropoff stop created.");
    setSelectedStopId(created.id);
    setDropoffStopId(created.id);
    setDropoffStopForm(createStopForm("dropoff"));
    await loadRoutesAndStops();
  }

  async function handleUpdatePickupStop() {
    await updateOperatorStop(pickupStopId || selectedStopId, pickupStopForm);
    setMessage("Pickup stop updated.");
    await loadRoutesAndStops();
  }

  async function handleUpdateDropoffStop() {
    await updateOperatorStop(dropoffStopId || selectedStopId, dropoffStopForm);
    setMessage("Dropoff stop updated.");
    await loadRoutesAndStops();
  }

  async function handleCreateRoute() {
    const created = await createOperatorRoute({
      ...routeForm,
      returnRouteId: routeForm.returnRouteId || undefined,
    });
    setMessage("Route created.");
    setSelectedRouteId(created.id);
    setRouteForm(emptyRouteForm);
    await loadRoutesAndStops();
  }

  async function handleUpdateRoute() {
    await updateOperatorRoute(selectedRouteId, {
      ...routeForm,
      returnRouteId: routeForm.returnRouteId || undefined,
    });
    setMessage("Route updated.");
    await loadRoutesAndStops();
  }

  async function handleAddPickupRouteStop() {
    await addRouteStop(selectedRouteId, {
      stopId: pickupStopId || selectedStopId,
      orderIndex: toNumber(routeStopOrder),
      estimatedDurationFromOriginMinutes: toNumber(routeStopDuration),
      distanceFromOriginKm: toNumber(routeStopDistance),
      allowPickup: true,
      allowDropoff: false,
    });
    setMessage("Pickup point added to route.");
  }

  async function handleAddDropoffRouteStop() {
    await addRouteStop(selectedRouteId, {
      stopId: dropoffStopId || selectedStopId,
      orderIndex: toNumber(routeStopOrder),
      estimatedDurationFromOriginMinutes: toNumber(routeStopDuration),
      distanceFromOriginKm: toNumber(routeStopDistance),
      allowPickup: false,
      allowDropoff: true,
    });
    setMessage("Dropoff point added to route.");
  }

  async function handleRemoveRouteStop() {
    await removeRouteStop(selectedRouteId, selectedStopId);
    setMessage("Stop removed from route.");
  }

  async function handleCreateFareTemplate() {
    await createRouteFareTemplate(selectedRouteId, {
      stopId: fareStopId,
      fareFromThisStop: toNumber(fareAmount),
      effectiveFrom: fareFrom,
      effectiveUntil: fareUntil,
    });
    setMessage("Fare template created.");
    await loadRouteChildren(selectedRouteId);
  }

  async function handleCreateAlternative() {
    const created = await createAlternativeRoute(selectedRouteId, {
      ...alternativeForm,
      stops: selectedStopId
        ? [
            {
              stopId: selectedStopId,
              orderIndex: toNumber(routeStopOrder),
              estimatedDurationFromOriginMinutes: toNumber(routeStopDuration),
              distanceFromOriginKm: toNumber(routeStopDistance),
            },
          ]
        : [],
    });
    setMessage("Alternative route created.");
    setSelectedAlternativeId(created.id);
    setAlternativeForm(emptyAlternativeForm);
    await loadRouteChildren(selectedRouteId);
  }

  async function handleUpdateAlternative() {
    await updateAlternativeRoute(selectedAlternativeId, {
      ...alternativeForm,
      stops: selectedStopId
        ? [
            {
              stopId: selectedStopId,
              orderIndex: toNumber(routeStopOrder),
              estimatedDurationFromOriginMinutes: toNumber(routeStopDuration),
              distanceFromOriginKm: toNumber(routeStopDistance),
            },
          ]
        : [],
    });
    setMessage("Alternative route updated.");
    await loadRouteChildren(selectedRouteId);
  }

  async function handleDeleteAlternative() {
    await deleteAlternativeRoute(selectedAlternativeId);
    setMessage("Alternative route deleted.");
    await loadRouteChildren(selectedRouteId);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("routes.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Routes, stops, stations, fares and alternative routes now call the API.
          </p>
        </div>
        <button
          type="button"
          onClick={loadRoutesAndStops}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <FiRefreshCw size={16} />
          Refresh
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

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Operator setup flow
          </p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">
            Làm theo từng bước
          </h2>
          <div className="mt-4 space-y-2">
            {SETUP_STEPS.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                  activeStep === step.id
                    ? "border-vr-400 bg-vr-50 text-vr-900"
                    : "border-gray-100 bg-white text-gray-700 hover:border-vr-200 hover:bg-vr-50/60"
                }`}
              >
                <span className="text-sm font-semibold">{step.title}</span>
                <span className="mt-1 block text-xs text-gray-500">
                  {step.description}
                </span>
                {index < activeStepIndex && (
                  <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Đã qua
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-vr-700">
              Bước {activeStepIndex + 1} / {SETUP_STEPS.length}
            </p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">
              {activeStepInfo.title}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {activeStepInfo.description}
            </p>
          </div>

      {activeStep === "stations" && (
      <section className="space-y-4">
      <LocationPicker
        title="Tìm bến trên bản đồ"
        onSelect={(location) => {
          setStationSearch(location.name);
          setStationCity(location.city || "");
          setStationProvince(location.province || "");
          void runStationSearch({
            q: location.name,
            city: location.city || "",
            province: location.province || "",
          });
        }}
      />
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Stations</h2>
          <FiSearch className="text-gray-400" />
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Input label="Query" value={stationSearch} onChange={setStationSearch} />
          <Input label="City" value={stationCity} onChange={setStationCity} />
          <Input
            label="Province"
            value={stationProvince}
            onChange={setStationProvince}
          />
          <Input
            label="Station ID"
            value={operatorStationId}
            onChange={setOperatorStationId}
          />
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={handleSearchStations}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleCreateOperatorStation}
              disabled={!operatorStationId}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Attach
            </button>
          </div>
        </div>
        <select
          className={inputClass + " mt-3"}
          value={operatorStationId}
          onChange={(event) => setOperatorStationId(event.target.value)}
        >
          <option value="">Select station</option>
          {stations.map((station) => (
            <option key={station.id} value={station.id}>
              {station.name} - {station.city}, {station.province}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-gray-500">
          Lưu ý: Attach cần stationId thật từ backend. Map chỉ giúp tìm địa chỉ;
          sau đó phải chọn station trong kết quả search hoặc nhập UUID station.
        </p>
      </div>
      </section>
      )}

      {activeStep === "pickupStops" && (
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Điểm đón</h2>
          <p className="mt-1 text-sm text-gray-500">
            Điểm này sẽ được gắn vào tuyến với allowPickup=true và allowDropoff=false.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input label="Name" value={pickupStopForm.name} onChange={(v) => updatePickupStop("name", v)} />
            <Input label="Place ID" value={pickupStopForm.googlePlaceId} onChange={(v) => updatePickupStop("googlePlaceId", v)} />
            <NumberInput label="Latitude" value={pickupStopForm.latitude} onChange={(v) => updatePickupStop("latitude", v)} />
            <NumberInput label="Longitude" value={pickupStopForm.longitude} onChange={(v) => updatePickupStop("longitude", v)} />
            <Input label="Address" value={pickupStopForm.address} onChange={(v) => updatePickupStop("address", v)} />
            <Input label="Description" value={pickupStopForm.description} onChange={(v) => updatePickupStop("description", v)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={handleCreatePickupStop} className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600">
              Create pickup point
            </button>
            <button type="button" onClick={handleUpdatePickupStop} disabled={!pickupStopId && !selectedStopId} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Update pickup point
            </button>
          </div>
          <select className={inputClass + " mt-4"} value={pickupStopId} onChange={(event) => {
            setPickupStopId(event.target.value);
            setSelectedStopId(event.target.value);
          }}>
            <option value="">Select pickup point</option>
            {stops.map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.name}
              </option>
            ))}
          </select>
        </div>
        <LocationPicker
          title="Chọn điểm đón trên map"
          onSelect={(location) => {
            setPickupStopForm((prev) => ({
              ...prev,
              name: location.name,
              address: location.address,
              latitude: location.latitude,
              longitude: location.longitude,
              googlePlaceId: location.googlePlaceId,
            }));
          }}
        />
      </section>
      )}

      {activeStep === "dropoffStops" && (
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Điểm trả</h2>
          <p className="mt-1 text-sm text-gray-500">
            Điểm này sẽ được gắn vào tuyến với allowPickup=false và allowDropoff=true.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input label="Name" value={dropoffStopForm.name} onChange={(v) => updateDropoffStop("name", v)} />
            <Input label="Place ID" value={dropoffStopForm.googlePlaceId} onChange={(v) => updateDropoffStop("googlePlaceId", v)} />
            <NumberInput label="Latitude" value={dropoffStopForm.latitude} onChange={(v) => updateDropoffStop("latitude", v)} />
            <NumberInput label="Longitude" value={dropoffStopForm.longitude} onChange={(v) => updateDropoffStop("longitude", v)} />
            <Input label="Address" value={dropoffStopForm.address} onChange={(v) => updateDropoffStop("address", v)} />
            <Input label="Description" value={dropoffStopForm.description} onChange={(v) => updateDropoffStop("description", v)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={handleCreateDropoffStop} className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600">
              Create dropoff point
            </button>
            <button type="button" onClick={handleUpdateDropoffStop} disabled={!dropoffStopId && !selectedStopId} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Update dropoff point
            </button>
          </div>
          <select className={inputClass + " mt-4"} value={dropoffStopId} onChange={(event) => {
            setDropoffStopId(event.target.value);
            setSelectedStopId(event.target.value);
          }}>
            <option value="">Select dropoff point</option>
            {stops.map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.name}
              </option>
            ))}
          </select>
        </div>
        <LocationPicker
          title="Chọn điểm trả trên map"
          onSelect={(location) => {
            setDropoffStopForm((prev) => ({
              ...prev,
              name: location.name,
              address: location.address,
              latitude: location.latitude,
              longitude: location.longitude,
              googlePlaceId: location.googlePlaceId,
            }));
          }}
        />
      </section>
      )}

      {activeStep === "routes" && (
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Routes</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input label="Name" value={routeForm.name} onChange={(v) => updateRoute("name", v)} />
            <Input label="Origin Station ID" value={routeForm.originStationId} onChange={(v) => updateRoute("originStationId", v)} />
            <Input label="Destination Station ID" value={routeForm.destinationStationId} onChange={(v) => updateRoute("destinationStationId", v)} />
            <Input label="Return Route ID" value={routeForm.returnRouteId ?? ""} onChange={(v) => updateRoute("returnRouteId", v)} />
            <NumberInput label="Base fare" value={routeForm.baseFare} onChange={(v) => updateRoute("baseFare", v)} />
            <NumberInput label="Distance km" value={routeForm.totalDistanceKm} onChange={(v) => updateRoute("totalDistanceKm", v)} />
            <NumberInput label="Duration minutes" value={routeForm.estimatedDurationMinutes} onChange={(v) => updateRoute("estimatedDurationMinutes", v)} />
            <label className="flex items-end gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={routeForm.isActive} onChange={(event) => updateRoute("isActive", event.target.checked)} />
              Active
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={handleCreateRoute} className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600">
              Create route
            </button>
            <button type="button" onClick={handleUpdateRoute} disabled={!selectedRouteId} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Update selected route
            </button>
          </div>
          <select className={inputClass + " mt-4"} value={selectedRouteId} onChange={(event) => setSelectedRouteId(event.target.value)}>
            <option value="">Select route</option>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.name} - {route.totalDistanceKm} km
              </option>
            ))}
          </select>
          {isLoading && <p className="mt-3 text-sm text-gray-500">Loading routes...</p>}
        </div>
      </section>
      )}

      {activeStep === "routeStops" && (
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Gắn điểm vào tuyến</h2>
        <p className="mt-1 text-sm text-gray-500">
          {selectedRoute
            ? `${selectedRoute.name} - chọn điểm đón hoặc điểm trả đã tạo`
            : "Select a route first"}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input label="Order" value={routeStopOrder} onChange={setRouteStopOrder} />
          <Input label="Duration from origin" value={routeStopDuration} onChange={setRouteStopDuration} />
          <Input label="Distance from origin" value={routeStopDistance} onChange={setRouteStopDistance} />
          <div>
            <label className={labelClass}>Pickup point</label>
            <select
              className={inputClass}
              value={pickupStopId}
              onChange={(event) => setPickupStopId(event.target.value)}
            >
              <option value="">Select pickup point</option>
              {stops.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  {stop.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Dropoff point</label>
            <select
              className={inputClass}
              value={dropoffStopId}
              onChange={(event) => setDropoffStopId(event.target.value)}
            >
              <option value="">Select dropoff point</option>
              {stops.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  {stop.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={handleAddPickupRouteStop} disabled={!selectedRouteId || !pickupStopId} className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:opacity-50">
            Add pickup to route
          </button>
          <button type="button" onClick={handleAddDropoffRouteStop} disabled={!selectedRouteId || !dropoffStopId} className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:opacity-50">
            Add dropoff to route
          </button>
          <button type="button" onClick={handleRemoveRouteStop} disabled={!selectedRouteId || !selectedStopId} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
            <FiTrash2 size={16} />
            Remove selected stop
          </button>
        </div>
      </section>
      )}

      {activeStep === "fares" && (
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Fare Templates</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input label="Stop ID" value={fareStopId} onChange={setFareStopId} />
            <Input label="Fare from this stop" value={fareAmount} onChange={setFareAmount} />
            <Input label="Effective from" value={fareFrom} onChange={setFareFrom} type="datetime-local" />
            <Input label="Effective until" value={fareUntil} onChange={setFareUntil} type="datetime-local" />
          </div>
          <button type="button" onClick={handleCreateFareTemplate} disabled={!selectedRouteId || !fareStopId} className="mt-4 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:opacity-50">
            Create fare template
          </button>
          <ul className="mt-4 space-y-2 text-sm text-gray-600">
            {fareTemplates.map((fare) => (
              <li key={fare.id} className="rounded-lg bg-gray-50 px-3 py-2">
                {fare.stopId}: {fare.fareFromThisStop.toLocaleString("vi-VN")} VND
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Alternative Routes</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input label="Name" value={alternativeForm.name} onChange={(v) => updateAlternative("name", v)} />
            <Input label="Destination station ID" value={alternativeForm.destinationStationId} onChange={(v) => updateAlternative("destinationStationId", v)} />
            <Input label="Description" value={alternativeForm.description} onChange={(v) => updateAlternative("description", v)} />
            <NumberInput label="Distance km" value={alternativeForm.totalDistanceKm} onChange={(v) => updateAlternative("totalDistanceKm", v)} />
            <NumberInput label="Duration minutes" value={alternativeForm.estimatedDurationMinutes} onChange={(v) => updateAlternative("estimatedDurationMinutes", v)} />
            <label className="flex items-end gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={alternativeForm.isActive} onChange={(event) => updateAlternative("isActive", event.target.checked)} />
              Active
            </label>
          </div>
          <select className={inputClass + " mt-4"} value={selectedAlternativeId} onChange={(event) => setSelectedAlternativeId(event.target.value)}>
            <option value="">Select alternative route</option>
            {alternatives.map((alternative) => (
              <option key={alternative.id} value={alternative.id}>
                {alternative.name}
              </option>
            ))}
          </select>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={handleCreateAlternative} disabled={!selectedRouteId} className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:opacity-50">
              <FiPlus size={16} />
              Create
            </button>
            <button type="button" onClick={handleUpdateAlternative} disabled={!selectedAlternativeId} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Update
            </button>
            <button type="button" onClick={handleDeleteAlternative} disabled={!selectedAlternativeId} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              Delete
            </button>
          </div>
        </div>
      </section>
      )}

        </main>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        value={value}
        type={type}
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

function LocationPicker({
  title,
  onSelect,
}: {
  title: string;
  onSelect: (selection: LocationSelection) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimPlace[]>([]);
  const [center, setCenter] = useState<LatLngExpression>([10.7769, 106.7009]);
  const [position, setPosition] = useState<LatLngExpression | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [mapError, setMapError] = useState("");

  async function searchAddress() {
    if (!query.trim()) {
      return;
    }

    setIsSearching(true);
    setMapError("");

    try {
      const params = new URLSearchParams({
        format: "json",
        addressdetails: "1",
        limit: "5",
        q: query.trim(),
      });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      );
      const payload = (await response.json()) as NominatimPlace[];
      setResults(payload);

      if (payload[0]) {
        selectPlace(payload[0]);
      }
    } catch (err) {
      setMapError(err instanceof Error ? err.message : "Map search failed");
    } finally {
      setIsSearching(false);
    }
  }

  async function reverseSelect(latitude: number, longitude: number) {
    setMapError("");

    try {
      const params = new URLSearchParams({
        format: "json",
        addressdetails: "1",
        lat: String(latitude),
        lon: String(longitude),
      });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      );
      const place = (await response.json()) as NominatimPlace;
      selectPlace(place);
    } catch (err) {
      setMapError(err instanceof Error ? err.message : "Reverse geocode failed");
      const fallback: LocationSelection = {
        name: "Selected map point",
        address: `${latitude}, ${longitude}`,
        latitude,
        longitude,
        googlePlaceId: `coords:${latitude},${longitude}`,
      };
      onSelect(fallback);
    }
  }

  function selectPlace(place: NominatimPlace) {
    const selection = placeToSelection(place);
    const nextCenter: LatLngExpression = [
      selection.latitude,
      selection.longitude,
    ];
    setCenter(nextCenter);
    setPosition(nextCenter);
    onSelect(selection);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          className={inputClass}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nhập địa chỉ, tên bến, điểm đón..."
        />
        <button
          type="button"
          onClick={searchAddress}
          disabled={isSearching}
          className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:opacity-50"
        >
          {isSearching ? "Đang tìm..." : "Tìm trên map"}
        </button>
      </div>

      {mapError && <p className="mt-2 text-sm text-red-600">{mapError}</p>}

      {results.length > 0 && (
        <div className="mt-3 max-h-36 overflow-auto rounded-lg border border-gray-100">
          {results.map((place) => (
            <button
              key={place.place_id}
              type="button"
              onClick={() => selectPlace(place)}
              className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm text-gray-700 last:border-0 hover:bg-vr-50"
            >
              {place.display_name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 h-[300px] overflow-hidden rounded-xl border border-gray-200">
        <MapContainer
          center={center}
          zoom={13}
          className="z-0 h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapFocus center={center} />
          <MapClickSelect onSelect={reverseSelect} />
          {position && (
            <CircleMarker
              center={position}
              radius={9}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: "#16a34a",
                fillOpacity: 0.95,
              }}
            />
          )}
        </MapContainer>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Có thể tìm địa chỉ hoặc click trực tiếp trên map để tự lấy tọa độ.
      </p>
    </div>
  );
}

function MapFocus({ center }: { center: LatLngExpression }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, 14, { duration: 0.35 });
  }, [center, map]);

  return null;
}

function MapClickSelect({
  onSelect,
}: {
  onSelect: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}
