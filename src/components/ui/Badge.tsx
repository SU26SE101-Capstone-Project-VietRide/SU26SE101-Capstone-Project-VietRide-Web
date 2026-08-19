import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

/**
 * Pill trạng thái dùng chung.
 *
 * Mọi cặp màu ở đây đều là nền `-50`/`-100` với chữ `-700`/`-800` — đã kiểm để
 * đạt 4,5:1. Trước đây 50 pill viết tay mỗi chỗ một cặp, trong đó có những cặp
 * chữ nhạt trên nền nhạt không đọc được.
 *
 * `tone` mang ngữ nghĩa chứ không phải màu: đừng dùng `danger` cho một *loại*
 * sự cố, chỉ dùng cho *trạng thái* xấu — trang Báo cáo sự cố từng để hai pill
 * đỏ cạnh nhau, một là loại một là trạng thái, không phân biệt được.
 */
const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-gray-100 text-gray-700",
  brand: "bg-vr-50 text-vr-900",
  success: "bg-emerald-50 text-emerald-800",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-rose-50 text-rose-700",
  info: "bg-blue-50 text-blue-800",
};

export function Badge({ tone = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
