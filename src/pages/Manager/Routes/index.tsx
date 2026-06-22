import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiRefreshCw, FiSearch, FiTrash2 } from "react-icons/fi";
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

function toNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

export default function RoutesPage() {
  const { t } = useTranslation("manager");
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
  const [stopForm, setStopForm] = useState<OperatorStopRequest>(emptyStopForm);
  const [routeForm, setRouteForm] =
    useState<OperatorRouteRequest>(emptyRouteForm);
  const [fareStopId, setFareStopId] = useState("");
  const [fareAmount, setFareAmount] = useState("0");
  const [fareFrom, setFareFrom] = useState("");
  const [fareUntil, setFareUntil] = useState("");
  const [routeStopOrder, setRouteStopOrder] = useState("0");
  const [routeStopDuration, setRouteStopDuration] = useState("0");
  const [routeStopDistance, setRouteStopDistance] = useState("0");
  const [allowPickup, setAllowPickup] = useState(true);
  const [allowDropoff, setAllowDropoff] = useState(true);
  const [alternativeForm, setAlternativeForm] =
    useState<AlternativeRouteRequest>(emptyAlternativeForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId) ?? null,
    [routes, selectedRouteId],
  );

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
    const result = await searchStations({
      q: stationSearch,
      city: stationCity,
      province: stationProvince,
    });
    setStations(result);
    setOperatorStationId(result[0]?.id || "");
  }

  async function handleCreateOperatorStation() {
    await createOperatorStation({
      stationId: operatorStationId,
      displayNameOverride:
        stations.find((station) => station.id === operatorStationId)?.name || "",
    });
    setMessage("Operator station created.");
  }

  async function handleCreateStop() {
    const created = await createOperatorStop(stopForm);
    setMessage("Stop created.");
    setSelectedStopId(created.id);
    setStopForm(emptyStopForm);
    await loadRoutesAndStops();
  }

  async function handleUpdateStop() {
    await updateOperatorStop(selectedStopId, stopForm);
    setMessage("Stop updated.");
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

  async function handleAddRouteStop() {
    await addRouteStop(selectedRouteId, {
      stopId: selectedStopId,
      orderIndex: toNumber(routeStopOrder),
      estimatedDurationFromOriginMinutes: toNumber(routeStopDuration),
      distanceFromOriginKm: toNumber(routeStopDistance),
      allowPickup,
      allowDropoff,
    });
    setMessage("Stop added to route.");
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

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
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
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Operator Stops</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input label="Name" value={stopForm.name} onChange={(v) => updateStop("name", v)} />
            <Input label="Google Place ID" value={stopForm.googlePlaceId} onChange={(v) => updateStop("googlePlaceId", v)} />
            <NumberInput label="Latitude" value={stopForm.latitude} onChange={(v) => updateStop("latitude", v)} />
            <NumberInput label="Longitude" value={stopForm.longitude} onChange={(v) => updateStop("longitude", v)} />
            <Input label="Address" value={stopForm.address} onChange={(v) => updateStop("address", v)} />
            <Input label="Description" value={stopForm.description} onChange={(v) => updateStop("description", v)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={handleCreateStop} className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600">
              Create stop
            </button>
            <button type="button" onClick={handleUpdateStop} disabled={!selectedStopId} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Update selected stop
            </button>
          </div>
          <select className={inputClass + " mt-4"} value={selectedStopId} onChange={(event) => setSelectedStopId(event.target.value)}>
            <option value="">Select stop</option>
            {stops.map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.name}
              </option>
            ))}
          </select>
        </div>

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

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Selected Route Operations</h2>
        <p className="mt-1 text-sm text-gray-500">
          {selectedRoute ? selectedRoute.name : "Select a route first"}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <Input label="Order" value={routeStopOrder} onChange={setRouteStopOrder} />
          <Input label="Duration from origin" value={routeStopDuration} onChange={setRouteStopDuration} />
          <Input label="Distance from origin" value={routeStopDistance} onChange={setRouteStopDistance} />
          <label className="flex items-end gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={allowPickup} onChange={(event) => setAllowPickup(event.target.checked)} />
            Pickup
          </label>
          <label className="flex items-end gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={allowDropoff} onChange={(event) => setAllowDropoff(event.target.checked)} />
            Dropoff
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={handleAddRouteStop} disabled={!selectedRouteId || !selectedStopId} className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:opacity-50">
            Add stop to route
          </button>
          <button type="button" onClick={handleRemoveRouteStop} disabled={!selectedRouteId || !selectedStopId} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
            <FiTrash2 size={16} />
            Remove stop
          </button>
        </div>
      </section>

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
