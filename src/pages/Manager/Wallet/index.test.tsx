// Test cho trang Ví nhà xe sau khi áp dụng contract minh bạch ví
// (FE-REQUEST-operator-wallet-transparency-RESPONSE.md). Tập trung vào các
// quy tắc bắt buộc: không gộp 4 card thành tổng, ẩn luồng rút tiền khi
// withdrawalSupported=false, dùng processingState/dataCompleteness thay vì tự
// suy diễn, signedAmount quyết định dấu +/-, search debounce + validate độ
// dài trước khi gọi API.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ToastProvider from "../../../components/toast/ToastProvider";
import type {
  OperatorLedgerEntry,
  OperatorWallet,
  TripSettlement,
  WalletTransaction,
} from "../../../api/vietride";
import ManagerWallet from "./index";

// t phải là tham chiếu ổn định qua các lần render (giống i18next thật) — nếu
// khai inline trong useTranslation(), mỗi lần re-render tạo hàm mới, khiến
// loadData (useCallback phụ thuộc t) đổi identity liên tục và effect gọi lại
// vô hạn, không phản ánh đúng hành vi thật của app.
const translate = (key: string) => key;
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

vi.mock("../../../api/vietride", () => ({
  getOperatorWallet: vi.fn(),
  getOperatorWalletTransactions: vi.fn(),
  getOperatorTripSettlements: vi.fn(),
  getOperatorLedger: vi.fn(),
}));

import {
  getOperatorLedger,
  getOperatorTripSettlements,
  getOperatorWallet,
  getOperatorWalletTransactions,
} from "../../../api/vietride";

