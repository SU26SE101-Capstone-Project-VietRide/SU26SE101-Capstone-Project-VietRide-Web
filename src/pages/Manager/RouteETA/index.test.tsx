import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../../api/client";
import {
  approveOperatorRouteChangeProposal,
  getOperatorRouteChangeProposal,
  getOperatorRouteChangeProposals,
  type RouteChangeProposal,
} from "../../../api/vietride";
import RouteETAPage from "./index";

vi.mock("react-i18next", () => {
  const translate = (key: string) => key;

  return {
    useTranslation: () => ({ t: translate }),
  };
});

vi.mock("../../../api/vietride", () => ({
  approveOperatorRouteChangeProposal: vi.fn(),
  getOperatorRouteChangeProposal: vi.fn(),
  getOperatorRouteChangeProposals: vi.fn(),
  rejectOperatorRouteChangeProposal: vi.fn(),
}));

const proposal: RouteChangeProposal = {
  id: "proposal-1",
  tripId: "trip-1",
  operatorId: "operator-1",
  proposedByUserId: "driver-1",
  type: "CUSTOM",
  status: "PENDING",
  sourceAlternativeRouteId: null,
  sourceUpdatedAt: null,
  incidentId: null,
  reason: "Đường chính đang bị phong tỏa.",
  snapshot: {
    name: "Đường tránh QL20",
    description: null,
    destinationStationId: "station-1",
    totalDistanceKm: 125.5,
    estimatedDurationMinutes: 180,
    pathPolyline: null,
    stops: [],
  },
  decidedByUserId: null,
  decidedAt: null,
  rejectionReason: null,
  resolutionCode: null,
  supersededByProposalId: null,
  approvedAlternativeRouteId: null,
  createdAt: "2026-08-04T15:30:45+07:00",
  updatedAt: "2026-08-04T15:30:45+07:00",
};

const pagedResult = {
  items: [proposal],
  page: 1,
  pageSize: 50,
  totalItems: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

describe("RouteETA proposal review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOperatorRouteChangeProposals).mockResolvedValue(pagedResult);
    vi.mocked(getOperatorRouteChangeProposal).mockResolvedValue(proposal);
  });

  it("closes the modal and reloads the list when approve hits a stale proposal", async () => {
    vi.mocked(approveOperatorRouteChangeProposal).mockRejectedValue(
      new ApiRequestError(
        "Source route changed",
        409,
        "ROUTE_CHANGE_PROPOSAL_STALE",
      ),
    );

    render(<RouteETAPage />);
    await screen.findByText("Đường tránh QL20");

    fireEvent.click(screen.getByRole("button", { name: "routeEta.review" }));
    await waitFor(() =>
      expect(getOperatorRouteChangeProposal).toHaveBeenCalledWith("proposal-1"),
    );

    fireEvent.click(screen.getByRole("button", { name: "routeEta.approve" }));

    await waitFor(() =>
      expect(
        screen.getByText("routeEta.proposalNoLongerPending"),
      ).toBeInTheDocument(),
    );
    expect(getOperatorRouteChangeProposals).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByRole("button", { name: "routeEta.approve" }),
    ).not.toBeInTheDocument();
  });

  it("shows the system resolution for terminal proposals", async () => {
    const superseded: RouteChangeProposal = {
      ...proposal,
      status: "SUPERSEDED",
      resolutionCode: "ANOTHER_PROPOSAL_APPROVED",
      decidedAt: "2026-08-04T16:00:00+07:00",
    };
    vi.mocked(getOperatorRouteChangeProposals).mockResolvedValue({
      ...pagedResult,
      items: [superseded],
    });
    vi.mocked(getOperatorRouteChangeProposal).mockResolvedValue(superseded);

    render(<RouteETAPage />);
    await screen.findByText("Đường tránh QL20");

    fireEvent.click(screen.getByText("Đường tránh QL20"));

    await waitFor(() =>
      expect(
        screen.getByText("routeEta.resolution.ANOTHER_PROPOSAL_APPROVED"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("routeEta.decidedAt")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "routeEta.approve" }),
    ).not.toBeInTheDocument();
  });
});
