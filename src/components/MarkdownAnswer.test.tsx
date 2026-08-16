import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MarkdownAnswer from "./MarkdownAnswer";

describe("MarkdownAnswer", () => {
  // Câu trả lời thật của trợ lý: người dùng từng thấy nguyên "### 1." và "**".
  it("dựng tiêu đề, gạch đầu dòng và chữ đậm thay vì in thô cú pháp", () => {
    render(
      <MarkdownAnswer
        content={[
          "### 1. Quy trình đối soát",
          "* **Điều kiện:** Chuyến xe phải đã hoàn tất.",
          "* Hệ thống tạo khoản đối soát.",
        ].join("\n")}
      />,
    );

    const heading = screen.getByRole("heading", {
      name: "1. Quy trình đối soát",
    });
    expect(heading.textContent).not.toContain("#");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Điều kiện:").tagName).toBe("STRONG");
    expect(document.body.textContent).not.toContain("**");
  });

  it("gộp danh sách lồng nhau theo mức thụt đầu dòng", () => {
    render(
      <MarkdownAnswer
        content={["1. Bước một", "   - Chi tiết a", "   - Chi tiết b", "2. Bước hai"].join(
          "\n",
        )}
      />,
    );

    const lists = document.querySelectorAll("ol, ul");
    expect(lists).toHaveLength(2);
    expect(document.querySelector("ol")!.children).toHaveLength(2);
    expect(document.querySelector("ul")!.children).toHaveLength(2);
  });

  // Nội dung tới theo stream nên block thường chưa đóng khi render.
  it("vẫn hiện nội dung khi khối code chưa đóng", () => {
    render(<MarkdownAnswer content={"Ví dụ:\n```\nGET /trips\n"} />);

    expect(screen.getByText("GET /trips")).toBeTruthy();
  });

  it("bỏ href không an toàn nhưng giữ lại chữ", () => {
    render(
      <MarkdownAnswer content="Xem [tài liệu](javascript:alert(1)) và [trang](https://vietride.online)." />,
    );

    expect(document.querySelectorAll("a")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "trang" }).getAttribute("href")).toBe(
      "https://vietride.online",
    );
    expect(document.body.textContent).toContain("tài liệu");
  });

  it("giữ nguyên đoạn văn thường", () => {
    render(<MarkdownAnswer content="Đối soát ví theo ngày làm việc." />);

    expect(screen.getByText("Đối soát ví theo ngày làm việc.")).toBeTruthy();
  });
});
