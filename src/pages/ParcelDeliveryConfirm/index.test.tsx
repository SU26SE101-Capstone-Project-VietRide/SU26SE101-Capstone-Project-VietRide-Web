import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "../../api/client";
import {
  confirmParcelDeliveryByToken,
  rejectParcelDeliveryByToken,
  undoRejectParcelDeliveryByToken,
} from "../../api/vietride";
import ParcelDeliveryConfirmPage from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "vi" },
  }),
}));

vi.mock("../../components/LanguageSwitcher", () => ({
  default: () => <div>language-switcher</div>,
}));

vi.mock("../../api/vietride", () => ({
  confirmParcelDeliveryByToken: vi.fn(),
  rejectParcelDeliveryByToken: vi.fn(),
  undoRejectParcelDeliveryByToken: vi.fn(),
}));

const TOKEN = "6f2a1b3c-4d5e-4f60-8a91-2b3c4d5e6f70";

const confirmMock = vi.mocked(confirmParcelDeliveryByToken);
const rejectMock = vi.mocked(rejectParcelDeliveryByToken);
const undoMock = vi.mocked(undoRejectParcelDeliveryByToken);

function openWith(search: string) {
  window.history.replaceState(null, "", `/parcels/delivery/confirm${search}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  openWith(`?token=${TOKEN}`);
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("ParcelDeliveryConfirmPage", () => {
  it("chặn ngay khi link thiếu token, không gọi API", () => {
    openWith("");
    render(<ParcelDeliveryConfirmPage />);

    expect(screen.getByText("errors.missingToken")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "actions.confirm" })).toBeNull();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("xoá token khỏi URL ngay khi mở trang", () => {
    render(<ParcelDeliveryConfirmPage />);

    expect(window.location.search).toBe("");
    expect(screen.getByRole("button", { name: "actions.confirm" })).toBeTruthy();
  });

  it("xác nhận thành công và gửi kèm Idempotency-Key", async () => {
    const user = userEvent.setup();
    confirmMock.mockResolvedValue({
      parcelId: "parcel-1",
      status: "DELIVERY_CONFIRMED",
      confirmedAt: "2026-08-15T10:00:00+07:00",
    });

    render(<ParcelDeliveryConfirmPage />);
    await user.click(screen.getByRole("button", { name: "actions.confirm" }));

    await waitFor(() => {
      expect(screen.getByText("confirmed.title")).toBeTruthy();
    });
    expect(confirmMock).toHaveBeenCalledWith(
      { token: TOKEN },
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
    );
    expect(
      screen.queryByRole("button", { name: "actions.confirm" }),
    ).toBeNull();
  });

  it("giữ nguyên Idempotency-Key khi người dùng bấm lại sau lỗi tạm", async () => {
    const user = userEvent.setup();
    confirmMock
      .mockRejectedValueOnce(
        new ApiRequestError("rate limited", 429, "RATE_LIMITED"),
      )
      .mockResolvedValueOnce({
        parcelId: "parcel-1",
        status: "DELIVERY_CONFIRMED",
        confirmedAt: "2026-08-15T10:00:00+07:00",
      });

    render(<ParcelDeliveryConfirmPage />);
    await user.click(screen.getByRole("button", { name: "actions.confirm" }));

    await waitFor(() => {
      expect(screen.getByText("errors.rateLimited")).toBeTruthy();
    });

    await user.click(screen.getByRole("button", { name: "actions.confirm" }));
    await waitFor(() => {
      expect(screen.getByText("confirmed.title")).toBeTruthy();
    });

    expect(confirmMock).toHaveBeenCalledTimes(2);
    expect(confirmMock.mock.calls[0][1]).toBe(confirmMock.mock.calls[1][1]);
  });

  it("khoá thao tác khi token hết hạn", async () => {
    const user = userEvent.setup();
    confirmMock.mockRejectedValue(
      new ApiRequestError("expired", 400, "PARCEL_DELIVERY_TOKEN_EXPIRED"),
    );

    render(<ParcelDeliveryConfirmPage />);
    await user.click(screen.getByRole("button", { name: "actions.confirm" }));

    await waitFor(() => {
      expect(screen.getByText("errors.tokenExpired")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "actions.confirm" })).toBeNull();
  });

  it("khoá thao tác khi đơn không còn chờ xác nhận", async () => {
    const user = userEvent.setup();
    confirmMock.mockRejectedValue(
      new ApiRequestError("wrong status", 400, "PARCEL_NOT_PENDING_CONFIRM"),
    );

    render(<ParcelDeliveryConfirmPage />);
    await user.click(screen.getByRole("button", { name: "actions.confirm" }));

    await waitFor(() => {
      expect(screen.getByText("errors.notPendingConfirm")).toBeTruthy();
    });
  });

  it("bắt buộc nhập lý do trước khi từ chối", async () => {
    const user = userEvent.setup();
    render(<ParcelDeliveryConfirmPage />);

    await user.click(screen.getByRole("button", { name: "actions.reject" }));
    await user.click(screen.getByRole("button", { name: "reject.submit" }));

    expect(screen.getByText("reject.required")).toBeTruthy();
    expect(rejectMock).not.toHaveBeenCalled();
  });

  it("từ chối kèm lý do rồi hoàn tác được trong cửa sổ cho phép", async () => {
    const user = userEvent.setup();
    rejectMock.mockResolvedValue({
      parcelId: "parcel-1",
      status: "DELIVERY_REJECTED",
      rejectedAt: "2026-08-15T10:00:00+07:00",
      canUndoUntil: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
    undoMock.mockResolvedValue({
      parcelId: "parcel-1",
      status: "DELIVERED_PENDING_CONFIRM",
      undoneAt: "2026-08-15T10:05:00+07:00",
    });

    render(<ParcelDeliveryConfirmPage />);
    await user.click(screen.getByRole("button", { name: "actions.reject" }));
    await user.type(screen.getByRole("textbox"), "Hàng bị móp");
    await user.click(screen.getByRole("button", { name: "reject.submit" }));

    await waitFor(() => {
      expect(screen.getByText("rejected.title")).toBeTruthy();
    });
    expect(rejectMock).toHaveBeenCalledWith(
      { token: TOKEN, rejectionReason: "Hàng bị móp" },
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
    );

    await user.click(screen.getByRole("button", { name: "actions.undo" }));
    await waitFor(() => {
      expect(screen.getByText("rejected.undone")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "actions.confirm" })).toBeTruthy();
  });

  it("chỉ ẩn nút hoàn tác khi hết cửa sổ, không xoá màn hình từ chối", async () => {
    const user = userEvent.setup();
    rejectMock.mockResolvedValue({
      parcelId: "parcel-1",
      status: "DELIVERY_REJECTED",
      rejectedAt: "2026-08-15T10:00:00+07:00",
      canUndoUntil: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
    undoMock.mockRejectedValue(
      new ApiRequestError(
        "undo window closed",
        400,
        "PARCEL_DELIVERY_REJECTED_WINDOW_EXPIRED",
      ),
    );

    render(<ParcelDeliveryConfirmPage />);
    await user.click(screen.getByRole("button", { name: "actions.reject" }));
    await user.type(screen.getByRole("textbox"), "Sai hàng");
    await user.click(screen.getByRole("button", { name: "reject.submit" }));

    await waitFor(() => {
      expect(screen.getByText("rejected.title")).toBeTruthy();
    });
    await user.click(screen.getByRole("button", { name: "actions.undo" }));

    await waitFor(() => {
      expect(screen.getByText("errors.undoWindowExpired")).toBeTruthy();
    });
    expect(screen.getByText("rejected.title")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "actions.undo" })).toBeNull();
  });
});
