// Nhóm primitive UI nhỏ dùng riêng cho màn hàng đợi bưu kiện
// (ngoại lệ named export theo CODE_CONVENTIONS.md §3 — file nhóm component siêu nhỏ liên quan chặt)
import type { ReactNode } from "react";
import { inputClass } from "./parcelQueueHelpers";

export function ActionBox({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
      <h3 className="font-bold text-gray-900">{title}</h3>
      {children}
    </section>
  );
}

export function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </span>
      <input
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </span>
      <textarea
        className={`${inputClass} min-h-24`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function ActionButton({
  children,
  icon,
  onClick,
  disabled,
  tone = "primary",
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  disabled: boolean;
  tone?: "primary" | "success" | "danger";
}) {
  const tones = {
    primary: "border-vr-200 bg-white text-vr-800 hover:bg-vr-50",
    success:
      "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
    danger: "border-red-200 bg-white text-red-700 hover:bg-red-50",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {icon}
      {children}
    </button>
  );
}
