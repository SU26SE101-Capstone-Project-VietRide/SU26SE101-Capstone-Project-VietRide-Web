import { useToastFeedback } from "../../../hooks/useToastFeedback";
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
} from "react-icons/fi";
import Pagination from "../../../components/Pagination";
import { StatCard } from "../../../components/StatCard";
import {
  approveAdminOperator,
  createAdminOperator,
  getAdminOperators,
  getAdminOperatorDetail,
  rejectAdminOperator,
  suspendAdminOperator,
  reactivateAdminOperator,
  type AdminOperator,
  type CreateAdminOperatorRequest,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import { ConfirmModal } from "../../../components/ConfirmModal";
import { downloadCsv } from "../../../utils/csv";
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

export default function Operators() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<OperatorStatus | "ALL">(
    "ALL",
  );
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
  const pageSize = 8;

  // tRef để load callback không phụ thuộc `t` (tránh refetch khi đổi ngôn ngữ)
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  // Một loader duy nhất dùng chung cho effect (debounce) và các mutation phía dưới
  const loadOperators = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getAdminOperators({
        page: 1,
        pageSize: 20,
        search: searchTerm,
        status: filterStatus === "ALL" ? undefined : filterStatus,
      });

      setOperators(result.items);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : tRef.current("operators.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, searchTerm]);

  useEffect(() => {
    // Debounce theo pattern của Users.tsx để tránh gọi API mỗi lần gõ phím
    const timer = window.setTimeout(() => {
      void loadOperators();
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadOperators]);

  const filtered = useMemo(
    () =>
      operators.filter((operator) =>
        operator.name.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [operators, searchTerm],
  );

  const paginatedOperators = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page],
  );

  const handleExportCsv = () => {
    downloadCsv(
      "operators.csv",
      [t("operators.operatorName"), tc("email"), t("operators.csvPhone"), tc("status")],
      filtered.map((operator) => [
        operator.name,
        operator.contactEmail,
        operator.contactPhone,
        operator.registrationStatus,
      ]),
    );
  };

  const pendingCount = operators.filter(
    (operator) => toKnownStatus(operator.registrationStatus) === "PENDING",
  ).length;
  const approvedCount = operators.filter(
    (operator) => toKnownStatus(operator.registrationStatus) === "APPROVED",
  ).length;
  const restrictedCount = operators.filter((operator) => {
    const status = toKnownStatus(operator.registrationStatus);
    return status === "SUSPENDED" || status === "REJECTED";
  }).length;

  const handleApprove = async () => {
    if (!selectedOperator) return;
    try {
      await approveAdminOperator(selectedOperator.operatorId);
      await loadOperators();
      setOpenApprove(false);
      setMessage(t("operators.approvedAlert", { name: selectedOperator.name }));
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
          value={operators.length}
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
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 relative min-w-50">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t("operators.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none text-sm bg-gray-50 focus:bg-white focus:border-vr-500"
            />
          </div>

          <CustomSelect
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as typeof filterStatus);
              setPage(1);
            }}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm font-medium focus:outline-none focus:border-vr-500"
          >
            <option value="ALL">{t("operators.allStatus")}</option>
            <option value="PENDING">{tc("pending")}</option>
            <option value="APPROVED">{tc("active")}</option>
            <option value="SUSPENDED">{tc("suspended")}</option>
            <option value="REJECTED">{tc("rejected")}</option>
          </CustomSelect>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            <FiDownload className="inline mr-2" size={16} />
            {tc("exportCsv")}
          </button>
        </div>


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
              {paginatedOperators.map((operator, idx) => {
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
          totalItems={filtered.length}
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
