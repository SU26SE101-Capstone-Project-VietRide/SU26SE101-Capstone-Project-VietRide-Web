import type { ReactNode } from "react";
import { FiX } from "react-icons/fi";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
};

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  wide,
}: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex max-h-[min(92vh,900px)] w-full flex-col rounded-xl border border-gray-200 bg-white shadow-xl ${
          wide ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              {subtitle && (
                <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Đóng"
          >
            <FiX size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex justify-end gap-2 bg-white rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
