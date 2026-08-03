import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAdminCampaigns,
  getAdminOperators,
  getAdminVouchers,
} from "../../api/vietride";
import Vouchers from "./Vouchers";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../api/vietride", () => ({
  activateAdminCampaign: vi.fn(),
  createAdminCampaign: vi.fn(),
  createAdminVoucher: vi.fn(),
  deleteAdminVoucher: vi.fn(),
  deactivateAdminCampaign: vi.fn(),
  getAdminCampaigns: vi.fn(),
  getAdminOperators: vi.fn(),
  getAdminVoucherConsents: vi.fn(),
  getAdminVouchers: vi.fn(),
  updateAdminCampaign: vi.fn(),
  updateAdminVoucher: vi.fn(),
}));

describe("Admin Vouchers table", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminVouchers).mockResolvedValue({
      items: [
        {
          id: "voucher-1",
          code: "PREMIUM100K",
          name: "Gói Premium - Giảm 100K",
          description: "Ưu đãi dành cho khách hàng Premium",
          type: "FIXED_AMOUNT",
          value: 100_000,
          applicableServices: ["BOOKING"],
          fundingType: "VIETRIDE_FUNDED",
          totalUsageLimit: 1_000,
          usedCount: 0,
          validUntil: "2026-08-07",
          isActive: true,
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(getAdminOperators).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(getAdminCampaigns).mockResolvedValue([]);
  });

  it("keeps voucher data on one line without a horizontal table scroller", async () => {
    render(<Vouchers />);

    const voucherName = await screen.findByText("Gói Premium - Giảm 100K");
    const table = voucherName.closest("table");
    const container = table?.parentElement;

    expect(table).not.toBeNull();
    expect(table).toHaveClass("table-fixed");
    expect(table).not.toHaveClass("min-w-[980px]");
    expect(container).toHaveClass("overflow-hidden");
    expect(container).not.toHaveClass("overflow-x-auto");
    expect(voucherName).toHaveClass("truncate");
    expect(voucherName.closest("td")).toHaveClass("whitespace-nowrap");
  });
});
