import { useEffect, useMemo, useState } from "react";
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
  deleteOperatorVoucher,
  getOperatorVoucherConsents,
  getOperatorVouchers,
  rejectOperatorVoucherConsent,
  updateOperatorVoucher,
  type CreateOperatorVoucherRequest,
  type OperatorVoucher,
  type OperatorVoucherConsent,
  type UpdateOperatorVoucherRequest,
} from "../../../api/vietride";

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
  type: "PERCENT",
  value: "10",
  minOrderAmount: "0",
  maxDiscountAmount: "0",
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
  const [activeTab, setActiveTab] = useState<VoucherTab>("vouchers");
  const [vouchers, setVouchers] = useState<OperatorVoucher[]>([]);
  const [consents, setConsents] = useState<OperatorVoucherConsent[]>([]);
  const [consentStatus, setConsentStatus] = useState("");
  const [form, setForm] = useState<VoucherForm>(emptyForm);
  const [selectedVoucher, setSelectedVoucher] = useState<OperatorVoucher | null>(
    null,
  );
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
      const [voucherResult, consentResult] = await Promise.all([
        getOperatorVouchers({ page: 1, pageSize: 50 }),
        getOperatorVoucherConsents(consentStatus || undefined),
      ]);

      setVouchers(voucherResult.items);
      setConsents(consentResult.items);
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
        const [voucherResult, consentResult] = await Promise.all([
          getOperatorVouchers({ page: 1, pageSize: 50 }),
          getOperatorVoucherConsents(consentStatus || undefined),
        ]);

        if (ignore) {
          return;
        }

        setVouchers(voucherResult.items);
        setConsents(consentResult.items);
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
  }, [consentStatus]);

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

    if (selectedVoucher) {
      await updateOperatorVoucher(
        getVoucherId(selectedVoucher),
        toUpdateRequest(form),
      );
      setMessage("Đã cập nhật voucher.");
    } else {
      await createOperatorVoucher(toCreateRequest(form));
      setMessage("Đã tạo voucher.");
    }

    setIsModalOpen(false);
    await loadData();
  }

  async function handleToggle(voucher: OperatorVoucher) {
    setError("");
    setMessage("");

    if (voucher.isActive) {
      await deactivateOperatorVoucher(getVoucherId(voucher));
      setMessage("Đã tắt voucher.");
    } else {
      await activateOperatorVoucher(getVoucherId(voucher));
      setMessage("Đã kích hoạt voucher.");
    }

    await loadData();
  }

  async function handleDelete(voucher: OperatorVoucher) {
    if (!confirm("Bạn có chắc muốn xóa voucher này?")) {
      return;
    }

    setError("");
    setMessage("");
    await deleteOperatorVoucher(getVoucherId(voucher));
    setMessage("Đã xóa voucher.");
    await loadData();
  }

  async function handleAcceptConsent(consent: OperatorVoucherConsent) {
    setError("");
    setMessage("");
    await acceptOperatorVoucherConsent(consent.id);
    setMessage(`Đã chấp nhận voucher ${consent.voucherCode}.`);
    await loadData();
  }

  async function handleRejectConsent() {
    if (!rejectingConsent) {
      return;
    }

    setError("");
    setMessage("");
    await rejectOperatorVoucherConsent(rejectingConsent.id, rejectReason);
    setMessage(`Đã từ chối voucher ${rejectingConsent.voucherCode}.`);
    setRejectingConsent(null);
    setRejectReason("");
    await loadData();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Voucher</h1>
          <p className="mt-1 text-gray-600">
            Tạo voucher nhà xe và phản hồi voucher platform cần nhà xe đồng ý.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FiRefreshCw size={16} />
            Tải lại
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-bold text-white hover:bg-vr-600"
          >
            <FiPlus size={16} />
            Tạo voucher
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Tổng voucher" value={vouchers.length} />
        <MetricCard label="Đang kích hoạt" value={activeCount} />
        <MetricCard label="Consent chờ duyệt" value={pendingConsentCount} />
      </div>

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
            Voucher nhà xe
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
            Voucher cần duyệt
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

      {activeTab === "vouchers" ? (
        <VoucherTable
          vouchers={vouchers}
          isLoading={isLoading}
          onEdit={openEditModal}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      ) : (
        <ConsentTable
          consents={consents}
          status={consentStatus}
          isLoading={isLoading}
          onStatusChange={setConsentStatus}
          onAccept={handleAcceptConsent}
          onReject={setRejectingConsent}
        />
      )}

      <VoucherModal
        open={isModalOpen}
        form={form}
        isEditing={Boolean(selectedVoucher)}
        onChange={updateForm}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />

      <Modal
        open={Boolean(rejectingConsent)}
        onClose={() => setRejectingConsent(null)}
        icon={<FiX size={20} />}
        title="Từ chối voucher platform"
        subtitle={rejectingConsent?.voucherCode}
        footer={
          <>
            <button
              type="button"
              onClick={() => setRejectingConsent(null)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleRejectConsent}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              Từ chối
            </button>
          </>
        }
      >
        <label className={labelClass}>Lý do từ chối</label>
        <textarea
          className={`${inputClass} min-h-[96px]`}
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          placeholder="Nhập lý do để hệ thống lưu lại phản hồi."
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
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-5 py-3">Mã</th>
              <th className="px-5 py-3">Tên</th>
              <th className="px-5 py-3">Giảm giá</th>
              <th className="px-5 py-3">Giới hạn</th>
              <th className="px-5 py-3">Hiệu lực</th>
              <th className="px-5 py-3">Trạng thái</th>
              <th className="px-5 py-3">Hành động</th>
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
                  {voucher.type === "PERCENT"
                    ? `${voucher.value}%`
                    : `${formatMoney(voucher.value)} VND`}
                </td>
                <td className="px-5 py-4 text-sm text-gray-700">
                  <p>Tổng: {voucher.totalUsageLimit}</p>
                  <p className="text-xs text-gray-500">
                    Mỗi user: {voucher.perUserLimit}
                  </p>
                </td>
                <td className="px-5 py-4 text-sm text-gray-700">
                  <p>{formatDate(voucher.validFrom)}</p>
                  <p className="text-xs text-gray-500">
                    đến {formatDate(voucher.validUntil)}
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
                    {voucher.isActive ? "Đang bật" : "Đang tắt"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <IconButton
                      label={voucher.isActive ? "Tắt voucher" : "Bật voucher"}
                      onClick={() => onToggle(voucher)}
                    >
                      {voucher.isActive ? <FiX size={16} /> : <FiCheck size={16} />}
                    </IconButton>
                    <IconButton label="Sửa" onClick={() => onEdit(voucher)}>
                      <FiEdit2 size={16} />
                    </IconButton>
                    <IconButton label="Xóa" onClick={() => onDelete(voucher)}>
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
          Đang tải voucher...
        </div>
      )}
      {!isLoading && vouchers.length === 0 && (
        <div className="border-t border-gray-100 px-5 py-10 text-center text-sm text-gray-500">
          Chưa có voucher nhà xe.
        </div>
      )}
    </div>
  );
}

