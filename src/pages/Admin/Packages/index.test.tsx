import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveAdminCustomPlanRequest,
  createAdminSubscriptionPlan,
  getAdminCustomPlanRequests,
  getAdminSubscriptionPlans,
  rejectAdminCustomPlanRequest,
  updateAdminSubscriptionPlan,
  type AdminCustomPlanRequest,
  type SubscriptionPlan,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import Packages from "./index";
import { useToastFeedback } from "../../../hooks/useToastFeedback";

vi.mock("../../../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

// Mock dịch trả về key, nối thêm các giá trị nội suy để test đọc được nội dung
// thật (số hạn mức, tên nhà xe) chứ không chỉ có key.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options
        ? `${key} ${Object.values(options).join(" ")}`.trim()
        : key,
  }),
}));

vi.mock("../../../api/vietride", () => ({
  createAdminSubscriptionPlan: vi.fn(),
  getAdminSubscriptionPlans: vi.fn(),
  updateAdminSubscriptionPlan: vi.fn(),
  getAdminCustomPlanRequests: vi.fn(),
  approveAdminCustomPlanRequest: vi.fn(),
  rejectAdminCustomPlanRequest: vi.fn(),
}));

const plan = {
  planId: "plan-pro",
  name: "Professional",
  description: "For growing operators",
  pricePerMonth: 300_000,
  pricePerYear: 3_000_000,
  limits: {
    maxVehicles: 20,
    maxDrivers: 30,
    maxAssistants: 20,
    maxOperatorUsers: 10,
    maxRoutes: 10,
    maxTripsPerMonth: 500,
  },
  modules: {
    enableParcel: true,
    enableShuttle: false,
    enableRag: true,
  },
  isActive: true,
} satisfies SubscriptionPlan;

const pendingRequest: AdminCustomPlanRequest = {
  requestId: "request-1",
  operatorId: "e17f537d-ba9a-4e11-854a-e40480c81f12",
  operatorName: "Nhà xe Phương Trang",
  status: "PENDING_REVIEW",
  preferredBillingPeriod: "MONTHLY",
  note: "Cần gói riêng cho vận hành nhiều tuyến",
  requestedLimits: {
    maxVehicles: 30,
    maxDrivers: 40,
    maxAssistants: 10,
    maxOperatorUsers: 8,
    maxRoutes: 50,
    maxTripsPerMonth: 5000,
  },
  requestedModules: {
    enableParcel: true,
    enableShuttle: true,
    enableRag: true,
  },
  createdAt: "2026-08-21T09:12:00Z",
};

