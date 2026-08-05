import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  FiEdit2,
  FiEye,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTool,
  FiTruck,
} from "react-icons/fi";
import Pagination from "../../../components/Pagination";
import { getAuthUser } from "../../../auth";
import {
  createOperatorVehicle,
  getOperatorVehicle,
  getOperatorVehicles,
  getVehicleTypes,
  updateOperatorVehicle,
  type OperatorVehicle,
  type VehicleType,
} from "../../../api/vietride";
import {
  uploadVehicleImages,
  validateVehicleImageFiles,
  VehicleImageError,
  type VehicleImageErrorCode,
} from "./vehicleImageUpload";
import { VehicleImage } from "./VehicleImage";
import VehicleModal from "./VehicleModal";
import VehicleDetailModal from "./VehicleDetailModal";
import {
  emptyVehicleForm,
  getImageEntries,
  getLayoutShape,
  getUniquePublicImageUrls,
  getVehicleId,
  getVehiclePhoto,
  getVehicleTypeLabel,
  inputClass,
  toVehicleRequest,
  type VehicleForm,
} from "./vehicleForm";

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
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [openReg, setOpenReg] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [vehicles, setVehicles] = useState<OperatorVehicle[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [selectedVehicle, setSelectedVehicle] =
    useState<OperatorVehicle | null>(null);
  const [detailVehicle, setDetailVehicle] = useState<OperatorVehicle | null>(
    null,
  );
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicleForm);
  const [vehicleImageFiles, setVehicleImageFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 8;

  // Debounce ô tìm kiếm để tránh mỗi ký tự bắn một request (pattern giống Bookings)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  // Hàm tải danh sách xe dùng chung cho effect, nút Refresh và sau create/update
  const loadVehicles = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const vehicleResult = await getOperatorVehicles({
        page,
        pageSize,
        search: debouncedSearch,
      });

      setVehicles(vehicleResult.items);
      setTotalItems(vehicleResult.totalItems);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tRef.current("vehicles.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    async function run() {
      await loadVehicles();
    }

    void run();
  }, [loadVehicles]);

  // Danh mục loại xe là dữ liệu tĩnh — chỉ tải một lần lúc mount
  useEffect(() => {
    let ignore = false;

    async function loadTypes() {
      try {
        const typeResult = await getVehicleTypes({ page: 1, pageSize: 50 });

        if (ignore) {
          return;
        }

        setVehicleTypes(typeResult.items);

        if (typeResult.items[0]) {
          const defaultSeatCount = typeResult.items[0].defaultSeatCount || 40;

          setVehicleForm((prev) => ({
            ...prev,
            vehicleTypeId: prev.vehicleTypeId || typeResult.items[0].id,
            totalSeats: prev.totalSeats || String(defaultSeatCount),
            rowsPerDeck:
              prev.rowsPerDeck ||
              String(Math.max(1, Math.ceil(defaultSeatCount / 4))),
          }));
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : tRef.current("vehicles.loadFailed"),
          );
        }
      }
    }

    void loadTypes();

    return () => {
      ignore = true;
    };
  }, []);

  const total = vehicles.length;
  const active = vehicles.filter(
    (vehicle) => vehicle.status === "ACTIVE",
  ).length;
  const maint = vehicles.filter(
    (vehicle) => vehicle.status === "MAINTENANCE",
  ).length;

  function updateVehicleForm(key: keyof VehicleForm, value: string) {
    setVehicleForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreateModal() {
    setSelectedVehicle(null);
    setVehicleImageFiles([]);
    setError("");
    setVehicleForm((prev) => ({
      ...emptyVehicleForm,
      vehicleTypeId: prev.vehicleTypeId || vehicleTypes[0]?.id || "",
    }));
    setOpenReg(true);
  }

  function openEditModal(vehicle: OperatorVehicle) {
    const layoutShape = getLayoutShape(vehicle);

    setSelectedVehicle(vehicle);
    setVehicleImageFiles([]);
    setError("");
    setVehicleForm({
      vehicleTypeId: vehicle.vehicleTypeId,
      licensePlate: vehicle.licensePlate,
      totalSeats: String(vehicle.totalSeats),
      maxCargoWeightKg: String(vehicle.maxCargoWeightKg),
      maxCargoVolumeM3: String(vehicle.maxCargoVolumeM3 ?? 5),
      imageUrls: vehicle.imageUrls?.join("\n") ?? "",
      status: vehicle.status,
      deckCount: layoutShape.deckCount,
      rowsPerDeck: layoutShape.rowsPerDeck,
      columnsPerRow: layoutShape.columnsPerRow,
      aisleAfterCol: "2",
      seatPrefix: "A",
    });
    setOpenEdit(true);
  }

  async function openDetailModal(vehicle: OperatorVehicle) {
    const vehicleId = getVehicleId(vehicle);

    if (!vehicleId) {
      setError(t("vehicles.missingVehicleForDetail"));
      return;
    }

    setOpenDetail(true);
    setIsDetailLoading(true);
    setError("");

    try {
      const detail = await getOperatorVehicle(vehicleId);
      setDetailVehicle(detail);
    } catch (err) {
      setOpenDetail(false);
      setError(
        err instanceof Error ? err.message : t("vehicles.loadDetailFailed"),
      );
    } finally {
      setIsDetailLoading(false);
    }
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
    setError(getVehicleImageErrorMessage(uploadError));
  }

  function updateVehicleImageFiles(files: File[]) {
    setVehicleImageFiles(files);
    setError("");
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

  async function handleCreateVehicle() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const imageUrls = await prepareVehicleImageUrls();
      await createOperatorVehicle(
        toVehicleRequest(vehicleForm, vehicleTypes, imageUrls),
      );
      setMessage(t("vehicles.createSuccess"));
      setVehicleImageFiles([]);
      setOpenReg(false);
      await loadVehicles();
    } catch (submitError) {
      handleVehicleImageError(submitError);
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
      setError(t("vehicles.missingVehicleForUpdate"));
      return;
    }

    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const imageUrls = await prepareVehicleImageUrls();
      await updateOperatorVehicle(
        vehicleId,
        toVehicleRequest(vehicleForm, vehicleTypes, imageUrls),
      );
      setMessage(t("vehicles.updateSuccess"));
      setVehicleImageFiles([]);
      setOpenEdit(false);
      await loadVehicles();
    } catch (submitError) {
      handleVehicleImageError(submitError);
    } finally {
      setIsSaving(false);
    }
  }

  function vehicleStatusBadge(status: string) {
    const map = {
      ACTIVE: {
        bg: "bg-emerald-50",
        dot: "bg-emerald-500",
        text: "text-emerald-800",
        label: t("vehicles.statusActive"),
      },
      MAINTENANCE: {
        bg: "bg-amber-50",
        dot: "bg-amber-500",
        text: "text-amber-800",
        label: t("vehicles.statusMaintenance"),
      },
      INACTIVE: {
        bg: "bg-gray-100",
        dot: "bg-gray-400",
        text: "text-gray-700",
        label: t("vehicles.inactive"),
      },
    }[status] ?? {
      bg: "bg-gray-100",
      dot: "bg-gray-400",
      text: "text-gray-700",
      label: status,
    };

    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${map.bg} ${map.text}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${map.dot}`} />
        {map.label}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("vehicles.title")}
          </h1>
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

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label={t("vehicles.total")}
          value={total}
          icon={<FiTruck size={20} />}
        />
        <MetricCard
          label={t("vehicles.active")}
          value={active}
          icon={<FiShield size={20} />}
        />
        <MetricCard
          label={t("vehicles.maintenance")}
          value={maint}
          icon={<FiTool size={20} />}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className={inputClass + " pl-10"}
              placeholder={t("vehicles.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">{t("vehicles.photo")}</th>
                <th className="px-5 py-3">{t("vehicles.plate")}</th>
                <th className="px-5 py-3">{t("vehicles.model")}</th>
                <th className="px-5 py-3">{t("vehicles.capacity")}</th>
                <th className="px-5 py-3">{t("vehicles.cargoKg")}</th>
                <th className="px-5 py-3">{tc("status")}</th>
                <th className="px-5 py-3">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr
                  key={getVehicleId(vehicle) || vehicle.licensePlate}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-5 py-4">
                    <VehicleImage
                      src={getVehiclePhoto(vehicle).src}
                      alt={getVehiclePhoto(vehicle).alt}
                      width={96}
                      height={64}
                      containerClassName="h-16 w-24 rounded-lg border border-gray-200"
                      loadingLabel={t("vehicles.imageLoading")}
                      errorLabel={t("vehicles.imageLoadFailed")}
                    />
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                    {vehicle.licensePlate}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {getVehicleTypeLabel(vehicle, vehicleTypes)}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {vehicle.totalSeats}
                    {t("vehicles.seats")}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {vehicle.maxCargoWeightKg}
                  </td>
                  <td className="px-5 py-4">
                    {vehicleStatusBadge(vehicle.status)}
                  </td>
                  <td className="px-5 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openDetailModal(vehicle)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700"
                        title={t("vehicles.viewDetail")}
                        aria-label={t("vehicles.viewDetail")}
                      >
                        <FiEye size={16} />
                      </button>
                      {canManageVehicles && (
                        <button
                          type="button"
                          onClick={() => openEditModal(vehicle)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          title={tc("edit")}
                          aria-label={tc("edit")}
                        >
                          <FiEdit2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading && (
          <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-500">
            {t("vehicles.loading")}
          </div>
        )}
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
        />
      </div>

      <VehicleModal
        open={openReg}
        title={t("vehicles.registerTitle")}
        vehicleTypes={vehicleTypes}
        form={vehicleForm}
        imageFiles={vehicleImageFiles}
        onChange={updateVehicleForm}
        onImageFilesChange={updateVehicleImageFiles}
        onImageError={handleVehicleImageError}
        onClose={() => setOpenReg(false)}
        onSubmit={handleCreateVehicle}
        isSubmitting={isSaving}
        submitLabel={t("vehicles.register")}
      />

      <VehicleModal
        open={openEdit}
        title={t("vehicles.editTitle")}
        vehicleTypes={vehicleTypes}
        form={vehicleForm}
        imageFiles={vehicleImageFiles}
        onChange={updateVehicleForm}
        onImageFilesChange={updateVehicleImageFiles}
        onImageError={handleVehicleImageError}
        onClose={() => setOpenEdit(false)}
        onSubmit={handleUpdateVehicle}
        isSubmitting={isSaving}
        submitLabel={t("vehicles.saveChanges")}
      />

      <VehicleDetailModal
        open={openDetail}
        vehicle={detailVehicle}
        vehicleTypes={vehicleTypes}
        isLoading={isDetailLoading}
        onClose={() => setOpenDetail(false)}
      />
    </div>
  );
}

// Sub-component nhỏ (≤ 50 dòng) chỉ màn này dùng — được phép inline sau component page
type MetricCardProps = { label: string; value: number; icon: ReactNode };

function MetricCard({ label, value, icon }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
          {icon}
        </div>
      </div>
    </div>
  );
}
