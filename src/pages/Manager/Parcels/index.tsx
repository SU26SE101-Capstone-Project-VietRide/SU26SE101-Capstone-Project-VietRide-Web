import { useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiDownload,
  FiFilter,
  FiList,
  FiPackage,
  FiPlus,
  FiSearch,
  FiTruck,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import {
  parcels as mockParcels,
  tripCargoLoads,
  type Parcel,
} from "../../../data/mockData";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

function parcelStatusBadge(s: Parcel["status"]) {
  if (s === "in_transit")
    return (
      <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
        Đang vận chuyển
      </span>
    );
  if (s === "delivered")
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        Đã giao
      </span>
    );
  return (
    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      Chờ lấy hàng
    </span>
  );
}

function cargoBarColor(pct: number) {
  if (pct >= 0.94) return "bg-red-500";
  if (pct >= 0.75) return "bg-amber-500";
  return "bg-emerald-500";
}

export default function ParcelsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [consignOpen, setConsignOpen] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [openDelivery, setOpenDelivery] = useState(false);
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);

  const filtered = useMemo(
    () =>
      mockParcels.filter(
        (p) =>
          p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.recipient.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [searchTerm],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Quản lý hàng hóa
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            Theo dõi đơn ký gửi, sức chứa hàng theo chuyến và trạng thái giao
            nhận.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConsignOpen(true)}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-slate-50 font-bold rounded-lg transition flex items-center gap-2"
        >
          <FiPlus size={18} />
          Tạo đơn ký gửi
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Đơn hôm nay</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">342</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
                ↘ 2.3%
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiPackage size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Đang vận chuyển</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">142</p>
              <p className="mt-2 text-xs text-gray-500">trên 28 chuyến</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiTruck size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Đã giao</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">188</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                ↗ 14%
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiCheckCircle size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Cần xử lý</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">12</p>
              <p className="mt-2 text-xs text-gray-500">hoàn / khiếu nại</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiAlertCircle size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm theo mã đơn, người gửi, người nhận..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={inputClass + " pl-10"}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <FiFilter size={16} />
                  Bộ lọc
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <FiList size={16} />
                  Cột hiển thị
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <FiDownload size={16} />
                  Xuất CSV
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3">Mã đơn</th>
                  <th className="px-5 py-3">Người gửi</th>
                  <th className="px-5 py-3">Tuyến</th>
                  <th className="px-5 py-3">KL</th>
                  <th className="px-5 py-3">Cước</th>
                  <th className="px-5 py-3">Trạng thái</th>
                  <th className="px-5 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                  >
                    <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                      {p.code}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <p className="font-semibold text-gray-900">{p.sender}</p>
                      <p className="text-xs text-gray-500">{p.senderContact}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {p.route}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {p.weightKg} kg
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">
                      {p.fee.toLocaleString("vi-VN")}đ
                    </td>
                    <td className="px-5 py-4">{parcelStatusBadge(p.status)}</td>
                    <td className="px-5 py-4 text-sm space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedParcel(p);
                          setOpenDetail(true);
                        }}
                        className="text-vr-600 hover:text-vr-700 font-medium"
                      >
                        Chi tiết
                      </button>
                      {p.status === "in_transit" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedParcel(p);
                            setOpenDelivery(true);
                          }}
                          className="text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                          Xác nhận giao
                        </button>
                      )}
                      {p.status !== "delivered" && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Hủy đơn ký gửi này?")) {
                              alert("Đơn đã hủy");
                            }
                          }}
                          className="text-red-600 hover:text-red-700 font-medium"
                        >
                          Hủy
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Hiển thị {filtered.length} / 342 bản ghi
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Trước
              </button>
              <button
                type="button"
                className="rounded-lg bg-vr-500 px-3 py-1.5 text-sm font-semibold text-slate-900"
              >
                1
              </button>
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                2
              </button>
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                3
              </button>
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Sau
              </button>
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900">
            Sức chứa hàng theo chuyến
          </h2>
          <p className="mt-1 text-xs text-gray-500">Hôm nay</p>
          <ul className="mt-4 space-y-4">
            {tripCargoLoads.map((t) => {
              const pct = t.currentKg / t.maxKg;
              return (
                <li key={t.tripCode}>
                  <p className="text-xs font-medium text-gray-800">{t.label}</p>
                  <div className="mt-1 flex justify-between text-xs text-gray-500">
                    <span>
                      {t.currentKg}/{t.maxKg}kg
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${cargoBarColor(pct)}`}
                      style={{ width: `${Math.min(100, pct * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>

      <Modal
        open={consignOpen}
        onClose={() => setConsignOpen(false)}
        wide
        icon={<FiPackage size={20} />}
        title="Tạo đơn ký gửi"
        subtitle="Khai báo hàng gửi và gán vào chuyến vận chuyển."
        footer={
          <>
            <button
              type="button"
              onClick={() => setConsignOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => setConsignOpen(false)}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600 hover:text-slate-900"
            >
              Tạo đơn &amp; In vận đơn
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Người gửi</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  Họ tên / Công ty <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} defaultValue="Cty Minh Phát" />
              </div>
              <div>
                <label className={labelClass}>
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} defaultValue="0901 234 567" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Địa chỉ lấy hàng</label>
                <textarea className={inputClass + " min-h-[72px]"} rows={2} />
              </div>
            </div>
          </section>
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">Người nhận</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Họ tên <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} defaultValue="Lê Văn Hùng" />
              </div>
              <div>
                <label className={labelClass}>
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} defaultValue="0987 654 321" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Địa chỉ giao hàng</label>
                <textarea className={inputClass + " min-h-[72px]"} rows={2} />
              </div>
            </div>
          </section>
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              Thông tin hàng hóa
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Tuyến vận chuyển <span className="text-red-500">*</span>
                </label>
                <select className={inputClass} defaultValue="hcm-dl">
                  <option value="hcm-dl">HCM ➔ Đà Lạt</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Loại hàng</label>
                <select className={inputClass} defaultValue="normal">
                  <option value="normal">Hàng thường</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  Khối lượng (kg) <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} defaultValue="5" />
              </div>
              <div>
                <label className={labelClass}>Kích thước (DxRxC cm)</label>
                <input className={inputClass} defaultValue="40 x 30 x 20" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Mô tả nội dung</label>
                <textarea
                  className={inputClass + " min-h-[72px]"}
                  placeholder="Quần áo, đồ điện tử..."
                  rows={2}
                />
              </div>
              <div>
                <label className={labelClass}>Khai giá (đ)</label>
                <input className={inputClass} defaultValue="1000000" />
              </div>
              <div>
                <label className={labelClass}>Thanh toán cước</label>
                <select className={inputClass} defaultValue="sender">
                  <option value="sender">Người gửi trả</option>
                </select>
              </div>
            </div>
          </section>
          <div className="flex flex-col gap-2 rounded-lg bg-sky-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">
                Tổng cước ước tính
              </p>
              <p className="text-xs text-gray-500">
                5kg x 8.000đ (tối thiểu 50.000đ)
              </p>
            </div>
            <p className="text-2xl font-bold text-vr-700">50.000đ</p>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={openDetail}
        onClose={() => setOpenDetail(false)}
        icon={<FiPackage size={20} />}
        title="Chi tiết hàng gửi"
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenDetail(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Đóng
            </button>
            {selectedParcel?.status === "in_transit" && (
              <button
                type="button"
                onClick={() => {
                  setOpenDetail(false);
                  setOpenDelivery(true);
                }}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                Xác nhận giao
              </button>
            )}
          </>
        }
      >
        {selectedParcel && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Mã đơn</p>
                <p className="text-lg font-bold text-gray-900">{selectedParcel.code}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Trạng thái</p>
                <div className="mt-1">{parcelStatusBadge(selectedParcel.status)}</div>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-bold text-gray-900 mb-3">Người gửi</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Tên</p>
                  <p className="font-semibold text-gray-900">{selectedParcel.sender}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Liên hệ</p>
                  <p className="font-semibold text-gray-900">{selectedParcel.senderContact}</p>
                </div>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-bold text-gray-900 mb-3">Người nhận</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Tên</p>
                  <p className="font-semibold text-gray-900">{selectedParcel.recipientName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Liên hệ</p>
                  <p className="font-semibold text-gray-900">{selectedParcel.recipientContact}</p>
                </div>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-bold text-gray-900 mb-3">Thông tin hàng</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Tuyến</p>
                  <p className="font-semibold text-gray-900">{selectedParcel.route}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Khối lượng</p>
                  <p className="font-semibold text-gray-900">{selectedParcel.weightKg} kg</p>
                </div>
              </div>
            </div>
            <div className="border-t pt-4 bg-gray-50 -mx-6 px-6 py-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Cước phí:</span>
                <span className="text-2xl font-bold text-vr-600">{selectedParcel.fee.toLocaleString("vi-VN")}đ</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delivery Confirmation Modal */}
      <Modal
        open={openDelivery}
        onClose={() => setOpenDelivery(false)}
        icon={<FiCheckCircle size={20} />}
        title="Xác nhận giao hàng"
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenDelivery(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenDelivery(false);
                alert("Hàng đã xác nhận giao thành công");
              }}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              Xác nhận giao
            </button>
          </>
        }
      >
        {selectedParcel && (
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
              <p className="text-sm text-blue-800">
                <span className="font-bold">Đơn {selectedParcel.code}</span> - {selectedParcel.route}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                Người nhận: <span className="font-semibold">{selectedParcel.recipientName}</span>
              </p>
            </div>
            
            <div>
              <label className={labelClass}>Ngày giờ giao</label>
              <input type="datetime-local" className={inputClass} defaultValue="2024-05-25T14:30" />
            </div>

            <div>
              <label className={labelClass}>Ghi chú giao hàng</label>
              <textarea className={inputClass + " min-h-[80px]"} placeholder="Ghi chú về quá trình giao hàng..." rows={3} />
            </div>

            <div>
              <label className={labelClass}>Tình trạng hàng hóa</label>
              <select className={inputClass} defaultValue="intact">
                <option value="intact">Nguyên vẹn</option>
                <option value="damaged">Hư hỏng</option>
                <option value="partial">Mất mát một phần</option>
              </select>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-xs font-medium text-amber-900">Lưu ý: Hãy chụp ảnh chứng minh giao hàng trước khi xác nhận</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
