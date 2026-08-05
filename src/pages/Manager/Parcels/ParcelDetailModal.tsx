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
import { formatDateTime } from "../../../utils/date";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import { money } from "./parcelQueueHelpers";
import {
  ActionBox,
  ActionButton,
  Detail,
  Field,
  TextArea,
} from "./queueControls";

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
            <div className="grid gap-4 border-b border-gray-200 pb-5 sm:grid-cols-2 lg:grid-cols-3">
              <Detail
                label={t("parcels.queue.statusLabel")}
                value={tc(`enumLabels.${selected.status}`, {
                  defaultValue: selected.status.replaceAll("_", " "),
                })}
              />
              <Detail
                label={t("parcels.queue.pendingActionLabel")}
                value={
                  selected.pendingActionType
                    ? t(
                        `parcels.pendingActions.${selected.pendingActionType}`,
                        {
                          defaultValue: selected.pendingActionType.replaceAll(
                            "_",
                            " ",
                          ),
                        },
                      )
                    : "-"
                }
              />
              <Detail
                label={t("parcels.recipient")}
                value={selected.recipientName}
              />
              <Detail
                label={t("parcels.queue.phoneLabel")}
                value={formatVietnamPhoneForDisplay(selected.recipientPhone)}
              />
              <Detail
                label={t("parcels.queue.routeLabel")}
                value={`${selected.originStationName || "-"} → ${selected.destinationStationName || "-"}`}
              />
              <Detail
                label={t("parcels.queue.sizeWeightLabel")}
                value={`${t(`parcels.sizeCategories.${selected.sizeCategory}`, { defaultValue: selected.sizeCategory })} / ${selected.estimatedWeightKg} kg`}
              />
              <Detail
                label={t("parcels.queue.feeLabel")}
                value={money(selected.depositAmount)}
              />
              <Detail
                label={t("parcels.queue.refundLabel")}
                value={money(selected.refundAmount)}
              />
              <Detail
                label={t("parcels.queue.createdAtLabel")}
                value={formatDateTime(selected.createdAt)}
              />
            </div>
            {actionError && (
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
