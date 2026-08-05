// Modal xác nhận gỡ điểm dừng khỏi tuyến
import { useTranslation } from "react-i18next";
import { FiTrash2 } from "react-icons/fi";
import Modal from "../../../components/Modal";
import type { RouteStopDraft } from "./types";

type RemoveRouteStopModalProps = {
  item: RouteStopDraft | null;
  onClose: () => void;
  onConfirm: (item: RouteStopDraft) => void;
};

export default function RemoveRouteStopModal({
  item,
  onClose,
  onConfirm,
}: RemoveRouteStopModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title={t("routes.removeRouteStopTitle")}
      subtitle={t("routes.removeRouteStopSubtitle")}
      icon={<FiTrash2 />}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (item) {
                onConfirm(item);
              }
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            {tc("delete")}
          </button>
        </>
      }
    >
      <p className="text-sm leading-6 text-gray-600">
        {t("routes.removeRouteStopConfirm", {
          stopName: item?.stopName ?? "",
        })}
      </p>
    </Modal>
  );
}
