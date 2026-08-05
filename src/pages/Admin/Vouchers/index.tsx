import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiRefreshCw, FiTag, FiTrash2 } from "react-icons/fi";
import {
  activateAdminCampaign,
  createAdminCampaign,
  createAdminVoucher,
  deleteAdminVoucher,
  deactivateAdminCampaign,
  getAdminOperators,
  getAdminCampaigns,
  getAdminVouchers,
  updateAdminCampaign,
  updateAdminVoucher,
  type AdminCampaign,
  type AdminOperator,
  type AdminVoucher,
} from "../../../api/vietride";
import Modal from "../../../components/Modal";
import CampaignModal from "./CampaignModal";
import CampaignTable from "./CampaignTable";
import { DetailItem } from "./formControls";
import type { CampaignForm, VoucherForm } from "./types";
import { useVoucherLabels } from "./useVoucherLabels";
import VoucherModal from "./VoucherModal";
import VoucherTable from "./VoucherTable";
import {
  activeOf,
  applicableToOf,
  discountTypeOf,
  discountValueOf,
  emptyCampaignForm,
  emptyForm,
  expiryDateOf,
  formatDisplayDate,
  formatInputDate,
  formatNumber,
  maxDiscountAmountOf,
  parseInputDate,
  quantityOf,
  toCampaignRequest,
  toCreateRequest,
  toForm,
  toOperatorIds,
  toUpdateRequest,
  usedCountOf,
} from "./voucherHelpers";

