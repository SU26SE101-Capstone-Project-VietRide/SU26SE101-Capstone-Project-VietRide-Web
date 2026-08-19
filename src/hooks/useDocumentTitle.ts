import { useEffect } from "react";

/**
 * Đặt `document.title` theo trang đang mở.
 *
 * Trước đây cả 29 màn đều mang đúng một tiêu đề "VietRide", nên tab trình duyệt
 * không phân biệt được, lịch sử duyệt web toàn bản ghi trùng tên, và người mở
 * nhiều tab để đối chiếu số liệu phải bấm từng tab mới biết tab nào là tab nào.
 *
 * Truyền `null` khi chưa biết tên trang (route ngoài menu) — khi đó giữ nguyên
 * tiêu đề mặc định thay vì hiện chuỗi rỗng.
 */
export function useDocumentTitle(pageTitle: string | null, brand: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = pageTitle ? `${pageTitle} · ${brand}` : brand;

    return () => {
      document.title = previous;
    };
  }, [brand, pageTitle]);
}
