import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../../../api/client";
import {
  appealErrorTranslationKey,
  appealStatusTone,
  hasAppealAction,
  parseAppealDecision,
  type AppealDecisionDraft,
} from "./appealHelpers";

const verifiedDraft: AppealDecisionDraft = {
  decision: "APPROVE_ADJUSTMENT",
  proofStatus: "VERIFIED",
  lossVnd: "500000",
  acceptedEvidenceIds: ["claim-evidence-1"],
  reason: "Chấp nhận chứng từ bổ sung",
};

describe("appeal proof contract", () => {
  it("gửi đủ proof fields cho APPROVE_ADJUSTMENT", () => {
    expect(parseAppealDecision(verifiedDraft)).toEqual({
      ok: true,
      value: {
        decision: "APPROVE_ADJUSTMENT",
        proofStatus: "VERIFIED",
        revisedProvenDirectLossVnd: 500000,
        acceptedEvidenceIds: ["claim-evidence-1"],
        reason: "Chấp nhận chứng từ bổ sung",
      },
    });
  });

  it("UPHOLD vẫn gửi proof fields tường minh", () => {
    expect(
      parseAppealDecision({
        ...verifiedDraft,
        decision: "UPHOLD",
        proofStatus: "NO_PROOF",
        lossVnd: "999",
        acceptedEvidenceIds: ["stale-id"],
      }),
    ).toEqual({
      ok: true,
      value: {
        decision: "UPHOLD",
        proofStatus: "NO_PROOF",
        revisedProvenDirectLossVnd: null,
        acceptedEvidenceIds: [],
        reason: "Chấp nhận chứng từ bổ sung",
      },
    });
  });

  it("bắt buộc reason, proof, loss và evidence theo ma trận", () => {
    expect(parseAppealDecision({ ...verifiedDraft, reason: " " })).toEqual({
      ok: false,
      error: "reason-required",
    });
    expect(
      parseAppealDecision({ ...verifiedDraft, proofStatus: "" }),
    ).toEqual({ ok: false, error: "proof-required" });
    expect(parseAppealDecision({ ...verifiedDraft, lossVnd: "" })).toEqual({
      ok: false,
      error: "loss-required",
    });
    expect(
      parseAppealDecision({ ...verifiedDraft, acceptedEvidenceIds: [] }),
    ).toEqual({ ok: false, error: "evidence-required" });
  });
});

describe("appeal helpers", () => {
  it("gate action chỉ theo availableActions", () => {
    expect(hasAppealAction(["DECIDE_APPEAL"], "DECIDE_APPEAL")).toBe(true);
    expect(hasAppealAction([], "DECIDE_APPEAL")).toBe(false);
  });

  it("phân biệt lỗi adjustment và evidence stale", () => {
    expect(
      appealErrorTranslationKey(
        new ApiRequestError(
          "positive delta required",
          409,
          "PARCEL_CLAIM_APPEAL_ADJUSTMENT_REQUIRED",
        ),
        "fallback",
      ),
    ).toBe("claimAppeals.errors.adjustmentRequired");
    expect(
      appealErrorTranslationKey(
        new ApiRequestError(
          "stale",
          404,
          "PARCEL_CLAIM_EVIDENCE_NOT_FOUND",
        ),
        "fallback",
      ),
    ).toBe("claimAppeals.errors.evidenceStale");
  });

  it("chỉ PAID là trạng thái chi thành công", () => {
    expect(appealStatusTone("ADJUSTMENT_APPROVED")).toBe("info");
    expect(appealStatusTone("FUNDING_PENDING")).toBe("warning");
    expect(appealStatusTone("PAID")).toBe("success");
  });
});
