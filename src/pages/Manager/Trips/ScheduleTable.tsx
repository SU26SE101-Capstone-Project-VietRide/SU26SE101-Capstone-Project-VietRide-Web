// Section bảng lịch chuyến — tách từ index.tsx theo ngưỡng §2.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FiEdit2, FiPause, FiPlay, FiTrash2, FiTruck } from "react-icons/fi";
import Pagination from "../../../components/Pagination";
import { formatDateTime } from "../../../utils/date";
import { formatMoney, optionLabel } from "./tripHelpers";
import { SectionHeader } from "./formControls";
import type {
  RouteOption,
  StaffOption,
  TripSchedule,
  VehicleOption,
} from "./types";

type ScheduleTableProps = {
  schedules: TripSchedule[];
  routes: RouteOption[];
  vehicles: VehicleOption[];
  staff: StaffOption[];
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
  staff,
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
  const paginatedSchedules = useMemo(
    () => schedules.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, schedules],
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
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-5 py-3">{t("trips.tripCode")}</th>
              <th className="px-5 py-3">{t("trips.route")}</th>
              <th className="px-5 py-3">{t("trips.vehicle")}</th>
              <th className="px-5 py-3">{t("trips.crew")}</th>
              <th className="px-5 py-3">{t("trips.departure")}</th>
              <th className="px-5 py-3">{t("trips.fare")}</th>
              <th className="px-5 py-3">{t("trips.status")}</th>
              {canManageSchedules ? (
                <th className="px-5 py-3 text-right">{t("trips.actions")}</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              // Đang tải: hàng skeleton — empty-state chỉ hiện khi ĐÃ tải xong và thật sự rỗng
              <ScheduleTableSkeletonRows
                columns={canManageSchedules ? 8 : 7}
              />
            ) : paginatedSchedules.length > 0 ? (
              paginatedSchedules.map((schedule) => (
                <tr key={schedule.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 font-semibold text-gray-900">
                    {schedule.code}
                  </td>
                  <td className="px-5 py-4 text-gray-700">
                    {schedule.routeName ||
                      optionLabel(
                        routes,
                        schedule.routeId,
                        (route) => route.name,
                      )}
                  </td>
                  <td className="px-5 py-4 text-gray-700">
                    {schedule.vehiclePlate ||
                      optionLabel(
                        vehicles,
                        schedule.vehicleId,
                        (vehicle) => vehicle.plate,
                      )}
                  </td>
                  <td className="px-5 py-4 text-gray-700">
                    <span className="block">
                      {schedule.driverName ||
                        optionLabel(
                          staff,
                          schedule.driverId,
                          (person) => person.name,
                        )}
                    </span>
                    <span className="text-xs text-gray-500">
                      {schedule.assistantName ||
                        optionLabel(
                          staff,
                          schedule.assistantId,
                          (person) => person.name,
                        )}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-700">
                    <span className="block">
                      {formatDateTime(schedule.departureAt)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {t("trips.eta")}:{" "}
                      {formatDateTime(schedule.arrivalEstimate)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-700">
                    {formatMoney(schedule.fare)} đ
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-vr-50 px-2.5 py-1 text-xs font-semibold text-vr-700">
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
                  colSpan={canManageSchedules ? 8 : 7}
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
          totalItems={schedules.length}
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
