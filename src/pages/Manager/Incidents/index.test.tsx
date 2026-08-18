import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../../api/client";
import {
  getOperatorIncident,
  getOperatorIncidents,
  getOperatorUsers,
  getOperatorVehicles,
  getPublicTrip,
  resolveOperatorIncident,
  disruptOperatorTripNoSubstitution,
  type OperatorIncident,
  type OperatorUser,
  type OperatorVehicle,
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
    // Khối xử lý chuyến trong modal: xe/nhân sự cho form thay xe, và chuyến công
    // khai để biết xe nào đang chạy mà loại khỏi danh sách xe thay thế.
    getOperatorVehicles: vi.fn(),
    getOperatorUsers: vi.fn(),
    getPublicTrip: vi.fn(),
    getAlternativeRoutes: vi.fn(),
    getOperatorTripCargoCapacity: vi.fn(),
    substituteOperatorTripVehicle: vi.fn(),
    disruptOperatorTripNoSubstitution: vi.fn(),
    changeOperatorTripRoute: vi.fn(),
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

function pageOf<T>(items: T[]) {
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

// Bộ lọc và sự cố đang mở nằm trên URL — probe này để khẳng định chúng thật sự
// được ghi ra, vì đó mới là thứ sống sót qua một lượt rời màn rồi back về.
function LocationProbe() {
  return <span data-testid="location-search">{useLocation().search}</span>;
}

function renderPage(entry = "/manager/incidents") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ManagerIncidents />
      <LocationProbe />
    </MemoryRouter>,
  );
}

// Xe đang chạy chuyến gặp sự cố phải bị loại khỏi danh sách xe thay thế — id của
// nó chỉ lấy được qua `GET /v1/trips/{id}` vì `GET /v1/operator/trips` không lọc
// theo tripId.
const brokenVehicle = {
  id: "vehicle-broken",
  operatorId: "operator-1",
  licensePlate: "51B-000.00",
  vehicleTypeId: "type-1",
  totalSeats: 40,
  maxCargoWeightKg: 500,
  maxCargoVolumeM3: 5,
  status: "ACTIVE",
} as OperatorVehicle;

const spareVehicle = {
  ...brokenVehicle,
  id: "vehicle-spare",
  licensePlate: "51B-999.99",
} as OperatorVehicle;

