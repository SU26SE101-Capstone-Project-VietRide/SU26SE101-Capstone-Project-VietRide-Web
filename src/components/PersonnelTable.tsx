import type { ReactNode } from "react";
import Pagination from "./Pagination";

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
  loadingMessage?: ReactNode;
  loadingContent?: ReactNode;
};

export function PersonnelTable<Row>({ toolbar, rows, columns, getRowKey, isLoading, emptyMessage, page, pageSize, totalItems, onPageChange, className = "w-full table-fixed whitespace-nowrap", wrapperClassName = "overflow-hidden rounded-lg border border-gray-200 bg-white", loadingMessage = "Đang tải...", loadingContent }: PersonnelTableProps<Row>) {
  return (
    <section className={wrapperClassName}>
      <div className="border-b border-gray-100 p-4">{toolbar}</div>
      <div className="overflow-x-auto" aria-busy={isLoading}>
        <table className={className}>
          <thead><tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold text-gray-700">{columns.map((column) => <th key={column.key} className={column.headerClassName ?? "px-4 py-3"}>{column.header}</th>)}</tr></thead>
          <tbody>
            {!isLoading && rows.map((row) => <tr key={getRowKey(row)} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">{columns.map((column) => <td key={column.key} className={column.cellClassName ?? "px-4 py-4"}>{column.render(row)}</td>)}</tr>)}
            {!isLoading && rows.length === 0 && <tr><td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-gray-500">{emptyMessage}</td></tr>}
            {isLoading && loadingContent}
          </tbody>
        </table>
      </div>
      {isLoading && !loadingContent && <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-500">{loadingMessage}</div>}
      <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={onPageChange} />
    </section>
  );
}