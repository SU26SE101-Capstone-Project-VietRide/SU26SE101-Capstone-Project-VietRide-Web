// Panel duyệt báo cáo sự cố do phụ xe/tài xế gửi lên
// (`FE-Operator-Web-Parcel-Custody-Exception-Integration-Guide.md` §6).
//
// Ba luật của tài liệu được giữ nghiêm ở đây:
// - `custodyExceptionApproval` là NGUỒN DUY NHẤT của lý do/vị trí/bằng chứng;
//   dòng trong hàng đợi không mang các dữ liệu này (§6).
// - `actualLocationId` là UUID ĐỊA ĐIỂM, không phải id người báo hay người
//   duyệt (§6) — nên nó nằm trong khối "mã kỹ thuật", không đứng cạnh tên người.
// - Form duyệt KHÔNG có ô nhập UUID người duyệt: backend lấy người duyệt từ
//   JWT (§2 mục 3-5).
import { useTranslation } from "react-i18next";
import {
  FiAlertOctagon,
  FiCamera,
  FiCheckCircle,
  FiMapPin,
  FiUserCheck,
  FiXCircle,
} from "react-icons/fi";
import type {
  OperatorUserSummary,
  ParcelIncidentDetail,
} from "../../../api/vietride";
import EvidenceGallery from "../../../components/EvidenceGallery";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatDateTime } from "../../../utils/date";
import { parcelReasonLabel } from "../../../utils/parcelReason";
import { locationLabel } from "../../../utils/parcelReliability";
import { custodyApprovalTone, type CustodyApprovalUi } from "./incidentHelpers";

type CustodyApprovalPanelProps = {
  /** Kết quả của `getCustodyApprovalUi` — panel không tự suy trạng thái */
  ui: Exclude<CustodyApprovalUi, { kind: "NONE" }>;
  detail: ParcelIncidentDetail;
  onDecide: (decision: "APPROVE" | "REJECT") => void;
  disabled: boolean;
};

