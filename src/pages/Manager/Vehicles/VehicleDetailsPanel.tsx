import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiArrowLeft, FiArrowRight, FiEdit2, FiInfo, FiSave, FiX } from "react-icons/fi";
import type {
  OperatorVehicle,
  SeatLayoutJson,
  VehicleSeatType,
  VehicleType,
} from "../../../api/vietride";
import { DetailItem } from "../../../components/DetailLayout";
import { labelClass } from "../../../components/form/formClasses";
import { VehicleImage } from "./VehicleImage";
import { VehicleInfoForm } from "./VehicleModal";
import { VehicleSeatLayout } from "./VehicleSeatLayout";
import {
  createSeatLayoutPreview,
  getVehiclePhotos,
  getVehicleTypeLabel,
  inputClass,
  MAX_COLUMNS_PER_ROW,
  MAX_ROWS_PER_DECK,
  MAX_VEHICLE_DECKS,
  vehiclePlaceholder,
  type VehicleForm,
  type VehicleFormErrors,
} from "./vehicleForm";
import {
  getVehicleSeatStats,
  parseVehicleSeatLayout,
  setVehicleSeatType,
} from "./vehicleSeatHelpers";

export type VehiclePanelMode = "info" | "seats";

type VehicleDetailsPanelProps = {
  vehicle: OperatorVehicle | null;
  vehicleTypes: VehicleType[];
  mode: VehiclePanelMode;
  isCreate: boolean;
  isInfoEditing: boolean;
  canManageVehicles: boolean;
  form: VehicleForm;
  formError: string;
  fieldErrors: VehicleFormErrors;
  imageFiles: File[];
  isInfoSaving: boolean;
  isInfoDirty: boolean;
  isSeatLoading: boolean;
  isSeatSaving: boolean;
  seatLayout: SeatLayoutJson | null;
  originalSeatLayout: SeatLayoutJson | null;
  isSeatDirty: boolean;
  seatChangeCount: number;
  seatError: string;
  discardPrompt: boolean;
  onModeChange: (mode: VehiclePanelMode) => void;
  onCloseRequest: () => void;
  onDiscardAndClose: () => void;
  onKeepEditing: () => void;
  onEditInfo: () => void;
  onCancelInfo: () => void;
  onSubmitInfo: () => void | Promise<void>;
  onSubmitCreate: (layout: SeatLayoutJson) => void | Promise<void>;
  onValidateCreateInfo: () => boolean;
  onChange: (key: keyof VehicleForm, value: string) => void;
  onImageFilesChange: (files: File[]) => void;
  onImageError: (error: unknown) => void;
  onToggleSeat: (seatNumber: string) => void;
  onResetSeats: () => void;
  onSaveSeats: () => void | Promise<void>;
};

function StatBadge({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "slate" }) {
  const toneClass = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    slate: "border-slate-200 bg-slate-50 text-slate-900",
  }[tone];

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function SeatGeometryFields({
  form,
  fieldErrors,
  onChange,
}: {
  form: VehicleForm;
  fieldErrors: VehicleFormErrors;
  onChange: (key: keyof VehicleForm, value: string) => void;
}) {
  const { t } = useTranslation("manager");
  const fields: Array<{
    key: "deckCount" | "rowsPerDeck" | "columnsPerRow" | "aisleAfterCol" | "seatPrefix";
    id: string;
    label: string;
    type: "number" | "text";
    min?: number;
    max?: number;
  }> = [
    { key: "deckCount", id: "vehicle-deck-count", label: t("vehicles.deckCount"), type: "number", min: 1, max: MAX_VEHICLE_DECKS },
    { key: "rowsPerDeck", id: "vehicle-row-count", label: t("vehicles.rowsPerDeck"), type: "number", min: 1, max: MAX_ROWS_PER_DECK },
    { key: "columnsPerRow", id: "vehicle-column-count", label: t("vehicles.columnsPerRow"), type: "number", min: 1, max: MAX_COLUMNS_PER_ROW },
    { key: "aisleAfterCol", id: "vehicle-aisle-column", label: t("vehicles.aisleAfterCol"), type: "number", min: 1, max: Math.max(Number(form.columnsPerRow) - 1, 1) },
    { key: "seatPrefix", id: "vehicle-seat-prefix", label: t("vehicles.seatPrefix"), type: "text" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {fields.map((field) => (
        <div key={field.key}>
          <label className={labelClass} htmlFor={field.id}>{field.label}</label>
          <input
            id={field.id}
            className={`${inputClass} ${fieldErrors[field.key] ? "border-red-300 focus:border-red-500" : ""}`}
            type={field.type}
            min={field.min}
            max={field.max}
            value={form[field.key]}
            onChange={(event) => onChange(field.key, event.target.value)}
            aria-invalid={Boolean(fieldErrors[field.key])}
          />
          {fieldErrors[field.key] && <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors[field.key]}</p>}
        </div>
      ))}
    </div>
  );
}

