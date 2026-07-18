import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorSubscription,
  type OperatorSubscriptionDetail,
  type SubscriptionPlan,
} from "../../../api/vietride";
import SubscriptionPaymentReturn from "./PaymentReturn";

const translate = (key: string, options?: Record<string, string>) => {
  if (options?.name) return `${key} ${options.name}`;
  if (options?.code) return `${key} ${options.code}`;
  return key;
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

vi.mock("../../../components/LanguageSwitcher", () => ({
  default: () => <div>language-switcher</div>,
}));

vi.mock("../../../api/vietride", () => ({
  getOperatorSubscription: vi.fn(),
}));

const plan: SubscriptionPlan = {
  planId: "plan-enterprise",
  name: "Enterprise",
  description: "Enterprise plan",
  pricePerMonth: 4_000_000,
  pricePerYear: 39_900_000,
  limits: {
    maxVehicles: 100,
    maxDrivers: 100,
    maxAssistants: 100,
    maxOperatorUsers: 50,
    maxRoutes: 50,
    maxTripsPerMonth: 5_000,
  },
  modules: {
    enableParcel: true,
    enableShuttle: true,
    enableRag: true,
  },
  isActive: true,
};

const subscription: OperatorSubscriptionDetail = {
  subscriptionId: "subscription-1",
  status: "ACTIVE",
  billingPeriod: "YEARLY",
  startedAt: "2026-07-16T00:00:00Z",
  expiresAt: "2027-07-16T00:00:00Z",
  plan,
  usage: {
    currentVehicles: 1,
    currentDrivers: 2,
    currentAssistants: 1,
    currentOperatorUsers: 3,
    currentRoutes: 4,
    currentTripsThisMonth: 10,
  },
  pendingUpgrade: null,
};

describe("SubscriptionPaymentReturn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOperatorSubscription).mockResolvedValue(subscription);
  });

  it("verifies a successful VNPay return with the backend", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/payments/return?vnp_ResponseCode=00&vnp_TransactionNo=VNP123",
        ]}
      >
        <SubscriptionPaymentReturn />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("paymentReturn.successTitle"),
    ).toBeInTheDocument();
    expect(screen.getByText("VNP123")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
    expect(getOperatorSubscription).toHaveBeenCalledTimes(1);
  });

  it("shows a failed result without confirming it through subscription data", async () => {
    render(
      <MemoryRouter
        initialEntries={["/payments/return?vnp_ResponseCode=05"]}
      >
        <SubscriptionPaymentReturn />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("paymentReturn.failedTitle"),
    ).toBeInTheDocument();
    expect(getOperatorSubscription).not.toHaveBeenCalled();
  });
});
