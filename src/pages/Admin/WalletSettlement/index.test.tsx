import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAdminPlatformWallet,
  getAdminPlatformWalletTransactions,
  getAdminTripSettlements,
  settleAdminTripSettlement,
} from "../../../api/vietride";
import WalletSettlement from ".";

const { translate } = vi.hoisted(() => ({
  translate: vi.fn((key: string) => key),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: translate,
  }),
}));

vi.mock("../../../api/vietride", () => ({
  adjustAdminOperatorWallet: vi.fn(),
  adjustAdminPlatformWallet: vi.fn(),
  getAdminPlatformWallet: vi.fn(),
  getAdminPlatformWalletTransactions: vi.fn(),
  getAdminTripSettlements: vi.fn(),
  retryAdminInvoice: vi.fn(),
  settleAdminTripSettlement: vi.fn(),
}));

const settlement = {
  settlementId: "settlement-1",
  settlementCode: "STL-20260721-P9R4TX2W",
  tripId: "trip-1",
  tripCode: "TRIP-20260721-M5Q7WV3D",
  operatorId: "operator-1",
  status: "ELIGIBLE",
  eligibleAt: "2026-07-28T02:00:00Z",
  netAmount: 500_000,
  settlementMethod: null,
  settledAt: null,
  createdAt: "2026-07-21T02:00:00Z",
  failureCount: 2,
  activeFailureCode: "PLATFORM_WALLET_INSUFFICIENT_BALANCE",
  severity: "HIGH",
} as const;

