import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decideOperatorParcelClaim,
  getOperatorParcelClaim,
  getOperatorParcelClaims,
  type ParcelClaimDetail,
  type ParcelClaimListItem,
} from "../../../api/vietride";
import ClaimsPage from "./index";
import { useToastFeedback } from "../../../hooks/useToastFeedback";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values && !("defaultValue" in values)
        ? `${key} ${Object.values(values).join(" ")}`
        : key,
  }),
}));

vi.mock("../../../api/vietride", () => ({
  getOperatorParcelClaims: vi.fn(),
  getOperatorParcelClaim: vi.fn(),
  decideOperatorParcelClaim: vi.fn(),
  PARCEL_CLAIM_STATUSES: ["SUBMITTED", "APPROVED", "REJECTED"],
  SLA_STATES: ["ON_TRACK", "DUE_SOON", "BREACHED", "CLOSED"],
}));

vi.mock("../../../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  getAuthUser: vi.fn(() => ({ role: "OPERATOR_ADMIN" })),
}));
vi.mock("../../../auth", () => authMock);

const policySnapshot = {
  version: 1,
  compensationRatePercent: 50,
  maxCompensationVnd: 30_000_000,
  noProofFallbackMultiplier: 4,
  claimWindowDays: 30,
  searchSlaHours: 72,
  decisionSlaBusinessDays: 7,
  payoutSlaBusinessDays: 3,
};

const parcel = {
  parcelId: "36000000-0000-4000-8000-000000000201",
  parcelCode: "VR-PCL-20260821-ABCD2345",
  status: "LOST_CONFIRMED",
  description: "Thùng điện tử",
  photoUrl: null,
  quantity: 1,
  declaredValueVnd: 12_000_000,
};

const claimRow: ParcelClaimListItem = {
  claimId: "36000000-0000-4000-8000-000000000701",
  status: "SUBMITTED",
  parcel,
  sender: { userId: "user-1", displayName: "Nguyễn Văn A", phone: "0900000000" },
  incident: null,
  evidenceCount: 2,
  policySnapshot,
  cargoAwardVnd: 0,
  freightRefundVnd: 0,
  totalAwardVnd: 0,
  deadline: "2026-09-01T11:00:00+07:00",
  slaState: "ON_TRACK",
  fundingStatus: "NOT_APPLICABLE",
  trip: null,
  availableActions: ["DECIDE_CLAIM"],
};

const claimDetail: ParcelClaimDetail = {
  claim: {
    claimId: claimRow.claimId,
    parcelId: parcel.parcelId,
    incidentId: "36000000-0000-4000-8000-000000000101",
    status: "SUBMITTED",
    declaredValueVnd: 12_000_000,
    provenDirectLossVnd: null,
    compensationRatePercent: 50,
    policyCapVnd: 30_000_000,
    cargoAwardVnd: 0,
    freightRefundVnd: 0,
    totalAwardVnd: 0,
    policyVersion: 1,
    beneficiaryUserId: "user-1",
    decisionReason: null,
    decidedBy: null,
    decidedAt: null,
    payoutReferenceId: null,
    paidAt: null,
    appealReason: null,
    appealedByUserId: null,
    appealedAt: null,
    evidence: [],
    policySnapshot,
    decisionDeadline: "2026-09-01T11:00:00+07:00",
    payoutDeadline: null,
    availableActions: ["DECIDE_CLAIM"],
  },
  parcel,
  incident: null,
  currentCustody: null,
  trip: null,
  expectedDropoff: null,
  beneficiary: { userId: "user-1", displayName: "Nguyễn Văn A" },
  fundingStatus: "NOT_APPLICABLE",
  availableActions: ["DECIDE_CLAIM"],
};

const listMock = vi.mocked(getOperatorParcelClaims);
const detailMock = vi.mocked(getOperatorParcelClaim);
const decideMock = vi.mocked(decideOperatorParcelClaim);
const toastMock = vi.mocked(useToastFeedback);

function mockList(items: ParcelClaimListItem[] = [claimRow]) {
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
  detailMock.mockResolvedValue(claimDetail);
});

