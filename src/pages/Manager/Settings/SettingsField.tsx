import type { ReactNode } from "react";
import { labelClass } from "../../../components/form/formClasses";

/** Nhãn + hint dùng chung cho các tab của màn Cấu hình. */
export function SettingsField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelClass}>
        {label}
        {required && <span className="text-rose-700"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-600">{hint}</p>}
    </div>
  );
}