const page = {
  items: [settlement],
  page: 1,
  pageSize: 10,
  totalItems: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

const creditTransaction = {
  transactionId: "transaction-credit",
  transactionCode: "PWT-20260729-4F8N2KQJ",
  type: "CREDIT",
  amount: 100_000,
  balanceBefore: 1_000_000,
  balanceAfter: 1_100_000,
  referenceType: "BOOKING_PAYMENT_HOLD",
  referenceId: "booking-1",
  note: null,
  createdAt: "2026-07-29T02:00:00Z",
  actorType: "SYSTEM",
} as const;

const debitTransaction = {
  transactionId: "transaction-debit",
  type: "DEBIT",
  amount: 50_000,
  balanceBefore: 1_100_000,
  balanceAfter: 1_050_000,
  referenceType: "SETTLEMENT_TO_OPERATOR",
  referenceId: "settlement-1",
  note: null,
  createdAt: "2026-07-29T03:00:00Z",
  actorType: "SYSTEM",
} as const;

describe("Admin WalletSettlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminPlatformWallet).mockResolvedValue({
      platformWalletId: "platform-wallet-1",
      balance: 2_000_000,
      updatedAt: "2026-07-29T02:00:00Z",
    });
    vi.mocked(getAdminTripSettlements).mockResolvedValue(page);
    vi.mocked(getAdminPlatformWalletTransactions).mockResolvedValue({
      ...page,
      items: [],
    });
    vi.mocked(settleAdminTripSettlement).mockResolvedValue({
      ...settlement,
      status: "SETTLED",
      settlementMethod: "ADMIN_MANUAL",
      settledAt: "2026-07-29T03:00:00Z",
    });
  });

  it("loads the needs-attention queue from the legacy payout redirect", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[
          "/admin/wallet-settlement?tab=settlements&filter=needs-attention",
        ]}
      >
        <WalletSettlement />
      </MemoryRouter>,
    );

    expect(await screen.findByText(settlement.operatorId)).toBeInTheDocument();
    expect(getAdminTripSettlements).toHaveBeenCalledWith(
      expect.objectContaining({ stuckOnly: true }),
    );
    expect(
      screen.getByRole("columnheader", {
        name: "walletSettlement.settlementAmount",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("walletSettlement.flowTitle"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("walletSettlement.status.PENDING_HOLD"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "status" }));
    expect(
      screen.getByRole("option", { name: "walletSettlement.filters.ALL" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", {
        name: "walletSettlement.filters.NEEDS_ATTENTION",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "walletSettlement.filters.ELIGIBLE" }),
    ).toBeInTheDocument();
  });

  // Bản admin trả `tripCode` ở TOP-LEVEL (bản operator thì nằm trong snapshot
  // `trip`) — đọc sai chỗ là cột mã chuyến trắng trơn trên toàn màn admin.
  it("hiện mã đối soát và mã chuyến top-level của bản admin", async () => {
    render(
      <MemoryRouter
        initialEntries={["/admin/wallet-settlement?tab=settlements"]}
      >
        <WalletSettlement />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("STL-20260721-P9R4TX2W"),
    ).toBeInTheDocument();
    expect(screen.getByText("TRIP-20260721-M5Q7WV3D")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", {
        name: "walletSettlement.settlementCode",
      }),
    ).toBeInTheDocument();
  });

  it("truncates long operator names and exposes the full text on hover", async () => {
    const longOperatorName =
      "Nhà xe Hồng Gia Đà Nẵng - Chi nhánh Bắc Sông Thuận An - Tỉnh Thừa Thiên Huế";

    vi.mocked(getAdminTripSettlements).mockResolvedValue({
      ...page,
      items: [
        {
          ...settlement,
          operator: {
            operatorId: "operator-long",
            name: longOperatorName,
            logoUrl: null,
            contactPhone: null,
          },
        },
      ],
    });

    render(
      <MemoryRouter
        initialEntries={["/admin/wallet-settlement?tab=settlements"]}
      >
        <WalletSettlement />
      </MemoryRouter>,
    );

    const operatorCell = await screen.findByText(longOperatorName);
    expect(operatorCell).toHaveClass("truncate");
    expect(operatorCell).toHaveAttribute("title", longOperatorName);
  });

  it("combines money in and out into one paginated table", async () => {
    const user = userEvent.setup();
    vi.mocked(getAdminPlatformWalletTransactions).mockResolvedValue({
      items: [creditTransaction, debitTransaction],
      page: 1,
      pageSize: 10,
      totalItems: 11,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });

    render(
      <MemoryRouter
        initialEntries={["/admin/wallet-settlement?tab=transactions"]}
      >
        <WalletSettlement />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("walletSettlement.latestTransactions"),
    ).toBeInTheDocument();
    // Tiêu đề khung có ngay từ render đầu, các dòng giao dịch thì tới sau —
    // chờ nội dung của DÒNG, không thì máy chạy chậm là hụt.
    expect(
      await screen.findByText("walletSettlement.moneyIn"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.getByText("walletSettlement.moneyOut")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "walletSettlement.cashFlow" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("walletSettlement.references.BOOKING_PAYMENT_HOLD"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("walletSettlement.references.SETTLEMENT_TO_OPERATOR"),
    ).toBeInTheDocument();
    // Ví nền tảng dùng mã `PWT-…`; row legacy (debitTransaction) chưa backfill
    // thì để "-", không được ra "undefined".
    expect(screen.getByText("PWT-20260729-4F8N2KQJ")).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "next" }));
    await waitFor(() =>
      expect(getAdminPlatformWalletTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 10 }),
      ),
    );
  });

  it("refreshes financial data after a manual settlement", async () => {
    const user = userEvent.setup();
    const settlementWithOperator = {
      ...settlement,
      operator: {
        operatorId: settlement.operatorId,
        name: "Nhà xe Minh Tâm",
        logoUrl: null,
        contactPhone: null,
      },
    } as const;
    vi.mocked(getAdminTripSettlements).mockResolvedValue({
      ...page,
      items: [settlementWithOperator],
    });
    render(
      <MemoryRouter
        initialEntries={[
          "/admin/wallet-settlement?tab=settlements&filter=eligible",
        ]}
      >
        <WalletSettlement />
      </MemoryRouter>,
    );

    await screen.findByText(settlementWithOperator.operator.name);
    await user.click(
      screen.getByRole("button", {
        name: "walletSettlement.manualSettle",
      }),
    );

    expect(settleAdminTripSettlement).not.toHaveBeenCalled();
    expect(
      screen.getByText("walletSettlement.manualSettleHint"),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "walletSettlement.confirmManualSettle",
      }),
    );

    await waitFor(() =>
      expect(settleAdminTripSettlement).toHaveBeenCalledWith(
        settlement.settlementId,
      ),
    );
    await waitFor(() =>
      expect(getAdminPlatformWallet).toHaveBeenCalledTimes(2),
    );
    expect(translate).toHaveBeenCalledWith("walletSettlement.settledMessage", {
      operator: settlementWithOperator.operator.name,
    });
  });

  it("allows an admin to settle a pending hold early", async () => {
    const user = userEvent.setup();
    const pendingSettlement = {
      ...settlement,
      settlementId: "settlement-pending",
      status: "PENDING_HOLD",
    } as const;
    vi.mocked(getAdminTripSettlements).mockResolvedValue({
      ...page,
      items: [pendingSettlement],
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/admin/wallet-settlement?tab=settlements&filter=pending-hold",
        ]}
      >
        <WalletSettlement />
      </MemoryRouter>,
    );

    await screen.findByText(pendingSettlement.operatorId);
    const settleButton = screen.getByRole("button", {
      name: "walletSettlement.manualSettle",
    });
    expect(settleButton).toBeEnabled();
    await user.click(settleButton);
    await user.click(
      screen.getByRole("button", {
        name: "walletSettlement.confirmManualSettle",
      }),
    );

    await waitFor(() =>
      expect(settleAdminTripSettlement).toHaveBeenCalledWith(
        pendingSettlement.settlementId,
      ),
    );
  });

  // Màn phân trang server-side; trước đây ô tìm kiếm lại lọc mảng của đúng
  // trang đang xem nên gõ mã nằm ở trang sau là ra bảng rỗng.
  it("gửi search lên BE cho cả đối soát lẫn giao dịch, và reset về trang 1", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={["/admin/wallet-settlement?tab=settlements"]}
      >
        <WalletSettlement />
      </MemoryRouter>,
    );

    await screen.findByText(settlement.operatorId);

    await user.type(
      screen.getByPlaceholderText("walletSettlement.searchPlaceholder"),
      "VR-20260813",
    );

    await waitFor(
      () =>
        expect(getAdminTripSettlements).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: "VR-20260813", page: 1 }),
        ),
      { timeout: 3_000 },
    );
    expect(getAdminPlatformWalletTransactions).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "VR-20260813", page: 1 }),
    );
  });
});
