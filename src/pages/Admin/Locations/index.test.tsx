import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdminLocation,
  deleteAdminLocation,
  getAdminLocations,
  getPublicLocations,
  updateAdminLocation,
  type AdminLocation,
} from "../../../api/vietride";
import AdminLocations from "./index";

vi.mock("react-i18next", () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${Object.values(values).join(" ")}` : key;

  return { useTranslation: () => ({ t }) };
});

vi.mock("../../../components/Pagination", () => ({
  default: ({ onPageChange }: { onPageChange: (page: number) => void }) => (
    <button type="button" data-testid="pagination" onClick={() => onPageChange(2)}>
      pagination-page-2
    </button>
  ),
}));

vi.mock("../../../api/vietride", () => ({
  createAdminLocation: vi.fn(),
  deleteAdminLocation: vi.fn(),
  getAdminLocations: vi.fn(),
  getPublicLocations: vi.fn(),
  updateAdminLocation: vi.fn(),
  LOCATION_TOP_LEVEL_TYPES: ["PROVINCE", "MUNICIPALITY"],
  LOCATION_LEAF_TYPES: ["WARD", "COMMUNE", "SPECIAL_ZONE"],
  isLeafLocationType: (type: string) =>
    ["WARD", "COMMUNE", "SPECIAL_ZONE"].includes(type),
}));

const location = {
  id: "location-1",
  code: "01",
  name: "Hà Nội",
  type: "MUNICIPALITY",
  sortOrder: 1,
  isActive: true,
  createdAt: "2026-07-01T08:00:00Z",
  updatedAt: "2026-08-01T08:00:00Z",
} satisfies AdminLocation;

// Bản ghi cấp tỉnh để kiểm tra bộ lọc cấp hành chính có thật sự loại bớt hàng.
const province = {
  id: "location-2",
  code: "02",
  name: "Lào Cai",
  type: "PROVINCE",
  sortOrder: 2,
  isActive: true,
  createdAt: "2026-07-01T08:00:00Z",
  updatedAt: "2026-08-01T08:00:00Z",
} satisfies AdminLocation;

function catalogue(items: AdminLocation[]) {
  return {
    items,
    page: 1,
    pageSize: 100,
    totalItems: items.length,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

describe("Admin Locations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminLocations).mockResolvedValue({
      items: [location],
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(createAdminLocation).mockResolvedValue(location);
    vi.mocked(getPublicLocations).mockResolvedValue([location]);
  });

  it("uses product-friendly wording and provides a dedicated detail view", async () => {
    const user = userEvent.setup();
    render(<AdminLocations />);

    expect(
      await screen.findByRole("button", { name: location.name }, { timeout: 5_000 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/locations\.types\.MUNICIPALITY/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "refresh" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "locations.viewDetails" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: location.name })).toBeInTheDocument();
    expect(within(dialog).getByText("locations.detailHint")).toBeInTheDocument();
    expect(within(dialog).getByText("locations.createdAt")).toBeInTheDocument();
    // Cấp hành chính giờ là thông tin bắt buộc của danh mục hai cấp
    expect(within(dialog).getByText(/^locations\.type$/)).toBeInTheDocument();
  });

  // "TP.TTTW" là viết tắt không tự giải thích được, nên phải có dấu "!" bấm ra
  // nghĩa đầy đủ cho người dùng không biết.
  it("giải thích viết tắt TP.TTTW qua dấu chấm than", async () => {
    const user = userEvent.setup();
    render(<AdminLocations />);

    await screen.findByRole("button", { name: location.name }, { timeout: 5_000 });

    const hint = screen.getAllByRole("button", {
      name: "locations.whatIsThis",
    })[0];
    expect(hint).toHaveAttribute("aria-expanded", "false");
    // Hover trên desktop: dùng title gốc của trình duyệt.
    expect(hint).toHaveAttribute(
      "title",
      "locations.typeFullName.MUNICIPALITY",
    );
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.click(hint);

    expect(hint).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "locations.typeFullName.MUNICIPALITY",
    );

    await user.click(hint);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  // BE đã bind `type`; bộ lọc phải gửi lên server chứ không lọc lại tập đã tải,
  // nếu không nó chỉ lọc đúng trang đang xem.
  it("gửi cấp hành chính lên BE thay vì lọc phía client", async () => {
    vi.mocked(getAdminLocations).mockResolvedValue(
      catalogue([location, province]),
    );
    const user = userEvent.setup();
    render(<AdminLocations />);

    await screen.findByRole("button", { name: location.name }, { timeout: 5_000 });

    vi.mocked(getAdminLocations).mockResolvedValue(catalogue([location]));
    await user.click(
      screen.getByRole("button", { name: /locations\.filterType/ }),
    );
    await user.click(
      screen.getByRole("option", { name: /locations\.types\.MUNICIPALITY/ }),
    );

    await waitFor(() =>
      expect(getAdminLocations).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "MUNICIPALITY", page: 1 }),
      ),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: province.name }),
      ).not.toBeInTheDocument();
    });
  });

  it("gửi search và parentCode lên BE, không tải trọn danh mục", async () => {
    const user = userEvent.setup();
    render(<AdminLocations />);

    await screen.findByRole("button", { name: location.name }, { timeout: 5_000 });

    // Mở màn chỉ được gọi đúng một request danh sách — trước đây là 34 request
    // để tải hết ~3.4k bản ghi rồi lọc ở client. Request còn lại là truy vấn đếm
    // `pageSize: 1` cho thẻ "Đang hoạt động", không kéo thêm bản ghi nào.
    const calls = vi.mocked(getAdminLocations).mock.calls.map(([params]) => params ?? {});
    const listCalls = calls.filter((params) => params.pageSize !== 1);
    expect(listCalls).toHaveLength(1);
    expect(listCalls[0]).toEqual(
      expect.objectContaining({ page: 1, pageSize: 10 }),
    );
    expect(calls.filter((params) => params.pageSize === 1)).toEqual([
      { page: 1, pageSize: 1, isActive: true },
    ]);

    await user.type(
      screen.getByPlaceholderText("locations.search"),
      "vung tau",
    );

    await waitFor(
      () =>
        expect(getAdminLocations).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: "vung tau", page: 1 }),
        ),
      { timeout: 3_000 },
    );
  });

  it("tạo phường/xã kèm cấp hành chính và tỉnh trực thuộc", async () => {
    const user = userEvent.setup();
    render(<AdminLocations />);

    await screen.findByRole("button", { name: location.name }, { timeout: 5_000 });
    await user.click(screen.getByRole("button", { name: "locations.create" }));

    const dialog = screen.getByRole("dialog");

    await user.type(
      within(dialog).getByPlaceholderText("locations.namePlaceholder"),
      "Phường Vũng Tàu",
    );

    // Chọn cấp WARD thì mới hiện ô chọn tỉnh trực thuộc
    // CustomSelect là listbox tuỳ biến: mở bằng button rồi chọn option
    await user.click(
      within(dialog).getByRole("button", { name: "locations.type" }),
    );
    await user.click(screen.getByRole("option", { name: /locations\.types\.WARD/ }));

    await user.click(
      await within(dialog).findByRole("button", { name: "locations.parent" }),
    );
    await user.type(
      screen.getByRole("combobox", {
        name: "searchOptions locations.parent",
      }),
      "ha noi",
    );
    await user.click(screen.getByRole("option", { name: /Hà Nội/ }));
    // Mã leaf đúng 5 chữ số và giữ nguyên số 0 đầu
    await user.type(within(dialog).getByPlaceholderText("26506"), "01234");

    await user.click(
      within(dialog).getByRole("button", { name: "locations.createSubmit" }),
    );

    expect(createAdminLocation).toHaveBeenCalledWith({
      code: "01234",
      name: "Phường Vũng Tàu",
      type: "WARD",
      sortOrder: 0,
      isActive: true,
      parentCode: "01",
    });
    expect(updateAdminLocation).not.toHaveBeenCalled();
    expect(deleteAdminLocation).not.toHaveBeenCalled();
  });

  it("phân trang server-side: đổi trang là gọi lại API với page mới", async () => {
    const pageOf = (start: number) =>
      Array.from({ length: 12 }, (_, index) => ({
        ...province,
        id: `location-${start + index}`,
        code: String(start + index).padStart(2, "0"),
        name: `Địa danh ${start + index}`,
      }));
    vi.mocked(getAdminLocations).mockImplementation(async (params = {}) => ({
      items: pageOf(((params.page ?? 1) - 1) * 12),
      page: params.page ?? 1,
      pageSize: 10,
      totalItems: 24,
      totalPages: 2,
      hasNextPage: (params.page ?? 1) < 2,
      hasPreviousPage: (params.page ?? 1) > 1,
    }));
    const user = userEvent.setup();
    render(<AdminLocations />);

    await screen.findByRole("button", { name: "Địa danh 0" }, { timeout: 5_000 });
    expect(
      screen.queryByRole("button", { name: "Địa danh 12" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId("pagination"));

    await waitFor(() =>
      expect(getAdminLocations).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    );
    expect(
      await screen.findByRole("button", { name: "Địa danh 12" }),
    ).toBeInTheDocument();
  });
});
