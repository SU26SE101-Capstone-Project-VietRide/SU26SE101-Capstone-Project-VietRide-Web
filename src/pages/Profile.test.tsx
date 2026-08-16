// Test cho Profile.tsx — trang trước đây chưa có test nào. Tập trung vào các
// fix vừa làm: (1) Cancel không còn báo nhầm toast "đã lưu", có confirm khi có
// thay đổi chưa lưu; (2) tên hiển thị header là displayName thật của người
// đăng nhập (trước đây SYSTEM_ADMIN bị hiện một chuỗi tĩnh); (3) header tách
// khỏi thông tin nhà xe, có badge vai trò/trạng thái; (4) lỗi tải có retry.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ToastProvider from "../components/toast/ToastProvider";
import type { OperatorProfile } from "../api/vietride";
import Profile from "./Profile";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const authMock = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  getAuthSession: vi.fn(() => ({ user: { id: "user-1" } })),
  saveAuthSession: vi.fn(),
  getHomePathForRole: vi.fn((role: string) =>
    role === "SYSTEM_ADMIN" ? "/admin/dashboard" : "/manager/dashboard",
  ),
}));

vi.mock("../auth", () => authMock);

vi.mock("../api/vietride", () => ({
  getOperatorProfile: vi.fn(),
  updateMyAvatar: vi.fn(),
  updateOperatorProfile: vi.fn(),
}));

vi.mock("../utils/firebaseImageUpload", () => ({
  FirebaseImageError: class FirebaseImageError extends Error {},
  uploadFirebaseImages: vi.fn(),
}));

import {
  getOperatorProfile,
  updateOperatorProfile,
} from "../api/vietride";

function renderProfile() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Profile />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const baseOperator: OperatorProfile = {
  operatorId: "op-1",
  name: "Nhà xe Phương Trang",
  businessRegistrationNumber: "BRN-123",
  taxCode: "TAX-999",
  contactEmail: "contact@phuongtrang.test",
  contactPhone: "0900000000",
  logoUrl: null,
  address: {
    street: "123 Đường A",
    ward: "Phường 1",
    province: "TP.HCM",
  },
  representativeName: "Nguyễn Văn A",
  representativePhone: "0911111111",
  registrationStatus: "APPROVED",
  isActive: true,
  cancellationPolicy: null,
  parcelNoShowPolicy: null,
  luggagePolicy: null,
};

const operatorAdminUser = {
  id: "user-1",
  email: "admin@phuongtrang.test",
  displayName: "Trần Thị B",
  phone: "0922222222",
  role: "OPERATOR_ADMIN" as const,
  operatorId: "op-1",
};

