import type { ReactNode } from "react";
import { formatNumber } from "./subscriptionHelpers";

// Nhóm component hiển thị siêu nhỏ của màn Packages — named export (ngoại lệ §3
// CODE_CONVENTIONS cho file gom component liên quan chặt).

export function UsageItem({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  return (
    <div>
      <p className="text-gray-600">{label}</p>
      <p className="font-semibold text-gray-900">
        {formatNumber(used)}/{formatNumber(limit)}
      </p>
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
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-vr-500">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-semibold text-gray-900">{value}</p>
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
