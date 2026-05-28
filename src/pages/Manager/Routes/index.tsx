import { useState } from "react";
import {
  FiClock,
  FiGitBranch,
  FiMapPin,
  FiNavigation,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import { routeCards } from "../../../data/mockData";

export default function RoutesPage() {
  const [openConfig, setOpenConfig] = useState(false);
  const [openSchedule, setOpenSchedule] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Tuyến đường &amp; điểm dừng
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            Cấu hình tuyến, điểm đón / trả khách và thay đổi lộ trình.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpenConfig(true)}
          className="inline-flex cursor-pointer shrink-0 items-center gap-2 rounded-lg bg-vr-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-vr-600 hover:text-white"
        >
          <FiPlus size={18} />
          Tạo tuyến mới
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {routeCards.map((r) => (
          <article
            key={r.id}
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-vr-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-gray-400">
                {r.code}
              </span>
              {r.status === "running" ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  Đang chạy
                </span>
              ) : (
                <span className="rounded-full bg-vr-50 px-2.5 py-0.5 text-xs font-semibold text-vr-900">
                  Bản nháp
                </span>
              )}
            </div>
            <h2 className="mt-3 text-lg font-bold text-gray-900">{r.title}</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <FiMapPin className="mx-auto text-gray-400" />
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  Điểm dừng
                </p>
                <p className="text-sm font-bold text-gray-900">{r.stops}</p>
              </div>
              <div>
                <FiClock className="mx-auto text-gray-400" />
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  Thời gian
                </p>
                <p className="text-sm font-bold text-gray-900">{r.duration}</p>
              </div>
              <div>
                <FiGitBranch className="mx-auto text-gray-400" />
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  Chuyến/tuần
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {r.tripsPerWeek}
                </p>
              </div>
            </div>
            <div className="mt-4 border-t border-gray-100 pt-4 flex items-center justify-between text-sm">
              <span className="text-gray-500">{r.distanceKm} km</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRoute(r);
                    setOpenSchedule(true);
                  }}
                  className="font-medium text-blue-600 hover:text-blue-700"
                >
                  Lịch
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRoute(r);
                    setOpenConfig(true);
                  }}
                  className="font-medium text-vr-700 hover:text-vr-800"
                >
                  Sửa →
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={openConfig}
        onClose={() => setOpenConfig(false)}
        wide
        icon={<FiNavigation size={20} />}
        title="Cấu hình tuyến đường"
        subtitle="Định nghĩa tuyến, điểm dừng và thời gian dự kiến."
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenConfig(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Lưu nháp
            </button>
            <button
              type="button"
              onClick={() => setOpenConfig(false)}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600 hover:text-slate-900"
            >
              Phát hành tuyến
            </button>
          </>
        }
      >
        <RouteConfigForm />
      </Modal>

      {/* Schedule Modal */}
      <Modal
        open={openSchedule}
        onClose={() => setOpenSchedule(false)}
        icon={<FiClock size={20} />}
        title="Lên lịch chuyến"
        subtitle="Tạo lịch chạy định kỳ cho tuyến này"
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenSchedule(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenSchedule(false);
                alert("Lịch chuyến đã được tạo");
              }}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600"
            >
              Tạo lịch
            </button>
          </>
        }
      >
        {selectedRoute && (
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <p className="text-sm font-semibold text-blue-900">{selectedRoute.title}</p>
              <p className="text-xs text-blue-700 mt-1">{selectedRoute.distanceKm} km · {selectedRoute.duration}</p>
            </div>

            <div>
              <label className={labelClass}>Ngày bắt đầu</label>
              <input type="date" className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Ngày kết thúc</label>
              <input type="date" className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Giờ xuất phát</label>
              <input type="time" className={inputClass} defaultValue="06:00" />
            </div>

            <div>
              <label className={labelClass}>Các ngày chạy trong tuần</label>
              <div className="mt-2 flex flex-wrap gap-3">
                {["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"].map((day, idx) => (
                  <label key={idx} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked={idx < 6}
                      className="rounded border-gray-300 text-vr-600"
                    />
                    <span className="text-sm text-gray-700">{day}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Tần suất</label>
              <select className={inputClass} defaultValue="daily">
                <option value="daily">Hàng ngày</option>
                <option value="weekly">Hàng tuần</option>
                <option value="biweekly">2 tuần một lần</option>
              </select>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Tóm tắt:</span> Lịch sẽ chạy từ ngày được chọn, xuất phát lúc 06:00, vào các ngày được chọn mỗi tuần.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

const defaultStops = [
  { id: "1", name: "Bến xe Miền Tây, HCM", meta: "0 km · 00:00" },
  { id: "2", name: "Trạm Long Khánh", meta: "75 km · 01:15" },
  { id: "3", name: "TP Bảo Lộc", meta: "190 km · 04:30" },
  { id: "4", name: "Bến xe Đà Lạt", meta: "308 km · 07:30" },
];

function RouteConfigForm() {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-bold text-gray-900">
          Thông tin tuyến
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>
              Mã tuyến <span className="text-red-500">*</span>
            </label>
            <input className={inputClass} defaultValue="R-DL01" />
          </div>
          <div>
            <label className={labelClass}>
              Tên tuyến <span className="text-red-500">*</span>
            </label>
            <input className={inputClass} defaultValue="HCM → Đà Lạt" />
          </div>
          <div>
            <label className={labelClass}>
              Điểm xuất phát <span className="text-red-500">*</span>
            </label>
            <input className={inputClass} defaultValue="TP. Hồ Chí Minh" />
          </div>
          <div>
            <label className={labelClass}>
              Điểm đến <span className="text-red-500">*</span>
            </label>
            <input className={inputClass} defaultValue="Đà Lạt" />
          </div>
          <div>
            <label className={labelClass}>Tổng quãng đường (km)</label>
            <input className={inputClass} defaultValue="308" />
          </div>
          <div>
            <label className={labelClass}>Thời gian dự kiến</label>
            <input className={inputClass} defaultValue="7h 30m" />
          </div>
        </div>
      </section>
      <div className="border-t border-gray-100" />
      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Điểm dừng dọc đường
            </h3>
            <p className="text-xs text-gray-500">Kéo để sắp xếp lại thứ tự.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FiPlus size={16} />
            Thêm điểm dừng
          </button>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-2">
          {defaultStops.map((row, i) => (
            <div
              key={row.id}
              className="mb-2 flex items-center gap-2 rounded-lg border border-gray-100 bg-white p-2 last:mb-0"
            >
              <span className="cursor-grab px-1 text-gray-400">⋮⋮</span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vr-100 text-xs font-bold text-vr-800">
                {i + 1}
              </span>
              <input
                className={inputClass + " flex-1"}
                defaultValue={row.name}
              />
              <input
                className={inputClass + " w-36 shrink-0"}
                defaultValue={row.meta}
              />
              <button
                type="button"
                className="shrink-0 p-2 text-red-500 hover:bg-red-50 rounded-lg"
                aria-label="Xóa"
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
