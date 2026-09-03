// Chi tiết một khiếu nại bồi thường (§7.2).
//
// Hai luật giữ nghiêm, giống màn Sự cố:
// - Nút quyết định CHỈ hiện theo `availableActions` của BE, và thêm một lớp vai
//   trò vì endpoint decision chỉ nhận OPERATOR_ADMIN.
// - Mutation trả detail mới → thay thẳng vào state, không refetch.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiClock,
  FiFileText,
  FiPackage,
  FiShield,
  FiUser,
} from "react-icons/fi";
import type { ParcelClaimDetail } from "../../../api/vietride";
import Modal from "../../../components/Modal";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatCurrency } from "../../../utils/currency";
import { formatDateTime } from "../../../utils/date";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import { locationLabel, slaTone } from "../../../utils/parcelReliability";
import ClaimDecisionModal from "./ClaimDecisionModal";
import {
  claimStatusTone,
  fundingStatusTone,
  hasClaimAction,
  proofStatusTranslationKey,
} from "./claimHelpers";

type ClaimDetailModalProps = {
  open: boolean;
  detail: ParcelClaimDetail | null;
  isLoading: boolean;
  error: string;
  /** Endpoint decision chỉ nhận OPERATOR_ADMIN — staff chỉ được xem. */
  canDecide: boolean;
  onClose: () => void;
  onDetailChange: (detail: ParcelClaimDetail) => void;
  onMessage: (message: string) => void;
};