describe("ClaimsPage", () => {
  it("hiện hàng đợi bằng dữ liệu list, không gọi detail cho từng dòng", async () => {
    render(<ClaimsPage />);

    expect(await screen.findByText("VR-PCL-20260821-ABCD2345")).toBeTruthy();
    expect(screen.getByText("Nguyễn Văn A")).toBeTruthy();
    expect(detailMock).not.toHaveBeenCalled();
  });

  it("không hiện nguyên message kỹ thuật khi tải danh sách lỗi", async () => {
    listMock.mockRejectedValue(new Error("INTERNAL_ERROR: database timeout"));
    render(<ClaimsPage />);

    await waitFor(() => {
      expect(toastMock).toHaveBeenLastCalledWith({
        message: "",
        error: "claims.loadFailed",
      });
    });
  });

  it("gửi bộ lọc trạng thái lên BE", async () => {
    const user = userEvent.setup();
    render(<ClaimsPage />);
    await screen.findByText("VR-PCL-20260821-ABCD2345");

    await user.click(screen.getByLabelText("claims.statusFilter"));
    await user.click(screen.getByRole("option", { name: "claims.status.APPROVED" }));

    await waitFor(() => {
      expect(listMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "APPROVED", page: 1 }),
      );
    });
  });

  // Endpoint decision chỉ nhận OPERATOR_ADMIN — staff mở được chi tiết nhưng
  // không được thấy nút quyết định.
  it("ẩn nút quyết định với OPERATOR_STAFF", async () => {
    const user = userEvent.setup();
    authMock.getAuthUser.mockReturnValue({ role: "OPERATOR_STAFF" });
    render(<ClaimsPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));
    await screen.findByText("claims.detailTitle");

    expect(
      screen.queryByRole("button", { name: "claims.actions.DECIDE_CLAIM" }),
    ).toBeNull();
  });

  it("ẩn nút quyết định khi BE không còn cho DECIDE_CLAIM", async () => {
    const user = userEvent.setup();
    detailMock.mockResolvedValue({ ...claimDetail, availableActions: [] });
    render(<ClaimsPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));
    await screen.findByText("claims.detailTitle");

    expect(
      screen.queryByRole("button", { name: "claims.actions.DECIDE_CLAIM" }),
    ).toBeNull();
  });

  it("duyệt khiếu nại gửi đúng body và không refetch detail", async () => {
    const user = userEvent.setup();
    decideMock.mockResolvedValue({
      ...claimDetail,
      claim: { ...claimDetail.claim, status: "APPROVED" },
      availableActions: [],
    });
    render(<ClaimsPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));
    await user.click(
      await screen.findByRole("button", {
        name: "claims.actions.DECIDE_CLAIM",
      }),
    );

    // Các nhãn dưới đây chỉ tồn tại trong modal quyết định nên không cần scope
    await screen.findByText("claims.decisionTitle");

    await user.type(
      screen.getByLabelText(/claims.provenLossLabel/),
      "12000000",
    );
    await user.type(screen.getByLabelText(/claims.reasonLabel/), "Lỗi vận hành");
    await user.click(
      screen.getByRole("button", { name: "claims.confirmApprove" }),
    );

    await waitFor(() => {
      expect(decideMock).toHaveBeenCalledWith(claimRow.claimId, {
        decision: "APPROVE",
        provenDirectLossVnd: 12_000_000,
        reason: "Lỗi vận hành",
      });
    });
    // Mutation trả detail mới → dùng thẳng, chỉ có đúng 1 lần gọi detail lúc mở
    expect(detailMock).toHaveBeenCalledTimes(1);
  });

  it("không gọi BE khi thiếu lý do", async () => {
    const user = userEvent.setup();
    render(<ClaimsPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));
    await user.click(
      await screen.findByRole("button", {
        name: "claims.actions.DECIDE_CLAIM",
      }),
    );
    await screen.findByText("claims.decisionTitle");

    await user.click(
      screen.getByRole("button", { name: "claims.confirmApprove" }),
    );

    expect(decideMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText("claims.decisionErrors.reason-required"),
    ).toBeTruthy();
  });
});
