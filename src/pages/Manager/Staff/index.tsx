import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiDownload,
  FiEye,
  FiMail,
  FiPlus,
  FiSearch,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import { DetailItem } from "../../../components/DetailLayout";
import {
  createOperatorUser,
  getOperatorUsers,
  resendInitialPassword,
  type AdminUserRole,
  type CreateOperatorUserRequest,
  type OperatorUser,
} from "../../../api/vietride";
import { formatDateTime } from "../../../utils/date";
import {
  formatVietnamPhoneForDisplay,
  normalizeVietnamPhoneForApi,
} from "../../../utils/phone";
import CustomSelect from "../../../components/CustomSelect";
import Pagination from "../../../components/Pagination";
import { downloadCsv } from "../../../utils/csv";
import { labelClass } from "../../../components/form/formClasses";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const staffAvatarUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='32' fill='%23ecfeff'/%3E%3Ccircle cx='64' cy='48' r='22' fill='%2314b8a6'/%3E%3Cpath d='M28 106c5-24 19-36 36-36s31 12 36 36' fill='%230f766e'/%3E%3C/svg%3E";

const emptyUserForm: CreateOperatorUserRequest = {
  email: "",
  displayName: "",
  phone: "",
  role: "OPERATOR_STAFF",
};

// Label/description là key i18n namespace manager, dịch tại nơi render
const staffGroups = [
  { key: "ALL", labelKey: "staff.groupAll" },
  { key: "FIELD", labelKey: "staff.groupField" },
  { key: "OPS", labelKey: "staff.groupOps" },
] as const;

const roleOptions: Array<{
  value: AdminUserRole;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "OPERATOR_STAFF",
    labelKey: "staff.operatorStaff",
    descriptionKey: "staff.roleDescOperatorStaff",
  },
  {
    value: "DRIVER",
    labelKey: "staff.driver",
    descriptionKey: "staff.roleDescDriver",
  },
  {
    value: "ASSISTANT",
    labelKey: "staff.assistant",
    descriptionKey: "staff.roleDescAssistant",
  },
];

function isActiveStatus(status: string) {
  return ["ACTIVE", "APPROVED", "active"].includes(status);
}

function getUserId(user: Pick<OperatorUser, "userId"> & { id?: string }) {
  return user.userId || user.id || "";
}

function isFieldRole(role: AdminUserRole) {
  return role === "DRIVER" || role === "ASSISTANT";
}

function isOpsRole(role: AdminUserRole) {
  return role === "OPERATOR_ADMIN" || role === "OPERATOR_STAFF";
}

