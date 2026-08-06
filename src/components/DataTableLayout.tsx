import type { ReactNode } from "react";
import Pagination from "./Pagination";

type DataTableLayoutProps = {
  toolbar: ReactNode;
  children: ReactNode;
  isLoading?: boolean;
  loadingMessage?: ReactNode;
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function DataTableLayout({
  toolbar,
  children,
  isLoading = false,
  loadingMessage = "Đang tải...",
  page,
  pageSize,
  totalItems,
  onPageChange,
  className = "overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm",
}: DataTableLayoutProps) {
  return (
    <section className={className}>
      <div className="border-b border-gray-100 p-4">{toolbar}</div>
      {children}
      {isLoading && (
        <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-500">
          {loadingMessage}
        </div>
      )}
      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={onPageChange}
      />
    </section>
  );
}
