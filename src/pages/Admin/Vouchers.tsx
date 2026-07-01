import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiRefreshCw, FiTag } from "react-icons/fi";
import {
  createAdminVoucher,
  getAdminVouchers,
  type AdminVoucher,
  type CreateAdminVoucherRequest,
} from "../../api/vietride";
import Modal from "../../components/Modal";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

type VoucherTab = "event" | "package";

type VoucherForm = {
  code: string;
  name: string;
  description: string;
  discountType: string;
  discount: string;
  applicableTo: string;
  minOrderValue: string;
  quantity: string;
  expiryDate: string;
  maxUsagePerUser: string;
  active: boolean;
};

const emptyForm: VoucherForm = {
  code: "",
  name: "",
  description: "",
  discountType: "percent",
  discount: "10",
  applicableTo: "all",
  minOrderValue: "0",
  quantity: "1000",
  expiryDate: "",
  maxUsagePerUser: "1",
  active: true,
};

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

function toNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function voucherTypeOf(voucher: AdminVoucher): VoucherTab {
  return voucher.voucherType?.toLowerCase() === "package" ? "package" : "event";
}

function discountTypeOf(voucher: AdminVoucher) {
  if (voucher.discountType) return voucher.discountType.toLowerCase();
  return voucher.type === "FIXED" ? "fixed" : "percent";
}

function discountValueOf(voucher: AdminVoucher) {
  return voucher.discount ?? voucher.value ?? 0;
}

function quantityOf(voucher: AdminVoucher) {
  return voucher.quantity ?? voucher.totalUsageLimit ?? 0;
}

function usedCountOf(voucher: AdminVoucher) {
  return voucher.usedCount ?? 0;
}

function expiryDateOf(voucher: AdminVoucher) {
  return voucher.expiryDate ?? voucher.validUntil ?? "";
}

function activeOf(voucher: AdminVoucher) {
  return voucher.active ?? voucher.isActive ?? false;
}

function toCreateRequest(
  form: VoucherForm,
  voucherType: VoucherTab,
): CreateAdminVoucherRequest {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    voucherType,
    discountType: form.discountType,
    discount: toNumber(form.discount),
    applicableTo: form.applicableTo,
    minOrderValue: toNumber(form.minOrderValue),
    quantity: toNumber(form.quantity),
    expiryDate: form.expiryDate
      ? new Date(`${form.expiryDate}T23:59:59`).toISOString()
      : new Date().toISOString(),
    maxUsagePerUser: toNumber(form.maxUsagePerUser),
    active: form.active,
  };
}