export default function StaffPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  // Giữ tham chiếu t mới nhất để callback tải dữ liệu không refetch khi đổi ngôn ngữ
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeGroup, setActiveGroup] =
    useState<(typeof staffGroups)[number]["key"]>("ALL");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [users, setUsers] = useState<OperatorUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<OperatorUser | null>(null);
  const [userForm, setUserForm] =
    useState<CreateOperatorUserRequest>(emptyUserForm);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 8;

  // Debounce ô tìm kiếm để tránh mỗi ký tự bắn một request (pattern giống Bookings)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  // Hàm tải danh sách nhân sự dùng chung cho effect và sau khi tạo tài khoản.
  // Request chỉ phụ thuộc search (page/pageSize hardcode) — filter role/status lọc client.
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getOperatorUsers({
        page: 1,
        pageSize: 20,
        search: debouncedSearch,
      });

      setUsers(result.items);
      setTotalItems(result.totalItems);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tRef.current("staff.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    async function run() {
      await loadUsers();
    }

    void run();
  }, [loadUsers]);

  const filtered = useMemo(
    () =>
      users.filter((user) => {
        const matchesSearch =
          user.displayName.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase());
        const matchesGroup =
          activeGroup === "ALL" ||
          (activeGroup === "FIELD" && isFieldRole(user.role)) ||
          (activeGroup === "OPS" && isOpsRole(user.role));
        const matchesRole = !roleFilter || user.role === roleFilter;
        const matchesStatus = !statusFilter || user.status === statusFilter;

        return matchesSearch && matchesGroup && matchesRole && matchesStatus;
      }),
    [activeGroup, roleFilter, search, statusFilter, users],
  );


  function handleExportCsv() {
    downloadCsv(
      "staff.csv",
      [tc("name"), tc("email"), tc("phone"), t("staff.role"), tc("status")],
      filtered.map((user) => [
        user.displayName,
        user.email,
        user.phone,
        roleLabel(user.role),
        user.status,
      ]),
    );
  }
  function roleLabel(role: AdminUserRole) {
    const roleOption = roleOptions.find((option) => option.value === role);

    if (roleOption) {
      return t(roleOption.labelKey);
    }

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

  function roleDescription(role: AdminUserRole) {
    const descriptionKey = roleOptions.find(
      (option) => option.value === role,
    )?.descriptionKey;

    return descriptionKey ? t(descriptionKey) : "";
  }

  async function handleCreateUser() {
    setError("");
    setMessage("");
    try {
      await createOperatorUser({
        ...userForm,
        phone: normalizeVietnamPhoneForApi(userForm.phone),
      });
      await loadUsers();
      setUserForm(emptyUserForm);
      setOpenAdd(false);
      setMessage(t("staff.createInitialPasswordSuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("staff.createUserFailed"));
    }
  }

  async function handleResendInitialPassword(user: OperatorUser) {
    const userId = getUserId(user);

    if (!userId) {
      setError(t("staff.missingUserForResend"));
      return;
    }

    setError("");
    setMessage("");
    try {
      await resendInitialPassword(userId);
      setMessage(t("staff.resendInitialPasswordSuccess", { email: user.email }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("staff.resendInitialPasswordFailed"),
      );
    }
  }

  function handleOpenDetail(user: OperatorUser) {
    const userId = getUserId(user);

    if (!userId) {
      setError(t("staff.missingUserForDetail"));
      return;
    }

    setOpenDetail(true);
    setSelectedUser(user);
    setError("");
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
            {t("staff.pageSubtitle")}
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

      <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-3">
          {staffGroups.map((group) => (
            <button
              key={group.key}
              type="button"
              onClick={() => {
                setActiveGroup(group.key);
                setPage(1);
              }}
              className={`rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
                activeGroup === group.key
                  ? "bg-vr-50 text-vr-800 ring-1 ring-vr-200"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t(group.labelKey)}
            </button>
          ))}
        </div>
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
              <FiUsers size={20} />
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
          <p className="text-sm text-gray-500">
            {t("staff.needsInitialPassword")}
          </p>
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
            <CustomSelect
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("staff.allRoles")}</option>
              {roleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {t(role.labelKey)}
                </option>
              ))}
            </CustomSelect>
            <CustomSelect
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("staff.allStatuses")}</option>
              {[
                ...new Set(users.map((user) => user.status).filter(Boolean)),
              ].map((status) => (
                <option key={status} value={status}>
                  {tc(`enumLabels.${status}`, { defaultValue: status })}
                </option>
              ))}
            </CustomSelect>
            <button
              type="button"
              onClick={handleExportCsv}
              className="ml-auto inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:ml-0"
            >
              <FiDownload size={16} />
              {tc("exportCsv")}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold text-gray-700">
                <th className="px-6 py-3">{t("staff.fullName")}</th>
                <th className="px-6 py-3">{tc("email")}</th>
                <th className="px-6 py-3">{tc("phone")}</th>
                <th className="px-6 py-3">{t("staff.role")}</th>
                <th className="px-6 py-3">{t("staff.joined")}</th>
                <th className="px-6 py-3">{tc("status")}</th>
                <th className="px-6 py-3 text-center">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr
                  key={user.userId}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatarUrl || staffAvatarUrl}
                        alt={user.displayName || user.email}
                        width={40}
                        height={40}
                        loading="lazy"
                        className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 bg-white object-cover"
                      />
                      <span className="text-sm font-semibold text-gray-900">
                        {user.displayName || "-"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatVietnamPhoneForDisplay(user.phone)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {roleLabel(user.role)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDateTime(user.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isActiveStatus(user.status)
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {tc(`enumLabels.${user.status}`, { defaultValue: user.status })}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(user)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700"
                        title={t("staff.viewDetail")}
                        aria-label={t("staff.viewDetail")}
                      >
                        <FiEye size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResendInitialPassword(user)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        title={t("staff.resendInitialPassword")}
                        aria-label={t("staff.resendInitialPassword")}
                      >
                        <FiMail size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isLoading && (
          <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-500">
            {t("staff.loading")}
          </div>
        )}

        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
        />
      </div>

      <Modal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        wide
        icon={<FiUser size={20} />}
        title={t("staff.addTitle")}
        subtitle={t("staff.addInitialPasswordSubtitle")}
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
              {t("staff.staffInfoSection")}
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
                  onChange={(e) =>
                    updateUserForm("displayName", e.target.value)
                  }
                  placeholder={t("staff.fullNamePlaceholder")}
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
                  {tc("phone")} <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  type="tel"
                  value={userForm.phone}
                  onChange={(e) => updateUserForm("phone", e.target.value)}
                  placeholder="+84901234567"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t("staff.phoneInputHint")}
                </p>
              </div>
              <div>
                <label className={labelClass}>
                  {t("staff.role")} <span className="text-red-500">*</span>
                </label>
                <CustomSelect
                  className={inputClass}
                  value={userForm.role}
                  onChange={(e) => updateUserForm("role", e.target.value)}
                >
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {t(role.labelKey)}
                    </option>
                  ))}
                </CustomSelect>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-bold text-gray-900">
              {t("staff.rolePermissions")}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {roleOptions.map((role) => (
                <div
                  key={role.value}
                  className={`rounded-lg border bg-white p-3 ${
                    userForm.role === role.value
                      ? "border-vr-300 ring-1 ring-vr-200"
                      : "border-gray-200"
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {t(role.labelKey)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {t(role.descriptionKey)}
                  </p>
                  <p className="mt-2 font-mono text-xs text-gray-400">
                    {role.value}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </Modal>

      <StaffDetailModal
        open={openDetail}
        user={selectedUser}
        roleLabel={roleLabel}
        roleDescription={roleDescription}
        onClose={() => setOpenDetail(false)}
      />
    </div>
  );
}

function StaffDetailModal({
  open,
  user,
  roleLabel,
  roleDescription,
  onClose,
}: {
  open: boolean;
  user: OperatorUser | null;
  roleLabel: (role: AdminUserRole) => string;
  roleDescription: (role: AdminUserRole) => string;
  onClose: () => void;
}) {
  const { t: tc } = useTranslation("common");
  const { t } = useTranslation("manager");

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiUser size={20} />}
      title={t("staff.detailModalTitle")}
      subtitle={t("staff.detailModalSubtitle")}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tc("close")}
        </button>
      }
    >
      {user && (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center">
            <img
              src={user.avatarUrl || staffAvatarUrl}
              alt={user.displayName || user.email}
              width={72}
              height={72}
              loading="lazy"
              className="h-[72px] w-[72px] rounded-2xl border border-white bg-white object-cover shadow-sm"
            />
            <div className="min-w-0">
              <p className="text-lg font-bold text-gray-900">
                {user.displayName || "-"}
              </p>
              <p className="mt-1 break-words text-sm text-gray-600">
                {user.email || "-"}
              </p>
              <p className="mt-2 text-sm font-semibold text-vr-700">
                {roleLabel(user.role)}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem
              label={t("staff.displayName")}
              value={user.displayName}
            />
            <DetailItem label={tc("email")} value={user.email} />
            <DetailItem
              label={tc("phone")}
              value={formatVietnamPhoneForDisplay(user.phone)}
            />
            <DetailItem label={t("staff.role")} value={roleLabel(user.role)} />
            <DetailItem label={tc("status")} value={tc(`enumLabels.${user.status}`, { defaultValue: user.status })} />
            <DetailItem
              label={t("staff.createdAt")}
              value={formatDateTime(user.createdAt)}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-vr-700">
                <FiMail size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {t("staff.initialPassword")}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {t("staff.initialPasswordDetailHint")}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold text-gray-900">
              {t("staff.rolePermissionTitle")}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {roleDescription(user.role) || t("staff.noRoleDescription")}
            </p>
            <p className="mt-2 font-mono text-xs text-gray-400">{user.role}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
