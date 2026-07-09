import { useMemo, useState } from "react";
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
import Pagination from "../../components/Pagination";
import { policies as mockPolicies, type Policy } from "../../data/mockData";
import CustomSelect from "../../components/CustomSelect";
import { formatDateOnly } from "../../utils/date";
import { DetailItem, DetailSection } from "../../components/DetailLayout";

type PolicyTab = "for_operator" | "for_user";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

function activeBadge(policy: Pick<Policy, "active">, activeLabel: string, inactiveLabel: string) {
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
  const [policies, setPolicies] = useState<Policy[]>(mockPolicies);
  const [activeTab, setActiveTab] = useState<PolicyTab>("for_operator");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;
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
  const paginatedPolicies = useMemo(
    () => currentPolicies.slice((page - 1) * pageSize, page * pageSize),
    [currentPolicies, page],
  );

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-vr-600">System Admin</p>
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
            {operatorPolicies.length}
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
            {userPolicies.length}
          </span>
        </button>
      </div>

      <div className="rounded-xl border border-vr-200 bg-vr-50 px-4 py-3">
        <p className="text-sm text-vr-900">
          {activeTab === "for_operator"
            ? t("policies.operatorInfo")
            : t("policies.userInfo")}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-5 py-3">
                {tc("title")}
              </th>
              <th className="px-5 py-3">
                {t("policies.type")}
              </th>
              <th className="px-5 py-3">
                {t("policies.version")}
              </th>
              <th className="px-5 py-3">
                {t("policies.updatedAt")}
              </th>
              <th className="px-5 py-3">
                {tc("status")}
              </th>
              <th className="px-5 py-3 text-right">
                {tc("actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedPolicies.map((policy) => (
              <tr
                key={policy.id}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
              >
                <td className="px-5 py-4">
                  <div>
                    <p className="font-semibold text-gray-900">{policy.title}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {policy.description}
                    </p>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex rounded-full bg-vr-50 px-2.5 py-1 text-xs font-semibold text-vr-700">
                    {policy.category}
                  </span>
                </td>
                <td className="px-5 py-4 text-gray-600">v{policy.version}</td>
                <td className="px-5 py-4 text-gray-600">
                  {formatDateOnly(policy.updatedAt)}
                </td>
                <td className="px-5 py-4">
                  {activeBadge(policy, tc("active"), tc("inactive"))}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
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
                      onClick={() => handleToggleActive(policy.id)}
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
                      onClick={() => handleDelete(policy.id)}
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
          totalItems={currentPolicies.length}
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
              className="flex-1 rounded-lg bg-vr-500 py-2 font-medium text-white hover:bg-vr-600 transition-colors"
            >
              {selectedPolicy ? tc("update") : tc("create")}
            </button>
          </div>
        </div>
      </Modal>

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
      title={t("policies.detailTitle", {
        defaultValue: "Chi tiết Policy",
      })}
      subtitle={policy?.title}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {tc("close")}
          </button>
          {policy && (
            <button
              type="button"
              onClick={() => onEdit(policy)}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
            >
              {tc("edit")}
            </button>
          )}
        </>
      }
    >
      {policy && (
        <div className="space-y-5">
          <DetailSection title={t("policies.policyInfo", { defaultValue: "Thông tin policy" })} columns="three">
            <DetailItem label={tc("title")} value={policy.title} />
            <DetailItem label={tc("category")} value={policy.category} />
            <DetailItem label={t("policies.version")} value={`v${policy.version}`} />
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

          <DetailSection title={t("policies.summary", { defaultValue: "Tóm tắt" })}>
            <DetailItem label={t("policies.shortDescription")} value={policy.description} />
            <DetailItem label={t("policies.createdBy", { defaultValue: "Người tạo" })} value={policy.createdBy} />
          </DetailSection>

          <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {t("policies.policyContent")}
            </h3>
            <div className="mt-3 whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-700">
              {policy.content || "-"}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
