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