const spareDriver = {
  userId: "driver-2",
  email: "driver2@operator.vn",
  displayName: "Trần Văn Rảnh",
  role: "DRIVER",
  status: "ACTIVE",
  operatorId: "operator-1",
} as OperatorUser;

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
    vi.mocked(getOperatorVehicles).mockResolvedValue(
      pageOf([brokenVehicle, spareVehicle]),
    );
    vi.mocked(getOperatorUsers).mockResolvedValue(pageOf([spareDriver]));
    vi.mocked(disruptOperatorTripNoSubstitution).mockResolvedValue({
      tripId: "trip-1",
      status: "DISRUPTED",
    });
    vi.mocked(getPublicTrip).mockResolvedValue({
      tripId: "trip-1",
      vehicleId: "vehicle-broken",
    } as unknown as Awaited<ReturnType<typeof getPublicTrip>>);
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
      within(dialog).getByRole("textbox", {
        name: "incidents.resolveNoteLabel",
      }),
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
    await user.type(within(dialog).getByRole("textbox", {
        name: "incidents.resolveNoteLabel",
      }), "   ");
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
    await user.type(within(dialog).getByRole("textbox", {
        name: "incidents.resolveNoteLabel",
      }), "Đã xử lý");
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

  // Ô tìm kiếm cũng là bộ lọc — "Đặt lại" mà bỏ sót nó thì danh sách vẫn bị lọc
  // theo từ khoá cũ trong khi mọi ô khác đã trống.
  it("nút Đặt lại xoá cả từ khoá tìm kiếm", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");

    const searchInput = screen.getByLabelText("incidents.searchLabel");
    await user.type(searchInput, "động cơ");
    await waitFor(() =>
      expect(getOperatorIncidents).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "động cơ" }),
      ),
    );

    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(searchInput).toHaveValue("");
    await waitFor(() => {
      const lastCall = vi.mocked(getOperatorIncidents).mock.calls.at(-1);
      expect(lastCall?.[0]).not.toHaveProperty("search");
    });
  });

  // Vào từ thông báo sự cố là URL có sẵn ?tripId= — phải thoát được bộ lọc đó
  // mà không cần sửa URL bằng tay.
  it("bỏ được bộ lọc theo chuyến của deep-link", async () => {
    const user = userEvent.setup();
    renderPage("/manager/incidents?tripId=trip-1");

    await waitFor(() =>
      expect(getOperatorIncidents).toHaveBeenLastCalledWith(
        expect.objectContaining({ tripId: "trip-1" }),
      ),
    );

    await user.click(
      screen.getByRole("button", { name: "incidents.clearTripFilter" }),
    );

    await waitFor(() => {
      const lastCall = vi.mocked(getOperatorIncidents).mock.calls.at(-1);
      expect(lastCall?.[0]).not.toHaveProperty("tripId");
    });
    expect(screen.queryByText("incidents.filteredByTrip")).not.toBeInTheDocument();
  });

  // Toạ độ điểm báo là nơi tài xế bấm gửi, không phải vị trí hiện tại của xe —
  // bỏ khỏi modal để không ai đọc nhầm thành vị trí xe.
  it("không hiện ô vị trí/bản đồ trong chi tiết sự cố", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");

    await user.click(screen.getByRole("button", { name: /details/ }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("incidents.reporterInfo"),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText("incidents.location"),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText("incidents.openInMaps"),
    ).not.toBeInTheDocument();
  });

  // Sang Trung tâm vận hành xử lý rồi back về: URL phải mang đủ bộ lọc lẫn id sự
  // cố, nếu không người dùng rơi về trang 1 chưa lọc và phải tự mò lại.
  it("khôi phục bộ lọc và trang từ URL khi quay lại màn", async () => {
    renderPage(
      "/manager/incidents?category=ACCIDENT&status=OPEN&search=" +
        encodeURIComponent("động cơ") +
        "&page=2",
    );

    await waitFor(() =>
      expect(getOperatorIncidents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 2,
          category: "ACCIDENT",
          status: "OPEN",
          search: "động cơ",
        }),
      ),
    );
    expect(screen.getByLabelText("incidents.searchLabel")).toHaveValue(
      "động cơ",
    );
  });

  it("đổi bộ lọc thì ghi lên URL và về trang 1", async () => {
    const user = userEvent.setup();
    renderPage("/manager/incidents?page=3");
    await screen.findByText("TP.HCM - Hà Nội");

    await user.click(screen.getByRole("button", { name: "incidents.category" }));
    await user.click(
      screen.getByRole("option", {
        name: "incidents.categories.VEHICLE_BREAKDOWN",
      }),
    );

    await waitFor(() => {
      const search = screen.getByTestId("location-search").textContent ?? "";
      expect(search).toContain("category=VEHICLE_BREAKDOWN");
      expect(search).not.toContain("page=");
    });
  });

  it("?page= rác thì về trang 1 thay vì gửi NaN lên BE", async () => {
    renderPage("/manager/incidents?page=abc");

    await waitFor(() =>
      expect(getOperatorIncidents).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1 }),
      ),
    );
  });

  it("deep-link ?incidentId= mở thẳng chi tiết", async () => {
    renderPage("/manager/incidents?incidentId=incident-1");

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Xe gặp sự cố động cơ")).toBeInTheDocument();
    expect(getOperatorIncident).toHaveBeenCalledWith("incident-1");
  });

  it("mở chi tiết đẩy id lên URL, đóng lại thì xoá đi", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");

    await user.click(screen.getByRole("button", { name: /details/ }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(screen.getByTestId("location-search").textContent).toContain(
        "incidentId=incident-1",
      ),
    );

    // Modal có 3 nút cùng nhãn "close" (nền mờ, dấu X, nút ở chân) — lấy nút chân
    const closeButtons = within(dialog).getAllByRole("button", {
      name: "close",
    });
    await user.click(closeButtons[closeButtons.length - 1]);

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("location-search").textContent).not.toContain(
      "incidentId",
    );
  });

  // Vá tại chỗ thôi thì bản ghi vừa đóng vẫn nằm lại trong danh sách đang lọc
  // `status=OPEN`, và totalItems của phân trang thì lệch mất một.
  it("đóng sự cố xong thì tải lại danh sách cho khớp bộ lọc", async () => {
    const user = userEvent.setup();
    renderPage("/manager/incidents?status=OPEN");
    await screen.findByText("TP.HCM - Hà Nội");
    await waitFor(() => expect(getOperatorIncidents).toHaveBeenCalled());
    const callsBefore = vi.mocked(getOperatorIncidents).mock.calls.length;

    await user.click(screen.getByRole("button", { name: /details/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox", {
        name: "incidents.resolveNoteLabel",
      }), "Đã điều xe thay thế");
    await user.click(
      within(dialog).getByRole("button", { name: "incidents.resolveAction" }),
    );

    await waitFor(() =>
      expect(vi.mocked(getOperatorIncidents).mock.calls.length).toBeGreaterThan(
        callsBefore,
      ),
    );
  });

  // `setSearchParams` đổi identity sau mỗi lần URL đổi — lỡ để nó rò vào deps của
  // effect tải chi tiết thì mỗi thao tác lọc lại bắn thêm một request detail.
  it("đổi bộ lọc khi đang mở chi tiết thì không gọi lại endpoint detail", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");

    await user.click(screen.getByRole("button", { name: /details/ }));
    await screen.findByRole("dialog");
    await waitFor(() => expect(getOperatorIncident).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "incidents.category" }));
    await user.click(
      screen.getByRole("option", {
        name: "incidents.categories.VEHICLE_BREAKDOWN",
      }),
    );

    await waitFor(() =>
      expect(getOperatorIncidents).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: "VEHICLE_BREAKDOWN" }),
      ),
    );
    expect(getOperatorIncident).toHaveBeenCalledTimes(1);
  });

  // Xử lý ngay trong modal: hỏng xe thì thay xe, tắc đường thì đổi lộ trình —
  // không phải nhảy sang Trung tâm vận hành rồi tự mò đường quay lại đóng sự cố.
  it("OPERATOR_ADMIN xử lý được chuyến ngay trong modal sự cố", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");
    await user.click(screen.getByRole("button", { name: /details/ }));

    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByRole("button", {
        name: "tripOperations.substitute",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "tripOperations.changeRoute" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "tripOperations.disrupt" }),
    ).toBeInTheDocument();
  });

  it("OPERATOR_STAFF không thấy khối xử lý chuyến", async () => {
    currentRole = "OPERATOR_STAFF";
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");
    await user.click(screen.getByRole("button", { name: /details/ }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByRole("button", {
        name: "tripOperations.substitute",
      }),
    ).not.toBeInTheDocument();
    // Staff không mở form thay xe thì cũng đừng kéo về xe/nhân sự của cả nhà xe
    expect(getOperatorVehicles).not.toHaveBeenCalled();
  });

  it("sự cố đã xử lý thì không còn khối xử lý chuyến", async () => {
    vi.mocked(getOperatorIncidents).mockResolvedValue(pageOf([resolvedIncident]));
    vi.mocked(getOperatorIncident).mockResolvedValue(resolvedIncident);

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");
    await user.click(screen.getByRole("button", { name: /details/ }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByRole("button", {
        name: "tripOperations.substitute",
      }),
    ).not.toBeInTheDocument();
  });

  // Chỉ xem danh sách thì không việc gì phải kéo về toàn bộ xe và nhân sự
  it("chưa mở sự cố nào thì chưa nạp xe/nhân sự", async () => {
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");

    expect(getOperatorVehicles).not.toHaveBeenCalled();
    expect(getOperatorUsers).not.toHaveBeenCalled();
  });

  it("loại xe đang chạy chuyến khỏi danh sách xe thay thế", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");
    await user.click(screen.getByRole("button", { name: /details/ }));

    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(getPublicTrip).toHaveBeenCalledWith("trip-1"),
    );

    await user.click(
      within(dialog).getByRole("button", { name: "tripOperations.vehicle" }),
    );
    expect(
      await screen.findByRole("option", { name: "51B-999.99" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "51B-000.00" }),
    ).not.toBeInTheDocument();
  });

  // Xử lý chuyến KHÔNG tự đóng sự cố — chỉ điền sẵn câu tổng kết để bấm xác nhận,
  // và làm mới danh sách vì trạng thái chuyến vừa đổi.
  it("xử lý chuyến xong thì điền sẵn ghi chú và làm mới danh sách", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("TP.HCM - Hà Nội");
    await user.click(screen.getByRole("button", { name: /details/ }));

    const dialog = await screen.findByRole("dialog");
    const note = within(dialog).getByRole("textbox", {
      name: "incidents.resolveNoteLabel",
    });
    expect(note).toHaveValue("");

    await user.type(
      within(dialog).getByLabelText("tripOperations.reason"),
      "Xe hỏng giữa đường",
    );
    const callsBefore = vi.mocked(getOperatorIncidents).mock.calls.length;
    await user.click(
      within(dialog).getByRole("button", { name: "tripOperations.disrupt" }),
    );
    await user.click(screen.getByRole("button", { name: "confirm" }));

    await waitFor(() =>
      expect(disruptOperatorTripNoSubstitution).toHaveBeenCalledWith("trip-1", {
        reason: "Xe hỏng giữa đường",
      }),
    );

    // Sự cố vẫn OPEN, chỉ ghi chú được điền sẵn
    await waitFor(() =>
      expect(note).toHaveValue("tripOperations.disruptSuccess DISRUPTED"),
    );
    expect(resolveOperatorIncident).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(vi.mocked(getOperatorIncidents).mock.calls.length).toBeGreaterThan(
        callsBefore,
      ),
    );
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
