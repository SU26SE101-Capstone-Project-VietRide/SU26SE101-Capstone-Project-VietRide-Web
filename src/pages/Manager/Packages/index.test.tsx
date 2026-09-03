import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorInvoices,
  getOperatorSubscription,
  getOperatorSubscriptionPlans,
  retryOperatorSubscriptionPayment,
  confirmSubscriptionUpgradePayment,
  createSubscriptionUpgradeQuote,
  createOperatorCustomPlanRequest,
  getOperatorCustomPlanRequests,
  type OperatorCustomPlanRequest,
  type OperatorSubscriptionDetail,
  type SubscriptionPlan,
  type SubscriptionUpgradeQuote,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import ManagerPackages from "./index";
import ToastProvider from "../../../components/toast/ToastProvider";

// Mock dịch trả về key; nối thêm giá trị nội suy mà test cần đọc (tên gói,
// số tiền còn thiếu) để assert được nội dung thật chứ không chỉ có key.
const translate = (key: string, options?: Record<string, string>) => {
  const interpolated = options?.name ?? options?.shortfall;
  return interpolated ? `${key} ${interpolated}` : key;
};

function renderPackages() {
  // OperatorInvoiceSection dùng useSearchParams để mở chi tiết hoá đơn theo
  // query string, nên màn phải nằm trong Router như trên app thật.
  return render(
    <MemoryRouter initialEntries={["/manager/packages"]}>
      <ToastProvider><ManagerPackages /></ToastProvider>
    </MemoryRouter>,
  );
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

vi.mock("../../../api/vietride", () => ({
  getOperatorSubscription: vi.fn(),
  getOperatorSubscriptionPlans: vi.fn(),
  getOperatorInvoices: vi.fn(),
  getOperatorInvoice: vi.fn(),
  downloadOperatorInvoice: vi.fn(),
  retryOperatorSubscriptionPayment: vi.fn(),
  createSubscriptionUpgradeQuote: vi.fn(),
  confirmSubscriptionUpgradePayment: vi.fn(),
  getOperatorCustomPlanRequests: vi.fn(),
  createOperatorCustomPlanRequest: vi.fn(),
}));

const plan: SubscriptionPlan = {
  planId: "plan-pro",
  name: "Professional",
  description: "Professional plan",
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
    enableShuttle: true,
    enableRag: true,
  },
  isActive: true,
};

const currentPlan: SubscriptionPlan = {
  ...plan,
  planId: "plan-starter",
  name: "Starter (Free Trial)",
  pricePerMonth: 0,
  pricePerYear: 0,
};

const enterprisePlan: SubscriptionPlan = {
  ...plan,
  planId: "plan-enterprise",
  name: "Enterprise",
  pricePerMonth: 4_000_000,
  pricePerYear: 39_900_000,
};

const subscription: OperatorSubscriptionDetail = {
  subscriptionId: "subscription-1",
  status: "ACTIVE",
  billingPeriod: "YEARLY",
  startedAt: "2026-07-01T00:00:00Z",
  expiresAt: "2027-07-01T00:00:00Z",
  plan: currentPlan,
  usage: {
    currentVehicles: 1,
    currentDrivers: 1,
    currentAssistants: 1,
    currentOperatorUsers: 2,
    currentRoutes: 1,
    currentTripsThisMonth: 4,
  },
  pendingUpgrade: null,
};

const quote: SubscriptionUpgradeQuote = {
  upgradeAttemptId: "attempt-1",
  sourcePlanId: currentPlan.planId,
  targetPlanId: plan.planId,
  billingPeriod: "YEARLY",
  paymentMethod: "VNPAY",
  prorationApplied: true,
  currentCyclePrice: 300_000,
  targetCyclePrice: 3_000_000,
  unusedCredit: 150_000,
  proratedTargetAmount: 250_000,
  amountDue: 100_000,
  periodFrom: "2026-08-21T10:00:00Z",
  periodTo: "2026-09-05T10:00:00Z",
  quotedAt: "2026-08-21T10:00:00Z",
  // Còn hạn rất xa so với đồng hồ thật của test — đồng hồ đếm ngược không chạy về 0
  dueAt: "2099-01-01T00:00:00Z",
  currency: "VND",
  status: "INITIATED",
};

