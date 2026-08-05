import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiRefreshCw, FiSearch } from "react-icons/fi";
import {
  getAdminLocations,
  getAdminStations,
  mergeAdminStations,
  updateAdminStation,
  type AdminLocation,
  type AdminStation,
} from "../../../api/vietride";
import { type PlaceSelection } from "../../../components/PlacePicker";
import StationEditorPanel from "./StationEditorPanel";
import StationMergePanel from "./StationMergePanel";
import StationTable from "./StationTable";
import {
  applyPlaceToForm,
  isValidCoordinate,
  operatingDayKeys,
  toForm,
  withAddedFacility,
  withOperatingDay,
  withoutFacility,
  withToggledFacility,
  type AlertState,
  type OperatingDayKey,
  type OperatingDaySchedule,
  type StationForm,
} from "./stationHelpers";

export default function AdminStations() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const [stations, setStations] = useState<AdminStation[]>([]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStationId, setSelectedStationId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [form, setForm] = useState<StationForm | null>(null);
  const [customFacility, setCustomFacility] = useState("");
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
        const [result, locationResult] = await Promise.all([
          getAdminStations({
            page: 1,
            pageSize: 100,
            sortBy: "updatedAt",
            sortDir: "desc",
          }),
          getAdminLocations({
            page: 1,
            pageSize: 100,
            sortBy: "sortOrder",
            sortDir: "asc",
          }),
        ]);

        if (ignore) {
          return;
        }

        setStations(result.items);
        setLocations(locationResult.items);
        setSelectedStationId((currentId) => {
          const selected =
            result.items.find((station) => station.id === currentId) ??
            result.items[0];
          setForm(selected ? toForm(selected) : null);
          setMergeTargetId(
            result.items.find((station) => station.id !== selected?.id)?.id ??
              "",
          );
          return selected?.id ?? "";
        });
      } catch (error) {
        if (!ignore) {
          setStations([]);
          setLocations([]);
          setForm(null);
          setAlert({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : tRef.current("stations.loadFailed"),
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
  }, [reloadKey]);

  const filteredStations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return stations;
    }

    return stations.filter((station) =>
      [
        station.name,
        station.slug,
        station.addressStreet,
        station.city,
        station.province,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [searchTerm, stations]);

  const paginatedStations = filteredStations.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const selectedStation = stations.find(
    (station) => station.id === selectedStationId,
  );
  const activeCount = stations.filter(
    (station) => station.isActive !== false,
  ).length;
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

  function selectStation(station: AdminStation) {
    setSelectedStationId(station.id);
    setForm(toForm(station));
    setMergeTargetId(stations.find((item) => item.id !== station.id)?.id ?? "");
    setCustomFacility("");
    setAlert(null);
  }

  function applyPlace(place: PlaceSelection) {
    setForm((current) =>
      current ? applyPlaceToForm(current, place) : current,
    );
  }

  function updateOperatingDay(
    day: OperatingDayKey,
    updates: Partial<OperatingDaySchedule>,
  ) {
    setForm((current) =>
      current ? withOperatingDay(current, day, updates) : current,
    );
  }

  function toggleFacility(facility: string) {
    setForm((current) =>
      current ? withToggledFacility(current, facility) : current,
    );
  }

  function addCustomFacility() {
    const facility = customFacility.trim();
    if (!facility) return;

    setForm((current) =>
      current ? withAddedFacility(current, facility) : current,
    );
    setCustomFacility("");
  }

  function removeFacility(facility: string) {
    setForm((current) =>
      current ? withoutFacility(current, facility) : current,
    );
  }

  async function saveStation() {
    if (!selectedStation || !form) {
      return;
    }

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (
      !form.name.trim() ||
      !form.addressStreet.trim() ||
      !form.city.trim() ||
      !form.province.trim()
    ) {
      setAlert({ tone: "error", message: t("stations.requiredFields") });
      return;
    }
    if (!isValidCoordinate(latitude, longitude)) {
      setAlert({ tone: "error", message: t("stations.invalidCoordinates") });
      return;
    }

    const enabledDays = operatingDayKeys.filter(
      (day) => form.operatingHours[day].enabled,
    );
    if (
      enabledDays.some(
        (day) =>
          !form.operatingHours[day].open || !form.operatingHours[day].close,
      )
    ) {
      setAlert({ tone: "error", message: t("stations.invalidOperatingHours") });
      return;
    }
    const operatingHours = enabledDays.length
      ? Object.fromEntries(
          enabledDays.map((day) => [
            day,
            `${form.operatingHours[day].open}-${form.operatingHours[day].close}`,
          ]),
        )
      : null;
    const facilities = form.facilities.length ? form.facilities : null;

    setIsSaving(true);
    setAlert(null);
    try {
      const updated = await updateAdminStation(selectedStation.id, {
        name: form.name.trim(),
        addressStreet: form.addressStreet.trim(),
        locationId: form.locationId || null,
        city: form.city.trim(),
        province: form.province.trim(),
        latitude,
        longitude,
        contactPhone: form.contactPhone.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        operatingHours,
        facilities,
        supportsShuttle: form.supportsShuttle,
      });
      setStations((current) =>
        current.map((station) =>
          station.id === updated.id ? updated : station,
        ),
      );
      setForm(toForm(updated));
      setAlert({
        tone: "success",
        message: t("stations.savedMessage", { station: updated.name }),
      });
    } catch (error) {
      setAlert({
        tone: "error",
        message:
          error instanceof Error ? error.message : t("stations.saveFailed"),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleStation(station: AdminStation) {
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
        message:
          error instanceof Error ? error.message : t("stations.saveFailed"),
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
    if (
      !window.confirm(
        t("stations.mergeConfirm", {
          source: selectedStation.name,
          target: target.name,
        }),
      )
    ) {
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
        message:
          error instanceof Error ? error.message : t("stations.mergeFailed"),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("stations.title")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            {t("stations.subtitle")}
          </p>
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
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {stations.length}
          </p>
        </div>
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
            {t("stations.inactiveStations")}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-700">
            {inactiveCount}
          </p>
        </div>
      </section>

      <section className="space-y-5">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {t("stations.registry")}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("stations.registryHint")}
              </p>
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
          <StationTable
            stations={paginatedStations}
            isLoading={isLoading}
            isSaving={isSaving}
            page={page}
            pageSize={pageSize}
            totalItems={filteredStations.length}
            onPageChange={setPage}
            onSelect={selectStation}
            onToggle={(station) => void toggleStation(station)}
          />
        </div>

        {selectedStation && form && (
          <aside className="grid gap-5 lg:grid-cols-2">
            <StationEditorPanel
              form={form}
              locations={locations}
              selectedPlace={selectedPlace}
              customFacility={customFacility}
              alert={alert}
              isSaving={isSaving}
              onFormChange={setForm}
              onApplyPlace={applyPlace}
              onUpdateOperatingDay={updateOperatingDay}
              onToggleFacility={toggleFacility}
              onRemoveFacility={removeFacility}
              onAddCustomFacility={addCustomFacility}
              onCustomFacilityChange={setCustomFacility}
              onSave={() => void saveStation()}
            />
            <StationMergePanel
              selectedStation={selectedStation}
              stations={stations}
              mergeTargetId={mergeTargetId}
              isSaving={isSaving}
              onMergeTargetChange={setMergeTargetId}
              onMerge={() => void mergeStation()}
            />
          </aside>
        )}
      </section>
    </div>
  );
}