export default function CustodyApprovalPanel({
  ui,
  detail,
  onDecide,
  disabled,
}: CustodyApprovalPanelProps) {
  const { t } = useTranslation("manager");
  const approval = ui.approval;
  const isPending = ui.kind === "REVIEW_REQUIRED";

  // Người báo: tên lấy từ `detail.reporter` khi Identity Service khả dụng, còn
  // vai trò và thời điểm luôn lấy từ chính báo cáo.
  const reporterName = reporterDisplayName(
    detail.reporter ?? detail.incident.reporter,
    approval.reportedByUserId,
    t("parcelIncidents.unknownPerson"),
  );

  const frameClass = isPending
    ? "border-amber-300 bg-amber-50/60"
    : ui.kind === "APPROVED"
      ? "border-emerald-200 bg-emerald-50/50"
      : "border-gray-200 bg-gray-50/70";

  return (
    <section className={`rounded-xl border p-4 ${frameClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-bold text-gray-900">
            <FiAlertOctagon
              className={isPending ? "text-amber-700" : "text-gray-500"}
              aria-hidden="true"
            />
            {t("parcelIncidents.approval.title")}
          </h3>
          <p className="mt-1 text-sm text-gray-700">
            {isPending
              ? t("parcelIncidents.approval.pendingHint")
              : t("parcelIncidents.approval.decidedHint")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">
            {t(`parcelIncidents.type.${approval.incidentType}`, {
              defaultValue: approval.incidentType,
            })}
          </Badge>
          <Badge tone={custodyApprovalTone(approval.status)}>
            {t(`parcelIncidents.approval.statuses.${approval.status}`, {
              defaultValue: approval.status,
            })}
          </Badge>
        </div>
      </div>

      {/* Lý do là câu chữ người báo viết ra — đặt nổi nhất, không nhét vào bảng */}
      <blockquote className="mt-3 rounded-lg border-l-4 border-amber-400 bg-white px-3 py-2.5">
        <p className="text-xs text-gray-500">
          {t("parcelIncidents.approval.reasonLabel")}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-gray-900">
          {parcelReasonLabel(t, approval.reason) ||
            t("parcelIncidents.approval.noReason")}
        </p>
        {approval.description?.trim() && (
          <p className="mt-1.5 text-sm text-gray-700">{approval.description}</p>
        )}
      </blockquote>

      {/* Đối chiếu vị trí: nơi báo cáo ↔ nơi đáng lẽ phải tới ↔ nơi scan gần
          nhất. Đây là căn cứ chính để người duyệt tin hay không tin báo cáo. */}
      <div className="mt-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <FiMapPin size={13} aria-hidden="true" />
          {t("parcelIncidents.approval.locationCompareTitle")}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <CompareCard
            label={t("parcelIncidents.approval.reportedLocation")}
            value={
              approval.locationSnapshot?.trim() ||
              t(`parcelIncidents.locationTypes.${approval.actualLocationType}`, {
                defaultValue: approval.actualLocationType,
              })
            }
            hint={t(
              `parcelIncidents.locationTypes.${approval.actualLocationType}`,
              { defaultValue: approval.actualLocationType },
            )}
            emphasis
          />
          <CompareCard
            label={t("parcelIncidents.expectedDropoffLabel")}
            value={locationLabel(
              detail.expectedDropoff ?? detail.incident.expectedDropoff,
              t("parcelIncidents.unknownLocation"),
            )}
            hint={detail.trip?.route?.name || detail.incident.trip?.route?.name}
          />
          <CompareCard
            label={t("parcelIncidents.approval.lastConfirmedLocation")}
            value={
              detail.currentCustody?.lastLocationSnapshot?.trim() ||
              detail.incident.lastKnownLocation?.trim() ||
              t("parcelIncidents.unknownLocation")
            }
            hint={
              detail.currentCustody?.lastConfirmedAt
                ? formatDateTime(detail.currentCustody.lastConfirmedAt)
                : undefined
            }
          />
        </div>
      </div>

      <dl className="mt-3 grid gap-3 rounded-lg bg-white px-4 py-3 text-sm sm:grid-cols-3">
        <PanelItem
          label={t("parcelIncidents.approval.observedWeight")}
          value={
            approval.observedWeightKg == null
              ? "-"
              : t("parcelIncidents.approval.weightValue", {
                  value: approval.observedWeightKg,
                })
          }
        />
        <PanelItem
          label={t("parcelIncidents.approval.temporaryTag")}
          value={
            approval.temporaryExceptionTag?.trim()
              ? t(
                  `parcelIncidents.approval.temporaryTags.${approval.temporaryExceptionTag}`,
                  { defaultValue: approval.temporaryExceptionTag },
                )
              : "-"
          }
        />
        <PanelItem
          label={t("parcelIncidents.approval.parcelLabel")}
          value={
            detail.parcel?.parcelCode ||
            detail.incident.parcel?.parcelCode ||
            t("parcelIncidents.unknownParcel")
          }
        />
      </dl>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <FiUserCheck size={13} aria-hidden="true" />
            {t("parcelIncidents.approval.reportedBy")}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">
            {reporterName}
          </p>
          <p className="mt-0.5 text-xs text-gray-600">
            {t("parcelIncidents.approval.reportedMeta", {
              role: t(`parcelIncidents.actorRoles.${approval.reportedByRole}`, {
                defaultValue: approval.reportedByRole,
              }),
              at: formatDateTime(approval.reportedAt),
            })}
          </p>
        </div>

        {/* Sau khi duyệt, deadline tìm kiếm mới có giá trị. Khi báo cáo bị từ
            chối thì `searchDeadline` chỉ còn là dữ liệu audit (§7) — không hiện
            như một hạn còn hiệu lực. */}
        {ui.kind === "APPROVED" && approval.searchDeadline && (
          <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2.5">
            <p className="text-xs text-gray-500">
              {t("parcelIncidents.searchDeadline")}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-gray-900">
              {formatDateTime(approval.searchDeadline)}
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              {t("parcelIncidents.approval.slaStartedHint")}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <FiCamera size={13} aria-hidden="true" />
          {t("parcelIncidents.approval.evidenceTitle")}
        </p>
        <EvidenceGallery
          className="mt-2"
          references={approval.evidenceReferences ?? []}
          photoLabel={(index) =>
            t("parcelIncidents.approval.evidenceItem", { index })
          }
          emptyLabel={t("parcelIncidents.approval.evidenceEmpty")}
        />
      </div>

      {/* Người duyệt không cần UUID để làm việc, nhưng support thì cần. Gập lại
          để không có UUID nào chen vào phần đọc chính. */}
      <details className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-gray-600">
          {t("parcelIncidents.approval.technicalIds")}
        </summary>
        <dl className="mt-2 space-y-1.5 text-xs">
          <TechnicalId
            label={t("parcelIncidents.approval.requestIdLabel")}
            value={approval.requestId}
          />
          <TechnicalId
            label={t("parcelIncidents.approval.actualLocationIdLabel")}
            value={approval.actualLocationId}
          />
          <TechnicalId
            label={t("parcelIncidents.approval.reportedByUserIdLabel")}
            value={approval.reportedByUserId}
          />
          <TechnicalId
            label={t("parcelIncidents.approval.parcelIdLabel")}
            value={approval.parcelId}
          />
        </dl>
      </details>

      {/* Quyết định đã ghi nhận — hiện reviewer THẬT từ BE, kể cả khi người
          duyệt là đồng nghiệp vừa bấm trước mình (§10). */}
      {!isPending && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            {ui.kind === "APPROVED" ? (
              <FiCheckCircle className="text-emerald-600" aria-hidden="true" />
            ) : (
              <FiXCircle className="text-rose-600" aria-hidden="true" />
            )}
            {t(`parcelIncidents.approval.statuses.${approval.status}`, {
              defaultValue: approval.status,
            })}
          </p>
          <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
            <PanelItem
              label={t("parcelIncidents.approval.reviewedBy")}
              value={
                approval.reviewedByRole
                  ? t(`parcelIncidents.actorRoles.${approval.reviewedByRole}`, {
                      defaultValue: approval.reviewedByRole,
                    })
                  : "-"
              }
            />
            <PanelItem
              label={t("parcelIncidents.approval.reviewedAt")}
              value={
                approval.reviewedAt ? formatDateTime(approval.reviewedAt) : "-"
              }
            />
            <PanelItem
              label={t("parcelIncidents.approval.reviewNote")}
              value={approval.reviewNote?.trim() || "-"}
            />
          </dl>
        </div>
      )}

      {isPending && (
        <div className="mt-4 flex flex-col gap-2 border-t border-amber-200 pt-3 sm:flex-row sm:justify-end">
          <Button
            variant="danger"
            disabled={disabled}
            onClick={() => onDecide("REJECT")}
          >
            {t("parcelIncidents.approval.reject")}
          </Button>
          <Button
            variant="primary"
            disabled={disabled}
            onClick={() => onDecide("APPROVE")}
          >
            {t("parcelIncidents.approval.approve")}
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * Tên người báo. Identity Service hỏng thì `detail.reporter` rỗng — lúc đó lùi
 * về nhãn chung chứ KHÔNG hiện `reportedByUserId`, vì UUID không giúp điều độ
 * viên nhận ra ai và dễ bị đọc nhầm là mã địa điểm (UUID vẫn tra được ở khối
 * "mã kỹ thuật" bên dưới).
 *
 * `detail.reporter` là người báo của SỰ CỐ; chỉ dùng khi nó đúng là người gửi
 * báo cáo này — hai bên lệch nhau thì thà hiện "Chưa rõ" còn hơn gán nhầm tên.
 */
function reporterDisplayName(
  reporter: OperatorUserSummary | null | undefined,
  reportedByUserId: string,
  fallback: string,
) {
  const name = reporter?.displayName?.trim();
  if (!name) return fallback;
  if (reporter?.userId && reporter.userId !== reportedByUserId) return fallback;

  return name;
}

function CompareCard({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string | null;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-lg border px-3 py-2.5 ${
        emphasis ? "border-amber-300 bg-white" : "border-gray-200 bg-white"
      }`}
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-gray-900" title={value}>
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function PanelItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-gray-800" title={value}>
        {value}
      </dd>
    </div>
  );
}

function TechnicalId({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="break-all font-mono text-gray-700">{value?.trim() || "-"}</dd>
    </div>
  );
}
