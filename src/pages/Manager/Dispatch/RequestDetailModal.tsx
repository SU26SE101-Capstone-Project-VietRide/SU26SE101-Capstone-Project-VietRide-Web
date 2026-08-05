// Modal chi tiết yêu cầu trung chuyển — tách từ index.tsx.
import { useTranslation } from "react-i18next";
import { FiMapPin } from "react-icons/fi";
import Modal from "../../../components/Modal";
import { DetailItem, DetailSection } from "../../../components/DetailLayout";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import {
  STATUS_CLASS,
  type RequestStatus,
  type RequestType,
  type ShuttleRequest,
} from "./dispatchHelpers";

type RequestDetailModalProps = {
  open: boolean;
  onClose: () => void;
  request: ShuttleRequest | null;
  canDispatchShuttle: boolean;
  onAssign: () => void;
  statusLabel: (status: RequestStatus) => string;
  requestTypeLabel: (type: RequestType) => string;
};

export default function RequestDetailModal({
  open,
  onClose,
  request,
  canDispatchShuttle,
  onAssign,
  statusLabel,
  requestTypeLabel,
}: RequestDetailModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("dispatch.detailTitle")}
      wide
    >
      {request && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem
              label={t("dispatch.requestCodeLabel")}
              value={<span className="font-mono">{request.id}</span>}
            />
            <DetailItem
              label={tc("status")}
              value={
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[request.status]}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  {statusLabel(request.status)}
                </span>
              }
            />
          </div>

          <DetailSection title={t("dispatch.customerInfo")}>
            <DetailItem
              label={t("dispatch.customerName")}
              value={request.customerName}
            />
            <DetailItem label={tc("phone")} value={formatVietnamPhoneForDisplay(request.phone)} />
          </DetailSection>

          <DetailSection title={t("dispatch.tripInfo")} columns="three">
            <DetailItem
              label={t("dispatch.tripCode")}
              value={request.trip}
            />
            <DetailItem
              label={t("dispatch.type")}
              value={requestTypeLabel(request.type)}
            />
            <DetailItem label={tc("time")} value={request.time} />
          </DetailSection>

          <DetailSection title={t("dispatch.addressAndNotes")}>
            <DetailItem
              label={t("dispatch.address")}
              value={
                <span className="flex items-start gap-2">
                  <FiMapPin className="mt-0.5 shrink-0" />
                  {request.address}
                </span>
              }
            />
            {request.note && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
                <p className="text-blue-700">{request.note}</p>
              </div>
            )}
          </DetailSection>

          {request.assignedDriver && (
            <DetailSection title={t("dispatch.assignedVehicle")} columns="three">
              <DetailItem
                label={t("dispatch.driverLabel")}
                value={request.assignedDriver}
              />
              <DetailItem
                label={t("dispatch.plateLabel")}
                value={request.assignedPlate}
              />
              <DetailItem
                label={t("dispatch.vehicleLabel")}
                value={request.assignedCap}
              />
            </DetailSection>
          )}

          <div className="flex gap-3 border-t pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
            >
              {tc("close")}
            </button>
            {request.status === "pending" && canDispatchShuttle && (
              <button
                onClick={onAssign}
                className="flex-1 px-4 py-2 bg-vr-500 hover:bg-vr-600 text-white font-medium rounded-lg transition"
              >
                {t("dispatch.assignVehicle")}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
