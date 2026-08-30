import type { InputHTMLAttributes, ReactNode } from "react";
import { inputWithIconClass } from "./formClasses";

type IconInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className"
> & {
  /** Icon dẫn ở mép trái, cùng cỡ 18px với kính lúp của `SearchInput`. */
  icon: ReactNode;
  /**
   * Trường bị từ chối. Đi qua prop chứ không nối `border-red-300` vào class:
   * ô nhập tự dựng class của nó nên chuỗi ngoài đưa vào sẽ chồng lên viền chuẩn.
   */
  invalid?: boolean;
  /** Thoát hiểm cho bề rộng/khoảng cách của khối bọc ngoài. */
  wrapperClassName?: string;
};

/**
 * Ô nhập một dòng kèm icon — cùng "skin" với `CustomSelect`,
 * `CustomDateTimeInput` và `SearchInput` để một hàng form không so le.
 *
 * Icon `pointer-events-none` để bấm trúng nó vẫn focus vào ô nhập, và nằm ngoài
 * cây khả truy cập (`aria-hidden` do react-icons đặt sẵn) vì nó chỉ nhắc lại
 * nhãn đã có.
 */
export function IconInput({
  icon,
  invalid = false,
  wrapperClassName = "",
  ...inputProps
}: IconInputProps) {
  const className = invalid
    ? `${inputWithIconClass} border-red-300 focus:border-red-500 focus:ring-red-500/30`
    : inputWithIconClass;

  return (
    <div className={`relative ${wrapperClassName}`.trim()}>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
        {icon}
      </span>
      {/* `aria-invalid` đặt TRƯỚC spread để call site vẫn ghi đè được */}
      <input
        aria-invalid={invalid || undefined}
        {...inputProps}
        className={className}
      />
    </div>
  );
}
