// Rà soát 2026-08-10: đối chiếu BACKEND_SOURCE_OF_TRUTH.md §5.9 (toàn bộ
// error.code BE có thể trả) với bảng dịch — phát hiện ~155 code còn thiếu,
// khiến toast tiếng Việt lộ nguyên văn tiếng Anh. Test này khoá lại việc dịch
// đúng cho các code tiêu biểu mỗi nhóm domain, và xác nhận hành vi fallback
// (code lạ / không có code / tiếng Anh) không đổi.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "../i18n";
import { translateApiErrorMessage } from "./apiErrorMessage";

describe("translateApiErrorMessage", () => {
  let originalLanguage: string;

  beforeEach(() => {
    originalLanguage = i18n.language;
  });

  afterEach(() => {
    void i18n.changeLanguage(originalLanguage);
  });

  it("returns the fallback untouched when language is not Vietnamese", async () => {
    await i18n.changeLanguage("en");
    expect(translateApiErrorMessage("BOOKING_NOT_FOUND", "Booking not found")).toBe(
      "Booking not found",
    );
  });

  it.each([
    ["AUTH_INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng."],
    ["VOUCHER_NOT_FOUND", "Không tìm thấy voucher."],
    ["SUBSCRIPTION_EXPIRED", "Gói cước đã hết hạn."],
    ["PARCEL_NOT_FOUND", "Không tìm thấy kiện hàng."],
    ["SHUTTLE_CAPACITY_EXCEEDED", "Xe trung chuyển đã hết chỗ."],
    ["TRIP_INVALID_TRANSITION", "Trạng thái chuyến hiện không cho phép thao tác này."],
    ["PAYMENT_VNPAY_ERROR", "Cổng thanh toán VNPay gặp lỗi, vui lòng thử lại."],
    ["WALLET_INSUFFICIENT_BALANCE", "Số dư ví không đủ."],
    ["INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn."],
    // Fallback code các service NestJS gắn theo status khi không có errorCode riêng
    ["NOT_FOUND", "Không tìm thấy dữ liệu yêu cầu."],
    ["SERVICE_UNAVAILABLE", "Dịch vụ hiện không khả dụng."],
  ])(
    "translates %s to Vietnamese when language is vi",
    async (code, expected) => {
      await i18n.changeLanguage("vi");
      expect(translateApiErrorMessage(code, "some raw English message")).toBe(
        expected,
      );
    },
  );

  it("falls back to the raw BE message when the code is unknown", async () => {
    await i18n.changeLanguage("vi");
    expect(
      translateApiErrorMessage("SOME_BRAND_NEW_CODE", "Raw English message"),
    ).toBe("Raw English message");
  });

  it("falls back to the raw BE message when no code is provided", async () => {
    await i18n.changeLanguage("vi");
    expect(translateApiErrorMessage(undefined, "Raw English message")).toBe(
      "Raw English message",
    );
  });

  it("uses the generic 401/403/5xx translation when status is given but code is missing/unmapped", async () => {
    await i18n.changeLanguage("vi");
    expect(
      translateApiErrorMessage(undefined, "Unauthorized", 401),
    ).toBe("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
    expect(translateApiErrorMessage(undefined, "Forbidden", 403)).toBe(
      "Bạn không có quyền thực hiện thao tác này.",
    );
    expect(
      translateApiErrorMessage("SOME_UNKNOWN_CODE", "Server exploded", 500),
    ).toBe("Đã xảy ra lỗi hệ thống. Vui lòng thử lại.");
  });
});
