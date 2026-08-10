import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdminSubscriptionPlan,
  getAdminSubscriptionPlans,
  type SubscriptionPlan,
} from "../../api/vietride";
import Packages from "./Packages";
import { useToastFeedback } from "../../hooks/useToastFeedback";

vi.mock("../../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../api/vietride", () => ({
  createAdminSubscriptionPlan: vi.fn(),
  getAdminSubscriptionPlans: vi.fn(),
  updateAdminSubscriptionPlan: vi.fn(),
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

describe("Admin Service Packages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("explains each module and keeps local validation inside the create modal", async () => {
    const interaction = userEvent.setup();
    render(<Packages />);

    await interaction.click(await screen.findByRole("button", { name: "packages.create" }));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByText("packages.parcelModuleHint")).toBeInTheDocument();
    expect(within(dialog).getByText("packages.shuttleModuleHint")).toBeInTheDocument();
    expect(within(dialog).getByText("packages.ragModuleHint")).toBeInTheDocument();

    await interaction.click(within(dialog).getByRole("button", { name: "packages.savePackage" }));
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

    await interaction.click(within(dialog).getByRole("button", { name: "packages.savePackage" }));
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

    await interaction.click(within(dialog).getByRole("button", { name: "packages.savePackage" }));
    expect(useToastFeedback).toHaveBeenLastCalledWith({ message: "", error: "packages.saveFailed" });
  });
});
