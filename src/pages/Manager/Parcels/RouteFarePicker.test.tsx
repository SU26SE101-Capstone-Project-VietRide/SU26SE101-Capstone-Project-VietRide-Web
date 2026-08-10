import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { OperatorRoute } from "../../../api/vietride";
import { RouteFarePicker, type RouteFarePickerOption } from "./RouteFarePicker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function route(id: string, isActive = true): OperatorRoute {
  return {
    id,
    operatorId: "operator-1",
    name: `Route ${id}`,
    originStationId: "origin-1",
    destinationStationId: "destination-1",
    baseFare: 100_000,
    totalDistanceKm: 100,
    estimatedDurationMinutes: 120,
    isActive,
  };
}

const options: RouteFarePickerOption[] = [
  {
    route: route("1"),
    summary: {
      status: "UNPRICED",
      configuredSizeCount: 0,
      window: null,
      hasScheduledWindow: false,
    },
  },
  {
    route: route("2", false),
    summary: {
      status: "ACTIVE",
      configuredSizeCount: 4,
      window: null,
      hasScheduledWindow: false,
    },
  },
];

describe("RouteFarePicker", () => {
  it("searches, loads more and selects active routes", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const onSelect = vi.fn();
    const onLoadMore = vi.fn();

    render(
      <RouteFarePicker
        selectedRoute={null}
        options={options}
        query=""
        totalItems={12}
        isLoading={false}
        hasMore
        onQueryChange={onQueryChange}
        onSelect={onSelect}
        onLoadMore={onLoadMore}
      />,
    );

    const input = screen.getByRole("combobox", { name: "parcels.route" });
    await user.click(input);
    expect(screen.getByText("parcels.routeFareStatus.UNPRICED")).toBeInTheDocument();
    expect(screen.getByText("parcels.routeInactive")).toBeInTheDocument();

    await user.type(input, "Can Tho");
    expect(onQueryChange).toHaveBeenLastCalledWith("o");

    await user.click(screen.getByRole("button", { name: "parcels.routeSearchMore" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("option", { name: /Route 1/ }));
    expect(onSelect).toHaveBeenCalledWith(options[0]);
  });

  it("does not allow inactive routes to be selected", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <RouteFarePicker
        selectedRoute={null}
        options={options}
        query=""
        totalItems={2}
        isLoading={false}
        hasMore={false}
        onQueryChange={vi.fn()}
        onSelect={onSelect}
        onLoadMore={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "parcels.route" }));
    expect(screen.getByRole("option", { name: /Route 2/ })).toBeDisabled();
    await user.click(screen.getByRole("option", { name: /Route 2/ }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders the result panel outside the modal scroll container", async () => {
    const user = userEvent.setup();
    render(
      <RouteFarePicker
        selectedRoute={null}
        options={options}
        query=""
        totalItems={2}
        isLoading={false}
        hasMore={false}
        onQueryChange={vi.fn()}
        onSelect={vi.fn()}
        onLoadMore={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "parcels.route" }));

    const resultPanel = screen.getByRole("listbox").parentElement;
    expect(resultPanel).toHaveClass("fixed", "z-[70]");
    expect(resultPanel?.parentElement).toBe(document.body);
    expect(screen.getByText("Route 1")).not.toHaveClass("truncate");
  });
});
