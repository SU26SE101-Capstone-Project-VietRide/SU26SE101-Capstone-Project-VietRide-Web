import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useLatestRequest } from "../../../hooks/useLatestRequest";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiDownload,
  FiPlus,
  FiSearch,
  FiCheck,
  FiX,
  FiEye,
  FiFilter,
  FiUsers,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiSliders,
} from "react-icons/fi";
import Pagination from "../../../components/Pagination";
import { StatCard } from "../../../components/StatCard";
import {
  approveAdminOperator,
  createAdminOperator,
  getAdminOperators,
  getAdminOperatorSummary,
  exportAdminOperators,
  getAdminOperatorDetail,
  rejectAdminOperator,
  suspendAdminOperator,
  reactivateAdminOperator,
  type AdminOperator,
  type AdminOperatorSummary,
  type CreateAdminOperatorRequest,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import { ConfirmModal } from "../../../components/ConfirmModal";
import OperatorDetailModal from "./OperatorDetailModal";
import OperatorOnboardModal from "./OperatorOnboardModal";
import {
  OperatorApproveModal,
  OperatorRejectModal,
  OperatorSuspendModal,
} from "./OperatorActionModals";
import {
  emptyOperatorForm,
  getStatusBadge,
  toKnownStatus,
  type OperatorStatus,
} from "./operatorHelpers";

// Mọi ô lọc dùng chung một class để cao bằng nhau (min-h-11 khớp CustomSelect /
// CustomDateTimeInput) — trước đây ô search py-3 còn select py-2 nên so le.
const filterControlClass =
  "min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-vr-500 focus:ring-2 focus:ring-vr-100";
const searchInputClass =
  "min-h-11 w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none focus:border-vr-500 focus:bg-white focus:ring-2 focus:ring-vr-100";
const toolbarButtonClass =
  "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white";

export default function Operators() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<OperatorStatus | "ALL">(
    "ALL",
  );
  const [activationFilter, setActivationFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateField, setDateField] = useState<"createdAt" | "approvedAt">(
    "createdAt",
  );
  const [totalItems, setTotalItems] = useState(0);
  const [summary, setSummary] = useState<AdminOperatorSummary | null>(null);
  const [summaryReloadKey, setSummaryReloadKey] = useState(0);
  const [operators, setOperators] = useState<AdminOperator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [openOnboard, setOpenOnboard] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [openApprove, setOpenApprove] = useState(false);
  const [openReject, setOpenReject] = useState(false);
  const [openSuspend, setOpenSuspend] = useState(false);
  const [pendingReactivate, setPendingReactivate] = useState<AdminOperator | null>(null);
  const [selectedOperator, setSelectedOperator] =
    useState<AdminOperator | null>(null);
  const [operatorForm, setOperatorForm] =
    useState<CreateAdminOperatorRequest>(emptyOperatorForm);
  const [rejectReason, setRejectReason] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [page, setPage] = useState(1);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const pageSize = 8;
  const startRequest = useLatestRequest();

  // tRef để load callback không phụ thuộc `t` (tránh refetch khi đổi ngôn ngữ)
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  // Bộ lọc dùng chung cho danh sách và cho export CSV — export nhận đúng bộ này
  // nhưng KHÔNG nhận page/pageSize.
  const listFilters = useMemo(
    () => ({
      ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
      ...(filterStatus === "ALL" ? {} : { status: filterStatus }),
      // `isActive` là cờ bật/tắt riêng, KHÔNG phải registrationStatus
      ...(activationFilter ? { isActive: activationFilter === "ACTIVE" } : {}),
      ...(dateFrom ? { from: dateFrom } : {}),
      ...(dateTo ? { to: dateTo } : {}),
      ...(dateFrom || dateTo ? { dateField } : {}),
    }),
    [activationFilter, dateField, dateFrom, dateTo, filterStatus, searchTerm],
  );

  // `dateField` không tính là filter: nó chỉ chọn mốc thời gian, tự nó không lọc gì.
  const hasActiveFilters = Boolean(
    searchTerm || filterStatus !== "ALL" || activationFilter || dateFrom || dateTo,
  );
  const advancedFilterCount =
    Number(Boolean(dateFrom)) + Number(Boolean(dateTo));

  const handleResetFilters = () => {
    setSearchTerm("");
    setFilterStatus("ALL");
    setActivationFilter("");
    setDateField("createdAt");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  // Một loader duy nhất dùng chung cho effect (debounce) và các mutation phía dưới
  const loadOperators = useCallback(async () => {
    const isLatest = startRequest();
    setIsLoading(true);
    setError("");

    try {
      const result = await getAdminOperators({
        page,
        pageSize,
        ...listFilters,
      });

      if (!isLatest()) return;
      setOperators(result.items);
      setTotalItems(result.totalItems);
    } catch (err) {
      if (!isLatest()) return;
      setError(
        err instanceof Error
          ? err.message
          : tRef.current("operators.loadFailed"),
      );
    } finally {
      if (isLatest()) setIsLoading(false);
    }
  }, [listFilters, page, startRequest]);

  useEffect(() => {
    // Debounce theo pattern của Users.tsx để tránh gọi API mỗi lần gõ phím
    const timer = window.setTimeout(() => {
      void loadOperators();
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadOperators]);

  // Thẻ thống kê đếm trên toàn platform, KHÔNG đổi theo filter của danh sách.
  useEffect(() => {
    let ignore = false;
    void getAdminOperatorSummary()
      .then((result) => {
        if (!ignore) setSummary(result);
      })
      .catch(() => {
        // Thẻ thống kê lỗi không được chặn bảng chính
      });
    return () => {
      ignore = true;
    };
  }, [summaryReloadKey]);

  // BE dựng sẵn CSV (UTF-8 BOM cho Excel, escape RFC 4180) và xuất TOÀN BỘ dòng
  // khớp filter — không chỉ trang đang xem. Không parse rồi dựng lại ở browser.
  const handleExportCsv = async () => {
    setError("");
    try {
      const blob = await exportAdminOperators(listFilters);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `operators-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("operators.exportFailed"),
      );
    }
  };

  // Lấy từ `/summary`: đếm trên toàn platform chứ không phải trang đang xem.
  const pendingCount = summary?.pending ?? 0;
  const approvedCount = summary?.approved ?? 0;
  const restrictedCount = (summary?.suspended ?? 0) + (summary?.rejected ?? 0);

  const handleApprove = async () => {
    if (!selectedOperator) return;
    try {
      await approveAdminOperator(selectedOperator.operatorId);
      setOperators((current) =>
        current.map((operator) =>
          operator.operatorId === selectedOperator.operatorId
            ? { ...operator, registrationStatus: "APPROVED" }
            : operator,
        ),
      );
      setFilterStatus("ALL");
      setPage(1);
      setOpenApprove(false);
      setMessage(t("operators.approvedAlert", { name: selectedOperator.name }));
      setSummaryReloadKey((current) => current + 1);
      setSelectedOperator(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("operators.approveFailed"));
    }
  };

  const handleReject = async () => {
    if (!selectedOperator) return;
    if (!rejectReason.trim()) {
      setError(t("operators.rejectEmptyReason"));
      return;
    }
    try {
      await rejectAdminOperator(selectedOperator.operatorId, rejectReason.trim());
      await loadOperators();
      setMessage(t("operators.rejectedAlert", { name: selectedOperator.name, reason: rejectReason.trim() }));
      setSummaryReloadKey((current) => current + 1);
      setOpenReject(false);
      setRejectReason("");
      setSelectedOperator(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("operators.rejectFailed"));
    }
  };

  const openSuspendModal = (operator: AdminOperator) => {
    setSelectedOperator(operator);
    setSuspendReason("");
    setError("");
    setOpenSuspend(true);
  };

  const handleSuspend = async () => {
    if (!selectedOperator) {
      return;
    }

    if (!suspendReason.trim()) {
      setError(t("operators.suspendEmptyReason"));
      return;
    }

    try {
      await suspendAdminOperator(selectedOperator.operatorId, suspendReason.trim());
      await loadOperators();
      setMessage(
        t("operators.suspendedAlert", { name: selectedOperator.name }),
      );
      setOpenSuspend(false);
      setSuspendReason("");
      setSelectedOperator(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("operators.suspendFailed"),
      );
    }
  };

  const handleReactivate = async (operator: AdminOperator) => {
    try {
      await reactivateAdminOperator(operator.operatorId);
      await loadOperators();
      setMessage(t("operators.reactivatedAlert", { name: operator.name }));
      setSummaryReloadKey((current) => current + 1);
      setPendingReactivate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("operators.reactivateFailed"));
    }
  };

  const handleCreateOperator = async () => {
    try {
      await createAdminOperator(operatorForm);
      await loadOperators();
      setMessage(t("operators.createdPendingMessage", { name: operatorForm.name }));
      setOperatorForm(emptyOperatorForm);
      setOpenOnboard(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("operators.createFailed"));
    }
  };

  const updateOperatorForm = (
    key: keyof CreateAdminOperatorRequest,
    value: string,
  ) => {
    setOperatorForm((prev) => ({ ...prev, [key]: value }));
  };

  useToastFeedback({ message, error });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("operators.title")}
          </h1>
          <p className="text-gray-600 mt-1">{t("operators.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpenOnboard(true)}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-white font-bold rounded-lg transition flex items-center gap-2"
        >
          <FiPlus size={16} /> {t("operators.addOperator")}
        </button>
      </div>

      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-amber-600">
                <FiFilter size={20} />
              </div>
              <div>
                <p className="font-semibold text-amber-900">{tc("pending")}</p>
                <p className="text-sm text-amber-700">
                  {t("operators.pendingBanner", { count: pendingCount })}
                </p>
              </div>
            </div>
            <button
              onClick={() => setFilterStatus("PENDING")}
              className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 font-medium rounded-lg transition"
            >
              {t("operators.viewNow")}
            </button>
          </div>
        </div>
      )}


      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FiUsers size={20} />}
          label={t("operators.total")}
          value={summary?.total ?? operators.length}
          iconClassName="bg-vr-50 text-vr-700"
        />
        <StatCard
          icon={<FiCheckCircle size={20} />}
          label={t("operators.approved")}
          value={approvedCount}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          icon={<FiClock size={20} />}
          label={t("operators.pending")}
          value={pendingCount}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <StatCard
          icon={<FiAlertCircle size={20} />}
          label={t("operators.restricted")}
          value={restrictedCount}
          iconClassName="bg-red-50 text-red-700"
        />
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        {/* Hàng lọc chính chỉ giữ search + 2 trạng thái. Mốc/khoảng ngày dồn vào
            panel nâng cao như màn Chuyến bên Manager (ScheduleTable) — hàng lọc
            trước đây nhồi 6 ô trên 2 lưới khác nhau nên mép các ô so le. */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.6fr)_minmax(160px,0.9fr)_minmax(160px,0.9fr)_auto_auto]">
          <div className="relative min-w-0 md:col-span-2 xl:col-span-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder={t("operators.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className={searchInputClass}
            />
          </div>

          <CustomSelect
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as typeof filterStatus);
              setPage(1);
            }}
            className={filterControlClass}
          >
            <option value="ALL">{t("operators.allStatus")}</option>
            <option value="PENDING">{tc("pending")}</option>
            <option value="APPROVED">{tc("active")}</option>
            <option value="SUSPENDED">{tc("suspended")}</option>
            <option value="REJECTED">{tc("rejected")}</option>
          </CustomSelect>

          {/* `isActive` tách hẳn khỏi registrationStatus: nhà xe đã duyệt vẫn có thể bị tắt */}
          <CustomSelect
            value={activationFilter}
            onChange={(e) => {
              setActivationFilter(e.target.value);
              setPage(1);
            }}
            aria-label={t("operators.filterActivation")}
            className={filterControlClass}
          >
            <option value="">{t("operators.allActivation")}</option>
            <option value="ACTIVE">{tc("active")}</option>
            <option value="INACTIVE">{tc("inactive")}</option>
          </CustomSelect>

          {/* Panel đang đóng vẫn phải cho biết có filter ngày đang chạy: viền
              highlight + số lượng ngay trên nút. */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((current) => !current)}
            aria-expanded={showAdvancedFilters}
            className={`${toolbarButtonClass} ${
              advancedFilterCount > 0
                ? "border-vr-300 bg-vr-50 text-vr-800 hover:bg-vr-100"
                : ""
            }`}
          >
            <FiSliders aria-hidden="true" size={16} />
            {t("operators.advancedFilters")}
            {advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ""}
          </button>

          <button
            type="button"
            onClick={() => void handleExportCsv()}
            className={toolbarButtonClass}
          >
            <FiDownload size={16} />
            {tc("exportCsv")}
          </button>
        </div>

        {showAdvancedFilters && (
          <div className="mt-3 grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="min-w-0">
              <span className="mb-1 block text-xs font-medium text-gray-500">
                {t("operators.dateFieldLabel")}
              </span>
              <CustomSelect
                value={dateField}
                onChange={(e) => {
                  setDateField(e.target.value as typeof dateField);
                  setPage(1);
                }}
                aria-label={t("operators.dateFieldLabel")}
                className={filterControlClass}
              >
                <option value="createdAt">
                  {t("operators.dateFieldCreatedAt")}
                </option>
                <option value="approvedAt">
                  {t("operators.dateFieldApprovedAt")}
                </option>
              </CustomSelect>
            </div>

            {/* Khoảng ngày: gửi YYYY-MM-DD, BE tự đổi sang UTC theo giờ Việt Nam.
                Dùng CustomDateTimeInput như các màn khác — input date thuần hiện
                placeholder mm/dd/yyyy theo locale máy, không khớp UI tiếng Việt. */}
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">
                {t("operators.dateFromLabel")}
              </span>
              <CustomDateTimeInput
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                placeholder={t("operators.dateFromLabel")}
                aria-label={t("operators.dateFromLabel")}
                className={filterControlClass}
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">
                {t("operators.dateToLabel")}
              </span>
              <CustomDateTimeInput
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                placeholder={t("operators.dateToLabel")}
                aria-label={t("operators.dateToLabel")}
                className={filterControlClass}
              />
            </label>
          </div>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          >
            <FiX aria-hidden="true" size={15} />
            {t("operators.clearFilters")}
          </button>
        )}


        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">
                  {t("operators.code")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {t("operators.operatorName")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {tc("email")}
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">
                  {t("operators.businessRegistrationNumber")}
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">
                  {t("operators.taxCode")}
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">
                  {tc("status")}
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">
                  {tc("actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {operators.map((operator, idx) => {
                const status = toKnownStatus(operator.registrationStatus);
  return (
                  <tr
                    key={operator.operatorId}
                    className="border-b border-gray-100 hover:bg-gray-50 transition"
                  >
                    <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                      OP-
                      {String((page - 1) * pageSize + idx + 1).padStart(3, "0")}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {operator.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {operator.contactEmail}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-700">
                      {operator.businessRegistrationNumber}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-700">
                      {operator.taxCode}
                    </td>
                    <td className="px-6 py-4 text-center text-sm">
                      {getStatusBadge(status, tc)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const detail = await getAdminOperatorDetail(operator.operatorId);
                              setSelectedOperator(detail);
                              setOpenDetail(true);
                            } catch (err) {
                              setError(err instanceof Error ? err.message : t("operators.loadFailed"));
                            }
                          }}
                          className="p-1.5 text-vr-600 hover:bg-vr-50 rounded-lg transition"
                          title={tc("details")}
                        >
                          <FiEye size={16} />
                        </button>
                        {status === "PENDING" && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedOperator(operator);
                                setOpenApprove(true);
                              }}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                              title={t("operators.approve")}
                            >
                              <FiCheck size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedOperator(operator);
                                setOpenReject(true);
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title={t("operators.reject")}
                            >
                              <FiX size={16} />
                            </button>
                          </>
                        )}
                        {status === "SUSPENDED" && (
                          <button
                            onClick={() => setPendingReactivate(operator)}
                            className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50"
                            title={t("operators.reactivate")}
                          >
                            <FiRefreshCw size={16} />
                          </button>
                        )}
                        {status === "APPROVED" && (
                          <button
                            onClick={() => openSuspendModal(operator)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                            title={tc("suspended")}
                          >
                            <FiX size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && operators.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    {t("operators.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isLoading && (
          <div className="mt-4 text-sm text-gray-500">
            {t("operators.loading")}
          </div>
        )}

        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
        />
      </div>

      <OperatorDetailModal
        open={openDetail}
        onClose={() => setOpenDetail(false)}
        operator={selectedOperator}
      />

      <OperatorApproveModal
        open={openApprove}
        onClose={() => setOpenApprove(false)}
        operator={selectedOperator}
        onConfirm={handleApprove}
      />

      <OperatorRejectModal
        open={openReject}
        onClose={() => setOpenReject(false)}
        operator={selectedOperator}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        onConfirm={handleReject}
      />

      <OperatorSuspendModal
        open={openSuspend}
        onClose={() => setOpenSuspend(false)}
        operator={selectedOperator}
        reason={suspendReason}
        onReasonChange={setSuspendReason}
        onConfirm={handleSuspend}
      />

      <OperatorOnboardModal
        open={openOnboard}
        onClose={() => setOpenOnboard(false)}
        form={operatorForm}
        onChange={updateOperatorForm}
        onSubmit={handleCreateOperator}
      />
      <ConfirmModal
        open={Boolean(pendingReactivate)}
        onClose={() => setPendingReactivate(null)}
        onConfirm={() => pendingReactivate && void handleReactivate(pendingReactivate)}
        title={t("operators.reactivate")}
        message={pendingReactivate ? t("operators.reactivateConfirmMsg", { name: pendingReactivate.name }) : ""}
        confirmLabel={tc("confirm")}
        cancelLabel={tc("cancel")}
        tone="success"
      />
    </div>
  );
}