function VehicleInfoSummary({
  vehicle,
  vehicleTypes,
  onEdit,
}: {
  vehicle: OperatorVehicle;
  vehicleTypes: VehicleType[];
  onEdit: () => void;
}) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const photos = getVehiclePhotos(vehicle);
  const stats = getVehicleSeatStats(
    parseVehicleSeatLayout(vehicle.seatLayoutJson),
    vehicle.totalSeats,
  );

  return (
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
        <DetailItem label={t("vehicles.vehicleType")} value={getVehicleTypeLabel(vehicle, vehicleTypes)} />
        <DetailItem label={t("vehicles.seatCount")} value={`${stats.activePassengerSeats}/${stats.passengerSeats}`} />
        <DetailItem label={tc("status")} value={tc(`enumLabels.${vehicle.status}`, { defaultValue: vehicle.status })} />
        <DetailItem label={t("vehicles.cargoWeight")} value={`${vehicle.maxCargoWeightKg} kg`} />
        <DetailItem label={t("vehicles.cargoVolume")} value={`${vehicle.maxCargoVolumeM3 ?? 0} m³`} />
      </div>

      <button type="button" onClick={onEdit} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700 focus:outline-none focus:ring-2 focus:ring-vr-500/40">
        <FiEdit2 size={16} />
        {tc("edit")}
      </button>
    </div>
  );
}

