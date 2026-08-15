// Panel cột phải khi điều độ viên chọn một xe TRUNG CHUYỂN trên bản đồ Vận hành.
//
// Cố ý mỏng: màn này lo đội xe chuyến chính, mọi thao tác với xe trung chuyển
// (huỷ chuyến, xem điểm đón, ETA từng điểm) đã có đủ ở màn Điều phối — dựng lại
// ở đây là hai nơi cùng làm một việc và sẽ lệch nhau.
import { useTranslation } from "react-i18next";
import { FiExternalLink, FiTruck, FiX } from "react-icons/fi";
import type { OperatorShuttleTripListItem } from "../../../api/vietride";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";

type ShuttleVehiclePanelProps = {
  trip: OperatorShuttleTripListItem | null;
  /** null = xe chưa gửi GPS hoặc đã quá TTL 300s */
  speedKmh: number | null;
  onDeselect: () => void;
  onOpenDispatch: () => void;
};

export default function ShuttleVehiclePanel({
  trip,
  speedKmh,
  onDeselect,
  onOpenDispatch,
}: ShuttleVehiclePanelProps) {
  const { t } = useTranslation("manager");

  if (!trip) return null;

  const driverName = trip.driver.displayName?.trim();

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
            <FiTruck size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">
              {trip.vehicle.licensePlate || t("gps.unknownVehicle")}
            </p>
            <p className="mt-0.5 text-xs font-medium text-vr-700">
              {t("gps.shuttleBadge")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDeselect}
          className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50"
          aria-label={t("gps.deselectVehicle")}
        >
          <FiX size={15} />
        </button>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 px-3 py-3 text-xs">
        <div className="col-span-2">
          <dt className="text-gray-500">{t("gps.driver")}</dt>
          <dd className="mt-0.5 font-semibold text-gray-900">
            {driverName || t("gps.unassignedDriver")}
            {trip.driver.phone
              ? ` · ${formatVietnamPhoneForDisplay(trip.driver.phone)}`
              : ""}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">{t("gps.shuttleDirectionLabel")}</dt>
          <dd className="mt-0.5 font-semibold text-gray-900">
            {t(`gps.shuttleDirection.${trip.direction}`)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">{t("gps.speed")}</dt>
          <dd className="mt-0.5 font-semibold text-gray-900">
            {speedKmh == null
              ? t("gps.noSignal")
              : t("gps.speedValue", { speed: speedKmh })}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">{t("gps.shuttlePassengers")}</dt>
          <dd className="mt-0.5 font-semibold text-gray-900">
            {trip.passengerCount}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">{t("gps.shuttleStops")}</dt>
          <dd className="mt-0.5 font-semibold text-gray-900">
            {trip.stopCount}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs leading-5 text-gray-500">
        {t("gps.shuttlePanelHint")}
      </p>

      <button
        type="button"
        onClick={onOpenDispatch}
        className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-vr-200 bg-vr-50 px-3 py-2 text-sm font-semibold text-vr-800 transition hover:bg-vr-100"
      >
        <FiExternalLink size={15} aria-hidden="true" />
        {t("gps.openDispatch")}
      </button>
    </section>
  );
}
