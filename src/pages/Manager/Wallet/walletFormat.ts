import type { BadgeTone } from "../../../components/ui/Badge";
import type {
  TripSettlementProcessingState,
  TripSettlementStatus,
} from "../../../api/vietride";
import { formatDateTime } from "../../../utils/date";

export function formatWalletDate(value?: string | null) {
  return formatDateTime(value ?? undefined);
}

export function processingStateClass(state?: TripSettlementProcessingState) {
  switch (state) {
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700";
    case "READY_FOR_SETTLEMENT":
      return "bg-blue-50 text-blue-700";
    case "ON_HOLD":
      return "bg-amber-50 text-amber-800";
    case "RETRY_SCHEDULED":
      return "bg-orange-50 text-orange-800";
    case "CANCELLED":
      return "bg-red-50 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

// status cũ (không có processingState trên response) vẫn cần map màu — giữ
// map riêng vì bộ giá trị enum khác nhau (4 so với 5 trạng thái).
/** Tone của Badge theo trạng thái đối soát — 4 trạng thái, 4 tone khác nhau. */
export function settlementStatusTone(status: TripSettlementStatus): BadgeTone {
  switch (status) {
    case "SETTLED":
      return "success";
    case "ELIGIBLE":
      return "info";
    case "PENDING_HOLD":
      return "warning";
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

type FinancialActor = {
  displayName?: string | null;
  role?: string | null;
} | null | undefined;

/**
 * Tên người thao tác trên các bảng ví. Tài khoản quản trị hệ thống có
 * `displayName` là "System Admin" trong DB — đọc thô ra thì lệch hẳn với phần
 * còn lại của giao diện, nên đổi sang nhãn vai trò đã dịch. Người thật thì giữ
 * nguyên tên của họ.
 *
 * `tc` là `t` của namespace `common` (nơi có `roles.*`).
 */
export function actorDisplayName(
  actor: FinancialActor,
  tc: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (!actor) return null;
  const isSystemAdmin =
    actor.role === "SYSTEM_ADMIN" || actor.displayName === "System Admin";
  if (isSystemAdmin) {
    return tc("roles.SYSTEM_ADMIN", { defaultValue: actor.displayName ?? "" });
  }
  return actor.displayName || null;
}
