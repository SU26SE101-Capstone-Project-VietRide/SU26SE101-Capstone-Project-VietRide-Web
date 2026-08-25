import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getOperatorProfile,
  updateOperatorProfile,
  type OperatorProfile,
} from "../../../api/vietride";
import CancellationPolicyTab from "./CancellationPolicyTab";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("../../../components/toast/useToast", () => ({
  useToast: () => ({ error: toastError, success: toastSuccess }),
}));

vi.mock("../../../api/vietride", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../../api/vietride")>();
  return {
    ...original,
    getOperatorProfile: vi.fn(),
    updateOperatorProfile: vi.fn(),
  };
});

const profileMock = vi.mocked(getOperatorProfile);
const saveProfileMock = vi.mocked(updateOperatorProfile);

const baseOperator: OperatorProfile = {
  operatorId: "op-1",
  name: "Nhà xe Phương Trang",
  businessRegistrationNumber: "BRN-123",
  taxCode: "TAX-999",
  contactEmail: "contact@phuongtrang.test",
  contactPhone: "0900000000",
  logoUrl: null,
  address: { street: "123 Đường A", ward: "Phường 1", province: "TP.HCM" },
  representativeName: "Nguyễn Văn A",
  representativePhone: "0911111111",
  registrationStatus: "APPROVED",
  isActive: true,
  cancellationPolicy: null,
  parcelNoShowPolicy: null,
  luggagePolicy: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  profileMock.mockResolvedValue(baseOperator);
});

/**
 * Nút thêm bậc bị `disabled` trong lúc tải hồ sơ, mà `findByRole` khớp ngay từ
 * lần render đầu — chờ tiêu đề thật mới chắc tab đã tải xong.
 */
async function renderLoadedTab() {
  render(<CancellationPolicyTab />);
  await screen.findByText("settings.cancellation.title");
}

describe("CancellationPolicyTab", () => {
  it("cấu hình hoàn vé nằm ở màn Cấu hình, không còn ở Hồ sơ", async () => {
    render(<CancellationPolicyTab />);

    expect(
      await screen.findByText("settings.cancellation.title"),
    ).toBeTruthy();
    expect(screen.getByText("settings.cancellation.empty")).toBeTruthy();
  });

  it("lưu bậc hoàn vé qua PATCH hồ sơ, giữ nguyên các trường khác", async () => {
    const user = userEvent.setup();
    saveProfileMock.mockResolvedValue({
      ...baseOperator,
      cancellationPolicy: [{ hoursBeforeDeparture: 24, feePercent: 10 }],
    });
    await renderLoadedTab();

    await user.click(
      screen.getByRole("button", {
        name: "settings.cancellation.addTier",
      }),
    );
    await user.type(
      screen.getByLabelText("settings.cancellation.hours 1"),
      "24",
    );
    await user.type(screen.getByLabelText("settings.cancellation.fee 1"), "10");
    await user.click(
      screen.getByRole("button", { name: "settings.cancellation.save" }),
    );

    await waitFor(() => {
      expect(saveProfileMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: baseOperator.name,
          representativePhone: baseOperator.representativePhone,
          cancellationPolicy: [{ hoursBeforeDeparture: 24, feePercent: 10 }],
        }),
      );
    });
  });

  it("không gọi BE khi phí hoàn vé vượt 100%", async () => {
    const user = userEvent.setup();
    await renderLoadedTab();

    await user.click(
      screen.getByRole("button", {
        name: "settings.cancellation.addTier",
      }),
    );
    await user.type(screen.getByLabelText("settings.cancellation.hours 1"), "2");
    await user.type(
      screen.getByLabelText("settings.cancellation.fee 1"),
      "150",
    );
    await user.click(
      screen.getByRole("button", { name: "settings.cancellation.save" }),
    );

    expect(saveProfileMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText("settings.cancellation.errors.out-of-range"),
    ).toBeTruthy();
  });
});
