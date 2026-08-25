// Modal từ chối yêu cầu gói riêng. Lý do BẮT BUỘC và hiển thị nguyên văn cho
// nhà xe, nên placeholder nhắc admin viết cho người đọc chứ không phải ghi chú
// nội bộ.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiXCircle } from "react-icons/fi";
import Modal from "../../../components/Modal";
import { Button } from "../../../components/ui/Button";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import {
  operatorLabel,
  type CustomPlanRequestView,
} from "../../../utils/customPlanRequest";

// Cùng lý do với ApproveCustomPlanModal: nơi gọi render có điều kiện kèm key,
// nên ô lý do luôn rỗng khi mở cho một yêu cầu mới.
type RejectRequestModalProps = {
  request: CustomPlanRequestView;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
};

export default function RejectRequestModal({
  request,
  isSaving,
  onClose,
  onSubmit,
}: RejectRequestModalProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [reason, setReason] = useState("");

  return (
    <Modal
      open
      onClose={onClose}
      icon={<FiXCircle size={20} />}
      title={t("customPlans.rejectTitle", {
        operator: operatorLabel(request),
      })}
      subtitle={t("customPlans.rejectSubtitle")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            variant="danger"
            data-testid="reject-custom-plan-submit"
            onClick={() => onSubmit(reason.trim())}
            disabled={isSaving || reason.trim().length === 0}
          >
            {t("customPlans.rejectAction")}
          </Button>
        </>
      }
    >
      <div>
        <label className={labelClass} htmlFor="reject-reason">
          {t("customPlans.rejectReasonLabel")}
        </label>
        <textarea
          id="reject-reason"
          data-testid="reject-reason-input"
          className={inputClass + " min-h-[110px] resize-y"}
          value={reason}
          placeholder={t("customPlans.rejectReasonPlaceholder")}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
        />
      </div>
    </Modal>
  );
}
