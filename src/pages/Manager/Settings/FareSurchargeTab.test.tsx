import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createOperatorFareSurchargePeriod,
  getOperatorFareSurchargePeriods,
  getOperatorFareSurchargeSettings,
  updateOperatorFareSurchargeSettings,
  type FareSurchargePeriod,
} from "../../../api/vietride";
import FareSurchargeTab from "./FareSurchargeTab";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("../../../components/toast/useToast", () => ({
  useToast: () => ({ error: toastError, success: toastSuccess }),
}));

vi.mock("../../../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

vi.mock("../../../api/vietride", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../../api/vietride")>();
  return {
    ...original,
    getOperatorFareSurchargeSettings: vi.fn(),
    getOperatorFareSurchargePeriods: vi.fn(),
    createOperatorFareSurchargePeriod: vi.fn(),
    updateOperatorFareSurchargePeriod: vi.fn(),
    deleteOperatorFareSurchargePeriod: vi.fn(),
    updateOperatorFareSurchargeSettings: vi.fn(),
  };
});

const settingsMock = vi.mocked(getOperatorFareSurchargeSettings);
const periodsMock = vi.mocked(getOperatorFareSurchargePeriods);
const createMock = vi.mocked(createOperatorFareSurchargePeriod);
const saveSettingsMock = vi.mocked(updateOperatorFareSurchargeSettings);
function period(overrides: Partial<FareSurchargePeriod> = {}): FareSurchargePeriod {
  return {
    periodId: "period-1",
    name: "Tết",
    startDate: "2026-12-01",
    endDate: "2026-12-31",
    surchargePercent: 13,
    isActive: true,
    status: "UPCOMING",
    createdAt: "2026-08-01T00:00:00+07:00",
    updatedAt: "2026-08-01T00:00:00+07:00",
    ...overrides,
  };
}

function mockLoad(items: FareSurchargePeriod[] = [period()]) {
  settingsMock.mockResolvedValue({ isEnabled: true });
  periodsMock.mockResolvedValue({
    items,
    page: 1,
    pageSize: 20,
    totalItems: items.length,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLoad();
});

describe("FareSurchargeTab", () => {
  it("chỉ còn phần phụ thu — không hiện chính sách đặt vé/gửi hàng vì BE không có", async () => {
    render(<FareSurchargeTab />);

    expect(await screen.findByText("settings.holidaySurcharge")).toBeTruthy();
    expect(screen.queryByText("settings.bookingPolicy")).toBeNull();
    expect(screen.queryByText("settings.parcelPolicy")).toBeNull();
    // "% phụ thu mặc định" không tồn tại trong DTO settings của BE
    expect(screen.queryByText("settings.defaultSurcharge")).toBeNull();
  });

  it("cột trạng thái đọc `status` của BE chứ không suy từ cờ bật/tắt", async () => {
    // Dịp đang bật nhưng chưa tới ngày → UPCOMING, không phải "đang áp dụng"
    render(<FareSurchargeTab />);

    expect(
      await screen.findByText("settings.periodStatuses.UPCOMING"),
    ).toBeTruthy();
    expect(screen.queryByText("settings.periodStatuses.APPLYING")).toBeNull();
  });

  it("hiện đúng trạng thái hết hạn cho dịp đã qua", async () => {
    mockLoad([period({ status: "EXPIRED" })]);
    render(<FareSurchargeTab />);

    expect(
      await screen.findByText("settings.periodStatuses.EXPIRED"),
    ).toBeTruthy();
  });

  it("chặn phụ thu là số thập phân trước khi gọi BE", async () => {
    const user = userEvent.setup();
    render(<FareSurchargeTab />);

    await user.click(await screen.findByRole("button", { name: /addPeriod/ }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByRole("textbox"), "Lễ 2/9");
    const percent = within(dialog).getByRole("spinbutton");
    await user.clear(percent);
    await user.type(percent, "12.5");
    await user.click(within(dialog).getByRole("button", { name: /add$/ }));

    expect(createMock).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("settings.periodInvalid");
  });

  it("lưu cấu hình gửi đúng cờ isEnabled của BE", async () => {
    const user = userEvent.setup();
    saveSettingsMock.mockResolvedValue({ isEnabled: false });
    render(<FareSurchargeTab />);

    await screen.findByText("settings.holidaySurcharge");
    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByRole("button", { name: "settings.saveConfig" }));

    await waitFor(() => {
      expect(saveSettingsMock).toHaveBeenCalledWith({ isEnabled: false });
    });
  });
});
