import { render, screen, within } from "@testing-library/react";
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

describe("Admin Locations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminLocations).mockResolvedValue({
      items: [location],
      page: 1,
      pageSize: 12,
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

  it("keeps pagination visible while only the table body is loading", async () => {
    const user = userEvent.setup();
    vi.mocked(getAdminLocations)
      .mockResolvedValueOnce({
        items: [location],
        page: 1,
        pageSize: 12,
        totalItems: 24,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
      })
      .mockImplementationOnce(() => new Promise<never>(() => undefined));

    render(<AdminLocations />);
    await screen.findByRole("button", { name: location.name }, { timeout: 5_000 });

    await user.click(screen.getByTestId("pagination"));

    expect(screen.getByTestId("pagination")).toBeInTheDocument();
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: location.name })).not.toBeInTheDocument();
    expect(screen.getByRole("table").parentElement).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});
