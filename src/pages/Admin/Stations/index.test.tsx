import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAdminLocations,
  getAdminStations,
  mergeAdminStations,
  updateAdminStation,
  type AdminStation,
} from "../../../api/vietride";
import AdminStations from "./index";

vi.mock("react-i18next", () => {
  const translate = (key: string) => key;
  return {
    useTranslation: () => ({ t: translate }),
  };
});

vi.mock("../../../components/PlacePicker", () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
}));

vi.mock("../../../api/vietride", () => ({
  getAdminLocations: vi.fn(),
  getAdminStations: vi.fn(),
  mergeAdminStations: vi.fn(),
  updateAdminStation: vi.fn(),
}));

const station: AdminStation = {
  id: "station-1",
  name: "Bến xe Miền Đông",
  slug: "ben-xe-mien-dong",
  addressStreet: "292 Đinh Bộ Lĩnh",
  locationId: "location-hcm",
  city: "Thủ Đức",
  ward: "Hồ Chí Minh",
  latitude: 10.8142,
  longitude: 106.7108,
  contactPhone: "+84281234567",
  contactEmail: "station@example.test",
  operatingHours: { mon: "06:00-22:00" },
  facilities: ["waiting_room", "parking"],
  supportsShuttle: true,
  isActive: true,
  createdAt: "2026-07-01T03:00:00Z",
  updatedAt: "2026-07-17T03:20:00Z",
};

describe("AdminStations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminStations).mockResolvedValue({
      items: [station],
      page: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(getAdminLocations).mockResolvedValue({
      items: [
        {
          id: "location-hcm",
          code: "HCM",
          name: "Thành phố Hồ Chí Minh",
          type: "MUNICIPALITY",
          sortOrder: 1,
          isActive: true,
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(updateAdminStation).mockResolvedValue(station);
    vi.mocked(mergeAdminStations).mockResolvedValue({
      primaryStation: station,
      duplicateStationId: "station-2",
      relinkedCounts: {
        operatorMappings: 0,
        collapsedOperatorMappings: 0,
        routeOrigins: 0,
        routeDestinations: 0,
        alternativeRoutes: 0,
        shuttleTrips: 0,
        flattenedRedirects: 0,
      },
    });
  });

  it("saves the current backend station fields without the removed legacy address", async () => {
    const user = userEvent.setup();
    render(<AdminStations />);

    const saveButton = await screen.findByRole("button", {
      name: "stations.saveStation",
    });
    expect(screen.getByText("stations.operatingHours")).toBeInTheDocument();
    expect(screen.getByText("stations.facilities")).toBeInTheDocument();

    await user.click(saveButton);

    await waitFor(() =>
      expect(updateAdminStation).toHaveBeenCalledWith("station-1", {
        name: "Bến xe Miền Đông",
        addressStreet: "292 Đinh Bộ Lĩnh",
        locationId: "location-hcm",
        city: "Thủ Đức",
        ward: "Hồ Chí Minh",
        latitude: 10.8142,
        longitude: 106.7108,
        contactPhone: "+84281234567",
        contactEmail: "station@example.test",
        operatingHours: { mon: "06:00-22:00" },
        facilities: ["waiting_room", "parking"],
        supportsShuttle: true,
      }),
    );
  });

  it("adds a common and a custom facility to the backend payload", async () => {
    const user = userEvent.setup();
    render(<AdminStations />);

    const saveButton = await screen.findByRole("button", {
      name: "stations.saveStation",
    });
    await user.click(
      screen.getByRole("checkbox", {
        name: "stations.facilityOptions.wifi",
      }),
    );
    await user.type(
      screen.getByPlaceholderText("stations.customFacilityPlaceholder"),
      "medical_room",
    );
    await user.click(
      screen.getByRole("button", { name: "stations.addFacility" }),
    );
    await user.click(saveButton);

    await waitFor(() =>
      expect(updateAdminStation).toHaveBeenCalledWith(
        "station-1",
        expect.objectContaining({
          facilities: ["waiting_room", "parking", "wifi", "medical_room"],
        }),
      ),
    );
  });
});
