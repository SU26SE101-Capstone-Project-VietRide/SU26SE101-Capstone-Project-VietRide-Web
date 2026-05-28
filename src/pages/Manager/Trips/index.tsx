import { useMemo, useState } from "react";
import {
  FiTruck,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiFilter,
  FiList,
  FiMoreVertical,
  FiPlus,
  FiSearch,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import { managerTrips, type ManagerTripStatus } from "../../../data/mockData";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

type TripTab = "all" | "running" | "upcoming" | "completed" | "cancelled";

function formatDepart(iso: string) {
  const d = new Date(iso);
  const t = d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${t} ${day}/${month}`;
}

function tripStatusBadge(s: ManagerTripStatus) {
  const styles: Record<
    ManagerTripStatus,
    { className: string; label: string }
  > = {
    running: {
      className: "bg-sky-50 text-sky-800",
      label: "Đang chạy",
    },
    departed: {
      className: "bg-vr-50 text-vr-900",
      label: "Đã khởi hành",
    },
    upcoming: {
      className: "bg-amber-50 text-amber-800",
      label: "Sắp khởi hành",
    },
    cancelled: {
      className: "bg-red-50 text-red-800",
      label: "Đã hủy",
    },
    completed: {
      className: "bg-emerald-50 text-emerald-800",
      label: "Hoàn thành",
    },
  };
  const x = styles[s];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${x.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {x.label}
    </span>
  );
}

export default function TripsPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TripTab>("all");
  const [openCreate, setOpenCreate] = useState(false);

  const counts = useMemo(() => {
    const c = {
      all: managerTrips.length,
      running: 0,
      upcoming: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const t of managerTrips) {
      if (t.status === "running" || t.status === "departed") c.running++;
      if (t.status === "upcoming") c.upcoming++;
      if (t.status === "completed") c.completed++;
      if (t.status === "cancelled") c.cancelled++;
    }
    return c;
  }, []);

  const filtered = useMemo(() => {
    return managerTrips.filter((trip) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        trip.code.toLowerCase().includes(q) ||
        trip.route.toLowerCase().includes(q) ||
        trip.vehiclePlate.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (tab === "all") return true;
      if (tab === "running")
        return trip.status === "running" || trip.status === "departed";
      return trip.status === tab;
    });
  }, [search, tab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Quản lý chuyến xe
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            Lập lịch, theo dõi và điều phối toàn bộ chuyến xe của nhà xe.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpenCreate(true)}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-slate-50 font-bold rounded-lg transition flex items-center gap-2"
        >
          <FiPlus size={18} />
          Tạo chuyến mới
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", `Tất cả · ${counts.all}`],
            ["running", `Đang chạy · ${counts.running}`],
            ["upcoming", `Sắp khởi hành · ${counts.upcoming}`],
            ["completed", `Hoàn thành · ${counts.completed}`],
            ["cancelled", `Đã hủy · ${counts.cancelled}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              tab === key
                ? "border-gray-300 bg-gray-100 text-gray-900"
                : "border-transparent bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className={inputClass + " pl-10"}
              placeholder="Tìm theo mã chuyến, tuyến, biển số..."
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
          <table className="w-full min-w-[960px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="w-10 px-3 py-3" />
                <th className="px-4 py-3">Mã chuyến</th>
                <th className="px-4 py-3">Tuyến</th>
                <th className="px-4 py-3">Khởi hành</th>
                <th className="px-4 py-3">Tài xế</th>
                <th className="px-4 py-3">Phương tiện</th>
                <th className="px-4 py-3">Ghế</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-center"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((trip) => (
                <tr
                  key={trip.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-3 py-4">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      className="text-sm font-semibold text-vr-700 hover:underline"
                    >
                      {trip.code}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-800">
                    {trip.route}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {formatDepart(trip.departAt)}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {trip.driver}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">
                    {trip.vehiclePlate}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {trip.seatsTotal > 0
                      ? `${trip.seatsSold}/${trip.seatsTotal}`
                      : "—"}
                  </td>
                  <td className="px-4 py-4">{tripStatusBadge(trip.status)}</td>
                  <td className="px-4 py-4 text-center text-gray-400">
                    <button type="button" className="p-1 hover:text-gray-700">
                      <FiMoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Hiển thị {filtered.length} / {managerTrips.length} bản ghi
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <FiChevronLeft className="inline" /> Trước
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
              Sau <FiChevronRight className="inline" />
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        wide
        icon={<FiTruck size={20} />}
        title="Tạo chuyến xe mới"
        subtitle="Lập lịch chuyến xe, gán tài xế và phương tiện."
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenCreate(false)}
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
              onClick={() => setOpenCreate(false)}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600 hover:text-slate-900"
            >
              Mở bán chuyến
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              Tuyến &amp; lịch trình
            </h3>
            <div className="mb-4">
              <label className={labelClass}>
                Tuyến đường <span className="text-red-500">*</span>
              </label>
              <select className={inputClass} defaultValue="">
                <option value="">Chọn tuyến...</option>
                <option>HCM → Đà Lạt</option>
                <option>HCM → Nha Trang</option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Ngày khởi hành <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} type="date" />
              </div>
              <div>
                <label className={labelClass}>
                  Giờ khởi hành <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} type="time" />
              </div>
              <div>
                <label className={labelClass}>Điểm đón</label>
                <select className={inputClass} defaultValue="west">
                  <option value="west">Bến xe Miền Tây</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Điểm trả</label>
                <select className={inputClass} defaultValue="dl">
                  <option value="dl">Bến xe Đà Lạt</option>
                </select>
              </div>
            </div>
          </section>
          <div className="border-t border-gray-100" />
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              Phương tiện &amp; nhân sự
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Phương tiện <span className="text-red-500">*</span>
                </label>
                <select className={inputClass} defaultValue="">
                  <option value="">Chọn xe...</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  Tài xế chính <span className="text-red-500">*</span>
                </label>
                <select className={inputClass} defaultValue="">
                  <option value="">Chọn tài xế...</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Tài xế phụ</label>
                <select className={inputClass} defaultValue="">
                  <option value="">(tùy chọn)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Phụ xe / tiếp viên</label>
                <input className={inputClass} placeholder="Họ tên" />
              </div>
            </div>
          </section>
          <div className="border-t border-gray-100" />
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              Giá &amp; tải trọng
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Giá vé (đ) <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} defaultValue="320000" />
              </div>
              <div>
                <label className={labelClass}>Số ghế mở bán</label>
                <input className={inputClass} defaultValue="40" />
              </div>
              <div>
                <label className={labelClass}>Sức chứa hàng (kg)</label>
                <input className={inputClass} defaultValue="500" />
              </div>
              <div>
                <label className={labelClass}>Cước hàng / kg (đ)</label>
                <input className={inputClass} defaultValue="8000" />
              </div>
            </div>
          </section>
        </div>
      </Modal>
    </div>
  );
}
