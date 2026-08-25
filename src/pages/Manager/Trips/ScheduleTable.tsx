import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCalendar, FiEdit2, FiPause, FiPlay, FiRepeat, FiSliders, FiTrash2, FiTruck, FiUsers, FiX } from "react-icons/fi";
import Pagination from "../../../components/Pagination";
import CustomSelect from "../../../components/CustomSelect";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import { formatDateTime } from "../../../utils/date";
import { formatCurrency } from "../../../utils/currency";
import { displayBusinessCode } from "../../../utils/businessCode";
import { optionLabel } from "./tripHelpers";
import { SectionHeader } from "./formControls";
import type { RouteOption, StaffOption, TripSchedule, VehicleOption } from "./types";
import { SearchInput } from "../../../components/ui/SearchInput";
import { Badge } from "../../../components/ui/Badge";

type ScheduleTableProps = {
  schedules: TripSchedule[]; routes: RouteOption[]; vehicles: VehicleOption[]; drivers?: StaffOption[]; canManageSchedules: boolean; isLoading: boolean; page: number; pageSize: number; totalItems?: number; search?: string; statusFilter?: string; vehicleTypeFilter?: string; routeFilter?: string; driverFilter?: string; dayOfWeekFilter?: string; departureFrom?: string; departureTo?: string; onSearchChange?: (value: string) => void; onStatusFilterChange?: (value: string) => void; onVehicleTypeFilterChange?: (value: string) => void; onRouteFilterChange?: (value: string) => void; onDriverFilterChange?: (value: string) => void; onDayOfWeekFilterChange?: (value: string) => void; onDepartureFromChange?: (value: string) => void; onDepartureToChange?: (value: string) => void; onPageChange: (page: number) => void; onEdit: (schedule: TripSchedule) => void; onChangeCrew: (schedule: TripSchedule) => void; onToggleActive: (schedule: TripSchedule) => void; onDelete: (schedule: TripSchedule) => void;
};

