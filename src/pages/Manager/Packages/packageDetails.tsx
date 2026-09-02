import type { ReactNode } from "react";
import { formatNumber } from "./subscriptionHelpers";

// Nhóm component hiển thị siêu nhỏ của màn Packages — named export (ngoại lệ §3
// CODE_CONVENTIONS cho file gom component liên quan chặt).

export function UsageItem({
  icon,
  label,
  used,
  limit,
}: {
  icon: ReactNode;
  label: string;
  used: number;
  limit: number;
}) {
  const rawUsagePercent = limit > 0 ? (used / limit) * 100 : used > 0 ? 100 : 0;
  const usagePercent = Math.min(100, Math.max(0, rawUsagePercent));
  const progressTone =
    usagePercent >= 100
      ? "bg-red-500"
      : usagePercent >= 80
        ? "bg-amber-500"
        : "bg-vr-500";

  return (
    <div
      aria-label={`${label}: ${formatNumber(used)}/${formatNumber(limit)}`}
      className="min-w-0 rounded-xl border border-white/80 bg-white/75 p-3 shadow-sm backdrop-blur-sm"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
          {icon}
        </span>
        <p className="min-w-0 text-xs font-medium leading-4 text-gray-600">
          {label}
        </p>
      </div>
      <p className="mt-2 text-lg font-bold leading-none text-gray-900">
        {formatNumber(used)}
        <span className="text-sm font-semibold text-gray-400">
          /{formatNumber(limit)}
        </span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200/80">
        <div
          className={`h-full rounded-full transition-[width] ${progressTone}`}
          style={{ width: `${usagePercent}%` }}
        />
      </div>
    </div>
  );
}

export function PendingUpgradeItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs text-amber-700">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

export function LimitRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg bg-white px-3 py-2.5 shadow-sm ring-1 ring-gray-100">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-vr-50 text-vr-600">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-gray-500" title={label}>
          {label}
        </p>
        <p className="mt-0.5 font-bold leading-none text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-gray-50 px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}
