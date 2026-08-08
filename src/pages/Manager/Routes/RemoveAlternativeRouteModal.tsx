// Modal xác nhận xoá một tuyến thay thế — cùng pattern RemoveRouteStopModal
import { useTranslation } from "react-i18next";
import { FiTrash2 } from "react-icons/fi";
import Modal from "../../../components/Modal";
import type { AlternativeRoute } from "../../../api/vietride";

type RemoveAlternativeRouteModalProps = {
  item: AlternativeRoute | null;
  onClose: () => void;
  onConfirm: (item: AlternativeRoute) => void;
};

export default function RemoveAlternativeRouteModal({
  item,
  onClose,
  onConfirm,
}: RemoveAlternativeRouteModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title={t("routes.removeAlternativeRouteTitle")}
      subtitle={t("routes.removeAlternativeRouteSubtitle")}
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
        {t("routes.removeAlternativeRouteConfirm", {
          name: item?.name ?? "",
        })}
      </p>
    </Modal>
  );
}
