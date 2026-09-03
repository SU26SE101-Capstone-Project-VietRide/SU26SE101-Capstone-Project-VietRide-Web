import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../../../api/client";
import {
  claimErrorTranslationKey,
  claimStatusTone,
  fundingStatusTone,
  hasClaimAction,
  parseClaimDecision,
  previewClaimAward,
  previewClaimCargoAward,
  type ClaimDecisionDraft,
} from "./claimHelpers";

describe("claimErrorTranslationKey", () => {
  it("không đưa mã hoặc message lỗi kỹ thuật thô ra màn nhà xe", () => {
    expect(
      claimErrorTranslationKey(
        new ApiRequestError(
          "A decision reason is required.",
          422,
          "PARCEL_CLAIM_EVIDENCE_REQUIRED",
        ),
        "claims.decisionFailed",
      ),
    ).toBe("claims.errors.reasonRequired");

    expect(
      claimErrorTranslationKey(
        new ApiRequestError("Internal server error", 500, "INTERNAL_ERROR"),
        "claims.loadFailed",
      ),
    ).toBe("claims.errors.systemUnavailable");
  });
});

function draft(overrides: Partial<ClaimDecisionDraft> = {}): ClaimDecisionDraft {
  return {
    decision: "APPROVE",
    proofMode: "WITH_PROOF",
    provenDirectLossVnd: "",
    reason: "Chứng từ hợp lệ",
    ...overrides,
  };
}

describe("hasClaimAction", () => {
  it("chỉ mở nút theo đúng danh sách BE trả về", () => {
    expect(hasClaimAction(["DECIDE_CLAIM"], "DECIDE_CLAIM")).toBe(true);
    expect(hasClaimAction([], "DECIDE_CLAIM")).toBe(false);
    expect(hasClaimAction(undefined, "DECIDE_CLAIM")).toBe(false);
    expect(hasClaimAction(null, "DECIDE_CLAIM")).toBe(false);
  });
});

describe("parseClaimDecision", () => {
  it("bắt buộc lý do — BE trả PARCEL_CLAIM_EVIDENCE_REQUIRED nếu để trống", () => {
    expect(parseClaimDecision(draft({ reason: "   " }))).toEqual({
      ok: false,
      error: "reason-required",
    });
  });

  it("bỏ hẳn tổn thất khỏi body khi từ chối", () => {
    const result = parseClaimDecision(
      draft({ decision: "REJECT", provenDirectLossVnd: "12000000" }),
    );

    expect(result).toEqual({
      ok: true,
      value: { decision: "REJECT", reason: "Chứng từ hợp lệ" },
    });
  });

  it("bắt buộc chọn rõ có hay không có chứng từ", () => {
    expect(parseClaimDecision(draft({ proofMode: "" }))).toEqual({
      ok: false,
      error: "proof-required",
    });
    expect(parseClaimDecision(draft())).toEqual({
      ok: false,
      error: "loss-required",
    });
  });

  it("duyệt không có chứng từ thì không gửi trường tổn thất", () => {
    const result = parseClaimDecision(
      draft({ proofMode: "WITHOUT_PROOF", provenDirectLossVnd: "" }),
    );

    expect(result).toEqual({
      ok: true,
      value: { decision: "APPROVE", reason: "Chứng từ hợp lệ" },
    });
  });

  it("chặn số thập phân và số âm trước khi gọi BE", () => {
    expect(
      parseClaimDecision(draft({ provenDirectLossVnd: "12.5" })),
    ).toEqual({ ok: false, error: "invalid-loss" });
    expect(parseClaimDecision(draft({ provenDirectLossVnd: "-1" }))).toEqual({
      ok: false,
      error: "negative-loss",
    });
  });

  it("gửi tổn thất hợp lệ kèm lý do đã trim", () => {
    const result = parseClaimDecision(
      draft({ provenDirectLossVnd: " 12000000 ", reason: "  Lỗi vận hành  " }),
    );

    expect(result).toEqual({
      ok: true,
      value: {
        decision: "APPROVE",
        provenDirectLossVnd: 12_000_000,
        reason: "Lỗi vận hành",
      },
    });
  });
});

