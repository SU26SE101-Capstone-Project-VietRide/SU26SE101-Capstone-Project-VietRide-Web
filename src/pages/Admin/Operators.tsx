import { useState } from "react";
import {
  FiDownload,
  FiHome,
  FiPlus,
  FiSearch,
  FiCheck,
  FiX,
  FiEye,
  FiFilter,
} from "react-icons/fi";
import Modal from "../../components/Modal";
import { operators as mockOperators } from "../../data/mockData";

function formatCurrency(v: number) {
  return `${(v / 1000000).toFixed(0)}M`;
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

type OperatorStatus = "PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED";

export default function Operators() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<OperatorStatus | "ALL">(
    "ALL",
  );
  const [openOnboard, setOpenOnboard] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [openApprove, setOpenApprove] = useState(false);
  const [openReject, setOpenReject] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState<
    ((typeof mockOperators)[0] & { status: OperatorStatus }) | null
  >(null);
  const [rejectReason, setRejectReason] = useState("");

  // Mock data with statuses
  const operatorsWithStatus = mockOperators.map((op) => ({
    ...op,
    status: (Math.random() > 0.7
      ? "PENDING"
      : Math.random() > 0.8
        ? "REJECTED"
        : Math.random() > 0.9
          ? "SUSPENDED"
          : "APPROVED") as OperatorStatus,
  }));

  const filtered = operatorsWithStatus.filter((o) => {
    const matchSearch = o.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "ALL" || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const pendingCount = operatorsWithStatus.filter(
    (o) => o.status === "PENDING",
  ).length;

  const handleApprove = () => {
    setOpenApprove(false);
    alert(`Đã phê duyệt nhà xe: ${selectedOperator?.name}`);
    setSelectedOperator(null);
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      alert("Vui lòng nhập lý do từ chối");
      return;
    }
    setOpenReject(false);
    alert(`Đã từ chối: ${selectedOperator?.name}\nLý do: ${rejectReason}`);
    setRejectReason("");
    setSelectedOperator(null);
  };

  const getStatusBadge = (status: OperatorStatus) => {
    const config = {
      PENDING: {
        bg: "bg-amber-50",
        text: "text-amber-700",
        label: "Chờ duyệt",
      },
      APPROVED: {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        label: "Hoạt động",
      },
      SUSPENDED: {
        bg: "bg-red-50",
        text: "text-red-700",
        label: "Tạm khóa",
      },
      REJECTED: {
        bg: "bg-gray-50",
        text: "text-gray-700",
        label: "Bị từ chối",
      },
    };
    const c = config[status];
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}
      >
        {c.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nhà vận hành</h1>
          <p className="text-gray-600 mt-1">
            Quản lý, duyệt và phân quyền các nhà xe trên nền tảng.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpenOnboard(true)}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-white font-bold rounded-lg transition flex items-center gap-2"
        >
          <FiPlus size={16} /> Thêm nhà xe
        </button>
      </div>

      {/* Pending Alert */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-amber-600">
                <FiFilter size={20} />
              </div>
              <div>
                <p className="font-semibold text-amber-900">Chờ duyệt</p>
                <p className="text-sm text-amber-700">
                  {pendingCount} đơn đăng ký nhà xe chờ xác thực
                </p>
              </div>
            </div>
            <button
              onClick={() => setFilterStatus("PENDING")}
              className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 font-medium rounded-lg transition"
            >
              Xem ngay
            </button>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 relative min-w-50">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, MST..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none text-sm bg-gray-50 focus:bg-white focus:border-vr-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as typeof filterStatus)
            }
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm font-medium focus:outline-none focus:border-vr-500"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="APPROVED">Hoạt động</option>
            <option value="SUSPENDED">Tạm khóa</option>
            <option value="REJECTED">Bị từ chối</option>
          </select>

          <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50">
            <FiDownload className="inline mr-2" size={16} />
            Xuất CSV
          </button>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Mã
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Tên nhà xe
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Tuyến
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Doanh thu
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Trạng thái
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((op, idx) => (
                <tr
                  key={op.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    OP-{String(idx + 1).padStart(3, "0")}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {op.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {op.name.split(" ")[0].toLowerCase()}@company.vn
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {Math.floor(50 + idx * 5)} tuyến
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-vr-600">
                    {formatCurrency(op.revenue)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {getStatusBadge(op.status)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedOperator(op);
                          setOpenDetail(true);
                        }}
                        className="p-1.5 text-vr-600 hover:bg-vr-50 rounded-lg transition"
                        title="Chi tiết"
                      >
                        <FiEye size={16} />
                      </button>
                      {op.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedOperator(op);
                              setOpenApprove(true);
                            }}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Phê duyệt"
                          >
                            <FiCheck size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedOperator(op);
                              setOpenReject(true);
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Từ chối"
                          >
                            <FiX size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Hiển thị {filtered.length} / {operatorsWithStatus.length} nhà xe
          </p>
          <div className="flex gap-2">
            <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm hover:bg-gray-50">
              Trước
            </button>
            <button className="px-3 py-2 bg-vr-500 text-white rounded-lg text-sm">
              1
            </button>
            <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm hover:bg-gray-50">
              2
            </button>
            <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm hover:bg-gray-50">
              Sau
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal
        open={openDetail}
        onClose={() => setOpenDetail(false)}
        icon={<FiEye size={20} />}
        title="Chi tiết nhà xe"
        footer={
          <>
            <button
              onClick={() => setOpenDetail(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Đóng
            </button>
          </>
        }
      >
        {selectedOperator && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-600">Tên nhà xe</p>
              <p className="text-sm font-semibold text-gray-900">
                {selectedOperator.name}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">Email liên hệ</p>
              <p className="text-sm text-gray-900">
                {selectedOperator.name.toLowerCase().replace(" ", "")}
                @company.vn
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">Trạng thái</p>
              <div className="mt-1">
                {getStatusBadge(selectedOperator.status)}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">Doanh thu</p>
              <p className="text-sm font-semibold text-vr-600">
                {formatCurrency(selectedOperator.revenue)}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal
        open={openApprove}
        onClose={() => setOpenApprove(false)}
        icon={<FiCheck size={20} />}
        title="Phê duyệt nhà xe"
        footer={
          <>
            <button
              onClick={() => setOpenApprove(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              onClick={handleApprove}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              Phê duyệt
            </button>
          </>
        }
      >
        {selectedOperator && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-900">
                Bạn chắc chắn muốn phê duyệt nhà xe{" "}
                <strong>{selectedOperator.name}</strong>? Họ sẽ được quyền truy
                cập vào dashboard sau khi phê duyệt.
              </p>
            </div>
            <div>
              <label className={labelClass}>Ghi chú (tuỳ chọn)</label>
              <textarea
                placeholder="Ghi chú khi duyệt..."
                className={inputClass + " min-h-20"}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={openReject}
        onClose={() => setOpenReject(false)}
        icon={<FiX size={20} />}
        title="Từ chối đơn đăng ký"
        footer={
          <>
            <button
              onClick={() => setOpenReject(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              onClick={handleReject}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
            >
              Xác nhận từ chối
            </button>
          </>
        }
      >
        {selectedOperator && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-900">
                Bạn chắc chắn muốn từ chối đơn đăng ký của{" "}
                <strong>{selectedOperator.name}</strong>?
              </p>
            </div>
            <div>
              <label className={labelClass}>
                Lý do từ chối <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Vui lòng nhập lý do từ chối..."
                className={inputClass + " min-h-25"}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Create Operator Modal */}

      <Modal
        open={openOnboard}
        onClose={() => setOpenOnboard(false)}
        wide
        icon={<FiHome size={20} />}
        title="Onboard nhà vận hành mới"
        subtitle="Thêm doanh nghiệp vận tải vào nền tảng VietRide."
        footer={
          <>
            <div
              onClick={() => setOpenOnboard(false)}
              className="rounded-lg border cursor-pointer border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Hủy
            </div>
            <div
              onClick={() => setOpenOnboard(false)}
              className="rounded-lg bg-vr-500 cursor-pointer px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 hover:text-white"
            >
              Tạo nhà vận hành
            </div>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              Thông tin doanh nghiệp
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  Tên thương hiệu <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="VD: Phương Trang" />
              </div>
              <div>
                <label className={labelClass}>
                  Mã số thuế <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="0301234567" />
              </div>
              <div>
                <label className={labelClass}>Loại hình</label>
                <select className={inputClass} defaultValue="bus">
                  <option value="bus">Xe khách liên tỉnh</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Địa chỉ trụ sở</label>
                <textarea
                  className={inputClass + " min-h-20"}
                  placeholder="Số nhà, đường, quận/huyện, tỉnh/thành"
                  rows={2}
                />
              </div>
            </div>
          </section>
          <div className="border-t border-gray-100" />
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              Liên hệ chính
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Người đại diện <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="Nguyễn Văn A" />
              </div>
              <div>
                <label className={labelClass}>Chức vụ</label>
                <input className={inputClass} placeholder="Giám đốc vận hành" />
              </div>
              <div>
                <label className={labelClass}>
                  Email <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="ops@congty.vn" />
              </div>
              <div>
                <label className={labelClass}>
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input className={inputClass} placeholder="0901 234 567" />
              </div>
            </div>
          </section>
          <div className="border-t border-gray-100" />
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              Cấu hình hoạt động
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Quy mô đội xe ban đầu</label>
                <input className={inputClass} placeholder="50" />
              </div>
              <div>
                <label className={labelClass}>% Hoa hồng nền tảng</label>
                <input className={inputClass} placeholder="8" />
              </div>
            </div>
            <div className="mt-4">
              <p className={labelClass}>Kích hoạt ngay</p>
              <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
                <button
                  type="button"
                  role="switch"
                  aria-checked="true"
                  className="relative h-7 w-12 shrink-0 rounded-full bg-vr-500 transition"
                >
                  <span className="absolute right-1 top-1 h-5 w-5 rounded-full bg-white shadow" />
                </button>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    Cho phép bán vé ngay
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Sau khi xác thực tài liệu, nhà xe có thể nhận booking.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </Modal>
    </div>
  );
}
