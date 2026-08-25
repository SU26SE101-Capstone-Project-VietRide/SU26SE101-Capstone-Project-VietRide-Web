import type { BadgeTone } from "../../../components/ui/Badge";
import type {
  ParcelCustodyEvent,
  ParcelCustodyTimeline,
  ParcelIncidentAction,
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
