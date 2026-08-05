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
  tripId: "trip-1",
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
    expect(screen.queryByText("walletSettlement.flowTitle")).not.toBeInTheDocument();
    expect(
      screen.queryByText("walletSettlement.status.PENDING_HOLD"),
    ).not.toBeInTheDocument();

    const allFilterLabel = screen.getByText("walletSettlement.filters.ALL");
    const attentionFilterLabel = screen.getByText(
      "walletSettlement.filters.NEEDS_ATTENTION",
    );
    const eligibleFilterLabel = screen.getByText(
      "walletSettlement.filters.ELIGIBLE",
    );
    expect(allFilterLabel.nextElementSibling).toHaveTextContent("1");
    expect(attentionFilterLabel.nextElementSibling).toHaveTextContent("1");
    expect(eligibleFilterLabel.nextElementSibling).toHaveTextContent("1");
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
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.getByText("walletSettlement.moneyIn")).toBeInTheDocument();
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
    expect(translate).toHaveBeenCalledWith(
      "walletSettlement.settledMessage",
      { operator: settlementWithOperator.operator.name },
    );
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
});
