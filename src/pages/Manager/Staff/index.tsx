import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiActivity,
  FiEye,
  FiKey,
  FiMail,
  FiPlus,
  FiSearch,
  FiTruck,
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
import { PersonnelTable } from "../../../components/PersonnelTable";
import { labelClass } from "../../../components/form/formClasses";
import { StatCard } from "../../../components/StatCard";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";

function getAvatarInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1) {
    return Array.from(words[0]).slice(0, 2).join("").toUpperCase();
  }

  return `${Array.from(words[0])[0] ?? ""}${Array.from(words[words.length - 1])[0] ?? ""}`.toUpperCase();
}

function RoleAvatar({
  role,
  name,
  sizeClassName = "h-10 w-10",
}: {
  role: AdminUserRole;
  name: string;
  sizeClassName?: string;
}) {
  const gradientClassName =
    role === "DRIVER"
      ? "from-blue-500 to-cyan-400"
      : role === "ASSISTANT"
        ? "from-amber-500 to-orange-400"
        : role === "OPERATOR_STAFF"
          ? "from-vr-600 to-teal-400"
          : "from-slate-500 to-slate-400";

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientClassName} text-sm font-bold text-white shadow-sm ring-2 ring-white ${sizeClassName}`}
      role="img"
      aria-label={`${name} - ${role}`}
      title={role}
    >
      {getAvatarInitials(name)}
    </div>
  );
}
const emptyUserForm: CreateOperatorUserRequest = {
  email: "",
  displayName: "",
  phone: "",
  role: "DRIVER",
};

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

const creatableRoleOptions = roleOptions.filter(
  (role) => role.value === "DRIVER" || role.value === "ASSISTANT",
);

function isActiveStatus(status: string) {
  return ["ACTIVE", "APPROVED", "active"].includes(status);
}

function getUserId(user: Pick<OperatorUser, "userId"> & { id?: string }) {
  return user.userId || user.id || "";
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
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  // Hàm tải danh sách nhân sự dùng chung cho effect và sau khi tạo tài khoản.
  // Pagination và filter chạy ở server để totalItems/rows luôn cùng một tập dữ liệu.
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getOperatorUsers({
        page,
        pageSize,
        search: debouncedSearch,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
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
  }, [debouncedSearch, page, roleFilter, statusFilter]);

  useEffect(() => {
    async function run() {
      await loadUsers();
    }

    void run();
  }, [loadUsers]);

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
      setError(
        err instanceof Error ? err.message : t("staff.createUserFailed"),
      );
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
      setMessage(
        t("staff.resendInitialPasswordSuccess", { email: user.email }),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("staff.resendInitialPasswordFailed"),
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

  useToastFeedback({ message, error });
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("staff.total")}
          value={users.length}
          icon={<FiUsers size={20} />}
          iconClassName="bg-vr-50 text-vr-700"
        />
        <StatCard
          label={t("staff.onDuty")}
          value={users.filter((user) => isActiveStatus(user.status)).length}
          icon={<FiActivity size={20} />}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label={t("staff.drivers")}
          value={users.filter((user) => user.role === "DRIVER").length}
          icon={<FiTruck size={20} />}
          iconClassName="bg-blue-50 text-blue-700"
        />
        <StatCard
          label={t("staff.needsInitialPassword")}
          value={users.filter((user) => !isActiveStatus(user.status)).length}
          icon={<FiKey size={20} />}
          iconClassName="bg-amber-50 text-amber-700"
        />
      </div>
      <PersonnelTable
        toolbar={<div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative min-w-0 flex-1"><FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input className={inputClass + " pl-10"} placeholder={t("staff.searchPlaceholder")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div><div className="flex flex-wrap gap-2"><CustomSelect className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }}><option value="">{t("staff.allRoles")}</option>{roleOptions.map((role) => <option key={role.value} value={role.value}>{t(role.labelKey)}</option>)}</CustomSelect><CustomSelect className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="">{t("staff.allStatuses")}</option>{["ACTIVE", "LOCKED", "PENDING_EMAIL_VERIFICATION", "PENDING_INITIAL_PASSWORD", "DELETED"].map((status) => <option key={status} value={status}>{tc(`enumLabels.${status}`, { defaultValue: status })}</option>)}</CustomSelect></div></div>}
        columns={[
          { key: "name", header: t("staff.fullName"), headerClassName: "w-[20%] px-3 py-3 text-left", cellClassName: "w-[20%] px-3 py-4 text-left", render: (user) => <div className="flex min-w-0 items-center justify-start gap-3">{user.avatarUrl ? ( <img src={user.avatarUrl} alt={user.displayName || user.email} width={40} height={40} loading="lazy" className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 bg-white object-cover" /> ) : ( <RoleAvatar role={user.role} name={user.displayName || user.email} /> )}<span className="min-w-0 truncate text-sm font-semibold text-gray-900" title={user.displayName || "-"}>{user.displayName || "-"}</span></div> },
          { key: "email", header: tc("email"), headerClassName: "w-[24%] px-3 py-3 text-center", cellClassName: "w-[24%] px-3 py-4 text-center text-sm text-gray-600", render: (user) => <span className="block truncate" title={user.email}>{user.email}</span> },
          { key: "phone", header: tc("phone"), headerClassName: "w-[10%] px-3 py-3 text-center", cellClassName: "w-[10%] px-3 py-4 text-center text-sm whitespace-nowrap text-gray-600", render: (user) => formatVietnamPhoneForDisplay(user.phone) },
          { key: "role", header: t("staff.role"), headerClassName: "w-[18%] px-3 py-3 text-center", cellClassName: "w-[18%] px-3 py-4 text-center text-sm text-gray-700", render: (user) => roleLabel(user.role) },
          { key: "status", header: tc("status"), headerClassName: "w-[18%] px-3 py-3 text-center", cellClassName: "w-[18%] px-3 py-4 text-center", render: (user) => <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${isActiveStatus(user.status) ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-gray-700"}`}>{tc(`enumLabels.${user.status}`, { defaultValue: user.status })}</span> },
          { key: "actions", header: tc("actions"), headerClassName: "w-[10%] px-2 py-3 text-center", cellClassName: "w-[10%] px-2 py-4 text-center text-sm", render: (user) => { const canResend = user.status === "PENDING_INITIAL_PASSWORD"; return <div className="flex items-center justify-center gap-2"><button type="button" onClick={() => handleOpenDetail(user)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700" title={t("staff.viewDetail")} aria-label={t("staff.viewDetail")}><FiEye size={16} /></button><button type="button" onClick={() => handleResendInitialPassword(user)} disabled={!canResend} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:bg-transparent disabled:hover:text-gray-600" title={canResend ? t("staff.resendInitialPassword") : t("staff.resendInitialPasswordDisabledHint")} aria-label={t("staff.resendInitialPassword")}><FiMail size={16} /></button></div>; } },
        ]}
        rows={users}
        getRowKey={(user) => getUserId(user)}
        isLoading={isLoading}
        loadingMessage={t("staff.loading")}
        emptyMessage="Không có nhân sự phù hợp"
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={setPage}
      />

      <Modal        open={openAdd}
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
                  {creatableRoleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {t(role.labelKey)}
                    </option>
                  ))}
                </CustomSelect>
              </div>
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
          <div className="flex flex-col gap-4 rounded-2xl border border-vr-100 bg-gradient-to-r from-vr-50 via-white to-cyan-50 p-5 shadow-sm sm:flex-row sm:items-center">
            <>{user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName || user.email}
                width={72}
                height={72}
                loading="lazy"
                className="h-[72px] w-[72px] shrink-0 rounded-2xl border-4 border-white bg-white object-cover shadow-md"
              />
            ) : (
              <RoleAvatar role={user.role} name={user.displayName || user.email} sizeClassName="h-[72px] w-[72px] text-xl ring-4" />
            )}</>
            <div className="min-w-0">
              <p className="text-2xl font-bold tracking-tight text-gray-950">
                {user.displayName || "-"}
              </p>
              <p className="mt-1 truncate text-sm text-gray-600">
                {user.email || "-"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2"><span className="inline-flex items-center rounded-full bg-vr-100 px-3 py-1 text-xs font-semibold text-vr-800">{roleLabel(user.role)}</span><span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${isActiveStatus(user.status) ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{tc(`enumLabels.${user.status}`, { defaultValue: user.status })}</span></div>
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
            <DetailItem
              label={tc("status")}
              value={tc(`enumLabels.${user.status}`, {
                defaultValue: user.status,
              })}
            />
            <DetailItem
              label={t("staff.createdAt")}
              value={formatDateTime(user.createdAt)}
            />
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
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
