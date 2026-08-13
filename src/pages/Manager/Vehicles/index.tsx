import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiAlertTriangle, FiCheckCircle, FiPauseCircle, FiPlus, FiRefreshCw, FiSearch, FiTruck } from "react-icons/fi";
import { ApiRequestError } from "../../../api/client";
import { fetchAllPages } from "../../../api/pagination";
import { getAuthUser } from "../../../auth";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { StatCard } from "../../../components/StatCard";
import CustomSelect from "../../../components/CustomSelect";
import { ConfirmModal } from "../../../components/ConfirmModal";
import {
  readSessionCache,
  writeSessionCache,
} from "../../../utils/sessionCache";
import {
  createOperatorVehicle,
  getOperatorVehicle,
  getOperatorVehicles,
  getVehicleTypes,
  updateOperatorVehicle,
  type OperatorVehicle,
  type SeatLayoutJson,
  type VehicleType,
} from "../../../api/vietride";
import {
  uploadVehicleImages,
  validateVehicleImageFiles,
  VehicleImageError,
  type VehicleImageErrorCode,
} from "./vehicleImageUpload";
import { VehicleTable } from "./VehicleTable";
import {
  VehicleDetailsPanel,
  type VehiclePanelMode,
} from "./VehicleDetailsPanel";
import {
  createVehicleFormForType,
  emptyVehicleForm,
  getImageEntries,
  getUniquePublicImageUrls,
  getVehicleId,
  inputClass,
  isVehicleStatus,
  MAX_COLUMNS_PER_ROW,
  MAX_ROWS_PER_DECK,
  MAX_VEHICLE_DECKS,
  MAX_VEHICLE_SEATS,
  normalizeVehicleStatus,
  toVehicleCreateRequest,
  toVehicleUpdateRequest,
  updateVehicleFormValue,
  type VehicleForm,
  type VehicleFormErrors,
} from "./vehicleForm";
import {
  countSeatChanges,
  parseVehicleSeatLayout,
  toggleVehicleSeat,
} from "./vehicleSeatHelpers";

const VEHICLE_PAGE_SIZE = 10;
const VEHICLE_TYPES_CACHE_KEY = "vietride:vehicleTypes";
const VEHICLE_TYPES_CACHE_MAX_AGE_MS = 45 * 60 * 1000;

function invalidateTripResourcesCache(userId?: string) {
  try {
    sessionStorage.removeItem(
      `vietride:tripResources:${userId || "anonymous"}`,
    );
  } catch {
    // Cache invalidation is an optimization and must not block a vehicle save.
  }
}

