import { useToastFeedback } from "../../../hooks/useToastFeedback";
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
  getPublicLocations,
  getAdminStations,
  getAdminStationSummary,
  mergeAdminStations,
  updateAdminStation,
  type AdminLocation,
  type AdminStation,
  type AdminStationSummary,
} from "../../../api/vietride";
import { matchProvinceCode } from "../../../utils/locationMatching";
import { type PlaceSelection } from "../../../components/PlacePicker";
import { StatCard } from "../../../components/StatCard";
import Modal from "../../../components/Modal";
import { ConfirmModal } from "../../../components/ConfirmModal";
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
  // Cascade tỉnh -> phường/xã cho ô Location của bến đang sửa
  // Ghi đè khoá theo bến: đổi bến thì tự quay về tỉnh suy từ dữ liệu bến đó,
  // không cần effect reset (tránh setState đồng bộ trong effect).
  const [provinceOverride, setProvinceOverride] = useState<{
    stationId: string;
    code: string;
  } | null>(null);
  const [wardResult, setWardResult] = useState<{
    provinceCode: string;
    wards: AdminLocation[];
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [summary, setSummary] = useState<AdminStationSummary | null>(null);
  // Danh sách ứng viên gộp lấy riêng bằng chính list API: bảng chính giờ chỉ
  // giữ đúng một trang nên không còn đủ bến để dựng dropdown này.
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeCandidates, setMergeCandidates] = useState<AdminStation[]>([]);
  const [isLoadingMergeCandidates, setIsLoadingMergeCandidates] =
    useState(false);
  const [filterStatus, setFilterStatus] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");
  const [filterType, setFilterType] = useState<
    "ALL" | "SHUTTLE" | "NON_SHUTTLE"
  >("ALL");
  const [selectedStationId, setSelectedStationId] = useState("");
  const selectedStationIdRef = useRef(selectedStationId);
  const [openEditor, setOpenEditor] = useState(false);
  const [openMerge, setOpenMerge] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [form, setForm] = useState<StationForm | null>(null);
  const [customFacility, setCustomFacility] = useState("");
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mergeConfirmationOpen, setMergeConfirmationOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    selectedStationIdRef.current = selectedStationId;
  }, [selectedStationId]);

  // Search giờ đi thẳng lên BE nên phải debounce; đổi từ khoá thì về trang 1.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let ignore = false;

    // Toàn bộ search/filter/sort chạy server-side. BE `search` khớp unaccent
    // trên name/city/ward/addressStreet/slug nên bỏ được lớp lọc client cũ —
    // lớp đó vừa phân biệt dấu vừa buộc phải tải trọn danh sách bến.
    async function loadStations() {
      setIsLoading(true);

      try {
        const [stationPage, locationItems] = await Promise.all([
          getAdminStations({
            page,
            pageSize,
            sortBy: "updatedAt",
            sortDir: "desc",
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
            ...(filterStatus === "ALL"
              ? {}
              : { isActive: filterStatus === "ACTIVE" }),
            ...(filterType === "ALL"
              ? {}
              : { supportsShuttle: filterType === "SHUTTLE" }),
          }),
          // Danh mục nay có hai cấp: nạp cả catalog sẽ là hàng trăm request.
          // Chỉ lấy tỉnh/thành; phường/xã tải theo tỉnh khi người dùng chọn.
          getPublicLocations(),
        ]);

        if (ignore) {
          return;
        }

        const stationItems = stationPage.items;
        setStations(stationItems);
        setTotalItems(stationPage.totalItems);
        setLocations(locationItems);
        const selected =
          stationItems.find(
            (station) => station.id === selectedStationIdRef.current,
          ) ??
          stationItems[0];
        setSelectedStationId(selected?.id ?? "");
        setForm(selected ? toForm(selected) : null);
      } catch (error) {
        if (!ignore) {
          setStations([]);
          setTotalItems(0);
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
  }, [debouncedSearch, filterStatus, filterType, page, pageSize, reloadKey]);

  // 4 thẻ thống kê đếm trên TOÀN BỘ bến nên không thể suy từ trang hiện tại —
  // BE có endpoint summary riêng cho đúng việc này.
  useEffect(() => {
    let ignore = false;
    void getAdminStationSummary()
      .then((result) => {
        if (!ignore) setSummary(result);
      })
      .catch(() => {
        // Thẻ thống kê hỏng không được chặn bảng chính
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  // Dropdown chọn bến đích để gộp: tìm theo từ khoá riêng, lấy đúng một trang.
  useEffect(() => {
    if (!openMerge) return;

    let ignore = false;
    const timer = window.setTimeout(() => {
      setIsLoadingMergeCandidates(true);
      void getAdminStations({
        page: 1,
        pageSize: 20,
        isActive: true,
        sortBy: "name",
        sortDir: "asc",
        ...(mergeSearch.trim() ? { search: mergeSearch.trim() } : {}),
      })
        .then((result) => {
          if (!ignore) setMergeCandidates(result.items);
        })
        .catch(() => {
          if (!ignore) setMergeCandidates([]);
        })
        .finally(() => {
          if (!ignore) setIsLoadingMergeCandidates(false);
        });
    }, 350);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [mergeSearch, openMerge]);

  const paginatedStations = stations;
  const selectedStation =
    stations.find((station) => station.id === selectedStationId) ?? stations[0];
  const editableForm =
    form ?? (selectedStation ? toForm(selectedStation) : null);
  // Tỉnh suy từ tên tỉnh snapshot của bến; người dùng đổi thì override thắng
  const derivedProvinceCode = matchProvinceCode(
    "",
    selectedStation?.city,
    locations,
  );
  const provinceCode =
    provinceOverride && provinceOverride.stationId === selectedStation?.id
      ? provinceOverride.code
      : derivedProvinceCode;
  // Tải phường/xã của tỉnh đang chọn. Kết quả mang theo tỉnh của chính nó nên
  // response về muộn của tỉnh trước không lẫn sang tỉnh đang chọn.
  useEffect(() => {
    if (!provinceCode) return;

    let ignore = false;
    getPublicLocations({ parentCode: provinceCode })
      .then((result) => {
        if (ignore) return;
        setWardResult({
          provinceCode,
          wards: result.filter((location) => location.isActive),
        });
      })
      .catch(() => {
        if (ignore) return;
        setWardResult({ provinceCode, wards: [] });
      });

    return () => {
      ignore = true;
    };
  }, [provinceCode]);
  // Lấy từ `/summary` — đếm trên toàn bộ bến, không phải trang đang xem.
  const totalStations = summary?.total ?? 0;
  const activeCount = summary?.active ?? 0;
  const inactiveCount = summary?.inactive ?? 0;
  const shuttleCount = summary?.supportsShuttle ?? 0;

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
    // Không chọn sẵn bến đích nữa: ứng viên gộp giờ tải theo từ khoá riêng,
    // đoán bừa một bến trong trang hiện tại là mời gọi gộp nhầm.
    setMergeTargetId("");
    setMergeSearch("");
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
    if (!form.name.trim() || !form.addressStreet.trim()) {
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
        // KHÔNG gửi city/ward: handler BE bỏ qua và tự suy từ hierarchy của
        // locationId. Gửi lên chỉ tạo ảo giác "sửa được" cho người dùng.
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

    const target = mergeCandidates.find(
      (station) => station.id === mergeTargetId,
    );
    if (!target) {
      setAlert({ tone: "error", message: t("stations.invalidMergeTarget") });
      return;
    }
    if (target.id === selectedStation.id) {
      setAlert({ tone: "error", message: t("stations.mergeIntoSelf") });
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
      setMergeConfirmationOpen(false);
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

  useToastFeedback({ message: alert?.tone === "success" ? alert.message : "", error: alert?.tone === "error" ? alert.message : "" });
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
          value={totalStations}
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
            totalItems={totalItems}
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
            provinceCode={provinceCode}
            onProvinceChange={(nextProvinceCode) => {
              setProvinceOverride({
                stationId: selectedStation.id,
                code: nextProvinceCode,
              });
              // Đổi tỉnh thì Location cũ không còn hợp lệ
              setForm((current) =>
                current ? { ...current, locationId: "" } : current,
              );
            }}
            wards={
              wardResult?.provinceCode === provinceCode ? wardResult.wards : []
            }
            isLoadingWards={
              Boolean(provinceCode) && wardResult?.provinceCode !== provinceCode
            }
            selectedPlace={selectedPlace}
            customFacility={customFacility}
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
            stations={mergeCandidates}
            mergeTargetId={mergeTargetId}
            mergeSearch={mergeSearch}
            isLoadingCandidates={isLoadingMergeCandidates}
            isSaving={isSaving}
            onMergeSearchChange={setMergeSearch}
            onMergeTargetChange={setMergeTargetId}
            onMerge={() => setMergeConfirmationOpen(true)}
          />
        </Modal>
      )}{" "}
      <ConfirmModal
        open={mergeConfirmationOpen}
        onClose={() => setMergeConfirmationOpen(false)}
        onConfirm={() => void mergeStation()}
        title={t("stations.mergeTitle")}
        message={selectedStation ? t("stations.mergeConfirm", { source: selectedStation.name, target: stations.find((station) => station.id === mergeTargetId)?.name ?? "" }) : ""}
        confirmLabel={tc("confirm")}
        cancelLabel={tc("cancel")}
        tone="warning"
        busy={isSaving}
      />
    </div>
  );
}
