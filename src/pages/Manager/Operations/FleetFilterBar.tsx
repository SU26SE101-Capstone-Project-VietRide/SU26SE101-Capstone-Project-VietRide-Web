import { FiFilter } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import type { FleetVehicleMapPoint } from "../../../components/fleetMapPoint";
import CustomSelect from "../../../components/CustomSelect";
import { SearchInput } from "../../../components/ui/SearchInput";

export type FleetStatusFilter = "all" | FleetVehicleMapPoint["status"];

/**
 * Lọc theo LOẠI xe, tách hẳn khỏi bộ lọc trạng thái: hai chiều độc lập nên
 * người dùng lọc được "xe trung chuyển đang mất tín hiệu". Nhét chung một
 * dropdown thì chọn cái này là mất cái kia.
 */
export type FleetKindFilter = "all" | "trip" | "shuttle";

const kindFilters: FleetKindFilter[] = ["all", "trip", "shuttle"];

type FleetFilterBarProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  filterStatus: FleetStatusFilter;
  onFilterStatusChange: (value: FleetStatusFilter) => void;
  filterKind: FleetKindFilter;
  onFilterKindChange: (value: FleetKindFilter) => void;
  /** Số xe trung chuyển đang có — 0 thì ẩn hẳn nhóm chip cho đỡ rối */
  shuttleCount: number;
};

export default function FleetFilterBar({
  searchTerm,
  onSearchTermChange,
  filterStatus,
  onFilterStatusChange,
  filterKind,
  onFilterKindChange,
  shuttleCount,
}: FleetFilterBarProps) {
  const { t } = useTranslation("manager");

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center p-4">
        <SearchInput
          label={t("gps.searchPlaceholder")}
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          placeholder={t("gps.searchPlaceholder")}
          inputClassName="w-full rounded-lg border border-gray-200 bg-gray-50/50 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-500 focus:border-vr-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-vr-500/35"
          wrapperClassName="relative min-w-0 flex-1"
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <FiFilter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <CustomSelect
              value={filterStatus}
              onChange={(e) =>
                onFilterStatusChange(e.target.value as FleetStatusFilter)
              }
              className="appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-8 text-sm font-medium text-gray-800 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
            >
              <option value="all">{t("gps.allStatus")}</option>
              <option value="disrupted">{t("gps.disruptedStatus")}</option>
              <option value="moving">{t("gps.moving")}</option>
              <option value="idle">{t("gps.stopped")}</option>
              <option value="offline">{t("gps.signalLostStatus")}</option>
              <option value="lost">{t("gps.gpsSignalLost")}</option>
            </CustomSelect>
          </div>

          {shuttleCount > 0 && (
            <div
              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1"
              role="group"
              aria-label={t("gps.filterKindLabel")}
            >
              {kindFilters.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => onFilterKindChange(kind)}
                  aria-pressed={filterKind === kind}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    filterKind === kind
                      ? "bg-white text-vr-800 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {t(`gps.filterKind.${kind}`)}
                  {kind === "shuttle" && (
                    <span className="ml-1.5 text-xs font-semibold text-gray-500">
                      {shuttleCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
