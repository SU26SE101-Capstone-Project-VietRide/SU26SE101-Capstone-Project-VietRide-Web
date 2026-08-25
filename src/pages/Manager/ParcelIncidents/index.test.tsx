import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assignOperatorParcelIncident,
  getOperatorParcelIncident,
  getOperatorParcelIncidents,
  getOperatorUsers,
  resolveOperatorParcelIncident,
  type ParcelIncidentDetail,
  type ParcelIncidentListItem,
} from "../../../api/vietride";
import ParcelIncidentsPage from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values && !("defaultValue" in values)
        ? `${key} ${Object.values(values).join(" ")}`
        : key,
  }),
}));

vi.mock("../../../api/vietride", () => ({
  assignOperatorParcelIncident: vi.fn(),
  declareOperatorParcelIncidentLost: vi.fn(),
  forwardOperatorParcelIncident: vi.fn(),
  getOperatorParcelIncident: vi.fn(),
  getOperatorParcelIncidentForwardingOptions: vi.fn(),
  getOperatorParcelIncidents: vi.fn(),
  getOperatorUsers: vi.fn(),
  markOperatorParcelIncidentFound: vi.fn(),
  recordOperatorParcelIncidentSearch: vi.fn(),
  resolveOperatorParcelIncident: vi.fn(),
  PARCEL_INCIDENT_STATUSES: ["OPEN", "SEARCHING", "FOUND"],
  PARCEL_INCIDENT_TYPES: ["MISSING", "WRONG_STOP"],
  PARCEL_CUSTODY_LOCATION_TYPES: ["WAREHOUSE", "VEHICLE"],
  SLA_STATES: ["ON_TRACK", "DUE_SOON", "BREACHED", "CLOSED"],
}));

vi.mock("../../../hooks/useToastFeedback", () => ({
  useToastFeedback: vi.fn(),
}));

const incident: ParcelIncidentListItem = {
  incidentId: "36000000-0000-4000-8000-000000000101",
  parcelId: "36000000-0000-4000-8000-000000000201",
  operatorId: "36000000-0000-4000-8000-000000000301",
  type: "WRONG_STOP",
  status: "SEARCHING",
  tripId: "36000000-0000-4000-8000-000000000401",
  lastKnownLocation: "Bến B",
  searchDeadline: "2026-08-24T10:00:00+07:00",
  createdAt: "2026-08-21T10:00:00+07:00",
  operatorProcessBreach: true,
  parcel: {
    parcelId: "36000000-0000-4000-8000-000000000201",
    parcelCode: "VR-PCL-20260821-ABCD2345",
    status: "PENDING_OPERATOR_ACTION",
    description: "Thùng điện tử",
    photoUrl: null,
    quantity: 1,
    declaredValueVnd: 12000000,
  },
  trip: {
    tripId: "36000000-0000-4000-8000-000000000401",
    status: "IN_PROGRESS",
    departureAt: "2026-08-21T08:00:00+07:00",
    eta: "2026-08-21T14:00:00+07:00",
    route: {
      routeId: "route-1",
      name: "Sài Gòn - Đà Lạt",
      origin: {},
      destination: {},
    },
    vehicle: { vehicleId: "vehicle-1", licensePlate: "51B-123.45" },
    stops: [],
  },
  expectedDropoff: { type: "ROUTE_STOP", name: "Bến C" },
  lastCustody: {
    lastEventType: "HANDOFF",
    lastConfirmedLocation: { type: "ROUTE_STOP", name: "Bến B" },
    lastConfirmedAt: "2026-08-21T10:05:00+07:00",
    trackingConfidence: "CONFIRMED_SCAN",
    hasTrackingGap: true,
  },
  reporter: { userId: "user-1", displayName: "Nguyễn A", phone: "0900000000" },
  taskSummary: { completed: 1, total: 7, assignees: [] },
  claimSummary: null,
  sla: {
    deadline: "2026-08-24T10:00:00+07:00",
    remainingMinutes: 135,
    state: "ON_TRACK",
  },
  availableActions: ["ASSIGN", "RECORD_SEARCH", "MARK_FOUND"],
};

const detail: ParcelIncidentDetail = {
  incident,
  searchTasks: [
    {
      taskId: "36000000-0000-4000-8000-000000000111",
      incidentId: incident.incidentId,
      taskType: "VEHICLE_SEARCH",
      status: "OPEN",
      location: "Xe 51B-123.45",
      deadline: "2026-08-22T10:00:00+07:00",
    },
  ],
  custodyTimeline: {
    items: [
      {
        eventId: "event-9",
        eventType: "HANDOFF",
        actorRole: "DRIVER",
        occurredAt: "2026-08-21T10:05:00+07:00",
        recordedAt: "2026-08-21T10:05:10+07:00",
        source: "DRIVER_APP",
        evidenceReferences: [],
        sequence: 9,
      },
    ],
    nextCursor: 9,
  },
  parcel: incident.parcel,
  sender: { userId: "user-2", displayName: "Trần B", phone: "0900000001" },
  recipient: { userId: null, displayName: "Lê C", phone: "0900000002" },
  trip: incident.trip,
  expectedDropoff: incident.expectedDropoff,
  reporter: incident.reporter,
  availableActions: ["ASSIGN", "RECORD_SEARCH", "MARK_FOUND"],
};

