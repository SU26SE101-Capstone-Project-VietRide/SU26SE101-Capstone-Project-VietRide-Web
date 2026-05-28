import { useState } from "react";
import { FiPlus, FiTag } from "react-icons/fi";
import Modal from "../../components/Modal";
import { vouchers as mockVouchers } from "../../data/mockData";

function formatNumber(n: number) {
  return n.toLocaleString();
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

export default function Vouchers() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Voucher &amp; Khuyến mãi
          </h1>
          <p className="text-gray-600 mt-1">
            Quản lý mã giảm giá và chiến dịch marketing toàn nền tảng.
          </p>
        </div>
        <div
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-white rounded-lg font-medium transition flex items-center gap-2"
        >
          <FiPlus size={16} /> Tạo voucher
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockVouchers.map((v) => {
          const used = v.discount * 120;
          const limit = v.discount * 200;
          const pct = Math.min(100, Math.round((used / limit) * 100));
          const expiry = v.active ? "31/12/2026" : "31/08/2024";

          return (
            <div
              key={v.id}
              className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500">Mã voucher</p>
                  <p className="mt-1 font-semibold text-lg text-vr-700 tracking-wide">
                    {v.code}
                  </p>
                  <p className="text-sm text-gray-600 mt-3">
                    Giảm {v.discount}% áp dụng cho đơn hàng
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${v.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"}`}
                  >
                    {v.active ? "Đang chạy" : "Đã kết thúc"}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {v.discount}%
                  </p>
                </div>
                <div className="text-sm text-gray-500">HSD: {expiry}</div>
              </div>

              <div className="mt-4">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-vr-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                  <div>Đã dùng</div>
                  <div>
                    {formatNumber(used)} / {formatNumber(limit)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        wide
        icon={<FiTag size={20} />}
        title="Tạo voucher mới"
        subtitle="Cấu hình mã giảm giá cho chiến dịch marketing."
        footer={
          <>
            <div
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-gray-200 cursor-pointer bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Hủy
            </div>
            <div
              onClick={() => setCreateOpen(false)}
              className="rounded-lg bg-vr-500 cursor-pointer px-4 py-2 text-sm font-bold text-white hover:bg-vr-600 hover:text-white"
            >
              Tạo voucher
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
                className={inputClass + " border-vr-500 ring-1 ring-vr-500/50"}
                defaultValue="VIETRIDE10"
              />
            </div>
            <div>
              <label className={labelClass}>
                Tên hiển thị <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                defaultValue="Giảm 10% chuyến đầu"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Mô tả</label>
            <textarea
              className={inputClass + " min-h-[88px]"}
              placeholder="Áp dụng cho khách hàng mới..."
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Loại giảm giá</label>
              <select className={inputClass} defaultValue="percent">
                <option value="percent">Theo phần trăm (%)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                Giá trị giảm <span className="text-red-500">*</span>
              </label>
              <input className={inputClass} defaultValue="10" />
            </div>
            <div>
              <label className={labelClass}>Áp dụng cho</label>
              <select className={inputClass} defaultValue="all">
                <option value="all">Tất cả dịch vụ</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Đơn tối thiểu (₫)</label>
              <input className={inputClass} defaultValue="200000" />
            </div>
            <div>
              <label className={labelClass}>
                Số lượng phát hành <span className="text-red-500">*</span>
              </label>
              <input className={inputClass} defaultValue="5000" />
            </div>
            <div>
              <label className={labelClass}>
                Hạn sử dụng <span className="text-red-500">*</span>
              </label>
              <input className={inputClass} type="date" />
            </div>
          </div>
          <div>
            <p className={labelClass}>Kích hoạt</p>
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
                  Bật ngay sau khi tạo
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Voucher sẽ có hiệu lực và khách hàng có thể sử dụng.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
