import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RouteMapLegend from "./RouteMapLegend";

vi.mock("react-i18next", () => {
  const translate = (key: string) => key;

  return {
    useTranslation: () => ({ t: translate }),
  };
});

describe("RouteMapLegend", () => {
  it("adds stop guidance only on the stops tab", () => {
    const { rerender } = render(<RouteMapLegend panelMode="info" />);

    expect(screen.getByText("routes.legendOrigin")).toBeInTheDocument();
    expect(screen.getByText("routes.legendDestination")).toBeInTheDocument();
    expect(screen.getByText("routes.legendSelectedRoute")).toBeInTheDocument();
    expect(screen.getByText("routes.legendOtherRoutes")).toBeInTheDocument();
    expect(
      screen.queryByText("routes.legendSuggestedStop"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("routes.legendOperatorStop"),
    ).not.toBeInTheDocument();

    rerender(<RouteMapLegend panelMode="stops" />);

    expect(screen.getByText("routes.legendSuggestedStop")).toBeInTheDocument();
    expect(screen.getByText("routes.legendOperatorStop")).toBeInTheDocument();
  });
});
