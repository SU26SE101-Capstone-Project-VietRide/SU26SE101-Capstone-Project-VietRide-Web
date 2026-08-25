import type {
  AdminCustomPlanRequest,
  CustomPlanQuota,
  CustomPlanRequestStatus,
  OperatorCustomPlanRequest,
  SubscriptionBillingPeriod,
} from "../api/vietride";

// Chuẩn hoá response custom-request về một hình phẳng cho UI.
//
// Shape của BE: hạn mức trong `requestedLimits`, module trong
// `requestedModules`, và hai API GET admin trả kèm `operatorName`.
// Gom việc đọc vào một chỗ để component không rải `requestedLimits.maxVehicles`
// khắp nơi, và để lần sau BE đổi shape thì chỉ phải sửa đúng file này.

export type CustomPlanRequestView = {
  requestId: string;
  status: CustomPlanRequestStatus;
  preferredBillingPeriod: SubscriptionBillingPeriod | null;
  note: string;
  quota: CustomPlanQuota;
  createdAt: string;
  reviewedAt: string;
  approvedPlanId: string;
  rejectionReason: string;
  // Chỉ có ở phía admin
  operatorId: string;
  operatorName: string;
};

function text(value: string | null | undefined) {
  return value ?? "";
}

export function toCustomPlanRequestView(
  request: AdminCustomPlanRequest | OperatorCustomPlanRequest,
): CustomPlanRequestView {
  const { requestedLimits, requestedModules } = request;

  return {
    requestId: request.requestId,
    status: request.status,
    preferredBillingPeriod: request.preferredBillingPeriod ?? null,
    note: text(request.note),
    quota: {
      maxVehicles: requestedLimits.maxVehicles,
      maxDrivers: requestedLimits.maxDrivers,
      maxAssistants: requestedLimits.maxAssistants,
      maxOperatorUsers: requestedLimits.maxOperatorUsers,
      maxRoutes: requestedLimits.maxRoutes,
      maxTripsPerMonth: requestedLimits.maxTripsPerMonth,
      enableParcel: requestedModules.enableParcel,
      enableShuttle: requestedModules.enableShuttle,
      enableRag: requestedModules.enableRag,
    },
    createdAt: request.createdAt,
    reviewedAt: text(request.reviewedAt),
    approvedPlanId: text(request.approvedPlanId),
    rejectionReason: text(request.rejectionReason),
    operatorId: text((request as AdminCustomPlanRequest).operatorId),
    operatorName: text((request as AdminCustomPlanRequest).operatorName),
  };
}

// BE cam kết `operatorName` LUÔN có giá trị (handoff §7). Vẫn giữ nhánh lùi về
// mã rút gọn để một dòng dữ liệu cũ/lỗi không làm ô nhà xe trống trơn — admin
// mất luôn khả năng phân biệt hai dòng.
export function operatorLabel(view: CustomPlanRequestView) {
  return view.operatorName || view.operatorId.slice(0, 8);
}
