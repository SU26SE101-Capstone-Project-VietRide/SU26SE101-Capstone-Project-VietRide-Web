import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiTag, FiEdit2, FiTrash2, FiCheck, FiX } from "react-icons/fi";
import Modal from "../../components/Modal";
import { vouchers as mockVouchers } from "../../data/mockData";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Voucher = any;

function formatNumber(n: number) {
  return n.toLocaleString();
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

type VoucherTab = "event" | "package";

export default function Vouchers() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [activeTab, setActiveTab] = useState<VoucherTab>("event");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);

  const eventVouchers = mockVouchers.filter((v) => v.voucherType === "event");
  const packageVouchers = mockVouchers.filter(
    (v) => v.voucherType === "package",
  );

  const currentVouchers =
    activeTab === "event" ? eventVouchers : packageVouchers;

  const handleEdit = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setEditOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm(t("vouchers.deleteConfirm"))) {
      alert(t("vouchers.deleteSuccess", { id }));
    }
  };

  const handleToggleActive = (id: string) => {
    alert(t("vouchers.toggleSuccess", { id }));
  };

  const getApplicableLabel = (applicableTo: string) => {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("vouchers.title")}
          </h1>
          <p className="text-gray-600 mt-1">{t("vouchers.subtitleLong")}</p>
        </div>
        <div
          onClick={() => {
            setSelectedVoucher(null);
            setCreateOpen(true);
          }}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-white rounded-lg font-medium transition flex items-center gap-2"
        >
          <FiPlus size={16} /> {t("vouchers.create")}
        </div>
      </div>

      <div className="flex gap-0 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("event")}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition ${
            activeTab === "event"
              ? "border-vr-500 text-vr-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          {t("vouchers.tabEvent")}
          <span className="ml-2 text-xs bg-vr-100 text-vr-700 px-2 py-1 rounded-full">
            {eventVouchers.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("package")}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition ${
            activeTab === "package"
              ? "border-vr-500 text-vr-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          {t("vouchers.tabPackage")}
          <span className="ml-2 text-xs bg-vr-100 text-vr-700 px-2 py-1 rounded-full">
            {packageVouchers.length}
          </span>
        </button>
      </div>

      <div className="space-y-4">
        {activeTab === "event" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t("vouchers.eventSectionTitle")}
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              {t("vouchers.eventSectionDesc")}
            </p>
          </div>
        )}
        {activeTab === "package" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t("vouchers.packageSectionTitle")}
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              {t("vouchers.packageSectionDesc")}
            </p>
          </div>
        )}

        {currentVouchers.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <FiTag size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">
              {t("vouchers.emptyType", {
                type:
                  activeTab === "event"
                    ? t("vouchers.emptyTypeEvent")
                    : t("vouchers.emptyTypePackage"),
              })}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {t("vouchers.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {t("vouchers.code")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {t("vouchers.name")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {t("vouchers.discount")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {t("vouchers.applicable")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {t("vouchers.issued")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {t("vouchers.used")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {t("vouchers.expiry")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {tc("status")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {tc("actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentVouchers.map((voucher) => {
                  const usageRate = Math.round(
                    (voucher.usedCount / voucher.quantity) * 100,
                  );
                  const expiryDate = new Date(
                    voucher.expiryDate,
                  ).toLocaleDateString("vi-VN");

                  return (
                    <tr key={voucher.id} className="border-t border-gray-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono font-semibold text-vr-600">
                          {voucher.code}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {voucher.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {voucher.description}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-lg font-bold text-gray-900">
                          {voucher.discountType === "percent"
                            ? `${voucher.discount}%`
                            : `${formatNumber(voucher.discount)}₫`}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {getApplicableLabel(voucher.applicableTo)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatNumber(voucher.quantity)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-20">
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-2 rounded-full bg-vr-500"
                              style={{ width: `${Math.min(100, usageRate)}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            {formatNumber(voucher.usedCount)} ({usageRate}%)
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {expiryDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            voucher.active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {voucher.active ? tc("active") : tc("inactive")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleActive(voucher.id)}
                            className="p-2 text-gray-400 hover:text-gray-600"
                          >
                            {voucher.active ? (
                              <FiCheck size={16} />
                            ) : (
                              <FiX size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(voucher)}
                            className="p-2 text-gray-400 hover:text-vr-500"
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(voucher.id)}
                            className="p-2 text-gray-400 hover:text-red-500"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
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
        open={createOpen || editOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditOpen(false);
          setSelectedVoucher(null);
        }}
        wide
        icon={<FiTag size={20} />}
        title={
          selectedVoucher ? t("vouchers.editTitle") : t("vouchers.createTitle")
        }
        subtitle={
          selectedVoucher
            ? t("vouchers.updateSubtitle")
            : activeTab === "event"
              ? t("vouchers.createEventSubtitle")
              : t("vouchers.createPackageSubtitle")
        }
        footer={
          <>
            <div
              onClick={() => {
                setCreateOpen(false);
                setEditOpen(false);
                setSelectedVoucher(null);
              }}
              className="rounded-lg border border-gray-200 cursor-pointer bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {tc("cancel")}
            </div>
            <div
              onClick={() => {
                alert(
                  t("vouchers.saveSuccess", {
                    action: selectedVoucher
                      ? t("vouchers.saveActionUpdate")
                      : t("vouchers.saveActionCreate"),
                  }),
                );
                setCreateOpen(false);
                setEditOpen(false);
                setSelectedVoucher(null);
              }}
              className="rounded-lg bg-vr-500 cursor-pointer px-4 py-2 text-sm font-bold text-white hover:bg-vr-600"
            >
              {t("vouchers.saveButton", {
                action: selectedVoucher
                  ? t("vouchers.saveActionUpdate")
                  : t("vouchers.saveActionCreate"),
              })}
            </div>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                {t("vouchers.voucherCode")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass + " border-vr-500 ring-1 ring-vr-500/50"}
                defaultValue={selectedVoucher?.code || "VIETRIDE"}
                placeholder={t("vouchers.codePlaceholder")}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("vouchers.displayName")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                defaultValue={
                  selectedVoucher?.name ||
                  (activeTab === "event"
                    ? "Giảm 20% chuyến đầu"
                    : "Gói Premium - Giảm 100K")
                }
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>{tc("description")}</label>
            <textarea
              className={inputClass + " min-h-[88px]"}
              defaultValue={selectedVoucher?.description || ""}
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
                defaultValue={selectedVoucher?.discountType || "percent"}
              >
                <option value="percent">{t("vouchers.percentDiscount")}</option>
                <option value="fixed">{t("vouchers.fixedDiscount")}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                {t("vouchers.discountValue")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                type="number"
                defaultValue={selectedVoucher?.discount || ""}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("vouchers.applicable")}</label>
              <select
                className={inputClass}
                defaultValue={selectedVoucher?.applicableTo || "all"}
              >
                <option value="all">{t("vouchers.allServicesFull")}</option>
                <option value="rides">{t("vouchers.ridesOnlyFull")}</option>
                <option value="parcels">{t("vouchers.parcelsOnly")}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("vouchers.minOrder")}</label>
              <input
                className={inputClass}
                type="number"
                defaultValue={selectedVoucher?.minOrderValue || "200000"}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                {t("vouchers.quantity")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                type="number"
                defaultValue={selectedVoucher?.quantity || "5000"}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("vouchers.expiryDate")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                type="date"
                defaultValue={selectedVoucher?.expiryDate?.split("T")[0] || ""}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>
              {t("vouchers.maxUsagePerUser")}
            </label>
            <input
              className={inputClass}
              type="number"
              defaultValue={selectedVoucher?.maxUsagePerUser || "1"}
            />
          </div>

          <div>
            <p className={labelClass}>{t("vouchers.activateOnCreate")}</p>
            <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 flex items-start gap-3">
              <button
                type="button"
                role="switch"
                aria-checked="true"
                className="relative h-7 w-12 shrink-0 rounded-full bg-vr-500"
              >
                <span className="absolute right-1 top-1 h-5 w-5 rounded-full bg-white shadow" />
              </button>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {t("vouchers.activateOnCreateTitle")}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t("vouchers.activateOnCreateHint")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