export default function ScheduleTable({ schedules, routes, vehicles, drivers = [], canManageSchedules, isLoading, page, pageSize, totalItems = schedules.length, search = "", statusFilter = "", vehicleTypeFilter = "", routeFilter = "", driverFilter = "", dayOfWeekFilter = "", departureFrom = "", departureTo = "", onSearchChange = () => {}, onStatusFilterChange = () => {}, onVehicleTypeFilterChange = () => {}, onRouteFilterChange = () => {}, onDriverFilterChange = () => {}, onDayOfWeekFilterChange = () => {}, onDepartureFromChange = () => {}, onDepartureToChange = () => {}, onPageChange, onEdit, onChangeCrew, onToggleActive, onDelete }: ScheduleTableProps) {
  const { t } = useTranslation("manager");
  const vehicleTypes = useMemo(() => { const seen = new Set<string>(); return vehicles.filter((vehicle) => { const key = vehicle.vehicleTypeId; if (!key || seen.has(key)) return false; seen.add(key); return true; }); }, [vehicles]);
  // Loại xe do nhà xe tự khai trong danh mục, không phải enum cố định — không
  // có bảng dịch nào phủ được. Ưu tiên tên BE trả, mã chỉ là phương án chót.
  function vehicleTypeLabel(vehicle?: VehicleOption) { return vehicle?.vehicleTypeName?.trim() || vehicle?.vehicleType?.trim() || "-"; }
  const paginatedSchedules = useMemo(() => schedules, [schedules]);
  const weekdayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const hasActiveFilters = Boolean(search || statusFilter || vehicleTypeFilter || routeFilter || driverFilter || dayOfWeekFilter || departureFrom || departureTo);
  const advancedFilterCount = Number(Boolean(vehicleTypeFilter)) + Number(Boolean(driverFilter)) + Number(Boolean(dayOfWeekFilter)) + Number(Boolean(departureFrom)) + Number(Boolean(departureTo));
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  function scheduleDayKeys(schedule: TripSchedule) { return schedule.dayOfWeek.map((day) => weekdayKeys[day - 1]).filter((day): day is (typeof weekdayKeys)[number] => Boolean(day)); }

  return <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
    <div className="border-b border-gray-100 p-5"><SectionHeader icon={<FiTruck />} title={t("trips.scheduleList")} subtitle={t("trips.scheduleListSubtitle")} /></div>
    <div className="border-t border-gray-100 p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(360px,1.4fr)_220px_minmax(180px,0.8fr)_auto] lg:items-end">
        <SearchInput
          label={t("trips.searchPlaceholder")}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("trips.searchPlaceholder")}
          inputClassName="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-vr-500 focus:bg-white"
        />
        <CustomSelect value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} aria-label={t("trips.filterStatus")} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">
          <option value="">{t("trips.allStatuses")}</option>
          <option value="open">{t("trips.scheduleStatus.open")}</option>
          <option value="draft">{t("trips.scheduleStatus.draft")}</option>
          <option value="blocked">{t("trips.scheduleStatus.blocked")}</option>
        </CustomSelect>
        <CustomSelect value={routeFilter} onChange={(event) => onRouteFilterChange(event.target.value)} aria-label={t("trips.filterRoute")} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">
          <option value="">{t("trips.allRoutes")}</option>
          {routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
        </CustomSelect>
        <button type="button" onClick={() => setShowAdvancedFilters((current) => !current)} aria-expanded={showAdvancedFilters} className={"inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-vr-500/30 " + (advancedFilterCount > 0 ? "border-vr-300 bg-vr-50 text-vr-800" : "border-gray-200 bg-white text-gray-700 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-900")}>
          <FiSliders aria-hidden="true" size={16} />
          {t("trips.advancedFilters")}{advancedFilterCount > 0 ? " (" + advancedFilterCount + ")" : ""}
        </button>
      </div>
      {showAdvancedFilters ? <div className="mt-3 grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="min-w-0">
          <span className="mb-1 block text-xs font-medium text-gray-500">{t("trips.filterDayOfWeek")}</span>
          <CustomSelect value={dayOfWeekFilter} onChange={(event) => onDayOfWeekFilterChange(event.target.value)} aria-label={t("trips.filterDayOfWeek")} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">
            <option value="">{t("trips.allDays")}</option>
            {weekdayKeys.map((day, index) => <option key={day} value={String(index + 1)}>{t("trips.weekdays." + day, { defaultValue: t("trips.weekdaysShort." + day) })}</option>)}
          </CustomSelect>
        </div>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">{t("trips.departureFromLabel")}</span>
          <CustomDateTimeInput type="time" value={departureFrom} onChange={(event) => onDepartureFromChange(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-vr-500 focus:ring-2 focus:ring-vr-100" placeholder={t("trips.departureFromPlaceholder")} />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">{t("trips.departureToLabel")}</span>
          <CustomDateTimeInput type="time" value={departureTo} onChange={(event) => onDepartureToChange(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-vr-500 focus:ring-2 focus:ring-vr-100" placeholder={t("trips.departureToPlaceholder")} />
        </label>
        <div className="min-w-0">
          <span className="mb-1 block text-xs font-medium text-gray-500">{t("trips.filterDriver")}</span>
          <CustomSelect value={driverFilter} onChange={(event) => onDriverFilterChange(event.target.value)} aria-label={t("trips.filterDriver")} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">
            <option value="">{t("trips.allDrivers")}</option>
            {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
          </CustomSelect>
        </div>
        <div className="min-w-0">
          <span className="mb-1 block text-xs font-medium text-gray-500">{t("trips.filterVehicleType")}</span>
          <CustomSelect value={vehicleTypeFilter} onChange={(event) => onVehicleTypeFilterChange(event.target.value)} aria-label={t("trips.filterVehicleType")} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">
            <option value="">{t("trips.allVehicleTypes")}</option>
            {vehicleTypes.map((vehicle) => <option key={vehicle.vehicleTypeId} value={vehicle.vehicleTypeId}>{vehicleTypeLabel(vehicle)}</option>)}
          </CustomSelect>
        </div>
      </div> : null}
      {hasActiveFilters ? <button type="button" onClick={() => { onSearchChange(""); onStatusFilterChange(""); onVehicleTypeFilterChange(""); onRouteFilterChange(""); onDriverFilterChange(""); onDayOfWeekFilterChange(""); onDepartureFromChange(""); onDepartureToChange(""); }} className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20" aria-label={t("trips.clearFilters")}>
        <FiX aria-hidden="true" size={15} />
        {t("trips.clearFilters")}
      </button> : null}
    </div>
    <div className="overflow-x-auto"><table className="w-full table-fixed divide-y divide-gray-100 text-center text-sm"><thead className="bg-gray-50 text-center text-xs font-semibold uppercase tracking-wide text-gray-500"><tr><th className="w-[160px] px-3 py-3">{t("trips.route")}</th><th className="w-[205px] px-2 py-3 text-left">{t("trips.schedule")}</th><th className="w-[175px] px-3 py-3 text-left">{t("trips.assignment")}</th><th className="w-[155px] whitespace-nowrap px-2 py-3">{t("trips.departure")}</th><th className="w-[95px] whitespace-nowrap px-3 py-3">{t("trips.fare")}</th><th className="w-[80px] px-2 py-3">{t("trips.status")}</th>{canManageSchedules ? <th className="sticky right-0 z-10 w-[155px] bg-gray-50 px-2 py-3 text-center">{t("trips.actions")}</th> : null}</tr></thead><tbody className="divide-y divide-gray-100">{isLoading ? <ScheduleTableSkeletonRows columns={canManageSchedules ? 7 : 6} /> : paginatedSchedules.length > 0 ? paginatedSchedules.map((schedule) => <tr key={schedule.id} className="hover:bg-gray-50"><td className="max-w-[240px] px-3 py-4 text-gray-700" title={schedule.routeName}><span className="block truncate">{schedule.routeName || optionLabel(routes, schedule.routeId, (route) => route.name)}</span>{/* Mã tuyến dưới tên tuyến: tên tuyến của hai nhà xe hay trùng nhau, mã mới là thứ tra cứu được. */}<span className="mt-0.5 block truncate font-mono text-xs tabular-nums text-gray-500">{displayBusinessCode(schedule.routeCode ?? routes.find((route) => route.id === schedule.routeId)?.code)}</span></td><td className="min-w-[220px] max-w-[260px] px-2 py-4 text-left align-top text-gray-700">{schedule.isOneTime ? <div className="flex flex-col items-start gap-2"><Badge tone="brand" className="gap-1.5"><FiCalendar aria-hidden="true" size={13} />{t("trips.summaryOnce")}</Badge><span className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-gray-500">{t("trips.scheduleOnceHint")}</span></div> : <div className="flex flex-col items-start gap-2"><Badge tone="info" className="gap-1.5"><FiRepeat aria-hidden="true" size={13} />{t("trips.scheduleKindRepeat")}</Badge><div className="flex flex-wrap gap-1" aria-label={t("trips.weekdaysLabel")}>{scheduleDayKeys(schedule).length > 0 ? scheduleDayKeys(schedule).map((day) => <span key={day} className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs font-semibold text-gray-600">{t("trips.weekdaysShort." + day)}</span>) : <span className="text-xs text-gray-600">-</span>}</div></div>}</td><td className="w-[175px] max-w-[175px] overflow-hidden px-3 py-4 text-left align-top"><span className="block truncate font-medium text-gray-700">{schedule.driverName || drivers.find((driver) => driver.id === schedule.driverId)?.name || t("vehicles.unassigned")}</span><span className="mt-1 block truncate text-xs text-gray-500">{schedule.vehiclePlate || vehicles.find((vehicle) => vehicle.id === schedule.vehicleId)?.plate || t("vehicles.unassigned")}{vehicles.find((vehicle) => vehicle.id === schedule.vehicleId)?.vehicleType ? " · " + vehicleTypeLabel(vehicles.find((vehicle) => vehicle.id === schedule.vehicleId)) : ""}</span></td><td className="whitespace-nowrap px-2 py-4 text-gray-700"><span className="block">{formatDateTime(schedule.departureAt)}</span><span className="text-xs text-gray-500">{t("trips.eta")}: {formatDateTime(schedule.arrivalEstimate)}</span></td><td className="whitespace-nowrap px-5 py-4 text-gray-700">{formatCurrency(schedule.baseFare === "" ? routes.find((route) => route.id === schedule.routeId)?.baseFare : schedule.baseFare, t("trips.routeFareFallback"))}</td><td className="px-2 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${schedule.status === "open" ? "bg-emerald-50 text-emerald-700" : schedule.status === "draft" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700"}`}>{t(`trips.scheduleStatus.${schedule.status}`)}</span></td>{/* Ghim cột Thao tác: bảng rộng hơn vùng nội dung ngay ở desktop 1440px nên 4 nút này bị đẩy ra ngoài khung. */}{canManageSchedules ? <td className="sticky right-0 z-10 bg-white px-2 py-4 text-right"><div className="inline-flex items-center gap-1"><button type="button" onClick={() => onEdit(schedule)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-900" title={t("trips.edit")} aria-label={t("trips.edit")}><FiEdit2 size={15} /></button><button type="button" onClick={() => onChangeCrew(schedule)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-900" title={t("trips.changeCrew")} aria-label={t("trips.changeCrew")}><FiUsers size={15} /></button><button type="button" onClick={() => onToggleActive(schedule)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700" title={schedule.status === "open" ? t("trips.deactivate") : t("trips.activate")} aria-label={schedule.status === "open" ? t("trips.deactivate") : t("trips.activate")}>{schedule.status === "open" ? <FiPause size={15} /> : <FiPlay size={15} />}</button><button type="button" onClick={() => onDelete(schedule)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700" title={t("trips.deleteSchedule")} aria-label={t("trips.deleteSchedule")}><FiTrash2 size={15} /></button></div></td> : null}</tr>) : <tr><td colSpan={canManageSchedules ? 7 : 6} className="px-5 py-8 text-center text-sm text-gray-500">{t("trips.noSchedules")}</td></tr>}</tbody></table></div>
    {!isLoading && schedules.length > 0 ? <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={onPageChange} /> : null}
  </section>;
}

function ScheduleTableSkeletonRows({ columns }: { columns: number }) { return <>{Array.from({ length: 4 }, (_, rowIndex) => <tr key={rowIndex} aria-hidden="true" data-testid={rowIndex === 0 ? "schedules-table-skeleton" : undefined}>{Array.from({ length: columns }, (_, columnIndex) => <td key={columnIndex} className="px-5 py-4"><div className="h-4 w-full animate-pulse rounded-md bg-slate-200" /></td>)}</tr>)}</>; }
