import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiDownload,
  FiHome,
  FiPlus,
  FiSearch,
  FiCheck,
  FiX,
  FiEye,
  FiFilter,
} from "react-icons/fi";
import Modal from "../../components/Modal";
import { operators as mockOperators } from "../../data/mockData";

function formatCurrency(v: number) {
  return `${(v / 1000000).toFixed(0)}M`;
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

type OperatorStatus = "PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED";

const OPERATOR_STATUSES: OperatorStatus[] = [
  "APPROVED",
  "PENDING",
  "SUSPENDED",
  "REJECTED",
];

export default function Operators() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<OperatorStatus | "ALL">(
    "ALL",
  );
  const [openOnboard, setOpenOnboard] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [openApprove, setOpenApprove] = useState(false);
  const [openReject, setOpenReject] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState<
    ((typeof mockOperators)[0] & { status: OperatorStatus }) | null
  >(null);
  const [rejectReason, setRejectReason] = useState("");

  const operatorsWithStatus = mockOperators.map((op, idx) => ({
    ...op,
    status: OPERATOR_STATUSES[idx % OPERATOR_STATUSES.length],
  }));

  const filtered = operatorsWithStatus.filter((o) => {
    const matchSearch = o.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "ALL" || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const pendingCount = operatorsWithStatus.filter(
    (o) => o.status === "PENDING",
  ).length;

  const handleApprove = () => {
    setOpenApprove(false);
    alert(t("operators.approvedAlert", { name: selectedOperator?.name }));
    setSelectedOperator(null);
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      alert(t("operators.rejectEmptyReason"));
      return;
    }
    setOpenReject(false);
    alert(
      t("operators.rejectedAlert", {
        name: selectedOperator?.name,
        reason: rejectReason,
      }),
    );
    setRejectReason("");
    setSelectedOperator(null);
  };

  const getStatusBadge = (status: OperatorStatus) => {
    const config = {
      PENDING: {
        bg: "bg-amber-50",
        text: "text-amber-700",
        label: tc("pending"),
      },
      APPROVED: {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        label: tc("active"),
      },
      SUSPENDED: {
        bg: "bg-red-50",
        text: "text-red-700",
        label: tc("suspended"),
      },
      REJECTED: {
        bg: "bg-gray-50",
        text: "text-gray-700",
        label: tc("rejected"),
      },
    };
    const c = config[status];
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}
      >
        {c.label}
      </span>
    );
  };

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

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 relative min-w-50">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t("operators.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none text-sm bg-gray-50 focus:bg-white focus:border-vr-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as typeof filterStatus)
            }
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm font-medium focus:outline-none focus:border-vr-500"
          >
            <option value="ALL">{t("operators.allStatus")}</option>
            <option value="PENDING">{tc("pending")}</option>
            <option value="APPROVED">{tc("active")}</option>
            <option value="SUSPENDED">{tc("suspended")}</option>
            <option value="REJECTED">{tc("rejected")}</option>
          </select>

          <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50">
            <FiDownload className="inline mr-2" size={16} />
            {tc("exportCsv")}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {t("operators.code")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {t("operators.operatorName")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {tc("email")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {t("operators.routes")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {t("operators.revenue")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {tc("status")}
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">
                  {tc("actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((op, idx) => (
                <tr
                  key={op.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    OP-{String(idx + 1).padStart(3, "0")}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {op.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {op.name.split(" ")[0].toLowerCase()}@company.vn
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {Math.floor(50 + idx * 5)}
                    {t("operators.routesSuffix")}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-vr-600">
                    {formatCurrency(op.revenue)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {getStatusBadge(op.status)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedOperator(op);
                          setOpenDetail(true);
                        }}
                        className="p-1.5 text-vr-600 hover:bg-vr-50 rounded-lg transition"
                        title={tc("details")}
                      >
                        <FiEye size={16} />
                      </button>
                      {op.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedOperator(op);
                              setOpenApprove(true);
                            }}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title={t("operators.approve")}
                          >
                            <FiCheck size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedOperator(op);
                              setOpenReject(true);
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title={t("operators.reject")}
                          >
                            <FiX size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {t("operators.showingPagination", {
              count: filtered.length,
              total: operatorsWithStatus.length,
            })}
          </p>
          <div className="flex gap-2">
            <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm hover:bg-gray-50">
              {tc("previous")}
            </button>
            <button className="px-3 py-2 bg-vr-500 text-white rounded-lg text-sm">
              1
            </button>
            <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm hover:bg-gray-50">
              2
            </button>
            <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm hover:bg-gray-50">
              {tc("next")}
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={openDetail}
        onClose={() => setOpenDetail(false)}
        icon={<FiEye size={20} />}
        title={t("operators.detailTitle")}
        footer={
          <>
            <button
              onClick={() => setOpenDetail(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("close")}
            </button>
          </>
        }
      >
        {selectedOperator && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-600">
                {t("operators.operatorName")}
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {selectedOperator.name}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">
                {t("operators.contactEmail")}
              </p>
              <p className="text-sm text-gray-900">
                {selectedOperator.name.toLowerCase().replace(" ", "")}
                @company.vn
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">
                {tc("status")}
              </p>
              <div className="mt-1">
                {getStatusBadge(selectedOperator.status)}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">
                {t("operators.revenue")}
              </p>
              <p className="text-sm font-semibold text-vr-600">
                {formatCurrency(selectedOperator.revenue)}
              </p>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={openApprove}
        onClose={() => setOpenApprove(false)}
        icon={<FiCheck size={20} />}
        title={t("operators.approveTitle")}
        footer={
          <>
            <button
              onClick={() => setOpenApprove(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              onClick={handleApprove}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              {t("operators.approve")}
            </button>
          </>
        }
      >
        {selectedOperator && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-900">
                {t("operators.approveConfirm", {
                  name: selectedOperator.name,
                })}
              </p>
            </div>
            <div>
              <label className={labelClass}>{t("operators.approveNote")}</label>
              <textarea
                placeholder={t("operators.approveNotePlaceholder")}
                className={inputClass + " min-h-20"}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={openReject}
        onClose={() => setOpenReject(false)}
        icon={<FiX size={20} />}
        title={t("operators.rejectTitle")}
        footer={
          <>
            <button
              onClick={() => setOpenReject(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              onClick={handleReject}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
            >
              {t("operators.rejectConfirm")}
            </button>
          </>
        }
      >
        {selectedOperator && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-900">
                {t("operators.rejectConfirmMsg", {
                  name: selectedOperator.name,
                })}
              </p>
            </div>
            <div>
              <label className={labelClass}>
                {t("operators.rejectReason")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("operators.rejectReasonPlaceholder")}
                className={inputClass + " min-h-25"}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={openOnboard}
        onClose={() => setOpenOnboard(false)}
        wide
        icon={<FiHome size={20} />}
        title={t("operators.onboardTitle")}
        subtitle={t("operators.onboardSubtitle")}
        footer={
          <>
            <div
              onClick={() => setOpenOnboard(false)}
              className="rounded-lg border cursor-pointer border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {tc("cancel")}
            </div>
            <div
              onClick={() => setOpenOnboard(false)}
              className="rounded-lg bg-vr-500 cursor-pointer px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 hover:text-white"
            >
              {t("operators.createOperator")}
            </div>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              {t("operators.businessInfo")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  {t("operators.brandName")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  placeholder={t("operators.brandPlaceholder")}
                />
              </div>
              <div>
                <label className={labelClass}>
                  {t("operators.taxId")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="0301234567" />
              </div>
              <div>
                <label className={labelClass}>
                  {t("operators.businessType")}
                </label>
                <select className={inputClass} defaultValue="bus">
                  <option value="bus">{t("operators.intercityBus")}</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  {t("operators.headquartersAddress")}
                </label>
                <textarea
                  className={inputClass + " min-h-20"}
                  placeholder={t("operators.addressPlaceholder")}
                  rows={2}
                />
              </div>
            </div>
          </section>
          <div className="border-t border-gray-100" />
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              {t("operators.mainContact")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  {t("operators.representative")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  placeholder={t("operators.representativePlaceholder")}
                />
              </div>
              <div>
                <label className={labelClass}>{t("operators.position")}</label>
                <input
                  className={inputClass}
                  placeholder={t("operators.positionPlaceholder")}
                />
              </div>
              <div>
                <label className={labelClass}>
                  {tc("email")} <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="ops@congty.vn" />
              </div>
              <div>
                <label className={labelClass}>
                  {tc("phone")} <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="0901 234 567" />
              </div>
            </div>
          </section>
          <div className="border-t border-gray-100" />
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              {t("operators.operationConfig")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t("operators.fleetSize")}</label>
                <input className={inputClass} placeholder="50" />
              </div>
              <div>
                <label className={labelClass}>
                  {t("operators.commissionPercent")}
                </label>
                <input className={inputClass} placeholder="8" />
              </div>
            </div>
            <div className="mt-4">
              <p className={labelClass}>{t("operators.activateNow")}</p>
              <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
                <button
                  type="button"
                  role="switch"
                  aria-checked="true"
                  className="relative h-7 w-12 shrink-0 rounded-full bg-vr-500 transition"
                >
                  <span className="absolute right-1 top-1 h-5 w-5 rounded-full bg-white shadow" />
                </button>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {t("operators.allowTicketSales")}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t("operators.activateHint")}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </Modal>
    </div>
  );
}
