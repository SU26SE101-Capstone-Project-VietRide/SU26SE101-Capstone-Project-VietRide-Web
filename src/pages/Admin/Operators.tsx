import { useEffect, useMemo, useState } from "react";
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
import { DetailItem, DetailSection } from "../../components/DetailLayout";
import Modal from "../../components/Modal";
import Pagination from "../../components/Pagination";
import {
  approveAdminOperator,
  createAdminOperator,
  getAdminOperators,
  rejectAdminOperator,
  suspendAdminOperator,
  type AdminOperator,
  type CreateAdminOperatorRequest,
} from "../../api/vietride";
import CustomSelect from "../../components/CustomSelect";
import { formatDateTime } from "../../utils/date";

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

const emptyOperatorForm: CreateAdminOperatorRequest = {
  name: "",
  contactEmail: "",
  contactPhone: "",
  businessRegistrationNumber: "",
  taxCode: "",
  addressStreet: "",
  addressWard: "",
  addressDistrict: "",
  addressProvince: "",
  representativeName: "",
  representativePosition: "",
  representativePhone: "",
  representativeEmail: "",
};

function toKnownStatus(status: string): OperatorStatus {
  if (OPERATOR_STATUSES.includes(status as OperatorStatus)) {
    return status as OperatorStatus;
  }

  return "PENDING";
}

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
  const [selectedOperator, setSelectedOperator] =
    useState<AdminOperator | null>(null);
  const [operatorForm, setOperatorForm] =
    useState<CreateAdminOperatorRequest>(emptyOperatorForm);
  const [rejectReason, setRejectReason] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    let cancelled = false;

    async function loadOperators() {
      setIsLoading(true);
      setError("");

      try {
        const result = await getAdminOperators({
          page: 1,
          pageSize: 20,
          search: searchTerm,
          status: filterStatus === "ALL" ? undefined : filterStatus,
        });

        if (!cancelled) {
          setOperators(result.items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load operators",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadOperators();

    return () => {
      cancelled = true;
    };
  }, [filterStatus, searchTerm]);

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

  const pendingCount = operators.filter(
    (operator) => toKnownStatus(operator.registrationStatus) === "PENDING",
  ).length;

  const reloadOperators = async () => {
    const result = await getAdminOperators({
      page: 1,
      pageSize: 20,
      search: searchTerm,
      status: filterStatus === "ALL" ? undefined : filterStatus,
    });
    setOperators(result.items);
  };

  const handleApprove = async () => {
    if (!selectedOperator) {
      return;
    }

    await approveAdminOperator(selectedOperator.operatorId);
    await reloadOperators();
    setOpenApprove(false);
    setMessage(
      `${selectedOperator.name} approved. The operator admin should receive an invite email and set their first password at /auth/set-password?token=... before login.`,
    );
    setSelectedOperator(null);
  };

  const handleReject = async () => {
    if (!selectedOperator) {
      return;
    }

    if (!rejectReason.trim()) {
      alert(t("operators.rejectEmptyReason"));
      return;
    }

    await rejectAdminOperator(selectedOperator.operatorId, rejectReason.trim());
    await reloadOperators();
    setOpenReject(false);
    setRejectReason("");
    setSelectedOperator(null);
  };

  const handleSuspend = async (operator: AdminOperator) => {
    const reason = prompt("Suspend reason");
    if (!reason?.trim()) {
      return;
    }

    await suspendAdminOperator(operator.operatorId, reason.trim());
    await reloadOperators();
  };

  const handleCreateOperator = async () => {
    await createAdminOperator(operatorForm);
    await reloadOperators();
    setMessage(
      `${operatorForm.name} profile created without a password. Approve the operator next; backend will send the set-password invite token to the representative email.`,
    );
    setOperatorForm(emptyOperatorForm);
    setOpenOnboard(false);
  };

  const updateOperatorForm = (
    key: keyof CreateAdminOperatorRequest,
    value: string,
  ) => {
    setOperatorForm((prev) => ({ ...prev, [key]: value }));
  };

  const getStatusBadge = (status: string) => {
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
    const c = config[toKnownStatus(status)];
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

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
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

          <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50">
            <FiDownload className="inline mr-2" size={16} />
            {tc("exportCsv")}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

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
                  Business No.
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Tax Code
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
              {paginatedOperators.map((operator, idx) => {
                const status = toKnownStatus(operator.registrationStatus);
                return (
                  <tr
                    key={operator.operatorId}
                    className="border-b border-gray-100 hover:bg-gray-50 transition"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      OP-
                      {String((page - 1) * pageSize + idx + 1).padStart(
                        3,
                        "0",
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {operator.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {operator.contactEmail}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {operator.businessRegistrationNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {operator.taxCode}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {getStatusBadge(status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedOperator(operator);
                            setOpenDetail(true);
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
                        {status === "APPROVED" && (
                          <button
                            onClick={() => handleSuspend(operator)}
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

      <Modal
        open={openDetail}
        onClose={() => setOpenDetail(false)}
        wide
        icon={<FiEye size={20} />}
        title={t("operators.detailTitle")}
        footer={
          <button
            onClick={() => setOpenDetail(false)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {tc("close")}
          </button>
        }
      >
        {selectedOperator && (
          <div className="space-y-5">
            <DetailSection title={t("operators.profile")} columns="three">
              <DetailItem
                label={t("operators.operatorName")}
                value={selectedOperator.name}
              />
              <DetailItem
                label={t("operators.businessRegistrationNumber")}
                value={selectedOperator.businessRegistrationNumber}
              />
              <DetailItem
                label={t("operators.taxCode")}
                value={selectedOperator.taxCode}
              />
              <DetailItem
                label={t("operators.contactEmail")}
                value={selectedOperator.contactEmail}
              />
              <DetailItem
                label={tc("phone")}
                value={selectedOperator.contactPhone}
              />
              <DetailItem
                label={tc("status")}
                value={getStatusBadge(selectedOperator.registrationStatus)}
              />
                <DetailItem
                  label={t("operators.createdAt")}
                  value={formatDateTime(selectedOperator.createdAt)}
                />
                <DetailItem
                  label={t("operators.approvedAt")}
                  value={formatDateTime(selectedOperator.approvedAt)}
                />
            </DetailSection>

            <DetailSection title={t("operators.address")}>
              <DetailItem
                label={t("operators.street")}
                value={selectedOperator.addressStreet}
              />
              <DetailItem
                label={t("operators.ward")}
                value={selectedOperator.addressWard}
              />
              <DetailItem
                label={t("operators.district")}
                value={selectedOperator.addressDistrict}
              />
              <DetailItem
                label={t("operators.province")}
                value={selectedOperator.addressProvince}
              />
            </DetailSection>

            <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                {t("operators.representativeFlow")}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem
                  label={t("operators.representative")}
                  value={selectedOperator.representativeName}
                />
                <DetailItem
                  label={t("operators.position")}
                  value={selectedOperator.representativePosition}
                />
                <DetailItem
                  label={t("operators.representativePhone")}
                  value={selectedOperator.representativePhone}
                />
                <DetailItem
                  label={t("operators.representativeEmail")}
                  value={selectedOperator.representativeEmail}
                />
              </div>
            </section>
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
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-sm text-emerald-900">
              {t("operators.approveConfirm", {
                name: selectedOperator.name,
              })}
            </p>
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
            <button
              type="button"
              onClick={() => setOpenOnboard(false)}
              className="rounded-lg border cursor-pointer border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={handleCreateOperator}
              className="rounded-lg bg-vr-500 cursor-pointer px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 hover:text-white"
            >
              {t("operators.createOperator")}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            This creates the operator profile only. No password is collected
            here. After approval, the representative uses the email invite link
            to set the first password.
          </div>
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
                  value={operatorForm.name}
                  onChange={(e) => updateOperatorForm("name", e.target.value)}
                  placeholder={t("operators.brandPlaceholder")}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Business Registration No.{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  value={operatorForm.businessRegistrationNumber}
                  onChange={(e) =>
                    updateOperatorForm(
                      "businessRegistrationNumber",
                      e.target.value,
                    )
                  }
                  placeholder="0312345678"
                />
              </div>
              <div>
                <label className={labelClass}>
                  {t("operators.taxId")} <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  value={operatorForm.taxCode}
                  onChange={(e) =>
                    updateOperatorForm("taxCode", e.target.value)
                  }
                  placeholder="0301234567"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  {t("operators.headquartersAddress")}
                </label>
                <input
                  className={inputClass}
                  value={operatorForm.addressStreet}
                  onChange={(e) =>
                    updateOperatorForm("addressStreet", e.target.value)
                  }
                  placeholder={t("operators.addressPlaceholder")}
                />
              </div>
              <div>
                <label className={labelClass}>{t("operators.ward")}</label>
                <input
                  className={inputClass}
                  value={operatorForm.addressWard}
                  onChange={(e) =>
                    updateOperatorForm("addressWard", e.target.value)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>{t("operators.district")}</label>
                <input
                  className={inputClass}
                  value={operatorForm.addressDistrict}
                  onChange={(e) =>
                    updateOperatorForm("addressDistrict", e.target.value)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>{t("operators.province")}</label>
                <input
                  className={inputClass}
                  value={operatorForm.addressProvince}
                  onChange={(e) =>
                    updateOperatorForm("addressProvince", e.target.value)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>{tc("phone")}</label>
                <input
                  className={inputClass}
                  value={operatorForm.contactPhone}
                  onChange={(e) =>
                    updateOperatorForm("contactPhone", e.target.value)
                  }
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
                  value={operatorForm.representativeName}
                  onChange={(e) =>
                    updateOperatorForm("representativeName", e.target.value)
                  }
                  placeholder={t("operators.representativePlaceholder")}
                />
              </div>
              <div>
                <label className={labelClass}>{t("operators.position")}</label>
                <input
                  className={inputClass}
                  value={operatorForm.representativePosition}
                  onChange={(e) =>
                    updateOperatorForm("representativePosition", e.target.value)
                  }
                  placeholder={t("operators.positionPlaceholder")}
                />
              </div>
              <div>
                <label className={labelClass}>
                  {tc("email")} <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  value={operatorForm.contactEmail}
                  onChange={(e) =>
                    updateOperatorForm("contactEmail", e.target.value)
                  }
                  placeholder="ops@congty.vn"
                />
              </div>
              <div>
                <label className={labelClass}>
                  {tc("phone")} <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  value={operatorForm.representativePhone}
                  onChange={(e) =>
                    updateOperatorForm("representativePhone", e.target.value)
                  }
                  placeholder="0901 234 567"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  {t("operators.representativeEmail")}
                </label>
                <input
                  className={inputClass}
                  value={operatorForm.representativeEmail}
                  onChange={(e) =>
                    updateOperatorForm("representativeEmail", e.target.value)
                  }
                  placeholder="representative@congty.vn"
                />
              </div>
            </div>
          </section>
        </div>
      </Modal>
    </div>
  );
}
