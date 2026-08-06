import { FiFilter, FiSearch } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import type { FleetVehicleMapPoint } from "./FleetMap";
import CustomSelect from "../../../components/CustomSelect";

export type FleetStatusFilter = "all" | FleetVehicleMapPoint["status"];

type FleetFilterBarProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  filterStatus: FleetStatusFilter;
  onFilterStatusChange: (value: FleetStatusFilter) => void;
};

export default function FleetFilterBar({
  searchTerm,
  onSearchTermChange,
  filterStatus,
  onFilterStatusChange,
}: FleetFilterBarProps) {
  const { t } = useTranslation("manager");

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t("gps.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50/50 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-vr-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-vr-500/35"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <FiFilter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <CustomSelect
              value={filterStatus}
              onChange={(e) =>
                onFilterStatusChange(e.target.value as FleetStatusFilter)
              }
              className="appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-8 text-sm font-medium text-gray-800 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
            >
              <option value="all">{t("gps.allStatus")}</option>
              <option value="moving">{t("gps.moving")}</option>
              <option value="idle">{t("gps.stopped")}</option>
              <option value="offline">{t("gps.signalLostStatus")}</option>
              <option value="lost">{t("gps.gpsSignalLost")}</option>
            </CustomSelect>
          </div>
        </div>
      </div>
    </div>
  );
}