function pagedResult<T>(items: T[]) {
  return {
    items,
    page: 1,
    pageSize: 10,
    totalItems: items.length,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

const walletMock: OperatorWallet = {
  operatorId: "op-1",
  balance: 1250000,
  currency: "VND",
  awaitingTripCompletionAmount: 1700000,
  awaitingTripCompletionCount: 6,
  pendingHoldAmount: 300000,
  pendingHoldCount: 4,
  eligibleAmount: 450000,
  eligibleCount: 2,
  nextEligibleAt: "2026-07-17T10:00:00Z",
  nextScheduledSettlementAttemptAt: "2026-07-20T02:00:00Z",
  lifetimeSettledAmount: 3500000,
  lastSettlement: {
    settlementId: "settlement-1",
    amount: 450000,
    method: "AUTO_WEEKLY",
    settledAt: "2026-07-13T02:00:00Z",
  },
  withdrawalSupported: false,
  updatedAt: "2026-07-15T10:00:00Z",
  calculatedAt: "2026-07-15T10:00:03Z",
};

const creditTransaction: WalletTransaction = {
  transactionId: "txn-1",
  type: "CREDIT",
  amount: 450000,
  signedAmount: 450000,
  balanceBefore: 800000,
  balanceAfter: 1250000,
  referenceType: "TRIP_SETTLEMENT",
  referenceId: "settlement-1",
  note: null,
  createdAt: "2026-07-13T02:00:00Z",
  actorType: "SYSTEM",
  relatedSettlement: { settlementId: "settlement-1", tripId: "trip-1", method: "AUTO_WEEKLY" },
  dataCompleteness: "COMPLETE",
};

const debitTransaction: WalletTransaction = {
  transactionId: "txn-2",
  type: "DEBIT",
  amount: 50000,
  signedAmount: -50000,
  balanceBefore: 1300000,
  balanceAfter: 1250000,
  referenceType: "SUBSCRIPTION_PAYMENT",
  referenceId: null,
  note: "Legacy row",
  createdAt: "2026-06-01T02:00:00Z",
  dataCompleteness: "PARTIAL",
  missingFields: ["actor"],
};

const onHoldSettlement: TripSettlement = {
  settlementId: "settlement-2",
  tripId: "trip-2",
  status: "PENDING_HOLD",
  processingState: "ON_HOLD",
  eligibleAt: "2026-08-17T10:00:00Z",
  netAmount: 300000,
  netEntitlementAmount: 300000,
  settlementMethod: null,
  settledAt: null,
  createdAt: "2026-08-10T02:00:00Z",
  trip: null,
};

const ledgerEntry: OperatorLedgerEntry = {
  ledgerEntryId: "ledger-1",
  tripId: "trip-2",
  entryType: "BOOKING_REVENUE",
  amount: 300000,
  referenceType: "BOOKING",
  referenceId: "booking-1",
  referenceCode: "BK-100",
  createdAt: "2026-08-10T02:00:00Z",
  occurredAt: "2026-08-10T02:00:00Z",
  occurredAtSource: "BUSINESS_EVENT",
  affectsRevenue: true,
  affectsSettlement: true,
};

function renderWallet() {
  return render(
    <ToastProvider>
      <ManagerWallet />
    </ToastProvider>,
  );
}

describe("ManagerWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOperatorWallet).mockResolvedValue(walletMock);
    vi.mocked(getOperatorWalletTransactions).mockResolvedValue(
      pagedResult([creditTransaction, debitTransaction]),
    );
    vi.mocked(getOperatorTripSettlements).mockResolvedValue(pagedResult([onHoldSettlement]));
    vi.mocked(getOperatorLedger).mockResolvedValue(pagedResult([ledgerEntry]));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads the overview cards and the transaction list without a combined total", async () => {
    renderWallet();

    await waitFor(() => expect(getOperatorWallet).toHaveBeenCalled());
    // 4 card mô tả 4 giai đoạn riêng biệt — không có nhãn "tổng" nào gộp lại.
    expect(screen.getByText("wallet.currentBalance")).toBeInTheDocument();
    expect(screen.getByText("wallet.awaitingTripCompletion")).toBeInTheDocument();
    expect(screen.getByText("wallet.pendingHold")).toBeInTheDocument();
    expect(screen.getByText("wallet.eligibleAmount")).toBeInTheDocument();
    expect(screen.queryByText(/tổng tài sản/i)).not.toBeInTheDocument();

    await waitFor(() => expect(getOperatorWalletTransactions).toHaveBeenCalled());
    expect(await screen.findByText("+450.000 đ")).toBeInTheDocument();
    expect(screen.getByText("-50.000 đ")).toBeInTheDocument();
  });

  it("hides withdrawal UI when withdrawalSupported is false", async () => {
    renderWallet();

    expect(await screen.findByText("wallet.withdrawalUnsupported")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rút tiền|withdraw/i })).not.toBeInTheDocument();
  });

  it("shows the PARTIAL data-completeness badge without crashing on missing metadata", async () => {
    renderWallet();

    expect(await screen.findByText("wallet.partialBadge")).toBeInTheDocument();
  });

  it("renders processingState chips for settlements and stays safe when trip is null", async () => {
    renderWallet();

    fireEvent.click(screen.getByRole("button", { name: "wallet.tabs.settlements" }));

    await waitFor(() => expect(getOperatorTripSettlements).toHaveBeenCalled());
    expect(await screen.findByText("wallet.processingState.ON_HOLD")).toBeInTheDocument();
    // trip=null -> fallback theo tripId, không crash
    expect(screen.getByText("wallet.tripFallback")).toBeInTheDocument();
  });

  it("renders the ledger tab with referenceCode instead of parsing note", async () => {
    renderWallet();

    fireEvent.click(screen.getByRole("button", { name: "wallet.tabs.ledger" }));

    await waitFor(() => expect(getOperatorLedger).toHaveBeenCalled());
    expect(await screen.findByText("BK-100")).toBeInTheDocument();
  });

  it("does not call the API for a 1-character search but does after 2+ characters (debounced)", async () => {
    renderWallet();
    await waitFor(() => expect(getOperatorWalletTransactions).toHaveBeenCalled());
    const callsBeforeSearch = vi.mocked(getOperatorWalletTransactions).mock.calls.length;

    const searchInput = screen.getByPlaceholderText("wallet.searchPlaceholder.transactions");
    fireEvent.change(searchInput, { target: { value: "B" } });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(vi.mocked(getOperatorWalletTransactions).mock.calls.length).toBe(callsBeforeSearch);

    fireEvent.change(searchInput, { target: { value: "BK" } });
    await waitFor(() => {
      expect(vi.mocked(getOperatorWalletTransactions).mock.calls.length).toBeGreaterThan(callsBeforeSearch);
    });
    const lastCall = vi.mocked(getOperatorWalletTransactions).mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({ search: "BK", page: 1 });
  });
});
