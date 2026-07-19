import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiEdit2,
  FiGitMerge,
  FiMapPin,
  FiPower,
  FiRefreshCw,
  FiSave,
  FiSearch,
} from "react-icons/fi";
import {
  getAdminStations,
  mergeAdminStations,
  updateAdminStation,
  type Station,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Pagination from "../../../components/Pagination";
import PlacePicker, { type PlaceSelection } from "../../../components/PlacePicker";
import { formatDateTime } from "../../../utils/date";

type StationForm = {
  name: string;
  addressStreet: string;
  city: string;
  province: string;
  latitude: string;
  longitude: string;
  contactPhone: string;
  contactEmail: string;
  supportsShuttle: boolean;
};

type AlertState = {
  tone: "success" | "error";
  message: string;
};

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100";
const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";
const iconButtonClass =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function toForm(station: Station): StationForm {
  return {
    name: station.name ?? "",
    addressStreet: station.addressStreet ?? station.address ?? "",
    city: station.city ?? "",
    province: station.province ?? "",
    latitude: String(station.latitude ?? ""),
    longitude: String(station.longitude ?? ""),
    contactPhone: station.contactPhone ?? "",
    contactEmail: station.contactEmail ?? "",
    supportsShuttle: station.supportsShuttle ?? false,
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
  const [stations, setStations] = useState<Station[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStationId, setSelectedStationId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [form, setForm] = useState<StationForm | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    let ignore = false;

    async function loadStations() {
      setIsLoading(true);

      try {
        const result = await getAdminStations({
          page: 1,
          pageSize: 100,
          sortBy: "updatedAt",
          sortDir: "desc",
        });

        if (ignore) {
          return;
        }

        setStations(result.items);
        setSelectedStationId((currentId) => {
          const selected =
            result.items.find((station) => station.id === currentId) ??
            result.items[0];
          setForm(selected ? toForm(selected) : null);
          setMergeTargetId(
            result.items.find((station) => station.id !== selected?.id)?.id ?? "",
          );
          return selected?.id ?? "";
        });
      } catch (error) {
        if (!ignore) {
          setStations([]);
          setForm(null);
          setAlert({
            tone: "error",
            message: error instanceof Error ? error.message : t("stations.loadFailed"),
          });
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadStations();
    return () => {
      ignore = true;
    };
  }, [reloadKey, t]);

  const filteredStations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return stations;
    }

    return stations.filter((station) =>
      [station.name, station.addressStreet, station.address, station.city, station.province]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [searchTerm, stations]);

  const paginatedStations = filteredStations.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const selectedStation = stations.find((station) => station.id === selectedStationId);
  const activeCount = stations.filter((station) => station.isActive !== false).length;
  const inactiveCount = stations.length - activeCount;

  const selectedPlace = useMemo<PlaceSelection | null>(() => {
    if (!form) {
      return null;
    }

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!isValidCoordinate(latitude, longitude)) {
      return null;
    }

    return {
      placeId: selectedStationId || `${latitude},${longitude}`,
      name: form.name,
      address: form.addressStreet,
      city: form.city,
      province: form.province,
      latitude,
      longitude,
    };
  }, [form, selectedStationId]);

  function selectStation(station: Station) {
    setSelectedStationId(station.id);
    setForm(toForm(station));
    setMergeTargetId(stations.find((item) => item.id !== station.id)?.id ?? "");
    setAlert(null);
  }

  function applyPlace(place: PlaceSelection) {
    setForm((current) =>
      current
        ? {
            ...current,
            name: place.name,
            addressStreet: place.address,
            city: place.city,
            province: place.province,
            latitude: String(place.latitude),
            longitude: String(place.longitude),
          }
        : current,
    );
  }

  async function saveStation() {
    if (!selectedStation || !form) {
      return;
    }

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!form.name.trim() || !form.addressStreet.trim() || !form.province.trim()) {
      setAlert({ tone: "error", message: t("stations.requiredFields") });
      return;
    }
    if (!isValidCoordinate(latitude, longitude)) {
      setAlert({ tone: "error", message: t("stations.invalidCoordinates") });
      return;
    }

    setIsSaving(true);
    setAlert(null);
    try {
      const updated = await updateAdminStation(selectedStation.id, {
        name: form.name.trim(),
        addressStreet: form.addressStreet.trim(),
        city: form.city.trim(),
        province: form.province.trim(),
        latitude,
        longitude,
        contactPhone: form.contactPhone.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        supportsShuttle: form.supportsShuttle,
      });
      setStations((current) =>
        current.map((station) => (station.id === updated.id ? updated : station)),
      );
      setForm(toForm(updated));
      setAlert({
        tone: "success",
        message: t("stations.savedMessage", { station: updated.name }),
      });
    } catch (error) {
      setAlert({
        tone: "error",
        message: error instanceof Error ? error.message : t("stations.saveFailed"),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleStation(station: Station) {
    setIsSaving(true);
    setAlert(null);
    try {
      const updated = await updateAdminStation(station.id, {
        isActive: station.isActive === false,
      });
      setStations((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      if (selectedStationId === updated.id) {
        setForm(toForm(updated));
      }
      setAlert({
        tone: "success",
        message:
          updated.isActive === false
            ? t("stations.deactivatedMessage", { station: updated.name })
            : t("stations.activatedMessage", { station: updated.name }),
      });
    } catch (error) {
      setAlert({
        tone: "error",
        message: error instanceof Error ? error.message : t("stations.saveFailed"),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function mergeStation() {
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
    if (!window.confirm(t("stations.mergeConfirm", { source: selectedStation.name, target: target.name }))) {
      return;
    }

    setIsSaving(true);
    setAlert(null);
    try {
      const result = await mergeAdminStations(target.id, selectedStation.id);
      const relinkedTotal = Object.values(result.relinkedCounts).reduce(
        (sum, count) => sum + count,
        0,
      );
      setPage(1);
      setSelectedStationId(result.primaryStation.id);
      setAlert({
        tone: "success",
        message: t("stations.mergedMessageWithCount", {
          source: selectedStation.name,
          target: result.primaryStation.name,
          count: relinkedTotal,
        }),
      });
      setReloadKey((value) => value + 1);
    } catch (error) {
      setAlert({
        tone: "error",
        message: error instanceof Error ? error.message : t("stations.mergeFailed"),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("stations.title")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">{t("stations.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <FiRefreshCw />
          {tc("refresh")}
        </button>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">{t("stations.totalStations")}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stations.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">{t("stations.activeStations")}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">{t("stations.inactiveStations")}</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">{inactiveCount}</p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t("stations.registry")}</h2>
              <p className="mt-1 text-sm text-gray-500">{t("stations.registryHint")}</p>
            </div>
            <div className="relative min-w-72">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
                placeholder={t("stations.searchPlaceholder")}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-vr-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600">
                  <th className="px-4 py-3">{t("stations.stationName")}</th>
                  <th className="px-4 py-3">{t("stations.city")}</th>
                  <th className="px-4 py-3">{t("stations.shuttle")}</th>
                  <th className="px-4 py-3">{tc("status")}</th>
                  <th className="px-4 py-3 text-center">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStations.map((station) => (
                  <tr key={station.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{station.name}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {station.addressStreet ?? station.address ?? "-"}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {formatDateTime(station.updatedAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {[station.city, station.province].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {station.supportsShuttle ? tc("yes") : tc("no")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          station.isActive === false
                            ? "bg-slate-100 text-slate-600"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {station.isActive === false ? tc("inactive") : tc("active")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          className={`${iconButtonClass} text-vr-700 hover:bg-vr-50`}
                          onClick={() => selectStation(station)}
                          title={tc("edit")}
                          aria-label={tc("edit")}
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          type="button"
                          className={`${iconButtonClass} text-amber-700 hover:bg-amber-50`}
                          onClick={() => selectStation(station)}
                          title={t("stations.merge")}
                          aria-label={t("stations.merge")}
                        >
                          <FiGitMerge />
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          className={`${iconButtonClass} text-rose-600 hover:bg-rose-50`}
                          onClick={() => void toggleStation(station)}
                          title={station.isActive === false ? tc("enable") : tc("disable")}
                          aria-label={station.isActive === false ? tc("enable") : tc("disable")}
                        >
                          <FiPower />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && paginatedStations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">
                      {t("stations.empty")}
                    </td>
                  </tr>
                )}
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">
                      {t("stations.loading")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={filteredStations.length}
            onPageChange={setPage}
          />
        </div>

        {selectedStation && form && (
          <aside className="space-y-5">
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-vr-50 p-2 text-vr-700"><FiMapPin /></div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{t("stations.normalizeTitle")}</h2>
                  <p className="mt-1 text-sm text-gray-500">{t("stations.normalizeHint")}</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <PlacePicker
                  label={t("stations.stationName")}
                  placeholder={t("stations.searchPlaceholder")}
                  selectedPlace={selectedPlace}
                  onSelect={applyPlace}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className={labelClass}>{t("stations.cityOnly")}</span>
                    <input className={inputClass} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
                  </label>
                  <label>
                    <span className={labelClass}>{t("stations.province")}</span>
                    <input className={inputClass} value={form.province} onChange={(event) => setForm({ ...form, province: event.target.value })} />
                  </label>
                  <label>
                    <span className={labelClass}>{tc("phone")}</span>
                    <input className={inputClass} value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} />
                  </label>
                  <label>
                    <span className={labelClass}>{tc("email")}</span>
                    <input className={inputClass} value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} />
                  </label>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.supportsShuttle}
                    onChange={(event) => setForm({ ...form, supportsShuttle: event.target.checked })}
                    className="h-4 w-4 cursor-pointer accent-vr-500"
                  />
                  {t("stations.supportsShuttle")}
                </label>
              </div>

              <button
                type="button"
                onClick={() => void saveStation()}
                disabled={isSaving}
                className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiSave />
                {t("stations.saveStation")}
              </button>

              {alert && (
                <div className={`mt-3 rounded-lg border px-3 py-2.5 text-sm ${alert.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                  {alert.message}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="text-lg font-bold text-gray-900">{t("stations.mergeTitle")}</h2>
              <p className="mt-1 text-sm text-gray-500">{t("stations.mergeHint")}</p>
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">{t("stations.mergeSource")}</p>
                <p className="mt-1 font-semibold text-slate-900">{selectedStation.name}</p>
              </div>
              <label className="mt-4 block">
                <span className={labelClass}>{t("stations.mergeTarget")}</span>
                <CustomSelect
                  className={inputClass}
                  value={mergeTargetId}
                  onChange={(event) => setMergeTargetId(event.target.value)}
                >
                  {stations.filter((station) => station.id !== selectedStation.id).map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.name} - {station.province}
                    </option>
                  ))}
                </CustomSelect>
              </label>
              <button
                type="button"
                onClick={() => void mergeStation()}
                disabled={isSaving || !mergeTargetId}
                className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiGitMerge />
                {t("stations.merge")}
              </button>
              <p className="mt-3 text-xs text-slate-500">{t("stations.mergeRule")}</p>
            </div>
          </aside>
        )}
      </section>
    </div>
  );
}
