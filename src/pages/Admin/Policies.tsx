import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiX } from "react-icons/fi";
import Modal from "../../components/Modal";
import { policies as mockPolicies, type Policy } from "../../data/mockData";

type PolicyTab = "for_operator" | "for_user";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("vi-VN");
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

export default function AdminPolicies() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [policies, setPolicies] = useState<Policy[]>(mockPolicies);
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

  const operatorPolicies = useMemo(
    () => policies.filter((p) => p.policyType === "for_operator"),
    [policies],
  );
  const userPolicies = useMemo(
    () => policies.filter((p) => p.policyType === "for_user"),
    [policies],
  );

  const currentPolicies =
    activeTab === "for_operator" ? operatorPolicies : userPolicies;

  const resetForm = () => {
    setFormData({ title: "", description: "", content: "", category: "" });
    setSelectedPolicy(null);
  };

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
    if (confirm(t("policies.confirmDelete"))) {
      setPolicies((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleToggleActive = (id: string) => {
    setPolicies((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              active: !p.active,
              updatedAt: new Date().toISOString().split("T")[0],
            }
          : p,
      ),
    );
  };

  const handleSave = () => {
    const now = new Date().toISOString().split("T")[0];

    if (selectedPolicy) {
      setPolicies((prev) =>
        prev.map((p) =>
          p.id === selectedPolicy.id
            ? {
                ...p,
                ...formData,
                version: p.version + 1,
                updatedAt: now,
              }
            : p,
        ),
      );
    } else {
      const newPolicy: Policy = {
        id: `pol${Date.now()}`,
        ...formData,
        policyType: activeTab,
        version: 1,
        active: true,
        createdBy: "admin",
        createdAt: now,
        updatedAt: now,
      };
      setPolicies((prev) => [...prev, newPolicy]);
    }

    setEditOpen(false);
    setCreateOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("policies.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-600">{t("policies.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          <FiPlus className="text-lg" />
          {t("policies.create")}
        </button>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("for_operator")}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === "for_operator"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          {t("policies.tabOperator")}
          <span className="ml-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
            {operatorPolicies.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("for_user")}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === "for_user"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          {t("policies.tabUser")}
          <span className="ml-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
            {userPolicies.length}
          </span>
        </button>
      </div>

      <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
        <p className="text-sm text-blue-900">
          {activeTab === "for_operator"
            ? t("policies.operatorInfo")
            : t("policies.userInfo")}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-900">
                {tc("title")}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">
                {t("policies.type")}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">
                {t("policies.version")}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">
                {t("policies.updatedAt")}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">
                {tc("status")}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">
                {tc("actions")}
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
                        {tc("active")}
                      </>
                    ) : (
                      <>
                        <FiX className="text-lg" />
                        {tc("inactive")}
                      </>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(policy.id)}
                      title={
                        policy.active
                          ? t("policies.turnOff")
                          : t("policies.turnOn")
                      }
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {policy.active ? (
                        <FiCheck className="text-lg" />
                      ) : (
                        <FiX className="text-lg" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(policy)}
                      title={tc("edit")}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <FiEdit2 className="text-lg" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(policy.id)}
                      title={tc("delete")}
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

      <Modal
        open={createOpen || editOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditOpen(false);
          resetForm();
        }}
        title={
          selectedPolicy
            ? t("policies.editTitle", { title: selectedPolicy.title })
            : t("policies.createTitle")
        }
      >
        <div className="space-y-4">
          <div>
            <label className={labelClass}>
              {t("policies.policyTitle")} *
            </label>
            <input
              type="text"
              placeholder={t("policies.titlePlaceholder")}
              className={inputClass}
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
          </div>

          <div>
            <label className={labelClass}>
              {t("policies.shortDescription")} *
            </label>
            <input
              type="text"
              placeholder={t("policies.descriptionPlaceholder")}
              className={inputClass}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          <div>
            <label className={labelClass}>{t("policies.type")} *</label>
            <select className={inputClass} value={activeTab} disabled>
              <option value="for_operator">{t("policies.forOperator")}</option>
              <option value="for_user">{t("policies.forUser")}</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>{tc("category")} *</label>
            <input
              type="text"
              placeholder={t("policies.categoryPlaceholder")}
              className={inputClass}
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
            />
          </div>

          <div>
            <label className={labelClass}>{t("policies.policyContent")} *</label>
            <textarea
              placeholder={t("policies.contentPlaceholder")}
              className={`${inputClass} resize-none font-mono text-xs`}
              rows={8}
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
            />
            <p className="mt-1 text-xs text-gray-500">
              {t("policies.contentHint")}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setCreateOpen(false);
                setEditOpen(false);
                resetForm();
              }}
              className="flex-1 rounded-lg border border-gray-200 bg-white py-2 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 transition-colors"
            >
              {selectedPolicy ? tc("update") : tc("create")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
