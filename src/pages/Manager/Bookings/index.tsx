import { useMemo, useState } from "react";
import {
  FiClock,
  FiDollarSign,
  FiDownload,
  FiFilter,
  FiList,
  FiPlus,
  FiSearch,
  FiTag,
  FiUser,
  FiXCircle,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import { bookings as mockBookings, type Booking } from "../../../data/mockData";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

const SOLD_SEATS = new Set(["A1", "A2", "B3", "C1", "D4", "E2", "F1", "G3"]);

function formatMoney(n: number) {
  return `${n.toLocaleString("vi-VN")}₫`;
}

function bookingStatusBadge(s: Booking["status"]) {
  if (s === "paid")
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        Đã thanh toán
      </span>
    );
  if (s === "pending")
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
        Chờ thanh toán
      </span>
    );
  return (
    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800">
      Đã hủy
    </span>
  );
}

export default function BookingsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [counterOpen, setCounterOpen] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [openDetail, setOpenDetail] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editSeats, setEditSeats] = useState<string[]>([]);

  const filtered = useMemo(
    () =>
      mockBookings.filter(
        (b) =>
          b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.passenger.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.phone.replace(/\s/g, "").includes(searchTerm.replace(/\s/g, "")),
      ),
    [searchTerm],
  );

  const toggleSeat = (id: string) => {
    if (SOLD_SEATS.has(id)) return;
    setSelectedSeats((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const seatTotal = selectedSeats.length * 320000;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Quản lý đặt vé
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            Tổng hợp toàn bộ vé khách hàng đặt qua app, web và tại quầy.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedSeats([]);
            setCounterOpen(true);
          }}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-slate-50 font-bold rounded-lg transition flex items-center gap-2"
        >
          <FiPlus size={18} />
          Tạo vé tại quầy
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Vé hôm nay</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">1.284</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                ↗ 8.1%
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiTag size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Doanh thu vé</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">₫184.2M</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                ↗ 11.2%
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiDollarSign size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Chờ thanh toán</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">42</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
                ↘ 3 vé
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiClock size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">Đã hủy</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">18</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
                ↘ 1.4%
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiXCircle size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm theo mã vé, tên khách, SĐT..."
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
                className="ml-auto inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:ml-0"
              >
                <FiDownload size={16} />
                Xuất CSV
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Mã vé</th>
                <th className="px-5 py-3">Khách hàng</th>
                <th className="px-5 py-3">SĐT</th>
                <th className="px-5 py-3">Chuyến</th>
                <th className="px-5 py-3">Ghế</th>
                <th className="px-5 py-3">Thành tiền</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                    {b.code}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-800">
                    {b.passenger}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">{b.phone}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {b.tripCode}
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-gray-900">
                    {b.seat}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                    {formatMoney(b.price)}
                  </td>
                  <td className="px-5 py-4">{bookingStatusBadge(b.status)}</td>
                  <td className="px-5 py-4 text-sm space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBooking(b);
                        setOpenDetail(true);
                      }}
                      className="text-vr-600 hover:text-vr-700 font-medium"
                    >
                      Chi tiết
                    </button>
                    {b.status === "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBooking(b);
                            setEditSeats([b.seat]);
                            setOpenEdit(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Hủy vé này?")) {
                              alert("Vé đã hủy");
                            }
                          }}
                          className="text-red-600 hover:text-red-700 font-medium"
                        >
                          Hủy
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Hiển thị {filtered.length} / 1284 bản ghi
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

      <Modal
        open={counterOpen}
        onClose={() => setCounterOpen(false)}
        wide
        icon={<FiTag size={20} />}
        title="Bán vé tại quầy"
        subtitle="Tạo nhanh vé cho khách hàng đặt tại bến / phòng vé."
        footer={
          <>
            <button
              type="button"
              onClick={() => setCounterOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => setCounterOpen(false)}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600 hover:text-slate-900"
            >
              Xác nhận &amp; In vé
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <label className={labelClass}>
              Chọn chuyến <span className="text-red-500">*</span>
            </label>
            <select className={inputClass} defaultValue="vr2401">
              <option value="vr2401">
                VR-2401 · HCM -&gt; Đà Lạt · 06:00 18/05
              </option>
            </select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Sơ đồ ghế</h3>
              <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <span className="h-4 w-6 rounded border border-gray-200 bg-white" />{" "}
                  Trống
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-vr-500" /> Chọn
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-4 w-6 rounded border border-red-200 bg-red-50" />{" "}
                  Đã bán
                </span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:max-w-md">
              {Array.from({ length: 10 }, (_, row) =>
                [1, 2, 3, 4].map((col) => {
                  const letter = String.fromCharCode(65 + row);
                  const id = `${letter}${col}`;
                  const sold = SOLD_SEATS.has(id);
                  const sel = selectedSeats.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={sold}
                      onClick={() => toggleSeat(id)}
                      className={`rounded-lg border py-2 text-xs font-semibold transition ${
                        sold
                          ? "cursor-not-allowed border-red-200 bg-red-50 text-red-700"
                          : sel
                            ? "border-vr-700 bg-vr-600 text-white"
                            : "border-gray-200 bg-white text-gray-800 hover:border-vr-300"
                      }`}
                    >
                      {id}
                    </button>
                  );
                }),
              ).flat()}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              Thông tin khách hàng
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Họ tên <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="Nguyễn Văn A" />
              </div>
              <div>
                <label className={labelClass}>
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="0901 234 567" />
              </div>
              <div>
                <label className={labelClass}>CMND/CCCD</label>
                <input className={inputClass} placeholder="079..." />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input className={inputClass} placeholder="(tùy chọn)" />
              </div>
              <div>
                <label className={labelClass}>Điểm đón</label>
                <select className={inputClass} defaultValue="west">
                  <option value="west">Bến xe Miền Tây</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Phương thức thanh toán</label>
                <select className={inputClass} defaultValue="cash">
                  <option value="cash">Tiền mặt</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-gray-100 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FiUser className="text-gray-400" />
              {selectedSeats.length} ghế đã chọn
            </div>
            <span className="text-lg font-bold text-vr-700">
              {formatMoney(seatTotal)}
            </span>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={openDetail}
        onClose={() => setOpenDetail(false)}
        icon={<FiTag size={20} />}
        title="Chi tiết vé"
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenDetail(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Đóng
            </button>
            {selectedBooking?.status === "pending" && (
              <button
                type="button"
                onClick={() => {
                  setOpenDetail(false);
                  setEditSeats(selectedBooking?.seat ? [selectedBooking.seat] : []);
                  setOpenEdit(true);
                }}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
              >
                Sửa vé
              </button>
            )}
          </>
        }
      >
        {selectedBooking && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Mã vé</p>
                <p className="text-lg font-bold text-gray-900">{selectedBooking.code}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Trạng thái</p>
                <div className="mt-1">{bookingStatusBadge(selectedBooking.status)}</div>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-bold text-gray-900 mb-3">Thông tin khách</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Tên khách</p>
                  <p className="font-semibold text-gray-900">{selectedBooking.passenger}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Điện thoại</p>
                  <p className="font-semibold text-gray-900">{selectedBooking.phone}</p>
                </div>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-bold text-gray-900 mb-3">Thông tin chuyến</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Mã chuyến</p>
                  <p className="font-semibold text-gray-900">{selectedBooking.tripCode}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ghế</p>
                  <p className="font-semibold text-gray-900">{selectedBooking.seat}</p>
                </div>
              </div>
            </div>
            <div className="border-t pt-4 bg-gray-50 -mx-6 px-6 py-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Thành tiền:</span>
                <span className="text-2xl font-bold text-vr-600">{formatMoney(selectedBooking.price)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        icon={<FiTag size={20} />}
        title="Sửa vé"
        wide
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenEdit(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenEdit(false);
                alert("Vé đã cập nhật");
              }}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600"
            >
              Lưu thay đổi
            </button>
          </>
        }
      >
        {selectedBooking && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Chuyến hiện tại</label>
              <input 
                type="text" 
                className={inputClass} 
                value={selectedBooking.tripCode} 
                disabled 
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Chọn ghế mới</h3>
                <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-4 w-6 rounded border border-gray-200 bg-white" /> Trống
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-vr-500" /> Chọn
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-4 w-6 rounded border border-red-200 bg-red-50" /> Đã bán
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:max-w-md">
                {Array.from({ length: 10 }, (_, row) =>
                  [1, 2, 3, 4].map((col) => {
                    const letter = String.fromCharCode(65 + row);
                    const id = `${letter}${col}`;
                    const sold = SOLD_SEATS.has(id);
                    const sel = editSeats.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={sold}
                        onClick={() => setEditSeats([id])}
                        className={`rounded-lg border py-2 text-xs font-semibold transition ${
                          sold
                            ? "cursor-not-allowed border-red-200 bg-red-50 text-red-700"
                            : sel
                              ? "border-vr-700 bg-vr-600 text-white"
                              : "border-gray-200 bg-white text-gray-800 hover:border-vr-300"
                        }`}
                      >
                        {id}
                      </button>
                    );
                  }),
                ).flat()}
              </div>
            </div>
            <div>
              <label className={labelClass}>Ghi chú</label>
              <input className={inputClass} placeholder="Ghi chú về thay đổi vé..." />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
