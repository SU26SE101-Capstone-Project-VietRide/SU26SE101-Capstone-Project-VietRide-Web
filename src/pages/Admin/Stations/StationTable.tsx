// Bảng danh sách trạm + phân trang; hành động chọn/merge/bật-tắt uỷ quyền về index
import { useTranslation } from "react-i18next";
import { FiEdit2, FiGitMerge, FiPower } from "react-icons/fi";
import { type AdminStation } from "../../../api/vietride";
import Pagination from "../../../components/Pagination";
import { formatDateTime } from "../../../utils/date";
import { iconButtonClass } from "./stationHelpers";

type StationTableProps = {
  stations: AdminStation[];
  isLoading: boolean;
  isSaving: boolean;
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onEdit: (station: AdminStation) => void;
  onMerge: (station: AdminStation) => void;
  onToggle: (station: AdminStation) => void;
};

export default function StationTable({
  stations,
  isLoading,
  isSaving,
  page,
  pageSize,
  totalItems,
  onPageChange,
  onEdit,
  onMerge,
  onToggle,
}: StationTableProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  return (
    <>
      <div>
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[27%]" />
            <col className="w-[21%]" />
            <col className="w-[17%]" />
            <col className="w-[13%]" />
            <col className="w-[21%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold whitespace-nowrap text-gray-600">
              <th className="px-4 py-3">{t("stations.stationName")}</th>
              <th className="px-4 py-3 text-center">{t("stations.city")}</th>
              <th className="px-4 py-3 text-center">{t("stations.shuttle")}</th>
              <th className="px-4 py-3 text-center">{tc("status")}</th>
              <th className="px-4 py-3 text-center">{tc("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((station) => (
              <tr
                key={station.id}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900">{station.name}</p>

                  <p className="mt-1 text-xs text-gray-400">
                    {formatDateTime(station.updatedAt)}
                  </p>
                </td>
                <td className="px-4 py-3 text-center text-gray-700">
                  {[station.city, station.ward].filter(Boolean).join(" / ") ||
                    "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 pr-6 text-center text-gray-700">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${station.supportsShuttle ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{station.supportsShuttle ? t("stations.shuttleVehicle") : t("stations.nonShuttleVehicle")}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 pl-6 text-center">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                      station.isActive === false
                        ? "bg-slate-100 text-slate-600"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {station.isActive === false ? tc("inactive") : tc("active")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      className={`${iconButtonClass} text-vr-700 hover:bg-vr-50`}
                      onClick={() => onEdit(station)}
                      title={tc("edit")}
                      aria-label={tc("edit")}
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      type="button"
                      className={`${iconButtonClass} text-amber-700 hover:bg-amber-50`}
                      onClick={() => onMerge(station)}
                      title={t("stations.merge")}
                      aria-label={t("stations.merge")}
                    >
                      <FiGitMerge />
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      className={`${iconButtonClass} text-rose-600 hover:bg-rose-50`}
                      onClick={() => onToggle(station)}
                      title={
                        station.isActive === false ? tc("enable") : tc("disable")
                      }
                      aria-label={
                        station.isActive === false ? tc("enable") : tc("disable")
                      }
                    >
                      <FiPower />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && stations.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-gray-500"
                >
                  {t("stations.empty")}
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-gray-500"
                >
                  {t("stations.loading")}
                </td>
              </tr>
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
    </>
  );
}
