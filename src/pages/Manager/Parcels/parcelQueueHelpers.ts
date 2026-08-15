// Helper thuần + hằng dùng chung cho màn hàng đợi bưu kiện (ParcelQueue)
import type { OperatorParcelListItem } from "../../../api/vietride";

export const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-vr-500 focus:outline-none focus:ring-2 focus:ring-vr-500/20";
export const pageSize = 20;

export type Translate = (key: string, options?: Record<string, unknown>) => string;

export type ParcelFilter = {
  value: string;
  labelKey: string;
  status?: string;
  pendingActionType?: string;
};

/**
 * Ba hàng đợi cần xử lý gấp — để trên đầu dropdown vì đây là việc điều hành
 * viên mở màn này để làm.
 */
const priorityQueues: ParcelFilter[] = [
  {
    value: "PENDING_OPERATOR_ACTION",
    labelKey: "parcels.queue.tabOperatorAction",
    status: "PENDING_OPERATOR_ACTION",
  },
  {
    value: "DELIVERY_REJECTED",
    labelKey: "enumLabels.DELIVERY_REJECTED",
    status: "DELIVERY_REJECTED",
  },
  {
    value: "RETURN_INITIATED",
    labelKey: "enumLabels.RETURN_INITIATED",
    status: "RETURN_INITIATED",
  },
];

/**
 * Toàn bộ ParcelStatus của BE (`apps/parcel/.../Enums/ParcelStatus.cs`), xếp
 * theo vòng đời đơn hàng. Trước đây dropdown chỉ có 3 trạng thái nên 19 trạng
 * thái còn lại không có cách nào lọc, dù `/v1/operator/parcels` nhận hết.
 */
const lifecycleStatuses = [
  "PENDING_OPERATOR_REVIEW",
  "PENDING_PAYMENT",
  "PENDING",
  "PENDING_ADDITIONAL_PAYMENT",
  "RESERVED",
  "CHECKED_IN",
  "PENDING_FINAL_PAYMENT",
  "READY_TO_LOAD",
  "LOADED",
  "IN_TRANSIT",
  "PENDING_TRANSFER_CONFIRM",
  "TRANSFER_ESCALATED",
  "UNLOADED",
  "DELIVERED_PENDING_CONFIRM",
  "DELIVERY_CONFIRMED",
  "RETURNED",
  "CANCELLED",
  "REJECTED",
  "EXPIRED",
] as const;

export const queueTabs: ParcelFilter[] = [
  { value: "ALL", labelKey: "all" },
  ...priorityQueues,
  ...lifecycleStatuses.map((status) => ({
    value: status,
    labelKey: `enumLabels.${status}`,
    status,
  })),
];

const needsActionStatuses = new Set([
  "DELIVERY_REJECTED",
  "RETURN_INITIATED",
  "TRANSFER_ESCALATED",
]);

export function actionLabel(
  item: OperatorParcelListItem,
  t: Translate,
  tc: Translate,
) {
  if (item.status === "PENDING_OPERATOR_REVIEW")
    return t("parcels.queue.pendingReview");
  if (item.status === "PENDING_OPERATOR_ACTION") {
    if (item.pendingActionType === "REFUND_CONFIRMATION")
      return t("parcels.pendingActions.REFUND_CONFIRMATION");
    if (item.pendingActionType === "CAPACITY_EXCEEDED")
      return t("parcels.pendingActions.CAPACITY_EXCEEDED");
    if (item.pendingActionType === "RESERVE_FAILED")
      return t("parcels.pendingActions.RESERVE_FAILED");
  }
  return tc(`enumLabels.${item.status}`, {
    defaultValue: item.status.replaceAll("_", " "),
  });
}

export function needsAction(item: OperatorParcelListItem) {
  return (
    needsActionStatuses.has(item.status) ||
    item.status === "PENDING_OPERATOR_ACTION"
  );
}

export function money(value?: number | null) {
  return value == null ? "-" : `${value.toLocaleString("vi-VN")} đ`;
}

export function statusTone(item: OperatorParcelListItem) {
  if (needsAction(item)) return "bg-amber-50 text-amber-700 ring-amber-200";
  return parcelStatusTone(item.status);
}

/**
 * Màu chip theo RIÊNG mã trạng thái — dùng cho lịch sử trạng thái, nơi mỗi dòng
 * là một trạng thái cũ chứ không phải kiện hàng đang cần thao tác.
 */
export function parcelStatusTone(status: string) {
  if (["DELIVERY_CONFIRMED", "RETURNED"].includes(status))
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["CANCELLED", "REJECTED", "DELIVERY_REJECTED"].includes(status))
    return "bg-red-50 text-red-700 ring-red-200";
  if (status === "EXPIRED") return "bg-gray-100 text-gray-600 ring-gray-200";
  if (
    status === "PENDING_OPERATOR_ACTION" ||
    status.startsWith("AWAITING_") ||
    status.endsWith("_PENDING_CONFIRM")
  )
    return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-blue-50 text-blue-700 ring-blue-200";
}
