import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorInvoices,
  getOperatorSubscription,
  getOperatorSubscriptionPlans,
  upgradeOperatorSubscription,
  type OperatorSubscriptionDetail,
  type SubscriptionPlan,
} from "../../../api/vietride";
import ManagerPackages from "./index";

const translate = (key: string, options?: Record<string, string>) =>
  options?.name ? `${key} ${options.name}` : key;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

vi.mock("../../../api/vietride", () => ({
  getOperatorSubscription: vi.fn(),
  getOperatorSubscriptionPlans: vi.fn(),
  getOperatorInvoices: vi.fn(),
  getOperatorInvoice: vi.fn(),
  downloadOperatorInvoice: vi.fn(),
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
      invoiceStatus: "PENDING",
    });

    render(<ManagerPackages />);

    await user.click(await screen.findByRole("button", { name: "packages.buyPackage" }));
    await user.click(
      screen.getByRole("button", { name: "packages.confirmPurchase" }),
    );

    expect(upgradeOperatorSubscription).toHaveBeenCalledWith({
      planId: "plan-pro",
      billingPeriod: "YEARLY",
      paymentMethod: "VNPAY",
      returnUrl: "http://localhost:3000/payments/return",
    });
    expect(upgradeOperatorSubscription).toHaveBeenCalledTimes(1);
    expect(screen.getByText("packages.missingPaymentRedirect")).toBeInTheDocument();
  });

  it("shows the one-time trial notice without listing the free plan for purchase", async () => {
    vi.mocked(getOperatorSubscriptionPlans).mockResolvedValue([
      currentPlan,
      plan,
    ]);

    render(<ManagerPackages />);

    expect(
      await screen.findByText("packages.freeTrialNotice"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("packages.packageLabel")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "packages.currentPlanButton" }),
    ).not.toBeInTheDocument();
    expect(upgradeOperatorSubscription).not.toHaveBeenCalled();
  });

  it("does not present an unresolved pending plan as active", async () => {
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

    render(<ManagerPackages />);

    expect(
      await screen.findByText("packages.pendingPackage Professional"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("packages.currentPackage Professional"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("packages.pendingPaymentOutOfSync"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("packages.noOtherPayablePlans"),
    ).toBeInTheDocument();
    expect(screen.queryByText("packages.vehiclesUsed")).not.toBeInTheDocument();
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
        invoiceStatus: "PENDING",
      });

      render(<ManagerPackages />);

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

      expect(upgradeOperatorSubscription).toHaveBeenCalledWith({
        planId: "plan-pro",
        billingPeriod: "YEARLY",
        paymentMethod: "VNPAY",
        returnUrl: "http://localhost:3000/payments/return",
      });
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

    render(<ManagerPackages />);

    expect(
      await screen.findByText("packages.subscriptionPeriodMismatch"),
    ).toBeInTheDocument();
  });
});
