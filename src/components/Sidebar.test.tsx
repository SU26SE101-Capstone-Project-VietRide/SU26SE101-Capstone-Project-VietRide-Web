import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorSubscription,
  type OperatorSubscriptionDetail,
} from "../api/vietride";
import { OperatorSubscriptionProvider } from "../contexts/OperatorSubscriptionProvider";
import AssistantBubble from "./AssistantBubble";
import Sidebar from "./Sidebar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../auth", () => ({
  getAuthUser: () => ({
    id: "operator-admin-1",
    role: "OPERATOR_ADMIN",
  }),
  logout: vi.fn(),
}));

vi.mock("../api/vietride", () => ({
  getOperatorSubscription: vi.fn(),
}));

function subscription(
  modules: OperatorSubscriptionDetail["plan"]["modules"],
): OperatorSubscriptionDetail {
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
      modules,
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

function renderOperatorNavigation() {
  return render(
    <MemoryRouter>
      <OperatorSubscriptionProvider role="OPERATOR_ADMIN">
        <Sidebar
          role="OPERATOR_ADMIN"
          isOpen
          onClose={() => undefined}
        />
        <AssistantBubble />
      </OperatorSubscriptionProvider>
    </MemoryRouter>,
  );
}

function renderStaffNavigation() {
  return render(
    <MemoryRouter>
      <OperatorSubscriptionProvider role="OPERATOR_STAFF">
        <Sidebar role="OPERATOR_STAFF" isOpen onClose={() => undefined} />
      </OperatorSubscriptionProvider>
    </MemoryRouter>,
  );
}

describe("operator subscription navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Trạng thái thu gọn nhóm nằm trong localStorage nên rò từ test này sang
    // test khác nếu không dọn.
    window.localStorage.clear();
  });

  it("hides modules that are not included in the active plan", async () => {
    vi.mocked(getOperatorSubscription).mockResolvedValue(
      subscription({
        enableParcel: false,
        enableShuttle: false,
        enableRag: false,
      }),
    );

    renderOperatorNavigation();
    await waitFor(() => expect(getOperatorSubscription).toHaveBeenCalledOnce());

    expect(
      screen.queryByRole("link", { name: "manager.parcels" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "manager.dispatch" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "manager.policies" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "assistant.open" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "manager.packages" }),
    ).toBeInTheDocument();
  });

  it("shows the modules after the active plan enables them", async () => {
    vi.mocked(getOperatorSubscription).mockResolvedValue(
      subscription({
        enableParcel: true,
        enableShuttle: true,
        enableRag: true,
      }),
    );

    renderOperatorNavigation();

    expect(
      await screen.findByRole("link", { name: "manager.parcels" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "manager.dispatch" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "manager.policies" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "assistant.open" }),
    ).toBeInTheDocument();
  });

  it("shows operator staff only the read-only claim and appeal queues", () => {
    renderStaffNavigation();

    expect(
      screen.getByRole("link", { name: "manager.claims" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "manager.claimAppeals" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "manager.parcels" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "manager.dashboard" }),
    ).not.toBeInTheDocument();
    expect(getOperatorSubscription).not.toHaveBeenCalled();
  });

  it("keeps the assistant mounted while the bubble is temporarily closed", async () => {
    const user = userEvent.setup();
    vi.mocked(getOperatorSubscription).mockResolvedValue(
      subscription({
        enableParcel: false,
        enableShuttle: false,
        enableRag: true,
      }),
    );

    renderOperatorNavigation();

    const toggle = await screen.findByRole("button", {
      name: "assistant.open",
    });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toHaveAttribute("hidden");

    await user.click(toggle);
    expect(dialog).not.toHaveAttribute("hidden");

    await user.click(toggle);
    expect(dialog).toHaveAttribute("hidden");
    expect(document.querySelector('[role="dialog"]')).toBe(dialog);
  });

  it("thu gọn nhóm menu khi bấm tiêu đề và nhớ lựa chọn đó", async () => {
    vi.mocked(getOperatorSubscription).mockResolvedValue(
      subscription({
        enableParcel: true,
        enableShuttle: true,
        enableRag: true,
      }),
    );

    const { unmount } = renderOperatorNavigation();
    expect(
      await screen.findByRole("link", { name: "manager.parcels" }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "sections.parcel" }),
    );

    expect(
      screen.queryByRole("link", { name: "manager.parcels" }),
    ).not.toBeInTheDocument();
    // Nhóm khác không bị ảnh hưởng — thu gọn là theo từng nhóm.
    expect(
      screen.getByRole("link", { name: "manager.dashboard" }),
    ).toBeInTheDocument();

    unmount();
    renderOperatorNavigation();

    expect(
      await screen.findByRole("link", { name: "manager.dashboard" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "manager.parcels" }),
    ).not.toBeInTheDocument();
  });
});
