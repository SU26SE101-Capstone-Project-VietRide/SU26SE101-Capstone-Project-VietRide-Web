import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OperatorRoute } from "../../../api/vietride";
import RouteMultiSelect from "./RouteMultiSelect";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const routes: OperatorRoute[] = [
  {
    id: "route-hcm-hue",
    operatorId: "operator-1",
    name: "Sài Gòn - Huế",
    originStationId: "station-hcm",
    destinationStationId: "station-hue",
    baseFare: 500_000,
    totalDistanceKm: 650,
    estimatedDurationMinutes: 900,
    isActive: true,
  },
  {
    id: "route-hcm-da-nang",
    operatorId: "operator-1",
    name: "Sài Gòn - Đà Nẵng",
    originStationId: "station-hcm",
    destinationStationId: "station-da-nang",
    baseFare: 450_000,
    totalDistanceKm: 600,
    estimatedDurationMinutes: 840,
    isActive: true,
  },
];

describe("RouteMultiSelect", () => {
  it("selects all visible routes and clears them with the same button", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <RouteMultiSelect
        routes={routes}
        selectedRouteIds={[]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "vouchers.selectAllRoutes" }));
    expect(onChange).toHaveBeenLastCalledWith([
      "route-hcm-hue",
      "route-hcm-da-nang",
    ]);

    rerender(
      <RouteMultiSelect
        routes={routes}
        selectedRouteIds={["route-hcm-hue", "route-hcm-da-nang"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "vouchers.clearSelectedRoutes" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("selects only the routes matching the search", () => {
    const onChange = vi.fn();
    render(
      <RouteMultiSelect
        routes={routes}
        selectedRouteIds={[]}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Đà Nẵng" },
    });
    expect(screen.queryByText("Sài Gòn - Huế")).not.toBeInTheDocument();
    expect(screen.getByText("Sài Gòn - Đà Nẵng")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "vouchers.selectAllRoutes" }));
    expect(onChange).toHaveBeenLastCalledWith(["route-hcm-da-nang"]);
  });
});
