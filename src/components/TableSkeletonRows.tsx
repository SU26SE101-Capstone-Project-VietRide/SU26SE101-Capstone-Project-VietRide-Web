type TableSkeletonRowsProps = {
  /** Số cột của bảng — skeleton phải khớp để khung bảng không đổi hình. */
  columns: number;
  /** Số hàng giả, mặc định 5 (xấp xỉ một trang danh sách thưa). */
  rows?: number;
  /** Đặt `data-testid` lên hàng đầu để test bám vào trạng thái tải. */
  testId?: string;
  cellClassName?: string;
};

/**
 * Hàng skeleton dùng chung cho mọi bảng.
 *
 * Thay cho mẫu cũ `<td colSpan={n}>Đang tải...</td>`: dòng chữ đó làm bảng sụt
 * từ N hàng xuống 1 dòng, mọi thứ bên dưới nhảy lên rồi lại nhảy xuống khi dữ
 * liệu về. Skeleton giữ nguyên khung nên không có cú giật đó.
 *
 * `aria-hidden` vì đây thuần trang trí — trạng thái tải đã được `aria-busy`
 * trên vùng chứa bảng thông báo cho trình đọc màn hình.
 */
export function TableSkeletonRows({
  columns,
  rows = 5,
  testId,
  cellClassName = "px-4 py-4",
}: TableSkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr
          key={rowIndex}
          className="border-b border-gray-100 last:border-0"
          aria-hidden="true"
          data-testid={rowIndex === 0 ? testId : undefined}
        >
          {Array.from({ length: columns }, (_, columnIndex) => (
            <td key={columnIndex} className={cellClassName}>
              <div className="h-4 w-full animate-pulse rounded-md bg-slate-200" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
