// Modal chi tiết bưu kiện + các nhánh hành động theo trạng thái (actionKind)
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FiCheckCircle, FiPackage, FiTruck } from "react-icons/fi";
import {
  confirmOperatorParcelRefund,
  overrideOperatorParcelCapacity,
  requestOperatorParcelTransfer,
  returnOperatorParcel,
  type ParcelDetail,
  updateOperatorParcelStatus,
} from "../../../api/vietride";
import Modal from "../../../components/Modal";
import { DetailItem, DetailSection } from "../../../components/DetailLayout";
import { formatDateTime } from "../../../utils/date";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import { money } from "./parcelQueueHelpers";
import {
  ActionBox,
  ActionButton,

  Field,
  TextArea,
} from "./queueControls";

function HighlightItem({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-xl border border-vr-200 bg-vr-50/60 p-4 ${className}`}>
      <p className="text-xs font-semibold text-vr-800">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
type ParcelDetailModalProps = {
  open: boolean;
  onClose: () => void;
  selected: ParcelDetail | null;
  loading: boolean;
  actionLoading: boolean;
  actionError: string;
  canOperate: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  targetTripId: string;
  onTargetTripIdChange: (value: string) => void;
  askConfirmation: (label: string, action: () => Promise<void>) => void;
  finishAction: (
    successMessage: string,
    action: () => Promise<void>,
  ) => Promise<void>;
};

export default function ParcelDetailModal({
  open,
  onClose,
  selected,
  loading,
  actionLoading,
  actionError,
  canOperate,
  reason,
  onReasonChange,
  targetTripId,
  onTargetTripIdChange,
  askConfirmation,
  finishAction,
}: ParcelDetailModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const sizeCategoryLabel = (value?: string | null) => value ? t(`parcels.sizeCategories.${value}`, { defaultValue: value }) : "-";

  const actionKind = useMemo(() => {
    if (!selected) return "NONE";
    if (selected.status === "DELIVERY_REJECTED") return "RETURN";
    if (selected.status === "RETURN_INITIATED") return "MARK_RETURNED";
    if (selected.status === "TRANSFER_ESCALATED") return "TRANSFER";
    if (selected.status === "PENDING_OPERATOR_ACTION")
      return selected.pendingActionType || "NONE";
    return "NONE";
  }, [selected]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        selected
          ? t("parcels.queue.detailModalTitleWithCode", {
              code: selected.parcelCode,
            })
          : t("parcels.queue.detailModalTitleFallback")
      }
      subtitle={t("parcels.queue.detailModalSubtitle")}
      icon={<FiPackage />}
      wide
      footer={
        <button
          type="button"
          onClick={onClose}
          disabled={actionLoading}
          className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-700"
        >
          {tc("close")}
        </button>
      }
    >
      {loading ? (
        <p className="py-12 text-center text-sm text-gray-500">
          {t("parcels.queue.loadingDetail")}
        </p>
      ) : (
        selected && (
          <div className="space-y-6">
            <div className="space-y-4">
              <DetailSection title={t("parcels.queue.overviewSection")} columns="three">
                <DetailItem label={t("parcels.queue.statusLabel")} value={tc(`enumLabels.${selected.status}`, { defaultValue: selected.status.replaceAll("_", " ") })} />
                <DetailItem label={t("parcels.queue.pendingActionLabel")} value={selected.pendingActionType ? t(`parcels.pendingActions.${selected.pendingActionType}`, { defaultValue: selected.pendingActionType.replaceAll("_", " ") }) : "-"} />
                <DetailItem label={t("parcels.queue.createdAtLabel")} value={formatDateTime(selected.createdAt)} />
              </DetailSection>
              <DetailSection title={t("parcels.queue.routeSection")} columns="three">
                <DetailItem label={t("parcels.queue.routeNameLabel")} value={selected.route?.routeName || selected.routeName || `${selected.originStationName || "-"} → ${selected.destinationStationName || "-"}`} />
                <DetailItem label={t("parcels.queue.originLabel")} value={selected.route?.originStationName || selected.originStationName} />
                <DetailItem label={t("parcels.queue.destinationLabel")} value={selected.route?.destinationStationName || selected.destinationStationName} />

                <DetailItem label={t("parcels.queue.tripStatusLabel")} value={selected.trip?.status ? tc(`enumLabels.${selected.trip.status}`, { defaultValue: selected.trip.status }) : "-"} />
                <DetailItem label={t("parcels.queue.vehicleLabel")} value={selected.trip?.vehicle?.licensePlate} />
                <DetailItem label={t("parcels.queue.departureLabel")} value={selected.trip?.departureAt ? formatDateTime(selected.trip.departureAt) : "-"} />
                <DetailItem label={t("parcels.queue.arrivalLabel")} value={selected.trip?.arrivalEstimate ? formatDateTime(selected.trip.arrivalEstimate) : "-"} />
              </DetailSection>
              <DetailSection title={t("parcels.queue.peopleSection")} columns="two">
                <DetailItem label={t("parcels.queue.senderLabel")} value={`${selected.sender?.displayName || selected.senderName || "-"} · ${formatVietnamPhoneForDisplay(selected.sender?.phone || selected.senderPhone)}`} />
                <DetailItem label={t("parcels.recipient")} value={`${selected.recipient?.displayName || selected.recipientName || "-"} · ${formatVietnamPhoneForDisplay(selected.recipient?.phone || selected.recipientPhone)}`} />
                <DetailItem label={t("parcels.queue.descriptionLabel")} value={selected.description} />
              </DetailSection>
              <DetailSection title={t("parcels.queue.packageSection")} columns="four">
                <HighlightItem label={t("parcels.queue.actualSizeLabel")} value={sizeCategoryLabel(selected.actualSizeCategory || selected.estimatedSizeCategory || selected.sizeCategory)} />
                <HighlightItem label={t("parcels.queue.actualWeightLabel")} value={selected.actualWeightKg == null ? "-" : `${selected.actualWeightKg} kg`} />
                <HighlightItem label={t("parcels.queue.actualChargeableLabel")} value={selected.actualChargeableWeightKg == null ? "-" : `${selected.actualChargeableWeightKg} kg`} />
                <HighlightItem label={t("parcels.queue.actualVolumeLabel")} value={selected.actualVolumeM3 == null ? "-" : `${selected.actualVolumeM3} m³`} />
              </DetailSection>
              <DetailSection title={t("parcels.queue.paymentSection")} columns="four">
                <HighlightItem label={t("parcels.queue.finalTotalLabel")} value={money(selected.finalTotalPriceVnd ?? selected.estimatedTotalPriceVnd)} />
                <HighlightItem label={t("parcels.queue.depositPaidLabel")} value={money(selected.depositPaidVnd ?? selected.depositAmount)} />
                <HighlightItem label={t("parcels.queue.balanceRequiredLabel")} value={money(selected.balanceRequiredVnd)} />
                {(selected.refundDueVnd ?? selected.refundAmount ?? 0) > 0 && <DetailItem label={t("parcels.queue.refundDueLabel")} value={money(selected.refundDueVnd ?? selected.refundAmount)} />}
                {(selected.discountAmount ?? 0) > 0 && <DetailItem label={t("parcels.queue.discountLabel")} value={money(selected.discountAmount)} />}
                {(selected.forfeitedDepositVnd ?? 0) > 0 && <DetailItem label={t("parcels.queue.forfeitedLabel")} value={money(selected.forfeitedDepositVnd)} />}
              </DetailSection>
              <DetailSection title={t("parcels.queue.timelineSection")} columns="four">
                <DetailItem label={t("parcels.queue.finalPaymentDeadlineLabel")} value={selected.finalPaymentDeadline ? formatDateTime(selected.finalPaymentDeadline) : "-"} />
                <DetailItem label={t("parcels.queue.latestCheckInLabel")} value={selected.latestCheckInAt ? formatDateTime(selected.latestCheckInAt) : "-"} />
                <DetailItem label={t("parcels.queue.loadCutoffLabel")} value={selected.loadCutoffAt ? formatDateTime(selected.loadCutoffAt) : "-"} />
                <DetailItem label={t("parcels.queue.updatedAtLabel")} value={selected.updatedAt ? formatDateTime(selected.updatedAt) : "-"} />
              </DetailSection>
              {selected.photoUrl && <DetailSection title={t("parcels.queue.photoSection")} columns="two"><img src={selected.photoUrl} alt={t("parcels.queue.photoAlt")} loading="lazy" className="max-h-64 rounded-lg border border-gray-200 object-contain" /></DetailSection>}
              {selected.pendingActionReason && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><span className="font-semibold">{t("parcels.queue.pendingReasonLabel")}:</span> {selected.pendingActionReason}</p>}
            </div>            {actionError && (
              <p
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {actionError}
              </p>
            )}
            {actionKind === "REFUND_CONFIRMATION" && (
              <ActionBox title={t("parcels.confirmRefund")}>
                <TextArea
                  label={t("parcels.queue.confirmReasonLabel")}
                  value={reason}
                  onChange={onReasonChange}
                />
                <ActionButton
                  disabled={actionLoading || !canOperate}
                  tone="success"
                  icon={<FiCheckCircle />}
                  onClick={() =>
                    askConfirmation(
                      t("parcels.queue.confirmRefundQuestion"),
                      () =>
                        finishAction(
                          t("parcels.queue.refundConfirmedMsg"),
                          async () => {
                            if (!reason.trim())
                              throw new Error(
                                t("parcels.queue.reasonRequired"),
                              );
                            await confirmOperatorParcelRefund(
                              selected.parcelId,
                              { reason: reason.trim() },
                            );
                          },
                        ),
                    )
                  }
                >
                  {t("parcels.confirmRefund")}
                </ActionButton>
              </ActionBox>
            )}
            {(actionKind === "CAPACITY_EXCEEDED" ||
              actionKind === "RESERVE_FAILED" ||
              actionKind === "TRANSFER") && (
              <ActionBox title={t("parcels.queue.incidentTitle")}>
                <p className="text-sm text-gray-600">
                  {t("parcels.queue.incidentDescription")}
                </p>
                <Field
                  label={t("parcels.queue.targetTripLabel")}
                  value={targetTripId}
                  onChange={onTargetTripIdChange}
                />
                <TextArea
                  label={t("parcels.queue.resolutionReasonLabel")}
                  value={reason}
                  onChange={onReasonChange}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  {actionKind !== "TRANSFER" && (
                    <ActionButton
                      disabled={actionLoading || !canOperate}
                      icon={<FiTruck />}
                      onClick={() =>
                        askConfirmation(
                          t("parcels.queue.allowCapacityQuestion"),
                          () =>
                            finishAction(
                              t("parcels.queue.capacityAllowedMsg"),
                              async () => {
                                if (!reason.trim())
                                  throw new Error(
                                    t("parcels.queue.reasonRequired"),
                                  );
                                await overrideOperatorParcelCapacity(
                                  selected.parcelId,
                                  { reason: reason.trim() },
                                );
                              },
                            ),
                        )
                      }
                    >
                      {t("parcels.queue.allowControlledLabel")}
                    </ActionButton>
                  )}
                  <ActionButton
                    disabled={actionLoading || !canOperate}
                    icon={<FiTruck />}
                    onClick={() =>
                      askConfirmation(
                        t("parcels.queue.transferRequestQuestion"),
                        () =>
                          finishAction(
                            t("parcels.queue.transferRequestSentMsg"),
                            async () => {
                              if (!targetTripId.trim() || !reason.trim())
                                throw new Error(
                                  t("parcels.queue.transferFieldsRequired"),
                                );
                              await requestOperatorParcelTransfer(
                                selected.parcelId,
                                {
                                  targetTripId: targetTripId.trim(),
                                  reason: reason.trim(),
                                },
                              );
                            },
                          ),
                      )
                    }
                  >
                    {t("parcels.queue.transferToOtherTrip")}
                  </ActionButton>
                </div>
              </ActionBox>
            )}
            {actionKind === "RETURN" && (
              <ActionBox title={t("parcels.queue.initReturnTitle")}>
                <TextArea
                  label={t("parcels.queue.returnReasonLabel")}
                  value={reason}
                  onChange={onReasonChange}
                />
                <ActionButton
                  disabled={actionLoading || !canOperate}
                  tone="danger"
                  icon={<FiPackage />}
                  onClick={() =>
                    askConfirmation(
                      t("parcels.queue.returnConfirmQuestion"),
                      () =>
                        finishAction(
                          t("parcels.queue.returnInitiatedMsg"),
                          async () => {
                            if (!reason.trim())
                              throw new Error(
                                t("parcels.queue.reasonRequired"),
                              );
                            await returnOperatorParcel(selected.parcelId, {
                              returnReason: reason.trim(),
                            });
                          },
                        ),
                    )
                  }
                >
                  {t("parcels.queue.returnButtonLabel")}
                </ActionButton>
              </ActionBox>
            )}
            {actionKind === "MARK_RETURNED" && (
              <ActionBox title={t("parcels.queue.completeReturnTitle")}>
                <TextArea
                  label={t("parcels.queue.noteLabel")}
                  value={reason}
                  onChange={onReasonChange}
                />
                <ActionButton
                  disabled={actionLoading || !canOperate}
                  tone="success"
                  icon={<FiCheckCircle />}
                  onClick={() =>
                    askConfirmation(
                      t("parcels.queue.markReturnedQuestion"),
                      () =>
                        finishAction(
                          t("parcels.queue.markReturnedMsg"),
                          async () => {
                            if (!reason.trim())
                              throw new Error(
                                t("parcels.queue.noteRequired"),
                              );
                            await updateOperatorParcelStatus(
                              selected.parcelId,
                              {
                                targetStatus: "RETURNED",
                                reason: reason.trim(),
                              },
                            );
                          },
                        ),
                    )
                  }
                >
                  {t("parcels.queue.markReturnedButton")}
                </ActionButton>
              </ActionBox>
            )}
            {actionKind === "NONE" && (
              <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                {t("parcels.queue.noActionText")}
              </p>
            )}
          </div>
        )
      )}
    </Modal>
  );
}
