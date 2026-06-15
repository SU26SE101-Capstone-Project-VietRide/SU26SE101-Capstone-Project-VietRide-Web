import { useState } from "react";
import { FiPlus, FiBox, FiEdit2, FiTrash2, FiCheck, FiX } from "react-icons/fi";
import Modal from "../../components/Modal";
import { packages as mockPackages } from "../../data/mockData";

type Package = any;

function formatNumber(n: number) {
  return n.toLocaleString();
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

export default function Packages() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);

  const handleEdit = (pkg: Package) => {
    setSelectedPackage(pkg);
    setEditOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa gói này?")) {
      alert(`Xóa gói ${id} thành công!`);
    }
  };

  const handleToggleActive = (id: string) => {
    alert(`Cập nhật trạng thái gói ${id} thành công!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Quản lý Gói Dịch vụ
          </h1>
          <p className="text-gray-600 mt-1">
            Tạo và quản lý các gói dịch vụ mà nhà xe có thể mua từ hệ thống. Mỗi
            gói bao gồm các ưu đãi, giới hạn xe, tuyến đường và voucher khuyến
            mãi.
          </p>
        </div>
        <div
          onClick={() => {
            setSelectedPackage(null);
            setCreateOpen(true);
          }}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-white rounded-lg font-medium transition flex items-center gap-2"
        >
          <FiPlus size={16} /> Tạo gói mới
        </div>
      </div>

      {/* Card Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockPackages.map((pkg) => (
          <div
            key={pkg.id}
            className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  Gói dịch vụ
                </p>
                <h3 className="mt-1 text-xl font-bold text-gray-900">
                  {pkg.name}
                </h3>
              </div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  pkg.active
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {pkg.active ? "Hoạt động" : "Tắt"}
              </span>
            </div>

            <p className="text-sm text-gray-600 mb-4">{pkg.description}</p>

            {/* Price */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <div className="flex items-baseline">
                <span className="text-4xl font-bold text-vr-600">
                  {formatNumber(pkg.price)}
                </span>
                <span className="text-gray-600 ml-2">
                  ₫ / {pkg.duration} tháng
                </span>
              </div>
            </div>

            {/* Features/Limits */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <FiBox size={16} className="text-vr-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Số lượng xe</p>
                  <p className="font-semibold text-gray-900">
                    Tối đa {pkg.maxVehicles} xe
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FiBox size={16} className="text-vr-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Tuyến đường</p>
                  <p className="font-semibold text-gray-900">
                    Tối đa {pkg.maxRoutes} tuyến
                  </p>
                </div>
              </div>
            </div>

            {/* Features List */}
            <div className="mb-6">
              <p className="text-xs text-gray-600 font-medium mb-2">
                Tính năng:
              </p>
              <ul className="space-y-1">
                {pkg.features.map((feature, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-gray-700 flex items-start gap-2"
                  >
                    <span className="text-vr-500 mt-1">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={() => handleToggleActive(pkg.id)}
                className="flex-1 p-2 text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg text-sm font-medium transition"
                title={pkg.active ? "Vô hiệu hóa" : "Kích hoạt"}
              >
                {pkg.active ? "Vô hiệu hóa" : "Kích hoạt"}
              </button>
              <button
                onClick={() => handleEdit(pkg)}
                className="flex-1 p-2 text-vr-600 hover:text-vr-700 border border-vr-200 rounded-lg text-sm font-medium transition"
              >
                <FiEdit2 size={14} className="inline mr-1" /> Sửa
              </button>
              <button
                onClick={() => handleDelete(pkg.id)}
                className="flex-1 p-2 text-red-600 hover:text-red-700 border border-red-200 rounded-lg text-sm font-medium transition"
              >
                <FiTrash2 size={14} className="inline mr-1" /> Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={createOpen || editOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditOpen(false);
          setSelectedPackage(null);
        }}
        wide
        icon={<FiBox size={20} />}
        title={
          selectedPackage ? "Chỉnh sửa gói dịch vụ" : "Tạo gói dịch vụ mới"
        }
        subtitle={
          selectedPackage
            ? "Cập nhật thông tin gói dịch vụ"
            : "Tạo gói dịch vụ mới cho nhà xe mua"
        }
        footer={
          <>
            <div
              onClick={() => {
                setCreateOpen(false);
                setEditOpen(false);
                setSelectedPackage(null);
              }}
              className="rounded-lg border border-gray-200 cursor-pointer bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Hủy
            </div>
            <div
              onClick={() => {
                alert(
                  `${selectedPackage ? "Cập nhật" : "Tạo"} gói thành công!`,
                );
                setCreateOpen(false);
                setEditOpen(false);
                setSelectedPackage(null);
              }}
              className="rounded-lg bg-vr-500 cursor-pointer px-4 py-2 text-sm font-bold text-white hover:bg-vr-600"
            >
              {selectedPackage ? "Cập nhật" : "Tạo"} gói
            </div>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                Tên gói <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                defaultValue={selectedPackage?.name || "Gói Basic"}
                placeholder="VD: Gói Professional"
              />
            </div>
            <div>
              <label className={labelClass}>
                Giá gói (₫) <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                type="number"
                defaultValue={selectedPackage?.price || ""}
                placeholder="VD: 1000000"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Mô tả</label>
            <textarea
              className={inputClass + " min-h-[80px]"}
              defaultValue={selectedPackage?.description || ""}
              placeholder="Mô tả chi tiết về gói dịch vụ..."
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                Tối đa số lượng xe <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                type="number"
                defaultValue={selectedPackage?.maxVehicles || ""}
                placeholder="VD: 5"
              />
            </div>
            <div>
              <label className={labelClass}>
                Tối đa tuyến đường <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                type="number"
                defaultValue={selectedPackage?.maxRoutes || ""}
                placeholder="VD: 3"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Thời hạn gói (tháng) <span className="text-red-500">*</span>
            </label>
            <input
              className={inputClass}
              type="number"
              defaultValue={selectedPackage?.duration || "3"}
              placeholder="VD: 3"
            />
          </div>

          <div>
            <label className={labelClass}>
              Tính năng/Ưu đãi (mỗi dòng một tính năng)
            </label>
            <textarea
              className={inputClass + " min-h-[120px]"}
              defaultValue={
                selectedPackage?.features.join("\n") ||
                "Tối đa 5 xe\nTối đa 3 tuyến đường\nHỗ trợ cơ bản"
              }
              placeholder="VD:&#10;Tối đa 5 xe&#10;Tối đa 3 tuyến đường&#10;Hỗ trợ cơ bản"
              rows={5}
            />
          </div>

          <div>
            <p className={labelClass}>Kích hoạt gói</p>
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
                  Gói này có sẵn để nhà xe mua
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Tắt gói nếu bạn không muốn nhà xe mua tại thời điểm này.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Lưu ý:</strong> Khi nhà xe mua gói này, hệ thống sẽ tự
              động tạo một voucher khuyến mãi tương ứng (ví dụ: 100K cho gói
              Basic) mà nhà xe có thể sử dụng cho khách hàng của họ.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
