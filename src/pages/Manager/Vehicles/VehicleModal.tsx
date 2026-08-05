import { useEffect, useMemo } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { FiTruck, FiUpload, FiX } from "react-icons/fi";
import { FaChair } from "react-icons/fa";
import Modal from "../../../components/Modal";
import CustomSelect from "../../../components/CustomSelect";
import { type VehicleType } from "../../../api/vietride";
import { validateVehicleImageFiles } from "./vehicleImageUpload";
import { VehicleImage } from "./VehicleImage";
import { labelClass } from "../../../components/form/formClasses";
import {
  countSeats,
  createDecks,
  getImageEntries,
  getUniquePublicImageUrls,
  inputClass,
  toSeatLayoutOptions,
  type VehicleForm,
} from "./vehicleForm";

type VehicleModalProps = {
  open: boolean;
  title: string;
  vehicleTypes: VehicleType[];
  form: VehicleForm;
  imageFiles: File[];
  onChange: (key: keyof VehicleForm, value: string) => void;
  onImageFilesChange: (files: File[]) => void;
  onImageError: (error: unknown) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  isSubmitting: boolean;
  submitLabel: string;
};

export default function VehicleModal({
  open,
  title,
  vehicleTypes,
  form,
  imageFiles,
  onChange,
  onImageFilesChange,
  onImageError,
  onClose,
  onSubmit,
  isSubmitting,
  submitLabel,
}: VehicleModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const previewDecks = createDecks(form);
  const generatedSeats = countSeats(previewDecks);
  const layoutOptions = toSeatLayoutOptions(form);
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
    <Modal
      open={open}
      onClose={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
      wide
      icon={<FiTruck size={20} />}
      title={title}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="inline-flex min-w-32 items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting && (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/45 border-t-white"
                aria-hidden="true"
              />
            )}
            {isSubmitting
              ? imageFiles.length > 0
                ? t("vehicles.uploadingImages")
                : t("vehicles.saving")
              : submitLabel}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{t("vehicles.plate")}</label>
          <input
            className={inputClass}
            value={form.licensePlate}
            onChange={(event) => onChange("licensePlate", event.target.value)}
            placeholder="51B-12345"
          />
        </div>
        <div>
          <label className={labelClass}>{t("vehicles.vehicleType")}</label>
          <CustomSelect
            className={inputClass}
            value={form.vehicleTypeId}
            onChange={(event) => onChange("vehicleTypeId", event.target.value)}
          >
            <option value="">{t("vehicles.selectVehicleType")}</option>
            {vehicleTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.displayName}
              </option>
            ))}
          </CustomSelect>
        </div>
        <div>
          <label className={labelClass}>{t("vehicles.capacitySeats")}</label>
          <input
            className={inputClass}
            type="number"
            value={generatedSeats}
            readOnly
          />
          <p className="mt-1 text-xs text-gray-500">
            {t("vehicles.autoSeatCountHint")}
          </p>
        </div>
        <div>
          <label className={labelClass}>{t("vehicles.cargoWeight")}</label>
          <input
            className={inputClass}
            type="number"
            value={form.maxCargoWeightKg}
            onChange={(event) =>
              onChange("maxCargoWeightKg", event.target.value)
            }
          />
        </div>
        <div>
          <label className={labelClass}>{t("vehicles.cargoVolumeM3")}</label>
          <input
            className={inputClass}
            min={0}
            step="0.1"
            type="number"
            value={form.maxCargoVolumeM3}
            onChange={(event) =>
              onChange("maxCargoVolumeM3", event.target.value)
            }
          />
        </div>
        <div>
          <label className={labelClass}>{tc("status")}</label>
          <CustomSelect
            className={inputClass}
            value={form.status}
            onChange={(event) => onChange("status", event.target.value)}
          >
            <option value="ACTIVE">{t("vehicles.statusActive")}</option>
            <option value="MAINTENANCE">
              {t("vehicles.statusMaintenance")}
            </option>
            <option value="INACTIVE">{t("vehicles.inactive")}</option>
          </CustomSelect>
        </div>
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

      <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {t("vehicles.seatLayoutDesign")}
            </h3>
            <p className="text-xs text-gray-500">
              {t("vehicles.seatLayoutApiHint")}
            </p>
          </div>
          <span className="rounded-full bg-vr-50 px-3 py-1 text-xs font-semibold text-vr-700">
            {t("vehicles.generatedSeats", { count: generatedSeats })}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          <div>
            <label className={labelClass}>{t("vehicles.deckCount")}</label>
            <input
              className={inputClass}
              min={1}
              type="number"
              value={form.deckCount}
              onChange={(event) => onChange("deckCount", event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>{t("vehicles.rowsPerDeck")}</label>
            <input
              className={inputClass}
              min={1}
              type="number"
              value={form.rowsPerDeck}
              onChange={(event) => onChange("rowsPerDeck", event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>{t("vehicles.columnsPerRow")}</label>
            <input
              className={inputClass}
              min={1}
              type="number"
              value={form.columnsPerRow}
              onChange={(event) =>
                onChange("columnsPerRow", event.target.value)
              }
            />
          </div>
          <div>
            <label className={labelClass}>{t("vehicles.aisleAfterCol")}</label>
            <input
              className={inputClass}
              min={1}
              type="number"
              value={form.aisleAfterCol}
              onChange={(event) =>
                onChange("aisleAfterCol", event.target.value)
              }
            />
          </div>
          <div>
            <label className={labelClass}>{t("vehicles.seatPrefix")}</label>
            <input
              className={inputClass}
              value={form.seatPrefix}
              onChange={(event) => onChange("seatPrefix", event.target.value)}
              placeholder="A"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {previewDecks.map((deck) => (
            <div
              key={deck.deck}
              className="rounded-lg border border-gray-200 bg-white p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("vehicles.deckLabel", { deck: deck.deck })}
                </p>
                <p className="text-xs text-gray-500">
                  {t("vehicles.generatedSeats", { count: deck.seats.length })}
                </p>
              </div>
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${layoutOptions.columnsPerRow}, minmax(2.5rem, 1fr))`,
                }}
              >
                {deck.seats.map((seat) => (
                  <div
                    key={`${deck.deck}-${seat.seatNumber}`}
                    className="flex flex-col items-center gap-1 rounded-md border border-vr-200 bg-vr-50 px-2 py-2 text-center text-xs font-semibold text-vr-700"
                    title={`row ${seat.row}, col ${seat.col}`}
                  >
                    <FaChair size={16} />
                    <span>{seat.seatNumber}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
