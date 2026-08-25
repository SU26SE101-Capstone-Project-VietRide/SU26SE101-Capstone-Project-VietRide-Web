// Test cho trang Ví nhà xe sau khi áp dụng contract minh bạch ví
// (FE-REQUEST-operator-wallet-transparency-RESPONSE.md). Tập trung vào các
// quy tắc bắt buộc: không gộp 4 card thành tổng, ẩn luồng rút tiền khi
// withdrawalSupported=false, dùng processingState/dataCompleteness thay vì tự
// suy diễn, signedAmount quyết định dấu +/-, search debounce + validate độ
// dài trước khi gọi API.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    settlementCode: "STL-20260713-AAAA1111",
    tripCode: "TRIP-20260713-BBBB2222",
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
  transactionCode: "OWT-20260713-7K3M2QPX",
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
  relatedSettlement: {
    settlementId: "settlement-1",
    settlementCode: "STL-20260713-AAAA1111",
    tripId: "trip-1",
    tripCode: "TRIP-20260713-BBBB2222",
    method: "AUTO_WEEKLY",
  },
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
  settlementCode: "STL-20260810-CCCC3333",
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

    expect(await screen.findByText("wallet.currentBalance")).toBeInTheDocument();
    expect(screen.queryByText("wallet.withdrawalUnsupported")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rút tiền|withdraw/i })).not.toBeInTheDocument();
  });

  it("uses distinct colors for settlement summary items", async () => {
    renderWallet();

    const scheduledLabel = await screen.findByText(
      "wallet.nextScheduledAttempt",
      { exact: false },
    );
    const lifetimeLabel = screen.getByText("wallet.lifetimeSettled", {
      exact: false,
    });
    const latestLabel = screen.getByText("wallet.lastSettlement", {
      exact: false,
    });

    expect(scheduledLabel.parentElement).toHaveClass(
      "border-amber-200",
      "bg-amber-50",
      "text-amber-900",
    );
    expect(lifetimeLabel.parentElement).toHaveClass(
      "border-emerald-200",
      "bg-emerald-50",
      "text-emerald-900",
    );
    expect(latestLabel.parentElement).toHaveClass(
      "border-blue-200",
      "bg-blue-50",
      "text-blue-900",
    );

  });
  it("gives cash-flow more width than time and actor columns", async () => {
    renderWallet();

    const cashFlowHeader = await screen.findByText("wallet.cashFlow");
    const timeHeader = screen.getByText("wallet.time");
    const actorHeader = screen.getByText("wallet.actor");
    const settlementHeader = screen.getByText("wallet.relatedSettlement");

    expect(cashFlowHeader).toHaveClass("w-[21%]");
    expect(timeHeader).toHaveClass("w-[12%]");
    expect(actorHeader).toHaveClass("w-[12%]");
    // Cột Liên kết đối soát chỉ còn một pill hình thức nên nhường chỗ lại cho
    // các cột chữ dài hơn.
    expect(settlementHeader).toHaveClass("w-[15%]");
    expect(
      screen.getByText("wallet.transactionCopy.TRIP_SETTLEMENT_CREDIT"),
    ).toHaveClass("whitespace-nowrap");
  });
  it("shows the PARTIAL data-completeness badge without crashing on missing metadata", async () => {
    renderWallet();

    expect(await screen.findByText("wallet.partialBadge")).toBeInTheDocument();
  });

  // Mã giao dịch là nhãn chính của tab biến động ví — nhà xe đọc mã này cho
  // CSKH, nên nó phải hiện nguyên văn và row legacy phải ra "-" chứ không phải
  // "undefined" hay một mã dựng từ UUID.
  it("hiện mã giao dịch ví và mã đối soát liên quan, legacy thiếu mã thì để '-'", async () => {
    renderWallet();

    const transactionCode = await screen.findByText("OWT-20260713-7K3M2QPX");
    expect(transactionCode).toBeInTheDocument();

    // Cột Liên kết đối soát chỉ hiện HÌNH THỨC đối soát. Hai mã STL-/TRIP- cố ý
    // không nằm ở đây: ô quá hẹp nên chúng bị bẻ giữa chuỗi, mất tác dụng tra
    // cứu — muốn đối chiếu mã thì sang tab Doanh thu hàng tuần.
    const row = transactionCode.closest("tr");
    if (!row) throw new Error("Không tìm thấy dòng giao dịch");
    expect(
      within(row).getByText("wallet.methods.AUTO_WEEKLY"),
    ).toBeInTheDocument();
    expect(
      within(row).queryByText("STL-20260713-AAAA1111"),
    ).not.toBeInTheDocument();
    expect(
      within(row).queryByText("TRIP-20260713-BBBB2222"),
    ).not.toBeInTheDocument();

    // debitTransaction cố ý không có transactionCode
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });

  it("đọc mã chuyến của settlement từ snapshot trip, không từ top-level", async () => {
    vi.mocked(getOperatorTripSettlements).mockResolvedValue(
      pagedResult([
        {
          ...onHoldSettlement,
          trip: { tripCode: "TRIP-20260810-EEEE5555", routeName: "HCM - Đà Lạt" },
        },
      ]),
    );

    renderWallet();
    fireEvent.click(
      screen.getByRole("button", { name: "wallet.tabs.settlements" }),
    );

    expect(
      await screen.findByText("TRIP-20260810-EEEE5555"),
    ).toBeInTheDocument();
    expect(screen.getByText("HCM - Đà Lạt")).toBeInTheDocument();
  });

  it("renders processingState chips for settlements and stays safe when trip is null", async () => {
    renderWallet();

    fireEvent.click(screen.getByRole("button", { name: "wallet.tabs.settlements" }));

    await waitFor(() => expect(getOperatorTripSettlements).toHaveBeenCalled());
    expect(await screen.findByText("wallet.processingState.ON_HOLD")).toBeInTheDocument();
    // trip=null (enrichment fail-soft) -> settlement vẫn hợp lệ: mã đối soát hiện
    // bình thường, mã chuyến về "-" chứ KHÔNG dựng nhãn từ tripId.
    expect(
      screen.getByText("STL-20260810-CCCC3333"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });

  // Mã enum của BE từng lọt thẳng ra màn hình ("Lý do hủy:
  // NON_POSITIVE_NET_ENTITLEMENT") — hai test dưới khoá lại đường dịch.
  it("dịch lý do huỷ đối soát thay vì in mã enum của BE", async () => {
    vi.mocked(getOperatorTripSettlements).mockResolvedValue(
      pagedResult([
        {
          ...onHoldSettlement,
          settlementId: "settlement-cancelled",
          settlementCode: "STL-20260810-DDDD4444",
          status: "CANCELLED",
          processingState: "CANCELLED",
          cancelReason: "NON_POSITIVE_NET_ENTITLEMENT",
        },
      ]),
    );

    renderWallet();
    fireEvent.click(screen.getByRole("button", { name: "wallet.tabs.settlements" }));

    // Chi tiết chỉ hiện khi bung hàng — bấm vào dòng chuyến trước
    const row = await screen.findByText("STL-20260810-DDDD4444");
    fireEvent.click(row);

    expect(
      await screen.findByText(
        /wallet\.cancelReasons\.NON_POSITIVE_NET_ENTITLEMENT/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/: NON_POSITIVE_NET_ENTITLEMENT$/),
    ).not.toBeInTheDocument();
  });

  it("dịch lý do điều chỉnh ví thay vì in mã enum của BE", async () => {
    vi.mocked(getOperatorWalletTransactions).mockResolvedValue(
      pagedResult([
        { ...creditTransaction, adjustmentReason: "MANUAL_WALLET_ADJUSTMENT" },
      ]),
    );

    renderWallet();

    expect(
      await screen.findByText("wallet.adjustmentReasons.MANUAL_WALLET_ADJUSTMENT"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("MANUAL_WALLET_ADJUSTMENT"),
    ).not.toBeInTheDocument();
  });

  it("renders the ledger tab with referenceCode instead of parsing note", async () => {
    renderWallet();

    fireEvent.click(screen.getByRole("button", { name: "wallet.tabs.ledger" }));

    await waitFor(() => expect(getOperatorLedger).toHaveBeenCalled());
    expect(await screen.findByText("BK-100")).toBeInTheDocument();
  });

  // Endpoint ledger không trả `processingState` (LedgerSettlementDto của BE chỉ
  // có 7 field), nên cột Trạng thái từng render badge theo field đó luôn trống —
  // cột đã bị bỏ hẳn. Trạng thái đối soát xem ở tab Doanh thu hàng tuần.
  it("bảng ledger không còn cột Trạng thái", async () => {
    vi.mocked(getOperatorLedger).mockResolvedValue(
      pagedResult([
        {
          ...ledgerEntry,
          settlement: {
            settlementId: "settlement-1",
            settlementCode: "STL-20260713-AAAA1111",
            tripCode: "TRIP-20260713-BBBB2222",
            status: "SETTLED",
          },
        },
      ]),
    );

    renderWallet();
    fireEvent.click(screen.getByRole("button", { name: "wallet.tabs.ledger" }));

    await waitFor(() => expect(getOperatorLedger).toHaveBeenCalled());
    const table = (await screen.findByText("BK-100")).closest("table");
    if (!table) throw new Error("Không tìm thấy bảng ledger");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(5);
    expect(
      within(table).queryByText("wallet.statusLabel"),
    ).not.toBeInTheDocument();
    expect(
      within(table).queryByText("wallet.status.SETTLED"),
    ).not.toBeInTheDocument();
    expect(
      within(table).queryByText("STL-20260713-AAAA1111"),
    ).not.toBeInTheDocument();
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
