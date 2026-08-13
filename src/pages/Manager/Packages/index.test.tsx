import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorInvoices,
  getOperatorSubscription,
  getOperatorSubscriptionPlans,
  retryOperatorSubscriptionPayment,
  upgradeOperatorSubscription,
  type OperatorSubscriptionDetail,
  type SubscriptionPlan,
} from "../../../api/vietride";
import ManagerPackages from "./index";
import ToastProvider from "../../../components/toast/ToastProvider";

const translate = (key: string, options?: Record<string, string>) =>
  options?.name ? `${key} ${options.name}` : key;

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
  upgradeOperatorSubscription: vi.fn(),
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

describe("ManagerPackages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("sends the documented VNPay upgrade payload", async () => {
    const user = userEvent.setup();
    vi.mocked(upgradeOperatorSubscription).mockResolvedValue({
      subscriptionId: "subscription-1",
      upgradeAttemptId: "attempt-1",
      status: "ACTIVE",
      paymentId: "payment-1",
      amount: 3_000_000,
      billingPeriod: "YEARLY",
      paymentRedirectUrl: null,
      dueAt: null,
      activePlan: {
        planId: currentPlan.planId,
        name: currentPlan.name,
      },
      pendingTargetPlan: {
        planId: plan.planId,
        name: plan.name,
      },
    });

    renderPackages();

    await user.click(await screen.findByRole("button", { name: "packages.buyPackage" }));
    await user.click(
      screen.getByRole("button", { name: "packages.confirmPurchase" }),
    );

    expect(upgradeOperatorSubscription).toHaveBeenCalledWith(
      {
        planId: "plan-pro",
        billingPeriod: "YEARLY",
        paymentMethod: "VNPAY",
      },
      expect.any(String),
    );
    expect(upgradeOperatorSubscription).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId("toast")).toHaveTextContent("packages.missingPaymentRedirect");
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
    expect(upgradeOperatorSubscription).not.toHaveBeenCalled();
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
      vi.mocked(upgradeOperatorSubscription).mockResolvedValue({
        subscriptionId: "subscription-1",
        upgradeAttemptId: "attempt-2",
        status: "PENDING_PAYMENT",
        paymentId: "payment-2",
        amount: plan.pricePerYear,
        billingPeriod: "YEARLY",
        paymentRedirectUrl: null,
        dueAt: null,
        activePlan: {
          planId: plan.planId,
          name: plan.name,
        },
        pendingTargetPlan: {
          planId: plan.planId,
          name: plan.name,
        },
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
      await user.click(
        screen.getByRole("button", { name: "packages.confirmPurchase" }),
      );

      expect(upgradeOperatorSubscription).toHaveBeenCalledWith(
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
});
