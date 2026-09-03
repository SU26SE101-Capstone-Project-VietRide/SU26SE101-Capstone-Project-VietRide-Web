import { describe, expect, it } from "vitest";

import type { ParcelCompensationPolicyDefaults } from "../api/vietride";
import {
  draftFromParcelCompensationDefaults,
  isBelowPlatformDefault,
  parseParcelCompensationDraft,
  type ParcelCompensationDraft,
} from "./parcelCompensationPolicy";

const defaults: ParcelCompensationPolicyDefaults = {
  compensationRatePercent: 50,
  maxCompensationVnd: 30_000_000,
  noProofFallbackMultiplier: 2,
  claimWindowDays: 30,
  searchSlaHours: 72,
  decisionSlaBusinessDays: 7,
  payoutSlaBusinessDays: 3,
};

function draft(
  overrides: Partial<ParcelCompensationDraft> = {},
): ParcelCompensationDraft {
  return {
    ...draftFromParcelCompensationDefaults(defaults),
    ...overrides,
  };
}

describe("parseParcelCompensationDraft", () => {
  it("chuyển bản nháp hợp lệ thành request của BE", () => {
    const result = parseParcelCompensationDraft(draft(), defaults);

    expect(result).toEqual({
      ok: true,
      value: { ...defaults, belowDefaultAcknowledged: false },
    });
  });

  it("báo trường trống kèm tên trường để tô đỏ đúng ô", () => {
    const result = parseParcelCompensationDraft(
      draft({ searchSlaHours: "  " }),
      defaults,
    );

    expect(result).toEqual({
      ok: false,
      error: "empty-field",
      field: "searchSlaHours",
    });
  });

  it("từ chối số thập phân và số âm", () => {
    expect(
      parseParcelCompensationDraft(
        draft({ compensationRatePercent: "12.5" }),
        defaults,
      ),
    ).toEqual({
      ok: false,
      error: "invalid-number",
      field: "compensationRatePercent",
    });
    expect(
      parseParcelCompensationDraft(draft({ claimWindowDays: "-1" }), defaults),
    ).toEqual({
      ok: false,
      error: "invalid-number",
      field: "claimWindowDays",
    });
  });

  it("chặn giá trị ngoài range của BE trước khi gọi API", () => {
    expect(
      parseParcelCompensationDraft(draft({ searchSlaHours: "721" }), defaults),
    ).toEqual({
      ok: false,
      error: "out-of-range",
      field: "searchSlaHours",
    });
    expect(
      parseParcelCompensationDraft(
        draft({ compensationRatePercent: "0" }),
        defaults,
      ),
    ).toEqual({
      ok: false,
      error: "out-of-range",
      field: "compensationRatePercent",
    });
  });

  // BE trả 422 POLICY_BELOW_DEFAULT_ACK_REQUIRED nếu thiếu tick — chặn ở FE để
  // không tốn một vòng mạng chỉ để biết phải tick.
  it("bắt buộc tick xác nhận khi tỉ lệ đền thấp hơn mặc định nền tảng", () => {
    const result = parseParcelCompensationDraft(
      draft({ compensationRatePercent: "40" }),
      defaults,
    );

    expect(result).toEqual({ ok: false, error: "ack-required" });
  });

  it("bắt buộc tick xác nhận khi trần đền thấp hơn mặc định nền tảng", () => {
    const result = parseParcelCompensationDraft(
      draft({ maxCompensationVnd: "10000000" }),
      defaults,
    );

    expect(result).toEqual({ ok: false, error: "ack-required" });
  });

  it("cho lưu mức thấp hơn mặc định khi đã tick", () => {
    const result = parseParcelCompensationDraft(
      draft({
        compensationRatePercent: "40",
        belowDefaultAcknowledged: true,
      }),
      defaults,
    );

    expect(result).toEqual({
      ok: true,
      value: {
        ...defaults,
        compensationRatePercent: 40,
        belowDefaultAcknowledged: true,
      },
    });
  });

  // Tick còn sót lại từ lần hạ mức trước không được gửi kèm khi mức đã kéo về
  // bằng nền tảng — nếu không, policy mang cờ "đã chấp nhận hạ mức" sai sự thật.
  it("bỏ cờ xác nhận khi mức đã bằng hoặc trên mặc định", () => {
    const result = parseParcelCompensationDraft(
      draft({ compensationRatePercent: "70", belowDefaultAcknowledged: true }),
      defaults,
    );

    expect(result).toEqual({
      ok: true,
      value: {
        ...defaults,
        compensationRatePercent: 70,
        belowDefaultAcknowledged: false,
      },
    });
  });
});

describe("isBelowPlatformDefault", () => {
  it("bằng đúng mức nền tảng thì không tính là thấp hơn", () => {
    expect(isBelowPlatformDefault(draft(), defaults)).toBe(false);
  });

  it("chỉ cần một trong hai chỉ số thấp hơn là tính", () => {
    expect(
      isBelowPlatformDefault(draft({ maxCompensationVnd: "1" }), defaults),
    ).toBe(true);
  });

  it("ô đang gõ dở không bị coi là thấp hơn", () => {
    expect(
      isBelowPlatformDefault(draft({ compensationRatePercent: "" }), defaults),
    ).toBe(false);
  });
});

describe("legacy no-proof multiplier compatibility", () => {
  it("không đưa snapshot legacy 4 vào PUT policy mới", () => {
    const legacyDefaults = { ...defaults, noProofFallbackMultiplier: 4 };
    const result = parseParcelCompensationDraft(
      draftFromParcelCompensationDefaults(legacyDefaults),
      legacyDefaults,
    );

    expect(result).toMatchObject({
      ok: true,
      value: { noProofFallbackMultiplier: 2 },
    });
  });
});