const customRequest: OperatorCustomPlanRequest = {
  requestId: "request-1",
  status: "PENDING_REVIEW",
  preferredBillingPeriod: "MONTHLY",
  note: "Cần thêm tuyến",
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

describe("ManagerPackages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(getOperatorCustomPlanRequests).mockResolvedValue([]);
    vi.mocked(getOperatorSubscription).mockResolvedValue(subscription);
    vi.mocked(getOperatorSubscriptionPlans).mockResolvedValue([plan]);
    vi.mocked(getOperatorInvoices).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 8,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows all six configured resource quotas to the operator admin", async () => {
    renderPackages();

    expect(
      await screen.findByText("packages.currentPackage Starter (Free Trial)"),
    ).toBeInTheDocument();

    const expectedCurrentUsage = [
      ["packages.vehiclesUsed", "1/20"],
      ["packages.routesUsed", "1/10"],
      ["packages.driversUsed", "1/30"],
      ["packages.assistantsUsed", "1/20"],
      ["packages.operatorUsersUsed", "2/10"],
      ["packages.tripsUsed", "4/500"],
    ] as const;

    expectedCurrentUsage.forEach(([label, usage]) => {
      expect(screen.getByLabelText(`${label}: ${usage}`)).toBeInTheDocument();
    });

    const availablePlan = await screen.findByTestId("plan-card-plan-pro");
    [
      "packages.limitLabels.maxDrivers",
      "packages.limitLabels.maxAssistants",
      "packages.limitLabels.maxOperatorUsers",
    ].forEach((label) => {
      expect(within(availablePlan).getByText(label)).toBeInTheDocument();
    });
  });

  it("quotes before charging and uses a different idempotency key for each step", async () => {
    const user = userEvent.setup();
    vi.mocked(createSubscriptionUpgradeQuote).mockResolvedValue(quote);
    // Không có paymentRedirectUrl = ví đã trừ xong (200), không phải VNPAY
    vi.mocked(confirmSubscriptionUpgradePayment).mockResolvedValue({
      upgradeAttemptId: "attempt-1",
      status: "ACTIVE",
      paymentRedirectUrl: null,
    });

    renderPackages();

    await user.click(
      await screen.findByRole("button", { name: "packages.buyPackage" }),
    );

    expect(screen.getByTestId("upgrade-method-VNPAY")).toBeInTheDocument();
    expect(
      screen.queryByTestId("upgrade-method-WALLET"),
    ).not.toBeInTheDocument();

    // Bước 1 chỉ chọn — chưa được gọi thanh toán
    expect(confirmSubscriptionUpgradePayment).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("upgrade-request-quote"));

    expect(createSubscriptionUpgradeQuote).toHaveBeenCalledWith(
      {
        planId: "plan-pro",
        billingPeriod: "YEARLY",
        paymentMethod: "VNPAY",
      },
      expect.any(String),
    );

    // Bước 2 hiện đúng số BE trả, không tự tính lại
    expect(await screen.findByTestId("quote-amount-due")).toHaveTextContent(
      "100.000",
    );
    const deductionFormula = screen.getByTestId("deduction-formula");
    expect(deductionFormula).toHaveTextContent(
      "packages.deductionFormulaTitle",
    );
    expect(deductionFormula).toHaveTextContent("250.000");
    expect(deductionFormula).toHaveTextContent("150.000");
    expect(deductionFormula).toHaveTextContent("100.000");

    await user.click(screen.getByTestId("upgrade-confirm-payment"));

    expect(confirmSubscriptionUpgradePayment).toHaveBeenCalledWith(
      "attempt-1",
      expect.any(String),
    );
    // Key của quote và của payment PHẢI khác nhau — dùng lại key đã nhận 402 sẽ
    // bị replay response cũ trong 24 giờ
    const quoteKey = vi.mocked(createSubscriptionUpgradeQuote).mock.calls[0][1];
    const paymentKey = vi.mocked(confirmSubscriptionUpgradePayment).mock
      .calls[0][1];
    expect(paymentKey).not.toBe(quoteKey);
  });

  it("shows a persistent banner and resumes the quote after the modal closes", async () => {
    const user = userEvent.setup();
    vi.mocked(createSubscriptionUpgradeQuote).mockResolvedValue(quote);

    renderPackages();

    await user.click(
      await screen.findByRole("button", { name: "packages.buyPackage" }),
    );
    await user.click(screen.getByTestId("upgrade-request-quote"));
    expect(await screen.findByTestId("quote-amount-due")).toBeInTheDocument();

    await user.click(screen.getByTestId("close-upgrade-quote"));

    const banner = await screen.findByTestId("saved-upgrade-quote");
    expect(banner).toHaveTextContent("packages.savedQuoteTitle");
    expect(banner).toHaveTextContent("Professional");
    expect(
      screen.getByRole("button", { name: "packages.buyPackage" }),
    ).toBeDisabled();

    await user.click(screen.getByTestId("resume-saved-upgrade-quote"));

    expect(screen.getByTestId("quote-amount-due")).toBeInTheDocument();
  });

  it("defaults the price list to the period the operator is actually billed on", async () => {
    const user = userEvent.setup();
    vi.mocked(getOperatorSubscription).mockResolvedValue({
      ...subscription,
      billingPeriod: "MONTHLY",
      plan,
    });
    vi.mocked(getOperatorSubscriptionPlans).mockResolvedValue([
      plan,
      enterprisePlan,
    ]);

    renderPackages();

    // Đang trả theo tháng → bảng giá mở ra ở kỳ tháng, không phải mặc định cứng
    // theo năm rồi bấm vào mới biết chỉ mua được theo tháng
    // Nút đã có sẵn từ render đầu với aria-pressed="false"; kỳ thanh toán chỉ
    // được chọn sau khi tải xong subscription. `findBy` khớp ngay ở lần render
    // đầu nên phải chờ chính thuộc tính, không phải chờ phần tử.
    await waitFor(() =>
      expect(screen.getByTestId("plan-list-period-MONTHLY")).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(
      screen.queryByTestId("browsing-unavailable-period"),
    ).not.toBeInTheDocument();

    // Xem giá năm vẫn được, nhưng phải nói rõ là không mua kỳ đó được
    await user.click(screen.getByTestId("plan-list-period-YEARLY"));

    expect(
      screen.getByTestId("browsing-unavailable-period"),
    ).toBeInTheDocument();
  });

  it("lets a trial operator pick either billing period", async () => {
    const user = userEvent.setup();
    // Gói hiện tại là bản dùng thử (giá 0) → nâng cấp mở CHU KỲ MỚI, không phải
    // nâng cấp giữa chu kỳ, nên không được khoá kỳ thanh toán
    renderPackages();

    await user.click(
      await screen.findByRole("button", { name: "packages.buyPackage" }),
    );

    expect(screen.getByTestId("upgrade-period-MONTHLY")).toBeEnabled();
    expect(screen.getByTestId("upgrade-period-YEARLY")).toBeEnabled();
  });

  it("locks the billing period when upgrading mid-cycle on a paid plan", async () => {
    const user = userEvent.setup();
    vi.mocked(getOperatorSubscription).mockResolvedValue({
      ...subscription,
      plan,
    });
    vi.mocked(getOperatorSubscriptionPlans).mockResolvedValue([
      plan,
      enterprisePlan,
    ]);

    renderPackages();

    await user.click(
      (await screen.findAllByRole("button", { name: "packages.buyPackage" }))[0],
    );

    // Đang trả tiền theo năm giữa chu kỳ → khoá cả hai nút, chặn trước
    // 422 SUBSCRIPTION_UPGRADE_BILLING_PERIOD_MISMATCH
    expect(screen.getByTestId("upgrade-period-MONTHLY")).toBeDisabled();
    expect(screen.getByTestId("upgrade-period-YEARLY")).toBeDisabled();
  });

  it("shows the one-time trial notice without listing the free plan for purchase", async () => {
    vi.mocked(getOperatorSubscriptionPlans).mockResolvedValue([
      currentPlan,
      plan,
    ]);

    renderPackages();

    expect(
      await screen.findByText("packages.freeTrialNotice"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("packages.packageLabel")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "packages.currentPlanButton" }),
    ).not.toBeInTheDocument();
    expect(createSubscriptionUpgradeQuote).not.toHaveBeenCalled();
  });

  it("keeps showing the entitled plan when pending payment details are unavailable", async () => {
    vi.mocked(getOperatorSubscription).mockResolvedValue({
      ...subscription,
      status: "PENDING_PAYMENT",
      billingPeriod: null,
      startedAt: null,
      expiresAt: null,
      plan,
      pendingUpgrade: null,
    });
    vi.mocked(getOperatorSubscriptionPlans).mockResolvedValue([plan]);

    renderPackages();

    expect(
      await screen.findByText("packages.currentPackage Professional"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("packages.pendingPackage Professional"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("packages.pendingPaymentOutOfSync"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("packages.noOtherPayablePlans"),
    ).toBeInTheDocument();
    expect(screen.getByText("packages.vehiclesUsed")).toBeInTheDocument();
  });

  it("shows the pending target plan and retries through the documented API", async () => {
    const user = userEvent.setup();
    vi.mocked(getOperatorSubscription).mockResolvedValue({
      ...subscription,
      status: "PENDING_PAYMENT",
      plan: currentPlan,
      pendingUpgrade: {
        upgradeAttemptId: "attempt-pending",
        targetPlan: {
          planId: plan.planId,
          name: plan.name,
        },
        billingPeriod: "YEARLY",
        amount: plan.pricePerYear,
        dueAt: null,
        remainingSeconds: 600,
        latestPayment: {
          paymentId: "payment-old",
          status: "FAILED",
          canRetry: true,
        },
      },
    });
    vi.mocked(getOperatorSubscriptionPlans).mockResolvedValue([
      currentPlan,
      plan,
    ]);
    vi.mocked(retryOperatorSubscriptionPayment).mockResolvedValue({
      upgradeAttemptId: "attempt-pending",
      status: "PENDING_PAYMENT",
      paymentId: "payment-new",
      paymentRedirectUrl: null,
      dueAt: null,
    });

    renderPackages();

    expect(
      await screen.findByText("packages.currentPackage Starter (Free Trial)"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Professional").length).toBeGreaterThanOrEqual(2);

    await user.click(
      screen.getByRole("button", { name: "packages.retryPayment" }),
    );

    expect(retryOperatorSubscriptionPayment).toHaveBeenCalledWith(
      "attempt-pending",
      expect.any(String),
    );
    expect(
      await screen.findByText("packages.missingPaymentRedirect"),
    ).toBeInTheDocument();
  });

  it("refreshes a pending subscription until the backend activates the plan", async () => {
    vi.useFakeTimers();
    const pendingSubscription: OperatorSubscriptionDetail = {
      ...subscription,
      status: "PENDING_PAYMENT",
      pendingUpgrade: {
        upgradeAttemptId: "attempt-pending",
        targetPlan: {
          planId: plan.planId,
          name: plan.name,
        },
        billingPeriod: "YEARLY",
        amount: plan.pricePerYear,
        dueAt: "2026-07-23T00:00:00Z",
        remainingSeconds: 600,
        latestPayment: {
          paymentId: "payment-1",
          status: "SUCCEEDED",
          canRetry: false,
        },
      },
    };
    vi.mocked(getOperatorSubscription)
      .mockResolvedValueOnce(pendingSubscription)
      .mockResolvedValue({ ...subscription, plan });

    renderPackages();

    await act(async () => {
      await Promise.resolve();
    });
    expect(getOperatorSubscription).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(getOperatorSubscription).toHaveBeenCalledTimes(2);
    expect(
      screen.getByText("packages.currentPackage Professional"),
    ).toBeInTheDocument();
  });

  it.each(["CANCELLED", "EXPIRED"])(
    "allows purchasing the same paid plan again when the subscription is %s",
    async (status) => {
      const user = userEvent.setup();
      vi.mocked(getOperatorSubscription).mockResolvedValue({
        ...subscription,
        status,
        plan,
      });
      vi.mocked(getOperatorSubscriptionPlans).mockResolvedValue([
        currentPlan,
        plan,
        enterprisePlan,
      ]);
      vi.mocked(createSubscriptionUpgradeQuote).mockResolvedValue({
        ...quote,
        upgradeAttemptId: "attempt-2",
        sourcePlanId: plan.planId,
      });

      renderPackages();

      expect(
        await screen.findByText(
          `${
            status === "CANCELLED"
              ? "packages.cancelledPackage"
              : "packages.expiredPackage"
          } Professional`,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "packages.buyPackage" }),
      ).toBeEnabled();

      await user.click(
        screen.getByRole("button", { name: "packages.repurchasePackage" }),
      );
      await user.click(screen.getByTestId("upgrade-request-quote"));

      expect(createSubscriptionUpgradeQuote).toHaveBeenCalledWith(
        {
          planId: "plan-pro",
          billingPeriod: "YEARLY",
          paymentMethod: "VNPAY",
        },
        expect.any(String),
      );
    },
  );

  it("warns when a yearly paid subscription only has a one-month duration", async () => {
    vi.mocked(getOperatorSubscription).mockResolvedValue({
      ...subscription,
      status: "CANCELLED",
      billingPeriod: "YEARLY",
      startedAt: "2026-07-15T08:42:53Z",
      expiresAt: "2026-08-14T08:42:53Z",
      plan,
    });

    renderPackages();

    expect(
      await screen.findByText("packages.subscriptionPeriodMismatch"),
    ).toBeInTheDocument();
  });
  it("warns before the operator is blocked by their current plan limits", async () => {
    // Gói cho 10 tuyến, đang chạy 9 (90%) → cảnh báo trước, chưa chặn
    vi.mocked(getOperatorSubscription).mockResolvedValue({
      ...subscription,
      plan,
      usage: { ...subscription.usage, currentRoutes: 9 },
    });
    vi.mocked(getOperatorSubscriptionPlans).mockResolvedValue([
      plan,
      enterprisePlan,
    ]);

    renderPackages();

    expect(await screen.findByTestId("usage-pressure-banner")).toHaveTextContent(
      "packages.usageNearTitle",
    );
    expect(screen.getByTestId("usage-pressure-maxRoutes")).toBeInTheDocument();
    expect(screen.getByTestId("usage-pressure-cta")).toBeInTheDocument();
  });

  it("stays quiet when usage is comfortably under the limits", async () => {
    renderPackages();

    await screen.findByRole("button", { name: "packages.buyPackage" });
    expect(
      screen.queryByTestId("usage-pressure-banner"),
    ).not.toBeInTheDocument();
  });

  it("points to a custom request when no standard plan is big enough", async () => {
    // Đã chạm hạn mức và gói còn lại cũng không chứa nổi → không mời chọn gói,
    // chỉ còn đường xin gói riêng
    const smallPlan = { ...plan, limits: { ...plan.limits, maxRoutes: 5 } };
    vi.mocked(getOperatorSubscription).mockResolvedValue({
      ...subscription,
      plan,
      usage: { ...subscription.usage, currentRoutes: 10 },
    });
    vi.mocked(getOperatorSubscriptionPlans).mockResolvedValue([
      plan,
      { ...smallPlan, planId: "plan-small", name: "Small" },
    ]);

    renderPackages();

    expect(await screen.findByTestId("usage-pressure-banner")).toHaveTextContent(
      "packages.usageReachedTitle",
    );
    expect(screen.queryByTestId("usage-pressure-cta")).not.toBeInTheDocument();
    expect(screen.getByText("packages.usageNoPlanFitsHint")).toBeInTheDocument();
  });

  it("blocks a mid-cycle upgrade to a plan that is not more expensive", async () => {
    // Đang trả 3.000.000/năm cho Professional; Basic rẻ hơn nên proration ra
    // số tiền ≤ 0 và BE trả 422 AMOUNT_NOT_PAYABLE. Chặn ngay trên card.
    const cheaperPlan = {
      ...plan,
      planId: "plan-basic",
      name: "Basic",
      pricePerMonth: 100_000,
      pricePerYear: 1_000_000,
    };
    vi.mocked(getOperatorSubscription).mockResolvedValue({
      ...subscription,
      plan,
    });
    vi.mocked(getOperatorSubscriptionPlans).mockResolvedValue([
      plan,
      cheaperPlan,
      enterprisePlan,
    ]);

    renderPackages();

    expect(
      await screen.findByTestId("plan-not-upgrade-plan-basic"),
    ).toBeInTheDocument();
    // Gói đắt hơn vẫn mua được bình thường
    expect(
      screen.queryByTestId("plan-not-upgrade-plan-enterprise"),
    ).not.toBeInTheDocument();
  });

  it("shows only the harder blocker when a plan fails both gates", async () => {
    // Gói vừa rẻ hơn vừa chật hơn mức đang dùng. Hạn mức là lý do khó gỡ hơn
    // (hết chu kỳ vẫn chặn) nên chỉ hiện nó.
    const tinyPlan = {
      ...plan,
      planId: "plan-tiny",
      name: "Tiny",
      pricePerMonth: 100_000,
      pricePerYear: 1_000_000,
      limits: { ...plan.limits, maxRoutes: 0 },
    };
    vi.mocked(getOperatorSubscription).mockResolvedValue({
      ...subscription,
      plan,
    });
    vi.mocked(getOperatorSubscriptionPlans).mockResolvedValue([plan, tinyPlan]);

    renderPackages();

    expect(
      await screen.findByTestId("plan-shortfall-plan-tiny"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("plan-not-upgrade-plan-tiny"),
    ).not.toBeInTheDocument();
  });

  it("blocks a second custom request while one is still pending", async () => {
    vi.mocked(getOperatorCustomPlanRequests).mockResolvedValue([customRequest]);
    renderPackages();

    expect(await screen.findByTestId("custom-request-pending")).toBeInTheDocument();
    // BE chỉ nhận một yêu cầu chờ duyệt — không mời gửi thêm
    expect(
      screen.queryByRole("button", { name: "packages.customRequestCta" }),
    ).not.toBeInTheDocument();
  });

  it("says an approved custom plan still needs an upgrade to take effect", async () => {
    const customPlan = {
      ...plan,
      planId: "plan-custom",
      name: "VietRide × PT",
      planType: "CUSTOM" as const,
    };
    vi.mocked(getOperatorSubscriptionPlans).mockResolvedValue([customPlan]);
    vi.mocked(getOperatorCustomPlanRequests).mockResolvedValue([
      {
        ...customRequest,
        status: "APPROVED",
        approvedPlanId: "plan-custom",
      },
    ]);

    renderPackages();

    const approved = await screen.findByTestId("custom-request-approved");
    // Câu chốt: duyệt xong VẪN đang ở gói cũ, phải nâng cấp mới lên được
    expect(approved).toHaveTextContent("packages.customRequestApprovedHint");
    expect(
      screen.getByTestId("custom-request-upgrade"),
    ).toHaveTextContent("packages.customRequestUpgradeCta VietRide × PT");
  });

  it("shows the admin's rejection reason verbatim", async () => {
    vi.mocked(getOperatorCustomPlanRequests).mockResolvedValue([
      {
        ...customRequest,
        status: "REJECTED",
        rejectionReason: "Quy mô hiện tại vẫn nằm trong gói Nâng cao.",
      },
    ]);

    renderPackages();

    expect(await screen.findByTestId("custom-request-rejected")).toHaveTextContent(
      "Quy mô hiện tại vẫn nằm trong gói Nâng cao.",
    );
  });

  it("prefills the request form from the current plan and warns below usage", async () => {
    const user = userEvent.setup();
    renderPackages();

    await user.click(
      await screen.findByRole("button", { name: "packages.customRequestCta" }),
    );

    // currentPlan cho 10 tuyến, đang dùng 1 → gợi ý 10
    const routesInput = screen.getByTestId("custom-request-maxRoutes");
    expect(routesInput).toHaveValue(10);

    // Hạ xuống dưới mức đang dùng (1 tuyến) → cảnh báo mềm ngay dưới ô
    fireEvent.change(routesInput, { target: { value: "0" } });
    expect(
      screen.getByTestId("custom-request-warning-maxRoutes"),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("custom-request-submit"));

    expect(createOperatorCustomPlanRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRoutes: 0,
        preferredBillingPeriod: "MONTHLY",
      }),
    );
  });

  it("reopens the pending request instead of erroring on 409", async () => {
    const user = userEvent.setup();
    vi.mocked(createOperatorCustomPlanRequest).mockRejectedValue(
      new ApiRequestError("pending", 409, "CUSTOM_REQUEST_ALREADY_PENDING"),
    );
    // Lần tải thứ hai (sau 409) trả về yêu cầu đang chờ
    vi.mocked(getOperatorCustomPlanRequests)
      .mockResolvedValueOnce([])
      .mockResolvedValue([customRequest]);

    renderPackages();

    await user.click(
      await screen.findByRole("button", { name: "packages.customRequestCta" }),
    );
    await user.click(screen.getByTestId("custom-request-submit"));

    // Form đóng lại và khối "đang chờ duyệt" hiện lên — không phải lỗi đỏ
    expect(
      await screen.findByTestId("custom-request-pending"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("custom-request-submit")).not.toBeInTheDocument();
  });
});
