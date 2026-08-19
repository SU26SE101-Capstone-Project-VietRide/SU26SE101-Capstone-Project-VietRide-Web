import type { ReactNode } from "react";
import { FiAlertTriangle, FiCheckCircle, FiInfo } from "react-icons/fi";
import Modal from "./Modal";
import { Button } from "./ui/Button";

type ConfirmTone = "danger" | "warning" | "success";
type ConfirmModalProps = {
  open: boolean; title: string; message: string; confirmLabel: string; cancelLabel: string;
  tone?: ConfirmTone; busy?: boolean; children?: ReactNode; onClose: () => void; onConfirm: () => void;
};
const toneStyles: Record<ConfirmTone, { icon: string; button: string }> = {
  danger: { icon: "bg-red-50 text-red-600", button: "bg-red-600 hover:bg-red-700" },
  warning: { icon: "bg-amber-50 text-amber-600", button: "bg-amber-500 hover:bg-amber-600" },
  success: { icon: "bg-emerald-50 text-emerald-600", button: "bg-emerald-600 hover:bg-emerald-700" },
};

export function ConfirmModal({ open, title, message, confirmLabel, cancelLabel, tone = "danger", busy = false, children, onClose, onConfirm }: ConfirmModalProps) {
  const styles = toneStyles[tone];
  const icon = tone === "danger" ? <FiAlertTriangle /> : tone === "success" ? <FiCheckCircle /> : <FiInfo />;
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={title}
      icon={<span className={`flex h-10 w-10 items-center justify-center rounded-lg ${styles.icon}`}>{icon}</span>}
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>{cancelLabel}</Button><button type="button" onClick={onConfirm} disabled={busy} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}>{confirmLabel}</button></>}
    >
      <div className="space-y-4"><p className="text-sm leading-6 text-gray-700">{message}</p>{children}</div>
    </Modal>
  );
}
