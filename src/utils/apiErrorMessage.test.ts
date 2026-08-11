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
    // Rà soát 2026-08-11: các nhóm service NestJS (rag, notification,
    // runtime-config, tracking) chưa từng có bản dịch nào.
    ["RAG_PROVIDER_UNAVAILABLE", "Dịch vụ AI hiện không khả dụng."],
    ["RAG_DOCUMENT_FILE_UNSUPPORTED", "Hệ thống không hỗ trợ loại file tài liệu này."],
    ["RAG_CONVERSATION_NOT_FOUND", "Không tìm thấy cuộc hội thoại."],
    ["RUNTIME_CONFIG_NOT_FOUND", "Không tìm thấy khóa cấu hình."],
    ["NOTIFICATION_NOT_FOUND", "Không tìm thấy thông báo."],
    ["TRACKING_SHARE_TOKEN_INVALID", "Link chia sẻ hành trình không hợp lệ hoặc đã hết hạn."],
    ["INSUFFICIENT_ROLE", "Vai trò của bạn không đủ quyền cho thao tác này."],
    ["INSUFFICIENT_FUNDS", "Số dư không đủ để thực hiện giao dịch."],
  ])(
    "translates %s to Vietnamese when language is vi",
    async (code, expected) => {
      await i18n.changeLanguage("vi");
      expect(translateApiErrorMessage(code, "some raw English message")).toBe(
        expected,
      );
    },
  );

  // VALIDATION_ERROR là toast hay gặp nhất: client.ts ghép message của từng
  // field với code=undefined, nên nếu không dịch được ở tầng này thì người dùng
  // thấy nguyên văn tiếng Anh của FluentValidation.
  it.each([
    ["'Day Of Week' must not be empty.", "Vui lòng nhập các thứ trong tuần."],
    ["'Base Fare' must not be null.", "Vui lòng nhập giá vé."],
    [
      "'Base Fare' must be greater than or equal to '0'.",
      "Giá vé phải lớn hơn hoặc bằng 0.",
    ],
    ["'Email' is not a valid email address.", "Email không đúng định dạng email."],
    ["'Phone' is not in the correct format.", "Số điện thoại không đúng định dạng."],
    [
      "The length of 'Name' must be at least 3 characters. You entered 1 characters.",
      "Tên phải có ít nhất 3 ký tự.",
    ],
    [
      "The length of 'Code' must be 50 characters or fewer. You entered 80 characters.",
      "Mã không được vượt quá 50 ký tự.",
    ],
    ["'Page Size' must be between 1 and 100.", "Số dòng mỗi trang phải nằm trong khoảng 1 đến 100."],
  ])(
    "translates the FluentValidation message %s",
    async (raw, expected) => {
      await i18n.changeLanguage("vi");
      expect(translateApiErrorMessage(undefined, raw)).toBe(expected);
    },
  );

  it("translates BE custom validation messages word for word", async () => {
    await i18n.changeLanguage("vi");
    expect(
      translateApiErrorMessage(undefined, "validUntil must be after validFrom."),
    ).toBe("Ngày kết thúc phải sau ngày bắt đầu.");
    expect(
      translateApiErrorMessage(undefined, "SortDir must be 'asc' or 'desc'."),
    ).toBe("Chiều sắp xếp chỉ nhận 'asc' hoặc 'desc'.");
  });

  it("keeps the English field name when it is not in the dictionary yet", async () => {
    await i18n.changeLanguage("vi");
    // Câu vẫn được dịch cấu trúc, chỉ tên field giữ nguyên — vẫn dễ hiểu hơn
    // nguyên câu tiếng Anh.
    expect(
      translateApiErrorMessage(undefined, "'Some New Field' must not be empty."),
    ).toBe("Vui lòng nhập Some New Field.");
  });

  it("does not translate field messages when language is English", async () => {
    await i18n.changeLanguage("en");
    expect(
      translateApiErrorMessage(undefined, "'Day Of Week' must not be empty."),
    ).toBe("'Day Of Week' must not be empty.");
  });

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
