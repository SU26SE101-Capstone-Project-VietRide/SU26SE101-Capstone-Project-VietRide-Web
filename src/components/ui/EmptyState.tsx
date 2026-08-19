import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /**
   * Hành động chính, render NGAY TRONG khối. Trước đây mỗi màn tự viết một kiểu
   * rỗng khác nhau và CTA thì nằm ngoài khối (header trang), nên người dùng đọc
   * "chưa có dữ liệu" xong không biết bấm đâu để tạo.
   */
  action?: ReactNode;
  /** `dashed` cho vùng trống lớn, `plain` khi nằm trong thân bảng. */
  tone?: "dashed" | "plain";
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "dashed",
}: EmptyStateProps) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center gap-3 p-8 text-center",
        tone === "dashed"
          ? "rounded-xl border border-dashed border-gray-300 bg-white"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full bg-vr-50 text-vr-900"
        aria-hidden="true"
      >
        {icon}
      </span>
      <p className="text-lg font-bold text-gray-900">{title}</p>
      {description && (
        <p className="max-w-md text-sm text-gray-600">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
