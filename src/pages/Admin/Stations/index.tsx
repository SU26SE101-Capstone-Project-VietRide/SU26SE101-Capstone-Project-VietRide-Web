import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheckCircle,
  FiGitMerge,
  FiMapPin,
  FiPower,
  FiRefreshCw,
  FiSearch,
  FiTruck,
} from "react-icons/fi";
import {
  getAdminLocations,
  getAdminStations,
  mergeAdminStations,
  updateAdminStation,
  type AdminLocation,
  type AdminStation,
} from "../../../api/vietride";
import { type PlaceSelection } from "../../../components/PlacePicker";
import { StatCard } from "../../../components/StatCard";
import Modal from "../../../components/Modal";
import CustomSelect from "../../../components/CustomSelect";
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
  const [filterStatus, setFilterStatus] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");
  const [filterType, setFilterType] = useState<
    "ALL" | "SHUTTLE" | "NON_SHUTTLE"
  >("ALL");
  const [selectedStationId, setSelectedStationId] = useState("");
  const [openEditor, setOpenEditor] = useState(false);
  const [openMerge, setOpenMerge] = useState(false);
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
        const selected = result.items.find((station) => station.id === selectedStationId) ?? result.items[0];
        setSelectedStationId(selected?.id ?? "");
        setForm(selected ? toForm(selected) : null);
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

    return stations.filter((station) => {
      const matchesSearch =
        !query ||
        [
          station.name,
          station.slug,
          station.addressStreet,
          station.city,
          station.ward,
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(query));
      const matchesStatus =
        filterStatus === "ALL" ||
        (filterStatus === "ACTIVE"
          ? station.isActive !== false
          : station.isActive === false);
      const matchesType =
        filterType === "ALL" ||
        (filterType === "SHUTTLE"
          ? station.supportsShuttle
          : !station.supportsShuttle);

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [filterStatus, filterType, searchTerm, stations]);
  const paginatedStations = filteredStations.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const selectedStation = stations.find((station) => station.id === selectedStationId) ?? stations[0];
  const editableForm = form ?? (selectedStation ? toForm(selectedStation) : null);
  const activeCount = stations.filter(
    (station) => station.isActive !== false,
  ).length;
  const inactiveCount = stations.length - activeCount;
  const shuttleCount = stations.filter(
    (station) => station.supportsShuttle,
  ).length;

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
      ward: form.ward,
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

  function openStationEditor(station: AdminStation) {
    selectStation(station);
    setOpenEditor(true);
  }

  function openStationMerge(station: AdminStation) {
    selectStation(station);
    setOpenMerge(true);
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
      !(form.name ?? "").trim() ||
      !(form.addressStreet ?? "").trim() ||
      !(form.city ?? "").trim() ||
      !(form.ward ?? "").trim()
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
        ward: form.ward.trim(),
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
      setOpenEditor(false);
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
      setOpenMerge(false);
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FiMapPin size={20} />}
          label={t("stations.totalStations")}
          value={stations.length}
          iconClassName="bg-vr-50 text-vr-700"
        />
        <StatCard
          icon={<FiCheckCircle size={20} />}
          label={t("stations.activeStations")}
          value={activeCount}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          icon={<FiPower size={20} />}
          label={t("stations.inactiveStations")}
          value={inactiveCount}
          iconClassName="bg-slate-100 text-slate-700"
        />
        <StatCard
          icon={<FiTruck size={20} />}
          label={t("stations.shuttleStations")}
          value={shuttleCount}
          iconClassName="bg-blue-50 text-blue-700"
        />
      </div>
      <section className="space-y-5">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setPage(1);
                  }}
                  placeholder={t("stations.searchPlaceholder")}
                  className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-vr-400 focus:ring-2 focus:ring-vr-100"
                />
              </div>
              <CustomSelect
                value={filterStatus}
                onChange={(event) => {
                  setFilterStatus(event.target.value as typeof filterStatus);
                  setPage(1);
                }}
                aria-label={t("stations.allStatuses")}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 lg:w-48"
              >
                <option value="ALL">{t("stations.allStatuses")}</option>
                <option value="ACTIVE">{tc("active")}</option>
                <option value="INACTIVE">{tc("inactive")}</option>
              </CustomSelect>
              <CustomSelect
                value={filterType}
                onChange={(event) => {
                  setFilterType(event.target.value as typeof filterType);
                  setPage(1);
                }}
                aria-label={t("stations.allVehicleTypes")}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 lg:w-56"
              >
                <option value="ALL">{t("stations.allVehicleTypes")}</option>
                <option value="SHUTTLE">{t("stations.shuttleVehicle")}</option>
                <option value="NON_SHUTTLE">
                  {t("stations.nonShuttleVehicle")}
                </option>
              </CustomSelect>
            </div>
          </div>{" "}
          <StationTable
            stations={paginatedStations}
            isLoading={isLoading}
            isSaving={isSaving}
            page={page}
            pageSize={pageSize}
            totalItems={filteredStations.length}
            onPageChange={setPage}
            onEdit={openStationEditor}
            onMerge={openStationMerge}
            onToggle={(station) => void toggleStation(station)}
          />
        </div>
      </section>
      {selectedStation && editableForm && (
        <Modal
          open={openEditor}
          onClose={() => setOpenEditor(false)}
          title={t("stations.normalizeTitle")}
          subtitle={t("stations.registryHint")}
          icon={<FiMapPin size={20} />}
          wide
        >
          <StationEditorPanel
            form={editableForm}
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
        </Modal>
      )}
      {selectedStation && (
        <Modal
          open={openMerge}
          onClose={() => setOpenMerge(false)}
          title={t("stations.mergeTitle")}
          subtitle={t("stations.mergeHint")}
          icon={<FiGitMerge size={20} />}
        >
          <StationMergePanel
            selectedStation={selectedStation}
            stations={stations}
            mergeTargetId={mergeTargetId}
            isSaving={isSaving}
            onMergeTargetChange={setMergeTargetId}
            onMerge={() => void mergeStation()}
          />
        </Modal>
      )}{" "}
    </div>
  );
}
