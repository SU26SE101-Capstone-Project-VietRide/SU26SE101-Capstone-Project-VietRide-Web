import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CustomSelect from "./CustomSelect";

describe("CustomSelect", () => {
  it("filters searchable options without requiring Vietnamese diacritics", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CustomSelect
        aria-label="Phường/Xã"
        defaultValue=""
        searchable
        searchPlaceholder="Tìm phường/xã"
        emptyMessage="Không tìm thấy lựa chọn"
        onChange={onChange}
      >
        <option value="">Chọn phường/xã</option>
        <option value="ward-ben-nghe">Phường Bến Nghé</option>
        <option value="ward-vung-tau">Phường Vũng Tàu</option>
      </CustomSelect>,
    );

    await user.click(screen.getByRole("button", { name: "Phường/Xã" }));
    const searchInput = screen.getByRole("combobox", {
      name: "Tìm phường/xã",
    });
    await user.type(searchInput, "ben nghe");

    expect(
      screen.getByRole("option", { name: "Phường Bến Nghé" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Phường Vũng Tàu" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("option", { name: "Phường Bến Nghé" }),
    );

    expect(onChange).toHaveBeenCalledWith({
      target: { value: "ward-ben-nghe" },
    });
    expect(screen.getByRole("button", { name: "Phường/Xã" })).toHaveTextContent(
      "Phường Bến Nghé",
    );
  });

  it("selects the filtered option with the keyboard", async () => {
    const user = userEvent.setup();

    render(
      <CustomSelect
        aria-label="Phường/Xã"
        defaultValue=""
        searchable
        searchPlaceholder="Tìm phường/xã"
        emptyMessage="Không tìm thấy lựa chọn"
      >
        <option value="">Chọn phường/xã</option>
        <option value="ward-da-lat">Phường Xuân Hương - Đà Lạt</option>
        <option value="ward-bao-loc">Phường B'Lao</option>
      </CustomSelect>,
    );

    await user.click(screen.getByRole("button", { name: "Phường/Xã" }));
    const searchInput = screen.getByRole("combobox", {
      name: "Tìm phường/xã",
    });
    await user.type(searchInput, "da lat");
    await user.keyboard("{Enter}");

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Phường/Xã" })).toHaveTextContent(
      "Phường Xuân Hương - Đà Lạt",
    );
  });

  it("shows an empty result without changing regular select mode", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <CustomSelect
        aria-label="Tỉnh/Thành phố"
        defaultValue=""
        searchable
        searchPlaceholder="Tìm tỉnh/thành phố"
        emptyMessage="Không tìm thấy lựa chọn"
      >
        <option value="">Chọn tỉnh/thành phố</option>
        <option value="79">Thành phố Hồ Chí Minh</option>
      </CustomSelect>,
    );

    await user.click(
      screen.getByRole("button", { name: "Tỉnh/Thành phố" }),
    );
    await user.type(
      screen.getByRole("combobox", { name: "Tìm tỉnh/thành phố" }),
      "khong ton tai",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Không tìm thấy lựa chọn",
    );

    unmount();
    render(
      <CustomSelect aria-label="Trạng thái" defaultValue="ACTIVE">
        <option value="ACTIVE">Hoạt động</option>
        <option value="INACTIVE">Tạm dừng</option>
      </CustomSelect>,
    );
    await user.click(screen.getByRole("button", { name: "Trạng thái" }));

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });
});
