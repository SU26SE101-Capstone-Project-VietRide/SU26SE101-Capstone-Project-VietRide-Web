import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../../../api/client";
import type {
  ParcelCustodyEvent,
  ParcelCustodyExceptionApproval,
  ParcelIncidentAction,
  ParcelIncidentDetail,
} from "../../../api/vietride";
import { slaTone } from "../../../utils/parcelReliability";
import {
  classifyIncidentError,
  custodyApprovalTone,
  getCustodyApprovalUi,
  hasIncidentAction,
  incidentStatusTone,
  isPendingCustodyApproval,
  mergeCustodyEvents,
  oldestSequence,
} from "./incidentHelpers";

function eventAt(sequence: number, eventId = `event-${sequence}`) {
  return {
    eventId,
    eventType: "HANDOFF",
    actorRole: "DRIVER",
    occurredAt: "2026-08-21T10:00:00+07:00",
    recordedAt: "2026-08-21T10:00:05+07:00",
    source: "DRIVER_APP",
    evidenceReferences: [],
    sequence,
  } satisfies ParcelCustodyEvent;
}

describe("hasIncidentAction", () => {
  it("chỉ mở nút theo đúng danh sách BE trả về", () => {
    expect(hasIncidentAction(["ASSIGN", "MARK_FOUND"], "ASSIGN")).toBe(true);
    expect(hasIncidentAction(["ASSIGN"], "DECLARE_LOST")).toBe(false);
  });

  it("chưa tải được chi tiết thì không mở nút nào", () => {
    expect(hasIncidentAction(undefined, "RESOLVE")).toBe(false);
  });
});

describe("oldestSequence", () => {
  it("lấy sequence NHỎ NHẤT chứ không phải phần tử cuối mảng", () => {
    // Thứ tự mảng do BE quyết định — không được coi là bảo đảm
    expect(
      oldestSequence({
        items: [eventAt(9), eventAt(3), eventAt(7)],
        nextCursor: 3,
      }),
    ).toBe(3);
  });

  it("lịch sử rỗng thì không có cursor để xin tiếp", () => {
    expect(oldestSequence({ items: [], nextCursor: null })).toBeNull();
    expect(oldestSequence(undefined)).toBeNull();
  });
});

describe("mergeCustodyEvents", () => {
  it("khử trùng theo eventId và sắp mới nhất lên đầu", () => {
    const merged = mergeCustodyEvents(
      [eventAt(9), eventAt(7)],
      [eventAt(7), eventAt(5)],
    );

    expect(merged.map((event) => event.sequence)).toEqual([9, 7, 5]);
  });
});

describe("tone", () => {
  it("chỉ nhuộm đỏ trạng thái thật sự xấu", () => {
    expect(slaTone("BREACHED")).toBe("danger");
    expect(slaTone("DUE_SOON")).toBe("warning");
    expect(incidentStatusTone("LOST_CONFIRMED")).toBe("danger");
    // Đang xử lý không phải là hỏng
    expect(incidentStatusTone("SEARCHING")).toBe("info");
    expect(incidentStatusTone("RESOLVED")).toBe("success");
  });
});

function approvalWith(
  overrides: Partial<ParcelCustodyExceptionApproval> = {},
): ParcelCustodyExceptionApproval {
  return {
    requestId: "request-1",
    parcelId: "parcel-1",
    incidentId: "incident-1",
    incidentType: "WRONG_STOP",
    incidentStatus: "OPEN",
    status: "PENDING_APPROVAL",
    actualLocationType: "ROUTE_STOP",
    actualLocationId: "location-1",
    locationSnapshot: "Bến xe Miền Đông",
    temporaryExceptionTag: null,
    description: null,
    observedWeightKg: null,
    evidenceReferences: [],
    reason: "Kiện bị dỡ ngoài luồng chuẩn",
    reportedByUserId: "user-1",
    reportedByRole: "ASSISTANT",
    reportedAt: "2026-08-28T10:00:00+00:00",
    reviewedByUserId: null,
    reviewedAt: null,
    reviewedByRole: null,
    reviewNote: null,
    approvedCustodyEventId: null,
    searchDeadline: null,
    availableActions: ["APPROVE", "REJECT"],
    ...overrides,
  };
}

