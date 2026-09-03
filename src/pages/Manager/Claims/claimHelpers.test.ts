import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../../../api/client";
import {
  claimErrorTranslationKey,
  claimStatusTone,
  fundingStatusTone,
  hasClaimAction,
  parseClaimDecision,
  parseProofAssessment,
  proofStatusTranslationKey,
  type ClaimDecisionDraft,
} from "./claimHelpers";

const verifiedDraft: ClaimDecisionDraft = {
  decision: "APPROVE",
  proofStatus: "VERIFIED",
  lossVnd: "300000",
  acceptedEvidenceIds: ["evidence-1"],
  reason: "Chứng từ hợp lệ",
};

describe("claim proof contract", () => {
  it("gửi đủ proof/loss/evidence cho cả quyết định từ chối", () => {
    expect(
      parseClaimDecision({ ...verifiedDraft, decision: "REJECT" }),
    ).toEqual({
      ok: true,
      value: {
        decision: "REJECT",
        proofStatus: "VERIFIED",
        provenDirectLossVnd: 300000,
        acceptedEvidenceIds: ["evidence-1"],
        reason: "Chứng từ hợp lệ",
      },
    });
  });

  it.each(["UNVERIFIED", "NO_PROOF"] as const)(
    "%s luôn được chuẩn hóa thành loss null và evidence rỗng",
    (proofStatus) => {
      expect(
        parseProofAssessment({
          proofStatus,
          lossVnd: "999",
          acceptedEvidenceIds: ["stale-id"],
        }),
      ).toEqual({
        ok: true,
        value: { proofStatus, lossVnd: null, acceptedEvidenceIds: [] },
      });
    },
  );

  it("bắt buộc loss và evidence khi VERIFIED", () => {
    expect(
      parseProofAssessment({
        proofStatus: "VERIFIED",
        lossVnd: "",
        acceptedEvidenceIds: [],
      }),
    ).toEqual({ ok: false, error: "loss-required" });
    expect(
      parseProofAssessment({
        proofStatus: "VERIFIED",
        lossVnd: "0",
        acceptedEvidenceIds: [],
      }),
    ).toEqual({ ok: false, error: "evidence-required" });
  });

  it("từ chối số âm, số lẻ và số vượt safe integer", () => {
    expect(
      parseProofAssessment({ ...verifiedDraft, lossVnd: "-1" }),
    ).toEqual({ ok: false, error: "negative-loss" });
    expect(
      parseProofAssessment({ ...verifiedDraft, lossVnd: "1.5" }),
    ).toEqual({ ok: false, error: "invalid-loss" });
    expect(
      parseProofAssessment({
        ...verifiedDraft,
        lossVnd: "999999999999999999999",
      }),
    ).toEqual({ ok: false, error: "invalid-loss" });
  });

  it("không suy diễn proof null từ loss/evidence", () => {
    expect(proofStatusTranslationKey(null, "SUBMITTED")).toBe(
      "claims.proofStatus.PENDING",
    );
    expect(proofStatusTranslationKey(null, "UNDER_REVIEW")).toBe(
      "claims.proofStatus.PENDING",
    );
    expect(proofStatusTranslationKey(null, "REJECTED")).toBe(
      "claims.proofStatus.LEGACY",
    );
    expect(proofStatusTranslationKey("VERIFIED", "SUBMITTED")).toBe(
      "claims.proofStatus.VERIFIED",
    );
  });
});

describe("claim helpers", () => {
  it("gate action chỉ theo availableActions", () => {
    expect(hasClaimAction(["DECIDE_CLAIM"], "DECIDE_CLAIM")).toBe(true);
    expect(hasClaimAction([], "DECIDE_CLAIM")).toBe(false);
    expect(hasClaimAction(undefined, "DECIDE_CLAIM")).toBe(false);
  });

  it("dịch đúng lỗi proof/evidence mới", () => {
    expect(
      claimErrorTranslationKey(
        new ApiRequestError(
          "invalid proof",
          422,
          "PARCEL_CLAIM_EVIDENCE_REQUIRED",
        ),
        "fallback",
      ),
    ).toBe("claims.errors.proofInvalid");
    expect(
      claimErrorTranslationKey(
        new ApiRequestError(
          "stale evidence",
          404,
          "PARCEL_CLAIM_EVIDENCE_NOT_FOUND",
        ),
        "fallback",
      ),
    ).toBe("claims.errors.evidenceStale");
  });

  it("thể hiện payout state không đồng nhất với paid", () => {
    expect(claimStatusTone("APPROVED")).toBe("info");
    expect(claimStatusTone("PAID")).toBe("success");
    expect(fundingStatusTone("READY_FOR_PAYOUT")).toBe("info");
    expect(fundingStatusTone("FUNDING_PENDING")).toBe("warning");
  });
});
