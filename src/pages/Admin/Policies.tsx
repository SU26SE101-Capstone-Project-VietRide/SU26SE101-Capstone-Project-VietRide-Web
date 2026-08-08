import { useToastFeedback } from "../../hooks/useToastFeedback";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheck,
  FiEdit2,
  FiEye,
  FiFileText,
  FiPlus,
  FiShield,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import Modal from "../../components/Modal";
import { ConfirmModal } from "../../components/ConfirmModal";
import Pagination from "../../components/Pagination";
import CustomSelect from "../../components/CustomSelect";
import { formatDateOnly } from "../../utils/date";
import { DetailItem, DetailSection } from "../../components/DetailLayout";
import {
  createAdminPolicy,
  deleteAdminPolicy,
  getAdminPolicies,
  updateAdminPolicy,
  type PolicyItem,
} from "../../api/vietride";
import { inputClass, labelClass } from "../../components/form/formClasses";

type PolicyTab = "for_operator" | "for_user";
type Policy = Omit<PolicyItem, "policyType" | "createdBy"> & {
  policyType: PolicyTab;
  createdBy: string;
};

function toPolicy(policy: PolicyItem): Policy {
  return {
    ...policy,
    policyType: policy.policyType === "FOR_OPERATOR" ? "for_operator" : "for_user",
    createdBy: policy.createdBy?.displayName ?? policy.createdBy?.email ?? "-",
  };
}

function toPolicyAudience(tab: PolicyTab) {
  return tab === "for_operator" ? ("FOR_OPERATOR" as const) : ("FOR_USER" as const);
}

