import { useState } from "react";
import { FiPlus, FiTag, FiEdit2, FiTrash2, FiCheck, FiX } from "react-icons/fi";
import Modal from "../../../components/Modal";
import { vouchers as mockVouchers } from "../../../data/mockData";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Voucher = any;

function formatNumber(n: number) {
  return n.toLocaleString();
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

// Mocked operator ID - trong thực tế sẽ lấy từ auth context
const CURRENT_OPERATOR_ID = "op1";

export default function ManagerVouchers() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);

  // Filter vouchers: chỉ hiển thị vouchers của nhà xe này
  const operatorVouchers = mockVouchers.filter(
    (v) => v.voucherType === "operator" && v.operatorId === CURRENT_OPERATOR_ID,
  );

  const handleEdit = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setEditOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa voucher này?")) {
      // API call to delete voucher
      alert(`Xóa voucher ${id} thành công!`);
    }
  };

  const handleToggleActive = (id: string) => {
    // API call to toggle active status
    alert(`Cập nhật trạng thái voucher ${id} thành công!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý Voucher</h1>
          <p className="text-gray-600 mt-1">
            Tạo và quản lý mã giảm giá cho khách hàng của nhà xe bạn.
          </p>
        </div>
        <div
          onClick={() => {
            setSelectedVoucher(null);
            setCreateOpen(true);
          }}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-white rounded-lg font-medium transition flex items-center gap-2"
        >
          <FiPlus size={16} /> Tạo voucher mới
        </div>
      </div>

      {operatorVouchers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <FiTag size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Bạn chưa tạo voucher nào</p>
          <p className="text-sm text-gray-500 mt-1">
            Bắt đầu bằng cách tạo voucher để khuyến mãi cho khách hàng
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Table view */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Mã Voucher
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Tên
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Giảm giá
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Được phát
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Đã dùng
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    HSD
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white border-b border-gray-200">
                {operatorVouchers.map((voucher) => {
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
                        {formatNumber(voucher.quantity)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p>{formatNumber(voucher.usedCount)}</p>
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
                          {voucher.active ? "Đang chạy" : "Đã kết thúc"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleActive(voucher.id)}
                            className="p-2 text-gray-400 hover:text-gray-600"
                            title={voucher.active ? "Vô hiệu hóa" : "Kích hoạt"}
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
                            title="Chỉnh sửa"
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(voucher.id)}
                            className="p-2 text-gray-400 hover:text-red-500"
                            title="Xóa"
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

      {/* Create/Edit Modal */}
      <Modal
        open={createOpen || editOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditOpen(false);
          setSelectedVoucher(null);
        }}
        wide
        icon={<FiTag size={20} />}
        title={selectedVoucher ? "Chỉnh sửa voucher" : "Tạo voucher mới"}
        subtitle={
          selectedVoucher
            ? "Cập nhật thông tin mã giảm giá"
            : "Tạo mã giảm giá mới cho khách hàng"
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
              Hủy
            </div>
            <div
              onClick={() => {
                alert(
                  `${selectedVoucher ? "Cập nhật" : "Tạo"} voucher thành công!`,
                );
                setCreateOpen(false);
                setEditOpen(false);
                setSelectedVoucher(null);
              }}
              className="rounded-lg bg-vr-500 cursor-pointer px-4 py-2 text-sm font-bold text-white hover:bg-vr-600"
            >
              {selectedVoucher ? "Cập nhật" : "Tạo"} voucher
            </div>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                Mã voucher <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                defaultValue={selectedVoucher?.code || "OP-"}
                placeholder="VD: OP-LOYAL10"
              />
            </div>
            <div>
              <label className={labelClass}>
                Tên voucher <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                defaultValue={selectedVoucher?.name || "Khách hàng thân thiết"}
                placeholder="VD: Khách hàng thân thiết"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Mô tả</label>
            <textarea
              className={inputClass + " min-h-[80px]"}
              defaultValue={selectedVoucher?.description || ""}
              placeholder="Mô tả chi tiết về voucher..."
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Loại giảm giá</label>
              <select
                className={inputClass}
                defaultValue={selectedVoucher?.discountType || "percent"}
              >
                <option value="percent">Theo phần trăm (%)</option>
                <option value="fixed">Số tiền cố định (₫)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                Giá trị giảm <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                type="number"
                defaultValue={selectedVoucher?.discount || ""}
                placeholder="VD: 10 hoặc 50000"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Đơn tối thiểu (₫)</label>
              <input
                className={inputClass}
                type="number"
                defaultValue={selectedVoucher?.minOrderValue || "100000"}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClass}>
                Số lượng phát hành <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                type="number"
                defaultValue={selectedVoucher?.quantity || ""}
                placeholder="VD: 500"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Áp dụng cho</label>
              <select
                className={inputClass}
                defaultValue={selectedVoucher?.applicableTo || "rides"}
              >
                <option value="all">Tất cả dịch vụ</option>
                <option value="rides">Chỉ chuyến xe</option>
                <option value="parcels">Chỉ bưu phẩm</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                Hạn sử dụng <span className="text-red-500">*</span>
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
              Số lần dùng tối đa trên mỗi tài khoản
            </label>
            <input
              className={inputClass}
              type="number"
              defaultValue={selectedVoucher?.maxUsagePerUser || "1"}
              placeholder="VD: 1"
            />
          </div>

          <div>
            <p className={labelClass}>Kích hoạt ngay</p>
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
                  Bật voucher sau khi tạo
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Voucher sẽ có hiệu lực và khách hàng có thể sử dụng ngay.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