export default function VehiclesPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  // Giữ tham chiếu t mới nhất để callback tải dữ liệu không refetch khi đổi ngôn ngữ
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const authUser = getAuthUser();
  const canManageVehicles = authUser?.role === "OPERATOR_ADMIN";
  const [searchParams, setSearchParams] = useSearchParams();
  const querySearch = searchParams.get("search") ?? "";
  const rawQueryStatus = searchParams.get("status") ?? "";
  // BE chỉ nhận đúng enum ACTIVE|MAINTENANCE|OFF_DUTY|RETIRED và trả 422 cho
  // giá trị lạ. URL do người dùng sửa tay được nên phải lọc trước khi gửi đi.
  const queryStatus = isVehicleStatus(rawQueryStatus) ? rawQueryStatus : "";
  const queryVehicleTypeId = searchParams.get("vehicleTypeId") ?? "";
  const parsedPage = Number(searchParams.get("page"));
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const [search, setSearch] = useState(querySearch);
  const [openReg, setOpenReg] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [vehicles, setVehicles] = useState<OperatorVehicle[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [selectedVehicle, setSelectedVehicle] =
    useState<OperatorVehicle | null>(null);
  const [panelMode, setPanelMode] = useState<VehiclePanelMode>("info");
  const [seatDraft, setSeatDraft] =
    useState<OperatorVehicle["seatLayoutJson"]>();
  const [originalSeatLayout, setOriginalSeatLayout] =
    useState<OperatorVehicle["seatLayoutJson"]>();
  const [isSeatDetailLoading, setIsSeatDetailLoading] = useState(false);
  const [isSeatSaving, setIsSeatSaving] = useState(false);
  const [pendingSeatSave, setPendingSeatSave] = useState(false);
  const [seatError, setSeatError] = useState("");
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicleForm);
  const [vehicleFormBaseline, setVehicleFormBaseline] =
    useState<VehicleForm>(emptyVehicleForm);
  const [vehicleImageFiles, setVehicleImageFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<VehicleFormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  useToastFeedback({ message, error: formError || seatError });
  const [fleetTotalItems, setFleetTotalItems] = useState<number | null>(null);
  const listAbortControllerRef = useRef<AbortController | null>(null);
  const detailAbortControllerRef = useRef<AbortController | null>(null);
  const pageSize = VEHICLE_PAGE_SIZE;

  const selectedLayout = parseVehicleSeatLayout(
    selectedVehicle?.seatLayoutJson,
  );
  const draftLayout = parseVehicleSeatLayout(seatDraft);
  const initialLayout = parseVehicleSeatLayout(originalSeatLayout);
  const isSeatDirty =
    Boolean(draftLayout && initialLayout) &&
    JSON.stringify(draftLayout) !== JSON.stringify(initialLayout);
  const isInfoDirty =
    (openReg || openEdit) &&
    (JSON.stringify(vehicleForm) !== JSON.stringify(vehicleFormBaseline) ||
      vehicleImageFiles.length > 0);

  useEffect(() => {
    // URL navigation is an external source; mirror it into the controlled input.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(querySearch);
  }, [querySearch]);

  // Debounce ô tìm kiếm để tránh mỗi ký tự bắn một request.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = search.trim();
      if (nextSearch === querySearch) {
        return;
      }

      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (nextSearch) {
            next.set("search", nextSearch);
          } else {
            next.delete("search");
          }
          next.set("page", "1");
          return next;
        },
        { replace: true },
      );
    }, 350);

    return () => window.clearTimeout(timer);
  }, [querySearch, search, setSearchParams]);

  // Hàm tải danh sách xe dùng chung cho effect, nút Refresh và sau create/update.
  const loadVehicles = useCallback(async () => {
    listAbortControllerRef.current?.abort();
    const controller = new AbortController();
    listAbortControllerRef.current = controller;
    setIsLoading(true);
    setFormError("");

    try {
      const vehicleResult = await getOperatorVehicles(
        {
          page,
          pageSize,
          search: querySearch,
          searchIn: "licensePlate",
          status: queryStatus || undefined,
          vehicleTypeId: queryVehicleTypeId || undefined,
        },
        controller.signal,
      );

      if (controller.signal.aborted) {
        return;
      }

      setVehicles(vehicleResult.items);
      setTotalItems(vehicleResult.totalItems);
      if (!querySearch) {
        setFleetTotalItems(vehicleResult.totalItems);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      setFormError(
        err instanceof Error
          ? err.message
          : tRef.current("vehicles.loadFailed"),
      );
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [page, pageSize, querySearch, queryStatus, queryVehicleTypeId]);

  useEffect(() => {
    // The list request synchronizes component state with the external API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadVehicles();

    return () => {
      listAbortControllerRef.current?.abort();
    };
  }, [loadVehicles]);

  // Danh mục loại xe là dữ liệu tĩnh — cache theo phiên, không gọi lại mỗi lần mở panel.
  useEffect(() => {
    const cachedTypes = readSessionCache<VehicleType[]>(
      VEHICLE_TYPES_CACHE_KEY,
      VEHICLE_TYPES_CACHE_MAX_AGE_MS,
    );

    if (cachedTypes) {
      // Session cache is an external source of truth for this reference data.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVehicleTypes(cachedTypes);
      return;
    }

    const controller = new AbortController();

    async function loadTypes() {
      try {
        const typeItems = await fetchAllPages((params) =>
          getVehicleTypes(params, controller.signal),
        );

        if (controller.signal.aborted) {
          return;
        }

        setVehicleTypes(typeItems);
        writeSessionCache(VEHICLE_TYPES_CACHE_KEY, typeItems);

        if (typeItems[0]) {
          setVehicleForm((current) =>
            current.vehicleTypeId
              ? current
              : createVehicleFormForType(typeItems[0]),
          );
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setFormError(
            err instanceof Error
              ? err.message
              : tRef.current("vehicles.loadFailed"),
          );
        }
      }
    }

    void loadTypes();

    return () => {
      controller.abort();
    };
  }, []);

  const total = fleetTotalItems ?? totalItems;
  const activeCount = vehicles.filter((vehicle) => vehicle.status === "ACTIVE").length;
  const maintenanceCount = vehicles.filter((vehicle) => vehicle.status === "MAINTENANCE").length;
  const inactiveCount = vehicles.filter((vehicle) => ["OFF_DUTY", "INACTIVE", "RETIRED"].includes(vehicle.status)).length;

  function updateVehicleForm(key: keyof VehicleForm, value: string) {
    setVehicleForm((current) => {
      if (key === "vehicleTypeId" && openReg) {
        const typeDefaults = createVehicleFormForType(
          vehicleTypes.find((vehicleType) => vehicleType.id === value),
        );

        return {
          ...current,
          vehicleTypeId: value,
          totalSeats: typeDefaults.totalSeats,
          deckCount: typeDefaults.deckCount,
          rowsPerDeck: typeDefaults.rowsPerDeck,
          columnsPerRow: typeDefaults.columnsPerRow,
          aisleAfterCol: typeDefaults.aisleAfterCol,
        };
      }

      return updateVehicleFormValue(current, key, value);
    });
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setFormError("");
  }

  function openCreateModal() {
    if (isInfoDirty || isSeatDirty) {
      setDiscardPrompt(true);
      return;
    }

    setSelectedVehicle(null);
    setVehicleImageFiles([]);
    setFormError("");
    setMessage("");
    setFormError("");
    setFieldErrors({});
    const nextForm = createVehicleFormForType(vehicleTypes[0]);
    setVehicleForm(nextForm);
    setVehicleFormBaseline(nextForm);
    resetSeatDraft();
    setPanelMode("info");
    setOpenReg(true);
  }

  function openEditModal(vehicle: OperatorVehicle) {
    setSelectedVehicle(vehicle);
    setVehicleImageFiles([]);
    setFormError("");
    setMessage("");
    setFormError("");
    setFieldErrors({});
    const nextForm = {
      ...emptyVehicleForm,
      vehicleTypeId: vehicle.vehicleTypeId,
      licensePlate: vehicle.licensePlate,
      totalSeats: String(vehicle.totalSeats),
      maxCargoWeightKg: String(vehicle.maxCargoWeightKg),
      maxCargoVolumeM3: String(vehicle.maxCargoVolumeM3 ?? 0),
      imageUrls: vehicle.imageUrls?.join("\n") ?? "",
      status: normalizeVehicleStatus(vehicle.status),
    };
    setVehicleForm(nextForm);
    setVehicleFormBaseline(nextForm);
    setOpenEdit(true);
  }

  function cancelInfoEdit() {
    setVehicleForm(vehicleFormBaseline);
    setVehicleImageFiles([]);
    setFormError("");
    setFieldErrors({});
    setOpenEdit(false);
  }

  function resetSeatDraft() {
    detailAbortControllerRef.current?.abort();
    setSeatDraft(undefined);
    setOriginalSeatLayout(undefined);
    setIsSeatDetailLoading(false);
    setIsSeatSaving(false);
    setSeatError("");
    setDiscardPrompt(false);
  }

  function openVehiclePanel(vehicle: OperatorVehicle, mode: VehiclePanelMode) {
    if (isInfoDirty || isSeatDirty) {
      setDiscardPrompt(true);
      return;
    }

    resetSeatDraft();
    setOpenEdit(false);
    setSelectedVehicle(vehicle);
    const nextForm = {
      ...emptyVehicleForm,
      vehicleTypeId: vehicle.vehicleTypeId,
      licensePlate: vehicle.licensePlate,
      totalSeats: String(vehicle.totalSeats),
      maxCargoWeightKg: String(vehicle.maxCargoWeightKg),
      maxCargoVolumeM3: String(vehicle.maxCargoVolumeM3 ?? 0),
      imageUrls: vehicle.imageUrls?.join("\n") ?? "",
      status: normalizeVehicleStatus(vehicle.status),
    };
    setVehicleForm(nextForm);
    setVehicleFormBaseline(nextForm);
    setPanelMode(mode);
    setMessage("");
    setFormError("");

    if (mode === "seats" && canManageVehicles) {
      void loadSeatLayout(vehicle);
    }
  }

  function closeVehiclePanel() {
    resetSeatDraft();
    setOpenReg(false);
    setOpenEdit(false);
    setSelectedVehicle(null);
    setVehicleImageFiles([]);
    setFormError("");
    setFieldErrors({});
  }

  function requestCloseVehiclePanel() {
    if (isSeatSaving) {
      return;
    }

    if (isInfoDirty || isSeatDirty) {
      setDiscardPrompt(true);
      return;
    }

    closeVehiclePanel();
  }

  function discardAndCloseVehiclePanel() {
    closeVehiclePanel();
  }

  async function loadSeatLayout(vehicle?: OperatorVehicle) {
    const sourceVehicle = vehicle ?? selectedVehicle;
    const vehicleId = sourceVehicle ? getVehicleId(sourceVehicle) : "";

    if (!vehicleId) {
      setSeatError(t("vehicles.missingVehicleForDetail"));
      return;
    }

    detailAbortControllerRef.current?.abort();
    const controller = new AbortController();
    detailAbortControllerRef.current = controller;
    setIsSeatDetailLoading(true);
    setSeatError("");

    try {
      const detail = await getOperatorVehicle(vehicleId, controller.signal);
      if (controller.signal.aborted) {
        return;
      }
      const freshLayout = parseVehicleSeatLayout(detail.seatLayoutJson);

      if (!freshLayout) {
        throw new Error(
          t("vehicles.noSeatMap", { defaultValue: "Chưa có sơ đồ ghế." }),
        );
      }

      setVehicles((current) =>
        current.map((vehicle) =>
          getVehicleId(vehicle) === vehicleId ? detail : vehicle,
        ),
      );
      setSelectedVehicle(detail);
      setSeatDraft(freshLayout);
      setOriginalSeatLayout(freshLayout);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      setSeatError(
        err instanceof Error ? err.message : t("vehicles.loadDetailFailed"),
      );
    } finally {
      if (!controller.signal.aborted) {
        setIsSeatDetailLoading(false);
      }
    }
  }

  function toggleSeat(seatNumber: string) {
    const currentLayout = parseVehicleSeatLayout(seatDraft);
    if (!currentLayout) {
      return;
    }

    setSeatDraft(toggleVehicleSeat(currentLayout, seatNumber));
    setSeatError("");
  }

  function cancelSeatEdit() {
    if (initialLayout) {
      setSeatDraft(initialLayout);
    }
    setSeatError("");
  }

  function changePanelMode(nextMode: VehiclePanelMode) {
    setPanelMode(nextMode);

    if (
      nextMode === "seats" &&
      canManageVehicles &&
      selectedVehicle &&
      !draftLayout
    ) {
      void loadSeatLayout(selectedVehicle);
    }
  }

  async function saveSeatLayout() {
    const vehicleId = selectedVehicle ? getVehicleId(selectedVehicle) : "";
    const nextLayout = parseVehicleSeatLayout(seatDraft);

    if (!vehicleId || !nextLayout || !isSeatDirty || isSeatSaving) {
      return;
    }

    setIsSeatSaving(true);
    setSeatError("");

    try {
      const updatedVehicle = await updateOperatorVehicle(vehicleId, {
        seatLayoutJson: nextLayout,
      });

      setVehicles((current) =>
        current.map((vehicle) =>
          getVehicleId(vehicle) === vehicleId ? updatedVehicle : vehicle,
        ),
      );
      setSelectedVehicle(updatedVehicle);
      setSeatDraft(updatedVehicle.seatLayoutJson);
      setOriginalSeatLayout(updatedVehicle.seatLayoutJson);
      setMessage(
        t("vehicles.seatUpdateSuccess", {
          defaultValue:
            "Đã cập nhật trạng thái ghế. Trip tạo sau khi lưu sẽ dùng layout mới.",
        }),
      );
      invalidateTripResourcesCache(authUser?.id);
    } catch (err) {
      setSeatError(
        err instanceof Error
          ? err.message
          : t("vehicles.updateFailed", {
              defaultValue: "Không thể lưu thay đổi.",
            }),
      );
    } finally {
      setIsSeatSaving(false);
      setPendingSeatSave(false);
    }
  }

  function validateVehicleForm(mode: "create" | "edit") {
    const nextErrors: VehicleFormErrors = {};
    const requiredMessage = (label: string) => `${label}: ${tc("required")}`;
    const rangeMessage = (label: string, minimum: number, maximum: number) =>
      `${label}: ${minimum}–${maximum}`;
    const licensePlate = vehicleForm.licensePlate.trim();

    if (!licensePlate) {
      nextErrors.licensePlate = requiredMessage(t("vehicles.plate"));
    } else if (licensePlate.length > 20) {
      nextErrors.licensePlate = `${t("vehicles.plate")}: ≤ 20`;
    }

    if (
      !vehicleForm.vehicleTypeId ||
      !vehicleTypes.some(
        (vehicleType) => vehicleType.id === vehicleForm.vehicleTypeId,
      )
    ) {
      nextErrors.vehicleTypeId = requiredMessage(t("vehicles.vehicleType"));
    }

    const cargoWeight = Number(vehicleForm.maxCargoWeightKg);
    if (
      !vehicleForm.maxCargoWeightKg.trim() ||
      !Number.isFinite(cargoWeight) ||
      cargoWeight < 0
    ) {
      nextErrors.maxCargoWeightKg = `${t("vehicles.cargoWeight")}: ≥ 0`;
    }

    const cargoVolume = Number(vehicleForm.maxCargoVolumeM3);
    if (
      !vehicleForm.maxCargoVolumeM3.trim() ||
      !Number.isFinite(cargoVolume) ||
      cargoVolume < 0
    ) {
      nextErrors.maxCargoVolumeM3 = `${t("vehicles.cargoVolumeM3")}: ≥ 0`;
    }

    if (mode === "edit" && !isVehicleStatus(vehicleForm.status)) {
      nextErrors.status = requiredMessage(tc("status"));
    }

    if (mode === "create") {
      const layoutFields: Array<{
        key: "deckCount" | "rowsPerDeck" | "columnsPerRow";
        label: string;
        maximum: number;
      }> = [
        {
          key: "deckCount",
          label: t("vehicles.deckCount"),
          maximum: MAX_VEHICLE_DECKS,
        },
        {
          key: "rowsPerDeck",
          label: t("vehicles.rowsPerDeck"),
          maximum: MAX_ROWS_PER_DECK,
        },
        {
          key: "columnsPerRow",
          label: t("vehicles.columnsPerRow"),
          maximum: MAX_COLUMNS_PER_ROW,
        },
      ];

      layoutFields.forEach(({ key, label, maximum }) => {
        const value = Number(vehicleForm[key]);
        if (!Number.isInteger(value) || value < 1 || value > maximum) {
          nextErrors[key] = rangeMessage(label, 1, maximum);
        }
      });

      const columnsPerRow = Number(vehicleForm.columnsPerRow);
      const aisleAfterCol = Number(vehicleForm.aisleAfterCol);
      const maximumAisleColumn = Math.max(columnsPerRow - 1, 1);
      if (
        !Number.isInteger(aisleAfterCol) ||
        aisleAfterCol < 1 ||
        aisleAfterCol > maximumAisleColumn
      ) {
        nextErrors.aisleAfterCol = rangeMessage(
          t("vehicles.aisleAfterCol"),
          1,
          Number.isFinite(maximumAisleColumn) ? maximumAisleColumn : 1,
        );
      }

      const totalSeats = Number(vehicleForm.totalSeats);
      const layoutCapacity =
        Number(vehicleForm.deckCount) *
        Number(vehicleForm.rowsPerDeck) *
        columnsPerRow;
      if (
        !Number.isInteger(totalSeats) ||
        totalSeats < 1 ||
        totalSeats > MAX_VEHICLE_SEATS ||
        totalSeats > layoutCapacity
      ) {
        nextErrors.totalSeats = rangeMessage(
          t("vehicles.capacitySeats"),
          1,
          MAX_VEHICLE_SEATS,
        );
      }

      const seatPrefix = vehicleForm.seatPrefix.trim();
      if (!seatPrefix || seatPrefix.length > 4) {
        nextErrors.seatPrefix = `${t("vehicles.seatPrefix")}: 1–4`;
      }
    }

    setFieldErrors(nextErrors);
    setFormError(Object.values(nextErrors).find(Boolean) ?? "");
    return Object.keys(nextErrors).length === 0;
  }

  function getVehicleImageErrorMessage(uploadError: unknown) {
    if (uploadError instanceof VehicleImageError) {
      const translationKeys: Record<VehicleImageErrorCode, string> = {
        INVALID_TYPE: "vehicles.invalidImageType",
        INVALID_SIZE: "vehicles.invalidImageSize",
        MISSING_OPERATOR_ID: "vehicles.missingOperatorId",
        MISSING_TOKEN: "vehicles.missingFirebaseToken",
        MISSING_UPLOAD_PATH: "vehicles.uploadFailed",
        TOO_MANY_IMAGES: "vehicles.tooManyImages",
      };

      return t(translationKeys[uploadError.code]);
    }

    return uploadError instanceof Error
      ? uploadError.message
      : t("vehicles.uploadFailed");
  }

  function handleVehicleImageError(uploadError: unknown) {
    setFormError(getVehicleImageErrorMessage(uploadError));
  }

  function handleVehicleSubmitError(submitError: unknown) {
    if (
      submitError instanceof ApiRequestError &&
      submitError.fields.length > 0
    ) {
      const fieldMap: Record<string, keyof VehicleForm> = {
        licenseplate: "licensePlate",
        vehicletypeid: "vehicleTypeId",
        totalSeats: "totalSeats",
        totalseats: "totalSeats",
        maxcargoweightkg: "maxCargoWeightKg",
        maxcargovolumem3: "maxCargoVolumeM3",
        status: "status",
      };
      const nextErrors: VehicleFormErrors = {};
      submitError.fields.forEach((field) => {
        const normalized = field.field
          ?.replace(/[^a-zA-Z0-9]/g, "")
          .toLowerCase();
        const key = normalized ? fieldMap[normalized] : undefined;
        if (key && field.message) {
          nextErrors[key] = field.message;
        }
      });

      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        setFormError(
          Object.values(nextErrors).find(Boolean) ?? submitError.message,
        );
        return;
      }
    }

    handleVehicleImageError(submitError);
  }

  function updateVehicleImageFiles(files: File[]) {
    setVehicleImageFiles(files);
    setFormError("");
  }

  async function prepareVehicleImageUrls() {
    const existingImageUrls = getUniquePublicImageUrls(
      getImageEntries(vehicleForm.imageUrls),
    );

    validateVehicleImageFiles(vehicleImageFiles, existingImageUrls.length);

    if (vehicleImageFiles.length === 0) {
      return existingImageUrls;
    }

    const operatorId =
      authUser?.operatorId ||
      selectedVehicle?.operatorId ||
      vehicles[0]?.operatorId ||
      "";
    const uploadedImageUrls = await uploadVehicleImages(
      operatorId,
      vehicleImageFiles,
    );

    return getUniquePublicImageUrls([
      ...existingImageUrls,
      ...uploadedImageUrls,
    ]);
  }

  async function handleCreateVehicle(seatLayoutJson?: SeatLayoutJson) {
    if (isSaving) {
      return;
    }

    if (!validateVehicleForm("create")) {
      return;
    }

    setIsSaving(true);
    setFormError("");
    setMessage("");

    try {
      const imageUrls = await prepareVehicleImageUrls();
      await createOperatorVehicle(
        toVehicleCreateRequest(
          vehicleForm,
          vehicleTypes,
          imageUrls,
          seatLayoutJson,
        ),
      );
      setMessage(t("vehicles.createSuccess"));
      setVehicleImageFiles([]);
      closeVehiclePanel();

      const shouldResetQuery = page !== 1 || querySearch.length > 0;
      setSearch("");
      if (shouldResetQuery) {
        setSearchParams(
          (current) => {
            const next = new URLSearchParams(current);
            next.delete("search");
            next.set("page", "1");
            return next;
          },
          { replace: true },
        );
      } else {
        await loadVehicles();
      }
    } catch (submitError) {
      handleVehicleSubmitError(submitError);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateVehicle() {
    if (!selectedVehicle) {
      return;
    }

    const vehicleId = getVehicleId(selectedVehicle);

    if (!vehicleId) {
      setFormError(t("vehicles.missingVehicleForUpdate"));
      return;
    }

    if (isSaving) {
      return;
    }

    if (!validateVehicleForm("edit")) {
      return;
    }

    setIsSaving(true);
    setFormError("");
    setMessage("");

    try {
      const imageUrls = await prepareVehicleImageUrls();
      const updateRequest = toVehicleUpdateRequest(
        vehicleForm,
        selectedVehicle,
        imageUrls,
      );

      const updatedVehicle =
        Object.keys(updateRequest).length > 0
          ? await updateOperatorVehicle(vehicleId, updateRequest)
          : selectedVehicle;

      setVehicles((current) =>
        current.map((vehicle) =>
          getVehicleId(vehicle) === vehicleId ? updatedVehicle : vehicle,
        ),
      );
      setSelectedVehicle(updatedVehicle);
      invalidateTripResourcesCache(authUser?.id);

      setMessage(t("vehicles.updateSuccess"));
      setVehicleImageFiles([]);
      setOpenEdit(false);
      setVehicleFormBaseline(vehicleForm);
      await loadVehicles();
    } catch (submitError) {
      handleVehicleSubmitError(submitError);
    } finally {
      setIsSaving(false);
    }
  }

  const vehicleToolbar = (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_240px] lg:items-center">
          <div className="relative min-w-0">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              name="vehicleSearch"
              className={`${inputClass} pl-10`}
              placeholder={`${tc("search")}: ${t("vehicles.plate")}`}
              aria-label={`${tc("search")}: ${t("vehicles.plate")}`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <CustomSelect
            value={queryStatus}
            onChange={(event) =>
              setSearchParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  if (event.target.value) next.set("status", event.target.value);
                  else next.delete("status");
                  next.set("page", "1");
                  return next;
                },
                { replace: true },
              )
            }
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700"
            aria-label={tc("status")}
          >
            <option value="">{tc("all")}</option>
            <option value="ACTIVE">{t("vehicles.statusActive")}</option>
            <option value="MAINTENANCE">{t("vehicles.statusMaintenance")}</option>
            <option value="OFF_DUTY">{t("vehicles.inactive")}</option>
            <option value="RETIRED">{tc("enumLabels.RETIRED", { defaultValue: "RETIRED" })}</option>
          </CustomSelect>
          <CustomSelect
            value={queryVehicleTypeId}
            onChange={(event) =>
              setSearchParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  if (event.target.value) next.set("vehicleTypeId", event.target.value);
                  else next.delete("vehicleTypeId");
                  next.set("page", "1");
                  return next;
                },
                { replace: true },
              )
            }
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700"
            aria-label={t("vehicles.vehicleType")}
          >
            <option value="">{t("vehicles.vehicleType")}: {tc("all")}</option>
            {vehicleTypes.map((vehicleType) => (
              <option key={vehicleType.id} value={vehicleType.id}>
                {vehicleType.displayName}
              </option>
            ))}
          </CustomSelect>
        </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("vehicles.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {t("vehicles.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadVehicles}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FiRefreshCw size={16} />
            {tc("refresh")}
          </button>
          {canManageVehicles && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-slate-50 font-bold rounded-lg transition flex items-center gap-2"
            >
              <FiPlus size={18} />
              {t("vehicles.add")}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("vehicles.total")} value={total} icon={<FiTruck size={20} />} iconClassName="bg-vr-50 text-vr-700" />
        <StatCard label={t("vehicles.active")} value={activeCount} icon={<FiCheckCircle size={20} />} iconClassName="bg-emerald-50 text-emerald-700" />
        <StatCard label={t("vehicles.statusMaintenance")} value={maintenanceCount} icon={<FiAlertTriangle size={20} />} iconClassName="bg-amber-50 text-amber-700" />
        <StatCard label={t("vehicles.inactive")} value={inactiveCount} icon={<FiPauseCircle size={20} />} iconClassName="bg-slate-100 text-slate-700" />
      </div>

      <VehicleTable
        toolbar={vehicleToolbar}
        vehicles={vehicles}
        vehicleTypes={vehicleTypes}
        isLoading={isLoading}
        search={querySearch}
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={(nextPage) =>
          setSearchParams(
            (current) => {
              const next = new URLSearchParams(current);
              next.set("page", String(nextPage));
              return next;
            },
            { replace: true },
          )
        }
        onOpenPanel={openVehiclePanel}
      />

      {(openReg || selectedVehicle) && (
        <VehicleDetailsPanel
          vehicle={selectedVehicle}
          vehicleTypes={vehicleTypes}
          mode={panelMode}
          isCreate={openReg}
          isInfoEditing={openEdit}
          canManageVehicles={canManageVehicles}
          form={vehicleForm}
          formError={formError}
          fieldErrors={fieldErrors}
          imageFiles={vehicleImageFiles}
          isInfoSaving={isSaving}
          isInfoDirty={isInfoDirty}
          isSeatLoading={isSeatDetailLoading}
          isSeatSaving={isSeatSaving}
          seatLayout={draftLayout ?? selectedLayout}
          originalSeatLayout={initialLayout}
          isSeatDirty={isSeatDirty}
          seatChangeCount={countSeatChanges(draftLayout, initialLayout)}
          discardPrompt={discardPrompt}
          onModeChange={changePanelMode}
          onCloseRequest={requestCloseVehiclePanel}
          onDiscardAndClose={discardAndCloseVehiclePanel}
          onKeepEditing={() => setDiscardPrompt(false)}
          onEditInfo={() => {
            if (selectedVehicle) {
              openEditModal(selectedVehicle);
            }
          }}
          onCancelInfo={cancelInfoEdit}
          onSubmitInfo={handleUpdateVehicle}
          onSubmitCreate={handleCreateVehicle}
          onValidateCreateInfo={() => validateVehicleForm("create")}
          onChange={updateVehicleForm}
          onImageFilesChange={updateVehicleImageFiles}
          onImageError={handleVehicleImageError}
          onToggleSeat={toggleSeat}
          onResetSeats={cancelSeatEdit}
          onSaveSeats={() => setPendingSeatSave(true)}
        />
      )}
      <ConfirmModal
        open={pendingSeatSave}
        onClose={() => setPendingSeatSave(false)}
        onConfirm={() => void saveSeatLayout()}
        title={tc("confirm")}
        message={t("vehicles.seatSaveConfirm")}
        confirmLabel={tc("confirm")}
        cancelLabel={tc("cancel")}
        tone="warning"
        busy={isSeatSaving}
      />
    </div>
  );
}


