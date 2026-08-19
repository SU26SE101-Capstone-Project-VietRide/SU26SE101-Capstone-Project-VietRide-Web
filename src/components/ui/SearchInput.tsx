import type { InputHTMLAttributes } from "react";
import { FiSearch } from "react-icons/fi";
import { inputClass } from "../form/formClasses";

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  /**
   * Tên khả truy cập. Placeholder KHÔNG thay được nhãn: nó biến mất ngay khi
   * người dùng gõ, và trình đọc màn hình không phải lúc nào cũng đọc ra.
   */
  label: string;
  /** Thoát hiểm cho bề rộng/khoảng cách của khối bọc ngoài. */
  wrapperClassName?: string;
  /**
   * Ghi đè class của ô nhập. Chỉ dùng khi ô tìm kiếm phải khớp chiều cao/nền với
   * các ô lọc đứng cạnh nó (vài toolbar dùng `bg-gray-50` + `min-h-11` để cao
   * bằng `CustomSelect`) — ép về `inputClass` chung ở những chỗ đó sẽ làm hàng
   * lọc so le trở lại.
   */
  inputClassName?: string;
};

/**
 * Ô tìm kiếm dùng chung: icon kính lúp + nhãn ẩn + `type="search"`.
 *
 * Trước đây pattern này được chép tay ở 23 chỗ, và đúng một màn (Ví nhà xe)
 * quên mất icon kính lúp nên nhìn không ra là ô tìm kiếm.
 */
export function SearchInput({
  label,
  wrapperClassName = "relative min-w-0",
  inputClassName,
  // `search` là mặc định đúng cho ô lọc danh sách. Nhưng ô autocomplete (gõ ra
  // danh sách gợi ý để chọn) nên giữ `text`: `type="search"` thêm nút xoá của
  // trình duyệt, đá nhau với UX chọn từ danh sách — và đổi role thành
  // `searchbox`, làm hỏng mọi nơi đang tìm theo `textbox`.
  type = "search",
  ...rest
}: SearchInputProps) {
  return (
    <label className={wrapperClassName}>
      <span className="sr-only">{label}</span>
      <FiSearch
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
        aria-hidden="true"
      />
      <input
        type={type}
        aria-label={label}
        className={inputClassName ?? `${inputClass} pl-10`}
        {...rest}
      />
    </label>
  );
}
