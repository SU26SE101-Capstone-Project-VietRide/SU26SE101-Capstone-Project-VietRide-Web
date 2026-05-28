import { useMemo, useState } from "react";
import {
  FiDownload,
  FiFilter,
  FiList,
  FiPlus,
  FiSearch,
  FiShield,
  FiTool,
  FiTruck,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import { fleetVehicles, type FleetVehicle } from "../../../data/mockData";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

function vehicleStatusBadge(s: FleetVehicle["status"]) {
  const map = {
    active: {
      bg: "bg-emerald-50",
      dot: "bg-emerald-500",
      text: "text-emerald-800",
      label: "Đang hoạt động",
    },
    maintenance: {
      bg: "bg-amber-50",
      dot: "bg-amber-500",
      text: "text-amber-800",
      label: "Bảo trì",
    },
    inactive: {
      bg: "bg-gray-100",
      dot: "bg-gray-400",
      text: "text-gray-700",
      label: "Ngừng hoạt động",
    },
  }[s];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${map.bg} ${map.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${map.dot}`} />
      {map.label}
    </span>
  );
}

export default function VehiclesPage() {
  const [search, setSearch] = useState("");
  const [openReg, setOpenReg] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openMaint, setOpenMaint] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicle | null>(null);

  const filtered = useMemo(
    () =>
      fleetVehicles.filter(
        (v) =>
          v.plate.toLowerCase().includes(search.toLowerCase()) ||
          (v.driver && v.driver.toLowerCase().includes(search.toLowerCase())) ||
          v.model.toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  );

  const total = 312;
  const active = 284;
  const maint = 28;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Quản lý phương tiện
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            Đội xe, lịch bảo trì và đăng kiểm.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpenReg(true)}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-slate-50 font-bold rounded-lg transition flex items-center gap-2"
        >
          <FiPlus size={18} />
          Thêm xe
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Tổng số xe</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{total}</p>
              <p className="mt-2 text-xs text-gray-500">
                đội xe Phương Trang HCM
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiTruck size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Đang hoạt động</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{active}</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                ↑ 91%
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiShield size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Bảo trì / nghỉ</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{maint}</p>
              <p className="mt-2 text-xs text-gray-500">cần lịch bảo dưỡng</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiTool size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className={inputClass + " pl-10"}
              placeholder="Tìm theo biển số, tài xế..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Biển số</th>
                <th className="px-5 py-3">Mẫu xe</th>
                <th className="px-5 py-3">Năm SX</th>
                <th className="px-5 py-3">Sức chứa</th>
                <th className="px-5 py-3">Tài xế phụ trách</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                    {v.plate}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">{v.model}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">{v.year}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {v.capacity} ghế
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {v.driver ?? "—"}
                  </td>
                  <td className="px-5 py-4">{vehicleStatusBadge(v.status)}</td>
                  <td className="px-5 py-4 text-sm space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVehicle(v);
                        setOpenEdit(true);
                      }}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVehicle(v);
                        setOpenMaint(true);
                      }}
                      className="text-amber-600 hover:text-amber-700 font-medium"
                    >
                      Bảo trì
                    </button>
                    {v.status === "inactive" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Xoá xe khỏi hệ thống?")) {
                            alert("Xe đã xoá");
                          }
                        }}
                        className="text-red-600 hover:text-red-700 font-medium"
                      >
                        Xoá
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
            Hiển thị {filtered.length} / {total} bản ghi
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
        open={openReg}
        onClose={() => setOpenReg(false)}
        wide
        icon={<FiTruck size={20} />}
        title="Đăng ký phương tiện"
        subtitle="Thêm xe mới vào đội xe của nhà vận hành."
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenReg(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => setOpenReg(false)}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600 hover:text-slate-900"
            >
              Đăng ký xe
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              Thông tin xe
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Biển số <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="51B-12345" />
              </div>
              <div>
                <label className={labelClass}>Số khung / VIN</label>
                <input className={inputClass} placeholder="KMHJ381..." />
              </div>
              <div>
                <label className={labelClass}>Hãng xe</label>
                <select className={inputClass} defaultValue="Hyundai">
                  <option>Hyundai</option>
                  <option>Thaco</option>
                  <option>Samco</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  Mẫu xe <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="Universe 40s" />
              </div>
              <div>
                <label className={labelClass}>Năm sản xuất</label>
                <input className={inputClass} placeholder="2022" />
              </div>
              <div>
                <label className={labelClass}>
                  Sức chứa (ghế) <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="40" />
              </div>
              <div>
                <label className={labelClass}>Loại xe</label>
                <select className={inputClass} defaultValue="sleeper">
                  <option value="sleeper">Giường nằm</option>
                  <option value="seat">Ghế ngồi</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Tải trọng hàng (kg)</label>
                <input className={inputClass} placeholder="500" />
              </div>
            </div>
          </section>
          <div className="border-t border-gray-100" />
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              Pháp lý &amp; vận hành
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Hạn đăng kiểm <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} type="date" />
              </div>
              <div>
                <label className={labelClass}>Hạn bảo hiểm</label>
                <input className={inputClass} type="date" />
              </div>
              <div>
                <label className={labelClass}>Tài xế phụ trách</label>
                <select className={inputClass} defaultValue="">
                  <option value="">Chưa gán</option>
                  <option>Nguyễn Văn An</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Trạng thái</label>
                <select className={inputClass} defaultValue="active">
                  <option value="active">Đang hoạt động</option>
                  <option value="maint">Bảo trì</option>
                </select>
              </div>
            </div>
          </section>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        wide
        icon={<FiTruck size={20} />}
        title="Chỉnh sửa thông tin xe"
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
                alert("Thông tin xe đã cập nhật");
              }}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600"
            >
              Lưu thay đổi
            </button>
          </>
        }
      >
        {selectedVehicle && (
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 text-sm font-bold text-gray-900">
                Thông tin xe
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Biển số</label>
                  <input className={inputClass} defaultValue={selectedVehicle.plate} disabled />
                </div>
                <div>
                  <label className={labelClass}>Mẫu xe</label>
                  <input className={inputClass} defaultValue={selectedVehicle.model} />
                </div>
                <div>
                  <label className={labelClass}>Năm SX</label>
                  <input className={inputClass} defaultValue={selectedVehicle.year} />
                </div>
                <div>
                  <label className={labelClass}>Sức chứa</label>
                  <input className={inputClass} defaultValue={selectedVehicle.capacity} />
                </div>
              </div>
            </section>
            <div className="border-t border-gray-100" />
            <section>
              <h3 className="mb-3 text-sm font-bold text-gray-900">Vận hành</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Tài xế phụ trách</label>
                  <select className={inputClass} defaultValue={selectedVehicle.driver || ""}>
                    <option value="">Chưa gán</option>
                    <option value="Nguyễn Văn An">Nguyễn Văn An</option>
                    <option value="Trần Văn B">Trần Văn B</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Trạng thái</label>
                  <select className={inputClass} defaultValue={selectedVehicle.status}>
                    <option value="active">Đang hoạt động</option>
                    <option value="maintenance">Bảo trì</option>
                    <option value="inactive">Ngừng hoạt động</option>
                  </select>
                </div>
              </div>
            </section>
          </div>
        )}
      </Modal>

      {/* Maintenance Modal */}
      <Modal
        open={openMaint}
        onClose={() => setOpenMaint(false)}
        icon={<FiTool size={20} />}
        title="Lên lịch bảo trì"
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenMaint(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenMaint(false);
                alert("Lịch bảo trì đã được đặt");
              }}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
            >
              Xác nhận bảo trì
            </button>
          </>
        }
      >
        {selectedVehicle && (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Xe: <span className="font-mono">{selectedVehicle.plate}</span>
              </p>
              <p className="text-sm text-amber-800 mt-1">
                {selectedVehicle.model}
              </p>
            </div>

            <div>
              <label className={labelClass}>Loại bảo trì</label>
              <select className={inputClass} defaultValue="routine">
                <option value="routine">Bảo dưỡng định kỳ</option>
                <option value="repair">Sửa chữa</option>
                <option value="inspection">Kiểm tra an toàn</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Ngày dự kiến bảo trì</label>
              <input type="date" className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Dự kiến thời gian (ngày)</label>
              <input type="number" className={inputClass} placeholder="3" />
            </div>

            <div>
              <label className={labelClass}>Mô tả công việc cần làm</label>
              <textarea className={inputClass + " min-h-[100px]"} placeholder="Liệt kê các công việc bảo trì cần thực hiện..." rows={4} />
            </div>

            <div>
              <label className={labelClass}>Nhà thầu bảo trì</label>
              <input type="text" className={inputClass} placeholder="Tên garage / xưởng sửa" />
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <p className="text-xs text-blue-800">
                <span className="font-semibold">Lưu ý:</span> Xe sẽ được đánh dấu là "Bảo trì" trong hệ thống và không thể sử dụng cho các chuyến đi trong thời gian này.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
