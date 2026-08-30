import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useLatestRequest } from "../../../hooks/useLatestRequest";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlignLeft,
  FiPlus,
  FiEdit2,
  FiTag,
  FiTrash2,
  FiCheck,
  FiX,
  FiFileText,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import { ConfirmModal } from "../../../components/ConfirmModal";
import Pagination from "../../../components/Pagination";
import { formatDateOnly } from "../../../utils/date";
import {
  createOperatorPolicy,
  deleteOperatorPolicy,
  getOperatorPolicies,
  updateOperatorPolicy,
  type PolicyItem,
} from "../../../api/vietride";
import { IconInput } from "../../../components/form/IconInput";
import {
  labelClass,
  textareaClass,
} from "../../../components/form/formClasses";
import { Badge } from "../../../components/ui/Badge";

export default function ManagerPolicies() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const categoryLabel = (category: string) => {
    const key = category.trim().toUpperCase().replace(/[\s-]+/g, "_");
    return t(`policies.categories.${key}`, { defaultValue: category });
  };
  // Giữ tham chiếu t mới nhất để callback tải dữ liệu không refetch khi đổi ngôn ngữ
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PolicyItem | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content: "",
    category: "",
  });
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pageSize = 10;
  const startRequest = useLatestRequest();

  const loadPolicies = useCallback(async () => {
    const isLatest = startRequest();
    setLoading(true);
    setError("");
    try {
      const result = await getOperatorPolicies({ page, pageSize });
      if (!isLatest()) return;
      setPolicies(result.items);
      setTotalItems(result.totalItems);
    } catch (reason) {
      if (!isLatest()) return;
      setPolicies([]);
      setTotalItems(0);
      setError(
        reason instanceof Error
          ? reason.message
          : tRef.current("policies.loadFailed"),
      );
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [page, startRequest]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadPolicies();
    });

    return () => {
      cancelled = true;
    };
  }, [loadPolicies]);

  const paginatedPolicies = policies;

  const resetForm = () => {
    setFormData({ title: "", description: "", content: "", category: "" });
    setSelectedPolicy(null);
  };

  const handleEdit = (policy: PolicyItem) => {
    setSelectedPolicy(policy);
    setFormData({
      title: policy.title,
      description: policy.description,
      content: policy.content,
      category: policy.category,
    });
    setEditOpen(true);
  };

  const handleDelete = async (id: string) => {
    setError("");
    setMessage("");
    try {
      await deleteOperatorPolicy(id);
      setMessage(t("policies.deletedSuccess"));
      await loadPolicies();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("policies.deleteFailed"),
      );
    }
  };

  const handleToggleActive = async (policy: PolicyItem) => {
    setError("");
    setMessage("");
    try {
      await updateOperatorPolicy(policy.id, {
        active: !policy.active,
        version: policy.version,
      });
      setMessage(policy.active ? t("policies.deactivatedSuccess") : t("policies.activatedSuccess"));
      await loadPolicies();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("policies.toggleFailed"),
      );
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const request = {
        ...formData,
        policyType: selectedPolicy?.policyType ?? ("FOR_USER" as const),
        active: selectedPolicy?.active ?? true,
      };
      if (selectedPolicy) {
        await updateOperatorPolicy(selectedPolicy.id, {
          ...request,
          version: selectedPolicy.version,
        });
      } else {
        await createOperatorPolicy(request);
      }
      setMessage(t(selectedPolicy ? "policies.updatedSuccess" : "policies.createdSuccess"));
      setEditOpen(false);
      setCreateOpen(false);
      resetForm();
      await loadPolicies();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("policies.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  useToastFeedback({ message, error });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("policies.title")}
          </h1>
          <p className="mt-1 text-gray-600">{t("policies.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-vr-800 px-4 py-2 font-medium text-white transition hover:bg-vr-900"
        >
          <FiPlus size={16} />
          {t("policies.create")}
        </button>
      </div>

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
              {!loading && paginatedPolicies.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                    {t("policies.empty")}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                    {tc("loading")}
                  </td>
                </tr>
              )}
              {paginatedPolicies.map((policy) => (
                <tr key={policy.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {policy.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        {policy.description}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                      {categoryLabel(policy.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">v{policy.version}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDateOnly(policy.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={policy.active ? "success" : "neutral"} className="gap-1">
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
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(policy)}
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
                        onClick={() => setPendingDelete(policy)}
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
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setPage}
          />
      </div>

      <Modal
        open={createOpen || editOpen}
        wide
        icon={<FiFileText size={20} />}
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
        subtitle={t("policies.subtitle")}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClass}>{t("policies.titleLabel")}</label>
            <IconInput
              icon={<FiFileText size={18} />}
              type="text"
              placeholder={t("policies.titlePlaceholder")}
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>
              {t("policies.shortDescription")}
            </label>
            <IconInput
              icon={<FiAlignLeft size={18} />}
              type="text"
              placeholder={t("policies.shortDescPlaceholder")}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>{t("policies.categoryLabel")}</label>
            <IconInput
              icon={<FiTag size={18} />}
              type="text"
              placeholder={t("policies.categoryPlaceholder")}
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>{t("policies.contentLabel")}</label>
            <textarea
              placeholder={t("policies.contentPlaceholder")}
              className={`${textareaClass} min-h-28 max-h-36 resize-none leading-6`}
              rows={4}
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
            />
            <p className="mt-1 text-xs text-gray-500">
              {t("policies.contentHint")}
            </p>
          </div>

          <div className="md:col-span-2 flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setCreateOpen(false);
                setEditOpen(false);
                resetForm();
              }}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex-1 rounded-xl bg-vr-800 py-2.5 font-semibold text-white shadow-sm transition hover:bg-vr-900 disabled:opacity-60"
            >
              {saving ? t("policies.saving") : selectedPolicy ? tc("update") : tc("create")}
            </button>
          </div>
        </div>
      </Modal>
      <ConfirmModal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) void handleDelete(pendingDelete.id); setPendingDelete(null); }}
        title={tc("delete")}
        message={t("policies.confirmDelete")}
        children={pendingDelete && (          <div className="rounded-2xl border border-red-100 bg-red-50 p-4">            <p className="text-sm font-semibold text-red-900">{pendingDelete.title}</p>            <p className="mt-1 text-sm leading-5 text-red-800/80">{pendingDelete.description}</p>            <span className="mt-3 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-red-700">{categoryLabel(pendingDelete.category)}</span>          </div>        )}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        tone="danger"
      />
    </div>
  );
}



