import { useEffect } from "react";
import { useTranslation } from "react-i18next";

type PaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  /**
   * Metadata phân trang lấy thẳng từ `PagedResult` của BE. Truyền vào thì
   * component dùng nguyên số trang và hai cờ điều hướng của server; bỏ trống
   * thì vẫn suy ra từ `totalItems`/`pageSize` như trước.
   */
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
};

function getVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 5];
  }

  if (currentPage >= totalPages - 2) {
    return Array.from({ length: 5 }, (_, index) => totalPages - 4 + index);
  }

  return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
}

export default function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  totalPages: serverTotalPages,
  hasNextPage,
  hasPreviousPage,
}: PaginationProps) {
  const { t } = useTranslation("common");
  // BE trả `totalPages = 0` khi rỗng; UI vẫn cần một trang để hiển thị.
  const totalPages = Math.max(
    1,
    serverTotalPages ?? Math.ceil(totalItems / pageSize),
  );
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const canGoPrevious = hasPreviousPage ?? currentPage > 1;
  const canGoNext = hasNextPage ?? currentPage < totalPages;
  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);
  const visiblePages = getVisiblePages(currentPage, totalPages);

  // `currentPage` chỉ kẹp lại để VẼ; `page` bên màn cha vẫn nằm ngoài khoảng và
  // request vẫn xin đúng trang đó. Xoá/huỷ nốt bản ghi cuối của trang 3 là danh
  // sách còn 2 trang, màn vẫn tải trang 3 → bảng trống trong khi thanh phân trang
  // lại tô sáng trang 2. Kéo cha về trang cuối còn dữ liệu.
  //
  // Chỉ kẹp khi `totalItems > 0`: lúc rỗng (đang tải, hoặc filter không ra kết
  // quả) `totalPages` bị quy về 1, kẹp ở đây sẽ đá người dùng về trang 1 oan.
  useEffect(() => {
    if (totalItems > 0 && page > totalPages) {
      onPageChange(totalPages);
    }
  }, [onPageChange, page, totalItems, totalPages]);

  function goToPage(nextPage: number) {
    onPageChange(Math.min(Math.max(nextPage, 1), totalPages));
  }

  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-gray-500">
        {t("showing", { from, to, total: totalItems })}
      </p>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={!canGoPrevious}
          onClick={() => goToPage(currentPage - 1)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("previous")}
        </button>
        {visiblePages.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => goToPage(item)}
            aria-current={item === currentPage ? "page" : undefined}
            className={`min-w-10 rounded-lg border px-3 py-1.5 text-sm font-semibold ${
              item === currentPage
                ? "border-vr-500 bg-vr-500 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => goToPage(currentPage + 1)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("next")}
        </button>
      </div>
    </div>
  );
}