describe("Manager parcel incidents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOperatorParcelIncidents).mockResolvedValue({
      items: [incident],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.mocked(getOperatorParcelIncident).mockResolvedValue(detail);
    vi.mocked(getOperatorUsers).mockResolvedValue({
      items: [
        {
          userId: "36000000-0000-4000-8000-000000000901",
          email: "staff@operator.vn",
          displayName: "Phạm D",
          role: "OPERATOR_STAFF",
          status: "ACTIVE",
          operatorId: incident.operatorId,
        },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it("dựng cả trang từ MỘT lượt gọi danh sách, không gọi detail cho từng dòng", async () => {
    render(<ParcelIncidentsPage />);

    // Dữ liệu enrich sẵn trong list: mã kiện, tuyến, xe, vị trí xác nhận
    expect(await screen.findByText("VR-PCL-20260821-ABCD2345")).toBeInTheDocument();
    expect(screen.getByText("Sài Gòn - Đà Lạt")).toBeInTheDocument();
    expect(screen.getByText("51B-123.45")).toBeInTheDocument();
    expect(screen.getByText("Bến B")).toBeInTheDocument();
    // §11.4: không N+1 detail cho mỗi row
    expect(getOperatorParcelIncident).not.toHaveBeenCalled();
  });

  it("cảnh báo vi phạm quy trình và đứt mạch scan ngay trên hàng đợi", async () => {
    render(<ParcelIncidentsPage />);

    expect(
      await screen.findByText("parcelIncidents.processBreach"),
    ).toBeInTheDocument();
    expect(screen.getByText("parcelIncidents.trackingGap")).toBeInTheDocument();
  });

  it("chỉ hiện nút theo availableActions của backend", async () => {
    const user = userEvent.setup();
    render(<ParcelIncidentsPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: "parcelIncidents.actions.ASSIGN" }),
    ).toBeInTheDocument();
    // BE không trả RESOLVE/DECLARE_LOST/FORWARD → màn không được tự bày ra
    expect(
      within(dialog).queryByRole("button", {
        name: "parcelIncidents.actions.RESOLVE",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", {
        name: "parcelIncidents.actions.DECLARE_LOST",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", {
        name: "parcelIncidents.actions.FORWARD",
      }),
    ).not.toBeInTheDocument();
    expect(resolveOperatorParcelIncident).not.toHaveBeenCalled();
  });

  it("chặn giao nhiệm vụ khi chưa chọn người, không gọi API", async () => {
    const user = userEvent.setup();
    render(<ParcelIncidentsPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "parcelIncidents.actions.ASSIGN" }),
    );

    const dialogs = await screen.findAllByRole("dialog");
    const assignDialog = dialogs[dialogs.length - 1];
    await user.click(
      within(assignDialog).getByRole("button", {
        name: "parcelIncidents.actions.ASSIGN",
      }),
    );

    // §6.3: `Guid.Empty` chưa có guard ở BE nên FE phải chặn trước
    expect(
      await within(assignDialog).findByText("parcelIncidents.assigneeRequired"),
    ).toBeInTheDocument();
    expect(assignOperatorParcelIncident).not.toHaveBeenCalled();
  });

  it("thay chi tiết bằng kết quả mutation trả về, không gọi lại detail", async () => {
    const user = userEvent.setup();
    const updated: ParcelIncidentDetail = {
      ...detail,
      incident: { ...incident, status: "FOUND" },
      availableActions: ["RESOLVE"],
    };
    vi.mocked(assignOperatorParcelIncident).mockResolvedValue(updated);

    render(<ParcelIncidentsPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "parcelIncidents.actions.ASSIGN" }),
    );

    const dialogs = await screen.findAllByRole("dialog");
    const assignDialog = dialogs[dialogs.length - 1];
    // CustomSelect là listbox tuỳ biến: mở bằng button rồi chọn option
    await user.click(
      await within(assignDialog).findByRole("button", {
        name: "parcelIncidents.assigneeLabel",
      }),
    );
    await user.click(screen.getByRole("option", { name: /Phạm D/ }));
    await user.click(
      within(assignDialog).getByRole("button", {
        name: "parcelIncidents.actions.ASSIGN",
      }),
    );

    // §11.1 mục 4: mutation trả detail mới → thay thẳng, KHÔNG refetch detail
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "parcelIncidents.actions.RESOLVE" }),
      ).toBeInTheDocument(),
    );
    expect(getOperatorParcelIncident).toHaveBeenCalledTimes(1);
  });
});
