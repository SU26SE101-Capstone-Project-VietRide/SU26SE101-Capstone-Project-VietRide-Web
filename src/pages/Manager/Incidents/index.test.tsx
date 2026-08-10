import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperatorIncident,
  getOperatorIncidents,
  type OperatorIncident,
} from "../../../api/vietride";
import ManagerIncidents from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values && !("defaultValue" in values)
        ? `${key} ${Object.values(values).join(" ")}`
        : key,
  }),
}));

vi.mock("../../../api/vietride", async () => {
  const actual =
    await vi.importActual<typeof import("../../../api/vietride")>(
      "../../../api/vietride",
    );
  return {
    INCIDENT_CATEGORIES: actual.INCIDENT_CATEGORIES,
    getOperatorIncident: vi.fn(),
    getOperatorIncidents: vi.fn(),
  };
});

const incident: OperatorIncident = {
  incidentId: "incident-1",
  category: "VEHICLE_BREAKDOWN",
  description: "Xe gặp sự cố động cơ",
  photoUrls: [],
  latitude: 10.351,
  longitude: 107.084,
  reportedAt: "2026-08-10T10:00:00Z",
  status: "OPEN",
  resolvedAt: null,
  resolvedByUserId: null,
  resolutionNote: null,
  trip: {
    tripId: "trip-1",
    status: "IN_PROGRESS",
    departureDateTime: "2026-08-10T08:00:00Z",
    route: {
      routeId: "route-1",
      name: "TP.HCM - Hà Nội",
      originStation: { stationId: "station-1", name: "Bến xe Miền Đông" },
      destinationStation: { stationId: "station-2", name: "Bến xe đích" },
    },
  },
  reporter: {
    userId: "driver-1",
    displayName: "Nguyễn Văn Tài",
    role: "DRIVER",
  },
};

function pageOf(items: OperatorIncident[]) {
  return {
    items,
    page: 1,
    pageSize: 20,
    totalItems: items.length,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

function renderPage(entry = "/manager/incidents") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ManagerIncidents />
    </MemoryRouter>,
  );
}

describe("Manager Incidents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOperatorIncidents).mockResolvedValue(pageOf([incident]));
    vi.mocked(getOperatorIncident).mockResolvedValue(incident);
  });

  it("hiển thị sự cố kèm loại, trạng thái và người báo", async () => {
    renderPage();

    expect(await screen.findByText("TP.HCM - Hà Nội")).toBeInTheDocument();
    expect(
      screen.getByText("incidents.categories.VEHICLE_BREAKDOWN"),
    ).toBeInTheDocument();
    expect(screen.getByText("incidents.statuses.OPEN")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn Tài")).toBeInTheDocument();
  });

  it("gửi filter dạng chuỗi enum, không gửi số", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");

    await user.click(screen.getByRole("button", { name: "incidents.category" }));
    await user.click(
      screen.getByRole("option", {
        name: "incidents.categories.VEHICLE_BREAKDOWN",
      }),
    );

    await waitFor(() =>
      expect(getOperatorIncidents).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 20,
        category: "VEHICLE_BREAKDOWN",
      }),
    );
  });

  it("deep-link ?tripId= thì lọc theo chuyến đó", async () => {
    renderPage("/manager/incidents?tripId=trip-1");

    await waitFor(() =>
      expect(getOperatorIncidents).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        tripId: "trip-1",
      }),
    );
    expect(screen.getByText("incidents.filteredByTrip")).toBeInTheDocument();
  });

  it("mở chi tiết và KHÔNG dựng nút đánh dấu đã xử lý", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");

    await user.click(screen.getByRole("button", { name: /details/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Xe gặp sự cố động cơ")).toBeInTheDocument();
    await waitFor(() =>
      expect(getOperatorIncident).toHaveBeenCalledWith("incident-1"),
    );
    // BE chưa có API resolve — màn không được có nút đánh dấu đã xử lý
    expect(
      within(dialog).queryByRole("button", { name: /resolve/i }),
    ).not.toBeInTheDocument();
  });

  it("báo lỗi khi tải danh sách thất bại", async () => {
    vi.mocked(getOperatorIncidents).mockRejectedValue(
      new Error("Không có quyền"),
    );
    renderPage();

    expect(await screen.findByText("incidents.empty")).toBeInTheDocument();
  });

  it("chịu được reporter thiếu displayName/role", async () => {
    vi.mocked(getOperatorIncidents).mockResolvedValue(
      pageOf([
        {
          ...incident,
          reporter: { userId: "driver-1", displayName: null, role: null },
        },
      ]),
    );
    renderPage();

    expect(
      await screen.findByText("incidents.unknownReporter"),
    ).toBeInTheDocument();
  });
});
