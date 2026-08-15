import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../../api/client";
import {
  getOperatorIncident,
  getOperatorIncidents,
  resolveOperatorIncident,
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
    resolveOperatorIncident: vi.fn(),
  };
});

// Quyền đóng sự cố phụ thuộc role nên test đổi giá trị này giữa các case
let currentRole = "OPERATOR_ADMIN";
vi.mock("../../../auth", () => ({
  getAuthUser: () => ({ role: currentRole }),
}));

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

const resolvedIncident: OperatorIncident = {
  ...incident,
  status: "RESOLVED",
  resolvedAt: "2026-08-10T11:00:00Z",
  resolvedByUserId: "admin-1",
  resolutionNote: "Đã điều xe thay thế",
};

describe("Manager Incidents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRole = "OPERATOR_ADMIN";
    vi.mocked(getOperatorIncidents).mockResolvedValue(pageOf([incident]));
    vi.mocked(getOperatorIncident).mockResolvedValue(incident);
    vi.mocked(resolveOperatorIncident).mockResolvedValue(resolvedIncident);
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
      expect(getOperatorIncidents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 10,
          category: "VEHICLE_BREAKDOWN",
        }),
      ),
    );
  });

  it("deep-link ?tripId= thì lọc theo chuyến đó", async () => {
    renderPage("/manager/incidents?tripId=trip-1");

    await waitFor(() =>
      expect(getOperatorIncidents).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 10,
          tripId: "trip-1",
        }),
      ),
    );
    expect(screen.getByText("incidents.filteredByTrip")).toBeInTheDocument();
  });

  it("mở chi tiết và tải bản đầy đủ từ endpoint detail", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");

    await user.click(screen.getByRole("button", { name: /details/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Xe gặp sự cố động cơ")).toBeInTheDocument();
    await waitFor(() =>
      expect(getOperatorIncident).toHaveBeenCalledWith("incident-1"),
    );
  });

  it("OPERATOR_ADMIN đóng sự cố với ghi chú đã trim", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");
    await user.click(screen.getByRole("button", { name: /details/ }));

    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox"),
      "  Đã điều xe thay thế  ",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "incidents.resolveAction" }),
    );

    await waitFor(() =>
      expect(resolveOperatorIncident).toHaveBeenCalledWith("incident-1", {
        resolutionNote: "Đã điều xe thay thế",
      }),
    );
    // Danh sách và modal dùng đúng object BE trả về
    expect(
      await within(dialog).findByText("incidents.statuses.RESOLVED"),
    ).toBeInTheDocument();
  });

  it("chặn ghi chú rỗng trước khi gọi BE", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");
    await user.click(screen.getByRole("button", { name: /details/ }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "   ");
    await user.click(
      within(dialog).getByRole("button", { name: "incidents.resolveAction" }),
    );

    expect(
      within(dialog).getByText("incidents.resolveNoteRequired"),
    ).toBeInTheDocument();
    expect(resolveOperatorIncident).not.toHaveBeenCalled();
  });

  it("409 INCIDENT_ALREADY_RESOLVED thì tải lại chi tiết", async () => {
    vi.mocked(resolveOperatorIncident).mockRejectedValue(
      new ApiRequestError(
        "Incident already resolved",
        409,
        "INCIDENT_ALREADY_RESOLVED",
      ),
    );
    // Lần mở đầu vẫn OPEN; lần tải lại sau 409 mới thấy bản đã đóng
    vi.mocked(getOperatorIncident)
      .mockResolvedValueOnce(incident)
      .mockResolvedValueOnce(resolvedIncident);

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");
    await user.click(screen.getByRole("button", { name: /details/ }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "Đã xử lý");
    await user.click(
      within(dialog).getByRole("button", { name: "incidents.resolveAction" }),
    );

    // Sau 409 màn tải lại chi tiết và hiện bản đã đóng của admin kia
    await waitFor(() =>
      expect(getOperatorIncident).toHaveBeenCalledTimes(2),
    );
    expect(
      await within(dialog).findByText("incidents.statuses.RESOLVED"),
    ).toBeInTheDocument();
  });

  it("OPERATOR_STAFF không thấy form đóng sự cố", async () => {
    currentRole = "OPERATOR_STAFF";
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");
    await user.click(screen.getByRole("button", { name: /details/ }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("incidents.resolveStaffHint"),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", {
        name: "incidents.resolveAction",
      }),
    ).not.toBeInTheDocument();
  });


  it("mở chi tiết an toàn khi BE trả photoUrls null", async () => {
    const incidentWithoutPhotos: OperatorIncident = {
      ...incident,
      photoUrls: null,
    };
    vi.mocked(getOperatorIncidents).mockResolvedValue(
      pageOf([incidentWithoutPhotos]),
    );
    vi.mocked(getOperatorIncident).mockResolvedValue(incidentWithoutPhotos);

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");

    await user.click(screen.getByRole("button", { name: /details/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Xe gặp sự cố động cơ")).toBeInTheDocument();
    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
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
