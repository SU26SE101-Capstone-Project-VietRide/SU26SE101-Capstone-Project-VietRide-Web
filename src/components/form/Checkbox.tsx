import { useEffect, useRef, type ReactNode } from "react";
import { FiCheck, FiMinus } from "react-icons/fi";

// Checkbox dùng chung toàn hệ thống.
//
// Vì sao phải tự vẽ thay vì style thẳng <input type="checkbox">: dự án KHÔNG
// cài @tailwindcss/forms, nên `text-vr-600` (class mà phần lớn màn đang dùng)
// không hề đổi được màu ô tick — trình duyệt vẫn vẽ màu xanh mặc định. Chỉ
// `accent-*` đổi được màu nhưng lại không chỉnh được bo góc, viền, focus ring
// và không đồng nhất giữa các trình duyệt.
//
// Cách làm: giữ nguyên <input> thật (ẩn bằng sr-only) để không mất bàn phím,
// form semantics và screen reader; phần nhìn thấy là span vẽ theo trạng thái
// `peer-*` của input.

type CheckboxSize = "sm" | "md";

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Nhãn cạnh ô tick. Có nhãn thì component tự bọc trong <label>. */
  label?: ReactNode;
  /** Dòng mô tả phụ dưới nhãn. */
  description?: ReactNode;
  disabled?: boolean;
  /** Trạng thái "chọn một phần" cho ô tick tổng của danh sách. */
  indeterminate?: boolean;
  size?: CheckboxSize;
  /** Class cho phần bọc ngoài (canh lề, nền, viền... theo từng màn). */
  className?: string;
  id?: string;
  name?: string;
  value?: string;
  "aria-label"?: string;
};

const boxSize: Record<CheckboxSize, string> = {
  sm: "h-[18px] w-[18px]",
  md: "h-5 w-5",
};

const iconSize: Record<CheckboxSize, number> = { sm: 12, md: 14 };

export default function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  indeterminate = false,
  size = "sm",
  className = "",
  id,
  name,
  value,
  "aria-label": ariaLabel,
}: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // `indeterminate` chỉ set được qua DOM property, không có attribute HTML.
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate && !checked;
    }
  }, [checked, indeterminate]);

  const control = (
    <span className="relative inline-flex shrink-0 items-center justify-center">
      <input
        ref={inputRef}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        id={id}
        name={name}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className={`${boxSize[size]} rounded-[5px] border-2 border-gray-300 bg-white transition-colors peer-hover:border-vr-400 peer-checked:border-vr-600 peer-checked:bg-vr-600 peer-indeterminate:border-vr-600 peer-indeterminate:bg-vr-600 peer-focus-visible:ring-2 peer-focus-visible:ring-vr-500/40 peer-focus-visible:ring-offset-1 peer-disabled:border-gray-200 peer-disabled:bg-gray-100`}
      />
      <FiCheck
        aria-hidden="true"
        size={iconSize[size]}
        strokeWidth={3.5}
        className="pointer-events-none absolute text-white opacity-0 transition-opacity peer-checked:opacity-100 peer-indeterminate:opacity-0"
      />
      <FiMinus
        aria-hidden="true"
        size={iconSize[size]}
        strokeWidth={3.5}
        className="pointer-events-none absolute text-white opacity-0 transition-opacity peer-indeterminate:opacity-100"
      />
    </span>
  );

  // Không có nhãn: trả về mỗi ô tick để nhúng được vào <label> hoặc ô bảng có
  // sẵn — lồng <label> trong <label> là HTML không hợp lệ.
  if (label === undefined && description === undefined) {
    return className ? (
      <span className={className}>{control}</span>
    ) : (
      control
    );
  }

  return (
    <label
      className={`flex gap-2.5 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${description ? "items-start" : "items-center"} ${className}`}
    >
      {description ? <span className="mt-0.5 flex">{control}</span> : control}
      <span className="min-w-0">
        <span className="block text-sm text-gray-700">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-gray-500">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