describe("Profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOperatorProfile).mockReset();
    vi.mocked(updateOperatorProfile).mockReset();
    authMock.getAuthUser.mockReturnValue(operatorAdminUser);
    authMock.getAuthSession.mockReturnValue({ user: { id: "user-1" } });
  });

  it("shows the logged-in person's real name in the header, separate from the operator's company name", async () => {
    vi.mocked(getOperatorProfile).mockResolvedValue(baseOperator);
    renderProfile();

    expect(await screen.findByText("Nhà xe Phương Trang")).toBeInTheDocument();
    expect(screen.getByText("Trần Thị B")).toBeInTheDocument();
    expect(screen.getByText("profilePage.operatorAdminRole")).toBeInTheDocument();
    expect(screen.getByText("profilePage.statusActive")).toBeInTheDocument();
  });

  it("shows an inline error with a retry button when loading the operator profile fails", async () => {
    vi.mocked(getOperatorProfile).mockRejectedValueOnce(new Error("network down"));
    renderProfile();

    expect(await screen.findByText("network down")).toBeInTheDocument();
    expect(getOperatorProfile).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Nhà xe Phương Trang")).not.toBeInTheDocument();

    vi.mocked(getOperatorProfile).mockResolvedValueOnce(baseOperator);
    fireEvent.click(screen.getByText("profilePage.retry"));

    expect(await screen.findByText("Nhà xe Phương Trang")).toBeInTheDocument();
    expect(getOperatorProfile).toHaveBeenCalledTimes(2);
  });

  it("exits edit mode immediately on cancel when nothing changed (no confirm dialog)", async () => {
    vi.mocked(getOperatorProfile).mockResolvedValue(baseOperator);
    renderProfile();
    await screen.findByText("Nhà xe Phương Trang");

    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));

    expect(
      screen.queryByText("profilePage.discardChangesTitle"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "edit" })).toBeInTheDocument();
  });

  it("asks for confirmation on cancel when there are unsaved changes, discards without the misleading 'saved' toast", async () => {
    vi.mocked(getOperatorProfile).mockResolvedValue(baseOperator);
    renderProfile();
    await screen.findByText("Nhà xe Phương Trang");

    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    const nameInput = screen.getByDisplayValue("Nhà xe Phương Trang");
    fireEvent.change(nameInput, { target: { value: "Tên mới chưa lưu" } });

    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(
      screen.getByText("profilePage.discardChangesTitle"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("profilePage.discardChangesConfirm"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "edit" })).toBeInTheDocument();
    });
    // Bug cũ: Cancel hiện toast "profilePage.profileUpdated" y như Save.
    // Không được gọi API update khi chỉ huỷ, và giá trị gốc phải còn nguyên.
    expect(updateOperatorProfile).not.toHaveBeenCalled();
    expect(
      screen.queryByText("profilePage.profileUpdated"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Nhà xe Phương Trang")).toBeInTheDocument();
  });

  it("saves changes and shows the success toast", async () => {
    vi.mocked(getOperatorProfile).mockResolvedValue(baseOperator);
    const updated: OperatorProfile = { ...baseOperator, name: "Tên đã lưu" };
    vi.mocked(updateOperatorProfile).mockResolvedValue(updated);
    renderProfile();
    await screen.findByText("Nhà xe Phương Trang");

    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.change(screen.getByDisplayValue("Nhà xe Phương Trang"), {
      target: { value: "Tên đã lưu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => {
      expect(updateOperatorProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Tên đã lưu",
          cancellationPolicy: null,
        }),
      );
    });
    expect(await screen.findByText("Tên đã lưu")).toBeInTheDocument();
    expect(
      await screen.findByText("profilePage.profileUpdated"),
    ).toBeInTheDocument();
  });

  it("shows the real display name for SYSTEM_ADMIN instead of a generic placeholder", async () => {
    authMock.getAuthUser.mockReturnValue({
      id: "admin-1",
      email: "root@vietride.online",
      displayName: "Nguyễn Văn Quản Trị",
      phone: "0933333333",
      role: "SYSTEM_ADMIN",
    });
    renderProfile();

    expect(await screen.findByText("Nguyễn Văn Quản Trị")).toBeInTheDocument();
    expect(screen.getByText("profilePage.systemRole")).toBeInTheDocument();
  });

  it("shows the empty refund policy copy when the operator has no cancellation tiers", async () => {
    vi.mocked(getOperatorProfile).mockResolvedValue(baseOperator);
    renderProfile();

    expect(await screen.findByText("profilePage.cancellationPolicy")).toBeInTheDocument();
    expect(
      screen.getByText("profilePage.cancellationPolicyEmpty"),
    ).toBeInTheDocument();
  });

  it("saves a new cancellation tier on PATCH /v1/operator/profile", async () => {
    vi.mocked(getOperatorProfile).mockResolvedValue(baseOperator);
    vi.mocked(updateOperatorProfile).mockResolvedValue({
      ...baseOperator,
      cancellationPolicy: [{ hoursBeforeDeparture: 24, feePercent: 10 }],
    });
    renderProfile();
    await screen.findByText("Nhà xe Phương Trang");

    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.click(
      screen.getByRole("button", { name: "profilePage.cancellationAddTier" }),
    );
    fireEvent.change(screen.getByLabelText("profilePage.cancellationHours 1"), {
      target: { value: "24" },
    });
    fireEvent.change(screen.getByLabelText("profilePage.cancellationFee 1"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => {
      expect(updateOperatorProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          cancellationPolicy: [{ hoursBeforeDeparture: 24, feePercent: 10 }],
        }),
      );
    });
  });

  it("shows remaining-time windows instead of raw API rows", async () => {
    vi.mocked(getOperatorProfile).mockResolvedValue({
      ...baseOperator,
      cancellationPolicy: [
        { hoursBeforeDeparture: 24, feePercent: 10 },
        { hoursBeforeDeparture: 2, feePercent: 50 },
      ],
    });
    renderProfile();

    expect(await screen.findByText("profilePage.cancellationWindowWithin")).toBeInTheDocument();
    expect(screen.getByText("profilePage.cancellationWindowBetween")).toBeInTheDocument();
    expect(screen.getByText("profilePage.cancellationWindowAfter")).toBeInTheDocument();
  });

  it("fills the common 3-tier sample and saves it", async () => {
    vi.mocked(getOperatorProfile).mockResolvedValue(baseOperator);
    vi.mocked(updateOperatorProfile).mockResolvedValue({
      ...baseOperator,
      cancellationPolicy: [
        { hoursBeforeDeparture: 1, feePercent: 100 },
        { hoursBeforeDeparture: 2, feePercent: 50 },
        { hoursBeforeDeparture: 24, feePercent: 10 },
      ],
    });
    renderProfile();
    await screen.findByText("Nhà xe Phương Trang");

    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.click(
      screen.getByRole("button", { name: "profilePage.cancellationUseTemplate" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => {
      expect(updateOperatorProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          cancellationPolicy: [
            { hoursBeforeDeparture: 1, feePercent: 100 },
            { hoursBeforeDeparture: 2, feePercent: 50 },
            { hoursBeforeDeparture: 24, feePercent: 10 },
          ],
        }),
      );
    });
  });

  it("does not call the profile API when a cancellation fee is out of range", async () => {
    vi.mocked(getOperatorProfile).mockResolvedValue(baseOperator);
    renderProfile();
    await screen.findByText("Nhà xe Phương Trang");

    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.click(
      screen.getByRole("button", { name: "profilePage.cancellationAddTier" }),
    );
    fireEvent.change(screen.getByLabelText("profilePage.cancellationHours 1"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("profilePage.cancellationFee 1"), {
      target: { value: "150" },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    expect(updateOperatorProfile).not.toHaveBeenCalled();
    expect(
      await screen.findByText("profilePage.cancellationErrors.out-of-range"),
    ).toBeInTheDocument();
  });
});
