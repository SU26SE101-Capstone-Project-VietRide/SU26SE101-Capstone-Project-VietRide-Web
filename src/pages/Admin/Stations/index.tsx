import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiEdit2,
  FiGitMerge,
  FiMapPin,
  FiPower,
  FiSave,
  FiSearch,
} from "react-icons/fi";

type StationStatus = "ACTIVE" | "DUPLICATE" | "INACTIVE";

type PlatformStation = {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  linkedOperators: number;
  duplicateOf?: string;
  status: StationStatus;
  updatedAt: string;
};

type StationForm = {
  name: string;
  address: string;
  city: string;
  latitude: string;
  longitude: string;
};

type AlertState = {
  tone: "success" | "error";
  message: string;
};

const initialStations: PlatformStation[] = [
  {
    id: "st-sgn-mien-dong",
    name: "Mien Dong Bus Station",
    address: "292 Dinh Bo Linh, Binh Thanh",
    city: "Ho Chi Minh City",
    latitude: 10.8142,
    longitude: 106.7111,
    linkedOperators: 18,
    status: "ACTIVE",
    updatedAt: "2026-06-20",
  },
  {
    id: "st-sgn-mien-dong-new",
    name: "New Mien Dong Bus Station",
    address: "501 Hoang Huu Nam, Thu Duc",
    city: "Ho Chi Minh City",
    latitude: 10.8798,
    longitude: 106.8143,
    linkedOperators: 24,
    status: "ACTIVE",
    updatedAt: "2026-06-24",
  },
  {
    id: "st-sgn-md-new-duplicate",
    name: "Ben xe Mien Dong moi",
    address: "501 Hoang Huu Nam, Thu Duc",
    city: "Ho Chi Minh City",
    latitude: 10.8797,
    longitude: 106.8142,
    linkedOperators: 3,
    duplicateOf: "st-sgn-mien-dong-new",
    status: "DUPLICATE",
    updatedAt: "2026-06-26",
  },
  {
    id: "st-hni-giap-bat",
    name: "Giap Bat Bus Station",
    address: "Giai Phong, Hoang Mai",
    city: "Ha Noi",
    latitude: 20.9803,
    longitude: 105.8412,
    linkedOperators: 11,
    status: "ACTIVE",
    updatedAt: "2026-06-18",
  },
  {
    id: "st-dlt-old-center",
    name: "Da Lat Old City Stop",
    address: "Tran Phu, Ward 3",
    city: "Da Lat",
    latitude: 11.9404,
    longitude: 108.4583,
    linkedOperators: 0,
    status: "INACTIVE",
    updatedAt: "2026-06-10",
  },
];

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100";

const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";

const iconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-slate-600 transition hover:bg-slate-50";

function toForm(station: PlatformStation): StationForm {
  return {
    name: station.name,
    address: station.address,
    city: station.city,
    latitude: String(station.latitude),
    longitude: String(station.longitude),
  };
}

function isValidCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export default function AdminStations() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [stations, setStations] = useState<PlatformStation[]>(initialStations);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStationId, setSelectedStationId] = useState(
    initialStations[0]?.id ?? "",
  );
  const [mergeTargetId, setMergeTargetId] = useState(
    initialStations[1]?.id ?? "",
  );
  const [form, setForm] = useState<StationForm>(toForm(initialStations[0]));
  const [alert, setAlert] = useState<AlertState | null>(null);

  const filteredStations = useMemo(
    () =>
      stations.filter((station) => {
        const query = searchTerm.toLowerCase();
        return (
          station.name.toLowerCase().includes(query) ||
          station.city.toLowerCase().includes(query) ||
          station.address.toLowerCase().includes(query)
        );
      }),
    [searchTerm, stations],
  );

  const selectedStation = useMemo(
    () =>
      stations.find((station) => station.id === selectedStationId) ??
      stations[0],
    [selectedStationId, stations],
  );

  const duplicateCount = stations.filter(
    (station) => station.status === "DUPLICATE",
  ).length;
  const activeCount = stations.filter(
    (station) => station.status === "ACTIVE",
  ).length;
  const inactiveCount = stations.filter(
    (station) => station.status === "INACTIVE",
  ).length;

  const selectStation = (station: PlatformStation) => {
    setSelectedStationId(station.id);
    setForm(toForm(station));
    setMergeTargetId(
      stations.find(
        (item) => item.id !== station.id && item.status !== "INACTIVE",
      )?.id ?? "",
    );
    setAlert(null);
  };

  const updateForm = (key: keyof StationForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveStation = () => {
    if (!selectedStation) {
      return;
    }

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (!form.name.trim() || !form.address.trim() || !form.city.trim()) {
      setAlert({ tone: "error", message: t("stations.requiredFields") });
      return;
    }

    if (!isValidCoordinate(latitude, longitude)) {
      setAlert({ tone: "error", message: t("stations.invalidCoordinates") });
      return;
    }

    setStations((currentStations) =>
      currentStations.map((station) =>
        station.id === selectedStation.id
          ? {
              ...station,
              name: form.name.trim(),
              address: form.address.trim(),
              city: form.city.trim(),
              latitude,
              longitude,
              updatedAt: new Date().toISOString().slice(0, 10),
            }
          : station,
      ),
    );
    setAlert({
      tone: "success",
      message: t("stations.savedMessage", { station: form.name.trim() }),
    });
  };

  const mergeStation = () => {
    if (!selectedStation) {
      return;
    }

    const target = stations.find((station) => station.id === mergeTargetId);

    if (!target) {
      setAlert({ tone: "error", message: t("stations.invalidMergeTarget") });
      return;
    }

    if (target.id === selectedStation.id) {
      setAlert({ tone: "error", message: t("stations.mergeIntoSelf") });
      return;
    }

    setStations((currentStations) =>
      currentStations.map((station) => {
        if (station.id === target.id) {
          return {
            ...station,
            linkedOperators:
              station.linkedOperators + selectedStation.linkedOperators,
            updatedAt: new Date().toISOString().slice(0, 10),
          };
        }

        if (station.id === selectedStation.id) {
          return {
            ...station,
            linkedOperators: 0,
            duplicateOf: target.id,
            status: "DUPLICATE",
            updatedAt: new Date().toISOString().slice(0, 10),
          };
        }

        return station;
      }),
    );
    setAlert({
      tone: "success",
      message: t("stations.mergedMessage", {
        source: selectedStation.name,
        target: target.name,
      }),
    });
  };

  const deactivateStation = (station: PlatformStation) => {
    if (station.linkedOperators > 0 && station.status === "ACTIVE") {
      setAlert({ tone: "error", message: t("stations.activeUseBlocked") });
      selectStation(station);
      return;
    }

    setStations((currentStations) =>
      currentStations.map((item) =>
        item.id === station.id
          ? {
              ...item,
              status: item.status === "INACTIVE" ? "ACTIVE" : "INACTIVE",
              updatedAt: new Date().toISOString().slice(0, 10),
            }
          : item,
      ),
    );
    setAlert({
      tone: "success",
      message:
        station.status === "INACTIVE"
          ? t("stations.activatedMessage", { station: station.name })
          : t("stations.deactivatedMessage", { station: station.name }),
    });
  };

  const statusLabel = (status: StationStatus) => {
    const labels: Record<StationStatus, string> = {
      ACTIVE: tc("active"),
      DUPLICATE: t("stations.duplicate"),
      INACTIVE: tc("inactive"),
    };
    return labels[status];
  };

  const statusClass = (status: StationStatus) => {
    const classes: Record<StationStatus, string> = {
      ACTIVE: "bg-emerald-50 text-emerald-700",
      DUPLICATE: "bg-amber-50 text-amber-700",
      INACTIVE: "bg-slate-100 text-slate-600",
    };
    return classes[status];
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("stations.title")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            {t("stations.subtitle")}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            {t("stations.activeStations")}
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {activeCount}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            {t("stations.duplicateStations")}
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {duplicateCount}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            {t("stations.inactiveStations")}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-700">
            {inactiveCount}
          </p>
        </div>
      </section>

      {alert && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            alert.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {alert.message}
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {t("stations.registry")}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("stations.registryHint")}
              </p>
            </div>
            <div className="relative min-w-72">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-vr-500 focus:bg-white"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("stations.searchPlaceholder")}
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600">
                  <th className="px-4 py-3">{t("stations.stationName")}</th>
                  <th className="px-4 py-3">{t("stations.city")}</th>
                  <th className="px-4 py-3">{t("stations.coordinates")}</th>
                  <th className="px-4 py-3">{t("stations.linkedOperators")}</th>
                  <th className="px-4 py-3">{tc("status")}</th>
                  <th className="px-4 py-3 text-center">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredStations.map((station) => (
                  <tr
                    key={station.id}
                    className="border-b border-gray-100 transition hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">
                        {station.name}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {station.address}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{station.city}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {station.latitude.toFixed(4)},{" "}
                      {station.longitude.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {station.linkedOperators}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
                          station.status,
                        )}`}
                      >
                        {statusLabel(station.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          className={`${iconButtonClass} text-vr-600 hover:bg-vr-50`}
                          onClick={() => selectStation(station)}
                          title={tc("edit")}
                          aria-label={tc("edit")}
                        >
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          type="button"
                          className={`${iconButtonClass} text-amber-600 hover:bg-amber-50`}
                          onClick={() => selectStation(station)}
                          title={t("stations.merge")}
                          aria-label={t("stations.merge")}
                        >
                          <FiGitMerge size={16} />
                        </button>
                        <button
                          type="button"
                          className={`${iconButtonClass} text-rose-600 hover:bg-rose-50`}
                          onClick={() => deactivateStation(station)}
                          title={
                            station.status === "INACTIVE"
                              ? tc("enable")
                              : tc("disable")
                          }
                          aria-label={
                            station.status === "INACTIVE"
                              ? tc("enable")
                              : tc("disable")
                          }
                        >
                          <FiPower size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedStation && (
          <aside className="space-y-5">
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-vr-50 p-2 text-vr-700">
                  <FiMapPin size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {t("stations.normalizeTitle")}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {t("stations.normalizeHint")}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <label>
                  <span className={labelClass}>
                    {t("stations.stationName")}
                  </span>
                  <input
                    className={inputClass}
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                  />
                </label>
                <label>
                  <span className={labelClass}>{t("stations.address")}</span>
                  <input
                    className={inputClass}
                    value={form.address}
                    onChange={(event) =>
                      updateForm("address", event.target.value)
                    }
                  />
                </label>
                <label>
                  <span className={labelClass}>{t("stations.city")}</span>
                  <input
                    className={inputClass}
                    value={form.city}
                    onChange={(event) => updateForm("city", event.target.value)}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className={labelClass}>{t("stations.latitude")}</span>
                    <input
                      className={inputClass}
                      value={form.latitude}
                      onChange={(event) =>
                        updateForm("latitude", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span className={labelClass}>
                      {t("stations.longitude")}
                    </span>
                    <input
                      className={inputClass}
                      value={form.longitude}
                      onChange={(event) =>
                        updateForm("longitude", event.target.value)
                      }
                    />
                  </label>
                </div>
              </div>

              <button
                type="button"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-vr-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-vr-700"
                onClick={saveStation}
              >
                <FiSave size={16} />
                {t("stations.saveStation")}
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="text-lg font-bold text-gray-900">
                {t("stations.mergeTitle")}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("stations.mergeHint")}
              </p>

              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">
                  {t("stations.mergeSource")}
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {selectedStation.name}
                </p>
              </div>

              <label className="mt-4 block">
                <span className={labelClass}>{t("stations.mergeTarget")}</span>
                <select
                  className={inputClass}
                  value={mergeTargetId}
                  onChange={(event) => setMergeTargetId(event.target.value)}
                >
                  {stations.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.name} - {station.city}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                onClick={mergeStation}
              >
                <FiGitMerge size={16} />
                {t("stations.merge")}
              </button>

              <p className="mt-3 text-xs text-slate-500">
                {t("stations.mergeRule")}
              </p>
            </div>
          </aside>
        )}
      </section>
    </div>
  );
}
