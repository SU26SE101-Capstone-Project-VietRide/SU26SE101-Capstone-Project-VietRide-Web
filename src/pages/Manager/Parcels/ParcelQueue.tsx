import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheckCircle,
  FiPackage,
  FiRefreshCw,
  FiSearch,
  FiTruck,
} from "react-icons/fi";
import {
  confirmOperatorParcelRefund,
  getOperatorParcels,
  getParcelDetail,
  overrideOperatorParcelCapacity,
  requestOperatorParcelTransfer,
  returnOperatorParcel,
  type OperatorParcelListItem,
  type ParcelDetail,
  updateOperatorParcelStatus,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import Modal from "../../../components/Modal";
import Pagination from "../../../components/Pagination";
import { formatDateTime } from "../../../utils/date";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-vr-500 focus:outline-none focus:ring-2 focus:ring-vr-500/20";
const pageSize = 20;

type Translate = (key: string, options?: Record<string, unknown>) => string;

type ParcelFilter = {
  value: string;
  labelKey: string;
  status?: string;
  pendingActionType?: string;
};

const queueTabs: ParcelFilter[] = [
  { value: "ALL", labelKey: "all" },
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

const needsActionStatuses = new Set([
  "DELIVERY_REJECTED",
  "RETURN_INITIATED",
  "TRANSFER_ESCALATED",
]);

function actionLabel(
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

function needsAction(item: OperatorParcelListItem) {
  return (
    needsActionStatuses.has(item.status) ||
    item.status === "PENDING_OPERATOR_ACTION"
  );
}

function money(value?: number | null) {
  return value == null ? "-" : `${value.toLocaleString("vi-VN")} đ`;
}

function statusTone(item: OperatorParcelListItem) {
  if (needsAction(item)) return "bg-amber-50 text-amber-700 ring-amber-200";
  if (["DELIVERY_CONFIRMED", "RETURNED"].includes(item.status))
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["CANCELLED", "REJECTED", "EXPIRED"].includes(item.status))
    return "bg-gray-100 text-gray-600 ring-gray-200";
  return "bg-blue-50 text-blue-700 ring-blue-200";
}

type ConfirmState = { label: string; run: () => Promise<void> } | null;

export default function ParcelQueue() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const canOperate = getAuthUser()?.role === "OPERATOR_ADMIN";
  const [queue, setQueue] = useState("ALL");
  const [tripIdDraft, setTripIdDraft] = useState("");
  const [tripId, setTripId] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<OperatorParcelListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState<ParcelDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [reason, setReason] = useState("");
  const [targetTripId, setTargetTripId] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const activeFilter = queueTabs.find((tab) => tab.value === queue);
      const result = await getOperatorParcels({
        status: activeFilter?.status,
        pendingActionType: activeFilter?.pendingActionType,
        tripId: tripId || undefined,
        page,
        pageSize,
      });
      setItems(result.items);
      setTotalItems(result.totalItems);
    } catch (error) {
      setItems([]);
      setTotalItems(0);
      setListError(
        error instanceof Error ? error.message : t("parcels.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [page, queue, tripId, t]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadList(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadList]);

  async function openDetail(item: OperatorParcelListItem) {
    setDetailOpen(true);
    setDetailLoading(true);
    setActionError("");
    setMessage("");
    setReason("");
    setTargetTripId("");
    try {
      const detail = await getParcelDetail(item.parcelId);
      setSelected(detail);
    } catch (error) {
      setSelected(null);
      setActionError(
        error instanceof Error ? error.message : t("parcels.loadFailed"),
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function finishAction(
    successMessage: string,
    action: () => Promise<void>,
  ) {
    if (!selected || actionLoading) return;
    setActionLoading(true);
    setActionError("");
    try {
      await action();
      setMessage(successMessage);
      setDetailOpen(false);
      setSelected(null);
      await loadList();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t("parcels.actionFailed"),
      );
    } finally {
      setActionLoading(false);
      setConfirmState(null);
    }
  }

  function askConfirmation(label: string, action: () => Promise<void>) {
    setConfirmState({ label, run: action });
  }

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
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {t("parcels.queue.title")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t("parcels.queue.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadList()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FiRefreshCw /> {tc("refresh")}
          </button>
        </div>

        <div
          className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4"
          role="tablist"
          aria-label={t("parcels.queue.tabListAriaLabel")}
        >
          {queueTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={queue === tab.value}
              onClick={() => {
                setQueue(tab.value);
                setPage(1);
              }}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors ${queue === tab.value ? "border-vr-400 bg-vr-50 text-vr-800" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              <span>
                {tab.labelKey === "all"
                  ? tc("all")
                  : tab.labelKey.startsWith("enumLabels.")
                    ? tc(tab.labelKey)
                    : t(tab.labelKey)}
              </span>
            </button>
          ))}
        </div>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            setTripId(tripIdDraft.trim());
            setPage(1);
          }}
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{t("parcels.queue.filterByTripSr")}</span>
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={tripIdDraft}
              onChange={(event) => setTripIdDraft(event.target.value)}
              className={`${inputClass} pl-9`}
              placeholder={t("parcels.queue.tripIdPlaceholder")}
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-vr-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-vr-600"
          >
            {tc("search")}
          </button>
        </form>
      </div>

      {message && (
        <p
          className="mx-5 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          role="status"
        >
          {message}
        </p>
      )}
      {listError && (
        <p
          className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {listError}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <th className="px-5 py-3">{t("parcels.orderCode")}</th>
              <th className="px-5 py-3">{t("parcels.queue.colRoute")}</th>
              <th className="px-5 py-3">{t("parcels.recipient")}</th>
              <th className="px-5 py-3">{t("parcels.sizeCategory")}</th>
              <th className="px-5 py-3">{t("parcels.queue.colStatus")}</th>
              <th className="px-5 py-3 text-right">{tc("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.parcelId}
                onClick={() => void openDetail(item)}
                className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-vr-50/40"
              >
                <td className="px-5 py-4">
                  <p className="font-semibold text-gray-900">
                    {item.parcelCode}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatDateTime(item.createdAt)}
                  </p>
                </td>
                <td className="px-5 py-4 text-sm">
                  <p className="font-medium text-gray-800">
                    {item.routeName || t("parcels.queue.noRouteName")}
                  </p>
                  <p className="mt-1 text-gray-500">
                    {item.tripCode ||
                      item.tripId ||
                      t("parcels.queue.noTripAssigned")}
                  </p>
                </td>
                <td className="px-5 py-4 text-sm">
                  <p className="font-medium text-gray-800">
                    {item.recipientName || "-"}
                  </p>
                  <p className="mt-1 text-gray-500">
                    {item.recipientPhone || "-"}
                  </p>
                </td>
                <td className="px-5 py-4 text-sm text-gray-700">
                  {item.sizeCategory
                    ? t(`parcels.sizeCategories.${item.sizeCategory}`, {
                        defaultValue: item.sizeCategory,
                      })
                    : "-"}
                  <br />
                  <span className="text-xs text-gray-500">
                    {item.estimatedWeightKg == null
                      ? "-"
                      : `${item.estimatedWeightKg} kg`}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(item)}`}
                  >
                    {actionLabel(item, t, tc)}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void openDetail(item);
                    }}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-vr-300 hover:text-vr-700"
                  >
                    {t("parcels.queue.openAction")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && (
        <div className="px-5 py-12 text-center text-sm text-gray-500">
          {t("parcels.queue.loadingList")}
        </div>
      )}
      {!loading && !listError && items.length === 0 && (
        <div className="px-5 py-12 text-center">
          <FiPackage className="mx-auto text-gray-300" size={34} />
          <p className="mt-3 font-medium text-gray-700">
            {t("parcels.queue.emptyTitle")}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {t("parcels.queue.emptyHint")}
          </p>
        </div>
      )}
      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={setPage}
      />

      <Modal
        open={detailOpen}
        onClose={() => !actionLoading && setDetailOpen(false)}
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
            onClick={() => setDetailOpen(false)}
            disabled={actionLoading}
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-700"
          >
            {tc("close")}
          </button>
        }
      >
        {detailLoading ? (
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
                  value={selected.recipientPhone || "-"}
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
                    onChange={setReason}
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
                    onChange={setTargetTripId}
                  />
                  <TextArea
                    label={t("parcels.queue.resolutionReasonLabel")}
                    value={reason}
                    onChange={setReason}
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
                    onChange={setReason}
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
                    onChange={setReason}
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

      <Modal
        open={Boolean(confirmState)}
        onClose={() => !actionLoading && setConfirmState(null)}
        title={t("parcels.queue.confirmActionTitle")}
        subtitle={t("parcels.queue.confirmActionSubtitle")}
        icon={<FiCheckCircle />}
        footer={
          <>
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setConfirmState(null)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              disabled={actionLoading || !canOperate}
              onClick={() => void confirmState?.run()}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {actionLoading ? t("parcels.queue.processing") : tc("confirm")}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-700">{confirmState?.label}</p>
      </Modal>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}
function ActionBox({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
      <h3 className="font-bold text-gray-900">{title}</h3>
      {children}
    </section>
  );
}
function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </span>
      <input
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </span>
      <textarea
        className={`${inputClass} min-h-24`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
function ActionButton({
  children,
  icon,
  onClick,
  disabled,
  tone = "primary",
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  disabled: boolean;
  tone?: "primary" | "success" | "danger";
}) {
  const tones = {
    primary: "border-vr-200 bg-white text-vr-800 hover:bg-vr-50",
    success:
      "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
    danger: "border-red-200 bg-white text-red-700 hover:bg-red-50",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {icon}
      {children}
    </button>
  );
}
