import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../../api/client";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import {
  approveOperatorRouteChangeProposal,
  getOperatorRouteChangeProposal,
  getOperatorRouteChangeProposals,
  getTrackingTripRouteGeometry,
  type RouteChangeProposal,
} from "../../../api/vietride";
import ProposalsPanel from "./ProposalsPanel";

vi.mock("react-i18next", () => {
  const translate = (key: string) => key;

  return {
    useTranslation: () => ({ t: translate }),
  };
});

vi.mock("../../../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

vi.mock("../../../components/GoogleMapCanvas", () => ({
  default: () => <div data-testid="comparison-map" />,
}));

vi.mock("../../../api/vietride", () => ({
  approveOperatorRouteChangeProposal: vi.fn(),
  getOperatorRouteChangeProposal: vi.fn(),
  getOperatorRouteChangeProposals: vi.fn(),
  getTrackingTripRouteGeometry: vi.fn(),
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

function renderPanel(overrides?: {
  onClose?: () => void;
  onViewTrip?: (tripId: string) => void;
  onProposalsChanged?: () => void;
}) {
  return render(
    <ProposalsPanel
      onClose={overrides?.onClose ?? vi.fn()}
      onViewTrip={overrides?.onViewTrip ?? vi.fn()}
      onProposalsChanged={overrides?.onProposalsChanged}
    />,
  );
}

describe("Operations ProposalsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOperatorRouteChangeProposals).mockResolvedValue(pagedResult);
    vi.mocked(getOperatorRouteChangeProposal).mockResolvedValue(proposal);
    vi.mocked(getTrackingTripRouteGeometry).mockResolvedValue({
      tripId: "trip-1",
      points: [],
    });
  });

  it("tải danh sách PENDING mặc định và duyệt gọi đúng API", async () => {
    vi.mocked(approveOperatorRouteChangeProposal).mockResolvedValue({
      proposal: { ...proposal, status: "APPROVED" },
      routeChange: {} as never,
    });
    const onProposalsChanged = vi.fn();
    renderPanel({ onProposalsChanged });

    await screen.findByText("Đường tránh QL20");
    expect(getOperatorRouteChangeProposals).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      status: "PENDING",
    });

    fireEvent.click(screen.getByRole("button", { name: "routeEta.review" }));
    await waitFor(() =>
      expect(getOperatorRouteChangeProposal).toHaveBeenCalledWith("proposal-1"),
    );

    fireEvent.click(screen.getByRole("button", { name: "routeEta.approve" }));

    await waitFor(() =>
      expect(useToastFeedback).toHaveBeenLastCalledWith({
        message: "routeEta.approvedMessage",
        error: "",
      }),
    );
    expect(approveOperatorRouteChangeProposal).toHaveBeenCalledWith("proposal-1");
    // Sau duyệt thành công: tải lại danh sách + báo index cập nhật badge count
    expect(getOperatorRouteChangeProposals).toHaveBeenCalledTimes(2);
    expect(onProposalsChanged).toHaveBeenCalled();
  });

  it("closes the modal and reloads the list when approve hits a stale proposal", async () => {
    vi.mocked(approveOperatorRouteChangeProposal).mockRejectedValue(
      new ApiRequestError(
        "Source route changed",
        409,
        "ROUTE_CHANGE_PROPOSAL_STALE",
      ),
    );

    renderPanel();
    await screen.findByText("Đường tránh QL20");

    fireEvent.click(screen.getByRole("button", { name: "routeEta.review" }));
    await waitFor(() =>
      expect(getOperatorRouteChangeProposal).toHaveBeenCalledWith("proposal-1"),
    );

    fireEvent.click(screen.getByRole("button", { name: "routeEta.approve" }));

    await waitFor(() =>
      expect(useToastFeedback).toHaveBeenLastCalledWith({
        message: "routeEta.proposalNoLongerPending",
        error: "",
      }),
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

    renderPanel();
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

  it("nút Xem trên bản đồ gọi onViewTrip với tripId của đề xuất", async () => {
    const onViewTrip = vi.fn();
    renderPanel({ onViewTrip });

    await screen.findByText("Đường tránh QL20");

    fireEvent.click(
      screen.getByRole("button", { name: /operations\.viewOnMap/ }),
    );
    expect(onViewTrip).toHaveBeenCalledWith("trip-1");
  });
});
