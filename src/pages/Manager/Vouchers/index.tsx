import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheck,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiTag,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import {
  acceptOperatorVoucherConsent,
  activateOperatorVoucher,
  createOperatorVoucher,
  deactivateOperatorVoucher,
  getOperatorRoutes,
  deleteOperatorVoucher,
  getOperatorVoucherConsents,
  getOperatorVouchers,
  rejectOperatorVoucherConsent,
  updateOperatorVoucher,
  type CreateOperatorVoucherRequest,
  type OperatorRoute,
  type OperatorVoucher,
  type OperatorVoucherConsent,
  type UpdateOperatorVoucherRequest,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

type VoucherTab = "vouchers" | "consents";

type VoucherForm = {
  code: string;
  name: string;
  type: string;
  value: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  totalUsageLimit: string;
  perUserLimit: string;
  validFrom: string;
  validUntil: string;
  applicableRouteIds: string;
  fundingType: string;
};

const emptyForm: VoucherForm = {
  code: "",
  name: "",
  type: "PERCENT_OFF",
  value: "10",
  minOrderAmount: "0",
  maxDiscountAmount: "50000",
  totalUsageLimit: "100",
  perUserLimit: "1",
  validFrom: new Date().toISOString().slice(0, 16),
  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16),
  applicableRouteIds: "",
  fundingType: "OPERATOR_FUNDED",
};

function toNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function toIsoLocal(value: string) {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

function toRouteIds(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function routeIdsToValue(routeIds: string[]) {
  return routeIds.join(", ");
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("vi-VN");
}

function formatMoney(value: number) {
  return value.toLocaleString("vi-VN");
}

function getVoucherId(voucher: OperatorVoucher) {
  return voucher.id;
}

function toForm(voucher: OperatorVoucher): VoucherForm {
  return {
    code: voucher.code,
    name: voucher.name,
    type: voucher.type,
    value: String(voucher.value),
    minOrderAmount: String(voucher.minOrderAmount),
    maxDiscountAmount: String(voucher.maxDiscountAmount),
    totalUsageLimit: String(voucher.totalUsageLimit),
    perUserLimit: String(voucher.perUserLimit),
    validFrom: voucher.validFrom ? voucher.validFrom.slice(0, 16) : "",
    validUntil: voucher.validUntil ? voucher.validUntil.slice(0, 16) : "",
    applicableRouteIds: voucher.applicableRouteIds.join(", "),
    fundingType: voucher.fundingType ?? "OPERATOR_FUNDED",
  };
}

function toCreateRequest(form: VoucherForm): CreateOperatorVoucherRequest {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    type: form.type,
    value: toNumber(form.value),
    minOrderAmount: toNumber(form.minOrderAmount),
    maxDiscountAmount: toNumber(form.maxDiscountAmount),
    totalUsageLimit: toNumber(form.totalUsageLimit),
    perUserLimit: toNumber(form.perUserLimit),
    validFrom: toIsoLocal(form.validFrom),
    validUntil: toIsoLocal(form.validUntil),
    applicableRouteIds: toRouteIds(form.applicableRouteIds),
    fundingType: form.fundingType,
  };
}

function toUpdateRequest(form: VoucherForm): UpdateOperatorVoucherRequest {
  const request = toCreateRequest(form);

  return {
    name: request.name,
    value: request.value,
    minOrderAmount: request.minOrderAmount,
    maxDiscountAmount: request.maxDiscountAmount,
    totalUsageLimit: request.totalUsageLimit,
    perUserLimit: request.perUserLimit,
    validFrom: request.validFrom,
    validUntil: request.validUntil,
    applicableRouteIds: request.applicableRouteIds,
  };
}

export default function ManagerVouchers() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const isOperatorAdmin = getAuthUser()?.role === "OPERATOR_ADMIN";
  const [activeTab, setActiveTab] = useState<VoucherTab>(
    isOperatorAdmin ? "vouchers" : "consents",
  );
  const [vouchers, setVouchers] = useState<OperatorVoucher[]>([]);
  const [consents, setConsents] = useState<OperatorVoucherConsent[]>([]);
  const [routes, setRoutes] = useState<OperatorRoute[]>([]);
  const [consentStatus, setConsentStatus] = useState("");
  const [form, setForm] = useState<VoucherForm>(emptyForm);
  const [selectedVoucher, setSelectedVoucher] = useState<OperatorVoucher | null>(
    null,
  );
  const [deletingVoucher, setDeletingVoucher] =
    useState<OperatorVoucher | null>(null);
  const [rejectingConsent, setRejectingConsent] =
    useState<OperatorVoucherConsent | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setIsLoading(true);
    setError("");

    try {
      const [voucherResult, consentResult, routeResult] = await Promise.all([
        isOperatorAdmin
          ? getOperatorVouchers({ page: 1, pageSize: 100 })
          : Promise.resolve(null),
        getOperatorVoucherConsents(consentStatus || undefined),
        getOperatorRoutes({ page: 1, pageSize: 100 }),
      ]);

      setVouchers(voucherResult?.items ?? []);
      setConsents(consentResult.items);
      setRoutes(routeResult.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vouchers");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function loadVoucherData() {
      setIsLoading(true);
      setError("");

      try {
        const [voucherResult, consentResult, routeResult] = await Promise.all([
          isOperatorAdmin
            ? getOperatorVouchers({ page: 1, pageSize: 100 })
            : Promise.resolve(null),
          getOperatorVoucherConsents(consentStatus || undefined),
          getOperatorRoutes({ page: 1, pageSize: 100 }),
        ]);

        if (ignore) {
          return;
        }

        setVouchers(voucherResult?.items ?? []);
        setConsents(consentResult.items);
        setRoutes(routeResult.items);
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load vouchers");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadVoucherData();

    return () => {
      ignore = true;
    };
  }, [consentStatus, isOperatorAdmin]);

  const activeCount = useMemo(
    () => vouchers.filter((voucher) => voucher.isActive).length,
    [vouchers],
  );
  const pendingConsentCount = useMemo(
    () => consents.filter((consent) => consent.status === "PENDING").length,
    [consents],
  );

  function openCreateModal() {
    setSelectedVoucher(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  }

  function openEditModal(voucher: OperatorVoucher) {
    setSelectedVoucher(voucher);
    setForm(toForm(voucher));
    setIsModalOpen(true);
  }

  function updateForm(key: keyof VoucherForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setError("");
    setMessage("");

    try {
      if (selectedVoucher) {
        const updatedVoucher = await updateOperatorVoucher(
          getVoucherId(selectedVoucher),
          toUpdateRequest(form),
        );
        setVouchers((current) =>
          current.map((voucher) =>
            getVoucherId(voucher) === getVoucherId(updatedVoucher)
              ? updatedVoucher
              : voucher,
          ),
        );
        setMessage(t("vouchers.updateSuccess"));
      } else {
        const createdVoucher = await createOperatorVoucher(toCreateRequest(form));
        setVouchers((current) => [createdVoucher, ...current]);
        setMessage(t("vouchers.createSuccess"));
      }

      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vouchers.saveFailed"));
    }
  }

  async function handleToggle(voucher: OperatorVoucher) {
    setError("");
    setMessage("");

    if (voucher.isActive) {
      const result = await deactivateOperatorVoucher(getVoucherId(voucher));
      setVouchers((current) =>
        current.map((item) =>
          getVoucherId(item) === getVoucherId(voucher)
            ? { ...item, isActive: result.isActive ?? false }
            : item,
        ),
      );
      setMessage(t("vouchers.deactivateSuccess"));
    } else {
      const result = await activateOperatorVoucher(getVoucherId(voucher));
      setVouchers((current) =>
        current.map((item) =>
          getVoucherId(item) === getVoucherId(voucher)
            ? { ...item, isActive: result.isActive ?? true }
            : item,
        ),
      );
      setMessage(t("vouchers.activateSuccess"));
    }
  }

  async function handleDelete() {
    if (!deletingVoucher) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await deleteOperatorVoucher(getVoucherId(deletingVoucher));
      setVouchers((current) =>
        current.filter(
          (item) => getVoucherId(item) !== getVoucherId(deletingVoucher),
        ),
      );
      setDeletingVoucher(null);
      setMessage(t("vouchers.deleteOperatorSuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vouchers.deleteFailed"));
    }
  }

  async function handleAcceptConsent(consent: OperatorVoucherConsent) {
    setError("");
    setMessage("");
    try {
      await acceptOperatorVoucherConsent(consent.id);
      setMessage(t("vouchers.acceptConsentSuccess", { code: consent.voucherCode }));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vouchers.acceptFailed"));
    }
  }

  async function handleRejectConsent() {
    if (!rejectingConsent) {
      return;
    }

    setError("");
    setMessage("");
    try {
      await rejectOperatorVoucherConsent(rejectingConsent.id, rejectReason);
      setMessage(t("vouchers.rejectConsentSuccess", { code: rejectingConsent.voucherCode }));
      setRejectingConsent(null);
      setRejectReason("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vouchers.rejectFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("vouchers.operatorTitle")}
          </h1>
          <p className="mt-1 text-gray-600">
            {t("vouchers.operatorSubtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FiRefreshCw size={16} />
            {tc("refresh")}
          </button>
          {isOperatorAdmin && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-bold text-white hover:bg-vr-600"
            >
              <FiPlus size={16} />
              {t("vouchers.create")}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label={t("vouchers.totalVouchers")} value={vouchers.length} />
        <MetricCard label={t("vouchers.activeVouchers")} value={activeCount} />
        <MetricCard label={t("vouchers.pendingConsents")} value={pendingConsentCount} />
      </div>

      {isOperatorAdmin && (
        <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setActiveTab("vouchers")}
              className={`rounded-lg px-4 py-3 text-left text-sm font-semibold ${
                activeTab === "vouchers"
                  ? "bg-vr-50 text-vr-800 ring-1 ring-vr-200"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t("vouchers.operatorVouchers")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("consents")}
              className={`rounded-lg px-4 py-3 text-left text-sm font-semibold ${
                activeTab === "consents"
                  ? "bg-vr-50 text-vr-800 ring-1 ring-vr-200"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t("vouchers.consentVouchers")}
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isOperatorAdmin && activeTab === "vouchers" ? (
        <VoucherTable
          vouchers={vouchers}
          isLoading={isLoading}
          onEdit={openEditModal}
          onToggle={handleToggle}
          onDelete={setDeletingVoucher}
        />
      ) : (
        <ConsentTable
          consents={consents}
          status={consentStatus}
          isLoading={isLoading}
          canManage={isOperatorAdmin}
          onStatusChange={setConsentStatus}
          onAccept={handleAcceptConsent}
          onReject={setRejectingConsent}
        />
      )}

      <VoucherModal
        open={isModalOpen}
        form={form}
        isEditing={Boolean(selectedVoucher)}
        routes={routes}
        onChange={updateForm}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />

      <Modal
        open={Boolean(deletingVoucher)}
        onClose={() => setDeletingVoucher(null)}
        icon={<FiTrash2 size={20} />}
        title={t("vouchers.deleteOperatorTitle")}
        subtitle={deletingVoucher?.code}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeletingVoucher(null)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              {tc("delete")}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          {t("vouchers.confirmDeleteOperatorVoucher")}
        </p>
      </Modal>

      <Modal
        open={Boolean(rejectingConsent)}
        onClose={() => setRejectingConsent(null)}
        icon={<FiX size={20} />}
        title={t("vouchers.rejectPlatformTitle")}
        subtitle={rejectingConsent?.voucherCode}
        footer={
          <>
            <button
              type="button"
              onClick={() => setRejectingConsent(null)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={handleRejectConsent}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              {t("vouchers.reject")}
            </button>
          </>
        }
      >
        <label className={labelClass}>{t("vouchers.rejectReason")}</label>
        <textarea
          className={`${inputClass} min-h-[96px]`}
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          placeholder={t("vouchers.rejectReasonPlaceholder")}
        />
      </Modal>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function VoucherTable({
  vouchers,
  isLoading,
  onEdit,
  onToggle,
  onDelete,
}: {
  vouchers: OperatorVoucher[];
  isLoading: boolean;
  onEdit: (voucher: OperatorVoucher) => void;
  onToggle: (voucher: OperatorVoucher) => void;
  onDelete: (voucher: OperatorVoucher) => void;
}) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-5 py-3">{t("vouchers.code")}</th>
              <th className="px-5 py-3">{t("vouchers.name")}</th>
              <th className="px-5 py-3">{t("vouchers.discount")}</th>
              <th className="px-5 py-3">{t("vouchers.limit")}</th>
              <th className="px-5 py-3">{t("vouchers.validity")}</th>
              <th className="px-5 py-3">{tc("status")}</th>
              <th className="px-5 py-3">{tc("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((voucher) => (
              <tr
                key={voucher.id}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
              >
                <td className="px-5 py-4 font-mono text-sm font-semibold text-vr-700">
                  {voucher.code}
                </td>
                <td className="px-5 py-4">
                  <p className="text-sm font-semibold text-gray-900">
                    {voucher.name}
                  </p>
                  <p className="text-xs text-gray-500">{voucher.type}</p>
                </td>
                <td className="px-5 py-4 text-sm text-gray-700">
                  {voucher.type === "PERCENT_OFF"
                    ? `${voucher.value}%`
                    : `${formatMoney(voucher.value)} VND`}
                </td>
                <td className="px-5 py-4 text-sm text-gray-700">
                  <p>{t("vouchers.totalLimit", { count: voucher.totalUsageLimit })}</p>
                  <p className="text-xs text-gray-500">
                    {t("vouchers.perUserLimit", { count: voucher.perUserLimit })}
                  </p>
                </td>
                <td className="px-5 py-4 text-sm text-gray-700">
                  <p>{formatDate(voucher.validFrom)}</p>
                  <p className="text-xs text-gray-500">
                    {t("vouchers.validUntil", {
                      date: formatDate(voucher.validUntil),
                    })}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      voucher.isActive
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {voucher.isActive
                      ? t("vouchers.enabled")
                      : t("vouchers.disabled")}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <IconButton
                      label={
                        voucher.isActive
                          ? t("vouchers.disableVoucher")
                          : t("vouchers.enableVoucher")
                      }
                      onClick={() => onToggle(voucher)}
                    >
                      {voucher.isActive ? <FiX size={16} /> : <FiCheck size={16} />}
                    </IconButton>
                    <IconButton label={tc("edit")} onClick={() => onEdit(voucher)}>
                      <FiEdit2 size={16} />
                    </IconButton>
                    <IconButton label={tc("delete")} onClick={() => onDelete(voucher)}>
                      <FiTrash2 size={16} />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isLoading && (
        <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-500">
          {t("vouchers.loading")}
        </div>
      )}
      {!isLoading && vouchers.length === 0 && (
        <div className="border-t border-gray-100 px-5 py-10 text-center text-sm text-gray-500">
          {t("vouchers.emptyOperatorVoucher")}
        </div>
      )}
    </div>
  );
}

function ConsentTable({
  consents,
  status,
  isLoading,
  canManage,
  onStatusChange,
  onAccept,
  onReject,
}: {
  consents: OperatorVoucherConsent[];
  status: string;
  isLoading: boolean;
  canManage: boolean;
  onStatusChange: (status: string) => void;
  onAccept: (consent: OperatorVoucherConsent) => void;
  onReject: (consent: OperatorVoucherConsent) => void;
}) {
  const { t } = useTranslation("manager");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className={labelClass}>{t("vouchers.consentStatusFilter")}</label>
        <select
          className={inputClass}
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
        >
          <option value="">{t("vouchers.all")}</option>
          <option value="PENDING">PENDING</option>
          <option value="ACCEPTED">ACCEPTED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Voucher</th>
                <th className="px-5 py-3">{t("vouchers.value")}</th>
                <th className="px-5 py-3">{t("vouchers.minOrder")}</th>
                <th className="px-5 py-3">{t("vouchers.validity")}</th>
                <th className="px-5 py-3">{t("vouchers.status")}</th>
                <th className="px-5 py-3">{t("vouchers.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {consents.map((consent) => {
                const canRespond = canManage && consent.status === "PENDING";

                return (
                  <tr
                    key={consent.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                  >
                  <td className="px-5 py-4">
                    <p className="font-mono text-sm font-semibold text-vr-700">
                      {consent.voucherCode}
                    </p>
                    <p className="text-xs text-gray-500">{consent.voucherType}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {consent.voucherValue}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {formatMoney(consent.minOrderAmount)} VND
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    <p>{formatDate(consent.validFrom)}</p>
                    <p className="text-xs text-gray-500">
                      {t("vouchers.validUntil", {
                        date: formatDate(consent.validUntil),
                      })}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {consent.status}
                  </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <IconButton
                          label={t("vouchers.accept")}
                          disabled={!canRespond}
                          onClick={() => onAccept(consent)}
                        >
                          <FiCheck size={16} />
                        </IconButton>
                        <IconButton
                          label={t("vouchers.reject")}
                          disabled={!canRespond}
                          onClick={() => onReject(consent)}
                        >
                          <FiX size={16} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {isLoading && (
          <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-500">
            {t("vouchers.loadingConsents")}
          </div>
        )}
        {!isLoading && consents.length === 0 && (
          <div className="border-t border-gray-100 px-5 py-10 text-center text-sm text-gray-500">
            {t("vouchers.emptyConsents")}
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:bg-white disabled:hover:text-gray-600"
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function VoucherModal({
  open,
  form,
  isEditing,
  routes,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  form: VoucherForm;
  isEditing: boolean;
  routes: OperatorRoute[];
  onChange: (key: keyof VoucherForm, value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const selectedRouteIds = toRouteIds(form.applicableRouteIds);

  function toggleRoute(routeId: string) {
    const nextRouteIds = selectedRouteIds.includes(routeId)
      ? selectedRouteIds.filter((id) => id !== routeId)
      : [...selectedRouteIds, routeId];

    onChange("applicableRouteIds", routeIdsToValue(nextRouteIds));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiTag size={20} />}
      title={isEditing ? t("vouchers.updateVoucher") : t("vouchers.create")}
      subtitle={t("vouchers.operatorModalSubtitle")}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
          >
            {isEditing ? t("vouchers.update") : t("vouchers.create")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("vouchers.voucherCode")}
            value={form.code}
            disabled={isEditing}
            onChange={(value) => onChange("code", value)}
            placeholder="OP-SUMMER"
          />
          <Field
            label={t("vouchers.voucherName")}
            value={form.name}
            onChange={(value) => onChange("name", value)}
            placeholder={t("vouchers.nameSummerPlaceholder")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>{t("vouchers.discountType")}</label>
            <select
              className={inputClass}
              value={form.type}
              disabled={isEditing}
              onChange={(event) => onChange("type", event.target.value)}
            >
              <option value="PERCENT_OFF">
                {t("vouchers.discountTypePercent")}
              </option>
              <option value="FIXED_AMOUNT">
                {t("vouchers.discountTypeFixed")}
              </option>
            </select>
          </div>
          <Field
            label={t("vouchers.value")}
            type="number"
            value={form.value}
            onChange={(value) => onChange("value", value)}
          />
          <Field
            label={t("vouchers.maxDiscount")}
            type="number"
            value={form.maxDiscountAmount}
            onChange={(value) => onChange("maxDiscountAmount", value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={t("vouchers.minOrder")}
            type="number"
            value={form.minOrderAmount}
            onChange={(value) => onChange("minOrderAmount", value)}
          />
          <Field
            label={t("vouchers.totalUsageLimit")}
            type="number"
            value={form.totalUsageLimit}
            onChange={(value) => onChange("totalUsageLimit", value)}
          />
          <Field
            label={t("vouchers.perUser")}
            type="number"
            value={form.perUserLimit}
            onChange={(value) => onChange("perUserLimit", value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("vouchers.validFrom")}
            type="datetime-local"
            value={form.validFrom}
            onChange={(value) => onChange("validFrom", value)}
          />
          <Field
            label={t("vouchers.validTo")}
            type="datetime-local"
            value={form.validUntil}
            onChange={(value) => onChange("validUntil", value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t("vouchers.applicableRoutes")}</label>
            <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
              {routes.length > 0 ? (
                <div className="space-y-1">
                  {routes.map((route) => {
                    const checked = selectedRouteIds.includes(route.id);

                    return (
                      <label
                        key={route.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                          checked
                            ? "bg-vr-50 text-vr-800"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRoute(route.id)}
                          className="h-4 w-4 rounded border-gray-300 text-vr-600 focus:ring-vr-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {route.name}
                          </span>
                          <span className="block truncate text-xs text-gray-500">
                            {route.originStationId} → {route.destinationStationId}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="px-3 py-2 text-sm text-gray-500">
                  {t("vouchers.noRoutesAvailable")}
                </p>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {selectedRouteIds.length > 0
                ? t("vouchers.selectedRoutes", { count: selectedRouteIds.length })
                : t("vouchers.allRoutesHint")}
            </p>
          </div>
          <div>
            <label className={labelClass}>{t("vouchers.fundingType")}</label>
            <select
              className={inputClass}
              value={form.fundingType}
              disabled={isEditing}
              onChange={(event) => onChange("fundingType", event.target.value)}
            >
              <option value="OPERATOR_FUNDED">OPERATOR_FUNDED</option>
              <option value="VIETRIDE_FUNDED">VIETRIDE_FUNDED</option>
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
