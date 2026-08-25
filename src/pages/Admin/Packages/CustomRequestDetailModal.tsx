// Chi tiết một yêu cầu gói riêng — nơi admin đọc ĐỦ mọi thứ trước khi quyết.
//
// Thứ quan trọng nhất ở đây là GHI CHÚ của nhà xe: đó là lời giải thích vì sao
// họ cần gói riêng, và là căn cứ chính để duyệt hay từ chối. Bảng danh sách
// không có chỗ cho nó nên nó chỉ sống ở đây.
import { useTranslation } from "react-i18next";
import { FiCopy, FiFileText } from "react-icons/fi";
import Modal from "../../../components/Modal";
import { Button } from "../../../components/ui/Button";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { formatDateTime } from "../../../utils/date";
import type { CustomPlanRequestStatus } from "../../../api/vietride";
import {
  operatorLabel,
  type CustomPlanRequestView,
} from "../../../utils/customPlanRequest";

const statusTones: Record<CustomPlanRequestStatus, BadgeTone> = {
  PENDING_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

const quotaKeys = [
  "maxVehicles",
  "maxRoutes",
  "maxDrivers",
  "maxAssistants",
  "maxOperatorUsers",
  "maxTripsPerMonth",
] as const;

const moduleKeys = ["enableParcel", "enableShuttle", "enableRag"] as const;

const moduleLabelKeys: Record<(typeof moduleKeys)[number], string> = {
  enableParcel: "packages.parcelModule",
  enableShuttle: "packages.shuttleModule",
  enableRag: "packages.ragModule",
};

type CustomRequestDetailModalProps = {
  request: CustomPlanRequestView;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-gray-50 px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}

export default function CustomRequestDetailModal({
  request,
  onClose,
  onApprove,
  onReject,
}: CustomRequestDetailModalProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const isPending = request.status === "PENDING_REVIEW";

  return (
    <Modal
      open
      onClose={onClose}
      wide
      icon={<FiFileText size={20} />}
      title={t("customPlans.detailTitle", { operator: operatorLabel(request) })}
      subtitle={t("customPlans.detailSubtitle")}
      footer={
        isPending ? (
          <>
            <Button variant="secondary" onClick={onReject}>
              {t("customPlans.rejectAction")}
            </Button>
            <Button
              variant="primary"
              data-testid="detail-approve"
              onClick={onApprove}
            >
              {t("customPlans.approveAction")}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            {tc("close")}
          </Button>
        )
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTones[request.status]}>
            {t(`customPlans.status.${request.status}`)}
          </Badge>
          {request.reviewedAt ? (
            <span className="text-xs text-gray-500">
              {t("customPlans.reviewedAt", {
                at: formatDateTime(request.reviewedAt),
              })}
            </span>
          ) : null}
        </div>

        <section className="grid gap-3 sm:grid-cols-2">
          <Row
            label={t("customPlans.operatorColumn")}
            value={operatorLabel(request)}
          />
          <Row
            label={t("customPlans.sentAtColumn")}
            value={formatDateTime(request.createdAt)}
          />
          <Row
            label={t("customPlans.periodColumn")}
            value={
              request.preferredBillingPeriod
                ? t(`customPlans.billing.${request.preferredBillingPeriod}`)
                : "-"
            }
          />
          {/* Mã yêu cầu chỉ nằm ở đây, không đưa lên bảng: admin không đọc UUID
              bằng mắt, nhưng khi trao đổi với BE hay hỗ trợ nhà xe thì cần dán
              chính xác. Kèm nút copy vì gõ tay 36 ký tự là sai chắc. */}
          <div className="min-w-0 rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("customPlans.requestIdLabel")}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate text-xs text-gray-700">
                {request.requestId || "-"}
              </code>
              {request.requestId ? (
                <button
                  type="button"
                  data-testid="copy-request-id"
                  onClick={() =>
                    void navigator.clipboard?.writeText(request.requestId)
                  }
                  className="shrink-0 rounded-md p-1 text-gray-500 hover:bg-gray-200"
                  aria-label={tc("copy")}
                  title={tc("copy")}
                >
                  <FiCopy size={14} />
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-base font-bold text-gray-900">
            {t("customPlans.requestedQuotaTitle")}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {quotaKeys.map((key) => (
              <Row
                key={key}
                label={t(`customPlans.limitLabels.${key}`)}
                value={request.quota[key].toLocaleString("vi-VN")}
              />
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-base font-bold text-gray-900">
            {t("packages.modulesTitle")}
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {moduleKeys.map((key) => (
              <span
                key={key}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  request.quota[key]
                    ? "bg-vr-50 text-vr-900"
                    : "bg-gray-100 text-gray-500 line-through"
                }`}
              >
                {t(moduleLabelKeys[key])}
              </span>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-base font-bold text-gray-900">
            {t("customPlans.noteTitle")}
          </h3>
          <p
            data-testid="detail-note"
            className="mt-2 whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700"
          >
            {request.note || t("customPlans.noteEmpty")}
          </p>
        </section>

        {request.status === "REJECTED" ? (
          <section className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h3 className="text-sm font-bold text-red-800">
              {t("customPlans.rejectReasonLabel")}
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-red-700">
              {request.rejectionReason || "-"}
            </p>
          </section>
        ) : null}

        {request.status === "APPROVED" && request.approvedPlanId ? (
          <section className="rounded-lg border border-vr-200 bg-vr-50 p-4 text-sm text-gray-800">
            {/* Nhắc lại ranh giới: duyệt = gói đã tồn tại, KHÔNG phải nhà xe
                đã lên gói. Họ vẫn phải tự mua. */}
            <p>{t("customPlans.approvedHint")}</p>
            <code className="mt-2 block break-all text-xs text-gray-600">
              {request.approvedPlanId}
            </code>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
