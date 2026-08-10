import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  batchUpdateOperatorParcelRouteFares,
  getOperatorParcelReportSummary,
  getOperatorParcelRouteFares,
  getOperatorRoutes,
  type OperatorRoute,
  type ParcelRouteFare,
} from "../../../api/vietride";
import ParcelsList from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../auth", () => ({
  getAuthUser: () => ({ role: "OPERATOR_ADMIN" }),
}));

vi.mock("../../../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

vi.mock("./ParcelQueue", () => ({ default: () => null }));

vi.mock("../../../components/Modal", () => ({
  default: ({
    open,
    title,
    children,
    footer,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
    footer: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
        {footer}
      </div>
    ) : null,
}));

vi.mock("../../../components/CustomDateTimeInput", () => ({
  default: ({
    value,
    disabled,
    onChange,
  }: {
    value: string;
    disabled?: boolean;
    onChange: (event: { target: { value: string } }) => void;
  }) => (
    <input
      value={value}
      disabled={disabled}
      onChange={(event) => onChange({ target: { value: event.target.value } })}
    />
  ),
}));

vi.mock("../../../components/CurrencyInput", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (event: { target: { value: string } }) => void;
  }) => (
    <input
      value={value}
      onChange={(event) => onChange({ target: { value: event.target.value } })}
    />
  ),
}));

vi.mock("../../../api/vietride", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../api/vietride")>();
  return {
    ...original,
    batchUpdateOperatorParcelRouteFares: vi.fn(),
    getOperatorParcelReportSummary: vi.fn(),
    getOperatorParcelRouteFares: vi.fn(),
    getOperatorRoutes: vi.fn(),
    updateOperatorParcelRouteFare: vi.fn(),
  };
});

const route = {
  id: "route-1",
  operatorId: "operator-1",
  name: "Cần Thơ - Hồ Chí Minh",
  originStationId: "origin-1",
  destinationStationId: "destination-1",
  baseFare: 150_000,
  totalDistanceKm: 170,
  estimatedDurationMinutes: 210,
  isActive: true,
} satisfies OperatorRoute;

const categories = ["SMALL", "MEDIUM", "LARGE", "EXTRA_LARGE"] as const;
const fares: ParcelRouteFare[] = categories.map((sizeCategory, index) => ({
  routeId: route.id,
  operatorId: route.operatorId,
  sizeCategory,
  priceVnd: (index + 1) * 10_000,
  effectiveFrom: "2026-08-01T00:00:00Z",
  effectiveUntil: "2026-08-31T23:59:59Z",
}));

describe("parcel route fare workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOperatorParcelReportSummary).mockResolvedValue({
      operatorId: "operator-1",
      totalParcels: 0,
      totalLoaded: 0,
      totalDelivered: 0,
      totalRejected: 0,
      totalReturned: 0,
      grossParcelRevenueVnd: 0,
      parcelRefundsVnd: 0,
    });
    vi.mocked(getOperatorParcelRouteFares).mockResolvedValue({
      items: fares,
      page: 1,
      pageSize: 100,
      totalItems: fares.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(getOperatorRoutes).mockResolvedValue({
      items: [route],
      page: 1,
      pageSize: 8,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(batchUpdateOperatorParcelRouteFares).mockResolvedValue({
      routeId: route.id,
      items: fares.map((fare) => ({
        sizeCategory: fare.sizeCategory,
        priceVnd: fare.priceVnd,
        effectiveFrom: fare.effectiveFrom,
        effectiveUntil: fare.effectiveUntil ?? null,
        created: false,
      })),
    });
  });

  it("renders the fare edit button in the actions column", async () => {
    render(<ParcelsList />);

    expect(
      await screen.findByRole("columnheader", { name: "actions" }),
    ).toBeInTheDocument();
    const editButtons = await screen.findAllByRole("button", {
      name: "parcels.editFare",
    });
    const row = editButtons[0].closest("tr");
    expect(row).not.toBeNull();

    const cells = within(row as HTMLTableRowElement).getAllByRole("cell");
    expect(cells).toHaveLength(6);
    expect(
      within(cells[0]).queryByRole("button", { name: "parcels.editFare" }),
    ).not.toBeInTheDocument();
    expect(
      within(cells[5]).getByRole("button", { name: "parcels.editFare" }),
    ).toBe(editButtons[0]);
  });


  it("prefills and safely updates an existing active fare window", async () => {
    const user = userEvent.setup();
    render(<ParcelsList />);

    await user.click(
      await screen.findByRole("button", { name: "parcels.createFare" }),
    );
    await user.click(screen.getByRole("combobox", { name: "parcels.route" }));
    await user.click(
      await screen.findByRole("option", { name: /Cần Thơ - Hồ Chí Minh/ }),
    );

    expect(
      screen.getByText("parcels.routeFareNoticeTitles.ACTIVE"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "parcels.sizeCategories.SMALL" }),
    ).toHaveValue("10000");

    await user.click(
      screen.getByRole("button", { name: "parcels.fareBatchActions.UPDATE" }),
    );

    await waitFor(() =>
      expect(batchUpdateOperatorParcelRouteFares).toHaveBeenCalledWith(
        route.id,
        {
          effectiveFrom: "2026-08-01T00:00:00.000Z",
          effectiveUntil: "2026-08-31T23:59:59.000Z",
          items: [
            { sizeCategory: "SMALL", priceVnd: 10_000 },
            { sizeCategory: "MEDIUM", priceVnd: 20_000 },
            { sizeCategory: "LARGE", priceVnd: 30_000 },
            { sizeCategory: "EXTRA_LARGE", priceVnd: 40_000 },
          ],
        },
      ),
    );
  });
});
