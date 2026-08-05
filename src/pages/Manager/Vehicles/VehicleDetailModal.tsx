import { useTranslation } from "react-i18next";
import { FiEye } from "react-icons/fi";
import { FaChair } from "react-icons/fa";
import { DetailItem } from "../../../components/DetailLayout";
import Modal from "../../../components/Modal";
import {
  type OperatorVehicle,
  type VehicleType,
} from "../../../api/vietride";
import { VehicleImage } from "./VehicleImage";
import {
  getVehiclePhotos,
  getVehicleTypeLabel,
  parseSeatLayoutDecks,
  vehiclePhotos,
} from "./vehicleForm";

type VehicleDetailModalProps = {
  open: boolean;
  vehicle: OperatorVehicle | null;
  vehicleTypes: VehicleType[];
  isLoading: boolean;
  onClose: () => void;
};

export default function VehicleDetailModal({
  open,
  vehicle,
  vehicleTypes,
  isLoading,
  onClose,
}: VehicleDetailModalProps) {
  const { t: tc } = useTranslation("common");
  const { t } = useTranslation("manager");
  const decks = vehicle ? parseSeatLayoutDecks(vehicle.seatLayoutJson) : [];
  const layout =
    vehicle?.seatLayoutJson && typeof vehicle.seatLayoutJson !== "string"
      ? vehicle.seatLayoutJson
      : null;
  // alt của ảnh mẫu là key i18n (vehicles.stockPhotoAlt*), dịch tại đây trước khi render
  const photos = (vehicle ? getVehiclePhotos(vehicle) : vehiclePhotos).map(
    (photo) => ({
      ...photo,
      alt: photo.alt.startsWith("vehicles.stockPhotoAlt")
        ? t(photo.alt)
        : photo.alt,
    }),
  );
  const columnCount =
    layout?.cols ??
    Math.max(...decks.flatMap((deck) => deck.seats.map((seat) => seat.col)), 1);

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiEye size={20} />}
      title={t("vehicles.detailTitle")}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tc("close")}
        </button>
      }
    >
      {isLoading && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
          {t("vehicles.loadingDetail")}
        </div>
      )}

      {!isLoading && vehicle && (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <VehicleImage
                src={photos[0]?.src ?? vehiclePhotos[0].src}
                alt={photos[0]?.alt ?? t(vehiclePhotos[0].alt)}
                width={900}
                height={600}
                containerClassName="h-64 w-full"
                loading="eager"
                loadingLabel={t("vehicles.imageLoading")}
                errorLabel={t("vehicles.imageLoadFailed")}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {photos.slice(1, 5).map((photo) => (
                <VehicleImage
                  key={photo.src}
                  src={photo.src}
                  alt={photo.alt}
                  width={450}
                  height={300}
                  containerClassName="h-[122px] w-full rounded-xl border border-gray-200"
                  loadingLabel={t("vehicles.imageLoading")}
                  errorLabel={t("vehicles.imageLoadFailed")}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem
              label={t("vehicles.plate")}
              value={vehicle.licensePlate}
            />
            <DetailItem
              label={t("vehicles.vehicleType")}
              value={getVehicleTypeLabel(vehicle, vehicleTypes)}
            />
            <DetailItem
              label={t("vehicles.seatCount")}
              value={String(vehicle.totalSeats)}
            />
            <DetailItem
              label={t("vehicles.cargoWeight")}
              value={`${vehicle.maxCargoWeightKg} kg`}
            />
            <DetailItem
              label={t("vehicles.cargoVolume")}
              value={`${vehicle.maxCargoVolumeM3 ?? 0} m3`}
            />
            <DetailItem
              label={t("vehicles.deckCount")}
              value={String(layout?.decks ?? decks.length)}
            />
            <DetailItem label={tc("status")} value={tc(`enumLabels.${vehicle.status}`, { defaultValue: vehicle.status })} />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {t("vehicles.seatMap")}
                </h3>
                <p className="text-xs text-gray-500">
                  {t("vehicles.disabledSeatHint")}
                </p>
              </div>
              {layout?.aisles?.[0] && (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                  {t("vehicles.aisleAfterColumn", {
                    column: layout.aisles[0].afterCol,
                  })}
                </span>
              )}
            </div>

            {decks.length === 0 ? (
              <p className="mt-4 rounded-lg border border-gray-200 bg-white px-3 py-4 text-sm text-gray-500">
                {t("vehicles.noSeatMap")}
              </p>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {decks.map((deck) => (
                  <div
                    key={deck.deck}
                    className="rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {t("vehicles.deckLabel", { deck: deck.deck })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t("vehicles.generatedSeats", {
                          count: deck.seats.length,
                        })}
                      </p>
                    </div>
                    <div
                      className="grid gap-2"
                      style={{
                        gridTemplateColumns: `repeat(${columnCount}, minmax(2.5rem, 1fr))`,
                      }}
                    >
                      {deck.seats.map((seat) => (
                        <div
                          key={`${deck.deck}-${seat.seatNumber}`}
                          className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-center text-xs font-semibold ${
                            seat.disabled
                              ? "border-gray-200 bg-gray-100 text-gray-400"
                              : "border-vr-200 bg-vr-50 text-vr-700"
                          }`}
                          title={t("vehicles.seatTitle", {
                            row: seat.row,
                            col: seat.col,
                            type: seat.type,
                          })}
                        >
                          <FaChair size={16} />
                          <span>{seat.seatNumber}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
