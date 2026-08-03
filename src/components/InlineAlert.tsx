import type { ReactNode } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiInfo,
  FiX,
} from "react-icons/fi";

type InlineAlertTone = "success" | "error" | "warning" | "info";

type InlineAlertProps = {
  tone: InlineAlertTone;
  children: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
};

const toneClasses: Record<InlineAlertTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

const toneIcons = {
  success: FiCheckCircle,
  error: FiAlertCircle,
  warning: FiAlertCircle,
  info: FiInfo,
};

export default function InlineAlert({
  tone,
  children,
  onDismiss,
  dismissLabel = "Close",
}: InlineAlertProps) {
  const Icon = toneIcons[tone];

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${toneClasses[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 transition hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-current/30"
          aria-label={dismissLabel}
        >
          <FiX size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