export default function Vouchers() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [vouchers, setVouchers] = useState<AdminVoucher[]>([]);
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [operators, setOperators] = useState<AdminOperator[]>([]);
  const [form, setForm] = useState<VoucherForm>(emptyForm);
  const [campaignForm, setCampaignForm] =
    useState<CampaignForm>(emptyCampaignForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<AdminVoucher | null>(null);
  const [detailVoucher, setDetailVoucher] = useState<AdminVoucher | null>(null);
  const [deletingVoucher, setDeletingVoucher] = useState<AdminVoucher | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<AdminCampaign | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCampaignActionLoading, setIsCampaignActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [voucherPage, setVoucherPage] = useState(1);
  const [campaignPage, setCampaignPage] = useState(1);
  const pageSize = 8;

  const paginatedVouchers = useMemo(
    () =>
      vouchers.slice(
        (voucherPage - 1) * pageSize,
        voucherPage * pageSize,
      ),
    [vouchers, voucherPage],
  );
  const paginatedCampaigns = useMemo(
    () =>
      campaigns.slice(
        (campaignPage - 1) * pageSize,
        campaignPage * pageSize,
      ),
    [campaignPage, campaigns],
  );

  // tRef để loadVouchers không phụ thuộc `t` (tránh refetch khi đổi ngôn ngữ)
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

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
      setError(
        err instanceof Error ? err.message : tRef.current("vouchers.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Giữ queueMicrotask để thoả rule react-hooks/set-state-in-effect
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
    setEditingVoucher(null);
    setForm({
      ...emptyForm,
      applicableTo: "rides",
      name: "Giam 20% chuyen dau",
      expiryDate: formatInputDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ),
    });
    setCreateOpen(true);
    setMessage("");
    setError("");
  }

  function openEditModal(voucher: AdminVoucher) {
    setEditingVoucher(voucher);
    setForm(toForm(voucher));
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

  async function handleSaveVoucher() {
    setMessage("");
    setError("");

    const expiryDate = parseInputDate(form.expiryDate);
    if (!expiryDate || expiryDate <= new Date()) {
      setError(t("vouchers.invalidExpiryDate"));
      return;
    }

    if (maxDiscountAmountOf(form) <= 0) {
      setError(t("vouchers.invalidMaxDiscountAmount"));
      return;
    }

    if (
      !editingVoucher &&
      form.fundingType === "OPERATOR_FUNDED" &&
      toOperatorIds(form.applicableOperatorIds).length === 0
    ) {
      setError(t("vouchers.operatorFundedRequiresOperators"));
      return;
    }

    try {
      const saved = editingVoucher
        ? await updateAdminVoucher(editingVoucher.id, toUpdateRequest(form))
        : await createAdminVoucher(toCreateRequest(form));

      setVouchers((current) =>
        editingVoucher
          ? current.map((voucher) => (voucher.id === saved.id ? saved : voucher))
          : [saved, ...current],
      );
      setCreateOpen(false);
      setEditingVoucher(null);
      setMessage(
        t("vouchers.saveSuccess", {
          action: editingVoucher
            ? t("vouchers.saveActionUpdate")
            : t("vouchers.saveActionCreate"),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vouchers.createFailed"));
    }
  }

  async function handleDeleteVoucher() {
    if (!deletingVoucher) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await deleteAdminVoucher(deletingVoucher.id);
      setVouchers((current) =>
        current.filter((voucher) => voucher.id !== deletingVoucher.id),
      );
      setDeletingVoucher(null);
      setMessage(t("vouchers.deleteSuccess", { id: deletingVoucher.code }));
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

  const { getApplicableLabel, getFundingLabel, getOperatorScopeLabel } =
    useVoucherLabels();

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

      <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4"><div className="mb-1 flex items-center gap-3"><span className="h-5 w-1 rounded-full bg-vr-500" /><h3 className="font-bold text-gray-900">{t("vouchers.setupTitle")}</h3></div><p className="text-sm text-gray-500">{t("vouchers.setupDesc")}</p></div>
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("vouchers.title")}
          </h2>
          <p className="mb-6 text-sm text-gray-600">
            {t("vouchers.subtitleLong")}
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-gray-200 bg-white px-6 py-8 text-sm text-gray-500">
            {t("vouchers.loading")}
          </div>
        ) : vouchers.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 py-12 text-center">
            <FiTag size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">
              {t("vouchers.emptyType", {
                type: t("vouchers.emptyTypeBooking"),
              })}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {t("vouchers.emptyHint")}
            </p>
          </div>
        ) : (
          <VoucherTable
            vouchers={paginatedVouchers}
            page={voucherPage}
            pageSize={pageSize}
            totalItems={vouchers.length}
            onPageChange={setVoucherPage}
            getFundingLabel={getFundingLabel}
            getOperatorScopeLabel={getOperatorScopeLabel}
            onView={setDetailVoucher}
            onEdit={openEditModal}
            onDelete={setDeletingVoucher}
          />
        )}
      </div>

      <CampaignTable
        campaigns={paginatedCampaigns}
        page={campaignPage}
        pageSize={pageSize}
        totalItems={campaigns.length}
        onPageChange={setCampaignPage}
        isLoading={isLoading}
        isActionLoading={isCampaignActionLoading}
        onCreate={openCreateCampaignModal}
        onEdit={openEditCampaignModal}
        onToggle={(campaign) => void handleToggleCampaign(campaign)}
      />

      <Modal
        open={detailVoucher !== null}
        onClose={() => setDetailVoucher(null)}
        wide
        icon={<FiTag size={20} />}
        title={t("vouchers.detailTitle")}
        subtitle={detailVoucher?.code}
        footer={<button type="button" onClick={() => setDetailVoucher(null)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700">{tc("close")}</button>}
      >
        {detailVoucher && (
          <div className="space-y-5">
            <section className="rounded-2xl border border-vr-100 bg-gradient-to-br from-vr-50 to-white p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-vr-700">{t("vouchers.code")}</p><p className="mt-1 text-xl font-bold text-gray-900">{detailVoucher.code}</p><p className="mt-1 text-sm text-gray-600">{detailVoucher.name}</p></div><div className="text-right"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("vouchers.discount")}</p><p className="mt-1 text-2xl font-bold text-vr-700">{discountTypeOf(detailVoucher) === "percent" ? String(discountValueOf(detailVoucher)) + "%" : formatNumber(discountValueOf(detailVoucher)) + "₫"}</p><span className={"mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold " + (activeOf(detailVoucher) ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600")}>{activeOf(detailVoucher) ? tc("active") : tc("inactive")}</span></div></div></section>
            <section className="rounded-2xl border border-gray-200 bg-white p-5"><h3 className="mb-4 text-base font-bold text-gray-900">{t("vouchers.detailScopeTitle")}</h3><div className="grid gap-4 sm:grid-cols-3"><DetailItem label={t("vouchers.applicable")} value={getApplicableLabel(applicableToOf(detailVoucher))} /><DetailItem label={t("vouchers.fundingType")} value={getFundingLabel(detailVoucher.fundingType)} /><DetailItem label={t("vouchers.operatorScope")} value={getOperatorScopeLabel(detailVoucher)} /></div></section>
            <section className="rounded-2xl border border-gray-200 bg-white p-5"><h3 className="mb-4 text-base font-bold text-gray-900">{t("vouchers.detailIssuanceTitle")}</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><DetailItem label={t("vouchers.issued")} value={formatNumber(quantityOf(detailVoucher))} /><DetailItem label={t("vouchers.used")} value={formatNumber(usedCountOf(detailVoucher))} /><DetailItem label={t("vouchers.issuedFrom")} value={formatDisplayDate(detailVoucher.validFrom ?? "")} /><DetailItem label={t("vouchers.expiry")} value={formatDisplayDate(expiryDateOf(detailVoucher))} /></div></section>
          </div>
        )}
      </Modal>

      <VoucherModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditingVoucher(null);
        }}
        editingVoucher={editingVoucher}
        form={form}
        updateForm={updateForm}
        onSave={handleSaveVoucher}
        operators={operators}
      />

      <CampaignModal
        open={campaignOpen}
        onClose={() => setCampaignOpen(false)}
        editingCampaign={editingCampaign}
        campaignForm={campaignForm}
        setCampaignForm={setCampaignForm}
        onSave={handleSaveCampaign}
        isActionLoading={isCampaignActionLoading}
        operators={operators}
        vouchers={vouchers}
      />

      <Modal
        open={Boolean(deletingVoucher)}
        onClose={() => setDeletingVoucher(null)}
        icon={<FiTrash2 size={20} />}
        title={t("vouchers.deleteConfirm")}
        subtitle={deletingVoucher?.code}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeletingVoucher(null)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteVoucher()}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600"
            >
              {tc("delete")}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">{deletingVoucher?.name}</p>
      </Modal>
    </div>
  );
}
