// Bảng danh sách yêu cầu trung chuyển — tách từ index.tsx.
import { useTranslation } from "react-i18next";
import { FiEye, FiPhone, FiTruck } from "react-icons/fi";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import {
  STATUS_CLASS,
  type RequestStatus,
  type RequestType,
  type ShuttleRequest,
} from "./dispatchHelpers";

const tableActionClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700";

type RequestTableProps = {
  requests: ShuttleRequest[];
  isLoading: boolean;
  canDispatchShuttle: boolean;
  onAssign: (request: ShuttleRequest) => void;
  onOpenDetail: (request: ShuttleRequest) => void;
  statusLabel: (status: RequestStatus) => string;
  requestTypeLabel: (type: RequestType) => string;
};

export default function RequestTable({
  requests,
  isLoading,
  canDispatchShuttle,
  onAssign,
  onOpenDetail,
  statusLabel,
  requestTypeLabel,
}: RequestTableProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-3 text-left font-semibold text-gray-700">
              {t("dispatch.code")}
            </th>
            <th className="px-3 py-3 text-left font-semibold text-gray-700">
              {t("dispatch.customer")}
            </th>
            <th className="px-3 py-3 text-left font-semibold text-gray-700">
              {t("dispatch.trip")}
            </th>
            <th className="px-3 py-3 text-left font-semibold text-gray-700">
              {t("dispatch.type")}
            </th>
            <th className="px-3 py-3 text-left font-semibold text-gray-700">
              {t("dispatch.vehicleDriver")}
            </th>
            <th className="px-3 py-3 text-left font-semibold text-gray-700">
              {tc("status")}
            </th>
            <th className="px-3 py-3 text-left font-semibold text-gray-700">
              {tc("actions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr
              key={r.id}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="px-3 py-3 text-xs font-mono text-gray-500">
                {r.id}
              </td>
              <td className="px-3 py-3">
                <div className="font-semibold text-gray-900">
                  {r.customerName}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <FiPhone size={12} /> {formatVietnamPhoneForDisplay(r.phone)}
                </div>
              </td>
              <td className="px-3 py-3 text-gray-700">{r.trip}</td>
              <td className="px-3 py-3">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold text-white ${r.type === "Đón" ? "bg-blue-600" : "bg-teal-600"}`}
                >
                  {requestTypeLabel(r.type)}
                </span>
              </td>
              <td className="px-3 py-3">
                {r.assignedDriver ? (
                  <div className="text-xs">
                    <div className="font-medium text-gray-900">
                      {r.assignedDriver}
                    </div>
                    <div className="text-gray-500">{r.assignedPlate}</div>
                  </div>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-3 py-3">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[r.status]}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                  {statusLabel(r.status)}
                </span>
              </td>
              <td className="px-3 py-3">
                <div className="flex gap-2">
                  {r.status === "pending" && canDispatchShuttle && (
                    <button
                      type="button"
                      onClick={() => onAssign(r)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-vr-600 text-white hover:bg-vr-700"
                      title={t("dispatch.assignVehicle")}
                      aria-label={t("dispatch.assignVehicle")}
                    >
                      <FiTruck size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenDetail(r)}
                    className={tableActionClass}
                    title={tc("details")}
                    aria-label={tc("details")}
                  >
                    <FiEye size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {requests.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="px-3 py-8 text-center text-sm text-gray-500"
              >
                {isLoading ? t("dispatch.loading") : t("dispatch.noRequests")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