export default function Vouchers() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [activeTab, setActiveTab] = useState<VoucherTab>("event");
  const [vouchers, setVouchers] = useState<AdminVoucher[]>([]);
  const [form, setForm] = useState<VoucherForm>(emptyForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const eventVouchers = useMemo(
    () => vouchers.filter((voucher) => voucherTypeOf(voucher) === "event"),
    [vouchers],
  );
  const packageVouchers = useMemo(
    () => vouchers.filter((voucher) => voucherTypeOf(voucher) === "package"),
    [vouchers],
  );
  const currentVouchers =
    activeTab === "event" ? eventVouchers : packageVouchers;

  const loadVouchers = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getAdminVouchers({ page: 1, pageSize: 100 });
      setVouchers(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vouchers.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadVouchers();
    });
  }, [loadVouchers]);

  function updateForm<K extends keyof VoucherForm>(
    key: K,
    value: VoucherForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreateModal() {
    setForm({
      ...emptyForm,
      name:
        activeTab === "event"
          ? "Giam 20% chuyen dau"
          : "Goi Premium - Giam 100K",
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
    });
    setCreateOpen(true);
    setMessage("");
    setError("");
  }

  async function handleCreate() {
    setMessage("");
    setError("");

    try {
      const created = await createAdminVoucher(toCreateRequest(form, activeTab));
      setVouchers((current) => [created, ...current]);
      setCreateOpen(false);
      setMessage(t("vouchers.saveSuccess", { action: t("vouchers.saveActionCreate") }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vouchers.createFailed"));
    }
  }

  const getApplicableLabel = (applicableTo = "all") => {
    const map: Record<string, string> = {
      all: t("vouchers.allServices"),
      rides: t("vouchers.tripsOnly"),
      parcels: t("vouchers.parcelsOnly"),
      packages: t("vouchers.packagesOnly"),
    };
    return map[applicableTo] ?? applicableTo;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("vouchers.title")}
          </h1>
          <p className="mt-1 text-gray-600">{t("vouchers.subtitleLong")}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadVouchers}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FiRefreshCw size={16} />
            {tc("refresh")}
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
          >
            <FiPlus size={16} />
            {t("vouchers.create")}
          </button>
        </div>
      </div>

      <div className="flex gap-0 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("event")}
          className={`border-b-2 px-6 py-3 text-sm font-medium transition ${
            activeTab === "event"
              ? "border-vr-500 text-vr-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          {t("vouchers.tabEvent")}
          <span className="ml-2 rounded-full bg-vr-100 px-2 py-1 text-xs text-vr-700">
            {eventVouchers.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("package")}
          className={`border-b-2 px-6 py-3 text-sm font-medium transition ${
            activeTab === "package"
              ? "border-vr-500 text-vr-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          {t("vouchers.tabPackage")}
          <span className="ml-2 rounded-full bg-vr-100 px-2 py-1 text-xs text-vr-700">
            {packageVouchers.length}
          </span>
        </button>
      </div>

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

      <div className="space-y-4">
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {activeTab === "event"
              ? t("vouchers.eventSectionTitle")
              : t("vouchers.packageSectionTitle")}
          </h2>
          <p className="mb-6 text-sm text-gray-600">
            {activeTab === "event"
              ? t("vouchers.eventSectionDesc")
              : t("vouchers.packageSectionDesc")}
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-gray-200 bg-white px-6 py-8 text-sm text-gray-500">
            {t("vouchers.loading")}
          </div>
        ) : currentVouchers.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 py-12 text-center">
            <FiTag size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">
              {t("vouchers.emptyType", {
                type:
                  activeTab === "event"
                    ? t("vouchers.emptyTypeEvent")
                    : t("vouchers.emptyTypePackage"),
              })}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {t("vouchers.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[880px]">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    {t("vouchers.code")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    {t("vouchers.name")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    {t("vouchers.discount")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    {t("vouchers.applicable")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    {t("vouchers.issued")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    {t("vouchers.used")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    {t("vouchers.expiry")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    {tc("status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentVouchers.map((voucher) => {
                  const quantity = quantityOf(voucher);
                  const usedCount = usedCountOf(voucher);
                  const usageRate =
                    quantity > 0 ? Math.round((usedCount / quantity) * 100) : 0;
                  const expiryDate = expiryDateOf(voucher)
                    ? new Date(expiryDateOf(voucher)).toLocaleDateString("vi-VN")
                    : "-";
                  const discount = discountValueOf(voucher);

                  return (
                    <tr key={voucher.id} className="border-t border-gray-200">
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="font-mono font-semibold text-vr-600">
                          {voucher.code}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{voucher.name}</p>
                        <p className="text-xs text-gray-500">
                          {voucher.description}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="text-lg font-bold text-gray-900">
                          {discountTypeOf(voucher) === "percent"
                            ? `${discount}%`
                            : `${formatNumber(discount)}₫`}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {getApplicableLabel(voucher.applicableTo)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {formatNumber(quantity)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="w-20">
                          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-2 rounded-full bg-vr-500"
                              style={{ width: `${Math.min(100, usageRate)}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-gray-600">
                            {formatNumber(usedCount)} ({usageRate}%)
                          </p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        {expiryDate}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                            activeOf(voucher)
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {activeOf(voucher) ? tc("active") : tc("inactive")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        wide
        icon={<FiTag size={20} />}
        title={t("vouchers.createTitle")}
        subtitle={
          activeTab === "event"
            ? t("vouchers.createEventSubtitle")
            : t("vouchers.createPackageSubtitle")
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-bold text-white hover:bg-vr-600"
            >
              {t("vouchers.saveButton", {
                action: t("vouchers.saveActionCreate"),
              })}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("vouchers.voucherCode")}
              value={form.code}
              onChange={(value) => updateForm("code", value)}
              placeholder={t("vouchers.codePlaceholder")}
              required
            />
            <Field
              label={t("vouchers.displayName")}
              value={form.name}
              onChange={(value) => updateForm("name", value)}
              required
            />
          </div>

          <div>
            <label className={labelClass}>{tc("description")}</label>
            <textarea
              className={inputClass + " min-h-[88px]"}
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              placeholder={
                activeTab === "event"
                  ? t("vouchers.eventDescPlaceholder")
                  : t("vouchers.packageDescPlaceholder")
              }
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("vouchers.discountType")}</label>
              <select
                className={inputClass}
                value={form.discountType}
                onChange={(event) => updateForm("discountType", event.target.value)}
              >
                <option value="percent">{t("vouchers.percentDiscount")}</option>
                <option value="fixed">{t("vouchers.fixedDiscount")}</option>
              </select>
            </div>
            <Field
              label={t("vouchers.discountValue")}
              value={form.discount}
              type="number"
              onChange={(value) => updateForm("discount", value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("vouchers.applicable")}</label>
              <select
                className={inputClass}
                value={form.applicableTo}
                onChange={(event) => updateForm("applicableTo", event.target.value)}
              >
                <option value="all">{t("vouchers.allServicesFull")}</option>
                <option value="rides">{t("vouchers.ridesOnlyFull")}</option>
                <option value="parcels">{t("vouchers.parcelsOnly")}</option>
                <option value="packages">{t("vouchers.packagesOnly")}</option>
              </select>
            </div>
            <Field
              label={t("vouchers.minOrder")}
              value={form.minOrderValue}
              type="number"
              onChange={(value) => updateForm("minOrderValue", value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("vouchers.quantity")}
              value={form.quantity}
              type="number"
              onChange={(value) => updateForm("quantity", value)}
              required
            />
            <Field
              label={t("vouchers.expiryDate")}
              value={form.expiryDate}
              type="date"
              onChange={(value) => updateForm("expiryDate", value)}
              required
            />
          </div>

          <Field
            label={t("vouchers.maxUsagePerUser")}
            value={form.maxUsagePerUser}
            type="number"
            onChange={(value) => updateForm("maxUsagePerUser", value)}
          />

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => updateForm("active", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-vr-600 focus:ring-vr-500"
            />
            <span>
              <span className="block text-sm font-bold text-gray-900">
                {t("vouchers.activateOnCreateTitle")}
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {t("vouchers.activateOnCreateHint")}
              </span>
            </span>
          </label>
        </div>
      </Modal>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        className={inputClass}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