export function VehicleDetailsPanel({
  vehicle,
  vehicleTypes,
  mode,
  isCreate,
  isInfoEditing,
  canManageVehicles,
  form,
  formError,
  fieldErrors,
  imageFiles,
  isInfoSaving,
  isInfoDirty,
  isSeatLoading,
  isSeatSaving,
  seatLayout,
  originalSeatLayout,
  isSeatDirty,
  seatChangeCount,
  seatError,
  discardPrompt,
  onModeChange,
  onCloseRequest,
  onDiscardAndClose,
  onKeepEditing,
  onEditInfo,
  onCancelInfo,
  onSubmitInfo,
  onSubmitCreate,
  onValidateCreateInfo,
  onChange,
  onImageFilesChange,
  onImageError,
  onToggleSeat,
  onResetSeats,
  onSaveSeats,
}: VehicleDetailsPanelProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [createStep, setCreateStep] = useState<VehiclePanelMode>("info");
  const [selectedSeatType, setSelectedSeatType] = useState<VehicleSeatType>("STANDARD");
  const [seatTypeOverrides, setSeatTypeOverrides] = useState<Record<string, VehicleSeatType>>({});
  const createBaseLayout = useMemo(
    () => (isCreate ? createSeatLayoutPreview(form, vehicleTypes) : null),
    [form, isCreate, vehicleTypes],
  );
  const createLayout = useMemo(() => {
    if (!createBaseLayout) {
      return null;
    }

    return Object.entries(seatTypeOverrides).reduce(
      (current, [coordinateKey, type]) => setVehicleSeatType(current, coordinateKey, type),
      createBaseLayout,
    );
  }, [createBaseLayout, seatTypeOverrides]);
  const activeMode = isCreate ? createStep : mode;
  const stats = getVehicleSeatStats(isCreate ? createLayout : seatLayout, vehicle?.totalSeats ?? 0);
  const isBusy = isInfoSaving || isSeatSaving;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) {
        onCloseRequest();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBusy, onCloseRequest]);

  function chooseMode(nextMode: VehiclePanelMode) {
    if (isCreate) {
      setCreateStep(nextMode);
      return;
    }

    onModeChange(nextMode);
  }

  function nextCreateStep() {
    if (onValidateCreateInfo()) {
      setCreateStep("seats");
    }
  }

  function assignSeatType(coordinateKey: string) {
    setSeatTypeOverrides((current) => ({
      ...current,
      [coordinateKey]: selectedSeatType,
    }));
  }

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-slate-950/25 backdrop-blur-[1px]" aria-label={tc("close")} disabled={isBusy} onClick={onCloseRequest} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-5xl flex-col border-l border-gray-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="vehicle-panel-title">
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-vr-700">{isCreate ? t("vehicles.registerTitle") : t("vehicles.detailEyebrow", { defaultValue: "Phương tiện" })}</p>
            <h2 id="vehicle-panel-title" className="mt-1 truncate text-xl font-bold text-gray-900">{vehicle?.licensePlate ?? t("vehicles.registerTitle")}</h2>
            <p className="mt-1 truncate text-sm text-gray-500">{vehicle ? getVehicleTypeLabel(vehicle, vehicleTypes) : t("vehicles.registerSubtitle")}</p>
          </div>
          <button type="button" autoFocus onClick={onCloseRequest} disabled={isBusy} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-vr-500/40 disabled:cursor-wait disabled:opacity-50" aria-label={tc("close")}>
            <FiX size={19} />
          </button>
        </header>

        <div className="flex border-b border-gray-100 px-5 sm:px-7">
          <button type="button" role="tab" aria-selected={activeMode === "info"} onClick={() => chooseMode("info")} className={`border-b-2 px-1 py-3 text-sm font-semibold transition ${activeMode === "info" ? "border-vr-500 text-vr-800" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            <span className="inline-flex items-center gap-2"><FiInfo size={16} />{t("vehicles.infoTab", { defaultValue: "Thông tin xe" })}</span>
          </button>
          <button type="button" role="tab" aria-selected={activeMode === "seats"} disabled={isCreate && createStep === "info"} onClick={() => chooseMode("seats")} className={`ml-6 border-b-2 px-1 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${activeMode === "seats" ? "border-vr-500 text-vr-800" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {t("vehicles.seatsTab", { defaultValue: "Sơ đồ ghế" })}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {activeMode === "info" ? (
            isCreate || isInfoEditing ? (
              <VehicleInfoForm
                mode={isCreate ? "create" : "edit"}
                vehicleTypes={vehicleTypes}
                form={form}
                error={formError}
                fieldErrors={fieldErrors}
                imageFiles={imageFiles}
                onChange={onChange}
                onImageFilesChange={onImageFilesChange}
                onImageError={onImageError}
                isSubmitting={isInfoSaving}
              />
            ) : vehicle ? (
              <VehicleInfoSummary vehicle={vehicle} vehicleTypes={vehicleTypes} onEdit={onEditInfo} />
            ) : null
          ) : (
            <div className="space-y-5">
              {isCreate && (
                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t("vehicles.seatLayoutDesign")}</p>
                    <p className="mt-1 text-xs text-gray-500">{t("vehicles.seatLayoutApiHint")}</p>
                  </div>
                  <SeatGeometryFields form={form} fieldErrors={fieldErrors} onChange={onChange} />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <StatBadge label={t("vehicles.activeSeats", { defaultValue: "Ghế khai thác" })} value={String(stats.activePassengerSeats)} tone="green" />
                <StatBadge label={t("vehicles.disabledSeats", { defaultValue: "Ghế đã khóa" })} value={String(stats.disabledPassengerSeats)} tone="amber" />
                <StatBadge label={t("vehicles.passengerSeats", { defaultValue: "Tổng ghế khách" })} value={String(stats.passengerSeats)} tone="slate" />
              </div>

              {seatError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{seatError}</div>}
              {isCreate ? (
                <VehicleSeatLayout
                  layout={createLayout}
                  mode="assign-type"
                  selectedSeatType={selectedSeatType}
                  onSelectSeatType={setSelectedSeatType}
                  onAssignType={assignSeatType}
                />
              ) : isSeatLoading ? (
                <div className="space-y-3" aria-live="polite"><div className="h-16 animate-pulse rounded-xl bg-gray-100" /><div className="h-80 animate-pulse rounded-2xl bg-gray-100" /></div>
              ) : (
                <VehicleSeatLayout
                  layout={seatLayout}
                  baseline={originalSeatLayout}
                  mode={canManageVehicles ? "toggle-disabled" : "readonly"}
                  disabled={isSeatSaving}
                  onToggle={onToggleSeat}
                />
              )}

              {!isCreate && canManageVehicles && isSeatDirty && (
                <div className="sticky bottom-0 flex flex-col gap-3 border-t border-gray-100 bg-white/95 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-gray-500">{t("vehicles.seatChangesCount", { count: seatChangeCount, defaultValue: `${seatChangeCount} thay đổi chưa lưu` })}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={onResetSeats} disabled={isSeatSaving} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">{tc("undo", { defaultValue: "Hoàn tác" })}</button>
                    <button type="button" onClick={onSaveSeats} disabled={isSeatSaving} className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-vr-600 disabled:cursor-wait disabled:opacity-60"><FiSave size={15} />{isSeatSaving ? t("vehicles.saving") : tc("save")}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {isCreate && activeMode === "info" && (
          <footer className="flex shrink-0 justify-between gap-2 border-t border-gray-100 bg-white px-5 py-4 sm:px-7">
            <button type="button" onClick={onCloseRequest} disabled={isBusy} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">{tc("cancel")}</button>
            <button type="button" onClick={nextCreateStep} disabled={isBusy} className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-vr-600 disabled:opacity-60">{t("vehicles.nextStep", { defaultValue: "Tiếp tục" })}<FiArrowRight size={16} /></button>
          </footer>
        )}

        {isCreate && activeMode === "seats" && (
          <footer className="flex shrink-0 justify-between gap-2 border-t border-gray-100 bg-white px-5 py-4 sm:px-7">
            <button type="button" onClick={() => setCreateStep("info")} disabled={isBusy} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"><FiArrowLeft size={16} />{tc("back", { defaultValue: "Quay lại" })}</button>
            <button type="button" onClick={() => createLayout && onSubmitCreate(createLayout)} disabled={isBusy || !createLayout} className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-vr-600 disabled:cursor-wait disabled:opacity-60"><FiSave size={15} />{isInfoSaving ? t("vehicles.saving") : t("vehicles.register")}</button>
          </footer>
        )}

        {!isCreate && isInfoEditing && activeMode === "info" && (
          <footer className="flex shrink-0 justify-end gap-2 border-t border-gray-100 bg-white px-5 py-4 sm:px-7">
            <button type="button" onClick={onCancelInfo} disabled={isInfoSaving} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">{tc("cancel")}</button>
            <button type="button" onClick={onSubmitInfo} disabled={!isInfoDirty || isInfoSaving} className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-60"><FiSave size={15} />{isInfoSaving ? t("vehicles.saving") : tc("save")}</button>
          </footer>
        )}

        {discardPrompt && (
          <div className="border-t border-amber-200 bg-amber-50 px-5 py-4 sm:px-7" role="alertdialog" aria-label={t("vehicles.discardChanges", { defaultValue: "Bỏ thay đổi?" })}>
            <p className="text-sm font-semibold text-amber-900">{t("vehicles.discardChanges", { defaultValue: "Bỏ thay đổi?" })}</p>
            <p className="mt-1 text-xs text-amber-800">{t("vehicles.discardSeatChangesHint", { defaultValue: "Các lựa chọn chưa lưu sẽ bị mất." })}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={onKeepEditing} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">{t("vehicles.keepEditing", { defaultValue: "Tiếp tục chỉnh sửa" })}</button>
              <button type="button" onClick={onDiscardAndClose} className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800">{t("vehicles.discardChanges", { defaultValue: "Bỏ thay đổi" })}</button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