function ConsentTable({
  consents,
  status,
  isLoading,
  onStatusChange,
  onAccept,
  onReject,
}: {
  consents: OperatorVoucherConsent[];
  status: string;
  isLoading: boolean;
  onStatusChange: (status: string) => void;
  onAccept: (consent: OperatorVoucherConsent) => void;
  onReject: (consent: OperatorVoucherConsent) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className={labelClass}>Lọc trạng thái consent</label>
        <select
          className={inputClass}
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
        >
          <option value="">Tất cả</option>
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
                <th className="px-5 py-3">Giá trị</th>
                <th className="px-5 py-3">Đơn tối thiểu</th>
                <th className="px-5 py-3">Hiệu lực</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {consents.map((consent) => (
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
                      đến {formatDate(consent.validUntil)}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {consent.status}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <IconButton
                        label="Chấp nhận"
                        onClick={() => onAccept(consent)}
                      >
                        <FiCheck size={16} />
                      </IconButton>
                      <IconButton label="Từ chối" onClick={() => onReject(consent)}>
                        <FiX size={16} />
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
            Đang tải voucher consent...
          </div>
        )}
        {!isLoading && consents.length === 0 && (
          <div className="border-t border-gray-100 px-5 py-10 text-center text-sm text-gray-500">
            Không có voucher consent.
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700"
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
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  form: VoucherForm;
  isEditing: boolean;
  onChange: (key: keyof VoucherForm, value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiTag size={20} />}
      title={isEditing ? "Cập nhật voucher" : "Tạo voucher"}
      subtitle="Thiết lập mã giảm giá áp dụng cho đơn đặt chỗ của nhà xe."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
          >
            {isEditing ? "Cập nhật" : "Tạo voucher"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Mã voucher"
            value={form.code}
            disabled={isEditing}
            onChange={(value) => onChange("code", value)}
            placeholder="OP-SUMMER"
          />
          <Field
            label="Tên voucher"
            value={form.name}
            onChange={(value) => onChange("name", value)}
            placeholder="Giảm giá hè"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Loại giảm</label>
            <select
              className={inputClass}
              value={form.type}
              disabled={isEditing}
              onChange={(event) => onChange("type", event.target.value)}
            >
              <option value="PERCENT">PERCENT</option>
              <option value="FIXED">FIXED</option>
            </select>
          </div>
          <Field
            label="Giá trị"
            type="number"
            value={form.value}
            onChange={(value) => onChange("value", value)}
          />
          <Field
            label="Giảm tối đa"
            type="number"
            value={form.maxDiscountAmount}
            onChange={(value) => onChange("maxDiscountAmount", value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Đơn tối thiểu"
            type="number"
            value={form.minOrderAmount}
            onChange={(value) => onChange("minOrderAmount", value)}
          />
          <Field
            label="Tổng lượt dùng"
            type="number"
            value={form.totalUsageLimit}
            onChange={(value) => onChange("totalUsageLimit", value)}
          />
          <Field
            label="Mỗi user"
            type="number"
            value={form.perUserLimit}
            onChange={(value) => onChange("perUserLimit", value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Hiệu lực từ"
            type="datetime-local"
            value={form.validFrom}
            onChange={(value) => onChange("validFrom", value)}
          />
          <Field
            label="Hiệu lực đến"
            type="datetime-local"
            value={form.validUntil}
            onChange={(value) => onChange("validUntil", value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Route IDs áp dụng"
            value={form.applicableRouteIds}
            onChange={(value) => onChange("applicableRouteIds", value)}
            placeholder="uuid-1, uuid-2"
          />
          <div>
            <label className={labelClass}>Nguồn tài trợ</label>
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
