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
  translate: (key: string) => key,
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
  });

  it("refreshes financial data after a manual settlement", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[
          "/admin/wallet-settlement?tab=settlements&filter=eligible",
        ]}
      >
        <WalletSettlement />
      </MemoryRouter>,
    );

    await screen.findByText(settlement.operatorId);
    await user.click(
      screen.getByRole("button", {
        name: "walletSettlement.manualSettle",
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
  });
});
