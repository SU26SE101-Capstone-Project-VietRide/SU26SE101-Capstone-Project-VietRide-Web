import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiEdit2, FiPlus, FiPower, FiRefreshCw, FiTag } from "react-icons/fi";
import {
  activateAdminCampaign,
  createAdminCampaign,
  createAdminVoucher,
  deactivateAdminCampaign,
  getAdminOperators,
  getAdminCampaigns,
  getAdminVouchers,
  updateAdminCampaign,
  type AdminCampaign,
  type AdminCampaignRequest,
  type AdminOperator,
  type AdminVoucher,
  type CreateAdminVoucherRequest,
} from "../../api/vietride";
import CurrencyInput from "../../components/CurrencyInput";
import Modal from "../../components/Modal";
import CustomSelect from "../../components/CustomSelect";
import { formatDateOnly } from "../../utils/date";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

type VoucherTab = "booking" | "parcel";

type VoucherForm = {
  code: string;
  name: string;
  description: string;
  discountType: string;
  discount: string;
  maxDiscountAmount: string;
  applicableTo: string;
  fundingType: string;
  operatorScope: string;
  applicableOperatorIds: string;
  minOrderValue: string;
  quantity: string;
  expiryDate: string;
  maxUsagePerUser: string;
  active: boolean;
};

type CampaignForm = {
  name: string;
  description: string;
  ownerOperatorId: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  voucherIds: string[];
};

const emptyForm: VoucherForm = {
  code: "",
  name: "",
  description: "",
  discountType: "PERCENT_OFF",
  discount: "10",
  maxDiscountAmount: "50000",
  applicableTo: "all",
  fundingType: "VIETRIDE_FUNDED",
  operatorScope: "ALL_OPERATORS",
  applicableOperatorIds: "",
  minOrderValue: "0",
  quantity: "1000",
  expiryDate: "",
  maxUsagePerUser: "1",
  active: true,
};

const emptyCampaignForm: CampaignForm = {
  name: "",
  description: "",
  ownerOperatorId: "",
  validFrom: "",
  validUntil: "",
  isActive: true,
  voucherIds: [],
};

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

