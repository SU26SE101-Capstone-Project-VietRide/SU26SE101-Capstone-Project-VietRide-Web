import { describe, expect, it, vi } from "vitest";
import { localizeNotificationText } from "./notificationText";

const labels: Record<string, string> = {
  VEHICLE_BREAKDOWN: "hỏng xe",
  COMPLETED: "đã hoàn tất",
};

const translateCode = (code: string) => labels[code] ?? null;

describe("localizeNotificationText", () => {
  it("thay mã enum nhúng giữa câu bằng nhãn đã dịch", () => {
    expect(
      localizeNotificationText(
        "Chuyến xe vừa ghi nhận sự cố: VEHICLE_BREAKDOWN.",
        translateCode,
      ),
    ).toBe("Chuyến xe vừa ghi nhận sự cố: hỏng xe.");
  });

  it("thay được cả mã một từ ở tiêu đề", () => {
    expect(
      localizeNotificationText("Trung chuyển: COMPLETED", translateCode),
    ).toBe("Trung chuyển: đã hoàn tất");
  });

  // Thà hiện mã còn hơn nuốt mất thông tin: BE thêm enum mới mà FE chưa khai
  // bản dịch thì câu vẫn phải đọc được.
  it("giữ nguyên mã chưa có bản dịch", () => {
    expect(
      localizeNotificationText("Trạng thái: SOMETHING_NEW", translateCode),
    ).toBe("Trạng thái: SOMETHING_NEW");
  });

  // Từ viết tắt ngắn trong câu không phải mã enum — không được đem đi tra cứu.
  it("bỏ qua token viết hoa ngắn dưới 4 ký tự", () => {
    const lookup = vi.fn(translateCode);
    localizeNotificationText("Xe mất tín hiệu GPS và ETA", lookup);

    expect(lookup).not.toHaveBeenCalledWith("GPS");
    expect(lookup).not.toHaveBeenCalledWith("ETA");
  });

  it("chịu được title/body rỗng", () => {
    expect(localizeNotificationText(null, translateCode)).toBe("");
    expect(localizeNotificationText(undefined, translateCode)).toBe("");
  });
});
