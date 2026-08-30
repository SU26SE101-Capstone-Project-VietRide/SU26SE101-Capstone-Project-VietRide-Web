import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import CustomSelect from "../../../components/CustomSelect";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  FiArrowDown,
  FiArrowUp,
  FiCheckCircle,
  FiSliders,
} from "react-icons/fi";
import {
  getOperatorParcel,
  getOperatorParcels,
  type OperatorParcelDetail,
  type OperatorParcelListItem,
  type OperatorParcelListParams,
  type ParcelSizeCategory,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import { getAuthUser } from "../../../auth";
import Modal from "../../../components/Modal";
import { PersonnelTable } from "../../../components/PersonnelTable";
import { formatDateTime } from "../../../utils/date";
import ParcelDetailModal from "./ParcelDetailModal";
import { parcelSizeCategories } from "./parcelFareHelpers";
import {
  actionLabel,
  inputClass,
  pageSize,
  queueTabs,
  statusTone,
} from "./parcelQueueHelpers";
import { SearchInput } from "../../../components/ui/SearchInput";

type ConfirmState = { label: string; run: () => Promise<void> } | null;

export default function ParcelQueue() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const tRef = useRef(t);
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedParcelId = searchParams.get("parcelId");
  useEffect(() => {
    tRef.current = t;
  });
  const canOperate = getAuthUser()?.role === "OPERATOR_ADMIN";
  const [queue, setQueue] = useState("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateField, setDateField] =
    useState<NonNullable<OperatorParcelListParams["dateField"]>>("createdAt");
  const [sizeCategory, setSizeCategory] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const advancedFilterCount =
    Number(Boolean(dateFrom)) +
    Number(Boolean(dateTo)) +
    Number(Boolean(sizeCategory));
  // BE có thể trả 422 SEARCH_TOO_BROAD — đó KHÔNG phải "không có kết quả",
  // phải nói người dùng gõ cụ thể hơn thay vì hiện empty state.
  const [searchTooBroad, setSearchTooBroad] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<OperatorParcelListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  // Chi tiết lấy từ endpoint operator: có statusHistory và các mốc audit mà
  // endpoint passenger `/v1/parcels/{id}` không trả.
  const [selected, setSelected] = useState<OperatorParcelDetail | null>(null);
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
    setSearchTooBroad(false);
    try {
      const activeFilter = queueTabs.find((tab) => tab.value === queue);
      const result = await getOperatorParcels({
        status: activeFilter?.status,
        pendingActionType: activeFilter?.pendingActionType,
        page,
        pageSize,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(dateFrom ? { from: dateFrom } : {}),
        ...(dateTo ? { to: dateTo } : {}),
        // `dateField` chỉ có nghĩa khi kèm khoảng ngày
        ...(dateFrom || dateTo ? { dateField } : {}),
        ...(sizeCategory
          ? { sizeCategory: sizeCategory as ParcelSizeCategory }
          : {}),
        sortBy: dateFrom || dateTo ? dateField : "createdAt",
        sortDir,
      });
      setItems(result.items);
      setTotalItems(result.totalItems);
    } catch (error) {
      setItems([]);
      setTotalItems(0);
      // Từ khoá quá chung: giữ nguyên keyword, hướng dẫn thu hẹp — không được
      // hiển thị như danh sách rỗng.
      if (
        error instanceof ApiRequestError &&
        error.code === "SEARCH_TOO_BROAD"
      ) {
        setSearchTooBroad(true);
        return;
      }
      setListError(
        error instanceof Error
          ? error.message
          : tRef.current("parcels.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [
    dateField,
    dateFrom,
    dateTo,
    debouncedSearch,
    page,
    queue,
    sizeCategory,
    sortDir,
  ]);

  // Search đi thẳng lên BE nên phải debounce; đổi từ khoá thì về trang 1.
  // Bỏ qua lượt chạy đầu: effect này cũng chạy lúc mount và sau đó gọi
  // `setPage(1)` dù người dùng chưa gõ gì — ai bấm sang trang trong khoảng
  // debounce đầu tiên sẽ bị đá ngược về trang 1. Giá trị debounce lúc mount vốn
  // đã bằng ô nhập nên bỏ lượt này không làm lệch state.
  const hasFilterChanged = useRef(false);
  useEffect(() => {
    if (!hasFilterChanged.current) {
      hasFilterChanged.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  const openLinkedParcelDetail = useCallback(async (parcelId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setActionError("");
    setMessage("");
    setReason("");
    setTargetTripId("");

    try {
      setSelected(await getOperatorParcel(parcelId));
    } catch (error) {
      setSelected(null);
      setActionError(
        error instanceof Error
          ? error.message
          : tRef.current("parcels.loadFailed"),
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadList(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadList]);

  useEffect(() => {
    if (!linkedParcelId) return;
    const timeoutId = window.setTimeout(
      () => void openLinkedParcelDetail(linkedParcelId),
      0,
    );
    return () => window.clearTimeout(timeoutId);
  }, [linkedParcelId, openLinkedParcelDetail]);
  async function openDetail(item: OperatorParcelListItem) {
    setDetailOpen(true);
    setDetailLoading(true);
    setActionError("");
    setMessage("");
    setReason("");
    setTargetTripId("");
    try {
      const detail = await getOperatorParcel(item.parcelId);
      setSelected({
        ...detail,
        route: detail.route ?? item.route,
        trip: detail.trip ?? item.trip,
        routeName: detail.routeName ?? item.route?.routeName ?? item.routeName,
        senderName:
          detail.senderName ??
          item.sender?.displayName ??
          item.sender?.name ??
          item.senderName,
        senderPhone:
          detail.senderPhone ?? item.sender?.phone ?? item.senderPhone,
        recipientName:
          detail.recipientName ??
          item.recipient?.displayName ??
          item.recipient?.name ??
          item.recipientName,
        recipientPhone:
          detail.recipientPhone ??
          item.recipient?.phone ??
          item.recipientPhone ??
          undefined,
        pendingActionType: detail.pendingActionType ?? item.pendingActionType,
        pendingActionReason:
          detail.pendingActionReason ?? item.pendingActionReason,
        photoUrl: detail.photoUrl ?? item.photoUrl,
        estimatedSizeCategory:
          detail.estimatedSizeCategory ?? item.estimatedSizeCategory,
        actualSizeCategory:
          detail.actualSizeCategory ?? item.actualSizeCategory,
        estimatedWeightKg:
          detail.estimatedWeightKg ?? item.estimatedWeightKg ?? 0,
        actualWeightKg: detail.actualWeightKg ?? item.actualWeightKg,
        estimatedChargeableWeightKg:
          detail.estimatedChargeableWeightKg ??
          item.estimatedChargeableWeightKg,
        actualChargeableWeightKg:
          detail.actualChargeableWeightKg ?? item.actualChargeableWeightKg,
        estimatedVolumeM3: detail.estimatedVolumeM3 ?? item.estimatedVolumeM3,
        actualVolumeM3: detail.actualVolumeM3 ?? item.actualVolumeM3,
        estimatedTotalPriceVnd:
          detail.estimatedTotalPriceVnd ?? item.estimatedTotalPriceVnd,
        finalTotalPriceVnd:
          detail.finalTotalPriceVnd ?? item.finalTotalPriceVnd,
        depositPaidVnd: detail.depositPaidVnd ?? item.depositPaidVnd,
        depositRequiredVnd:
          detail.depositRequiredVnd ?? item.depositRequiredVnd,
        balancePaidVnd: detail.balancePaidVnd ?? item.balancePaidVnd,
        balanceRequiredVnd:
          detail.balanceRequiredVnd ?? item.balanceRequiredVnd,
        discountAmount:
          detail.discountAmount ?? item.discountAmount ?? undefined,
        forfeitedDepositVnd:
          detail.forfeitedDepositVnd ?? item.forfeitedDepositVnd,
        refundDueVnd: detail.refundDueVnd ?? item.refundDueVnd,
        refundedAmountVnd: detail.refundedAmountVnd ?? item.refundedAmountVnd,
        finalPaymentDeadline:
          detail.finalPaymentDeadline ?? item.finalPaymentDeadline,
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

  function closeDetail() {
    setDetailOpen(false);
    setSelected(null);
    if (!linkedParcelId) return;

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("parcelId");
    setSearchParams(nextSearchParams, { replace: true });
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
      closeDetail();
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

  function toggleCreatedAtSort() {
    setSortDir((current) => (current === "desc" ? "asc" : "desc"));
    setPage(1);
  }

  function createdAtSortIcon() {
    return sortDir === "desc" ? (
      <FiArrowDown aria-hidden="true" size={14} />
    ) : (
      <FiArrowUp aria-hidden="true" size={14} />
    );
  }

  useToastFeedback({ message, error: actionError || listError });
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <PersonnelTable
        toolbar={
          <div className="space-y-3">
            {/*
            Trước đây ô này bắt nhập CHÍNH XÁC mã chuyến — nhân viên không tra
            được đơn khi khách gọi hỏi. BE đã có `search` OR-match mã đơn và
            tên/SĐT của cả người gửi lẫn người nhận.
          */}
            <div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_280px_auto]">
              <SearchInput
                label={t("parcels.queue.searchPlaceholder")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("parcels.queue.searchPlaceholder")}
              />
              <CustomSelect
                value={queue}
                onChange={(event) => {
                  setQueue(event.target.value);
                  setPage(1);
                }}
                className={inputClass}
                aria-label={t("parcels.queue.tabListAriaLabel")}
              >
                {queueTabs.map((tab) => (
                  <option key={tab.value} value={tab.value}>
                    {tab.labelKey === "all"
                      ? tc("all")
                      : tab.labelKey.startsWith("enumLabels.")
                        ? tc(tab.labelKey)
                        : t(tab.labelKey)}
                  </option>
                ))}
              </CustomSelect>
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((current) => !current)}
                aria-expanded={showAdvancedFilters}
                aria-label={t("trips.advancedFilters")}
                className={
                  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[9999px] border px-3 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-vr-500/30 " +
                  (advancedFilterCount > 0
                    ? "border-[#2bb7b0] bg-[#ebfffd] text-[#0c6f68]"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50 hover:text-vr-900")
                }
              >
                <FiSliders aria-hidden="true" size={16} />
                {t("trips.advancedFilters")}
                {advancedFilterCount > 0
                  ? " (" + advancedFilterCount + ")"
                  : ""}
              </button>
            </div>
            {showAdvancedFilters ? (
              <div className="mt-3 space-y-2 rounded-[22px] border border-gray-300 bg-gray-50/60 p-3">
                <p className="text-xs font-semibold text-gray-600">
                  {t("parcels.queue.dateFieldLabel")}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-xs font-medium text-gray-500">
                      {t("parcels.queue.dateFieldSelectLabel")}
                    </span>
                    <CustomSelect
                      value={dateField}
                      onChange={(event) => {
                        setDateField(event.target.value as typeof dateField);
                        setPage(1);
                      }}
                      className={inputClass}
                      aria-label={t("parcels.queue.dateFieldSelectLabel")}
                    >
                      <option value="createdAt">
                        {t("parcels.queue.dateFieldCreatedAt")}
                      </option>
                      <option value="finalPaymentDeadline">
                        {t("parcels.queue.dateFieldPaymentDeadline")}
                      </option>
                    </CustomSelect>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-xs font-medium text-gray-500">
                      {t("parcels.queue.dateFromLabel")}
                    </span>
                    <CustomDateTimeInput
                      type="date"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={(event) => {
                        setDateFrom(event.target.value);
                        setPage(1);
                      }}
                      aria-label={t("parcels.queue.dateFromLabel")}
                      placeholder={t("parcels.queue.dateFromPlaceholder")}
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-xs font-medium text-gray-500">
                      {t("parcels.queue.dateToLabel")}
                    </span>
                    <CustomDateTimeInput
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(event) => {
                        setDateTo(event.target.value);
                        setPage(1);
                      }}
                      aria-label={t("parcels.queue.dateToLabel")}
                      placeholder={t("parcels.queue.dateToPlaceholder")}
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-xs font-medium text-gray-500">
                      {t("parcels.queue.sizeFilterLabel")}
                    </span>
                    <CustomSelect
                      value={sizeCategory}
                      onChange={(event) => {
                        setSizeCategory(event.target.value);
                        setPage(1);
                      }}
                      className={inputClass}
                      aria-label={t("parcels.queue.sizeFilterLabel")}
                    >
                      <option value="">{t("parcels.queue.allSizes")}</option>
                      {parcelSizeCategories.map((size) => (
                        <option key={size} value={size}>
                          {t("parcels.sizeCategories." + size, {
                            defaultValue: size,
                          })}
                        </option>
                      ))}
                    </CustomSelect>
                  </label>
                </div>
              </div>
            ) : null}
            {searchTooBroad && (
              <p
                role="status"
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
              >
                {t("parcels.queue.searchTooBroad")}
              </p>
            )}
          </div>
        }
        columns={[
          {
            key: "code",
            header: t("parcels.orderCode"),
            headerClassName: "w-[20%] px-5 py-3 text-center",
            cellClassName: "w-[20%] px-5 py-4 pr-6",
            render: (item) => (
              <p className="whitespace-nowrap font-semibold text-gray-900">
                {item.parcelCode}
              </p>
            ),
          },
          {
            key: "route",
            header: (
              <button
                type="button"
                onClick={toggleCreatedAtSort}
                className="inline-flex items-center justify-center gap-1.5 font-semibold transition hover:text-vr-900"
                aria-label={t("parcels.queue.sortLabel")}
                title={
                  sortDir === "desc"
                    ? t("parcels.queue.sortNewest")
                    : t("parcels.queue.sortOldest")
                }
              >
                {t("parcels.queue.routeNameLabel")}
                {createdAtSortIcon()}
              </button>
            ),
            headerClassName: "w-[21%] px-5 py-3 pl-8 text-center",
            cellClassName: "w-[21%] px-5 py-4 pl-8 text-center text-sm",
            render: (item) => (
              <>
                <p className="font-medium text-gray-800">
                  {item.route?.routeName ||
                    item.routeName ||
                    t("parcels.queue.noRouteName")}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatDateTime(item.createdAt)}
                </p>
              </>
            ),
          },
          {
            key: "recipient",
            header: t("parcels.recipient"),
            headerClassName: "w-[16%] px-5 py-3 text-center",
            cellClassName: "w-[16%] px-5 py-4 text-center text-sm",
            render: (item) => (
              <>
                <p className="font-medium text-gray-800">
                  {item.recipientName || "-"}
                </p>
                <p className="mt-1 text-gray-500">
                  {formatVietnamPhoneForDisplay(item.recipientPhone)}
                </p>
              </>
            ),
          },
          {
            key: "size",
            header: t("parcels.sizeCategory"),
            headerClassName: "w-[10%] px-2 py-3 text-center",
            cellClassName:
              "w-[10%] px-2 py-4 text-center text-sm text-gray-700",
            render: (item) => (
              <>
                {item.sizeCategory
                  ? t(`parcels.sizeCategories.${item.sizeCategory}`, {
                      defaultValue: item.sizeCategory,
                    })
                  : "-"}
                <br />
                <span className="text-xs text-gray-500">
                  {item.actualWeightKg == null
                    ? "-"
                    : `${item.actualWeightKg} kg`}
                </span>
              </>
            ),
          },
          {
            key: "status",
            header: t("parcels.queue.colStatus"),
            headerClassName: "w-[20%] px-5 py-3 text-center",
            cellClassName: "w-[20%] px-5 py-4 text-center",
            render: (item) => (
              <span
                className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(item)}`}
              >
                {actionLabel(item, t, tc)}
              </span>
            ),
          },
          {
            key: "actions",
            header: tc("actions"),
            headerClassName: "w-[13%] px-3 py-3 text-center",
            cellClassName: "w-[13%] px-3 py-4 text-center",
            render: (item) => (
              <button
                type="button"
                onClick={() => void openDetail(item)}
                className="min-w-[124px] whitespace-nowrap rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-vr-300 hover:text-vr-900"
              >
                {t("parcels.queue.openAction")}
              </button>
            ),
          },
        ]}
        rows={items}
        getRowKey={(item) => item.parcelId}
        isLoading={loading}
        emptyMessage={
          <div className="py-4">
            <p className="font-medium text-gray-700">
              {t("parcels.queue.emptyTitle")}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {t("parcels.queue.emptyHint")}
            </p>
          </div>
        }
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={setPage}
        className="w-full table-fixed"
      />

      <ParcelDetailModal
        open={detailOpen}
        onClose={() => !actionLoading && closeDetail()}
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
              className="rounded-lg bg-vr-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
