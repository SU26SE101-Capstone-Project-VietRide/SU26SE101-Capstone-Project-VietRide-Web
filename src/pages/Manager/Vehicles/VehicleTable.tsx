import { useTranslation } from "react-i18next";
import { FiEdit2, FiEye, FiGrid } from "react-icons/fi";
import type { OperatorVehicle, VehicleType } from "../../../api/vietride";
import Pagination from "../../../components/Pagination";
import { VehicleImage } from "./VehicleImage";
import {
  getVehicleId,
  getVehiclePhoto,
  getVehicleTypeLabel,
} from "./vehicleForm";
import {
  getVehicleSeatStats,
  parseVehicleSeatLayout,
} from "./vehicleSeatHelpers";
import type { VehiclePanelMode } from "./VehicleDetailsPanel";

type VehicleTableProps = {
  vehicles: OperatorVehicle[];
  vehicleTypes: VehicleType[];
  isLoading: boolean;
  search: string;
  canManageVehicles: boolean;
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onOpenPanel: (vehicle: OperatorVehicle, mode: VehiclePanelMode) => void;
  onEdit: (vehicle: OperatorVehicle) => void;
};

export function VehicleTable({
  vehicles,
  vehicleTypes,
  isLoading,
  search,
  canManageVehicles,
  page,
  pageSize,
  totalItems,
  onPageChange,
  onOpenPanel,
  onEdit,
}: VehicleTableProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

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
      OFF_DUTY: {
        bg: "bg-gray-100",
        dot: "bg-gray-400",
        text: "text-gray-700",
        label: t("vehicles.inactive"),
      },
      INACTIVE: {
        bg: "bg-gray-100",
        dot: "bg-gray-400",
        text: "text-gray-700",
        label: t("vehicles.inactive"),
      },
      RETIRED: {
        bg: "bg-slate-100",
        dot: "bg-slate-500",
        text: "text-slate-700",
        label: tc("enumLabels.RETIRED", { defaultValue: "RETIRED" }),
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
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-5 py-3">{t("vehicles.photo")}</th>
              <th className="px-5 py-3">{t("vehicles.plate")}</th>
              <th className="px-5 py-3">{t("vehicles.model")}</th>
              <th className="px-5 py-3">{t("vehicles.capacity")}</th>
              <th className="px-5 py-3">{t("vehicles.cargoWeight")}</th>
              <th className="px-5 py-3">{tc("status")}</th>
              <th className="px-5 py-3">{tc("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-500">
                  {t("vehicles.loading")}
                </td>
              </tr>
            ) : vehicles.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-500">
                  {search
                    ? t("gps.noVehiclesMatchFilter")
                    : t("dashboard.noVehicles")}
                </td>
              </tr>
            ) : (
              vehicles.map((vehicle) => {
                const photo = getVehiclePhoto(vehicle);
                const stats = getVehicleSeatStats(
                  parseVehicleSeatLayout(vehicle.seatLayoutJson),
                  vehicle.totalSeats,
                );
                const vehicleId = getVehicleId(vehicle);

                return (
                  <tr
                    key={vehicleId || vehicle.licensePlate}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                  >
                    <td className="px-5 py-4">
                      <VehicleImage
                        src={photo.src}
                        alt={photo.alt}
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
                      <span className="font-semibold tabular-nums text-gray-900">
                        {stats.activePassengerSeats}/{stats.passengerSeats}
                      </span>
                      <span className="ml-1 text-xs text-gray-500">
                        {t("vehicles.seats", { defaultValue: "ghế" }).trim()}
                      </span>
                      {stats.disabledPassengerSeats > 0 && (
                        <span className="mt-1 block text-xs text-amber-700">
                          {stats.disabledPassengerSeats}{" "}
                          {t("vehicles.disabledSeatShort", { defaultValue: "đã khóa" })}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm tabular-nums text-gray-700">
                      <span className="block">{vehicle.maxCargoWeightKg} kg</span>
                      <span className="mt-1 block text-xs text-gray-500">
                        {vehicle.maxCargoVolumeM3 ?? 0} m³
                      </span>
                    </td>
                    <td className="px-5 py-4">{vehicleStatusBadge(vehicle.status)}</td>
                    <td className="px-5 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenPanel(vehicle, "info")}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700 focus:outline-none focus:ring-2 focus:ring-vr-500/40"
                          title={t("vehicles.viewDetail")}
                          aria-label={t("vehicles.viewDetail")}
                        >
                          <FiEye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenPanel(vehicle, "seats")}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700 focus:outline-none focus:ring-2 focus:ring-vr-500/40"
                          title={t("vehicles.manageSeats", { defaultValue: "Quản lý ghế" })}
                          aria-label={t("vehicles.manageSeats", { defaultValue: "Quản lý ghế" })}
                        >
                          <FiGrid size={16} />
                        </button>
                        {canManageVehicles && (
                          <button
                            type="button"
                            onClick={() => onEdit(vehicle)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            title={tc("edit")}
                            aria-label={tc("edit")}
                          >
                            <FiEdit2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={onPageChange}
      />
    </div>
  );
}