function detailWith(
  approval: ParcelCustodyExceptionApproval | null,
  availableActions: ParcelIncidentAction[],
): ParcelIncidentDetail {
  return {
    incident: {
      incidentId: "incident-1",
      parcelId: "parcel-1",
      operatorId: "operator-1",
      type: "WRONG_STOP",
      status: "OPEN",
      createdAt: "2026-08-28T10:00:00+00:00",
      operatorProcessBreach: false,
      availableActions,
    },
    searchTasks: [],
    custodyTimeline: { items: [], nextCursor: null },
    availableActions,
    custodyExceptionApproval: approval,
  };
}

describe("isPendingCustodyApproval", () => {
  it("nhận diện chờ duyệt bằng availableActions, không bằng status OPEN", () => {
    // Sự cố chờ duyệt và sự cố mới mở đều là OPEN — chỉ actions phân biệt được
    expect(isPendingCustodyApproval(["APPROVE", "REJECT"])).toBe(true);
    expect(isPendingCustodyApproval(["ASSIGN", "RECORD_SEARCH"])).toBe(false);
    expect(isPendingCustodyApproval(undefined)).toBe(false);
  });
});

describe("getCustodyApprovalUi", () => {
  it("không dựng panel khi sự cố không đến từ báo cáo cần duyệt", () => {
    expect(getCustodyApprovalUi(detailWith(null, ["ASSIGN"])).kind).toBe("NONE");
    expect(getCustodyApprovalUi(null).kind).toBe("NONE");
  });

  it("chỉ mở nút duyệt khi CẢ báo cáo lẫn availableActions cùng cho phép", () => {
    expect(
      getCustodyApprovalUi(detailWith(approvalWith(), ["APPROVE", "REJECT"]))
        .kind,
    ).toBe("REVIEW_REQUIRED");

    // BE đã rút quyền duyệt (người khác vừa quyết định) → không bày nút nữa
    expect(
      getCustodyApprovalUi(detailWith(approvalWith(), ["ASSIGN"])).kind,
    ).toBe("CLOSED");
  });

  it("phân biệt đã duyệt với đã từ chối/huỷ", () => {
    expect(
      getCustodyApprovalUi(
        detailWith(approvalWith({ status: "APPROVED" }), ["ASSIGN"]),
      ).kind,
    ).toBe("APPROVED");
    expect(
      getCustodyApprovalUi(detailWith(approvalWith({ status: "REJECTED" }), []))
        .kind,
    ).toBe("CLOSED");
    expect(
      getCustodyApprovalUi(detailWith(approvalWith({ status: "CANCELLED" }), []))
        .kind,
    ).toBe("CLOSED");
  });
});

describe("custodyApprovalTone", () => {
  it("chờ duyệt là việc cần làm, không phải lỗi", () => {
    expect(custodyApprovalTone("PENDING_APPROVAL")).toBe("warning");
    expect(custodyApprovalTone("APPROVED")).toBe("success");
    expect(custodyApprovalTone("REJECTED")).toBe("danger");
  });
});

describe("classifyIncidentError", () => {
  function apiError(code: string, status = 409) {
    return new ApiRequestError("failed", status, code);
  }

  it("tách lỗi cần nạp lại ra khỏi lỗi chỉ cần hiện tại chỗ", () => {
    expect(classifyIncidentError(apiError("PARCEL_INCIDENT_NOT_FOUND", 404))).toBe(
      "GONE",
    );
    expect(
      classifyIncidentError(apiError("PARCEL_CUSTODY_EXCEPTION_APPROVAL_REQUIRED")),
    ).toBe("NEEDS_APPROVAL");
    expect(
      classifyIncidentError(apiError("PARCEL_CUSTODY_EXCEPTION_ALREADY_DECIDED")),
    ).toBe("STALE");
    expect(classifyIncidentError(apiError("INVALID_STATUS"))).toBe("STALE");
  });

  it("lỗi thường và lỗi không phải ApiRequestError vẫn hiện tại form", () => {
    expect(classifyIncidentError(apiError("VALIDATION_ERROR", 422))).toBe("SHOW");
    expect(classifyIncidentError(new Error("network down"))).toBe("SHOW");
  });
});
