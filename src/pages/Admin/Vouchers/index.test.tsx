import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdminVoucher,
  getAdminCampaigns,
  getAdminOperators,
  getAdminVouchers,
  getAdminVoucherSummary,
} from "../../../api/vietride";
import Vouchers from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../api/vietride", () => ({
  activateAdminCampaign: vi.fn(),
  createAdminCampaign: vi.fn(),
  createAdminVoucher: vi.fn(),
  deleteAdminVoucher: vi.fn(),
  deactivateAdminCampaign: vi.fn(),
  getAdminCampaigns: vi.fn(),
  getAdminOperators: vi.fn(),
  getAdminVoucherConsents: vi.fn(),
  getAdminVouchers: vi.fn(),
  getAdminVoucherSummary: vi.fn(),
  updateAdminCampaign: vi.fn(),
  updateAdminVoucher: vi.fn(),
}));

describe("Admin Vouchers table", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminVoucherSummary).mockResolvedValue({
      total: 1,
      active: 1,
      booking: 1,
      parcel: 0,
      expiringIn7Days: 0,
    });
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

  // Trước đây bảng cố ép 7 cột vừa khung ở mọi bề rộng (không min-w, wrapper
  // overflow-hidden). Ở 390px cách đó làm 5/8 ô bị cắt cụt — `table-fixed` co
  // cột theo phần trăm tới khi chữ đè lên nhau, mà wrapper lại không cho cuộn
  // nên không có cách nào đọc phần bị khuất. Nay giữ nguyên "một dòng mỗi ô"
  // (truncate + nowrap) nhưng cho bảng có bề rộng tối thiểu và cuộn ngang khi
  // khung hẹp hơn. Ở desktop bảng vẫn vừa khung nên không sinh thanh cuộn.
  it("keeps voucher data on one line and lets a narrow viewport scroll the table", async () => {
    render(<Vouchers />);

    const voucherName = await screen.findByText("Gói Premium - Giảm 100K");
    const table = voucherName.closest("table");
    const container = table?.parentElement;

    expect(table).not.toBeNull();
    expect(table).toHaveClass("table-fixed");
    expect(table).toHaveClass("min-w-[1000px]");
    expect(container).toHaveClass("overflow-x-auto");
    expect(container).not.toHaveClass("overflow-hidden");
    // Vùng cuộn phải focus được, nếu không người dùng bàn phím không cuộn tới
    // được cột cuối (axe: scrollable-region-focusable).
    expect(container).toHaveAttribute("tabindex", "0");
    expect(voucherName).toHaveClass("truncate");
    expect(voucherName.closest("td")).toHaveClass("whitespace-nowrap");
  });

  // Trước đây nhánh rỗng thay thế cả bảng, mà thanh tìm kiếm nằm trong bảng —
  // tìm không ra kết quả là ô tìm kiếm biến mất, người dùng hết đường sửa từ
  // khoá (phải tải lại trang). Ô tìm kiếm cũng chớp tắt mỗi lượt tải lại.
  it("giữ thanh tìm kiếm khi danh sách rỗng và khi đang tải", async () => {
    vi.mocked(getAdminVouchers).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    render(<Vouchers />);

    // Ngay lúc đang tải, ô tìm kiếm đã phải có mặt
    expect(
      screen.getByPlaceholderText("vouchers.searchPlaceholder"),
    ).toBeInTheDocument();

    // Và vẫn còn đó sau khi BE trả về danh sách rỗng, cạnh thông báo rỗng
    expect(await screen.findByText("vouchers.emptyHint")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("vouchers.searchPlaceholder"),
    ).toBeInTheDocument();
  });

  it("shows one VND discount field for fixed vouchers and mirrors both BE fields", async () => {
    const user = userEvent.setup();
    vi.mocked(createAdminVoucher).mockResolvedValue({
      id: "voucher-fixed",
      code: "FIXED75",
      name: "Fixed discount",
      type: "FIXED_AMOUNT",
      value: 75_000,
      maxDiscountAmount: 75_000,
    });

    render(<Vouchers />);
    await screen.findByText("Gói Premium - Giảm 100K");
    await user.click(screen.getByRole("button", { name: "vouchers.create" }));
    await user.click(
      screen.getByRole("button", { name: "vouchers.percentDiscount" }),
    );
    await user.click(
      screen.getByRole("option", { name: "vouchers.fixedDiscount" }),
    );

    expect(screen.queryByText("vouchers.maxDiscountAmount")).not.toBeInTheDocument();
    const fixedDiscountLabel = screen.getByText("vouchers.fixedDiscountValue");
    const fixedDiscountInput = fixedDiscountLabel.parentElement?.querySelector("input");
    expect(fixedDiscountInput).not.toBeNull();
    await user.clear(fixedDiscountInput as HTMLInputElement);
    await user.type(fixedDiscountInput as HTMLInputElement, "75000");

    const minimumOrderField = screen.getByText("vouchers.minOrder").parentElement;
    const perAccountField = screen.getByText("vouchers.maxUsagePerUser").parentElement;
    expect(minimumOrderField?.parentElement).toBe(perAccountField?.parentElement);

    await user.click(screen.getByRole("button", { name: "vouchers.saveButton" }));

    await waitFor(() => {
      expect(createAdminVoucher).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "FIXED_AMOUNT",
          value: 75_000,
          maxDiscountAmount: 75_000,
        }),
      );
    });
  });
});
