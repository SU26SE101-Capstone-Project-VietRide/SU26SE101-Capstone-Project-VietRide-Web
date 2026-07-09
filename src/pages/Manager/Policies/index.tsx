import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiX, FiFileText } from "react-icons/fi";
import Modal from "../../../components/Modal";
import {
  operatorPolicies as mockOperatorPolicies,
  type OperatorPolicy,
} from "../../../data/mockData";
import { formatDateOnly } from "../../../utils/date";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

const CURRENT_OPERATOR_ID = "op1";

export default function ManagerPolicies() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [policies, setPolicies] = useState<OperatorPolicy[]>(
    mockOperatorPolicies.filter((p) => p.operatorId === CURRENT_OPERATOR_ID),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<OperatorPolicy | null>(
    null,
  );
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content: "",
    category: "",
  });

  const sortedPolicies = useMemo(
    () =>
      [...policies].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [policies],
  );

  const resetForm = () => {
    setFormData({ title: "", description: "", content: "", category: "" });
    setSelectedPolicy(null);
  };

  const handleEdit = (policy: OperatorPolicy) => {
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
      const newPolicy: OperatorPolicy = {
        id: `oppol${Date.now()}`,
        ...formData,
        operatorId: CURRENT_OPERATOR_ID,
        version: 1,
        active: true,
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
          <h1 className="text-3xl font-bold text-gray-900">{t("policies.title")}</h1>
          <p className="mt-1 text-gray-600">{t("policies.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 font-medium text-white transition hover:bg-vr-600"
        >
          <FiPlus size={16} />
          {t("policies.create")}
        </button>
      </div>

      <div className="rounded-lg border border-vr-200 bg-vr-50 p-4">
        <p className="text-sm text-vr-900">{t("policies.info")}</p>
      </div>

      {sortedPolicies.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 py-12 text-center">
          <FiFileText size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">{t("policies.empty")}</p>
          <p className="mt-1 text-sm text-gray-500">{t("policies.emptyHint")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  {tc("title")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  {tc("category")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  {tc("version")}
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
              {sortedPolicies.map((policy) => (
                <tr key={policy.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{policy.title}</p>
                      <p className="mt-1 text-xs text-gray-600">
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
                    {formatDateOnly(policy.updatedAt)}
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
                          {tc("off")}
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(policy.id)}
                        title={policy.active ? tc("off") : tc("on")}
                        aria-label={policy.active ? tc("off") : tc("on")}
                        className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"
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
                        aria-label={tc("edit")}
                        className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"
                      >
                        <FiEdit2 className="text-lg" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(policy.id)}
                        title={tc("delete")}
                        aria-label={tc("delete")}
                        className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-red-100 hover:text-red-600"
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
      )}

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
            <label className={labelClass}>{t("policies.titleLabel")}</label>
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
            <label className={labelClass}>{t("policies.shortDescription")}</label>
            <input
              type="text"
              placeholder={t("policies.shortDescPlaceholder")}
              className={inputClass}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          <div>
            <label className={labelClass}>{t("policies.categoryLabel")}</label>
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
            <label className={labelClass}>{t("policies.contentLabel")}</label>
            <textarea
              placeholder={t("policies.contentPlaceholder")}
              className={`${inputClass} resize-none font-mono text-xs`}
              rows={8}
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
            />
            <p className="mt-1 text-xs text-gray-500">{t("policies.contentHint")}</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setCreateOpen(false);
                setEditOpen(false);
                resetForm();
              }}
              className="flex-1 rounded-lg border border-gray-200 bg-white py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 rounded-lg bg-vr-500 py-2 font-medium text-white transition-colors hover:bg-vr-600"
            >
              {selectedPolicy ? tc("update") : tc("create")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
