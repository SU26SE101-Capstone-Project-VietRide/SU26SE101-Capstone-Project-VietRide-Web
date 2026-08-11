import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorSubscription,
  type OperatorSubscriptionDetail,
} from "../api/vietride";
import { OperatorSubscriptionProvider } from "../contexts/OperatorSubscriptionProvider";
import SubscriptionFeatureRoute from "./SubscriptionFeatureRoute";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../api/vietride", () => ({
  getOperatorSubscription: vi.fn(),
}));

function subscription(enableRag: boolean): OperatorSubscriptionDetail {
  return {
    subscriptionId: "subscription-1",
    status: "ACTIVE",
    billingPeriod: "YEARLY",
    startedAt: "2026-08-01T00:00:00Z",
    expiresAt: "2027-08-01T00:00:00Z",
    plan: {
      planId: "plan-1",
      name: "Operator plan",
      pricePerMonth: 100_000,
      pricePerYear: 1_000_000,
      limits: {
        maxVehicles: 10,
        maxDrivers: 10,
        maxAssistants: 10,
        maxOperatorUsers: 10,
        maxRoutes: 10,
        maxTripsPerMonth: 100,
      },
      modules: {
        enableParcel: false,
        enableShuttle: false,
        enableRag,
      },
      isActive: true,
    },
    usage: {
      currentVehicles: 0,
      currentDrivers: 0,
      currentAssistants: 0,
      currentOperatorUsers: 1,
      currentRoutes: 0,
      currentTripsThisMonth: 0,
    },
  };
}

function renderPolicyRoute() {
  return render(
    <MemoryRouter initialEntries={["/manager/policies"]}>
      <OperatorSubscriptionProvider role="OPERATOR_ADMIN">
        <Routes>
          <Route path="/manager">
            <Route
              element={<SubscriptionFeatureRoute module="enableRag" />}
            >
              <Route path="policies" element={<p>policy-page</p>} />
            </Route>
            <Route path="packages" element={<p>packages-page</p>} />
          </Route>
        </Routes>
      </OperatorSubscriptionProvider>
    </MemoryRouter>,
  );
}

describe("SubscriptionFeatureRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects a disabled module before its page mounts", async () => {
    vi.mocked(getOperatorSubscription).mockResolvedValue(subscription(false));

    renderPolicyRoute();

    expect(await screen.findByText("packages-page")).toBeInTheDocument();
    expect(screen.queryByText("policy-page")).not.toBeInTheDocument();
  });

  it("renders the page when the module is enabled", async () => {
    vi.mocked(getOperatorSubscription).mockResolvedValue(subscription(true));

    renderPolicyRoute();

    expect(await screen.findByText("policy-page")).toBeInTheDocument();
    expect(screen.queryByText("packages-page")).not.toBeInTheDocument();
  });
});
