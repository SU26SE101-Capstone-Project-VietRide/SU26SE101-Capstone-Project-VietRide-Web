import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiTag } from "react-icons/fi";
import Modal from "../../../components/Modal";
import CustomSelect from "../../../components/CustomSelect";
import { StatCard } from "../../../components/StatCard";
import {
  activateOperatorVoucher,
  createOperatorVoucher,
  deactivateOperatorVoucher,
  getOperatorRoutes,
  deleteOperatorVoucher,
  getOperatorVouchers,
  updateOperatorVoucher,
  type OperatorRoute,
  type OperatorVoucher,
} from "../../../api/vietride";
import { fetchAllPages } from "../../../api/pagination";
import { getAuthUser } from "../../../auth";
import VoucherModal from "./VoucherModal";
import VoucherTable from "./VoucherTable";
import {
  getVoucherId,
  isBookingVoucher,
  isParcelVoucher,
  toCreateRequest,
  toForm,
  toUpdateRequest,
  type VoucherForm,
  type VoucherServiceTab,
} from "./voucherHelpers";

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
  applicableService: "BOOKING",
  applicableRouteIds: "",
  fundingType: "OPERATOR_FUNDED",
};

export default function ManagerVouchers() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  // Giữ tham chiếu t mới nhất để callback tải dữ liệu không refetch khi đổi ngôn ngữ
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const isOperatorAdmin = getAuthUser()?.role === "OPERATOR_ADMIN";
  const [activeServiceTab, setActiveServiceTab] =
    useState<VoucherServiceTab>("BOOKING");
  const [voucherSearch, setVoucherSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [voucherTypeFilter, setVoucherTypeFilter] = useState("");
  const [vouchers, setVouchers] = useState<OperatorVoucher[]>([]);
  const [routes, setRoutes] = useState<OperatorRoute[]>([]);
  const [form, setForm] = useState<VoucherForm>(emptyForm);
  const [selectedVoucher, setSelectedVoucher] =
    useState<OperatorVoucher | null>(null);
  const [deletingVoucher, setDeletingVoucher] =
    useState<OperatorVoucher | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Tải danh sách voucher + tuyến, dùng chung cho effect khởi tạo và nút tải lại
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [voucherItems, routeItems] = await Promise.all([
        fetchAllPages((params) => getOperatorVouchers(params)),
        fetchAllPages((params) => getOperatorRoutes(params)),
      ]);

      setVouchers(voucherItems);
      setRoutes(routeItems);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tRef.current("vouchers.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [isOperatorAdmin, loadData]);

  const activeCount = useMemo(
    () => vouchers.filter((voucher) => voucher.isActive).length,
    [vouchers],
  );
  const bookingVouchers = useMemo(
    () => vouchers.filter(isBookingVoucher),
    [vouchers],
  );
  const parcelVouchers = useMemo(
    () => vouchers.filter(isParcelVoucher),
    [vouchers],
  );
  const currentServiceVouchers =
    activeServiceTab === "BOOKING" ? bookingVouchers : parcelVouchers;

  const filteredVouchers = useMemo(() => {
    const source = isOperatorAdmin ? currentServiceVouchers : vouchers;
    const query = voucherSearch.trim().toLowerCase();
    return source.filter((voucher) => {
      const matchesSearch = !query || voucher.code.toLowerCase().includes(query) || voucher.name.toLowerCase().includes(query);
      const matchesStatus = !statusFilter || (statusFilter === "ACTIVE" ? voucher.isActive : !voucher.isActive);
      const matchesType = !voucherTypeFilter || voucher.type === voucherTypeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [currentServiceVouchers, isOperatorAdmin, statusFilter, voucherSearch, voucherTypeFilter, vouchers]);

  const voucherToolbar = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative min-w-0 flex-1"><FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-vr-500 focus:bg-white" placeholder={t("vouchers.searchPlaceholder")} value={voucherSearch} onChange={(event) => setVoucherSearch(event.target.value)} /></div><CustomSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm lg:w-[210px]" aria-label={t("vouchers.filterStatus")}><option value="">{t("vouchers.allStatuses")}</option><option value="ACTIVE">{t("vouchers.enabled")}</option><option value="INACTIVE">{t("vouchers.disabled")}</option></CustomSelect><CustomSelect value={voucherTypeFilter} onChange={(event) => setVoucherTypeFilter(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm lg:w-[240px]" aria-label={t("vouchers.filterType")}><option value="">{t("vouchers.allTypes")}</option><option value="PERCENT_OFF">{tc("voucherTypes.PERCENT_OFF")}</option><option value="FIXED_AMOUNT">{tc("voucherTypes.FIXED_AMOUNT")}</option></CustomSelect></div>
  );
  function openCreateModal() {
    setSelectedVoucher(null);
    setForm({ ...emptyForm, applicableService: activeServiceTab });
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
        const createdVoucher = await createOperatorVoucher(
          toCreateRequest(form),
        );
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
      setMessage(t("vouchers.deactivateSuccess") || "Đã tắt voucher.");
    } else {
      const result = await activateOperatorVoucher(getVoucherId(voucher));
      setVouchers((current) =>
        current.map((item) =>
          getVoucherId(item) === getVoucherId(voucher)
            ? { ...item, isActive: result.isActive ?? true }
            : item,
        ),
      );
      setMessage(t("vouchers.activateSuccess") || "Đã kích hoạt voucher.");
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

  useToastFeedback({ message, error });
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("vouchers.operatorTitle")}
          </h1>
          <p className="mt-1 text-gray-600">{t("vouchers.operatorSubtitle")}</p>
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

      {isOperatorAdmin && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label={t("vouchers.totalVouchers")} value={vouchers.length} icon={<FiTag size={20} />} iconClassName="bg-vr-50 text-vr-700" /><StatCard label={t("vouchers.activeVouchers")} value={activeCount} icon={<FiTag size={20} />} iconClassName="bg-emerald-50 text-emerald-700" /><StatCard label={t("vouchers.bookingVouchers")} value={bookingVouchers.length} icon={<FiTag size={20} />} iconClassName="bg-blue-50 text-blue-700" /><StatCard label={t("vouchers.parcelVouchers")} value={parcelVouchers.length} icon={<FiTag size={20} />} iconClassName="bg-amber-50 text-amber-700" /></div>}


      {isOperatorAdmin ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {t("vouchers.applicableTo")}
              </p>
              <h2 className="mt-1 text-lg font-bold text-gray-900">
                {activeServiceTab === "BOOKING"
                  ? t("vouchers.bookingVouchers")
                  : t("vouchers.parcelVouchers")}
              </h2>
            </div>
            <div className="inline-flex w-full rounded-full bg-gray-100 p-1 sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveServiceTab("BOOKING")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition sm:flex-none ${
                  activeServiceTab === "BOOKING"
                    ? "bg-white text-vr-800 shadow-sm ring-1 ring-vr-100"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {t("vouchers.bookingVouchers")}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    activeServiceTab === "BOOKING"
                      ? "bg-vr-100 text-vr-700"
                      : "bg-white text-gray-500"
                  }`}
                >
                  {bookingVouchers.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveServiceTab("PARCEL")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition sm:flex-none ${
                  activeServiceTab === "PARCEL"
                    ? "bg-white text-vr-800 shadow-sm ring-1 ring-vr-100"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {t("vouchers.parcelVouchers")}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    activeServiceTab === "PARCEL"
                      ? "bg-vr-100 text-vr-700"
                      : "bg-white text-gray-500"
                  }`}
                >
                  {parcelVouchers.length}
                </span>
              </button>
            </div>
          </div>
          <VoucherTable
            toolbar={voucherToolbar}
            vouchers={filteredVouchers}
            isLoading={isLoading}
            onEdit={openEditModal}
            onToggle={handleToggle}
            onDelete={setDeletingVoucher}
          />
        </div>
      ) : (
        <VoucherTable
          toolbar={voucherToolbar}
          vouchers={filteredVouchers}
          isLoading={isLoading}
          onEdit={openEditModal}
          onToggle={handleToggle}
          onDelete={setDeletingVoucher}
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
        icon={<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600"><FiTrash2 size={20} /></span>}
        title={t("vouchers.deleteOperatorTitle")}
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
              onClick={handleDelete}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
            >
              {tc("delete")}
            </button>
          </>
        }
      >
        <div className="space-y-4">
  <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
    <p className="text-sm font-semibold text-red-900">{t("vouchers.confirmDeleteOperatorVoucher")}</p>
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
