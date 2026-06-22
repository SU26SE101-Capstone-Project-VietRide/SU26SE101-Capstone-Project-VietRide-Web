import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiDownload, FiFilter, FiList, FiPlus, FiSearch, FiUser } from "react-icons/fi";
import Modal from "../../../components/Modal";
import {
  createOperatorUser,
  getOperatorUsers,
  resendInitialPassword,
  type AdminUserRole,
  type CreateOperatorUserRequest,
  type OperatorUser,
} from "../../../api/vietride";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

const emptyUserForm: CreateOperatorUserRequest = {
  email: "",
  displayName: "",
  role: "OPERATOR_STAFF",
};

function isActiveStatus(status: string) {
  return ["ACTIVE", "APPROVED", "active"].includes(status);
}

export default function StaffPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [search, setSearch] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [users, setUsers] = useState<OperatorUser[]>([]);
  const [userForm, setUserForm] =
    useState<CreateOperatorUserRequest>(emptyUserForm);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setIsLoading(true);
      setError("");

      try {
        const result = await getOperatorUsers({
          page: 1,
          pageSize: 20,
          search,
        });

        if (!cancelled) {
          setUsers(result.items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load staff");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, [search]);

  const filtered = useMemo(
    () =>
      users.filter(
        (user) =>
          user.displayName.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase()),
      ),
    [search, users],
  );

  function roleLabel(role: AdminUserRole) {
    const labels: Record<string, string> = {
      DRIVER: t("staff.driver"),
      ASSISTANT: t("staff.dispatcher"),
      OPERATOR_STAFF: t("staff.seller"),
      OPERATOR_ADMIN: t("staff.manager"),
      manager: t("staff.manager"),
      operator: t("staff.seller"),
    };

    return labels[role] ?? role;
  }

  async function reloadUsers() {
    const result = await getOperatorUsers({
      page: 1,
      pageSize: 20,
      search,
    });
    setUsers(result.items);
  }

  async function handleCreateUser() {
    await createOperatorUser(userForm);
    await reloadUsers();
    setUserForm(emptyUserForm);
    setOpenAdd(false);
  }

  async function handleResendInitialPassword(userId: string) {
    await resendInitialPassword(userId);
    alert("Initial password email resent.");
  }

  function updateUserForm(key: keyof CreateOperatorUserRequest, value: string) {
    setUserForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("staff.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            {t("staff.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpenAdd(true)}
          className="px-4 py-2 bg-vr-500 cursor-pointer hover:bg-vr-600 text-slate-50 font-bold rounded-lg transition flex items-center gap-2"
        >
          <FiPlus size={18} />
          {t("staff.add")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500">{t("staff.total")}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {users.length}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
              <FiUser size={20} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">{t("staff.onDuty")}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {users.filter((user) => isActiveStatus(user.status)).length}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">{t("staff.drivers")}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {users.filter((user) => user.role === "DRIVER").length}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">{t("staff.needsAction")}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {users.filter((user) => !isActiveStatus(user.status)).length}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className={inputClass + " pl-10"}
              placeholder={t("staff.searchPlaceholder")}
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
              {tc("filter")}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FiList size={16} />
              {tc("columns")}
            </button>
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:ml-0"
            >
              <FiDownload size={16} />
              {tc("exportCsv")}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">{t("staff.fullName")}</th>
                <th className="px-5 py-3">{tc("email")}</th>
                <th className="px-5 py-3">{t("staff.role")}</th>
                <th className="px-5 py-3">{tc("status")}</th>
                <th className="px-5 py-3">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr
                  key={user.userId}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vr-100 text-vr-700">
                        <FiUser size={16} />
                      </div>
                      <span className="font-semibold text-gray-900">
                        {user.displayName}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {user.email}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    {roleLabel(user.role)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isActiveStatus(user.status)
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm">
                    <button
                      type="button"
                      onClick={() => handleResendInitialPassword(user.userId)}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Resend password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isLoading && (
          <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-500">
            Loading staff...
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            {tc("showingItems", { count: filtered.length, total: users.length })}
          </p>
        </div>
      </div>

      <Modal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        wide
        icon={<FiUser size={20} />}
        title={t("staff.addTitle")}
        subtitle={t("staff.addSubtitle")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenAdd(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={handleCreateUser}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600 hover:text-slate-900"
            >
              {t("staff.createProfile")}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              {t("staff.personalInfo")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  {t("staff.fullNameLabel")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  value={userForm.displayName}
                  onChange={(e) => updateUserForm("displayName", e.target.value)}
                  placeholder="Nguyen Van A"
                />
              </div>
              <div>
                <label className={labelClass}>
                  {tc("email")} <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  type="email"
                  value={userForm.email}
                  onChange={(e) => updateUserForm("email", e.target.value)}
                  placeholder="staff@operator.vn"
                />
              </div>
              <div>
                <label className={labelClass}>
                  {t("staff.role")} <span className="text-red-500">*</span>
                </label>
                <select
                  className={inputClass}
                  value={userForm.role}
                  onChange={(e) => updateUserForm("role", e.target.value)}
                >
                  <option value="OPERATOR_STAFF">{t("staff.seller")}</option>
                  <option value="DRIVER">{t("staff.driver")}</option>
                  <option value="ASSISTANT">{t("staff.dispatcher")}</option>
                  <option value="OPERATOR_ADMIN">{t("staff.manager")}</option>
                </select>
              </div>
            </div>
          </section>
        </div>
      </Modal>
    </div>
  );
}
