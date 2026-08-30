import type { InputHTMLAttributes } from "react";
import { FiSearch } from "react-icons/fi";

type SearchInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className"
> & {
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
  /**
   * Hiện nhãn thay vì `sr-only`. Dùng ở toolbar mà mọi ô lọc bên cạnh đều có
   * nhãn nổi phía trên — để riêng ô tìm kiếm chỉ có placeholder thì hàng lọc
   * so le mất đúng một dòng nhãn.
   */
  labelClassName?: string;
};

/**
 * Ô tìm kiếm dùng chung: icon kính lúp + nhãn ẩn + `type="search"`.
 *
 * Trước đây pattern này được chép tay ở 23 chỗ, và đúng một màn (Ví nhà xe)
 * quên mất icon kính lúp nên nhìn không ra là ô tìm kiếm.
 */
function normalizeLegacyInputClasses(input = "") {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => {
      const stripped = token.replace(/^focus:/, "");
      return !(
        /^rounded(?:-|$)/.test(stripped) ||
        /^border(?:-|$)/.test(stripped) ||
        /^bg(?:-|$)/.test(stripped) ||
        /^text(?:-|$)/.test(stripped) ||
        /^pl(?:-|$)/.test(stripped) ||
        /^pr(?:-|$)/.test(stripped) ||
        /^py(?:-|$)/.test(stripped) ||
        /^min-h(?:-|$)/.test(stripped) ||
        /^shadow(?:-|$)/.test(stripped) ||
        /^outline(?:-|$)/.test(stripped) ||
        /^ring(?:-|$)/.test(stripped) ||
        /^focus:(?:border|ring|bg|outline)/.test(token) ||
        /^placeholder:text/.test(token)
      );
    })
    .join(" ");
}

export function SearchInput({
  label,
  wrapperClassName = "relative min-w-0",
  inputClassName,
  labelClassName,
  // `search` là mặc định đúng cho ô lọc danh sách. Nhưng ô autocomplete (gõ ra
  // danh sách gợi ý để chọn) nên giữ `text`: `type="search"` thêm nút xoá của
  // trình duyệt, đá nhau với UX chọn từ danh sách — và đổi role thành
  // `searchbox`, làm hỏng mọi nơi đang tìm theo `textbox`.
  type = "search",
  ...rest
}: SearchInputProps) {
  const mergedInputClassName = [
    "h-12 w-full rounded-[9999px] border border-gray-300 bg-white pl-11 pr-4 text-[15px] text-slate-700 shadow-[0_0_0_1px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-[#2bb7b0] focus:ring-4 focus:ring-[#dff7f5]",
    normalizeLegacyInputClasses(inputClassName ?? ""),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={wrapperClassName}>
      <span className={labelClassName ?? "sr-only"}>{label}</span>
      {/* Kính lúp neo vào riêng ô nhập, không vào cả `<label>`: khi nhãn được
          hiện thì `top-1/2` của label rơi xuống giữa cụm nhãn + ô nhập. Với
          nhãn `sr-only` (đang `position: absolute`) hộp bọc trùng đúng ô nhập
          nên các màn cũ giữ nguyên vị trí icon. */}
      <span className="relative block">
        <FiSearch
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
          size={18}
        />
        <input
          type={type}
          aria-label={label}
          className={mergedInputClassName}
          {...rest}
        />
      </span>
    </label>
  );
}
