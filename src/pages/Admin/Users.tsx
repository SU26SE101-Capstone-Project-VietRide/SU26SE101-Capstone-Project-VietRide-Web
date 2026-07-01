import { FiPlus, FiSearch, FiFilter } from "react-icons/fi";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import {
  getAdminOperatorUsers,
  createAdminUser,
  type AdminUser,
  type AdminUserRole,
  type CreateAdminUserRequest,
} from "../../api/vietride";

function formatUserId(userId: string, idx: number) {
  return userId || `U-${10020 + idx}`;
}

function isActiveStatus(status: string) {
  return ["ACTIVE", "APPROVED", "active"].includes(status);
}

const emptyUserForm: CreateAdminUserRequest = {
  email: "",
  displayName: "",
  role: "OPERATOR_ADMIN",
};

export default function Users() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [userForm, setUserForm] =
    useState<CreateAdminUserRequest>(emptyUserForm);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setIsLoading(true);
      setError("");

      try {
        const result = await getAdminOperatorUsers({
          page: 1,
          pageSize: 20,
          search: searchTerm,
        });

        if (!cancelled) {
          setUsers(result.items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load users");
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
  }, [searchTerm]);

  const filtered = useMemo(
    () =>
      users.filter(
        (u) =>
          u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [searchTerm, users],
  );

  const roleLabel = (role: AdminUserRole) => {
    const map: Record<string, string> = {
      PASSENGER: t("users.customer"),
      OPERATOR_ADMIN: t("users.manager"),
      OPERATOR_STAFF: t("users.operator"),
      SYSTEM_ADMIN: t("users.admin"),
      customer: t("users.customer"),
      manager: t("users.manager"),
      operator: t("users.operator"),
      admin: t("users.admin"),
    };
    return map[role] ?? role;
  };

  const reloadUsers = async () => {
    const result = await getAdminOperatorUsers({
      page: 1,
      pageSize: 20,
      search: searchTerm,
    });
    setUsers(result.items);
  };

  const handleCreateUser = async () => {
    await createAdminUser(userForm);
    await reloadUsers();
    setUserForm(emptyUserForm);
    setOpenCreate(false);
  };

  const updateUserForm = (key: keyof CreateAdminUserRequest, value: string) => {
    setUserForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("users.title")}
          </h1>
          <p className="text-gray-600 mt-1">{t("users.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpenCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-vr-600"
        >
          <FiPlus size={16} />
          {t("users.createUser")}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t("users.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-100 rounded-lg focus:outline-none text-sm bg-gray-50"
            />
          </div>

          <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 flex items-center gap-2">
            <FiFilter /> {tc("filter")}
          </button>

          <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700">
            {tc("columns")}
          </button>

          <div className="ml-auto">
            <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700">
              {tc("exportCsv")}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {t("users.userId")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {t("users.fullName")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {tc("email")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {t("users.role")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {t("users.joined")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {tc("status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, idx) => (
                <tr
                  key={u.userId}
                  className="border-b border-gray-100 hover:bg-gray-50 transition"
                >
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {formatUserId(u.userId, idx + 1)}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {u.displayName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {u.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {roleLabel(u.role)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {u.createdAt ?? "--"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {isActiveStatus(u.status) ? (
                      <span className="px-3 py-1 bg-vr-100 text-vr-900 rounded-full text-xs">
                        {tc("active")}
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                        {u.status || t("users.locked")}
                      </span>
                    )}
                    <div className="mt-2">
                      <button
                        onClick={() => setSelected(u)}
                        className="text-sm text-vr-600 hover:underline"
                      >
                        {tc("details")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isLoading && (
          <div className="mt-4 text-sm text-gray-500">
            {t("users.loading")}
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          {tc("showingItems", { count: filtered.length, total: users.length })}
        </div>
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.displayName ?? tc("details")}
        subtitle={selected?.email}
      >
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-600 mb-1">{t("users.role")}</p>
              <p className="font-medium text-gray-900">
                {roleLabel(selected.role)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">{tc("status")}</p>
              <p className="font-medium text-gray-900">{selected.status}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">
                {t("users.operatorId")}
              </p>
              <p className="font-medium text-gray-900">
                {selected.operatorId ?? "--"}
              </p>
            </div>
          </div>
        )}
        <div />
      </Modal>

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title={t("users.createAdminUser")}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenCreate(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={handleCreateUser}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
            >
              {tc("create")}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              {tc("name")}
            </label>
            <input
              value={userForm.displayName}
              onChange={(e) => updateUserForm("displayName", e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="Operator manager"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              {tc("email")}
            </label>
            <input
              value={userForm.email}
              onChange={(e) => updateUserForm("email", e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="manager@operator.vn"
              type="email"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              {t("users.role")}
            </label>
            <select
              value={userForm.role}
              onChange={(e) => updateUserForm("role", e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="OPERATOR_ADMIN">{t("users.operatorAdmin")}</option>
              <option value="OPERATOR_STAFF">{t("users.operatorStaff")}</option>
              <option value="DRIVER">{t("users.driver")}</option>
              <option value="ASSISTANT">{t("users.assistant")}</option>
              <option value="SYSTEM_ADMIN">{t("users.systemAdmin")}</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
