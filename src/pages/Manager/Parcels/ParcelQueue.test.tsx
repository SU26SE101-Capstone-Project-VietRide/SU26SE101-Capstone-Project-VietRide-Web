import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelOperatorParcel,
  confirmOperatorParcelDelivery,
  getOperatorParcel,
  getOperatorParcels,
  resendOperatorParcelDeliveryEmail,
  reviewOperatorParcel,
  type OperatorParcelDetail,
  type OperatorParcelListItem,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import ParcelQueue from "./ParcelQueue";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../auth", () => ({
  getAuthUser: () => ({ role: "OPERATOR_ADMIN" }),
}));

vi.mock("../../../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

vi.mock("../../../api/vietride", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../../api/vietride")>();
  return {
    ...original,
    getOperatorParcel: vi.fn(),
    getOperatorParcels: vi.fn(),
    resendOperatorParcelDeliveryEmail: vi.fn(),
    reviewOperatorParcel: vi.fn(),
    cancelOperatorParcel: vi.fn(),
    confirmOperatorParcelDelivery: vi.fn(),
  };
});

const listItem = {
  parcelId: "parcel-1",
  parcelCode: "VR-PCL-20260812-ABCDEFGH",
  status: "DELIVERED_PENDING_CONFIRM",
  tripId: "trip-1",
  senderUserId: "sender-1",
  recipientName: "Trần Thị B",
  recipientPhone: "0901234567",
  sizeCategory: "MEDIUM",
  estimatedWeightKg: 8,
  createdAt: "2026-08-12T09:00:00Z",
} as OperatorParcelListItem;

const detail = {
  parcelId: "parcel-1",
  parcelCode: "VR-PCL-20260812-ABCDEFGH",
  status: "DELIVERED_PENDING_CONFIRM",
  recipientName: "Trần Thị B",
  operatorId: "operator-1",
  tripId: "trip-1",
  sizeCategory: "MEDIUM",
  estimatedWeightKg: 8,
  deliveryMethod: "TERMINAL_PICKUP",
  depositAmount: 36_000,
  createdAt: "2026-08-12T09:00:00Z",
  statusHistory: [
    {
      status: "LOADED",
      occurredAt: "2026-08-12T10:00:00Z",
      actorType: "CREW",
      actorId: "assistant-1",
      source: "ASSISTANT_APP",
      reason: null,
    },
    {
      status: "DELIVERED_PENDING_CONFIRM",
      occurredAt: "2026-08-12T14:00:00Z",
      // Trigger DB ghi lịch sử chỉ phát ra USER/RECIPIENT/UNKNOWN/SYSTEM và
      // STATUS_TRIGGER/MIGRATION_BASELINE (db-schema/parcel/schema.sql)
      actorType: "UNKNOWN",
      actorId: null,
      source: "STATUS_TRIGGER",
      reason: null,
    },
  ],
} as OperatorParcelDetail;

function renderQueue() {
  return render(
    <MemoryRouter initialEntries={["/manager/parcels"]}>
      <ParcelQueue />
    </MemoryRouter>,
  );
}

async function openDetail(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText("VR-PCL-20260812-ABCDEFGH");
  await user.click(
    screen.getByRole("button", { name: "parcels.queue.openAction" }),
  );
  return screen.findByRole("dialog");
}

