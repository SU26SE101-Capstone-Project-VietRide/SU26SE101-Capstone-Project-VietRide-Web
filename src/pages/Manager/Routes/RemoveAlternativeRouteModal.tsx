// Modal xác nhận NGƯNG ÁP DỤNG một tuyến thay thế — BE xoá mềm (deactivate),
// bản ghi giữ nguyên và khôi phục được, nên nội dung không nói "không thể hoàn
// tác" như modal xoá cứng.
import { useTranslation } from "react-i18next";
import { FiSlash } from "react-icons/fi";
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
      icon={<FiSlash />}
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
            {t("routes.deactivateAlternativeConfirmAction")}
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
