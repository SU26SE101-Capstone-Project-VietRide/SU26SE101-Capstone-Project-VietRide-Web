import { useTranslation } from "react-i18next";
import { FiEdit2, FiInfo, FiX } from "react-icons/fi";
import { DetailItem } from "../../../components/DetailLayout";
import type {
  OperatorVehicle,
  SeatLayoutJson,
  VehicleType,
} from "../../../api/vietride";
import { VehicleImage } from "./VehicleImage";
import {
  getVehiclePhotos,
  getVehicleTypeLabel,
  vehiclePlaceholder,
} from "./vehicleForm";
import { getVehicleSeatStats } from "./vehicleSeatHelpers";
import { VehicleSeatLayout } from "./VehicleSeatLayout";

export type VehiclePanelMode = "info" | "seats";

type VehicleDetailsPanelProps = {
  vehicle: OperatorVehicle;
  vehicleTypes: VehicleType[];
  mode: VehiclePanelMode;
  canManageSeats: boolean;
  isEditingSeats: boolean;
  layout: SeatLayoutJson | null;
  isLoadingSeats: boolean;
  isSavingSeats: boolean;
  isDirty: boolean;
  error: string;
  discardPrompt: boolean;
  onModeChange: (mode: VehiclePanelMode) => void;
  onCloseRequest: () => void;
  onDiscardAndClose: () => void;
  onKeepEditing: () => void;
  onEditInfo: () => void;
  onStartSeatEdit: () => void;
  onToggleSeat: (seatNumber: string) => void;
  onSaveSeats: () => void;
  onCancelSeatEdit: () => void;
};

function StatCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" | "success" }) {
  const toneClass = {
    default: "border-gray-200 bg-gray-50 text-gray-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tone];

  return (
    <div className={`rounded-xl border px-3 py-3 ${toneClass}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] opacity-70">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function VehicleDetailsPanel({
  vehicle,
  vehicleTypes,
  mode,
  canManageSeats,
  isEditingSeats,
  layout,
  isLoadingSeats,
  isSavingSeats,
  isDirty,
  error,
  discardPrompt,
  onModeChange,
  onCloseRequest,
  onDiscardAndClose,
  onKeepEditing,
  onEditInfo,
  onStartSeatEdit,
  onToggleSeat,
  onSaveSeats,
  onCancelSeatEdit,
}: VehicleDetailsPanelProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const photos = getVehiclePhotos(vehicle);
  const stats = getVehicleSeatStats(layout, vehicle.totalSeats);
  const activeSeatLabel = `${stats.activePassengerSeats}/${stats.passengerSeats}`;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[1px] disabled:cursor-wait disabled:opacity-80"
        aria-label={tc("close")}
        disabled={isSavingSeats}
        onClick={onCloseRequest}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col border-l border-gray-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-details-title"
      >
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-vr-600">
              {t("vehicles.detailEyebrow", { defaultValue: "Phương tiện" })}
            </p>
            <h2 id="vehicle-details-title" className="mt-1 truncate text-xl font-bold text-gray-900">
              {vehicle.licensePlate}
            </h2>
            <p className="mt-1 truncate text-sm text-gray-500">
              {getVehicleTypeLabel(vehicle, vehicleTypes)}
            </p>
          </div>
          <button
            type="button"
            onClick={onCloseRequest}
            disabled={isSavingSeats}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-vr-500/40 disabled:cursor-wait disabled:opacity-50"
            aria-label={tc("close")}
          >
            <FiX size={19} />
          </button>
        </header>

        <div className="flex border-b border-gray-100 px-5 sm:px-7">
          <button
            type="button"
            onClick={() => onModeChange("info")}
            className={`border-b-2 px-1 py-3 text-sm font-semibold transition ${mode === "info" ? "border-vr-500 text-vr-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}
          >
            <span className="inline-flex items-center gap-2">
              <FiInfo size={16} />
              {t("vehicles.infoTab", { defaultValue: "Thông tin xe" })}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange("seats")}
            className={`ml-6 border-b-2 px-1 py-3 text-sm font-semibold transition ${mode === "seats" ? "border-vr-500 text-vr-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}
          >
            {t("vehicles.seatsTab", { defaultValue: "Sức chứa & ghế" })}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          {mode === "info" ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <VehicleImage
                  src={photos[0]?.src ?? vehiclePlaceholder.src}
                  alt={photos[0]?.alt ?? vehicle.licensePlate}
                  width={900}
                  height={600}
                  containerClassName="h-56 w-full rounded-xl border border-gray-200"
                  loading="eager"
                  loadingLabel={t("vehicles.imageLoading")}
                  errorLabel={t("vehicles.imageLoadFailed")}
                />
                <div className="grid grid-cols-2 gap-3">
                  {photos.slice(1, 5).map((photo) => (
                    <VehicleImage
                      key={photo.src}
                      src={photo.src}
                      alt={photo.alt}
                      width={450}
                      height={280}
                      containerClassName="h-[106px] w-full rounded-xl border border-gray-200"
                      loadingLabel={t("vehicles.imageLoading")}
                      errorLabel={t("vehicles.imageLoadFailed")}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem label={t("vehicles.plate")} value={vehicle.licensePlate} />
                <DetailItem
                  label={t("vehicles.vehicleType")}
                  value={getVehicleTypeLabel(vehicle, vehicleTypes)}
                />
                <DetailItem label={t("vehicles.seatCount")} value={activeSeatLabel} />
                <DetailItem
                  label={tc("status")}
                  value={tc(`enumLabels.${vehicle.status}`, {
                    defaultValue: vehicle.status,
                  })}
                />
                <DetailItem label={t("vehicles.cargoWeight")} value={`${vehicle.maxCargoWeightKg} kg`} />
                <DetailItem label={t("vehicles.cargoVolume")} value={`${vehicle.maxCargoVolumeM3 ?? 0} m³`} />
              </div>

              {canManageSeats && !isEditingSeats && (
                <button
                  type="button"
                  onClick={onEditInfo}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700 focus:outline-none focus:ring-2 focus:ring-vr-500/40"
                >
                  <FiEdit2 size={16} />
                  {tc("edit")}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <StatCard
                  label={t("vehicles.activeSeats", { defaultValue: "Đang hoạt động" })}
                  value={String(stats.activePassengerSeats)}
                  tone="success"
                />
                <StatCard
                  label={t("vehicles.disabledSeats", { defaultValue: "Đã khóa" })}
                  value={String(stats.disabledPassengerSeats)}
                  tone={stats.disabledPassengerSeats > 0 ? "warning" : "default"}
                />
                <StatCard
                  label={t("vehicles.passengerSeats", { defaultValue: "Tổng ghế khách" })}
                  value={String(stats.passengerSeats)}
                />
                <StatCard
                  label={t("vehicles.driverAreas", { defaultValue: "Khu tài xế" })}
                  value={String(stats.driverAreas)}
                />
                <StatCard
                  label={t("vehicles.physicalPositions", { defaultValue: "Vị trí vật lý" })}
                  value={String(stats.totalPositions)}
                />
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">
                    {isEditingSeats
                      ? t("vehicles.seatEditHint", { defaultValue: "Chọn ghế để khóa hoặc mở lại." })
                      : t("vehicles.futureTripHint", { defaultValue: "Ghế khóa chỉ áp dụng cho Trip được tạo sau khi lưu." })}
                  </p>
                  <p className="mt-1 text-xs text-amber-800/80">
                    {t("vehicles.existingTripHint", {
                      defaultValue: "Trip đã tồn tại, kể cả chưa khởi hành, giữ nguyên sơ đồ hiện tại.",
                    })}
                  </p>
                </div>
                {canManageSeats && !isEditingSeats && (
                  <button
                    type="button"
                    onClick={onStartSeatEdit}
                    disabled={isLoadingSeats}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-vr-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-vr-600 disabled:cursor-wait disabled:opacity-60"
                  >
                    <FiEdit2 size={15} />
                    {t("vehicles.manageSeats", { defaultValue: "Quản lý ghế" })}
                  </button>
                )}
              </div>

              {isLoadingSeats ? (
                <div className="space-y-3" aria-live="polite">
                  <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
                  <div className="h-52 animate-pulse rounded-xl bg-gray-100" />
                </div>
              ) : (
                <VehicleSeatLayout
                  layout={layout}
                  editable={isEditingSeats && canManageSeats}
                  disabled={isSavingSeats}
                  onToggle={onToggleSeat}
                />
              )}

              {!isLoadingSeats && isEditingSeats && canManageSeats && (
                <div className="sticky bottom-0 flex flex-col gap-3 border-t border-gray-100 bg-white/95 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-gray-500">
                    {isDirty
                      ? t("vehicles.unsavedSeatChanges", { defaultValue: "Bạn có thay đổi chưa lưu." })
                      : t("vehicles.noSeatChanges", { defaultValue: "Chưa có thay đổi." })}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onCancelSeatEdit}
                      disabled={isSavingSeats}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {tc("cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={onSaveSeats}
                      disabled={!isDirty || isSavingSeats}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingSeats && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                      {isSavingSeats ? t("vehicles.saving") : tc("save")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {discardPrompt && (
          <div className="border-t border-amber-200 bg-amber-50 px-5 py-4 sm:px-7" role="alertdialog" aria-label={t("vehicles.discardSeatChanges", { defaultValue: "Bỏ thay đổi ghế?" })}>
            <p className="text-sm font-semibold text-amber-900">
              {t("vehicles.discardSeatChanges", { defaultValue: "Bỏ thay đổi ghế?" })}
            </p>
            <p className="mt-1 text-xs text-amber-800">
              {t("vehicles.discardSeatChangesHint", { defaultValue: "Các lựa chọn chưa lưu sẽ bị mất." })}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={onKeepEditing}
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
              >
                {t("vehicles.keepEditing", { defaultValue: "Tiếp tục chỉnh sửa" })}
              </button>
              <button
                type="button"
                onClick={onDiscardAndClose}
                className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800"
              >
                {t("vehicles.discardChanges", { defaultValue: "Bỏ thay đổi" })}
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
