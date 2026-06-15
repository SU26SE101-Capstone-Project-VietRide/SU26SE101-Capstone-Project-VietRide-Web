import { useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiX } from "react-icons/fi";
import Modal from "../../components/Modal";
import { policies as mockPolicies } from "../../data/mockData";

type Policy = any;
type PolicyTab = "for_operator" | "for_user";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("vi-VN");
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

export default function AdminPolicies() {
  const [activeTab, setActiveTab] = useState<PolicyTab>("for_operator");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content: "",
    category: "",
  });

  // Filter policies by type
  const operatorPolicies = mockPolicies.filter(
    (p) => p.policyType === "for_operator",
  );
  const userPolicies = mockPolicies.filter((p) => p.policyType === "for_user");

  const currentPolicies =
    activeTab === "for_operator" ? operatorPolicies : userPolicies;

  const handleEdit = (policy: Policy) => {
    setSelectedPolicy(policy);
    setFormData({
      title: policy.title,
      description: policy.description,
      content: policy.content,
      category: policy.category,
    });
    setEditOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa policy này?")) {
      alert(`Xóa policy ${id} thành công!`);
    }
  };

  const handleToggleActive = (id: string) => {
    alert(`Cập nhật trạng thái policy ${id} thành công!`);
  };

  const handleSave = () => {
    if (selectedPolicy) {
      alert(`Cập nhật policy "${formData.title}" thành công!`);
    } else {
      alert(`Tạo policy "${formData.title}" thành công!`);
    }
    setEditOpen(false);
    setCreateOpen(false);
    setSelectedPolicy(null);
    setFormData({ title: "", description: "", content: "", category: "" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Policy</h1>
          <p className="mt-1 text-sm text-gray-600">
            Quản lý các chính sách và điều khoản dịch vụ cho nhà xe và người
            dùng.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedPolicy(null);
            setFormData({
              title: "",
              description: "",
              content: "",
              category: "",
            });
            setCreateOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          <FiPlus className="text-lg" />
          Tạo policy mới
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("for_operator")}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === "for_operator"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Policy cho nhà xe
          <span className="ml-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
            {operatorPolicies.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("for_user")}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === "for_user"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Policy cho người dùng
          <span className="ml-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
            {userPolicies.length}
          </span>
        </button>
      </div>

      {/* Content description */}
      <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
        <p className="text-sm text-blue-900">
          {activeTab === "for_operator"
            ? "Các chính sách này áp dụng cho các nhà xe (operators) trên nền tảng. Bao gồm điều khoản dịch vụ, chính sách hủy, v.v."
            : "Các chính sách này áp dụng cho người dùng (users) trên nền tảng. Bao gồm chính sách bảo mật, hướng dẫn an toàn, v.v."}
        </p>
      </div>

      {/* Policies Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-900">
                Tiêu đề
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">
                Loại
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">
                Phiên bản
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">
                Ngày cập nhật
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">
                Trạng thái
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentPolicies.map((policy) => (
              <tr key={policy.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{policy.title}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {policy.description}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                    {policy.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">v{policy.version}</td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDate(policy.updatedAt)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                      policy.active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {policy.active ? (
                      <>
                        <FiCheck className="text-lg" />
                        Hoạt động
                      </>
                    ) : (
                      <>
                        <FiX className="text-lg" />
                        Tắt
                      </>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(policy.id)}
                      title={policy.active ? "Tắt" : "Bật"}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {policy.active ? (
                        <FiCheck className="text-lg" />
                      ) : (
                        <FiX className="text-lg" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(policy)}
                      title="Chỉnh sửa"
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <FiEdit2 className="text-lg" />
                    </button>
                    <button
                      onClick={() => handleDelete(policy.id)}
                      title="Xóa"
                      className="p-2 text-gray-600 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors"
                    >
                      <FiTrash2 className="text-lg" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={createOpen || editOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditOpen(false);
          setSelectedPolicy(null);
        }}
        title={
          selectedPolicy
            ? `Chỉnh sửa Policy: ${selectedPolicy.title}`
            : "Tạo Policy mới"
        }
      >
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Tiêu đề Policy *</label>
            <input
              type="text"
              placeholder="VD: Terms of Service"
              className={inputClass}
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
          </div>

          <div>
            <label className={labelClass}>Mô tả ngắn *</label>
            <input
              type="text"
              placeholder="VD: General terms and conditions"
              className={inputClass}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          <div>
            <label className={labelClass}>Loại *</label>
            <select className={inputClass} value={activeTab} disabled>
              <option value="for_operator">Cho nhà xe</option>
              <option value="for_user">Cho người dùng</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Danh mục *</label>
            <input
              type="text"
              placeholder="VD: Terms, Cancellation, Privacy, Safety"
              className={inputClass}
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
            />
          </div>

          <div>
            <label className={labelClass}>Nội dung Policy *</label>
            <textarea
              placeholder="Nhập nội dung policy..."
              className={`${inputClass} resize-none font-mono text-xs`}
              rows={8}
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
            />
            <p className="mt-1 text-xs text-gray-500">
              Bạn có thể sử dụng dòng mới để tách các điểm (1. Point 1\n2. Point
              2)
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setCreateOpen(false);
                setEditOpen(false);
                setSelectedPolicy(null);
              }}
              className="flex-1 rounded-lg border border-gray-200 bg-white py-2 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              className="flex-1 rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 transition-colors"
            >
              {selectedPolicy ? "Cập nhật" : "Tạo mới"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
