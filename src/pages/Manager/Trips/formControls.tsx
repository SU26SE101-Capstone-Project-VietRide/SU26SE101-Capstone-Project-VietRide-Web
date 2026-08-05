// Cụm primitive nhỏ của màn Trips (ngoại lệ §3: named exports, mỗi component ≤ 50 dòng).
import type { ReactNode } from "react";
import CurrencyInput from "../../../components/CurrencyInput";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CustomSelect from "../../../components/CustomSelect";
import { inputClass, labelClass } from "../../../components/form/formClasses";

type MetricCardProps = {
  label: string;
  value: number;
  helper?: string;
  isLoading?: boolean;
};

export function MetricCard({
  label,
  value,
  helper,
  isLoading = false,
}: MetricCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      {isLoading ? (
        // Đang tải: skeleton thay cho số 0 gây hiểu nhầm "không có dữ liệu"
        <div
          className="mt-2 h-8 w-16 animate-pulse rounded-md bg-slate-200"
          aria-hidden="true"
          data-testid="metric-card-skeleton"
        />
      ) : (
        <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      )}
      {helper ? <p className="mt-2 text-xs text-gray-500">{helper}</p> : null}
    </div>
  );
}

type SectionHeaderProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
};

export function SectionHeader({ icon, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}

type PanelProps = {
  title: string;
  icon: ReactNode;
  children: ReactNode;
};

export function Panel({ title, icon, children }: PanelProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
        <span className="text-vr-700">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  currency?: boolean;
};

export function Input({
  label,
  value,
  onChange,
  type = "text",
  currency = false,
}: InputProps) {
  const isCustomDateTime =
    type === "date" ||
    type === "datetime-local" ||
    type === "time" ||
    type === "month" ||
    type === "week";

  return (
    <div>
      <label className={labelClass}>{label}</label>
      {isCustomDateTime ? (
        <CustomDateTimeInput
          className={inputClass}
          value={value}
          type={type}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : currency ? (
        <CurrencyInput
          className={inputClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={inputClass}
          value={value}
          type={type}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

type SelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
};

export function Select({ label, value, onChange, children }: SelectProps) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <CustomSelect
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </CustomSelect>
    </div>
  );
}
