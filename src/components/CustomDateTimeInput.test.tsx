// Bảng lịch là portal `fixed`, nên nó KHÔNG bị cắt bởi overflow của hộp thoại —
// cái hỏng là phép tính vị trí: bản cũ đoán chiều cao bằng một số cứng (420) và
// khi cả trên lẫn dưới đều không đủ chỗ thì rơi vào nhánh mở xuống rồi tràn
// khỏi màn hình, không có gì kẹp lại. Ô "Hiệu lực từ" nằm sát đáy hộp thoại là
// dính đúng ca đó: mấy hàng ngày cuối và nút Xong nằm ngoài tầm với.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomDateTimeInput from "./CustomDateTimeInput";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Bảng lịch cao hơn hẳn con số ước lượng cũ
const calendarContentHeight = 520;

function setViewport(height: number, width = 1280) {
  window.innerHeight = height;
  window.innerWidth = width;
}

/** Ép ô nhập nằm ở `top` và bảng lịch cao `calendarContentHeight`. */
function stubGeometry(triggerTop: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const isTrigger = this.tagName === "BUTTON" && this.hasAttribute("aria-label");
      return {
        top: isTrigger ? triggerTop : 0,
        bottom: isTrigger ? triggerTop + 44 : 0,
        left: 100,
        right: 400,
        width: 300,
        height: isTrigger ? 44 : 0,
        x: 100,
        y: isTrigger ? triggerTop : 0,
        toJSON: () => ({}),
      } as DOMRect;
    },
  );
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(
    calendarContentHeight,
  );
}

function openPicker() {
  render(
    <CustomDateTimeInput
      type="datetime-local"
      value="2026-08-16T07:00"
      aria-label="hieu-luc-tu"
      onChange={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByLabelText("hieu-luc-tu"));

  const panel = screen.getByTestId("datetime-picker-panel");
  return panel;
}

describe("CustomDateTimeInput — vị trí bảng lịch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setViewport(900);
  });

  it("không để bảng lịch tràn khỏi đáy màn hình khi ô nhập nằm sát đáy", () => {
    setViewport(760);
    // Ô nhập ở 700 → dưới nó chỉ còn ~16px, trên nó có 700px
    stubGeometry(700);

    const panel = openPicker();
    const top = Number.parseFloat(panel.style.top);
    const maxHeight = Number.parseFloat(panel.style.maxHeight);
    // `maxHeight` chỉ là TRẦN; chiều cao thật là phần nhỏ hơn giữa nội dung và
    // trần đó
    const boxHeight = Math.min(calendarContentHeight, maxHeight);

    expect(top).toBeGreaterThanOrEqual(0);
    expect(top + boxHeight).toBeLessThanOrEqual(window.innerHeight);
  });

  it("mở LÊN TRÊN khi phía dưới không đủ chỗ mà phía trên rộng hơn", () => {
    setViewport(760);
    stubGeometry(700);

    const panel = openPicker();

    // Mở lên trên nghĩa là mép dưới bảng phải nằm trên ô nhập
    expect(Number.parseFloat(panel.style.top)).toBeLessThan(700);
  });

  it("mở xuống dưới như thường khi còn thừa chỗ", () => {
    setViewport(1200);
    stubGeometry(100);

    const panel = openPicker();

    // 100 + 44 (chiều cao ô nhập) = 144, bảng phải nằm ngay dưới đó
    expect(Number.parseFloat(panel.style.top)).toBeGreaterThanOrEqual(144);
  });

  // Màn hình quá thấp để chứa trọn bảng ở CẢ hai phía → phải cuộn trong bảng,
  // không được để phần dưới rơi ra ngoài màn hình
  it("kẹp chiều cao và cho cuộn khi không phía nào đủ chỗ", () => {
    setViewport(420);
    stubGeometry(200);

    const panel = openPicker();
    const maxHeight = Number.parseFloat(panel.style.maxHeight);

    expect(maxHeight).toBeLessThan(calendarContentHeight);
    expect(panel.className).toContain("overflow-y-auto");
  });
});
