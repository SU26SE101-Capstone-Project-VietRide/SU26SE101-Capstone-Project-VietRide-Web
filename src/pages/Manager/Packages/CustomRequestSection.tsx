// Khu vực "Gói riêng" dưới bảng giá. Nội dung đổi theo yêu cầu MỚI NHẤT của
// nhà xe; bên dưới là lịch sử các yêu cầu đã gửi.
//
// Điểm dễ hiểu nhầm nhất và lý do khối APPROVED viết như bên dưới: admin duyệt
// xong nghĩa là gói riêng đã CÓ TRONG BẢNG GIÁ, không phải nhà xe đã lên gói.
// Ghi "đã kích hoạt" là họ sẽ đi tìm tính năng chưa mở.
import { useTranslation } from "react-i18next";
import { FiClock, FiPlusCircle, FiXCircle } from "react-icons/fi";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatDateTime } from "../../../utils/date";
import type {
  CustomPlanRequestStatus,
  SubscriptionPlan,
} from "../../../api/vietride";
import type { CustomPlanRequestView } from "../../../utils/customPlanRequest";
import type { UseOperatorCustomPlanRequestsResult } from "./useOperatorCustomPlanRequests";

const statusTones: Record<CustomPlanRequestStatus, BadgeTone> = {
  PENDING_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

type CustomRequestSectionProps = {
  queue: UseOperatorCustomPlanRequestsResult;
  // Gói riêng vừa được duyệt, tra từ plan list theo approvedPlanId. Không tìm
  // thấy (admin đã ngừng bán) → chỉ hiện trạng thái, không mời nâng cấp.
  approvedPlan: SubscriptionPlan | null;
  upgradeDisabled?: boolean;
  canRequest: boolean;
  onOpenForm: () => void;
  onUpgradeToApprovedPlan: (plan: SubscriptionPlan) => void;
};

export default function CustomRequestSection({
  queue,
  approvedPlan,
  upgradeDisabled = false,
  canRequest,
  onOpenForm,
  onUpgradeToApprovedPlan,
}: CustomRequestSectionProps) {
  const { t } = useTranslation("manager");
  const { latestRequest, pendingRequest } = queue;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">
        {t("packages.customPlanSectionTitle")}
      </h2>

      {pendingRequest ? (
        <div
          data-testid="custom-request-pending"
          className="rounded-lg border border-amber-200 bg-amber-50/70 p-5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <FiClock className="text-amber-700" />
            <p className="font-semibold text-gray-900">
              {t("packages.customRequestPendingTitle")}
            </p>
            <Badge tone="warning">
              {t("packages.customRequestStatus.PENDING_REVIEW")}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-gray-700">
            {t("packages.customRequestPendingHint", {
              sentAt: formatDateTime(pendingRequest.createdAt),
            })}
          </p>
        </div>
      ) : latestRequest?.status === "APPROVED" ? (
        <div
          data-testid="custom-request-approved"
          className="rounded-lg border border-vr-200 bg-vr-50/70 p-5"
        >
          <p className="font-semibold text-gray-900">
            {t("packages.customRequestApprovedTitle")}
          </p>
          {/* Câu này là thứ ngăn hiểu nhầm "duyệt = đã lên gói" */}
          <p className="mt-2 text-sm text-gray-700">
            {t("packages.customRequestApprovedHint")}
          </p>
          {approvedPlan && upgradeDisabled ? (
            <p
              data-testid="custom-request-upgrade-blocked"
              className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600"
            >
              {t("packages.notAnUpgradeHint")}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {approvedPlan ? (
              <Button
                variant="primary"
                data-testid="custom-request-upgrade"
                disabled={upgradeDisabled}
                onClick={() => onUpgradeToApprovedPlan(approvedPlan)}
              >
                {t("packages.customRequestUpgradeCta", {
                  name: approvedPlan.name,
                })}
              </Button>
            ) : null}
            {canRequest ? (
              <Button variant="secondary" onClick={onOpenForm}>
                {t("packages.customRequestNew")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : latestRequest?.status === "REJECTED" ? (
        <div
          data-testid="custom-request-rejected"
          className="rounded-lg border border-red-200 bg-red-50/70 p-5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <FiXCircle className="text-red-700" />
            <p className="font-semibold text-gray-900">
              {t("packages.customRequestRejectedTitle")}
            </p>
          </div>
          {/* Lý do hiển thị nguyên văn của admin */}
          <p className="mt-2 text-sm text-gray-700">
            {latestRequest.rejectionReason || t("packages.customRequestNoReason")}
          </p>
          {canRequest ? (
            <Button
              variant="secondary"
              className="mt-4"
              onClick={onOpenForm}
            >
              {t("packages.customRequestNew")}
            </Button>
          ) : null}
        </div>
      ) : (
        <div
          data-testid="custom-request-empty"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-5"
        >
          <div>
            <p className="font-semibold text-gray-900">
              {t("packages.customRequestEmptyTitle")}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {t("packages.customRequestEmptyHint")}
            </p>
          </div>
          {canRequest ? (
            <Button variant="primary" onClick={onOpenForm}>
              <FiPlusCircle size={16} />
              {t("packages.customRequestCta")}
            </Button>
          ) : null}
        </div>
      )}

      {queue.requests.length > 0 ? (
        <details className="rounded-lg border border-gray-200 bg-white">
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-gray-700">
            {t("packages.customRequestHistory", {
              count: queue.requests.length,
            })}
          </summary>
          <div className="overflow-x-auto border-t border-gray-100">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-2">{t("packages.customRequestSentAt")}</th>
                  <th className="px-5 py-2">{t("packages.customRequestScale")}</th>
                  <th className="px-5 py-2">{t("packages.customRequestStatusColumn")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {queue.requests.map((request: CustomPlanRequestView) => (
                  <tr key={request.requestId}>
                    <td className="px-5 py-2 text-gray-600">
                      {formatDateTime(request.createdAt)}
                    </td>
                    <td className="px-5 py-2 text-gray-600">
                      {t("packages.customRequestScaleSummary", {
                        vehicles: request.quota.maxVehicles,
                        routes: request.quota.maxRoutes,
                      })}
                    </td>
                    <td className="px-5 py-2">
                      <Badge tone={statusTones[request.status]}>
                        {t(`packages.customRequestStatus.${request.status}`)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  );
}