function toNumber(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function voucherServicesOf(voucher: AdminVoucher) {
  return voucher.applicableServices ?? [];
}

function isBookingVoucher(voucher: AdminVoucher) {
  const services = voucherServicesOf(voucher);
  return services.length === 0 || services.includes("BOOKING");
}

function isParcelVoucher(voucher: AdminVoucher) {
  return voucherServicesOf(voucher).includes("PARCEL");
}

function discountTypeOf(voucher: AdminVoucher) {
  const type = (voucher.discountType ?? voucher.type ?? "").toUpperCase();
  return type.includes("FIXED") ? "fixed" : "percent";
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

function formatInputDate(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDisplayDate(value: string) {
  return formatDateOnly(value);
}

function parseInputDate(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const vietnameseDate = trimmedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (vietnameseDate) {
    const [, day, month, year] = vietnameseDate;
    return new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59);
  }

  const browserDate = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (browserDate) {
    const [, year, month, day] = browserDate;
    return new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59);
  }

  return null;
}

function toEndOfDayIso(value: string) {
  const date = parseInputDate(value) ?? new Date();
  return date.toISOString();
}

function activeOf(voucher: AdminVoucher) {
  return voucher.active ?? voucher.isActive ?? false;
}

function toOperatorIds(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toApplicableServices(applicableTo: string) {
  if (applicableTo === "rides") {
    return ["BOOKING"];
  }

  if (applicableTo === "parcels") {
    return ["PARCEL"];
  }

  return ["BOOKING", "PARCEL"];
}

function operatorIdsToValue(operatorIds: string[]) {
  return operatorIds.join(", ");
}

function isActiveOperator(operator: AdminOperator) {
  return operator.registrationStatus === "APPROVED" && operator.isActive !== false;
}

function toCreateRequest(form: VoucherForm): CreateAdminVoucherRequest {
  const selectedOperatorIds = toOperatorIds(form.applicableOperatorIds);

  return {
    code: form.code.trim() || undefined,
    name: form.name.trim(),
    type: form.discountType,
    value: toNumber(form.discount),
    minOrderAmount: toNumber(form.minOrderValue),
    maxDiscountAmount: toNumber(form.maxDiscountAmount),
    totalUsageLimit: toNumber(form.quantity),
    perUserLimit: toNumber(form.maxUsagePerUser),
    validFrom: new Date().toISOString(),
    validUntil: toEndOfDayIso(form.expiryDate),
    newUserOnly: false,
    applicablePaymentMethods: ["VNPAY", "WALLET"],
    applicableServices: toApplicableServices(form.applicableTo),
    applicableOperatorIds:
      form.operatorScope === "SELECTED_OPERATORS" ? selectedOperatorIds : null,
    applicableRouteIds: null,
    fundingType: form.fundingType,
  };
}

function toCampaignRequest(form: CampaignForm): AdminCampaignRequest {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    ownerOperatorId: form.ownerOperatorId || null,
    validFrom: toEndOfDayIso(form.validFrom),
    validUntil: toEndOfDayIso(form.validUntil),
    isActive: form.isActive,
    voucherIds: form.voucherIds,
  };
}

export default function Vouchers() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [activeTab, setActiveTab] = useState<VoucherTab>("booking");
  const [vouchers, setVouchers] = useState<AdminVoucher[]>([]);
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [operators, setOperators] = useState<AdminOperator[]>([]);
  const [form, setForm] = useState<VoucherForm>(emptyForm);
  const [campaignForm, setCampaignForm] =
    useState<CampaignForm>(emptyCampaignForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<AdminCampaign | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCampaignActionLoading, setIsCampaignActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const bookingVouchers = useMemo(
    () => vouchers.filter(isBookingVoucher),
    [vouchers],
  );
  const parcelVouchers = useMemo(
    () => vouchers.filter(isParcelVoucher),
    [vouchers],
  );
  const currentVouchers =
    activeTab === "booking" ? bookingVouchers : parcelVouchers;

  const loadVouchers = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [voucherResult, operatorResult, campaignResult] = await Promise.all([
        getAdminVouchers({ page: 1, pageSize: 100 }),
        getAdminOperators({ page: 1, pageSize: 100 }),
        getAdminCampaigns(),
      ]);
      setVouchers(voucherResult.items);
      setOperators(operatorResult.items);
      setCampaigns(campaignResult);
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
      applicableTo: activeTab === "booking" ? "rides" : "parcels",
      name:
        activeTab === "booking"
          ? "Giam 20% chuyen dau"
          : "Giam 20% gui hang",
      expiryDate: formatInputDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ),
    });
    setCreateOpen(true);
    setMessage("");
    setError("");
  }

  function openCreateCampaignModal() {
    setCampaignForm({
      ...emptyCampaignForm,
      name: "Campaign khuyen mai",
      validFrom: formatInputDate(new Date()),
      validUntil: formatInputDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ),
    });
    setEditingCampaign(null);
    setCampaignOpen(true);
    setMessage("");
    setError("");
  }

  function openEditCampaignModal(campaign: AdminCampaign) {
    setCampaignForm({
      name: campaign.name,
      description: campaign.description ?? "",
      ownerOperatorId: campaign.ownerOperatorId ?? "",
      validFrom: formatDisplayDate(campaign.validFrom),
      validUntil: formatDisplayDate(campaign.validUntil),
      isActive: campaign.isActive,
      voucherIds: [],
    });
    setEditingCampaign(campaign);
    setCampaignOpen(true);
    setMessage("");
    setError("");
  }

  async function handleCreate() {
    setMessage("");
    setError("");

    const expiryDate = parseInputDate(form.expiryDate);
    if (!expiryDate || expiryDate <= new Date()) {
      setError(t("vouchers.invalidExpiryDate"));
      return;
    }

    if (toNumber(form.maxDiscountAmount) <= 0) {
      setError(t("vouchers.invalidMaxDiscountAmount"));
      return;
    }

    if (
      form.fundingType === "OPERATOR_FUNDED" &&
      toOperatorIds(form.applicableOperatorIds).length === 0
    ) {
      setError(t("vouchers.operatorFundedRequiresOperators"));
      return;
    }

    try {
      const created = await createAdminVoucher(toCreateRequest(form));
      setVouchers((current) => [created, ...current]);
      setCreateOpen(false);
      setMessage(t("vouchers.saveSuccess", { action: t("vouchers.saveActionCreate") }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vouchers.createFailed"));
    }
  }

  async function handleSaveCampaign() {
    setMessage("");
    setError("");

    if (!campaignForm.name.trim()) {
      setError(t("vouchers.campaignNameRequired"));
      return;
    }

    const validFrom = parseInputDate(campaignForm.validFrom);
    const validUntil = parseInputDate(campaignForm.validUntil);
    if (!validFrom || !validUntil || validUntil <= validFrom) {
      setError(t("vouchers.invalidCampaignDates"));
      return;
    }

    if (campaignForm.voucherIds.length === 0) {
      setError(t("vouchers.campaignVoucherRequired"));
      return;
    }

    setIsCampaignActionLoading(true);
    try {
      const request = toCampaignRequest(campaignForm);
      const saved = editingCampaign
        ? await updateAdminCampaign(editingCampaign.id, request)
        : await createAdminCampaign(request);

      setCampaigns((current) =>
        editingCampaign
          ? current.map((campaign) =>
              campaign.id === saved.id ? saved : campaign,
            )
          : [saved, ...current],
      );
      setCampaignOpen(false);
      setMessage(t("vouchers.campaignSaveSuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vouchers.campaignSaveFailed"));
    } finally {
      setIsCampaignActionLoading(false);
    }
  }

  async function handleToggleCampaign(campaign: AdminCampaign) {
    setMessage("");
    setError("");
    setIsCampaignActionLoading(true);

    try {
      const updated = campaign.isActive
        ? await deactivateAdminCampaign(campaign.id)
        : await activateAdminCampaign(campaign.id);

      setCampaigns((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setMessage(
        campaign.isActive
          ? t("vouchers.campaignDeactivateSuccess")
          : t("vouchers.campaignActivateSuccess"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vouchers.campaignSaveFailed"));
    } finally {
      setIsCampaignActionLoading(false);
    }
  }

  const getApplicableLabel = (applicableTo = "all") => {
    const map: Record<string, string> = {
      all: t("vouchers.allServices"),
      rides: t("vouchers.tripsOnly"),
      parcels: t("vouchers.parcelsOnly"),
    };
    return map[applicableTo] ?? applicableTo;
  };

  const getFundingLabel = (fundingType = "VIETRIDE_FUNDED") => {
    const map: Record<string, string> = {
      VIETRIDE_FUNDED: t("vouchers.vietrideFunded"),
      OPERATOR_FUNDED: t("vouchers.operatorFunded"),
    };
    return map[fundingType] ?? fundingType;
  };

  const getOperatorScopeLabel = (voucher: AdminVoucher) => {
    if (voucher.operatorScope === "SELECTED_OPERATORS") {
      const count = voucher.applicableOperatorIds?.length ?? 0;
      return t("vouchers.selectedOperatorsCount", { count });
    }

    return t("vouchers.allOperators");
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
          onClick={() => setActiveTab("booking")}
          className={`border-b-2 px-6 py-3 text-sm font-medium transition ${
            activeTab === "booking"
              ? "border-vr-500 text-vr-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          {t("vouchers.tabBooking")}
          <span className="ml-2 rounded-full bg-vr-100 px-2 py-1 text-xs text-vr-700">
            {bookingVouchers.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("parcel")}
          className={`border-b-2 px-6 py-3 text-sm font-medium transition ${
            activeTab === "parcel"
              ? "border-vr-500 text-vr-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          {t("vouchers.tabParcel")}
          <span className="ml-2 rounded-full bg-vr-100 px-2 py-1 text-xs text-vr-700">
            {parcelVouchers.length}
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
            {activeTab === "booking"
              ? t("vouchers.bookingSectionTitle")
              : t("vouchers.parcelSectionTitle")}
          </h2>
          <p className="mb-6 text-sm text-gray-600">
            {activeTab === "booking"
              ? t("vouchers.bookingSectionDesc")
              : t("vouchers.parcelSectionDesc")}
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
                  activeTab === "booking"
                    ? t("vouchers.emptyTypeBooking")
                    : t("vouchers.emptyTypeParcel"),
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
                    {t("vouchers.fundingAndScope")}
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
                  const expiryDate = formatDisplayDate(expiryDateOf(voucher));
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
                        <p className="text-sm font-medium text-gray-900">
                          {getFundingLabel(voucher.fundingType)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getOperatorScopeLabel(voucher)}
                        </p>
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

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {t("vouchers.campaignsTitle")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t("vouchers.campaignsDesc")}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateCampaignModal}
            className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
          >
            <FiPlus size={16} />
            {t("vouchers.createCampaign")}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">{t("vouchers.name")}</th>
                <th className="px-5 py-3">{t("vouchers.operatorScope")}</th>
                <th className="px-5 py-3">{t("vouchers.validity")}</th>
                <th className="px-5 py-3">{tc("status")}</th>
                <th className="px-5 py-3 text-right">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-900">{campaign.name}</p>
                    <p className="text-xs text-gray-500">{campaign.description}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {campaign.ownerOperatorId ?? t("vouchers.allOperators")}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {formatDisplayDate(campaign.validFrom)} -{" "}
                    {formatDisplayDate(campaign.validUntil)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        campaign.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {campaign.isActive ? tc("active") : tc("inactive")}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditCampaignModal(campaign)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                        aria-label={tc("edit")}
                        title={tc("edit")}
                      >
                        <FiEdit2 size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={isCampaignActionLoading}
                        onClick={() => void handleToggleCampaign(campaign)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={
                          campaign.isActive
                            ? t("vouchers.deactivateCampaign")
                            : t("vouchers.activateCampaign")
                        }
                        title={
                          campaign.isActive
                            ? t("vouchers.deactivateCampaign")
                            : t("vouchers.activateCampaign")
                        }
                      >
                        <FiPower size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && campaigns.length === 0 && (
            <p className="border-t border-gray-100 px-5 py-6 text-center text-sm text-gray-500">
              {t("vouchers.noCampaigns")}
            </p>
          )}
        </div>
      </section>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        wide
        icon={<FiTag size={20} />}
        title={t("vouchers.createTitle")}
        subtitle={
          activeTab === "booking"
            ? t("vouchers.createBookingSubtitle")
            : t("vouchers.createParcelSubtitle")
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
                activeTab === "booking"
                  ? t("vouchers.bookingDescPlaceholder")
                  : t("vouchers.parcelDescPlaceholder")
              }
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("vouchers.discountType")}</label>
              <CustomSelect
                className={inputClass}
                value={form.discountType}
                onChange={(event) => updateForm("discountType", event.target.value)}
              >
                <option value="PERCENT_OFF">
                  {t("vouchers.percentDiscount")}
                </option>
                <option value="FIXED_AMOUNT">
                  {t("vouchers.fixedDiscount")}
                </option>
              </CustomSelect>
            </div>
            <Field
              label={t("vouchers.discountValue")}
              value={form.discount}
              type="number"
              currency={form.discountType === "FIXED_AMOUNT"}
              onChange={(value) => updateForm("discount", value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("vouchers.maxDiscountAmount")}
              value={form.maxDiscountAmount}
              type="number"
              currency
              onChange={(value) => updateForm("maxDiscountAmount", value)}
              required
            />
            <div>
              <label className={labelClass}>{t("vouchers.applicable")}</label>
              <CustomSelect
                className={inputClass}
                value={form.applicableTo}
                onChange={(event) => updateForm("applicableTo", event.target.value)}
              >
                <option value="all">{t("vouchers.allServicesFull")}</option>
                <option value="rides">{t("vouchers.ridesOnlyFull")}</option>
                <option value="parcels">{t("vouchers.parcelsOnly")}</option>
              </CustomSelect>
            </div>
            <Field
              label={t("vouchers.minOrder")}
              value={form.minOrderValue}
              type="number"
              currency
              onChange={(value) => updateForm("minOrderValue", value)}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t("vouchers.fundingType")}</label>
                <CustomSelect
                  className={inputClass}
                  value={form.fundingType}
                  onChange={(event) =>
                    updateForm("fundingType", event.target.value)
                  }
                >
                  <option value="VIETRIDE_FUNDED">
                    {t("vouchers.vietrideFunded")}
                  </option>
                  <option value="OPERATOR_FUNDED">
                    {t("vouchers.operatorFunded")}
                  </option>
                </CustomSelect>
                <p className="mt-1 text-xs text-gray-500">
                  {form.fundingType === "VIETRIDE_FUNDED"
                    ? t("vouchers.vietrideFundedHint")
                    : t("vouchers.operatorFundedHint")}
                </p>
              </div>
              <div>
                <label className={labelClass}>{t("vouchers.operatorScope")}</label>
                <CustomSelect
                  className={inputClass}
                  value={form.operatorScope}
                  onChange={(event) =>
                    updateForm("operatorScope", event.target.value)
                  }
                >
                  <option value="ALL_OPERATORS">
                    {t("vouchers.allOperators")}
                  </option>
                  <option value="SELECTED_OPERATORS">
                    {t("vouchers.selectedOperators")}
                  </option>
                </CustomSelect>
                <p className="mt-1 text-xs text-gray-500">
                  {form.fundingType === "OPERATOR_FUNDED"
                    ? t("vouchers.operatorConsentHint")
                    : t("vouchers.operatorScopeHint")}
                </p>
              </div>
            </div>

            {(form.operatorScope === "SELECTED_OPERATORS" ||
              form.fundingType === "OPERATOR_FUNDED") && (
              <OperatorSelector
                operators={operators.filter(isActiveOperator)}
                selectedOperatorIds={toOperatorIds(form.applicableOperatorIds)}
                onChange={(operatorIds) =>
                  updateForm("applicableOperatorIds", operatorIdsToValue(operatorIds))
                }
              />
            )}
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
              placeholder="dd/mm/yyyy"
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

      <Modal
        open={campaignOpen}
        onClose={() => setCampaignOpen(false)}
        wide
        icon={<FiTag size={20} />}
        title={
          editingCampaign
            ? t("vouchers.editCampaign")
            : t("vouchers.createCampaign")
        }
        subtitle={t("vouchers.campaignModalSubtitle")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setCampaignOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              disabled={isCampaignActionLoading}
              onClick={() => void handleSaveCampaign()}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-bold text-white hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {editingCampaign
                ? t("vouchers.saveActionUpdate")
                : t("vouchers.createCampaign")}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("vouchers.campaignName")}
              value={campaignForm.name}
              onChange={(value) =>
                setCampaignForm((current) => ({ ...current, name: value }))
              }
              required
            />
            <div>
              <label className={labelClass}>{t("vouchers.ownerOperator")}</label>
              <CustomSelect
                className={inputClass}
                value={campaignForm.ownerOperatorId}
                onChange={(event) =>
                  setCampaignForm((current) => ({
                    ...current,
                    ownerOperatorId: event.target.value,
                  }))
                }
              >
                <option value="">{t("vouchers.allOperators")}</option>
                {operators.filter(isActiveOperator).map((operator) => (
                  <option key={operator.operatorId} value={operator.operatorId}>
                    {operator.name}
                  </option>
                ))}
              </CustomSelect>
            </div>
          </div>
          <div>
            <label className={labelClass}>{tc("description")}</label>
            <textarea
              className={`${inputClass} min-h-[88px]`}
              value={campaignForm.description}
              onChange={(event) =>
                setCampaignForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("vouchers.validFrom")}
              value={campaignForm.validFrom}
              placeholder="dd/mm/yyyy"
              onChange={(value) =>
                setCampaignForm((current) => ({ ...current, validFrom: value }))
              }
              required
            />
            <Field
              label={t("vouchers.validUntil")}
              value={campaignForm.validUntil}
              placeholder="dd/mm/yyyy"
              onChange={(value) =>
                setCampaignForm((current) => ({ ...current, validUntil: value }))
              }
              required
            />
          </div>
          <CampaignVoucherSelector
            vouchers={vouchers}
            selectedVoucherIds={campaignForm.voucherIds}
            onChange={(voucherIds) =>
              setCampaignForm((current) => ({ ...current, voucherIds }))
            }
          />
          <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
            <input
              type="checkbox"
              checked={campaignForm.isActive}
              onChange={(event) =>
                setCampaignForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
              className="mt-1 h-4 w-4 rounded border-gray-300 text-vr-600 focus:ring-vr-500"
            />
            <span>
              <span className="block text-sm font-bold text-gray-900">
                {t("vouchers.activateCampaign")}
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {t("vouchers.activateCampaignHint")}
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
  currency = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  currency?: boolean;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {currency ? (
        <CurrencyInput
          className={inputClass}
          value={value}
          placeholder={placeholder}
          required={required}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={inputClass}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

function OperatorSelector({
  operators,
  selectedOperatorIds,
  onChange,
}: {
  operators: AdminOperator[];
  selectedOperatorIds: string[];
  onChange: (operatorIds: string[]) => void;
}) {
  const { t } = useTranslation("admin");
  const visibleOperatorIds = operators.map((operator) => operator.operatorId);
  const visibleSelectedOperatorIds = selectedOperatorIds.filter((operatorId) =>
    visibleOperatorIds.includes(operatorId),
  );

  function toggleOperator(operatorId: string) {
    const nextOperatorIds = visibleSelectedOperatorIds.includes(operatorId)
      ? visibleSelectedOperatorIds.filter((id) => id !== operatorId)
      : [...visibleSelectedOperatorIds, operatorId];

    onChange(nextOperatorIds);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <label className={labelClass}>{t("vouchers.selectOperators")}</label>
        <span className="text-xs font-medium text-gray-500">
          {t("vouchers.selectedOperatorsCount", {
            count: visibleSelectedOperatorIds.length,
          })}
        </span>
      </div>
      <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
        {operators.length > 0 ? (
          <div className="space-y-1">
            {operators.map((operator) => {
              const checked = visibleSelectedOperatorIds.includes(
                operator.operatorId,
              );

              return (
                <label
                  key={operator.operatorId}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-sm ${
                    checked
                      ? "bg-vr-50 text-vr-800"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOperator(operator.operatorId)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-vr-600 focus:ring-vr-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {operator.name}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {operator.contactEmail || operator.operatorId}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="px-3 py-2 text-sm text-gray-500">
            {t("vouchers.noOperatorsAvailable")}
          </p>
        )}
      </div>
    </div>
  );
}

function CampaignVoucherSelector({
  vouchers,
  selectedVoucherIds,
  onChange,
}: {
  vouchers: AdminVoucher[];
  selectedVoucherIds: string[];
  onChange: (voucherIds: string[]) => void;
}) {
  const { t } = useTranslation("admin");

  function toggleVoucher(voucherId: string) {
    const nextVoucherIds = selectedVoucherIds.includes(voucherId)
      ? selectedVoucherIds.filter((id) => id !== voucherId)
      : [...selectedVoucherIds, voucherId];

    onChange(nextVoucherIds);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className={labelClass}>{t("vouchers.campaignVouchers")}</label>
        <span className="text-xs font-medium text-gray-500">
          {t("vouchers.selectedVouchersCount", {
            count: selectedVoucherIds.length,
          })}
        </span>
      </div>
      <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
        {vouchers.length > 0 ? (
          <div className="space-y-1">
            {vouchers.map((voucher) => {
              const checked = selectedVoucherIds.includes(voucher.id);

              return (
                <label
                  key={voucher.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-sm ${
                    checked
                      ? "bg-vr-50 text-vr-800"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleVoucher(voucher.id)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-vr-600 focus:ring-vr-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {voucher.name}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {voucher.code}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="px-3 py-2 text-sm text-gray-500">
            {t("vouchers.noVouchersAvailable")}
          </p>
        )}
      </div>
    </div>
  );
}
