import { describe, expect, it } from "vitest";
import {
  formatIpAddress,
  getActionPresentation,
  getActivityContext,
  getReadableMetadata,
} from "./activityLogPresentation";

describe("activity log presentation", () => {
  it("dịch các action đang có trong dữ liệu thực tế", () => {
    expect(getActionPresentation("COMPLETE_PROFILE", "vi").label).toBe("Hoàn tất hồ sơ");
    expect(getActionPresentation("SET_INITIAL_PASSWORD", "vi").label).toBe("Đặt mật khẩu ban đầu");
    expect(getActionPresentation("SOME_NEW_ACTION", "vi").label).toBe("Some new thao tác");
  });

  it("ưu tiên snapshot tên và không đưa UUID cũ lên ngữ cảnh chính", () => {
    expect(getActivityContext("APPROVE_OPERATOR", {
      operatorId: "10cd8f0e-a733-4e50-8cea-3fd58a3154d2",
      operatorName: "Nhà xe Minh Tâm",
    }, "vi")).toBe("Duyệt nhà xe Nhà xe Minh Tâm");
    expect(getActivityContext("LOCK_USER", {
      targetUserId: "824d0a34-8944-4e1b-aa64-8a443f532d4e",
    }, "vi")).toBe("Khóa tài khoản");
    expect(getActivityContext("LOCK_USER", {
      target: { type: "USER", id: "user-1", displayName: "Nguyễn Văn An" },
    }, "vi")).toBe("Khóa tài khoản Nguyễn Văn An");
  });

  it("dịch source kỹ thuật trong bảng và drawer", () => {
    const metadata = { source: "OPERATOR_ADMIN_UNLOCK_USER" };
    expect(getActivityContext("UNLOCK_USER", metadata, "vi")).toBe("Mở khóa tài khoản");
    expect(getReadableMetadata(metadata, "vi")).toEqual([
      { key: "source", label: "Nguồn thao tác", value: "Quản trị viên nhà xe mở khóa tài khoản" },
    ]);
  });

  it("chuẩn hóa IPv4-mapped IPv6 để quản trị viên dễ đọc", () => {
    expect(formatIpAddress("::ffff:172.19.0.20")).toBe("172.19.0.20");
    expect(formatIpAddress("127.0.0.1")).toBe("127.0.0.1");
    expect(formatIpAddress(null)).toBe("—");
  });
});
