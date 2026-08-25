import type { BusinessCode } from "../../../api/vietride";
import { displayBusinessCode } from "../../../utils/businessCode";

export type Translate = (key: string, options?: Record<string, unknown>) => string;


export function EmptyRow({ columns, t }: { columns: number; t: Translate }) {
  return (
    <tr>
      <td colSpan={columns} className="px-4 py-10 text-center text-sm text-gray-500">
        {t("wallet.empty")}
      </td>
    </tr>
  );
}

/**
 * Ô hiển thị mã nghiệp vụ trong bảng tài chính.
 *
 * Dùng font mono vì mã là chuỗi gồm cả chữ lẫn số dễ đọc nhầm (0/O, 1/I) khi
 * nhân viên CSKH đọc qua điện thoại — Crockford Base32 của BE đã bỏ I/L/O/U
 * nhưng phần prefix ngày vẫn có số. `tabular-nums` giữ các mã thẳng cột.
 *
 * Row legacy chưa backfill trả `-` và chuyển sang màu nhạt để không bị nhìn
 * nhầm thành một mã hợp lệ.
 */
export function BusinessCodeCell({
  code,
  className = "",
}: {
  code: BusinessCode | undefined;
  className?: string;
}) {
  const text = displayBusinessCode(code);
  const isMissing = text === "-";

  return (
    <span
      className={`font-mono text-xs tabular-nums ${isMissing ? "text-gray-400" : "text-gray-700"} ${className}`}
    >
      {text}
    </span>
  );
}
