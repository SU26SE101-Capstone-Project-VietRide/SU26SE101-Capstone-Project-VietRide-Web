import type { ReactNode } from "react";
import Pagination from "./Pagination";
import { TableSkeletonRows } from "./TableSkeletonRows";

export type PersonnelTableColumn<Row> = {
  key: string;
  header: ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: Row) => ReactNode;
};

export type PersonnelTableProps<Row> = {
  toolbar: ReactNode;
  rows: Row[];
  columns: PersonnelTableColumn<Row>[];
  getRowKey: (row: Row) => string;
  isLoading: boolean;
  emptyMessage: ReactNode;
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
  wrapperClassName?: string;
  /**
   * Skeleton riêng của màn. Bỏ trống thì bảng tự dựng skeleton theo số cột —
   * trước đây mặc định là một dòng chữ "Đang tải...", khiến bảng sụt từ N hàng
   * xuống 1 dòng và mọi thứ bên dưới nhảy lên.
   */
  loadingContent?: ReactNode;
};

export function PersonnelTable<Row>({ toolbar, rows, columns, getRowKey, isLoading, emptyMessage, page, pageSize, totalItems, onPageChange, className = "w-full min-w-[960px] table-fixed whitespace-nowrap", wrapperClassName = "overflow-hidden rounded-lg border border-gray-200 bg-white", loadingContent }: PersonnelTableProps<Row>) {
  return (
    <section className={wrapperClassName}>
      <div className="border-b border-gray-100 p-4">{toolbar}</div>
      {/*
        `min-w` trên <table> là thứ làm `overflow-x-auto` ở đây có tác dụng:
        thiếu nó thì `table-fixed` co mọi cột theo phần trăm cho vừa khung, bảng
        không bao giờ rộng hơn wrapper nên không bao giờ cuộn — chữ các cột đè
        lên nhau ở mobile thay vì cuộn ngang được.
        `tabIndex` cho vùng cuộn: không có thì người dùng bàn phím không cuộn
        ngang tới được cột cuối (axe: scrollable-region-focusable).
      */}
      <div className="overflow-x-auto" aria-busy={isLoading} tabIndex={0}>
        <table className={className}>
          <thead><tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold text-gray-700">{columns.map((column) => <th key={column.key} className={column.headerClassName ?? "px-4 py-3"}>{column.header}</th>)}</tr></thead>
          <tbody>
            {!isLoading && rows.map((row) => <tr key={getRowKey(row)} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">{columns.map((column) => <td key={column.key} className={column.cellClassName ?? "px-4 py-4"}>{column.render(row)}</td>)}</tr>)}
            {!isLoading && rows.length === 0 && <tr><td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-gray-500">{emptyMessage}</td></tr>}
            {isLoading && (loadingContent ?? <TableSkeletonRows columns={columns.length} testId="personnel-table-skeleton" />)}
          </tbody>
        </table>
      </div>
      {/* Phân trang CỐ Ý hiện cả lúc đang tải: ẩn đi thì nút chuyển trang biến
          mất ngay dưới con trỏ vừa bấm, và người dùng mất luôn đường sang trang
          khác trong lúc chờ. Con số ở chân bảng không còn mâu thuẫn nữa vì
          skeleton đã giữ đúng khung N hàng thay cho một dòng chữ. */}
      <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={onPageChange} />
    </section>
  );
}