function activeBadge(
  policy: Pick<Policy, "active">,
  activeLabel: string,
  inactiveLabel: string,
) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
        policy.active
          ? "bg-emerald-50 text-emerald-800"
          : "bg-gray-100 text-gray-700"
      }`}
    >
      {policy.active ? <FiCheck size={14} /> : <FiX size={14} />}
      {policy.active ? activeLabel : inactiveLabel}
    </span>
  );
}

export default function AdminPolicies() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [activeTab, setActiveTab] = useState<PolicyTab>("for_operator");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Policy | null>(null);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [tabCounts, setTabCounts] = useState({ operator: 0, user: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pageSize = 8;
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content: "",
    category: "",
  });

  // tRef để load callback không phụ thuộc `t` (tránh refetch khi đổi ngôn ngữ)
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const audience = toPolicyAudience(activeTab);
      const current = await getAdminPolicies({ page, pageSize, policyType: audience });
      setPolicies(current.items.map(toPolicy));
      setTotalItems(current.totalItems);
    } catch (reason) {
      setPolicies([]);
      setTotalItems(0);
      setError(
        reason instanceof Error
          ? reason.message
          : tRef.current("policies.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [activeTab, page]);

  // Đếm badge tab tách riêng: chỉ chạy lúc mount và sau mutation làm đổi số lượng
  // (create/delete); đổi trang hay update không kéo thêm 2 request đếm.
  const loadTabCounts = useCallback(async () => {
    try {
      const [operatorResult, userResult] = await Promise.all([
        getAdminPolicies({ page: 1, pageSize: 1, policyType: "FOR_OPERATOR" }),
        getAdminPolicies({ page: 1, pageSize: 1, policyType: "FOR_USER" }),
      ]);
      setTabCounts({
        operator: operatorResult.totalItems,
        user: userResult.totalItems,
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : tRef.current("policies.loadFailed"),
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadPolicies();
    });

    return () => {
      cancelled = true;
    };
  }, [loadPolicies]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadTabCounts();
    });

    return () => {
      cancelled = true;
    };
  }, [loadTabCounts]);

  const paginatedPolicies = policies;

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

  const handleViewDetail = (policy: Policy) => {
    setSelectedPolicy(policy);
    setDetailOpen(true);
  };

  const handleDelete = async (id: string) => {
    setError("");
    setMessage("");
    try {
      await deleteAdminPolicy(id);
      // Xoá làm đổi tổng số → refresh cả badge tab
      setMessage(t("policies.deletedSuccess"));
      await Promise.all([loadPolicies(), loadTabCounts()]);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("policies.deleteFailed"),
      );
    }
  };

  const handleToggleActive = async (policy: Policy) => {
    setError("");
    setMessage("");
    try {
      await updateAdminPolicy(policy.id, {
        active: !policy.active,
        version: policy.version,
      });
      setMessage(policy.active ? t("policies.deactivatedSuccess") : t("policies.activatedSuccess"));
      await loadPolicies();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("policies.updateStatusFailed"),
      );
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    const isCreate = !selectedPolicy;
    try {
      const request = {
        ...formData,
        policyType: toPolicyAudience(activeTab),
        active: selectedPolicy?.active ?? true,
      };
      if (selectedPolicy) {
        await updateAdminPolicy(selectedPolicy.id, {
          ...request,
          version: selectedPolicy.version,
        });
      } else {
        await createAdminPolicy(request);
      }
      setMessage(t(isCreate ? "policies.createdSuccess" : "policies.updatedSuccess"));
      setEditOpen(false);
      setCreateOpen(false);
      resetForm();
      // Tạo mới làm đổi tổng số → refresh badge; update thì không
      await Promise.all(
        isCreate ? [loadPolicies(), loadTabCounts()] : [loadPolicies()],
      );
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-vr-600">
            {t("policies.systemAdminBadge")}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">
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
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-vr-600"
        >
          <FiPlus size={16} />
          {t("policies.create")}
        </button>
      </div>

      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-2 shadow-sm sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab("for_operator");
            setPage(1);
          }}
          className={`rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
            activeTab === "for_operator"
              ? "bg-vr-50 text-vr-800 ring-1 ring-vr-200"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          {t("policies.tabOperator")}
          <span className="ml-2 inline-flex rounded-full bg-vr-100 px-2 py-0.5 text-xs text-vr-700">
            {tabCounts.operator}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("for_user");
            setPage(1);
          }}
          className={`rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
            activeTab === "for_user"
              ? "bg-vr-50 text-vr-800 ring-1 ring-vr-200"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          {t("policies.tabUser")}
          <span className="ml-2 inline-flex rounded-full bg-vr-100 px-2 py-0.5 text-xs text-vr-700">
            {tabCounts.user}
          </span>
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3 text-left">{tc("title")}</th>
                <th className="px-5 py-3 text-center">{t("policies.type")}</th>
                <th className="px-5 py-3 text-center">{t("policies.version")}</th>
                <th className="px-5 py-3 text-center">{t("policies.updatedAt")}</th>
                <th className="px-5 py-3 text-center">{tc("status")}</th>
                <th className="px-5 py-3 text-center">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {!loading && paginatedPolicies.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500">
                    {t("policies.empty")}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500">
                    {t("policies.loading")}
                  </td>
                </tr>
              )}
              {paginatedPolicies.map((policy) => (
                <tr
                  key={policy.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-5 py-4 text-left">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {policy.title}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {policy.description}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex rounded-full bg-vr-50 px-2.5 py-1 text-xs font-semibold text-vr-700">
                      {policy.category}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center text-gray-600">v{policy.version}</td>
                  <td className="px-5 py-4 text-center text-gray-600">
                    {formatDateOnly(policy.updatedAt)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-center">
                    {activeBadge(policy, tc("active"), tc("inactive"))}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewDetail(policy)}
                        title={tc("details")}
                        aria-label={tc("details")}
                        className="table-action-button"
                      >
                        <FiEye size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(policy)}
                        title={
                          policy.active
                            ? t("policies.turnOff")
                            : t("policies.turnOn")
                        }
                        aria-label={
                          policy.active
                            ? t("policies.turnOff")
                            : t("policies.turnOn")
                        }
                        className="table-action-button"
                      >
                        {policy.active ? (
                          <FiCheck size={16} />
                        ) : (
                          <FiX size={16} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(policy)}
                        title={tc("edit")}
                        aria-label={tc("edit")}
                        className="table-action-button"
                      >
                        <FiEdit2 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(policy)}
                        title={tc("delete")}
                        aria-label={tc("delete")}
                        className="table-action-button"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
        />
      </div>

      <Modal
        open={createOpen || editOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditOpen(false);
          resetForm();
        }}
        wide
        icon={<FiFileText size={20} />}
        title={
          selectedPolicy
            ? t("policies.editTitle", { title: selectedPolicy.title })
            : t("policies.createTitle")
        }
      >
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t("policies.policyTitle")} *</label>
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
            <CustomSelect className={inputClass} value={activeTab} disabled>
              <option value="for_operator">{t("policies.forOperator")}</option>
              <option value="for_user">{t("policies.forUser")}</option>
            </CustomSelect>
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
            <label className={labelClass}>
              {t("policies.policyContent")} *
            </label>
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
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex-1 rounded-lg bg-vr-500 py-2 font-medium text-white hover:bg-vr-600 transition-colors"
            >
              {saving
                ? t("policies.saving")
                : selectedPolicy
                  ? tc("update")
                  : tc("create")}
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
        children={pendingDelete && (          <div className="rounded-2xl border border-red-100 bg-red-50 p-4">            <p className="text-sm font-semibold text-red-900">{pendingDelete.title}</p>            <p className="mt-1 text-sm leading-5 text-red-800/80">{pendingDelete.description}</p>            <div className="mt-3 flex flex-wrap gap-2">              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-red-700">{pendingDelete.category}</span>              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{pendingDelete.policyType === "for_operator" ? t("policies.forOperator") : t("policies.forUser")}</span>            </div>          </div>        )}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        tone="danger"
      />

      <PolicyDetailModal
        policy={selectedPolicy}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onEdit={(policy) => {
          setDetailOpen(false);
          handleEdit(policy);
        }}
      />
    </div>
  );
}

function PolicyDetailModal({
  policy,
  open,
  onClose,
  onEdit,
}: {
  policy: Policy | null;
  open: boolean;
  onClose: () => void;
  onEdit: (policy: Policy) => void;
}) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiShield size={20} />}
      title={t("policies.detailTitle")}
      subtitle={policy?.title}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
          >
            {tc("close")}
          </button>
          {policy && (
            <button
              type="button"
              onClick={() => onEdit(policy)}
              className="rounded-xl bg-vr-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-vr-600"
            >
              {tc("edit")}
            </button>
          )}
        </>
      }
    >
      {policy && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-vr-100 bg-gradient-to-r from-vr-50 to-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-vr-100 px-3 py-1 text-xs font-semibold text-vr-800">{policy.policyType === "for_operator" ? t("policies.forOperator") : t("policies.forUser")}</span>
              {activeBadge(policy, tc("active"), tc("inactive"))}
            </div>
            <p className="mt-3 text-lg font-bold text-gray-900">{policy.title}</p>
            <p className="mt-1 text-sm leading-6 text-gray-600">{policy.description}</p>
          </div>
          <DetailSection
            title={t("policies.policyInfo")}
            columns="three"
          >
            <DetailItem label={tc("title")} value={policy.title} />
            <DetailItem label={tc("category")} value={policy.category} />
            <DetailItem
              label={t("policies.version")}
              value={`v${policy.version}`}
            />
            <DetailItem
              label={t("policies.updatedAt")}
              value={formatDateOnly(policy.updatedAt)}
            />
            <DetailItem
              label={t("policies.type")}
              value={
                policy.policyType === "for_operator"
                  ? t("policies.forOperator")
                  : t("policies.forUser")
              }
            />
            <DetailItem
              label={tc("status")}
              value={activeBadge(policy, tc("active"), tc("inactive"))}
            />
          </DetailSection>

          <DetailSection
            title={t("policies.summary")}
          >
            <DetailItem
              label={t("policies.shortDescription")}
              value={policy.description}
            />
            <DetailItem
              label={t("policies.createdBy")}
              value={policy.createdBy}
            />
          </DetailSection>

          <section className="rounded-2xl border border-gray-200 bg-slate-50/80 p-5">
            <h3 className="text-sm font-semibold text-gray-900">
              {t("policies.policyContent")}
            </h3>
            <div className="mt-3 max-h-[42vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-gray-200 bg-white p-5 text-[15px] leading-8 text-slate-700 shadow-sm">
              {policy.content || "-"}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}




