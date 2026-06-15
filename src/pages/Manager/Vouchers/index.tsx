import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiTag, FiEdit2, FiTrash2, FiCheck, FiX } from "react-icons/fi";
import Modal from "../../../components/Modal";
import { vouchers as mockVouchers } from "../../../data/mockData";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Voucher = any;

function formatNumber(n: number, locale: string) {
  return n.toLocaleString(locale === "vi" ? "vi-VN" : "en-US");
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

const CURRENT_OPERATOR_ID = "op1";

export default function ManagerVouchers() {
  const { t, i18n } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);

  const operatorVouchers = mockVouchers.filter(
    (v) => v.voucherType === "operator" && v.operatorId === CURRENT_OPERATOR_ID,
  );

  const handleEdit = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setEditOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm(t("vouchers.confirmDelete"))) {
      alert(t("vouchers.deleteSuccess", { id }));
    }
  };

  const handleToggleActive = (id: string) => {
    alert(t("vouchers.toggleSuccess", { id }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("vouchers.title")}</h1>
          <p className="text-gray-600 mt-1">{t("vouchers.subtitle")}</p>
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

      {operatorVouchers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <FiTag size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">{t("vouchers.empty")}</p>
          <p className="text-sm text-gray-500 mt-1">{t("vouchers.emptyHint")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {t("vouchers.voucherCode")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {tc("name")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {t("vouchers.discount")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {t("vouchers.issued")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {t("vouchers.used")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {t("vouchers.expiryShort")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {tc("status")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {tc("actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white border-b border-gray-200">
                {operatorVouchers.map((voucher) => {
                  const usageRate = Math.round(
                    (voucher.usedCount / voucher.quantity) * 100,
                  );
                  const expiryDate = new Date(voucher.expiryDate).toLocaleDateString(
                    i18n.language === "vi" ? "vi-VN" : "en-US",
                  );

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
                            : `${formatNumber(voucher.discount, i18n.language)}₫`}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatNumber(voucher.quantity, i18n.language)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p>{formatNumber(voucher.usedCount, i18n.language)}</p>
                          <p className="text-xs text-gray-500">
                            ({usageRate}%)
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
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
                          {voucher.active ? t("vouchers.running") : t("vouchers.ended")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleActive(voucher.id)}
                            className="p-2 text-gray-400 hover:text-gray-600"
                            title={voucher.active ? tc("disable") : tc("enable")}
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
                            title={tc("edit")}
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(voucher.id)}
                            className="p-2 text-gray-400 hover:text-red-500"
                            title={tc("delete")}
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
        </div>
      )}

      <Modal
        open={createOpen || editOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditOpen(false);
          setSelectedVoucher(null);
        }}
        wide
        icon={<FiTag size={20} />}
        title={selectedVoucher ? t("vouchers.editTitle") : t("vouchers.createTitle")}
        subtitle={
          selectedVoucher ? t("vouchers.editSubtitle") : t("vouchers.createSubtitle")
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
                    action: selectedVoucher ? tc("update") : tc("create"),
                  }),
                );
                setCreateOpen(false);
                setEditOpen(false);
                setSelectedVoucher(null);
              }}
              className="rounded-lg bg-vr-500 cursor-pointer px-4 py-2 text-sm font-bold text-white hover:bg-vr-600"
            >
              {t("vouchers.saveButton", {
                action: selectedVoucher ? tc("update") : tc("create"),
              })}
            </div>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                {t("vouchers.codeLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                defaultValue={selectedVoucher?.code || "OP-"}
                placeholder={t("vouchers.codePlaceholder")}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("vouchers.nameLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                defaultValue={selectedVoucher?.name || t("vouchers.defaultName")}
                placeholder={t("vouchers.namePlaceholder")}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>{tc("description")}</label>
            <textarea
              className={inputClass + " min-h-[80px]"}
              defaultValue={selectedVoucher?.description || ""}
              placeholder={t("vouchers.descriptionPlaceholder")}
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
                <option value="percent">{t("vouchers.discountTypePercent")}</option>
                <option value="fixed">{t("vouchers.discountTypeFixed")}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                {t("vouchers.discountValue")} <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                type="number"
                defaultValue={selectedVoucher?.discount || ""}
                placeholder={t("vouchers.discountValuePlaceholder")}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("vouchers.minOrder")}</label>
              <input
                className={inputClass}
                type="number"
                defaultValue={selectedVoucher?.minOrderValue || "100000"}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("vouchers.quantityLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                type="number"
                defaultValue={selectedVoucher?.quantity || ""}
                placeholder={t("vouchers.quantityPlaceholder")}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("vouchers.applicableTo")}</label>
              <select
                className={inputClass}
                defaultValue={selectedVoucher?.applicableTo || "rides"}
              >
                <option value="all">{t("vouchers.applicableAll")}</option>
                <option value="rides">{t("vouchers.applicableRides")}</option>
                <option value="parcels">{t("vouchers.applicableParcels")}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                {t("vouchers.expiryDate")} <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                type="date"
                defaultValue={selectedVoucher?.expiryDate?.split("T")[0] || ""}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>{t("vouchers.maxUsagePerUser")}</label>
            <input
              className={inputClass}
              type="number"
              defaultValue={selectedVoucher?.maxUsagePerUser || "1"}
              placeholder={t("vouchers.maxUsagePlaceholder")}
            />
          </div>

          <div>
            <p className={labelClass}>{t("vouchers.activateNow")}</p>
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
                  {t("vouchers.activateAfterCreate")}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t("vouchers.activateHint")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