// Đối chiếu với ParcelCompensationCalculatorTests của BE để hai bên không lệch.
describe("previewClaimCargoAward", () => {
  it("áp tỉ lệ rồi mới áp trần", () => {
    expect(previewClaimCargoAward(12_000_000, 100_000_000, 50, 30_000_000)).toEqual(
      {
        assessedLossVnd: 12_000_000,
        cargoAwardVnd: 6_000_000,
        cappedByPolicy: false,
      },
    );
    expect(previewClaimCargoAward(80_000_000, 100_000_000, 50, 30_000_000)).toEqual(
      {
        assessedLossVnd: 80_000_000,
        cargoAwardVnd: 30_000_000,
        cappedByPolicy: true,
      },
    );
  });

  it("không ghi nhận tổn thất vượt giá trị khách khai", () => {
    expect(previewClaimCargoAward(12_000_000, 4_000_000, 50, 30_000_000)).toEqual({
      assessedLossVnd: 4_000_000,
      cargoAwardVnd: 2_000_000,
      cappedByPolicy: false,
    });
  });

  it("khách không khai giá trị thì lấy nguyên tổn thất đã chứng minh", () => {
    expect(previewClaimCargoAward(9_000_000, null, 70, 50_000_000)).toEqual({
      assessedLossVnd: 9_000_000,
      cargoAwardVnd: 6_300_000,
      cappedByPolicy: false,
    });
  });

  // Nhánh "không chứng từ" cần cước đã thu, mà payload claim không trả — không
  // đoán bừa, trả null để màn nói rõ là chưa ước tính được.
  it("không ước tính khi chưa có tổn thất chứng minh", () => {
    expect(previewClaimCargoAward(null, 4_000_000, 50, 30_000_000)).toBeNull();
  });
});

describe("previewClaimAward", () => {
  it("tính đủ test case 300.000đ có chứng từ, gồm cả hoàn cước", () => {
    expect(
      previewClaimAward(
        "WITH_PROOF",
        300_000,
        300_000,
        150_000,
        0,
        50,
        30_000_000,
        4,
      ),
    ).toEqual({
      proofMode: "WITH_PROOF",
      assessedLossVnd: 300_000,
      cargoAwardVnd: 150_000,
      cappedByPolicy: false,
      freightCollectedVnd: 150_000,
      alreadyRefundedVnd: 0,
      freightRefundVnd: 150_000,
      totalAwardVnd: 300_000,
    });
  });

  it("giải thích đúng 600.000đ tiền hàng + 150.000đ hoàn cước khi không có chứng từ", () => {
    expect(
      previewClaimAward(
        "WITHOUT_PROOF",
        null,
        300_000,
        150_000,
        0,
        50,
        30_000_000,
        4,
      ),
    ).toEqual({
      proofMode: "WITHOUT_PROOF",
      assessedLossVnd: 0,
      cargoAwardVnd: 600_000,
      cappedByPolicy: false,
      freightCollectedVnd: 150_000,
      alreadyRefundedVnd: 0,
      freightRefundVnd: 150_000,
      totalAwardVnd: 750_000,
    });
  });
});

describe("tone", () => {
  it("chỉ nhuộm đỏ khiếu nại bị từ chối, các bước chi tiền là trung tính", () => {
    expect(claimStatusTone("REJECTED")).toBe("danger");
    expect(claimStatusTone("PAID")).toBe("success");
    expect(claimStatusTone("FUNDING_PENDING")).toBe("info");
    expect(claimStatusTone("SUBMITTED")).toBe("neutral");
    expect(fundingStatusTone("PAID")).toBe("success");
    expect(fundingStatusTone("NOT_APPLICABLE")).toBe("neutral");
  });
});