describe("Admin Service Packages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminCustomPlanRequests).mockResolvedValue([]);
    vi.mocked(getAdminSubscriptionPlans).mockResolvedValue([]);
  });

  it("shows a full-page skeleton during the first request", async () => {
    render(<Packages />);

    expect(screen.getByTestId("packages-page-skeleton")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "packages.create" })).toBeInTheDocument();
    expect(screen.queryByTestId("packages-page-skeleton")).not.toBeInTheDocument();
  });

  it("shows business labels instead of backend module flag names", async () => {
    vi.mocked(getAdminSubscriptionPlans).mockResolvedValue([plan]);
    render(<Packages />);

    expect(await screen.findByText("packages.parcelModule")).toBeInTheDocument();
    expect(screen.getByText("packages.shuttleModule")).toBeInTheDocument();
    expect(screen.getByText("packages.ragModule")).toBeInTheDocument();
    expect(screen.queryByText("enableParcel")).not.toBeInTheDocument();
    expect(screen.queryByText("enableShuttle")).not.toBeInTheDocument();
    expect(screen.queryByText("enableRag")).not.toBeInTheDocument();
  });

  it("shows all six resource limits in the redesigned admin plan card", async () => {
    vi.mocked(getAdminSubscriptionPlans).mockResolvedValue([plan]);
    render(<Packages />);

    const card = await screen.findByTestId(`admin-plan-card-${plan.planId}`);
    expect(within(card).getAllByTestId(/^admin-plan-limit-/)).toHaveLength(6);

    [
      "packages.limitLabels.maxVehicles",
      "packages.limitLabels.maxRoutes",
      "packages.limitLabels.maxDrivers",
      "packages.limitLabels.maxAssistants",
      "packages.limitLabels.maxOperatorUsers",
      "packages.limitLabels.maxTripsPerMonth",
    ].forEach((label) => {
      expect(within(card).getByText(label)).toBeInTheDocument();
    });
  });

  it("keeps the disable and edit actions working in the redesigned card", async () => {
    const interaction = userEvent.setup();
    vi.mocked(getAdminSubscriptionPlans).mockResolvedValue([plan]);
    render(<Packages />);

    const card = await screen.findByTestId(`admin-plan-card-${plan.planId}`);
    await interaction.click(within(card).getByRole("button", { name: "disable" }));

    expect(updateAdminSubscriptionPlan).toHaveBeenCalledWith(
      plan.planId,
      expect.objectContaining({ isActive: false }),
    );

    await interaction.click(within(card).getByRole("button", { name: "edit" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("explains each module and keeps local validation inside the create modal", async () => {
    const interaction = userEvent.setup();
    render(<Packages />);

    await interaction.click(await screen.findByRole("button", { name: "packages.create" }));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByText("packages.parcelModuleHint")).toBeInTheDocument();
    expect(within(dialog).getByText("packages.shuttleModuleHint")).toBeInTheDocument();
    expect(within(dialog).getByText("packages.ragModuleHint")).toBeInTheDocument();

    await interaction.click(within(dialog).getByRole("button", { name: /^packages\.savePackage/ }));
    expect(useToastFeedback).toHaveBeenLastCalledWith({ message: "", error: "packages.nameRequired" });
    expect(createAdminSubscriptionPlan).not.toHaveBeenCalled();
  });

  it("surfaces the API's real error message when save fails", async () => {
    const interaction = userEvent.setup();
    vi.mocked(createAdminSubscriptionPlan).mockRejectedValue(
      new Error("One or more validation errors occurred."),
    );
    render(<Packages />);

    await interaction.click(await screen.findByRole("button", { name: "packages.create" }));
    const dialog = screen.getByRole("dialog");
    const nameInput = dialog.querySelector<HTMLInputElement>("input:not([type])");
    const limitInputs = dialog.querySelectorAll<HTMLInputElement>('input[type="number"]');

    expect(nameInput).not.toBeNull();
    fireEvent.change(nameInput!, { target: { value: "Business" } });
    limitInputs.forEach((input) => fireEvent.change(input, { target: { value: "1" } }));

    await interaction.click(within(dialog).getByRole("button", { name: /^packages\.savePackage/ }));
    expect(useToastFeedback).toHaveBeenLastCalledWith({
      message: "",
      error: "One or more validation errors occurred.",
    });
  });

  it("falls back to a generic message when save fails without an Error instance", async () => {
    const interaction = userEvent.setup();
    vi.mocked(createAdminSubscriptionPlan).mockRejectedValue("network down");
    render(<Packages />);

    await interaction.click(await screen.findByRole("button", { name: "packages.create" }));
    const dialog = screen.getByRole("dialog");
    const nameInput = dialog.querySelector<HTMLInputElement>("input:not([type])");
    const limitInputs = dialog.querySelectorAll<HTMLInputElement>('input[type="number"]');

    expect(nameInput).not.toBeNull();
    fireEvent.change(nameInput!, { target: { value: "Business" } });
    limitInputs.forEach((input) => fireEvent.change(input, { target: { value: "1" } }));

    await interaction.click(within(dialog).getByRole("button", { name: /^packages\.savePackage/ }));
    expect(useToastFeedback).toHaveBeenLastCalledWith({ message: "", error: "packages.saveFailed" });
  });
  it("shows the pending count on the requests tab and lists the queue", async () => {
    const interaction = userEvent.setup();
    vi.mocked(getAdminCustomPlanRequests).mockResolvedValue([pendingRequest]);
    render(<Packages />);

    // Badge đếm phải hiện ngay khi vào màn, chưa cần mở tab
    expect(await screen.findByTestId("pending-requests-count")).toHaveTextContent(
      "1",
    );

    await interaction.click(screen.getByTestId("admin-packages-tab-requests"));

    expect(
      await screen.findByTestId("custom-request-row-request-1"),
    ).toHaveTextContent("Nhà xe Phương Trang");
  });

  it("shows row actions as icon buttons instead of text buttons", async () => {
    const interaction = userEvent.setup();
    vi.mocked(getAdminCustomPlanRequests).mockResolvedValue([pendingRequest]);
    render(<Packages />);

    await interaction.click(
      await screen.findByTestId("admin-packages-tab-requests"),
    );
    await screen.findByTestId("custom-request-row-request-1");

    // Đồng bộ với các bảng Admin khác: thao tác là nút icon, nhãn nằm ở
    // title/aria-label chứ không phải chữ trong nút.
    for (const label of [
      "customPlans.viewAction",
      "customPlans.approveAction",
      "customPlans.rejectAction",
    ]) {
      const button = screen.getByRole("button", { name: label });
      expect(button).toHaveAttribute("title", label);
      expect(button).not.toHaveTextContent(label);
    }
  });

  it("filters the queue by status and says so when the filter empties it", async () => {
    const interaction = userEvent.setup();
    vi.mocked(getAdminCustomPlanRequests).mockResolvedValue([pendingRequest]);
    render(<Packages />);

    await interaction.click(
      await screen.findByTestId("admin-packages-tab-requests"),
    );
    await screen.findByTestId("custom-request-row-request-1");

    // CustomSelect là listbox tuỳ biến: mở bằng button rồi chọn option
    await interaction.click(
      screen.getByRole("button", { name: "customPlans.filterStatus" }),
    );
    await interaction.click(
      screen.getByRole("option", { name: "customPlans.status.REJECTED" }),
    );

    expect(
      screen.queryByTestId("custom-request-row-request-1"),
    ).not.toBeInTheDocument();
    // Rỗng vì lọc, không phải vì chưa ai gửi yêu cầu
    expect(screen.getByText("customPlans.filteredEmpty")).toBeInTheDocument();
    expect(screen.queryByText("customPlans.empty")).not.toBeInTheDocument();
  });

  it("shows the requested numbers instead of an empty scale cell", async () => {
    const interaction = userEvent.setup();
    vi.mocked(getAdminCustomPlanRequests).mockResolvedValue([pendingRequest]);
    render(<Packages />);

    await interaction.click(
      await screen.findByTestId("admin-packages-tab-requests"),
    );

    // Regression: cột này từng hiện "xe · tuyến" trống vì đọc sai tên field
    const row = await screen.findByTestId("custom-request-row-request-1");
    expect(row).toHaveTextContent("30");
    expect(row).toHaveTextContent("50");
    expect(row).toHaveTextContent("5.000");
  });

  it("opens a detail view with the operator note and the request id", async () => {
    const interaction = userEvent.setup();
    vi.mocked(getAdminCustomPlanRequests).mockResolvedValue([pendingRequest]);
    render(<Packages />);

    await interaction.click(
      await screen.findByTestId("admin-packages-tab-requests"),
    );
    await interaction.click(await screen.findByTestId("view-request-1"));

    // Ghi chú là căn cứ chính để duyệt, bảng không có chỗ nên nó phải ở đây
    expect(await screen.findByTestId("detail-note")).toHaveTextContent(
      "Cần gói riêng cho vận hành nhiều tuyến",
    );
    // Mã yêu cầu chỉ nằm trong chi tiết, kèm nút copy
    expect(screen.getByTestId("copy-request-id")).toBeInTheDocument();
  });

  it("hands the request over from detail to the approve form", async () => {
    const interaction = userEvent.setup();
    vi.mocked(getAdminCustomPlanRequests).mockResolvedValue([pendingRequest]);
    render(<Packages />);

    await interaction.click(
      await screen.findByTestId("admin-packages-tab-requests"),
    );
    await interaction.click(await screen.findByTestId("view-request-1"));
    await interaction.click(screen.getByTestId("detail-approve"));

    // Form duyệt prefill đúng hạn mức đã xin
    expect(
      await screen.findByTestId("approve-custom-plan-submit"),
    ).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    const numberInputs =
      dialog.querySelectorAll<HTMLInputElement>('input[type="number"]');
    expect(numberInputs[0]).toHaveValue(30);
  });

  it("searches the queue by operator name and by request id", async () => {
    const interaction = userEvent.setup();
    vi.mocked(getAdminCustomPlanRequests).mockResolvedValue([
      pendingRequest,
      {
        ...pendingRequest,
        requestId: "request-2",
        operatorId: "aaaa1111-bbbb-2222-cccc-333344445555",
        operatorName: "Nhà xe Thành Bưởi",
      },
    ]);
    render(<Packages />);

    await interaction.click(
      await screen.findByTestId("admin-packages-tab-requests"),
    );
    await screen.findByTestId("custom-request-row-request-1");

    const search = screen.getByLabelText("customPlans.searchPlaceholder");
    fireEvent.change(search, { target: { value: "thành bưởi" } });

    // Không phân biệt hoa thường và dấu cách thừa
    expect(
      screen.queryByTestId("custom-request-row-request-1"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("custom-request-row-request-2"),
    ).toBeInTheDocument();

    // Dán mã yêu cầu cũng ra đúng dòng — admin hay có sẵn UUID khi trao đổi
    fireEvent.change(search, { target: { value: "request-1" } });
    expect(
      screen.getByTestId("custom-request-row-request-1"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("custom-request-row-request-2"),
    ).not.toBeInTheDocument();
  });

  it("filters the queue by preferred billing period", async () => {
    const interaction = userEvent.setup();
    vi.mocked(getAdminCustomPlanRequests).mockResolvedValue([
      pendingRequest,
      {
        ...pendingRequest,
        requestId: "request-2",
        preferredBillingPeriod: "YEARLY",
      },
    ]);
    render(<Packages />);

    await interaction.click(
      await screen.findByTestId("admin-packages-tab-requests"),
    );
    await screen.findByTestId("custom-request-row-request-1");

    // CustomSelect là listbox tuỳ biến, không phải <select>: mở bằng button
    // rồi chọn option, fireEvent.change không đụng tới nó
    await interaction.click(
      screen.getByRole("button", { name: "customPlans.filterPeriod" }),
    );
    await interaction.click(
      await screen.findByRole("option", { name: "customPlans.billing.YEARLY" }),
    );

    expect(
      screen.queryByTestId("custom-request-row-request-1"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("custom-request-row-request-2"),
    ).toBeInTheDocument();
  });

  it("tells apart an empty queue from an empty filter result", async () => {
    const interaction = userEvent.setup();
    vi.mocked(getAdminCustomPlanRequests).mockResolvedValue([pendingRequest]);
    render(<Packages />);

    await interaction.click(
      await screen.findByTestId("admin-packages-tab-requests"),
    );
    await screen.findByTestId("custom-request-row-request-1");

    fireEvent.change(screen.getByLabelText("customPlans.searchPlaceholder"), {
      target: { value: "không có ai tên vậy" },
    });

    // "Chưa ai gửi yêu cầu" và "lọc không ra gì" là hai chuyện khác nhau
    expect(screen.getByText("customPlans.filteredEmpty")).toBeInTheDocument();
    expect(screen.queryByText("customPlans.empty")).not.toBeInTheDocument();
  });

  it("requires a name and at least one non-zero price before approving", async () => {
    const interaction = userEvent.setup();
    vi.mocked(getAdminCustomPlanRequests).mockResolvedValue([pendingRequest]);
    render(<Packages />);

    await interaction.click(
      await screen.findByTestId("admin-packages-tab-requests"),
    );
    await interaction.click(await screen.findByTestId("approve-request-1"));

    // Tên có prefill sẵn — xoá đi để kiểm ràng buộc bắt buộc
    const dialog = screen.getByRole("dialog");
    const nameInput = dialog.querySelector<HTMLInputElement>("input:not([type])");
    fireEvent.change(nameInput!, { target: { value: "  " } });

    await interaction.click(screen.getByTestId("approve-custom-plan-submit"));
    expect(
      screen.getByText("customPlans.nameRequired"),
    ).toBeInTheDocument();
    expect(approveAdminCustomPlanRequest).not.toHaveBeenCalled();

    fireEvent.change(nameInput!, { target: { value: "VietRide × PT" } });

    // Có tên nhưng hai giá đều 0 — gói dựng ra không ai mua được
    await interaction.click(screen.getByTestId("approve-custom-plan-submit"));
    expect(screen.getByText("customPlans.priceRequired")).toBeInTheDocument();
    expect(approveAdminCustomPlanRequest).not.toHaveBeenCalled();
  });

  it("flags every quota the admin changed away from the request", async () => {
    const interaction = userEvent.setup();
    vi.mocked(getAdminCustomPlanRequests).mockResolvedValue([pendingRequest]);
    render(<Packages />);

    await interaction.click(
      await screen.findByTestId("admin-packages-tab-requests"),
    );
    await interaction.click(await screen.findByTestId("approve-request-1"));

    const dialog = screen.getByRole("dialog");
    const numberInputs =
      dialog.querySelectorAll<HTMLInputElement>('input[type="number"]');

    // Prefill đúng số nhà xe xin, chưa sửa gì thì không đánh dấu
    expect(numberInputs[0]).toHaveValue(30);
    expect(dialog).not.toHaveTextContent("customPlans.changedByAdmin");

    fireEvent.change(numberInputs[0], { target: { value: "20" } });

    // Hạ hạn mức so với yêu cầu là quyền của admin, nhưng phải thấy mình đã sửa
    expect(dialog).toHaveTextContent("customPlans.changedByAdmin");
  });

  it("warns when the admin turns off a module the operator asked for", async () => {
    const interaction = userEvent.setup();
    vi.mocked(getAdminCustomPlanRequests).mockResolvedValue([pendingRequest]);
    render(<Packages />);

    await interaction.click(
      await screen.findByTestId("admin-packages-tab-requests"),
    );
    await interaction.click(await screen.findByTestId("approve-request-1"));

    expect(
      screen.queryByTestId("module-denied-enableRag"),
    ).not.toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    const checkboxes =
      dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    // Ba module theo thứ tự: hàng hoá, trung chuyển, trợ lý AI
    fireEvent.click(checkboxes[2]);

    // Tắt module đã xin = nhà xe mua gói rồi đi tìm tính năng không có
    expect(
      await screen.findByTestId("module-denied-enableRag"),
    ).toBeInTheDocument();
  });

  it("suggests a plan name from the requested scale", async () => {
    const interaction = userEvent.setup();
    vi.mocked(getAdminCustomPlanRequests).mockResolvedValue([pendingRequest]);
    render(<Packages />);

    await interaction.click(
      await screen.findByTestId("admin-packages-tab-requests"),
    );
    await interaction.click(await screen.findByTestId("approve-request-1"));

    // Ô tên không để trắng — nhà xe chỉ thấy tên + mô tả trong bảng giá của họ
    const dialog = screen.getByRole("dialog");
    expect(
      dialog.querySelector<HTMLInputElement>("input:not([type])"),
    ).toHaveValue("Gói riêng 30 xe");
  });

  it("pins backend field errors onto the matching quota input", async () => {
    const interaction = userEvent.setup();
    vi.mocked(getAdminCustomPlanRequests).mockResolvedValue([pendingRequest]);
    // 422 CUSTOM_PLAN_LIMIT_BELOW_CURRENT_USAGE: BE chỉ đúng ô nào sai
    vi.mocked(approveAdminCustomPlanRequest).mockRejectedValue(
      new ApiRequestError("limit too low", 422, "CUSTOM_PLAN_LIMIT_BELOW_CURRENT_USAGE", [
        { field: "maxRoutes", message: "Nhà xe đang dùng 60 tuyến" },
      ]),
    );
    render(<Packages />);

    await interaction.click(
      await screen.findByTestId("admin-packages-tab-requests"),
    );
    await interaction.click(await screen.findByTestId("approve-request-1"));

    const dialog = screen.getByRole("dialog");
    const nameInput = dialog.querySelector<HTMLInputElement>("input:not([type])");
    fireEvent.change(nameInput!, { target: { value: "VietRide × PT" } });
    const currencyInputs = dialog.querySelectorAll<HTMLInputElement>(
      'input[inputmode="numeric"]',
    );
    fireEvent.change(currencyInputs[0], { target: { value: "1800000" } });

    await interaction.click(screen.getByTestId("approve-custom-plan-submit"));

    expect(
      await screen.findByTestId("approve-field-error-maxRoutes"),
    ).toHaveTextContent("Nhà xe đang dùng 60 tuyến");
    // Modal PHẢI còn mở để admin sửa đúng ô vừa bị đánh dấu
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps the reject button disabled until a reason is typed", async () => {
    const interaction = userEvent.setup();
    vi.mocked(getAdminCustomPlanRequests).mockResolvedValue([pendingRequest]);
    vi.mocked(rejectAdminCustomPlanRequest).mockResolvedValue(pendingRequest);
    render(<Packages />);

    await interaction.click(
      await screen.findByTestId("admin-packages-tab-requests"),
    );
    await interaction.click(await screen.findByTestId("reject-request-1"));

    expect(screen.getByTestId("reject-custom-plan-submit")).toBeDisabled();

    fireEvent.change(screen.getByTestId("reject-reason-input"), {
      target: { value: "Quy mô hiện tại vẫn nằm trong gói Nâng cao." },
    });

    expect(screen.getByTestId("reject-custom-plan-submit")).toBeEnabled();
    await interaction.click(screen.getByTestId("reject-custom-plan-submit"));

    expect(rejectAdminCustomPlanRequest).toHaveBeenCalledWith("request-1", {
      reason: "Quy mô hiện tại vẫn nằm trong gói Nâng cao.",
    });
  });
});