export default function ClaimDetailModal({
  open,
  detail,
  isLoading,
  error,
  canDecide,
  onClose,
  onDetailChange,
  onMessage,
}: ClaimDetailModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [isDecisionOpen, setIsDecisionOpen] = useState(false);

  const claim = detail?.claim ?? null;
  const snapshot = claim?.policySnapshot ?? null;
  const showDecide =
    canDecide && hasClaimAction(detail?.availableActions, "DECIDE_CLAIM");

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        wide
        icon={<FiShield size={20} />}
        title={t("claims.detailTitle")}
        subtitle={detail?.parcel?.parcelCode}
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            {showDecide && (
              <Button variant="primary" onClick={() => setIsDecisionOpen(true)}>
                {t("claims.actions.DECIDE_CLAIM")}
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              {tc("close")}
            </Button>
          </div>
        }
      >
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        ) : isLoading || !detail || !claim ? (
          <p className="rounded-lg bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
            {tc("loading")}
          </p>
        ) : (
          <div className="space-y-5">
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-lg font-bold text-gray-900">
                    <FiPackage className="text-vr-900" aria-hidden="true" />
                    {detail.parcel?.parcelCode || t("claims.unknownParcel")}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {detail.parcel?.description?.trim() ||
                      t("claims.noDescription")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={claimStatusTone(claim.status)}>
                    {t(`claims.status.${claim.status}`, {
                      defaultValue: t("claims.status.UNKNOWN"),
                    })}
                  </Badge>
                  <Badge tone={fundingStatusTone(detail.fundingStatus)}>
                    {t(`claims.funding.${detail.fundingStatus}`, {
                      defaultValue: t("claims.funding.UNKNOWN"),
                    })}
                  </Badge>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm sm:grid-cols-3">
                <DetailItem
                  label={t("claims.declaredValue")}
                  value={formatCurrency(claim.declaredValueVnd)}
                />
                <DetailItem
                  label={t("claims.provenLoss")}
                  value={formatCurrency(claim.provenDirectLossVnd)}
                />
                <DetailItem
                  label={t("claims.totalAward")}
                  value={formatCurrency(claim.totalAwardVnd)}
                />
                <DetailItem
                  label={t("claims.cargoAward")}
                  value={formatCurrency(claim.cargoAwardVnd)}
                />
                <DetailItem
                  label={t("claims.freightRefund")}
                  value={formatCurrency(claim.freightRefundVnd)}
                />
                <DetailItem
                  label={t("claims.evidenceCount")}
                  value={String(claim.evidence.length)}
                />
                <DetailItem
                  label={t("claims.proofAssessment")}
                  value={t(
                    proofStatusTranslationKey(claim.proofStatus, claim.status),
                  )}
                />
                <DetailItem
                  label={t("claims.acceptedEvidenceCount")}
                  value={String((claim.acceptedEvidenceIds ?? []).length)}
                />
              </dl>
            </section>

            {/* Mức đền là bản CHỤP lúc tạo đơn, không phải cấu hình hiện hành —
                nói rõ để người duyệt không đi đối chiếu nhầm màn Cấu hình. */}
            {snapshot && (
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <FiShield className="text-vr-900" aria-hidden="true" />
                  {t("claims.policySnapshotTitle", {
                    version: snapshot.version,
                  })}
                </h3>
                <p className="mt-1 text-xs text-gray-600">
                  {t("claims.policySnapshotHint")}
                </p>
                <dl className="mt-3 grid gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm sm:grid-cols-3">
                  <DetailItem
                    label={t("claims.snapshotRate")}
                    value={`${snapshot.compensationRatePercent}%`}
                  />
                  <DetailItem
                    label={t("claims.snapshotCap")}
                    value={formatCurrency(snapshot.maxCompensationVnd)}
                  />
                  <DetailItem
                    label={t("claims.snapshotMultiplier")}
                    value={`× ${snapshot.noProofFallbackMultiplier}`}
                  />
                </dl>
              </section>
            )}

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <FiUser className="text-vr-900" aria-hidden="true" />
                  {t("claims.beneficiary")}
                </h3>
                <p className="mt-2 text-sm font-semibold text-gray-800">
                  {detail.beneficiary?.displayName?.trim() ||
                    t("claims.unknownPerson")}
                </p>
                <p className="mt-0.5 text-sm text-gray-600">
                  {detail.beneficiary?.phone
                    ? formatVietnamPhoneForDisplay(detail.beneficiary.phone)
                    : "-"}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <FiClock className="text-vr-900" aria-hidden="true" />
                  {t("claims.deadlines")}
                </h3>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <DeadlineRow
                    label={t("claims.decisionDeadline")}
                    value={claim.decisionDeadline}
                  />
                  <DeadlineRow
                    label={t("claims.payoutDeadline")}
                    value={claim.payoutDeadline}
                  />
                  <DeadlineRow
                    label={t("claims.decidedAt")}
                    value={claim.decidedAt}
                  />
                  <DeadlineRow label={t("claims.paidAt")} value={claim.paidAt} />
                </dl>
              </div>
            </section>

            {detail.incident && (
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-bold text-gray-900">
                  {t("claims.linkedIncident")}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-700">
                  <Badge tone="neutral">
                    {t(`parcelIncidents.type.${detail.incident.type}`, {
                      defaultValue: t("claims.unknownIncidentType"),
                    })}
                  </Badge>
                  <Badge tone="neutral">
                    {t(`parcelIncidents.status.${detail.incident.status}`, {
                      defaultValue: t("claims.unknownIncidentStatus"),
                    })}
                  </Badge>
                  {detail.incident.slaState && (
                    <Badge tone={slaTone(detail.incident.slaState)}>
                      {t(`parcelIncidents.sla.${detail.incident.slaState}`, {
                        defaultValue: t("parcelIncidents.sla.UNKNOWN"),
                      })}
                    </Badge>
                  )}
                  {detail.incident.operatorProcessBreach && (
                    <Badge tone="danger">{t("claims.processBreach")}</Badge>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-600">
                  {t("claims.lastCustody", {
                    location: locationLabel(
                      detail.currentCustody?.lastConfirmedLocation,
                      t("claims.unknownLocation"),
                      (type) =>
                        t(`parcelIncidents.locationTypes.${type}`, {
                          defaultValue: t("claims.unknownLocation"),
                        }),
                    ),
                    at: detail.currentCustody?.lastConfirmedAt
                      ? formatDateTime(detail.currentCustody.lastConfirmedAt)
                      : "-",
                  })}
                </p>
              </section>
            )}

            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <FiFileText className="text-vr-900" aria-hidden="true" />
                {t("claims.evidenceTitle")}
              </h3>
              {claim.evidence.length === 0 ? (
                <p className="mt-2 rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  {t("claims.evidenceEmpty")}
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {claim.evidence.map((item) => (
                    <li
                      key={item.evidenceId}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge tone="neutral">
                          {t(`claims.evidenceType.${item.evidenceType}`, {
                            defaultValue: t("claims.evidenceType.OTHER"),
                          })}
                        </Badge>
                        {(claim.acceptedEvidenceIds ?? []).includes(
                          item.evidenceId,
                        ) ? (
                          <Badge tone="success">
                            {t("claims.evidenceAccepted")}
                          </Badge>
                        ) : null}
                        <span className="text-xs text-gray-500">
                          {formatDateTime(item.createdAt)}
                        </span>
                      </div>
                      {/* Reference do người gửi nhập, không phải lúc nào cũng là
                          URL — chỉ mở tab mới khi thật sự là http(s). */}
                      {/^https?:\/\//i.test(item.reference) ? (
                        <a
                          href={item.reference}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-1 block break-all text-sm font-medium text-vr-900 underline"
                        >
                          {item.reference}
                        </a>
                      ) : (
                        <p className="mt-1 break-all text-sm text-gray-700">
                          {item.reference}
                        </p>
                      )}
                      {item.note?.trim() && (
                        <p className="mt-1 text-xs text-gray-600">
                          {item.note}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {claim.decisionReason?.trim() && (
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-bold text-gray-900">
                  {t("claims.decisionReasonTitle")}
                </h3>
                <p className="mt-1 text-sm text-gray-700">
                  {claim.decisionReason}
                </p>
              </section>
            )}

            {claim.appealReason?.trim() && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-bold text-amber-900">
                  {t("claims.appealTitle")}
                </h3>
                <p className="mt-1 text-sm text-amber-800">
                  {claim.appealReason}
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  {claim.appealedAt ? formatDateTime(claim.appealedAt) : "-"}
                </p>
              </section>
            )}
          </div>
        )}
      </Modal>

      <ClaimDecisionModal
        key={claim?.claimId ?? ""}
        open={isDecisionOpen}
        detail={detail}
        onClose={() => setIsDecisionOpen(false)}
        onDecided={(next, message) => {
          setIsDecisionOpen(false);
          onDetailChange(next);
          onMessage(message);
        }}
      />
    </>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-gray-800" title={value}>
        {value}
      </dd>
    </div>
  );
}

function DeadlineRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-800">
        {value ? formatDateTime(value) : "-"}
      </dd>
    </div>
  );
}
