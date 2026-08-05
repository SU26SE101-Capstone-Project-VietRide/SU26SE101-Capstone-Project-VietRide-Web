import { useCallback, useEffect, useRef, useState } from "react";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import { useTranslation } from "react-i18next";
import { FiCheckCircle, FiPackage, FiRefreshCw, FiSearch } from "react-icons/fi";
import {
  getOperatorParcels,
  getParcelDetail,
  type OperatorParcelListItem,
  type ParcelDetail,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import Modal from "../../../components/Modal";
import Pagination from "../../../components/Pagination";
import { formatDateTime } from "../../../utils/date";
import ParcelDetailModal from "./ParcelDetailModal";
import {
  actionLabel,
  inputClass,
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
                    {formatVietnamPhoneForDisplay(item.recipientPhone)}
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
