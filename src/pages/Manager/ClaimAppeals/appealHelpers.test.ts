import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../../../api/client";
import {
  appealErrorTranslationKey,
  appealStatusTone,
  hasAppealAction,
  parseAppealDecision,
  type AppealDecisionDraft,
} from "./appealHelpers";

describe("appealErrorTranslationKey", () => {
  it("không đưa message lỗi kỹ thuật thô ra màn nhà xe", () => {
    expect(
      appealErrorTranslationKey(
        new ApiRequestError("Internal server error", 500, "INTERNAL_ERROR"),
        "claimAppeals.loadFailed",
      ),
    ).toBe("claimAppeals.errors.systemUnavailable");
    expect(
      appealErrorTranslationKey(new Error("raw failure"), "claimAppeals.loadFailed"),
    ).toBe("claimAppeals.loadFailed");
  });
});

function draft(
  overrides: Partial<AppealDecisionDraft> = {},
): AppealDecisionDraft {
  return {
    decision: "UPHOLD",
    revisedProvenDirectLossVnd: "",
    reason: "Chứng từ bổ sung hợp lệ",
    ...overrides,
  };
}

describe("hasAppealAction", () => {
  it("chỉ mở nút theo đúng danh sách BE trả về", () => {
    expect(hasAppealAction(["DECIDE_APPEAL"], "DECIDE_APPEAL")).toBe(true);
    expect(hasAppealAction([], "DECIDE_APPEAL")).toBe(false);
    expect(hasAppealAction(undefined, "DECIDE_APPEAL")).toBe(false);
    expect(hasAppealAction(null, "DECIDE_APPEAL")).toBe(false);
  });
});

describe("appealStatusTone", () => {
  it("không nhuộm đỏ UPHELD — giữ nguyên quyết định là kết cục hợp lệ", () => {
    expect(appealStatusTone("UPHELD")).toBe("neutral");
  });

  it("đánh dấu việc cần làm và tiền chưa chi bằng warning", () => {
    expect(appealStatusTone("SUBMITTED")).toBe("warning");
    expect(appealStatusTone("FUNDING_PENDING")).toBe("warning");
  });

  it("chỉ PAID mới là success", () => {
    expect(appealStatusTone("PAID")).toBe("success");
    expect(appealStatusTone("ADJUSTMENT_APPROVED")).toBe("info");
  });
});

describe("parseAppealDecision", () => {
  it("bắt buộc lý do — validator BE là NotEmpty", () => {
    expect(parseAppealDecision(draft({ reason: "   " }))).toEqual({
      ok: false,
      error: "reason-required",
    });
  });

  it("chặn lý do quá 2000 ký tự trước khi tốn một vòng mạng", () => {
    expect(parseAppealDecision(draft({ reason: "x".repeat(2001) }))).toEqual({
      ok: false,
      error: "reason-too-long",
    });
  });

  it("bỏ hẳn tổn thất khỏi body khi giữ nguyên quyết định", () => {
    const result = parseAppealDecision(
      draft({ decision: "UPHOLD", revisedProvenDirectLossVnd: "15000000" }),
    );

    expect(result).toEqual({
      ok: true,
      value: { decision: "UPHOLD", reason: "Chứng từ bổ sung hợp lệ" },
    });
  });

  it("cho phép điều chỉnh mà không đổi mức tổn thất", () => {
    const result = parseAppealDecision(
      draft({ decision: "APPROVE_ADJUSTMENT", revisedProvenDirectLossVnd: " " }),
    );

    expect(result).toEqual({
      ok: true,
      value: {
        decision: "APPROVE_ADJUSTMENT",
        reason: "Chứng từ bổ sung hợp lệ",
      },
    });
  });

  it("gửi tổn thất đã chứng minh lại khi điều chỉnh", () => {
    const result = parseAppealDecision(
      draft({
        decision: "APPROVE_ADJUSTMENT",
        revisedProvenDirectLossVnd: "15000000",
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: {
        decision: "APPROVE_ADJUSTMENT",
        revisedProvenDirectLossVnd: 15_000_000,
        reason: "Chứng từ bổ sung hợp lệ",
      },
    });
  });

  it("chặn số không hợp lệ và số âm", () => {
    expect(
      parseAppealDecision(
        draft({
          decision: "APPROVE_ADJUSTMENT",
          revisedProvenDirectLossVnd: "12.5",
        }),
      ),
    ).toEqual({ ok: false, error: "invalid-loss" });

    expect(
      parseAppealDecision(
        draft({
          decision: "APPROVE_ADJUSTMENT",
          revisedProvenDirectLossVnd: "-1",
        }),
      ),
    ).toEqual({ ok: false, error: "negative-loss" });
  });
});
