import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Nút chỉ có icon — ép thành hình vuông và BẮT BUỘC có `aria-label`. */
  iconOnly?: boolean;
  /**
   * Bo tròn hết cỡ thay cho `rounded-lg` mặc định. Chỉ dùng khi nút đứng sát
   * một ô nhập bo dạng viên thuốc (hàng "ô tìm + nút tra cứu") — để lệch bo góc
   * ở đó nhìn ra ngay. Không dùng để làm nút nổi bật hơn.
   */
  pill?: boolean;
  /** Icon đặt trước nhãn. */
  leadingIcon?: ReactNode;
  children?: ReactNode;
  /** Thoát hiểm cho khoảng cách/bề rộng, không dùng để đổi màu hay chiều cao. */
  className?: string;
};

// Ba bậc chiều cao duy nhất. Trước đây một trang đo được tới 8 chiều cao nút
// khác nhau (14/24/36/38/40/44/46/56px) vì mỗi chỗ tự ghép padding riêng.
const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-5 text-base",
};

const iconOnlySizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

// primary/danger dùng bậc màu đủ tương phản với chữ trắng: vr-800 = 4,54:1,
// red-700 = 5,7:1. Các bậc sáng hơn (vr-500/600/700) đều dưới 3:1.
const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-vr-800 text-white hover:bg-vr-900",
  secondary:
    "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
  ghost: "text-gray-700 hover:bg-gray-100",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

/**
 * Nút dùng chung cho cả Admin lẫn Manager.
 *
 * Vùng chạm: dưới breakpoint `sm` mọi nút được kéo lên tối thiểu 44×44px
 * (WCAG 2.5.8) bằng `min-h`/`min-w` — kích thước thị giác ở desktop giữ nguyên.
 */
export function Button({
  variant = "secondary",
  size = "md",
  iconOnly = false,
  pill = false,
  leadingIcon,
  children,
  type = "button",
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex shrink-0 cursor-pointer items-center justify-center font-semibold transition-colors",
        pill ? "rounded-full" : "rounded-lg",
        "max-sm:min-h-11 max-sm:min-w-11",
        "disabled:cursor-not-allowed disabled:opacity-60",
        iconOnly ? iconOnlySizeClasses[size] : sizeClasses[size],
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {leadingIcon}
      {children}
    </button>
  );
}
