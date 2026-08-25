// Màn Cấu hình giờ là vỏ tab — nội dung từng tab được test ở file riêng.
// Ở đây chỉ kiểm hai thứ vỏ phải làm đúng: đổi tab, và gate tab bồi thường
// hàng hoá theo module gói dịch vụ.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ManagerSettings from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const subscription = vi.hoisted(() => ({ hasModule: vi.fn(() => true) }));
vi.mock("../../../contexts/operatorSubscriptionContext", () => ({
  useOperatorSubscription: () => subscription,
}));

vi.mock("./FareSurchargeTab", () => ({
  default: () => <div>fare-surcharge-tab</div>,
}));
vi.mock("./CancellationPolicyTab", () => ({
  default: () => <div>cancellation-tab</div>,
}));
vi.mock("./ParcelCompensationTab", () => ({
  default: () => <div>parcel-compensation-tab</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  subscription.hasModule.mockReturnValue(true);
});

describe("ManagerSettings", () => {
  it("mở ở tab phụ thu và chỉ render tab đang chọn", () => {
    render(<ManagerSettings />);

    expect(screen.getByText("fare-surcharge-tab")).toBeTruthy();
    expect(screen.queryByText("cancellation-tab")).toBeNull();
  });

  it("đổi sang tab hoàn vé khi bấm", async () => {
    const user = userEvent.setup();
    render(<ManagerSettings />);

    await user.click(screen.getByTestId("manager-settings-tab-cancellation"));

    expect(screen.getByText("cancellation-tab")).toBeTruthy();
    expect(screen.queryByText("fare-surcharge-tab")).toBeNull();
  });

  it("ẩn tab bồi thường hàng hoá khi gói dịch vụ không có module Parcel", () => {
    subscription.hasModule.mockReturnValue(false);
    render(<ManagerSettings />);

    expect(
      screen.queryByTestId("manager-settings-tab-parcelCompensation"),
    ).toBeNull();
  });

  it("hiện tab bồi thường hàng hoá khi gói dịch vụ có module Parcel", async () => {
    const user = userEvent.setup();
    render(<ManagerSettings />);

    await user.click(
      screen.getByTestId("manager-settings-tab-parcelCompensation"),
    );

    expect(screen.getByText("parcel-compensation-tab")).toBeTruthy();
    expect(subscription.hasModule).toHaveBeenCalledWith("enableParcel");
  });
});
