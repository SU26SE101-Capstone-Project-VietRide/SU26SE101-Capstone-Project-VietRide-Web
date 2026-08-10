// Section bảng lịch chuyến — tách từ index.tsx theo ngưỡng §2.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiEdit2, FiPause, FiPlay, FiSearch, FiTrash2, FiTruck } from "react-icons/fi";
import Pagination from "../../../components/Pagination";
import CustomSelect from "../../../components/CustomSelect";
import { formatDateTime } from "../../../utils/date";
import { formatCurrency } from "../../../utils/currency";
import { optionLabel } from "./tripHelpers";
import { SectionHeader } from "./formControls";
import type {
  RouteOption,
  TripSchedule,
  VehicleOption,
} from "./types";

type ScheduleTableProps = {
  schedules: TripSchedule[];
  routes: RouteOption[];
  vehicles: VehicleOption[];
  canManageSchedules: boolean;
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onEdit: (schedule: TripSchedule) => void;
  onToggleActive: (schedule: TripSchedule) => void;
  onDelete: (schedule: TripSchedule) => void;
};

export default function ScheduleTable({
  schedules,
  routes,
  vehicles,
  canManageSchedules,
  isLoading,
  page,
  pageSize,
  onPageChange,
  onEdit,
  onToggleActive,
  onDelete,
}: ScheduleTableProps) {
  const { t } = useTranslation("manager");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("");
  const vehicleTypes = useMemo(
    () => Array.from(new Set(vehicles.map((vehicle) => vehicle.vehicleType).filter(Boolean))).sort(),
    [vehicles],
  );
  function vehicleTypeLabel(vehicleType?: string) {
    const rawValue = vehicleType?.trim() ?? "";
    if (!rawValue) {
      return "-";
    }
    const key = rawValue.toUpperCase();
    const translated = t(`vehicles.vehicleTypes.${key}`);
    return translated === `vehicles.vehicleTypes.${key}`
      ? rawValue
      : translated;
  }
  const filteredSchedules = useMemo(() => {
    const query = search.trim().toLowerCase();
    return schedules.filter((schedule) => {
      const vehicle = vehicles.find((item) => item.id === schedule.vehicleId);
      const searchableText = [
        schedule.code,
        schedule.routeName,
        schedule.vehiclePlate,
        vehicle?.plate,
      ].filter(Boolean).join(" ").toLowerCase();
      return (
        (!query || searchableText.includes(query)) &&
        (!statusFilter || schedule.status === statusFilter) &&
        (!vehicleTypeFilter || vehicle?.vehicleType === vehicleTypeFilter)
      );
    });
  }, [search, schedules, statusFilter, vehicleTypeFilter, vehicles]);
  const paginatedSchedules = useMemo(
    () => filteredSchedules.slice((page - 1) * pageSize, page * pageSize),
    [filteredSchedules, page, pageSize],
  );

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-5">
        <SectionHeader
          icon={<FiTruck />}
          title={t("trips.scheduleList")}
          subtitle={t("trips.scheduleListSubtitle")}
        />
      </div>
      <div className="border-t border-gray-100 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); onPageChange(1); }}
              placeholder={t("trips.searchPlaceholder")}
              aria-label={t("trips.searchPlaceholder")}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-vr-500 focus:bg-white"
            />
          </div>
          <CustomSelect
            value={statusFilter}
            onChange={(event) => { setStatusFilter(event.target.value); onPageChange(1); }}
            aria-label={t("trips.filterStatus")}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm lg:w-[190px]"
          >
            <option value="">{t("trips.allStatuses")}</option>
            <option value="open">{t("trips.scheduleStatus.open")}</option>
            <option value="draft">{t("trips.scheduleStatus.draft")}</option>
            <option value="blocked">{t("trips.scheduleStatus.blocked")}</option>
          </CustomSelect>
          <CustomSelect
            value={vehicleTypeFilter}
            onChange={(event) => { setVehicleTypeFilter(event.target.value); onPageChange(1); }}
            aria-label={t("trips.filterVehicleType")}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm lg:w-[220px]"
          >
            <option value="">{t("trips.allVehicleTypes")}</option>
            {vehicleTypes.map((vehicleType) => (
              <option key={vehicleType} value={vehicleType}>{vehicleTypeLabel(vehicleType)}</option>
            ))}
          </CustomSelect>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-center text-sm">
          <thead className="bg-gray-50 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="whitespace-nowrap px-5 py-3">{t("trips.tripCode")}</th>
              <th className="px-5 py-3">{t("trips.route")}</th>
              <th className="px-5 py-3">{t("trips.vehicle")}</th>
              <th className="whitespace-nowrap px-5 py-3">{t("trips.departure")}</th>
              <th className="whitespace-nowrap px-5 py-3">{t("trips.fare")}</th>
              <th className="px-5 py-3">{t("trips.status")}</th>
              {canManageSchedules ? (
                <th className="px-5 py-3 text-center">{t("trips.actions")}</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              // Đang tải: hàng skeleton — empty-state chỉ hiện khi ĐÃ tải xong và thật sự rỗng
              <ScheduleTableSkeletonRows
                columns={canManageSchedules ? 7 : 6}
              />
            ) : paginatedSchedules.length > 0 ? (
              paginatedSchedules.map((schedule) => (
                <tr key={schedule.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-900">
                    {schedule.code}
                  </td>
                  <td
                    className="max-w-[240px] truncate px-5 py-4 text-gray-700"
                    title={schedule.routeName}
                  >
                    {schedule.routeName ||
                      optionLabel(
                        routes,
                        schedule.routeId,
                        (route) => route.name,
                      )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-gray-700">
                    <span className="block">
                      {schedule.vehiclePlate ||
                        optionLabel(
                          vehicles,
                          schedule.vehicleId,
                          (vehicle) => vehicle.plate,
                        )}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {vehicleTypeLabel(
                        optionLabel(
                          vehicles,
                          schedule.vehicleId,
                          (vehicle) => vehicle.vehicleType,
                        ),
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-gray-700">
                    <span className="block">
                      {formatDateTime(schedule.departureAt)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {t("trips.eta")}:{" "}
                      {formatDateTime(schedule.arrivalEstimate)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-gray-700">
                    {schedule.baseFare === ""
                      ? t("trips.routeFareFallback")
                      : formatCurrency(schedule.baseFare)}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${schedule.status === "open" ? "bg-emerald-50 text-emerald-700" : schedule.status === "draft" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700"}`}>
                      {t(`trips.scheduleStatus.${schedule.status}`)}
                    </span>
                  </td>
                  {canManageSchedules ? (
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(schedule)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700"
                          title={t("trips.edit")}
                          aria-label={t("trips.edit")}
                        >
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleActive(schedule)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                          title={
                            schedule.status === "open"
                              ? t("trips.deactivate")
                              : t("trips.activate")
                          }
                          aria-label={
                            schedule.status === "open"
                              ? t("trips.deactivate")
                              : t("trips.activate")
                          }
                        >
                          {schedule.status === "open" ? (
                            <FiPause size={16} />
                          ) : (
                            <FiPlay size={16} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(schedule)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                          title={t("trips.deleteSchedule")}
                          aria-label={t("trips.deleteSchedule")}
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={canManageSchedules ? 7 : 6}
                  className="px-5 py-8 text-center text-sm text-gray-500"
                >
                  {t("trips.noSchedules")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!isLoading && schedules.length > 0 ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={filteredSchedules.length}
          onPageChange={onPageChange}
        />
      ) : null}
    </section>
  );
}

// Skeleton hàng bảng khi đang tải lịch — chỉ màn này dùng, ≤ 50 dòng nên inline (§2).
function ScheduleTableSkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 4 }, (_, rowIndex) => (
        <tr
          key={rowIndex}
          aria-hidden="true"
          data-testid={
            rowIndex === 0 ? "schedules-table-skeleton" : undefined
          }
        >
          {Array.from({ length: columns }, (_, columnIndex) => (
            <td key={columnIndex} className="px-5 py-4">
              <div className="h-4 w-full animate-pulse rounded-md bg-slate-200" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
