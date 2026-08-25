// Parity vi/en trước đây chỉ kiểm được bằng cách chạy tay
// `.claude/skills/i18n-sync/check-i18n.mjs`, mà script đó lại đang liệt kê thiếu
// namespace nên tripShare/parcelDelivery không ai canh. Đưa hẳn vào suite để CI
// chặn ngay khi thêm key một bên mà quên bên kia.
import { describe, expect, it } from "vitest";
import enCommon from "./en/common.json";
import enNav from "./en/nav.json";
import enLogin from "./en/login.json";
import enAdmin from "./en/admin.json";
import enManager from "./en/manager.json";
import enTripShare from "./en/tripShare.json";
import enParcelDelivery from "./en/parcelDelivery.json";
import viCommon from "./vi/common.json";
import viNav from "./vi/nav.json";
import viLogin from "./vi/login.json";
import viAdmin from "./vi/admin.json";
import viManager from "./vi/manager.json";
import viTripShare from "./vi/tripShare.json";
import viParcelDelivery from "./vi/parcelDelivery.json";

// Giữ khớp với ns[] trong src/i18n/index.ts
const namespaces = [
  ["common", viCommon, enCommon],
  ["nav", viNav, enNav],
  ["login", viLogin, enLogin],
  ["admin", viAdmin, enAdmin],
  ["manager", viManager, enManager],
  ["tripShare", viTripShare, enTripShare],
  ["parcelDelivery", viParcelDelivery, enParcelDelivery],
] as const;

function flatten(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("i18n parity vi/en", () => {
  it.each(namespaces)("namespace %s có cùng bộ key ở vi và en", (_, vi, en) => {
    const viKeys = flatten(vi).sort();
    const enKeys = flatten(en).sort();

    expect(enKeys.filter((key) => !viKeys.includes(key))).toEqual([]);
    expect(viKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
  });
});

/**
 * Lịch sử trạng thái bưu kiện in `reason` do BE ghi. Thiếu key là người dùng
 * nhìn thấy mã thô kiểu `CHECK_IN_TIMEOUT` giữa dòng tiếng Việt.
 *
 * Danh sách lấy từ `ParcelRejectionReasons.cs` cộng các mã do handler chuyến và
 * nhóm thanh toán cọc truyền vào.
 */
const parcelReasonCodes = [
  "OPERATOR_REVIEW_TIMEOUT",
  "CHECK_IN_TIMEOUT",
  "FINAL_PAYMENT_TIMEOUT",
  "PARCEL_ADDITIONAL_PAYMENT_TIMEOUT",
  "PARCEL_LATE_LOAD",
  "DEPOSIT_PAYMENT_EXPIRED",
  "DEPOSIT_PAYMENT_LATE",
  "DEPOSIT_PAYMENT_FAILED",
  "TRIP_CANCELLED",
  "TRIP_DISRUPTED",
  "TRIP_CARGO_CAPACITY_EXCEEDED",
] as const;

describe("lý do đổi trạng thái bưu kiện", () => {
  it.each(parcelReasonCodes)("dịch được mã %s ở cả vi và en", (code) => {
    const vi = (
      viManager.parcels.statusHistoryReasons as Record<string, string>
    )[code];
    const en = (
      enManager.parcels.statusHistoryReasons as Record<string, string>
    )[code];

    expect(vi, `thiếu bản dịch tiếng Việt cho ${code}`).toBeTruthy();
    expect(en, `thiếu bản dịch tiếng Anh cho ${code}`).toBeTruthy();
    // Không được để lọt chính cái mã ra làm "bản dịch"
    expect(vi).not.toBe(code);
    expect(en).not.toBe(code);
  });
});
