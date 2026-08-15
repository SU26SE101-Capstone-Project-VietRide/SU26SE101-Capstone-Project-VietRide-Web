// Trước đây `currentPage` chỉ được kẹp để vẽ, còn `page` của màn cha thì không —
// xoá nốt bản ghi cuối của trang cuối là màn vẫn xin đúng trang đó và nhận về
// danh sách rỗng, trong khi thanh phân trang tô sáng một trang khác.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Pagination from "./Pagination";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("Pagination", () => {
  it("kéo màn cha về trang cuối khi trang hiện tại vượt quá tổng số trang", () => {
    const onPageChange = vi.fn();

    // 20 bản ghi / 10 mỗi trang = 2 trang, nhưng cha vẫn đang ở trang 3
    render(
      <Pagination
        page={3}
        pageSize={10}
        totalItems={20}
        onPageChange={onPageChange}
      />,
    );

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("không đụng tới trang khi danh sách rỗng", () => {
    const onPageChange = vi.fn();

    // Rỗng vì đang tải hoặc filter không khớp — kẹp lúc này là đá người dùng
    // về trang 1 oan.
    render(
      <Pagination
        page={3}
        pageSize={10}
        totalItems={0}
        onPageChange={onPageChange}
      />,
    );

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("để yên khi trang hiện tại vẫn hợp lệ", () => {
    const onPageChange = vi.fn();

    render(
      <Pagination
        page={2}
        pageSize={10}
        totalItems={25}
        onPageChange={onPageChange}
      />,
    );

    expect(onPageChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });

  it("dùng totalPages của BE thay vì tự suy ra", () => {
    const onPageChange = vi.fn();

    render(
      <Pagination
        page={5}
        pageSize={10}
        totalItems={20}
        totalPages={2}
        onPageChange={onPageChange}
      />,
    );

    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
