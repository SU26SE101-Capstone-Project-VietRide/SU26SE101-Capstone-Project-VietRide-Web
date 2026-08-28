import { ApiRequestError } from "../../../api/client";
import type { BadgeTone } from "../../../components/ui/Badge";
import type {
  ParcelCustodyEvent,
  ParcelCustodyExceptionApproval,
  ParcelCustodyTimeline,
  ParcelIncidentAction,
  ParcelIncidentDetail,
} from "../../../api/vietride";

/**
 * `availableActions` của backend là NGUỒN QUYỀN DUY NHẤT cho các nút mutation
 * (§11.1 mục 3 của `API-Parcel-Operator-2026-08-21.md`). Không suy ra nút từ
 * `status` — state machine nằm ở BE, dựng lại ở client là sớm muộn cũng lệch.
 */
export function hasIncidentAction(
  actions: ParcelIncidentAction[] | undefined,
  action: ParcelIncidentAction,
) {
  return (actions ?? []).includes(action);
}

/**
 * Tone của pill trạng thái sự cố. `LOST_CONFIRMED` là kết cục xấu nhất; các
 * trạng thái đang xử lý để `info`/`warning` chứ không nhuộm đỏ hàng loạt.
 */
export function incidentStatusTone(status: string): BadgeTone {
  switch (status) {
    case "LOST_CONFIRMED":
      return "danger";
    case "ESCALATED":
    case "SEARCH_EXPIRED":
      return "warning";
    case "FOUND":
    case "RESOLVED":
    case "CLOSED":
      return "success";
    case "SEARCHING":
    case "FORWARDING":
      return "info";
    default:
      return "neutral";
  }
}

/**
 * Cursor cho lượt tải lịch sử cũ hơn: BE nhận `beforeSequence` nên phải lấy
 * sequence NHỎ NHẤT đang có, không phải phần tử cuối mảng — thứ tự mảng do BE
 * quyết định và không được coi là bảo đảm.
 */
export function oldestSequence(timeline: ParcelCustodyTimeline | undefined) {
  const items = timeline?.items ?? [];
  if (items.length === 0) return null;

  return items.reduce(
    (lowest, event) => Math.min(lowest, event.sequence),
    items[0].sequence,
  );
}

/**
 * Ghép lượt tải cũ vào lịch sử đang hiển thị.
 *
 * Khử trùng theo `eventId` vì hai lượt tải có thể chồng nhau (event mới chèn
 * vào giữa hai lần bấm), rồi sắp giảm dần theo `sequence` — mới nhất lên đầu.
 */
export function mergeCustodyEvents(
  current: ParcelCustodyEvent[],
  older: ParcelCustodyEvent[],
) {
  const merged = new Map(current.map((event) => [event.eventId, event]));
  older.forEach((event) => merged.set(event.eventId, event));

  return [...merged.values()].sort((left, right) => right.sequence - left.sequence);
}

/**
 * Nhận diện dòng "chờ duyệt báo cáo" trong hàng đợi.
 *
 * §5 của guide custody exception: pending approval VẪN có `status = "OPEN"` như
 * mọi sự cố mới, nên `status` KHÔNG phân biệt được. Dấu hiệu duy nhất là
 * `availableActions` chứa APPROVE/REJECT — backend hiện chưa có query param
 * `approvalStatus` để lọc từ server.
 */
export function isPendingCustodyApproval(
  actions: ParcelIncidentAction[] | undefined,
) {
  return (
    hasIncidentAction(actions, "APPROVE") ||
    hasIncidentAction(actions, "REJECT")
  );
}

export type CustodyApprovalUi =
  /** Sự cố không đến từ báo cáo cần duyệt — không dựng panel */
  | { kind: "NONE" }
  /** Đang chờ người duyệt thao tác */
  | { kind: "REVIEW_REQUIRED"; approval: ParcelCustodyExceptionApproval }
  /** Đã duyệt — workflow tìm kiếm/chuyển tiếp đã mở */
  | { kind: "APPROVED"; approval: ParcelCustodyExceptionApproval }
  /** Đã từ chối hoặc bị huỷ — chỉ còn giá trị hồ sơ */
  | { kind: "CLOSED"; approval: ParcelCustodyExceptionApproval };

/**
 * Trạng thái panel duyệt (§8 của guide).
 *
 * Chỉ coi là REVIEW_REQUIRED khi CẢ HAI cùng đúng: bản thân báo cáo còn
 * `PENDING_APPROVAL` và `availableActions` cấp detail còn cho phép duyệt. Chỉ
 * dựa vào một trong hai là có lúc bày ra nút mà BE sẽ từ chối — quyền quyết
 * định cuối vẫn nằm ở `availableActions`.
 */
export function getCustodyApprovalUi(
  detail: ParcelIncidentDetail | null | undefined,
): CustodyApprovalUi {
  const approval = detail?.custodyExceptionApproval;
  if (!approval) return { kind: "NONE" };

  const actions = detail?.availableActions ?? detail?.incident?.availableActions;

  if (
    approval.status === "PENDING_APPROVAL" &&
    hasIncidentAction(actions, "APPROVE") &&
    hasIncidentAction(actions, "REJECT")
  ) {
    return { kind: "REVIEW_REQUIRED", approval };
  }

  if (approval.status === "APPROVED") {
    return { kind: "APPROVED", approval };
  }

  return { kind: "CLOSED", approval };
}

/** Tone pill cho trạng thái báo cáo. `PENDING_APPROVAL` là việc cần làm, không phải lỗi. */
export function custodyApprovalTone(status: string): BadgeTone {
  switch (status) {
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "danger";
    case "CANCELLED":
      return "neutral";
    case "PENDING_APPROVAL":
      return "warning";
    default:
      return "neutral";
  }
}

/**
 * Cách màn phải phản ứng với một lỗi mutation của sự cố (§9 của guide custody
 * exception).
 *
 * - `GONE`: sự cố không còn tồn tại/không thuộc tenant → đóng chi tiết, nạp lại
 *   hàng đợi.
 * - `NEEDS_APPROVAL`: báo cáo chưa được duyệt → đưa người dùng về panel duyệt.
 * - `STALE`: state ở BE đã đổi → nạp lại chi tiết, KHÔNG tự động gửi lại.
 * - `SHOW`: lỗi bình thường → hiện `error.message` tại chỗ.
 */
export type IncidentErrorOutcome = "GONE" | "NEEDS_APPROVAL" | "STALE" | "SHOW";

const GONE_CODES = ["PARCEL_INCIDENT_NOT_FOUND"];

const STALE_CODES = [
  "INVALID_STATUS",
  "PARCEL_INCIDENT_INVALID_STATUS",
  "PARCEL_CUSTODY_EXCEPTION_ALREADY_DECIDED",
  "PARCEL_CUSTODY_EXCEPTION_REQUEST_NOT_FOUND",
  "PARCEL_SEARCH_TASK_NOT_FOUND",
  "PARCEL_SEARCH_TASK_MISMATCH",
];

export function classifyIncidentError(error: unknown): IncidentErrorOutcome {
  const code = error instanceof ApiRequestError ? error.code : undefined;
  if (!code) return "SHOW";

  if (GONE_CODES.includes(code)) return "GONE";
  if (code === "PARCEL_CUSTODY_EXCEPTION_APPROVAL_REQUIRED") {
    return "NEEDS_APPROVAL";
  }
  if (STALE_CODES.includes(code)) return "STALE";

  return "SHOW";
}
