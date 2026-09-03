// Chi tiết một khiếu nại lại (§12 playbook Parcel Reliability v2).
//
// Payload appeal chỉ có tiền và UUID: không mã kiện, không tên khách, không
// policy. Một mình nó không đủ để ai đó ra quyết định, nên màn này nạp THÊM
// claim gốc làm ngữ cảnh. Đây KHÔNG phải N+1 bị cấm ở §3 — luật đó nói về việc
// gọi detail cho từng dòng hàng đợi; ở đây là một lượt nạp cho đúng một hồ sơ
// người dùng đang mở, và hỏng thì vẫn xem được appeal.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertTriangle,
  FiDollarSign,
  FiFileText,
  FiPackage,
  FiRotateCcw,
} from "react-icons/fi";
import {
  getOperatorParcelClaim,
  type ParcelClaimAppeal,
  type ParcelClaimDetail,
} from "../../../api/vietride";
import Modal from "../../../components/Modal";
import InlineAlert from "../../../components/InlineAlert";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatCurrency } from "../../../utils/currency";
import { formatDateTime } from "../../../utils/date";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import {
  claimStatusTone,
  fundingStatusTone,
  proofStatusTranslationKey,
} from "../Claims/claimHelpers";
import AppealDecisionModal from "./AppealDecisionModal";
import { appealStatusTone, hasAppealAction } from "./appealHelpers";
import { CANONICAL_DATA_REFRESH_EVENT } from "../../../utils/canonicalDataRefresh";
import ClaimEvidenceCard from "../Claims/ClaimEvidenceCard";

type AppealDetailModalProps = {
  open: boolean;
  appeal: ParcelClaimAppeal | null;
  isLoading: boolean;
  error: string;
  /** Endpoint decision chỉ nhận OPERATOR_ADMIN — staff chỉ được xem. */
  canDecide: boolean;
  onClose: () => void;
  onAppealChange: (appeal: ParcelClaimAppeal) => void;
  onMessage: (message: string) => void;
};

