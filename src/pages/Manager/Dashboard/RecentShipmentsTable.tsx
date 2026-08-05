import { useTranslation } from "react-i18next";
import { FiDownload, FiEye } from "react-icons/fi";
import Pagination from "../../../components/Pagination";
import { formatCurrency } from "../../../utils/currency";
import type { Shipment } from "./dashboardHelpers";

type RecentShipmentsTableProps = {
  shipments: Shipment[];
  isLoading: boolean;
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onExport: () => void;
  onViewShipment: (shipmentId: string) => void;
};

// Bảng shipment (parcel) gần đây kèm export CSV + phân trang
export default function RecentShipmentsTable({
  shipments,
  isLoading,
  page,
  pageSize,
  totalItems,
  onPageChange,
  onExport,
  onViewShipment,
}: RecentShipmentsTableProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("dashboard.recentShipments")}
        </h2>
        <button
          type="button"
          onClick={onExport}
          disabled={shipments.length === 0}
          className="flex cursor-pointer items-center gap-2 text-sm font-medium text-vr-600 hover:text-vr-700 disabled:cursor-not-allowed disabled:text-gray-400"
        >
          <FiDownload size={16} />
          {tc("exportCsv")}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">{t("dashboard.parcelCode")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">{t("dashboard.route")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">{t("dashboard.sender")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">{t("dashboard.recipient")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">{t("dashboard.amount")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">{tc("status")}</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">{tc("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {shipments.map((shipment) => (
              <tr key={shipment.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{shipment.code}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{shipment.route}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{shipment.sender}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{shipment.recipient}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {formatCurrency(shipment.cost)}
                </td>
                <td className="px-4 py-3"><ShipmentStatusBadge status={shipment.status} /></td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => onViewShipment(shipment.id)}
                    className="cursor-pointer rounded p-2 text-vr-600 hover:bg-vr-50"
                    title={tc("details")}
                    aria-label={`${tc("details")} ${shipment.code}`}
                  >
                    <FiEye size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && shipments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                  {t("dashboard.noShipments")}
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
    </section>
  );
}

// Badge trạng thái shipment — chỉ màn Dashboard dùng, giữ inline sau component chính
function ShipmentStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("manager");
  const normalized = status.toUpperCase();
  const isCompleted = normalized === "DELIVERED" || normalized === "COMPLETED";
  const isInTransit = normalized === "IN_TRANSIT" || normalized === "LOADED";
  const isCancelled = normalized === "CANCELLED" || normalized === "REJECTED";
  const style = isCompleted
    ? "bg-emerald-50 text-emerald-700"
    : isInTransit
      ? "bg-sky-50 text-sky-700"
      : isCancelled
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-700";
  const label = isCompleted
    ? t("dashboard.completed")
    : isInTransit
      ? t("dashboard.inTransit")
      : isCancelled
        ? t("dashboard.cancelled")
        : t("dashboard.waiting");

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
