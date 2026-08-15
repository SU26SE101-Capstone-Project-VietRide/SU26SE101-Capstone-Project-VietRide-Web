import { useTranslation } from "react-i18next";
import { FiCheck, FiX } from "react-icons/fi";
import Modal from "../../../components/Modal";
import { type AdminOperator } from "../../../api/vietride";
import { inputClass, labelClass } from "../../../components/form/formClasses";

// Nhóm 3 modal xác nhận nhỏ liên quan chặt (duyệt / từ chối / tạm ngưng) —
// dùng named export theo ngoại lệ §3 CODE_CONVENTIONS (như DetailLayout).

type OperatorApproveModalProps = {
  open: boolean;
  onClose: () => void;
  operator: AdminOperator | null;
  onConfirm: () => void | Promise<void>;
  /** Đang gửi request — khoá nút để hai lần bấm không gửi hai lệnh */
  busy?: boolean;
};

export function OperatorApproveModal({
  open,
  onClose,
  operator,
  onConfirm,
  busy = false,
}: OperatorApproveModalProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<FiCheck size={20} />}
      title={t("operators.approveTitle")}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("operators.approve")}
          </button>
        </>
      }
    >
      {operator && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <p className="text-sm text-emerald-900">
            {t("operators.approveConfirm", {
              name: operator.name,
            })}
          </p>
        </div>
      )}
    </Modal>
  );
}

type OperatorRejectModalProps = {
  open: boolean;
  onClose: () => void;
  operator: AdminOperator | null;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void | Promise<void>;
  /** Đang gửi request — khoá nút để hai lần bấm không gửi hai lệnh */
  busy?: boolean;
};

export function OperatorRejectModal({
  open,
  onClose,
  operator,
  reason,
  onReasonChange,
  onConfirm,
  busy = false,
}: OperatorRejectModalProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<FiX size={20} />}
      title={t("operators.rejectTitle")}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("operators.rejectConfirm")}
          </button>
        </>
      }
    >
      {operator && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-900">
              {t("operators.rejectConfirmMsg", {
                name: operator.name,
              })}
            </p>
          </div>
          <div>
            <label className={labelClass}>
              {t("operators.rejectReason")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={t("operators.rejectReasonPlaceholder")}
              className={inputClass + " min-h-25"}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}

type OperatorSuspendModalProps = {
  open: boolean;
  onClose: () => void;
  operator: AdminOperator | null;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void | Promise<void>;
  /** Đang gửi request — khoá nút để hai lần bấm không gửi hai lệnh */
  busy?: boolean;
};

export function OperatorSuspendModal({
  open,
  onClose,
  operator,
  reason,
  onReasonChange,
  onConfirm,
  busy = false,
}: OperatorSuspendModalProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<FiX size={20} />}
      title={t("operators.suspendTitle")}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("operators.suspendConfirm")}
          </button>
        </>
      }
    >
      {operator && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-900">
              {t("operators.suspendConfirmMsg", {
                name: operator.name,
              })}
            </p>
          </div>
          <div>
            <label className={labelClass}>
              {t("operators.suspendReason")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={t("operators.suspendReasonPlaceholder")}
              className={inputClass + " min-h-25"}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