export default function AppealDetailModal({
  open,
  appeal,
  isLoading,
  error,
  canDecide,
  onClose,
  onAppealChange,
  onMessage,
}: AppealDetailModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [isDecisionOpen, setIsDecisionOpen] = useState(false);
  const [canonicalRefreshVersion, setCanonicalRefreshVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setCanonicalRefreshVersion((current) => current + 1);
    window.addEventListener(CANONICAL_DATA_REFRESH_EVENT, refresh);
    return () =>
      window.removeEventListener(CANONICAL_DATA_REFRESH_EVENT, refresh);
  }, []);

  // Ngữ cảnh claim gốc. Giữ kèm `claimId` để lượt nạp của hồ sơ trước không
  // hiện nhầm dưới hồ sơ đang mở.
  const [claimContext, setClaimContext] = useState<{
    claimId: string;
    detail: ParcelClaimDetail | null;
    failed: boolean;
  }>({ claimId: "", detail: null, failed: false });

  const claimId = appeal?.claimId ?? "";

  useEffect(() => {
    if (!open || !claimId) return;

    let ignore = false;

    async function loadClaim() {
      try {
        const detail = await getOperatorParcelClaim(claimId);
        if (!ignore) setClaimContext({ claimId, detail, failed: false });
      } catch {
        // Claim gốc có thể thuộc tenant khác hoặc upstream lỗi. Không chặn màn:
        // appeal vẫn quyết định được, chỉ mất phần đối chiếu.
        if (!ignore) setClaimContext({ claimId, detail: null, failed: true });
      }
    }

    void loadClaim();
    return () => {
      ignore = true;
    };
  }, [canonicalRefreshVersion, claimId, open]);

  const claim =
    claimContext.claimId === claimId ? claimContext.detail : null;
  const claimFailed = claimContext.claimId === claimId && claimContext.failed;

  const showDecide =
    canDecide && hasAppealAction(appeal?.availableActions, "DECIDE_APPEAL");

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        wide
        icon={<FiRotateCcw size={20} />}
        title={t("claimAppeals.detailTitle")}
        subtitle={
          appeal
            ? t("claimAppeals.submittedAt", {
                at: formatDateTime(appeal.submittedAt),
              })
            : undefined
        }
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            {showDecide && (
              <Button
                variant="primary"
                onClick={() => setIsDecisionOpen(true)}
                disabled={!claim}
              >
                {t("claimAppeals.actions.DECIDE_APPEAL")}
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
        ) : isLoading || !appeal ? (
          <p className="rounded-lg bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
            {tc("loading")}
          </p>
        ) : (
          <div className="space-y-5">
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-gray-900">
                    {t("claimAppeals.requestLabel")}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {t("claimAppeals.submittedAt", {
                      at: formatDateTime(appeal.submittedAt),
                    })}
                  </p>
                </div>
                <Badge tone={appealStatusTone(appeal.status)}>
                  {t(`claimAppeals.status.${appeal.status}`, {
                    defaultValue: t("claimAppeals.unknownStatus"),
                  })}
                </Badge>
              </div>

              {/* Claim gốc GIỮ NGUYÊN trạng thái của nó trong suốt vòng đời
                  appeal (§12) — nói rõ ra để không ai đi sửa claim theo tay. */}
              <p className="mt-3 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                {t("claimAppeals.originalClaimNote", {
                  status: t(`claims.status.${appeal.originalClaimStatus}`, {
                    defaultValue: t("claimAppeals.unknownStatus"),
                  }),
                  amount: formatCurrency(appeal.originalTotalAwardVnd),
                })}
              </p>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <FiFileText className="text-vr-900" aria-hidden="true" />
                {t("claimAppeals.reasonTitle")}
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
                {appeal.reason}
              </p>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <FiDollarSign className="text-vr-900" aria-hidden="true" />
                {t("claimAppeals.moneyTitle")}
              </h3>
              <dl className="mt-3 grid gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm sm:grid-cols-3">
                <DetailItem
                  label={t("claimAppeals.originalTotal")}
                  value={formatCurrency(appeal.originalTotalAwardVnd)}
                />
                <DetailItem
                  label={t("claimAppeals.revisedTotal")}
                  value={formatCurrency(appeal.revisedTotalAwardVnd)}
                />
                <DetailItem
                  label={t("claimAppeals.revisedProvenLoss")}
                  value={formatCurrency(appeal.revisedProvenDirectLossVnd)}
                />
                <DetailItem
                  label={t("claimAppeals.revisedCargoAward")}
                  value={formatCurrency(appeal.revisedCargoAwardVnd)}
                />
                <DetailItem
                  label={t("claimAppeals.revisedFreightRefund")}
                  value={formatCurrency(appeal.revisedFreightRefundVnd)}
                />
                <DetailItem
                  label={t("claims.proofAssessment")}
                  value={t(
                    proofStatusTranslationKey(
                      appeal.proofStatus,
                      appeal.status,
                    ),
                  )}
                />
                <DetailItem
                  label={t("claims.acceptedEvidenceCount")}
                  value={String((appeal.acceptedEvidenceIds ?? []).length)}
                />
              </dl>

              {appeal.proofStatus === "UNVERIFIED" ||
              appeal.proofStatus === "NO_PROOF" ? (
                <div className="mt-3">
                  <InlineAlert tone="warning">
                    <p>{t("claims.noVerifiedProofNotice")}</p>
                  </InlineAlert>
                </div>
              ) : null}

              {/* Khoản bổ sung là con số nghiệp vụ quan trọng nhất của màn:
                  đây là phần DUY NHẤT được gửi sang Payment, và Payment dùng
                  `appealId` làm reference chứ không dùng lại claim ID (§12). */}
              <div className="mt-3 rounded-lg border border-vr-100 bg-vr-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-vr-900">
                  {t("claimAppeals.supplementaryTitle")}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-vr-900">
                  {formatCurrency(appeal.supplementaryAwardVnd)}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {t("claimAppeals.supplementaryHint")}
                </p>
              </div>

              {(appeal.acceptedEvidenceIds ?? []).length > 0 ? (
                <div className="mt-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t("claims.acceptedEvidenceLabel")}
                  </p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {(appeal.acceptedEvidenceIds ?? []).map((evidenceId) => {
                      const evidence = claim?.claim.evidence.find(
                        (item) => item.evidenceId === evidenceId,
                      );
                      return evidence ? (
                        <ClaimEvidenceCard
                          key={evidenceId}
                          evidence={evidence}
                          accepted
                        />
                      ) : (
                        <p
                          key={evidenceId}
                          className="break-all rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700"
                        >
                          {evidenceId}
                        </p>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>

            {(appeal.decisionReason?.trim() || appeal.decidedAt) && (
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-bold text-gray-900">
                  {t("claimAppeals.decisionReasonTitle")}
                </h3>
                <p className="mt-1 text-sm text-gray-700">
                  {appeal.decisionReason?.trim() || "-"}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {appeal.decidedAt ? formatDateTime(appeal.decidedAt) : "-"}
                </p>
              </section>
            )}

            {/* `FUNDING_PENDING` = nhà xe chưa đủ nguồn cho KHOẢN BỔ SUNG.
                VietRide không ứng trước, và FE tuyệt đối không tự đổi trạng
                thái này thành `PAID` (§11, §12). */}
            {appeal.status === "FUNDING_PENDING" && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {t("claimAppeals.fundingPendingNote")}
              </p>
            )}

            {appeal.paidAt && (
              <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <h3 className="text-sm font-bold text-gray-900">
                  {t("claimAppeals.payoutTitle")}
                </h3>
                <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                  <DetailItem
                    label={t("claimAppeals.paidAt")}
                    value={formatDateTime(appeal.paidAt)}
                  />
                </dl>
              </section>
            )}

            {/* Ngữ cảnh claim gốc — chỉ để ĐỌC. Mọi thao tác với claim nằm ở
                hàng đợi Khiếu nại. */}
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <FiPackage className="text-vr-900" aria-hidden="true" />
                {t("claimAppeals.claimContextTitle")}
              </h3>

              {claimFailed ? (
                <p className="mt-2 flex items-start gap-2 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  <FiAlertTriangle
                    className="mt-0.5 shrink-0 text-amber-500"
                    aria-hidden="true"
                  />
                  {t("claimAppeals.claimContextFailed")}
                </p>
              ) : !claim ? (
                <p className="mt-2 rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  {tc("loading")}
                </p>
              ) : (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone={claimStatusTone(claim.claim.status)}>
                      {t(`claims.status.${claim.claim.status}`, {
                        defaultValue: t("claimAppeals.unknownStatus"),
                      })}
                    </Badge>
                    <Badge tone={fundingStatusTone(claim.fundingStatus)}>
                      {t(`claims.funding.${claim.fundingStatus}`, {
                        defaultValue: t("claimAppeals.unknownStatus"),
                      })}
                    </Badge>
                  </div>
                  <dl className="mt-3 grid gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm sm:grid-cols-3">
                    <DetailItem
                      label={t("claimAppeals.parcelLabel")}
                      value={
                        claim.parcel?.parcelCode || t("claims.unknownParcel")
                      }
                    />
                    <DetailItem
                      label={t("claimAppeals.beneficiaryLabel")}
                      value={
                        claim.beneficiary?.displayName?.trim() ||
                        t("claims.unknownPerson")
                      }
                    />
                    <DetailItem
                      label={t("claimAppeals.beneficiaryPhone")}
                      value={
                        claim.beneficiary?.phone?.trim()
                          ? formatVietnamPhoneForDisplay(
                              claim.beneficiary.phone.trim(),
                            )
                          : "-"
                      }
                    />
                    <DetailItem
                      label={t("claims.declaredValue")}
                      value={formatCurrency(claim.claim.declaredValueVnd)}
                    />
                    <DetailItem
                      label={t("claims.provenLoss")}
                      value={formatCurrency(claim.claim.provenDirectLossVnd)}
                    />
                    <DetailItem
                      label={t("claimAppeals.evidenceCount")}
                      value={String(claim.claim.evidence.length)}
                    />
                  </dl>
                  {claim.claim.policySnapshot && (
                    <p className="mt-2 text-xs text-gray-600">
                      {t("claimAppeals.policySnapshotHint", {
                        rate: claim.claim.policySnapshot
                          .compensationRatePercent,
                        cap: formatCurrency(
                          claim.claim.policySnapshot.maxCompensationVnd,
                        ),
                      })}
                    </p>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </Modal>

      {/* `key` theo appeal: đổi hồ sơ là form được dựng lại sạch, không cần
          effect dọn state. */}
      <AppealDecisionModal
        key={appeal?.appealId ?? ""}
        open={isDecisionOpen}
        appeal={appeal}
        claimDetail={claim}
        onClose={() => setIsDecisionOpen(false)}
        onDecided={(next, decisionMessage) => {
          setIsDecisionOpen(false);
          onAppealChange(next);
          onMessage(decisionMessage);
        }}
        onEvidenceStale={(freshClaim, staleMessage) => {
          setIsDecisionOpen(false);
          setClaimContext({
            claimId: freshClaim.claim.claimId,
            detail: freshClaim,
            failed: false,
          });
          onMessage(staleMessage);
        }}
      />
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-gray-800" title={value}>
        {value}
      </dd>
    </div>
  );
}
