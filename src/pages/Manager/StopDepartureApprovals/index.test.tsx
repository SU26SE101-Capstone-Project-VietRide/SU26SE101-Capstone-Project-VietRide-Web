import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decideParcelStopDepartureApproval,
  getOperatorParcel,
  getParcelStopDepartureApproval,
  type ParcelStopDepartureApproval,
} from "../../../api/vietride";
import StopDepartureApprovalsPage from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values && !("defaultValue" in values)
        ? `${key} ${Object.values(values).join(" ")}`
        : key,
  }),
}));

vi.mock("../../../api/vietride", () => ({
  getParcelStopDepartureApproval: vi.fn(),
  decideParcelStopDepartureApproval: vi.fn(),
  getOperatorParcel: vi.fn(),
}));

vi.mock("../../../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

const REQUEST_ID = "36000000-0000-4000-8000-000000000a01";
const PARCEL_ID = "36000000-0000-4000-8000-000000000201";

const approval: ParcelStopDepartureApproval = {
  requestId: REQUEST_ID,
  tripId: "36000000-0000-4000-8000-000000000301",
  stopId: "36000000-0000-4000-8000-000000000401",
  operatorId: "36000000-0000-4000-8000-000000000101",
  unresolvedParcelIds: [PARCEL_ID],
  departureOverrideReason: "Không tìm thấy kiện khi đối soát tại bến",
  status: "PENDING_APPROVAL",
  requestedByUserId: "36000000-0000-4000-8000-000000000001",
  requestedByRole: "ASSISTANT",
  requestedAt: "2026-08-25T10:00:00+07:00",
  reviewedByUserId: null,
  reviewedByRole: null,
  reviewedAt: null,
  reviewNote: null,
  availableActions: ["APPROVE", "REJECT"],
};

const lookupMock = vi.mocked(getParcelStopDepartureApproval);
const decideMock = vi.mocked(decideParcelStopDepartureApproval);
const parcelMock = vi.mocked(getOperatorParcel);

function renderPage(initialEntry = "/manager/stop-departure-approvals") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <StopDepartureApprovalsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  lookupMock.mockResolvedValue(approval);
  parcelMock.mockResolvedValue({
    parcelId: PARCEL_ID,
    parcelCode: "VR-PCL-20260821-ABCD2345",
    status: "IN_TRANSIT",
  } as Awaited<ReturnType<typeof getOperatorParcel>>);
});

describe("StopDepartureApprovalsPage", () => {
  it("mở thẳng yêu cầu từ deep link `?requestId=`", async () => {
    renderPage(`/manager/stop-departure-approvals?requestId=${REQUEST_ID}`);

    await waitFor(() => {
      expect(lookupMock).toHaveBeenCalledWith(REQUEST_ID);
    });
    expect(
      await screen.findByText("Không tìm thấy kiện khi đối soát tại bến"),
    ).toBeTruthy();
  });

  it("đổi UUID kiện thành mã kiện đọc được", async () => {
    renderPage(`/manager/stop-departure-approvals?requestId=${REQUEST_ID}`);

    expect(
      await screen.findByText("VR-PCL-20260821-ABCD2345"),
    ).toBeTruthy();
  });

  it("vẫn hiện được yêu cầu khi không tra được mã kiện", async () => {
    parcelMock.mockRejectedValue(new Error("parcel unavailable"));
    renderPage(`/manager/stop-departure-approvals?requestId=${REQUEST_ID}`);

    expect(await screen.findByText(PARCEL_ID)).toBeTruthy();
  });

  // §9: không có queue nên mã phải đến từ crew — chuỗi tự gõ bị chặn tại chỗ,
  // không được phép gửi lên BE để "thử xem có không".
  it("không gọi BE khi mã yêu cầu không phải UUID", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText("stopDepartureApprovals.requestIdLabel"),
      "khong-phai-uuid",
    );
    await user.click(
      screen.getByRole("button", { name: "stopDepartureApprovals.lookup" }),
    );

    expect(lookupMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText("stopDepartureApprovals.invalidRequestId"),
    ).toBeTruthy();
  });

  it("chỉ hiện CTA theo `availableActions` của BE", async () => {
    lookupMock.mockResolvedValue({
      ...approval,
      status: "APPROVED",
      availableActions: [],
    });
    renderPage(`/manager/stop-departure-approvals?requestId=${REQUEST_ID}`);

    await screen.findByText("Không tìm thấy kiện khi đối soát tại bến");
    expect(
      screen.queryByRole("button", { name: "stopDepartureApprovals.approve" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "stopDepartureApprovals.reject" }),
    ).toBeNull();
  });

  it("gửi quyết định với đúng hai field và thay bằng response", async () => {
    const user = userEvent.setup();
    decideMock.mockResolvedValue({
      ...approval,
      status: "APPROVED",
      reviewedAt: "2026-08-25T11:00:00+07:00",
      reviewedByRole: "OPERATOR_ADMIN",
      availableActions: [],
    });
    renderPage(`/manager/stop-departure-approvals?requestId=${REQUEST_ID}`);

    await user.click(
      await screen.findByRole("button", {
        name: "stopDepartureApprovals.approve",
      }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox"),
      "Đã mở nhiệm vụ tìm kiếm",
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: "stopDepartureApprovals.approve",
      }),
    );

    await waitFor(() => {
      expect(decideMock).toHaveBeenCalledWith(
        REQUEST_ID,
        { decision: "APPROVE", note: "Đã mở nhiệm vụ tìm kiếm" },
        expect.any(String),
      );
    });
    // Response là state mới — không tra cứu lại lần hai
    expect(lookupMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("stopDepartureApprovals.reviewTitle")).toBeTruthy();
  });
});
