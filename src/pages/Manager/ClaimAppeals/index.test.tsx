import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decideOperatorParcelClaimAppeal,
  getOperatorParcelClaim,
  getOperatorParcelClaimAppeal,
  getOperatorParcelClaimAppeals,
  previewOperatorParcelClaimAppealAdjustment,
  type ParcelClaimAppeal,
  type ParcelClaimDetail,
} from "../../../api/vietride";
import ClaimAppealsPage from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values && !("defaultValue" in values)
        ? `${key} ${Object.values(values).join(" ")}`
        : key,
  }),
}));

vi.mock("../../../api/vietride", () => ({
  getOperatorParcelClaimAppeals: vi.fn(),
  getOperatorParcelClaimAppeal: vi.fn(),
  decideOperatorParcelClaimAppeal: vi.fn(),
  getOperatorParcelClaim: vi.fn(),
  previewOperatorParcelClaimAppealAdjustment: vi.fn(),
  PARCEL_CLAIM_PROOF_STATUSES: ["VERIFIED", "UNVERIFIED", "NO_PROOF"],
  PARCEL_CLAIM_APPEAL_STATUSES: ["SUBMITTED", "UPHELD", "PAID"],
}));

vi.mock("../../../api/idempotency", () => ({
  createIdempotencyKey: () => "11111111-2222-4333-8444-555555555555",
}));

vi.mock("../../../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  getAuthUser: vi.fn(() => ({ role: "OPERATOR_ADMIN" })),
}));
vi.mock("../../../auth", () => authMock);

const appeal: ParcelClaimAppeal = {
  appealId: "36000000-0000-4000-8000-000000000901",
  claimId: "36000000-0000-4000-8000-000000000701",
  originalClaimStatus: "PAID",
  originalTotalAwardVnd: 6_000_000,
  status: "SUBMITTED",
  reason: "Hoá đơn mua hàng chứng minh giá trị cao hơn",
  submittedByUserId: "36000000-0000-4000-8000-000000000001",
  submittedAt: "2026-08-25T10:00:00+07:00",
  revisedProvenDirectLossVnd: null,
  proofStatus: null,
  acceptedEvidenceIds: [],
  revisedCargoAwardVnd: 0,
  revisedFreightRefundVnd: 0,
  revisedTotalAwardVnd: 0,
  supplementaryAwardVnd: 0,
  decisionReason: null,
  decidedByUserId: null,
  decidedAt: null,
  payoutReferenceId: null,
  paidAt: null,
  availableActions: ["DECIDE_APPEAL"],
};

const policySnapshot = {
  version: 1,
  compensationRatePercent: 50,
  maxCompensationVnd: 30_000_000,
  noProofFallbackMultiplier: 4,
  claimWindowDays: 7,
  searchSlaHours: 72,
  decisionSlaBusinessDays: 7,
  payoutSlaBusinessDays: 3,
};

const claimDetail: ParcelClaimDetail = {
  claim: {
    claimId: appeal.claimId,
    parcelId: "36000000-0000-4000-8000-000000000201",
    incidentId: "36000000-0000-4000-8000-000000000101",
    status: "PAID",
    declaredValueVnd: 20_000_000,
    provenDirectLossVnd: 12_000_000,
    proofStatus: "VERIFIED",
    acceptedEvidenceIds: [
      "36000000-0000-4000-8000-000000000801",
    ],
    compensationRatePercent: 50,
    policyCapVnd: 30_000_000,
    cargoAwardVnd: 6_000_000,
    freightRefundVnd: 0,
    totalAwardVnd: 6_000_000,
    policyVersion: 1,
    beneficiaryUserId: "user-1",
    evidence: [
      {
        evidenceId: "36000000-0000-4000-8000-000000000801",
        evidenceType: "INVOICE",
        reference: "https://example.com/invoice",
        note: "Hóa đơn bổ sung",
        uploadedByUserId: "user-1",
        createdAt: "2026-08-25T10:00:00+07:00",
      },
    ],
    policySnapshot,
    availableActions: [],
  },
  parcel: {
    parcelId: "36000000-0000-4000-8000-000000000201",
    parcelCode: "VR-PCL-20260821-ABCD2345",
    status: "LOST_CONFIRMED",
    description: "Thùng điện tử",
    photoUrl: null,
    quantity: 1,
    declaredValueVnd: 20_000_000,
  },
  incident: null,
  currentCustody: null,
  trip: null,
  expectedDropoff: null,
  beneficiary: { userId: "user-1", displayName: "Nguyễn Văn A" },
  fundingStatus: "PAID",
  availableActions: [],
};

