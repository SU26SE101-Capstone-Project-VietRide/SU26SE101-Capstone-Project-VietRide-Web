import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ShuttleRoutePreviewResult } from "../../../api/vietride";
import ShuttleRoutePreviewPanel from "./ShuttleRoutePreviewPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${Object.values(values).join(" ")}` : key,
  }),
}));

const base: ShuttleRoutePreviewResult = {
  status: "SAFE",
  estimatedFinishAt: "2026-09-01T15:00:00+07:00",
  hardCutoffAt: "2026-09-01T15:30:00+07:00",
  delayMinutes: 0,
  warningCode: null,
  lateRiskBlocksCreate: false,
  basis: "GOONG",
};

describe("ShuttleRoutePreviewPanel", () => {
  it.each([
    ["SAFE", "status"],
    ["LATE_RISK", "alert"],
    ["UNKNOWN", "status"],
    ["NOT_APPLICABLE", "status"],
  ] as const)("hiện trạng thái %s", (status, role) => {
    const result: ShuttleRoutePreviewResult =
      status === "LATE_RISK"
        ? {
            ...base,
            status,
            delayMinutes: 17,
            warningCode: "SHUTTLE_LATE_RISK",
          }
        : status === "SAFE"
          ? base
          : {
              ...base,
              status,
              estimatedFinishAt: null,
              hardCutoffAt: status === "UNKNOWN" ? base.hardCutoffAt : null,
              delayMinutes: null,
              warningCode: null,
              basis: null,
            };

    render(<ShuttleRoutePreviewPanel result={result} />);

    expect(screen.getByRole(role)).toHaveTextContent(
      `dispatch.routePreviewStatus.${status}`,
    );
  });

  it("không dựng các mốc nullable của NOT_APPLICABLE", () => {
    render(
      <ShuttleRoutePreviewPanel
        result={{
          ...base,
          status: "NOT_APPLICABLE",
          estimatedFinishAt: null,
          hardCutoffAt: null,
          delayMinutes: null,
          warningCode: null,
          basis: null,
        }}
      />,
    );

    expect(
      screen.queryByText("dispatch.routePreviewEstimatedFinish"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("dispatch.routePreviewHardCutoff"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("dispatch.routePreviewBasisGoong"),
    ).not.toBeInTheDocument();
  });
});
