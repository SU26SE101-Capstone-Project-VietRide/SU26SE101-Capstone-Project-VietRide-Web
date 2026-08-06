import { useEffect, useMemo, type ChangeEvent, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { FiUpload, FiX } from "react-icons/fi";
import CustomSelect from "../../../components/CustomSelect";
import { type VehicleType } from "../../../api/vietride";
import { validateVehicleImageFiles } from "./vehicleImageUpload";
import { VehicleImage } from "./VehicleImage";
import { labelClass } from "../../../components/form/formClasses";
import {
  getImageEntries,
  getUniquePublicImageUrls,
  inputClass,
  type VehicleForm,
  type VehicleFormErrors,
} from "./vehicleForm";

export type VehicleInfoFormProps = {
  mode: "create" | "edit";
  vehicleTypes: VehicleType[];
  form: VehicleForm;
  error: string;
  fieldErrors: VehicleFormErrors;
  imageFiles: File[];
  onChange: (key: keyof VehicleForm, value: string) => void;
  onImageFilesChange: (files: File[]) => void;
  onImageError: (error: unknown) => void;
  isSubmitting: boolean;
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="mt-1 text-xs font-medium text-red-600">
      {message}
    </p>
  );
}

export function VehicleInfoForm({
  mode,
  vehicleTypes,
  form,
  error,
  fieldErrors,
  imageFiles,
  onChange,
  onImageFilesChange,
  onImageError,
  isSubmitting,
}: VehicleInfoFormProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const isCreate = mode === "create";
  const existingImages = getUniquePublicImageUrls(
    getImageEntries(form.imageUrls),
  );
  const localImagePreviews = useMemo(
    () =>
      imageFiles.map((file) => ({
        file,
        src: URL.createObjectURL(file),
      })),
    [imageFiles],
  );
  const selectedImages = [
    ...existingImages.map((src) => ({ src, file: null })),
    ...localImagePreviews,
  ];
  const fieldClass = (key: keyof VehicleForm) =>
    `${inputClass} ${fieldErrors[key] ? "border-red-300 focus:border-red-500 focus:ring-red-500/30" : ""}`;

  useEffect(
    () => () => {
      localImagePreviews.forEach(({ src }) => URL.revokeObjectURL(src));
    },
    [localImagePreviews],
  );

  function addImageFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files);

    if (nextFiles.length === 0) {
      return;
    }

    try {
      validateVehicleImageFiles(
        nextFiles,
        existingImages.length + imageFiles.length,
      );
      onImageFilesChange([...imageFiles, ...nextFiles]);
    } catch (imageError) {
      onImageError(imageError);
    }
  }

  function removeImage(index: number) {
    if (index < existingImages.length) {
      onChange(
        "imageUrls",
        existingImages
          .filter((_, currentIndex) => currentIndex !== index)
          .join("\n"),
      );
      return;
    }

    const localIndex = index - existingImages.length;
    onImageFilesChange(
      imageFiles.filter((_, currentIndex) => currentIndex !== localIndex),
    );
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files) {
      return;
    }

    addImageFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addImageFiles(event.dataTransfer.files);
  }

  return (
    <div className="space-y-5">
      {error && (
        <div
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="vehicle-license-plate">
            {t("vehicles.plate")}
          </label>
          <input
            id="vehicle-license-plate"
            name="licensePlate"
            className={fieldClass("licensePlate")}
            value={form.licensePlate}
            onChange={(event) => onChange("licensePlate", event.target.value)}
            placeholder="51B-12345"
            maxLength={20}
            autoComplete="off"
            aria-invalid={Boolean(fieldErrors.licensePlate)}
            aria-describedby={
              fieldErrors.licensePlate
                ? "vehicle-license-plate-error"
                : undefined
            }
          />
          <FieldError
            id="vehicle-license-plate-error"
            message={fieldErrors.licensePlate}
          />
        </div>
        <div role="group" aria-labelledby="vehicle-type-label">
          <span id="vehicle-type-label" className={labelClass}>
            {t("vehicles.vehicleType")}
          </span>
          <CustomSelect
            className={fieldClass("vehicleTypeId")}
            value={form.vehicleTypeId}
            onChange={(event) => onChange("vehicleTypeId", event.target.value)}
            disabled={!isCreate || isSubmitting}
            aria-label={`${t("vehicles.vehicleType")}${
              fieldErrors.vehicleTypeId ? `: ${fieldErrors.vehicleTypeId}` : ""
            }`}
          >
            <option value="">{t("vehicles.selectVehicleType")}</option>
            {vehicleTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.displayName}
              </option>
            ))}
          </CustomSelect>
          <FieldError
            id="vehicle-type-error"
            message={fieldErrors.vehicleTypeId}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="vehicle-seat-count">
            {t("vehicles.capacitySeats")}
          </label>
          <input
            id="vehicle-seat-count"
            name="totalSeats"
            className={inputClass}
            type="number"
            value={form.totalSeats}
            readOnly
          />
          {isCreate && (
            <p className="mt-1 text-xs text-gray-500">
              {t("vehicles.autoSeatCountHint")}
            </p>
          )}
          <FieldError
            id="vehicle-total-seats-error"
            message={fieldErrors.totalSeats}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="vehicle-cargo-weight">
            {t("vehicles.cargoWeight")}
          </label>
          <input
            id="vehicle-cargo-weight"
            name="maxCargoWeightKg"
            className={fieldClass("maxCargoWeightKg")}
            type="number"
            min={0}
            step="0.1"
            value={form.maxCargoWeightKg}
            onChange={(event) =>
              onChange("maxCargoWeightKg", event.target.value)
            }
            aria-invalid={Boolean(fieldErrors.maxCargoWeightKg)}
            aria-describedby={
              fieldErrors.maxCargoWeightKg
                ? "vehicle-cargo-weight-error"
                : undefined
            }
          />
          <FieldError
            id="vehicle-cargo-weight-error"
            message={fieldErrors.maxCargoWeightKg}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="vehicle-cargo-volume">
            {t("vehicles.cargoVolumeM3")}
          </label>
          <input
            id="vehicle-cargo-volume"
            name="maxCargoVolumeM3"
            className={fieldClass("maxCargoVolumeM3")}
            min={0}
            step="0.1"
            type="number"
            value={form.maxCargoVolumeM3}
            onChange={(event) =>
              onChange("maxCargoVolumeM3", event.target.value)
            }
            aria-invalid={Boolean(fieldErrors.maxCargoVolumeM3)}
            aria-describedby={
              fieldErrors.maxCargoVolumeM3
                ? "vehicle-cargo-volume-error"
                : undefined
            }
          />
          <FieldError
            id="vehicle-cargo-volume-error"
            message={fieldErrors.maxCargoVolumeM3}
          />
        </div>
        {!isCreate && (
          <div role="group" aria-labelledby="vehicle-status-label">
            <span id="vehicle-status-label" className={labelClass}>
              {tc("status")}
            </span>
            <CustomSelect
              className={fieldClass("status")}
              value={form.status}
              onChange={(event) => onChange("status", event.target.value)}
              aria-label={`${tc("status")}${
                fieldErrors.status ? `: ${fieldErrors.status}` : ""
              }`}
            >
              <option value="ACTIVE">{t("vehicles.statusActive")}</option>
              <option value="MAINTENANCE">
                {t("vehicles.statusMaintenance")}
              </option>
              <option value="OFF_DUTY">{t("vehicles.inactive")}</option>
              <option value="RETIRED">
                {tc("enumLabels.RETIRED", { defaultValue: "RETIRED" })}
              </option>
            </CustomSelect>
            <FieldError
              id="vehicle-status-error"
              message={fieldErrors.status}
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <label className={labelClass}>{t("vehicles.images")}</label>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="rounded-xl border border-dashed border-vr-200 bg-vr-50/40 p-4 transition hover:border-vr-300 hover:bg-vr-50"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-vr-700 shadow-sm">
                <FiUpload size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {t("vehicles.dropImages")}
                </p>
                <p className="text-xs text-gray-500">
                  {t("vehicles.imagePickerHint")}
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-vr-200 bg-white px-3 py-2 text-sm font-semibold text-vr-700 hover:bg-vr-50">
                {t("vehicles.chooseImages")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={isSubmitting}
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          </div>
          {selectedImages.length > 0 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {selectedImages.map((image, index) => (
                <div
                  key={`${image.src.slice(0, 32)}-${index}`}
                  className="relative overflow-hidden rounded-lg border border-gray-200 bg-white"
                >
                  <VehicleImage
                    src={image.src}
                    alt={t("vehicles.imagePreview", { index: index + 1 })}
                    width={240}
                    height={160}
                    containerClassName="h-28 w-full"
                    loadingLabel={t("vehicles.imageLoading")}
                    errorLabel={t("vehicles.imageLoadFailed")}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    disabled={isSubmitting}
                    className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-gray-600 shadow-sm hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={t("vehicles.removeImage")}
                    title={t("vehicles.removeImage")}
                  >
                    <FiX size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-vr-100 bg-vr-50/50 px-4 py-3 text-sm text-vr-900">
        {isCreate
          ? t("vehicles.seatLayoutApiHint")
          : t("vehicles.infoEditHint", {
              defaultValue:
                "Chỉ các trường thông tin xe được thay đổi trong tab này.",
            })}
      </div>
    </div>
  );
}
