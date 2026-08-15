import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiRefreshCw, FiSearch, FiTag, FiTrash2 } from "react-icons/fi";
import {
  createAdminVoucher,
  deleteAdminVoucher,
  getAdminOperators,
  getAdminVouchers,
  getAdminVoucherSummary,
  updateAdminVoucher,
  type AdminOperator,
  type AdminVoucher,
  type VoucherSummary,
} from "../../../api/vietride";
import { fetchAllPages } from "../../../api/pagination";
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
  formatInputDateTime,
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
  const [totalVouchers, setTotalVouchers] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [summary, setSummary] = useState<VoucherSummary | null>(null);
  // Tạo/sửa/xoá voucher làm số liệu thẻ lệch — bump để đếm lại
  const [reloadCountsKey, setReloadCountsKey] = useState(0);
  const pageSize = 10;

  // Search/filter/paging đều server-side. BE `search` khớp code hoặc name;
  // `service` khớp phần tử trong applicableServices.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setVoucherPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  // tRef để loadVouchers không phụ thuộc `t` (tránh refetch khi đổi ngôn ngữ)
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const loadVouchers = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [voucherResult, operatorItems] = await Promise.all([
        getAdminVouchers({
          page: voucherPage,
          pageSize,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(statusFilter ? { isActive: statusFilter === "ACTIVE" } : {}),
          ...(serviceFilter ? { service: serviceFilter } : {}),
        }),
        // Danh sách nhà xe chỉ dùng cho ô chọn phạm vi trong modal, không liên
        // quan tới bảng voucher — vẫn cần đủ để hiển thị tên theo id.
        fetchAllPages((params) => getAdminOperators(params)),
      ]);
      setVouchers(voucherResult.items);
      setTotalVouchers(voucherResult.totalItems);
      setOperators(operatorItems);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : tRef.current("vouchers.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, serviceFilter, statusFilter, voucherPage]);

  useEffect(() => {
    // Giữ queueMicrotask để thoả rule react-hooks/set-state-in-effect
    queueMicrotask(() => {
      void loadVouchers();
    });
  }, [loadVouchers]);

  // Thẻ thống kê đếm trên toàn bộ voucher nền tảng và KHÔNG đổi theo filter của
  // danh sách. BE đã có endpoint summary riêng, thay cho ba truy vấn pageSize=1
  // chỉ để đọc `totalItems`.
  useEffect(() => {
    let ignore = false;
    void getAdminVoucherSummary()
      .then((result) => {
        if (!ignore) setSummary(result);
      })
      .catch(() => {
        // Thẻ thống kê lỗi không được chặn bảng chính
      });
    return () => {
      ignore = true;
    };
  }, [reloadCountsKey]);

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
      expiryDate: formatInputDateTime(
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
      setReloadCountsKey((current) => current + 1);
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
      setReloadCountsKey((current) => current + 1);
      setMessage(t("vouchers.deleteSuccess", { id: deletingVoucher.code }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vouchers.createFailed"));
    }
  }

  const { getApplicableLabel, getFundingLabel, getOperatorScopeLabel } =
    useVoucherLabels();
  const activeCount = summary?.active ?? 0;
  const bookingCount = summary?.booking ?? 0;
  const parcelCount = summary?.parcel ?? 0;
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

  useToastFeedback({ message, error });
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


      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t("vouchers.totalVouchers")}
            value={summary?.total ?? totalVouchers}
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

        {/* Bảng luôn được render kể cả khi rỗng: trước đây nhánh rỗng thay thế
            cả <VoucherTable>, mà thanh tìm kiếm lại nằm trong đó — tìm không ra
            kết quả là ô tìm kiếm biến mất, không còn chỗ nào sửa từ khoá. Ô tìm
            kiếm cũng chớp tắt mỗi lần tải lại vì `isLoading` dùng chung nhánh. */}
        <VoucherTable
            toolbar={voucherToolbar}
            isLoading={isLoading}
            emptyState={
              <>
                <FiTag size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">
                  {t("vouchers.emptyType", {
                    type: t("vouchers.emptyTypeBooking"),
                  })}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {t("vouchers.emptyHint")}
                </p>
              </>
            }
            vouchers={vouchers}
            page={voucherPage}
            pageSize={pageSize}
            totalItems={totalVouchers}
            onPageChange={setVoucherPage}
            getFundingLabel={getFundingLabel}
            getOperatorScopeLabel={getOperatorScopeLabel}
            onView={setDetailVoucher}
            onEdit={openEditModal}
            onDelete={setDeletingVoucher}
          />
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
                      : formatNumber(discountValueOf(detailVoucher)) + " đ"}
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
        icon={<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600"><FiTrash2 size={20} /></span>}
        title={t("vouchers.deleteConfirm")}
        subtitle={deletingVoucher?.code}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeletingVoucher(null)}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteVoucher()}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
            >
              {tc("delete")}
            </button>
          </>
        }
      >
        <div className="space-y-4">
  <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
    <p className="text-sm font-semibold text-red-900">{t("vouchers.deleteConfirm")}</p>
    <div className="mt-3 rounded-xl border border-red-100 bg-white px-4 py-3">
      <p className="font-mono text-sm font-bold text-slate-900">{deletingVoucher?.code}</p>
      <p className="mt-1 text-sm text-slate-600">{deletingVoucher?.name}</p>
    </div>
  </div>
  <p className="text-sm leading-6 text-slate-500">{t("vouchers.deleteWarning")}</p>
</div>
      </Modal>
    </div>
  );
}
