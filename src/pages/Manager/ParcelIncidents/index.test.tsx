import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../../api/client";
import {
  decideOperatorParcelIncidentCustodyException,
  getOperatorParcelIncident,
  getOperatorParcelIncidents,
  getOperatorUsers,
  recordOperatorParcelIncidentSearch,
  resolveOperatorParcelIncident,
  type ParcelCustodyExceptionApproval,
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
  decideOperatorParcelIncidentCustodyException: vi.fn(),
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
  // Bộ lọc sự cố kiện nhận thêm NOT_STARTED so với SLA_STATES
  INCIDENT_SLA_STATES: [
    "NOT_STARTED",
    "ON_TRACK",
    "DUE_SOON",
    "BREACHED",
    "CLOSED",
  ],
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
      within(dialog).getByRole("button", {
        name: "parcelIncidents.actions.MARK_FOUND",
      }),
    ).toBeInTheDocument();
    // ASSIGN bị ẩn có chủ đích: BE vẫn trả về nhưng màn không bày nút nữa
    expect(
      within(dialog).queryByRole("button", {
        name: "parcelIncidents.actions.ASSIGN",
      }),
    ).not.toBeInTheDocument();
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

  it("thay chi tiết bằng kết quả mutation trả về, không gọi lại detail", async () => {
    const user = userEvent.setup();
    const updated: ParcelIncidentDetail = {
      ...detail,
      incident: { ...incident, status: "FOUND" },
      availableActions: ["RESOLVE"],
    };
    vi.mocked(recordOperatorParcelIncidentSearch).mockResolvedValue(updated);

    render(<ParcelIncidentsPage />);

    await user.click(await screen.findByRole("button", { name: "details" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: "parcelIncidents.recordSearchShort",
      }),
    );

    const dialogs = await screen.findAllByRole("dialog");
    const searchDialog = dialogs[dialogs.length - 1];
    await user.type(
      within(searchDialog).getByRole("textbox", {
        name: "parcelIncidents.resultLabel",
      }),
      "Đã rà soát toàn xe",
    );
    await user.click(
      within(searchDialog).getByRole("button", {
        name: "parcelIncidents.actions.RECORD_SEARCH",
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

// --- Báo cáo custody exception chờ duyệt -----------------------------------
// Guide `FE-Operator-Web-Parcel-Custody-Exception-Integration-Guide.md`.

const pendingApproval: ParcelCustodyExceptionApproval = {
  requestId: "36000000-0000-4000-8000-000000000501",
  parcelId: incident.parcelId,
  incidentId: incident.incidentId,
  incidentType: "WRONG_STOP",
  incidentStatus: "OPEN",
  status: "PENDING_APPROVAL",
  actualLocationType: "ROUTE_STOP",
  actualLocationId: "36000000-0000-4000-8000-000000000601",
  locationSnapshot: "Bến xe Miền Đông",
  temporaryExceptionTag: null,
  description: "Kiện được phát hiện ở bến không đúng điểm trả",
  observedWeightKg: 5.5,
  evidenceReferences: ["https://cdn.example/wrong-stop.jpg"],
  reason: "Phụ xe báo kiện đã bị dỡ ngoài luồng chuẩn",
  reportedByUserId: "36000000-0000-4000-8000-000000000701",
  reportedByRole: "ASSISTANT",
  reportedAt: "2026-08-28T10:00:00+07:00",
  reviewedByUserId: null,
  reviewedAt: null,
  reviewedByRole: null,
  reviewNote: null,
  approvedCustodyEventId: null,
  searchDeadline: null,
  availableActions: ["APPROVE", "REJECT"],
};

// Dòng chờ duyệt vẫn là OPEN như mọi sự cố mới; SLA và deadline đều null.
const pendingIncident: ParcelIncidentListItem = {
  ...incident,
  status: "OPEN",
  searchDeadline: null,
  operatorProcessBreach: false,
  sla: null,
  taskSummary: { completed: 0, total: 0, assignees: [] },
  availableActions: ["APPROVE", "REJECT"],
};

const pendingDetail: ParcelIncidentDetail = {
  ...detail,
  incident: pendingIncident,
  searchTasks: [],
  availableActions: ["APPROVE", "REJECT"],
  custodyExceptionApproval: pendingApproval,
};

function usePendingQueue() {
  vi.mocked(getOperatorParcelIncidents).mockResolvedValue({
    items: [pendingIncident],
    page: 1,
    pageSize: 20,
    totalItems: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  vi.mocked(getOperatorParcelIncident).mockResolvedValue(pendingDetail);
}

async function openPendingDetail(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("button", {
      name: "parcelIncidents.approval.reviewCta",
    }),
  );
  return screen.findByRole("dialog");
}

describe("duyệt báo cáo custody exception", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePendingQueue();
  });

  // §3 playbook Reliability v2: hàng đợi chờ duyệt được siết Ở SERVER bằng
  // `approvalStatus`, không lọc `availableActions` trên trang đang mở nữa —
  // lọc client chỉ thấy 20 dòng và làm sai cả phân trang lẫn số đếm.
  it("lọc chờ duyệt bằng approvalStatus của BE, không kèm status", async () => {
    const user = userEvent.setup();
    render(<ParcelIncidentsPage />);
    await screen.findByText("parcelIncidents.approval.pendingBadge");

    await user.click(
      screen.getByRole("button", {
        name: /parcelIncidents\.approval\.pendingFilter/,
      }),
    );

    await waitFor(() => {
      expect(getOperatorParcelIncidents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          approvalStatus: "PENDING_APPROVAL",
          page: 1,
        }),
      );
    });
    expect(
      vi.mocked(getOperatorParcelIncidents).mock.calls.at(-1)?.[0],
    ).not.toHaveProperty("status");
  });

  // Badge phải đếm CẢ hàng đợi nên có một request riêng `pageSize: 1`; số hiện
  // ra là `totalItems` của BE chứ không phải số dòng đang thấy.
  it("đếm badge chờ duyệt bằng một request riêng theo approvalStatus", async () => {
    render(<ParcelIncidentsPage />);
    await screen.findByText("parcelIncidents.approval.pendingBadge");

    await waitFor(() => {
      expect(getOperatorParcelIncidents).toHaveBeenCalledWith({
        page: 1,
        pageSize: 1,
        approvalStatus: "PENDING_APPROVAL",
      });
    });
  });

  it("nhận diện dòng chờ duyệt bằng availableActions, không bằng status OPEN", async () => {
    render(<ParcelIncidentsPage />);

    expect(
      await screen.findByText("parcelIncidents.approval.pendingBadge"),
    ).toBeInTheDocument();
    // searchDeadline/sla đều null → không được bịa ra countdown
    expect(screen.queryByText(/parcelIncidents\.slaRemaining/)).not.toBeInTheDocument();
    expect(screen.queryByText(/parcelIncidents\.slaOverdue/)).not.toBeInTheDocument();
    // taskSummary.total = 0 nghĩa là BE chưa tạo task, không phải "0/0 chưa xong"
    expect(screen.queryByText(/parcelIncidents\.taskProgress/)).not.toBeInTheDocument();
  });

  it("panel duyệt lấy location/lý do/bằng chứng từ custodyExceptionApproval", async () => {
    const user = userEvent.setup();
    render(<ParcelIncidentsPage />);

    const dialog = await openPendingDetail(user);

    expect(
      within(dialog).getByText("Phụ xe báo kiện đã bị dỡ ngoài luồng chuẩn"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Bến xe Miền Đông")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Kiện được phát hiện ở bến không đúng điểm trả"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByAltText("parcelIncidents.approval.evidenceItem 1"),
    ).toHaveAttribute("src", "https://cdn.example/wrong-stop.jpg");
  });

  it("chưa duyệt thì không mở được search/mark-found/forward/declare-lost", async () => {
    const user = userEvent.setup();
    render(<ParcelIncidentsPage />);

    const dialog = await openPendingDetail(user);

    for (const action of [
      "ASSIGN",
      "MARK_FOUND",
      "FORWARD",
      "DECLARE_LOST",
      "RESOLVE",
    ]) {
      expect(
        within(dialog).queryByRole("button", {
          name: `parcelIncidents.actions.${action}`,
        }),
      ).not.toBeInTheDocument();
    }

    expect(
      within(dialog).getByRole("button", {
        name: "parcelIncidents.approval.approve",
      }),
    ).toBeInTheDocument();
  });

  it("body duyệt chỉ có decision + note, và refetch detail để lấy search task", async () => {
    const user = userEvent.setup();
    const approvedDetail: ParcelIncidentDetail = {
      ...pendingDetail,
      incident: { ...pendingIncident, status: "SEARCHING" },
      searchTasks: [
        {
          taskId: "36000000-0000-4000-8000-000000000801",
          incidentId: incident.incidentId,
          taskType: "MANIFEST_RECONCILIATION",
          status: "OPEN",
        },
        {
          taskId: "36000000-0000-4000-8000-000000000802",
          incidentId: incident.incidentId,
          taskType: "VEHICLE_SWEEP",
          status: "OPEN",
        },
      ],
      availableActions: ["RECORD_SEARCH", "MARK_FOUND"],
      custodyExceptionApproval: {
        ...pendingApproval,
        status: "APPROVED",
        reviewedByRole: "OPERATOR_STAFF",
        reviewedAt: "2026-08-28T10:05:00+07:00",
        approvedCustodyEventId: "36000000-0000-4000-8000-000000000901",
      },
    };

    vi.mocked(decideOperatorParcelIncidentCustodyException).mockResolvedValue({
      status: "APPROVED",
      incidentStatus: "SEARCHING",
      availableActions: ["CONTINUE_SEARCH"],
    });
    vi.mocked(getOperatorParcelIncident)
      .mockResolvedValueOnce(pendingDetail)
      .mockResolvedValueOnce(approvedDetail);

    render(<ParcelIncidentsPage />);

    const dialog = await openPendingDetail(user);
    await user.click(
      within(dialog).getByRole("button", {
        name: "parcelIncidents.approval.approve",
      }),
    );

    const dialogs = await screen.findAllByRole("dialog");
    const decisionDialog = dialogs[dialogs.length - 1];
    await user.type(
      within(decisionDialog).getByRole("textbox"),
      "Đã đối chiếu ảnh",
    );
    await user.click(
      within(decisionDialog).getByRole("button", {
        name: "parcelIncidents.approval.approve",
      }),
    );

    await waitFor(() =>
      expect(decideOperatorParcelIncidentCustodyException).toHaveBeenCalled(),
    );

    // Không có reviewerUserId/operatorId nào trong body
    expect(decideOperatorParcelIncidentCustodyException).toHaveBeenCalledWith(
      incident.incidentId,
      { decision: "APPROVE", note: "Đã đối chiếu ảnh" },
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
    );

    // Decision response không kèm searchTasks → phải refetch detail
    await waitFor(() =>
      expect(getOperatorParcelIncident).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(
        screen.getByText("parcelIncidents.taskTypes.MANIFEST_RECONCILIATION"),
      ).toBeInTheDocument(),
    );
  });

  it("thua race ALREADY_DECIDED thì refetch, không gửi lại bằng key khác", async () => {
    const user = userEvent.setup();
    const decidedByOther: ParcelIncidentDetail = {
      ...pendingDetail,
      availableActions: [],
      custodyExceptionApproval: {
        ...pendingApproval,
        status: "REJECTED",
        reviewedByRole: "OPERATOR_ADMIN",
        reviewedAt: "2026-08-28T10:05:00+07:00",
        reviewNote: "Ảnh camera cho thấy kiện vẫn nằm trên xe",
      },
    };

    vi.mocked(decideOperatorParcelIncidentCustodyException).mockRejectedValue(
      new ApiRequestError(
        "Custody exception request has already been decided.",
        409,
        "PARCEL_CUSTODY_EXCEPTION_ALREADY_DECIDED",
      ),
    );
    vi.mocked(getOperatorParcelIncident)
      .mockResolvedValueOnce(pendingDetail)
      .mockResolvedValueOnce(decidedByOther);

    render(<ParcelIncidentsPage />);

    const dialog = await openPendingDetail(user);
    await user.click(
      within(dialog).getByRole("button", {
        name: "parcelIncidents.approval.reject",
      }),
    );

    const dialogs = await screen.findAllByRole("dialog");
    const decisionDialog = dialogs[dialogs.length - 1];
    await user.click(
      within(decisionDialog).getByRole("button", {
        name: "parcelIncidents.approval.reject",
      }),
    );

    // Đúng MỘT lần gửi: không replay bằng UUID mới
    await waitFor(() =>
      expect(getOperatorParcelIncident).toHaveBeenCalledTimes(2),
    );
    expect(decideOperatorParcelIncidentCustodyException).toHaveBeenCalledTimes(1);

    // Quyết định thật của người khác được hiện ra
    // Pill trạng thái ở đầu panel + dòng kết quả duyệt bên dưới
    await waitFor(() =>
      expect(
        screen.getAllByText("parcelIncidents.approval.statuses.REJECTED"),
      ).toHaveLength(2),
    );
    expect(
      screen.getByText("Ảnh camera cho thấy kiện vẫn nằm trên xe"),
    ).toBeInTheDocument();
  });
});
