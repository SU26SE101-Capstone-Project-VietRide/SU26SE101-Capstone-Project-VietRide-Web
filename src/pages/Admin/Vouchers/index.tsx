import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiRefreshCw, FiSearch, FiTag, FiTrash2 } from "react-icons/fi";
import {
  createAdminVoucher,
  deleteAdminVoucher,
  getAdminOperators,
  getAdminVouchers,
  updateAdminVoucher,
  type AdminOperator,
  type AdminVoucher,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";
import { StatCard } from "../../../components/StatCard";
import { DetailItem } from "./formControls";
import type { VoucherForm } from "./types";
import { useVoucherLabels } from "./useVoucherLabels";
import VoucherModal from "./VoucherModal";
import VoucherTable from "./VoucherTable";
import {
  activeOf,
  applicableToOf,
  discountTypeOf,
  discountValueOf,
  emptyForm,
  expiryDateOf,
  formatDisplayDate,
  formatInputDate,
  formatNumber,
  maxDiscountAmountOf,
  parseInputDate,
  quantityOf,
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
  const [operators, setOperators] = useState<AdminOperator[]>([]);
  const [form, setForm] = useState<VoucherForm>(emptyForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<AdminVoucher | null>(
    null,
  );
  const [detailVoucher, setDetailVoucher] = useState<AdminVoucher | null>(null);
  const [deletingVoucher, setDeletingVoucher] = useState<AdminVoucher | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [voucherPage, setVoucherPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const pageSize = 8;

  const filteredVouchers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return vouchers.filter((voucher) => {
      const matchesSearch =
        !query ||
        [voucher.code, voucher.name, voucher.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      const isActive = activeOf(voucher);
      const matchesStatus =
        !statusFilter || (statusFilter === "ACTIVE" ? isActive : !isActive);
      const matchesService =
        !serviceFilter ||
        (voucher.applicableServices ?? []).includes(serviceFilter);
      return matchesSearch && matchesStatus && matchesService;
    });
  }, [search, serviceFilter, statusFilter, vouchers]);

  const paginatedVouchers = useMemo(
    () =>
      filteredVouchers.slice(
        (voucherPage - 1) * pageSize,
        voucherPage * pageSize,
      ),
    [filteredVouchers, voucherPage],
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
      const [voucherResult, operatorResult] = await Promise.all([
        getAdminVouchers({ page: 1, pageSize: 100 }),
        getAdminOperators({ page: 1, pageSize: 100 }),
      ]);
      setVouchers(voucherResult.items);
      setOperators(operatorResult.items);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : tRef.current("vouchers.loadFailed"),
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
          ? current.map((voucher) =>
              voucher.id === saved.id ? saved : voucher,
            )
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

  const { getApplicableLabel, getFundingLabel, getOperatorScopeLabel } =
    useVoucherLabels();
  const activeCount = vouchers.filter(activeOf).length;
  const bookingCount = vouchers.filter((voucher) =>
    voucher.applicableServices?.includes("BOOKING"),
  ).length;
  const parcelCount = vouchers.filter((voucher) =>
    voucher.applicableServices?.includes("PARCEL"),
  ).length;
  const voucherToolbar = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1">
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-vr-500 focus:bg-white"
          placeholder={t("vouchers.searchPlaceholder")}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setVoucherPage(1);
          }}
        />
      </div>
      <CustomSelect
        value={statusFilter}
        onChange={(event) => {
          setStatusFilter(event.target.value);
          setVoucherPage(1);
        }}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm lg:w-[190px]"
        aria-label={t("vouchers.filterStatus")}
      >
        <option value="">{t("vouchers.allStatuses")}</option>
        <option value="ACTIVE">{t("vouchers.enabled")}</option>
        <option value="INACTIVE">{t("vouchers.disabled")}</option>
      </CustomSelect>
      <CustomSelect
        value={serviceFilter}
        onChange={(event) => {
          setServiceFilter(event.target.value);
          setVoucherPage(1);
        }}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm lg:w-[210px]"
        aria-label={t("vouchers.filterService")}
      >
        <option value="">{t("vouchers.allServices")}</option>
        <option value="BOOKING">{t("vouchers.tripsOnly")}</option>
        <option value="PARCEL">{t("vouchers.parcelsOnly")}</option>
      </CustomSelect>
    </div>
  );

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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t("vouchers.totalVouchers")}
            value={vouchers.length}
            icon={<FiTag size={20} />}
            iconClassName="bg-vr-50 text-vr-700"
          />
          <StatCard
            label={t("vouchers.activeVouchers")}
            value={activeCount}
            icon={<FiTag size={20} />}
            iconClassName="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            label={t("vouchers.bookingVouchers")}
            value={bookingCount}
            icon={<FiTag size={20} />}
            iconClassName="bg-blue-50 text-blue-700"
          />
          <StatCard
            label={t("vouchers.parcelVouchers")}
            value={parcelCount}
            icon={<FiTag size={20} />}
            iconClassName="bg-amber-50 text-amber-700"
          />
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
            toolbar={voucherToolbar}
            vouchers={paginatedVouchers}
            page={voucherPage}
            pageSize={pageSize}
            totalItems={filteredVouchers.length}
            onPageChange={setVoucherPage}
            getFundingLabel={getFundingLabel}
            getOperatorScopeLabel={getOperatorScopeLabel}
            onView={setDetailVoucher}
            onEdit={openEditModal}
            onDelete={setDeletingVoucher}
          />
        )}
      </div>

      <Modal
        open={detailVoucher !== null}
        onClose={() => setDetailVoucher(null)}
        wide
        icon={<FiTag size={20} />}
        title={t("vouchers.detailTitle")}
        subtitle={detailVoucher?.code}
        footer={
          <button
            type="button"
            onClick={() => setDetailVoucher(null)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700"
          >
            {tc("close")}
          </button>
        }
      >
        {detailVoucher && (
          <div className="space-y-5">
            <section className="rounded-2xl border border-vr-100 bg-gradient-to-br from-vr-50 to-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-vr-700">
                    {t("vouchers.code")}
                  </p>
                  <p className="mt-1 text-xl font-bold text-gray-900">
                    {detailVoucher.code}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {detailVoucher.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t("vouchers.discount")}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-vr-700">
                    {discountTypeOf(detailVoucher) === "percent"
                      ? String(discountValueOf(detailVoucher)) + "%"
                      : formatNumber(discountValueOf(detailVoucher)) + "₫"}
                  </p>
                  <span
                    className={
                      "mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold " +
                      (activeOf(detailVoucher)
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-600")
                    }
                  >
                    {activeOf(detailVoucher) ? tc("active") : tc("inactive")}
                  </span>
                </div>
              </div>
            </section>
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="mb-4 text-base font-bold text-gray-900">
                {t("vouchers.detailScopeTitle")}
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <DetailItem
                  label={t("vouchers.applicable")}
                  value={getApplicableLabel(applicableToOf(detailVoucher))}
                />
                <DetailItem
                  label={t("vouchers.fundingType")}
                  value={getFundingLabel(detailVoucher.fundingType)}
                />
                <DetailItem
                  label={t("vouchers.operatorScope")}
                  value={getOperatorScopeLabel(detailVoucher)}
                />
              </div>
            </section>
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="mb-4 text-base font-bold text-gray-900">
                {t("vouchers.detailIssuanceTitle")}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem
                  label={t("vouchers.issued")}
                  value={formatNumber(quantityOf(detailVoucher))}
                />
                <DetailItem
                  label={t("vouchers.used")}
                  value={formatNumber(usedCountOf(detailVoucher))}
                />
                <DetailItem
                  label={t("vouchers.issuedFrom")}
                  value={formatDisplayDate(detailVoucher.validFrom ?? "")}
                />
                <DetailItem
                  label={t("vouchers.expiry")}
                  value={formatDisplayDate(expiryDateOf(detailVoucher))}
                />
              </div>
            </section>
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