const listMock = vi.mocked(getOperatorParcelClaimAppeals);
const detailMock = vi.mocked(getOperatorParcelClaimAppeal);
const decideMock = vi.mocked(decideOperatorParcelClaimAppeal);
const claimMock = vi.mocked(getOperatorParcelClaim);
const previewMock = vi.mocked(previewOperatorParcelClaimAppealAdjustment);

function mockList(items: ParcelClaimAppeal[] = [appeal]) {
  listMock.mockResolvedValue({
    items,
    page: 1,
    pageSize: 20,
    totalItems: items.length,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.getAuthUser.mockReturnValue({ role: "OPERATOR_ADMIN" });
  mockList();
  detailMock.mockResolvedValue(appeal);
  claimMock.mockResolvedValue(claimDetail);
  previewMock.mockResolvedValue({
    claimId: appeal.claimId,
    appealId: appeal.appealId,
    proofStatus: "VERIFIED",
    acceptedEvidenceIds: [
      "36000000-0000-4000-8000-000000000801",
    ],
    calculationBasis: "VERIFIED_LOSS",
    provenDirectLossVnd: 15_000_000,
    assessedLossVnd: 15_000_000,
    declaredLiabilityVnd: 7_500_000,
    fallbackAmountVnd: null,
    policySnapshot,
    cargoAwardVnd: 7_500_000,
    freightRefundVnd: 0,
    totalAwardVnd: 7_500_000,
    originalTotalAwardVnd: 6_000_000,
    supplementaryAwardVnd: 1_500_000,
  });
});

describe("ClaimAppealsPage", () => {
  it("hiện hàng đợi bằng dữ liệu list, không gọi detail cho từng dòng", async () => {
    render(<ClaimAppealsPage />);

    expect(
      await screen.findByText("claimAppeals.requestLabel"),
    ).toBeTruthy();
    expect(
      screen.getByText("Hoá đơn mua hàng chứng minh giá trị cao hơn"),
    ).toBeTruthy();
    expect(detailMock).not.toHaveBeenCalled();
  });

  it("gửi bộ lọc trạng thái lên BE", async () => {
    const user = userEvent.setup();
    render(<ClaimAppealsPage />);
    await screen.findByText("claimAppeals.requestLabel");

    await user.click(
      screen.getByRole("button", { name: "claimAppeals.status.PAID" }),
    );

    await waitFor(() => {
      expect(listMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "PAID", page: 1 }),
      );
    });
  });

  // Endpoint decision chỉ nhận OPERATOR_ADMIN.
  it("ẩn nút quyết định với OPERATOR_STAFF", async () => {
    const user = userEvent.setup();
    authMock.getAuthUser.mockReturnValue({ role: "OPERATOR_STAFF" });
    render(<ClaimAppealsPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));
    await screen.findByText("claimAppeals.detailTitle");

    expect(
      screen.queryByRole("button", {
        name: "claimAppeals.actions.DECIDE_APPEAL",
      }),
    ).toBeNull();
  });

  it("ẩn nút quyết định khi BE không còn cho DECIDE_APPEAL", async () => {
    const user = userEvent.setup();
    detailMock.mockResolvedValue({ ...appeal, availableActions: [] });
    render(<ClaimAppealsPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));
    await screen.findByText("claimAppeals.detailTitle");

    expect(
      screen.queryByRole("button", {
        name: "claimAppeals.actions.DECIDE_APPEAL",
      }),
    ).toBeNull();
  });

  it("giữ nguyên quyết định vẫn gửi đủ proof fields và không preview", async () => {
    const user = userEvent.setup();
    decideMock.mockResolvedValue({
      ...appeal,
      status: "UPHELD",
      availableActions: [],
    });
    render(<ClaimAppealsPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));
    await user.click(
      await screen.findByRole("button", {
        name: "claimAppeals.actions.DECIDE_APPEAL",
      }),
    );
    await screen.findByText("claimAppeals.decisionTitle");

    await user.click(
      screen.getByRole("radio", { name: /claims\.proofStatus\.NO_PROOF/ }),
    );

    await user.type(
      screen.getByLabelText(/claimAppeals.reasonLabel/),
      "Chứng từ không đủ",
    );
    await user.click(
      screen.getByRole("button", { name: "claimAppeals.confirmUphold" }),
    );

    await waitFor(() => {
      expect(decideMock).toHaveBeenCalledWith(
        appeal.appealId,
        {
          decision: "UPHOLD",
          proofStatus: "NO_PROOF",
          revisedProvenDirectLossVnd: null,
          acceptedEvidenceIds: [],
          reason: "Chứng từ không đủ",
        },
        expect.any(String),
      );
    });
    expect(previewMock).not.toHaveBeenCalled();
    // Decision trả appeal mới → dùng thẳng, chỉ đúng 1 lần gọi detail lúc mở
    expect(detailMock).toHaveBeenCalledTimes(1);
  });

  it("duyệt điều chỉnh gửi kèm tổn thất chứng minh lại", async () => {
    const user = userEvent.setup();
    decideMock.mockResolvedValue({
      ...appeal,
      status: "ADJUSTMENT_APPROVED",
      availableActions: [],
    });
    render(<ClaimAppealsPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));
    await user.click(
      await screen.findByRole("button", {
        name: "claimAppeals.actions.DECIDE_APPEAL",
      }),
    );
    await screen.findByText("claimAppeals.decisionTitle");

    await user.click(
      screen.getByRole("radio", {
        name: /claimAppeals.decision.APPROVE_ADJUSTMENT/,
      }),
    );
    await user.click(
      screen.getByRole("radio", {
        name: /claims\.proofStatus\.VERIFIED/,
      }),
    );
    await user.type(
      screen.getByLabelText(/claimAppeals.revisedProvenLossLabel/),
      "15000000",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.type(
      screen.getByLabelText(/claimAppeals.reasonLabel/),
      "Hoá đơn hợp lệ",
    );
    await waitFor(() => expect(previewMock).toHaveBeenCalledTimes(1));
    const confirmButton = screen.getByRole("button", {
      name: "claimAppeals.confirmAdjustment",
    });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    await user.click(confirmButton);
    expect(screen.queryByText(/claimAppeals\.decisionErrors\./)).toBeNull();
    expect(screen.queryByText("claimAppeals.decisionFailed")).toBeNull();

    await waitFor(() => {
      expect(decideMock).toHaveBeenCalledWith(
        appeal.appealId,
        {
          decision: "APPROVE_ADJUSTMENT",
          proofStatus: "VERIFIED",
          revisedProvenDirectLossVnd: 15_000_000,
          acceptedEvidenceIds: [
            "36000000-0000-4000-8000-000000000801",
          ],
          reason: "Hoá đơn hợp lệ",
        },
        expect.any(String),
      );
    });
  });

  it("không gọi BE khi thiếu lý do", async () => {
    const user = userEvent.setup();
    render(<ClaimAppealsPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));
    await user.click(
      await screen.findByRole("button", {
        name: "claimAppeals.actions.DECIDE_APPEAL",
      }),
    );
    await screen.findByText("claimAppeals.decisionTitle");

    await user.click(
      screen.getByRole("button", { name: "claimAppeals.confirmUphold" }),
    );

    expect(decideMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText("claimAppeals.decisionErrors.reason-required"),
    ).toBeTruthy();
  });

  it("vẫn mở được chi tiết khi claim gốc không đọc được", async () => {
    const user = userEvent.setup();
    claimMock.mockRejectedValue(new Error("claim unavailable"));
    render(<ClaimAppealsPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));

    expect(
      await screen.findByText("claimAppeals.claimContextFailed"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "claimAppeals.actions.DECIDE_APPEAL",
      }),
    ).toBeDisabled();
  });
});