describe("ParcelQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOperatorParcels).mockResolvedValue({
      items: [listItem],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(getOperatorParcel).mockResolvedValue(detail);
    vi.mocked(resendOperatorParcelDeliveryEmail).mockResolvedValue({
      parcelId: "parcel-1",
      status: "DELIVERED_PENDING_CONFIRM",
      expiresAt: "2026-08-13T14:00:00Z",
    });
  });

  it("lấy chi tiết qua endpoint operator và hiện lịch sử trạng thái", async () => {
    const user = userEvent.setup();
    renderQueue();

    const dialog = await openDetail(user);

    await waitFor(() =>
      expect(getOperatorParcel).toHaveBeenCalledWith("parcel-1"),
    );
    expect(
      await within(dialog).findByText("parcels.queue.statusHistorySection"),
    ).toBeInTheDocument();
    // Giữ nguyên thứ tự BE trả về
    const entries = within(dialog).getAllByRole("listitem");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent("enumLabels.LOADED");
    // Trạng thái hiện dưới dạng chip màu như timeline vé, không phải chữ trơn
    expect(
      within(entries[0]).getByText("enumLabels.LOADED").className,
    ).toContain("rounded-full");
    // Mã actor/source phải đi qua i18n, không in thẳng "UNKNOWN · STATUS_TRIGGER"
    expect(entries[1]).not.toHaveTextContent("STATUS_TRIGGER");
    expect(entries[1]).not.toHaveTextContent("UNKNOWN");
  });

  it("gửi lại email xác nhận khi bưu kiện chờ người nhận xác nhận", async () => {
    const user = userEvent.setup();
    renderQueue();

    const dialog = await openDetail(user);
    await user.click(
      await within(dialog).findByRole("button", {
        name: "parcels.queue.resendEmailButton",
      }),
    );

    // askConfirmation mở modal xác nhận thứ hai trước khi gọi BE
    const confirmButton = await screen.findByRole("button", {
      name: "confirm",
    });
    expect(resendOperatorParcelDeliveryEmail).not.toHaveBeenCalled();

    await user.click(confirmButton);

    await waitFor(() =>
      expect(resendOperatorParcelDeliveryEmail).toHaveBeenCalledWith(
        "parcel-1",
      ),
    );
  });

  // Dropdown trước đây chỉ có 3 trạng thái nên 19 trạng thái còn lại của
  // ParcelStatus không có cách nào lọc, dù BE nhận hết.
  it("lọc được mọi ParcelStatus của BE, không chỉ ba hàng đợi ưu tiên", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ParcelQueue />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getOperatorParcels).toHaveBeenCalled());

    await user.click(
      screen.getByRole("button", { name: "parcels.queue.tabListAriaLabel" }),
    );

    // Một trạng thái giữa vòng đời — trước đây không có trong dropdown
    await user.click(screen.getByRole("option", { name: "enumLabels.IN_TRANSIT" }));

    await waitFor(() =>
      expect(getOperatorParcels).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "IN_TRANSIT", page: 1 }),
      ),
    );
  });

  // Trước đây ô tìm kiếm duy nhất bắt nhập CHÍNH XÁC mã chuyến; giờ BE có
  // `search` OR-match mã đơn + tên/SĐT người gửi và người nhận.
  it("gửi search tổng quát thay vì bắt nhập mã chuyến", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ParcelQueue />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getOperatorParcels).toHaveBeenCalled());

    await user.type(
      screen.getByPlaceholderText("parcels.queue.searchPlaceholder"),
      "Nguyen Van A",
    );

    await waitFor(
      () =>
        expect(getOperatorParcels).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: "Nguyen Van A", page: 1 }),
        ),
      { timeout: 3_000 },
    );
    expect(getOperatorParcels).not.toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "Nguyen Van A" }),
    );
  });

  it("gửi khoảng ngày dạng YYYY-MM-DD kèm dateField", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ParcelQueue />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getOperatorParcels).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "trips.advancedFilters" }));
    await user.click(
      screen.getByRole("button", { name: "parcels.queue.dateFieldSelectLabel" }),
    );
    await user.click(
      screen.getByRole("option", {
        name: "parcels.queue.dateFieldPaymentDeadline",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "parcels.queue.dateFromLabel" }),
    );
    await user.click(screen.getByRole("button", { name: "2026-08-01" }));

    await waitFor(() =>
      expect(getOperatorParcels).toHaveBeenLastCalledWith(
        expect.objectContaining({
          from: "2026-08-01",
          dateField: "finalPaymentDeadline",
          sortBy: "finalPaymentDeadline",
        }),
      ),
    );
  });

  // 422 SEARCH_TOO_BROAD không phải "không có đơn nào" — phải hiện hướng dẫn
  // thu hẹp từ khoá thay vì empty state.
  it("hiện hướng dẫn riêng khi BE trả SEARCH_TOO_BROAD", async () => {
    const user = userEvent.setup();
    vi.mocked(getOperatorParcels).mockRejectedValue(
      new ApiRequestError("too broad", 422, "SEARCH_TOO_BROAD"),
    );

    render(
      <MemoryRouter>
        <ParcelQueue />
      </MemoryRouter>,
    );

    await user.type(
      screen.getByPlaceholderText("parcels.queue.searchPlaceholder"),
      "a",
    );

    expect(
      await screen.findByText("parcels.queue.searchTooBroad", {}, { timeout: 3_000 }),
    ).toBeInTheDocument();
  });

  it("giữ nguyên hàng đợi ưu tiên kèm pendingActionType", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ParcelQueue />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getOperatorParcels).toHaveBeenCalled());

    await user.click(
      screen.getByRole("button", { name: "parcels.queue.tabListAriaLabel" }),
    );
    await user.click(
      screen.getByRole("option", { name: "parcels.queue.tabOperatorAction" }),
    );

    await waitFor(() =>
      expect(getOperatorParcels).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "PENDING_OPERATOR_ACTION" }),
      ),
    );
  });

  // Mọi đơn sinh ra ở PENDING_OPERATOR_REVIEW và backend có job tự từ chối khi
  // quá hạn — không duyệt được từ màn này thì đơn chết dần.
  describe("đơn chờ duyệt", () => {
    beforeEach(() => {
      vi.mocked(getOperatorParcels).mockResolvedValue({
        items: [{ ...listItem, status: "PENDING_OPERATOR_REVIEW" }],
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
      vi.mocked(getOperatorParcel).mockResolvedValue({
        ...detail,
        status: "PENDING_OPERATOR_REVIEW",
      });
      vi.mocked(reviewOperatorParcel).mockResolvedValue({
        parcelId: "parcel-1",
        status: "PENDING_PAYMENT",
      } as Awaited<ReturnType<typeof reviewOperatorParcel>>);
    });

    it("duyệt đơn không cần lý do", async () => {
      const user = userEvent.setup();
      renderQueue();

      const dialog = await openDetail(user);
      await user.click(
        await within(dialog).findByRole("button", {
          name: "parcels.queue.approveButton",
        }),
      );
      await user.click(await screen.findByRole("button", { name: "confirm" }));

      await waitFor(() =>
        expect(reviewOperatorParcel).toHaveBeenCalledWith("parcel-1", {
          decision: "APPROVED",
        }),
      );
    });

    it("không gọi BE khi từ chối mà chưa nhập lý do", async () => {
      const user = userEvent.setup();
      renderQueue();

      const dialog = await openDetail(user);
      await user.click(
        await within(dialog).findByRole("button", {
          name: "parcels.queue.rejectButton",
        }),
      );
      await user.click(await screen.findByRole("button", { name: "confirm" }));

      // Lỗi đi ra toast (đã mock ở file này) chứ không render trong modal, nên
      // điều đáng kiểm là BE không hề bị gọi.
      await waitFor(() =>
        expect(
          screen.queryByRole("button", { name: "confirm" }),
        ).toBeNull(),
      );
      expect(reviewOperatorParcel).not.toHaveBeenCalled();
    });

    it("từ chối kèm lý do gửi đúng body", async () => {
      const user = userEvent.setup();
      renderQueue();

      const dialog = await openDetail(user);
      await user.type(
        within(dialog).getByLabelText("parcels.queue.reviewReasonLabel"),
        "Hàng cấm vận chuyển",
      );
      await user.click(
        within(dialog).getByRole("button", {
          name: "parcels.queue.rejectButton",
        }),
      );
      await user.click(await screen.findByRole("button", { name: "confirm" }));

      await waitFor(() =>
        expect(reviewOperatorParcel).toHaveBeenCalledWith("parcel-1", {
          decision: "REJECTED",
          reason: "Hàng cấm vận chuyển",
        }),
      );
    });

    // Đơn chờ duyệt vẫn còn ở giai đoạn trước khi lên hàng nên huỷ được
    it("huỷ đơn gửi kèm lựa chọn hoàn tiền", async () => {
      const user = userEvent.setup();
      vi.mocked(cancelOperatorParcel).mockResolvedValue({
        parcelId: "parcel-1",
        status: "CANCELLED",
      } as Awaited<ReturnType<typeof cancelOperatorParcel>>);
      renderQueue();

      const dialog = await openDetail(user);
      await user.type(
        within(dialog).getByLabelText("parcels.queue.cancelReasonLabel"),
        "Khách gọi xin huỷ",
      );
      await user.click(
        within(dialog).getByRole("button", {
          name: "parcels.queue.cancelButton",
        }),
      );
      await user.click(await screen.findByRole("button", { name: "confirm" }));

      await waitFor(() =>
        expect(cancelOperatorParcel).toHaveBeenCalledWith("parcel-1", {
          reason: "Khách gọi xin huỷ",
          refundChoice: "POLICY_REFUND",
        }),
      );
    });
  });

  // Hàng đã lên xe thì BE trả 409 chứ không phải lỗi nhập liệu — nút phải ẩn.
  it("ẩn hộp huỷ đơn khi hàng đã lên xe", async () => {
    const user = userEvent.setup();
    vi.mocked(getOperatorParcel).mockResolvedValue({
      ...detail,
      status: "IN_TRANSIT",
    });
    renderQueue();

    const dialog = await openDetail(user);
    await within(dialog).findByText("parcels.queue.statusHistorySection");

    expect(
      within(dialog).queryByRole("button", {
        name: "parcels.queue.cancelButton",
      }),
    ).toBeNull();
  });

  // Phụ xe đóng đơn từ app là đường chính; nút này là đường lùi khi họ không
  // làm được, nên vẫn phải gửi đúng body cho BE.
  it("xác nhận giao tay khi người nhận không bấm link email", async () => {
    const user = userEvent.setup();
    vi.mocked(confirmOperatorParcelDelivery).mockResolvedValue({
      parcelId: "parcel-1",
      status: "DELIVERY_CONFIRMED",
    } as Awaited<ReturnType<typeof confirmOperatorParcelDelivery>>);
    renderQueue();

    const dialog = await openDetail(user);
    await user.type(
      await within(dialog).findByLabelText(
        "parcels.queue.confirmDeliveryNoteLabel",
      ),
      "Khách ký nhận tại quầy",
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: "parcels.queue.confirmDeliveryButton",
      }),
    );
    await user.click(await screen.findByRole("button", { name: "confirm" }));

    await waitFor(() =>
      expect(confirmOperatorParcelDelivery).toHaveBeenCalledWith("parcel-1", {
        note: "Khách ký nhận tại quầy",
      }),
    );
  });
});
