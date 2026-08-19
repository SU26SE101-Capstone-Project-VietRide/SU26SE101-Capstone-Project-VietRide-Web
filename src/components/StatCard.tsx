import type { ReactNode } from "react";
import { Badge } from "../components/ui/Badge";

/**
 * Nhãn KPI xuống tối đa 2 dòng thay vì `truncate`.
 *
 * Với `truncate`, trên laptop 1280–1366px (rất phổ biến ở văn phòng) các nhãn
 * tài chính dài bị cắt cụt giữa chừng — đo được "Tổng tiền cần thanh toán" chỉ
 * còn 142/156px, "Người dùng hoạt độ...". Thẻ cao cố định 128px nên hai dòng
 * vẫn vừa khung, không đẩy layout.
 */
const labelClass = "min-w-0 line-clamp-2 [overflow-wrap:anywhere]";

export type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  iconClassName?: string;
  badge?: ReactNode;
  danger?: boolean;
  trend?: ReactNode;
  trendTitle?: string;
  labelInline?: boolean;
  helper?: ReactNode;
  trendClassName?: string;
  onClick?: () => void;
  isLoading?: boolean;
};

export function StatCard({
  label,
  value,
  icon,
  iconClassName,
  badge,
  danger = false,
  trend,
  trendTitle,
  labelInline = true,
  helper,
  trendClassName = "text-gray-500",
  onClick,
  isLoading = false,
}: StatCardProps) {
  return (
    <div className={"flex h-[128px] flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm " + (onClick ? "cursor-pointer text-left transition hover:border-vr-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-vr-500/30" : "")} onClick={onClick} onKeyDown={(event) => { if (onClick && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onClick(); } }} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex min-w-0 items-center ${labelInline ? "gap-3" : ""}`}>
          {icon && (
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClassName ?? "bg-slate-100 text-slate-700"}`}>
              {icon}
            </div>
          )}
          {labelInline && <p className={`${labelClass} text-sm text-gray-500`}>{label}</p>}
        </div>
        {trend !== undefined && (
          <span title={trendTitle} className={`text-xs font-semibold ${trendClassName}`}>
            {trend}
          </span>
        )}
      </div>
      <div className="mt-auto min-w-0">
        {!labelInline && <p className={`${labelClass} text-sm text-gray-500`}>{label}</p>}
        {isLoading ? (
          <div
            className="mt-2 h-8 w-16 animate-pulse rounded-md bg-slate-200"
            aria-hidden="true"
            data-testid="stat-card-skeleton"
          />
        ) : (
          <p className="mt-1 truncate text-2xl font-bold text-gray-900">{value}</p>
        )}
        {helper && <p className="mt-1 truncate text-xs text-gray-500">{helper}</p>}
        {badge && (
          <Badge tone={danger ? "danger" : "success"} className="mt-1">
            {badge}
          </Badge>
        )}
      </div>
    </div>
  );
}