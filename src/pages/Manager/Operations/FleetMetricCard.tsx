import type { ReactNode } from "react";

type FleetMetricCardProps = {
  label: string;
  value: number;
  hint: string;
  /** Class màu cho con số (mỗi card một màu riêng) */
  valueClass: string;
  /** Class nền + màu chữ cho ô icon */
  iconClass: string;
  icon: ReactNode;
};

export default function FleetMetricCard({
  label,
  value,
  hint,
  valueClass,
  iconClass,
  icon,
}: FleetMetricCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
          <p className="mt-1 text-xs text-gray-500">{hint}</p>
        </div>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconClass}`}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}
