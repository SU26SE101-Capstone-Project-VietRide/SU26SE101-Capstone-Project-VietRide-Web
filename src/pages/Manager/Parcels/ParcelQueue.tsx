import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import CustomSelect from "../../../components/CustomSelect";
import { useTranslation } from "react-i18next";
import { FiCheckCircle, FiSearch } from "react-icons/fi";
import {
  getOperatorParcels,
  getParcelDetail,
  type OperatorParcelListItem,
  type ParcelDetail,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import Modal from "../../../components/Modal";
import { PersonnelTable } from "../../../components/PersonnelTable";
import { formatDateTime } from "../../../utils/date";
import ParcelDetailModal from "./ParcelDetailModal";
import {
  actionLabel,
  pageSize,
  queueTabs,
  statusTone,
} from "./parcelQueueHelpers";

type ConfirmState = { label: string; run: () => Promise<void> } | null;

export default function ParcelQueue() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
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
        error instanceof Error ? error.message : tRef.current("parcels.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [page, queue, tripId]);

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
      setSelected({
        ...detail,
        route: detail.route ?? item.route,
        trip: detail.trip ?? item.trip,
        routeName: detail.routeName ?? item.route?.routeName ?? item.routeName,
        senderName: detail.senderName ?? item.sender?.displayName ?? item.sender?.name ?? item.senderName,
        senderPhone: detail.senderPhone ?? item.sender?.phone ?? item.senderPhone,
        recipientName: detail.recipientName ?? item.recipient?.displayName ?? item.recipient?.name ?? item.recipientName,
        recipientPhone: detail.recipientPhone ?? item.recipient?.phone ?? item.recipientPhone ?? undefined,
        pendingActionType: detail.pendingActionType ?? item.pendingActionType,
        pendingActionReason: detail.pendingActionReason ?? item.pendingActionReason,
        photoUrl: detail.photoUrl ?? item.photoUrl,
        estimatedSizeCategory: detail.estimatedSizeCategory ?? item.estimatedSizeCategory,
        actualSizeCategory: detail.actualSizeCategory ?? item.actualSizeCategory,
        estimatedWeightKg: detail.estimatedWeightKg ?? item.estimatedWeightKg ?? 0,
        actualWeightKg: detail.actualWeightKg ?? item.actualWeightKg,
        estimatedChargeableWeightKg: detail.estimatedChargeableWeightKg ?? item.estimatedChargeableWeightKg,
        actualChargeableWeightKg: detail.actualChargeableWeightKg ?? item.actualChargeableWeightKg,
        estimatedVolumeM3: detail.estimatedVolumeM3 ?? item.estimatedVolumeM3,
        actualVolumeM3: detail.actualVolumeM3 ?? item.actualVolumeM3,
        estimatedTotalPriceVnd: detail.estimatedTotalPriceVnd ?? item.estimatedTotalPriceVnd,
        finalTotalPriceVnd: detail.finalTotalPriceVnd ?? item.finalTotalPriceVnd,
        depositPaidVnd: detail.depositPaidVnd ?? item.depositPaidVnd,
        depositRequiredVnd: detail.depositRequiredVnd ?? item.depositRequiredVnd,
        balancePaidVnd: detail.balancePaidVnd ?? item.balancePaidVnd,
        balanceRequiredVnd: detail.balanceRequiredVnd ?? item.balanceRequiredVnd,
        discountAmount: detail.discountAmount ?? item.discountAmount ?? undefined,
        forfeitedDepositVnd: detail.forfeitedDepositVnd ?? item.forfeitedDepositVnd,
        refundDueVnd: detail.refundDueVnd ?? item.refundDueVnd,
        refundedAmountVnd: detail.refundedAmountVnd ?? item.refundedAmountVnd,
        finalPaymentDeadline: detail.finalPaymentDeadline ?? item.finalPaymentDeadline,
        latestCheckInAt: detail.latestCheckInAt ?? item.latestCheckInAt,
        loadCutoffAt: detail.loadCutoffAt ?? item.loadCutoffAt,
        updatedAt: detail.updatedAt ?? item.updatedAt,
      });
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

  useToastFeedback({ message, error: actionError || listError });
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

      <PersonnelTable
        toolbar={<div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_280px]"><form className="flex min-w-0 flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setTripId(tripIdDraft.trim()); setPage(1); }}><label className="relative min-w-0 flex-1"><span className="sr-only">{t("parcels.queue.filterByTripSr")}</span><FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={tripIdDraft} onChange={(event) => setTripIdDraft(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35" placeholder={t("parcels.queue.tripIdPlaceholder")} /></label><button type="submit" className="inline-flex items-center justify-center rounded-lg bg-vr-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-vr-600">{tc("search")}</button></form><CustomSelect value={queue} onChange={(event) => { setQueue(event.target.value); setPage(1); }} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35" aria-label={t("parcels.queue.tabListAriaLabel")}>{queueTabs.map((tab) => <option key={tab.value} value={tab.value}>{tab.labelKey === "all" ? tc("all") : tab.labelKey.startsWith("enumLabels.") ? tc(tab.labelKey) : t(tab.labelKey)}</option>)}</CustomSelect></div>}
        columns={[
          { key: "code", header: t("parcels.orderCode"), headerClassName: "w-[22%] px-5 py-3 text-center", cellClassName: "w-[22%] px-5 py-4 pr-8", render: (item) => <p className="whitespace-nowrap font-semibold text-gray-900">{item.parcelCode}</p> },
          { key: "route", header: t("parcels.queue.routeNameLabel"), headerClassName: "w-[21%] px-5 py-3 pl-8 text-center", cellClassName: "w-[21%] px-5 py-4 pl-8 text-center text-sm", render: (item) => <><p className="font-medium text-gray-800">{item.route?.routeName || item.routeName || t("parcels.queue.noRouteName")}</p><p className="mt-1 text-xs text-gray-500">{formatDateTime(item.createdAt)}</p></> },
          { key: "recipient", header: t("parcels.recipient"), headerClassName: "w-[18%] px-5 py-3 text-center", cellClassName: "w-[18%] px-5 py-4 text-center text-sm", render: (item) => <><p className="font-medium text-gray-800">{item.recipientName || "-"}</p><p className="mt-1 text-gray-500">{formatVietnamPhoneForDisplay(item.recipientPhone)}</p></> },
          { key: "size", header: t("parcels.sizeCategory"), headerClassName: "w-[10%] px-2 py-3 text-center", cellClassName: "w-[10%] px-2 py-4 text-center text-sm text-gray-700", render: (item) => <>{item.sizeCategory ? t(`parcels.sizeCategories.${item.sizeCategory}`, { defaultValue: item.sizeCategory }) : "-"}<br /><span className="text-xs text-gray-500">{item.actualWeightKg == null ? "-" : `${item.actualWeightKg} kg`}</span></> },
          { key: "status", header: t("parcels.queue.colStatus"), headerClassName: "w-[16%] px-5 py-3 text-center", cellClassName: "w-[16%] px-5 py-4 text-center", render: (item) => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(item)}`}>{actionLabel(item, t, tc)}</span> },
          { key: "actions", header: tc("actions"), headerClassName: "w-[13%] px-3 py-3 text-center", cellClassName: "w-[13%] px-3 py-4 text-center", render: (item) => <button type="button" onClick={() => void openDetail(item)} className="min-w-[124px] whitespace-nowrap rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-vr-300 hover:text-vr-700">{t("parcels.queue.openAction")}</button> },
        ]}
        rows={items}
        getRowKey={(item) => item.parcelId}
        isLoading={loading}
        loadingMessage={t("parcels.queue.loadingList")}
        emptyMessage={<div className="py-4"><p className="font-medium text-gray-700">{t("parcels.queue.emptyTitle")}</p><p className="mt-1 text-sm text-gray-500">{t("parcels.queue.emptyHint")}</p></div>}
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={setPage}
        className="w-full table-fixed"
      />

      <ParcelDetailModal
        open={detailOpen}
        onClose={() => !actionLoading && setDetailOpen(false)}
        selected={selected}
        loading={detailLoading}
        actionLoading={actionLoading}
        actionError={actionError}
        canOperate={canOperate}
        reason={reason}
        onReasonChange={setReason}
        targetTripId={targetTripId}
        onTargetTripIdChange={setTargetTripId}
        askConfirmation={askConfirmation}
        finishAction={finishAction}
      />

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
