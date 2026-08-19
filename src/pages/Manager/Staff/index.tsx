import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useLatestRequest } from "../../../hooks/useLatestRequest";
import { createIdempotencyKey } from "../../../api/idempotency";
import { getAuthUser } from "../../../auth";
import { lockOperatorUser, unlockOperatorUser } from "../../../api/operatorUserActions";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiActivity,
  FiArrowDown,
  FiArrowUp,
  FiEye,
  FiKey,
  FiLock,
  FiMail,
  FiPlus,
  FiTruck,
  FiUnlock,
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
import { Button } from "../../../components/ui/Button";
import { SearchInput } from "../../../components/ui/SearchInput";
import { Badge } from "../../../components/ui/Badge";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";

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
  // Chữ trắng 14px/700 cần 4,5:1 (không đạt mốc "chữ lớn" của WCAG), nên điểm
  // sáng nhất của gradient phải đủ tối — bậc -400 cũ chỉ khoảng 2,2:1.
  const gradientClassName =
    role === "DRIVER"
      ? "from-blue-600 to-cyan-700"
      : role === "ASSISTANT"
        ? "from-amber-700 to-orange-700"
        : role === "OPERATOR_STAFF"
          ? "from-vr-800 to-teal-700"
          : "from-slate-600 to-slate-700";

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
  // OPERATOR_STAFF đã bị gỡ khỏi web console — không tạo thêm tài khoản mới.
  // Nhân sự cũ mang role này vẫn hiển thị trong danh sách bên dưới.
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

/** Gộp `sortBy` + `sortDir` vào một ô chọn cho gọn toolbar */
type SortOption =
  | "createdAt:desc"
  | "createdAt:asc"
  | "displayName:asc"
  | "displayName:desc";

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
  const [sort, setSort] = useState<SortOption>("createdAt:desc");
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
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    drivers: number;
    pendingInitialPassword: number;
  } | null>(null);
  const [statsVersion, setStatsVersion] = useState(0);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const startRequest = useLatestRequest();
  const [totalItems, setTotalItems] = useState(0);
  const [lockTarget, setLockTarget] = useState<OperatorUser | null>(null);
  const [isLockingUser, setIsLockingUser] = useState(false);
  const lockAttemptRef = useRef<{ userId: string; action: "lock" | "unlock"; key: string } | null>(null);
  const pageSize = 10;

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
    const isLatest = startRequest();
    setIsLoading(true);
    setError("");

    try {
      const [sortBy, sortDir] = sort.split(":") as [string, "asc" | "desc"];
      const result = await getOperatorUsers({
        page,
        pageSize,
        search: debouncedSearch,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        sortBy,
        sortDir,
      });

      if (!isLatest()) return;
      setUsers(result.items);
      setTotalItems(result.totalItems);
    } catch (err) {
      if (!isLatest()) return;
      setError(
        err instanceof Error ? err.message : tRef.current("staff.loadFailed"),
      );
    } finally {
      if (isLatest()) setIsLoading(false);
    }
  }, [debouncedSearch, page, roleFilter, sort, startRequest, statusFilter]);

  // Thẻ thống kê đếm trên TOÀN bộ nhân sự của nhà xe, không đổi theo filter của
  // bảng — trước đây đếm `users.filter(...)` nên chỉ ra con số của trang đang xem
  // (và thẻ "Cần đặt mật khẩu" còn tính nhầm cả tài khoản bị khoá). BE chưa có
  // `/users/summary`, nên lấy `totalItems` của 4 truy vấn pageSize=1.
  useEffect(() => {
    let ignore = false;
    void Promise.all([
      getOperatorUsers({ page: 1, pageSize: 1 }),
      getOperatorUsers({ page: 1, pageSize: 1, status: "ACTIVE" }),
      getOperatorUsers({ page: 1, pageSize: 1, role: "DRIVER" }),
      getOperatorUsers({ page: 1, pageSize: 1, status: "PENDING_INITIAL_PASSWORD" }),
    ])
      .then(([all, active, drivers, pendingInitialPassword]) => {
        if (ignore) return;
        setStats({
          total: all.totalItems,
          active: active.totalItems,
          drivers: drivers.totalItems,
          pendingInitialPassword: pendingInitialPassword.totalItems,
        });
      })
      .catch(() => {
        // Thẻ thống kê lỗi không được chặn bảng chính
      });
    return () => {
      ignore = true;
    };
  }, [statsVersion]);

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
    // Bấm hai lần là tạo hai tài khoản và gửi hai email đặt mật khẩu: mỗi lần
    // bấm sinh một Idempotency-Key mới nên BE không gộp lại được.
    if (isCreatingUser) return;
    setIsCreatingUser(true);
    setError("");
    setMessage("");
    try {
      await createOperatorUser({
        ...userForm,
        phone: normalizeVietnamPhoneForApi(userForm.phone),
      });
      await loadUsers();
      setStatsVersion((current) => current + 1);
      setUserForm(emptyUserForm);
      setOpenAdd(false);
      setMessage(t("staff.createInitialPasswordSuccess"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("staff.createUserFailed"),
      );
    } finally {
      setIsCreatingUser(false);
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

  function openLockConfirmation(user: OperatorUser) {
    const manageable = user.role === "DRIVER" || user.role === "ASSISTANT";
    const canAct = getAuthUser()?.role === "OPERATOR_ADMIN" && manageable &&
      (user.status === "ACTIVE" || user.status === "LOCKED");
    if (!canAct) return;
    setLockTarget(user);
    setError("");
    setMessage("");
  }

  async function confirmLockAction() {
    if (!lockTarget) return;
    const userId = getUserId(lockTarget);
    const action = lockTarget.status === "ACTIVE" ? "lock" : "unlock";
    if (!userId) {
      setError(t("staff.lockMissingUser"));
      return;
    }

    const previousAttempt = lockAttemptRef.current;
    const key = previousAttempt?.userId === userId && previousAttempt.action === action
      ? previousAttempt.key
      : createIdempotencyKey();
    lockAttemptRef.current = { userId, action, key };
    setIsLockingUser(true);
    setError("");
    setMessage("");

    try {
      const result = action === "lock"
        ? await lockOperatorUser(userId, key)
        : await unlockOperatorUser(userId, key);
      lockAttemptRef.current = null;
      setLockTarget(null);
      await loadUsers();
      setStatsVersion((current) => current + 1);
      window.dispatchEvent(new CustomEvent("vietride:operator-user-status-changed", { detail: { userId, status: result.status } }));
      setMessage(
        result.status === "LOCKED"
          ? t("staff.lockSuccess")
          : t("staff.unlockSuccess"),
      );
    } catch (err) {
      // Giữ lockAttemptRef để nút thử lại dùng đúng Idempotency-Key của nghiệp vụ.
      setError(
        err instanceof Error ? err.message : t("staff.lockActionFailed"),
      );
    } finally {
      setIsLockingUser(false);
    }
  }

  function updateUserForm(key: keyof CreateOperatorUserRequest, value: string) {
    setUserForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleNameSort() {
    setSort((current) => (current === "displayName:asc" ? "displayName:desc" : "displayName:asc"));
    setPage(1);
  }

  function nameSortIcon() {
    if (sort === "displayName:asc") return <FiArrowUp aria-hidden="true" size={14} />;
    if (sort === "displayName:desc") return <FiArrowDown aria-hidden="true" size={14} />;
    return <span aria-hidden="true" className="text-base leading-none text-gray-500">↕</span>;
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
          className="px-4 py-2 bg-vr-800 cursor-pointer hover:bg-vr-900 text-slate-50 font-bold rounded-lg transition flex items-center gap-2"
        >
          <FiPlus size={18} />
          {t("staff.add")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("staff.total")}
          value={stats?.total ?? 0}
          icon={<FiUsers size={20} />}
          iconClassName="bg-vr-50 text-vr-900"
        />
        <StatCard
          label={t("staff.onDuty")}
          value={stats?.active ?? 0}
          icon={<FiActivity size={20} />}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label={t("staff.drivers")}
          value={stats?.drivers ?? 0}
          icon={<FiTruck size={20} />}
          iconClassName="bg-blue-50 text-blue-700"
        />
        <StatCard
          label={t("staff.needsInitialPassword")}
          value={stats?.pendingInitialPassword ?? 0}
          icon={<FiKey size={20} />}
          iconClassName="bg-amber-50 text-amber-700"
        />
      </div>
      <PersonnelTable
        toolbar={<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_300px] lg:items-center"><SearchInput
  label={t("staff.searchPlaceholder")}
  value={search}
  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
  placeholder={t("staff.searchPlaceholder")}
/><div className="contents"><CustomSelect className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 lg:w-[220px]" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }}><option value="">{t("staff.allRoles")}</option>{roleOptions.map((role) => <option key={role.value} value={role.value}>{t(role.labelKey)}</option>)}</CustomSelect><CustomSelect className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 lg:w-[300px]" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="">{t("staff.allStatuses")}</option>{["ACTIVE", "LOCKED", "PENDING_EMAIL_VERIFICATION", "PENDING_INITIAL_PASSWORD", "DELETED"].map((status) => <option key={status} value={status}>{tc(`enumLabels.${status}`, { defaultValue: status })}</option>)}</CustomSelect>{/* sortBy/sortDir BE đã nhận sẵn, màn chỉ thiếu ô chọn */}</div></div>}
        columns={[
          { key: "name", header: <button type="button" onClick={toggleNameSort} className="inline-flex items-center gap-1.5 font-semibold transition hover:text-vr-900" aria-label={t("staff.sortNameAsc")}>{t("staff.fullName")}{nameSortIcon()}</button>, headerClassName: "w-[20%] px-3 py-3 text-left", cellClassName: "w-[20%] px-3 py-4 text-left", render: (user) => <div className="flex min-w-0 items-center justify-start gap-3">{user.avatarUrl ? ( <img src={user.avatarUrl} alt={user.displayName || user.email} width={40} height={40} loading="lazy" className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 bg-white object-cover" /> ) : ( <RoleAvatar role={user.role} name={user.displayName || user.email} /> )}<span className="min-w-0 truncate text-sm font-semibold text-gray-900" title={user.displayName || "-"}>{user.displayName || "-"}</span></div> },
          { key: "email", header: tc("email"), headerClassName: "w-[24%] px-3 py-3 text-center", cellClassName: "w-[24%] px-3 py-4 text-center text-sm text-gray-600", render: (user) => <span className="block truncate" title={user.email}>{user.email}</span> },
          { key: "phone", header: tc("phone"), headerClassName: "w-[10%] px-3 py-3 text-center", cellClassName: "w-[10%] px-3 py-4 text-center text-sm whitespace-nowrap text-gray-600", render: (user) => formatVietnamPhoneForDisplay(user.phone) },
          { key: "role", header: t("staff.role"), headerClassName: "w-[13%] px-3 py-3 text-center", cellClassName: "w-[13%] px-3 py-4 text-center text-sm text-gray-700", render: (user) => roleLabel(user.role) },
          { key: "status", header: tc("status"), headerClassName: "w-[18%] px-3 py-3 text-center", cellClassName: "w-[18%] px-3 py-4 text-center", render: (user) => <Badge tone={isActiveStatus(user.status) ? "success" : "neutral"}>{tc(`enumLabels.${user.status}`, { defaultValue: user.status })}</Badge> },
          { key: "actions", header: tc("actions"), headerClassName: "w-[15%] px-2 py-3 text-center", cellClassName: "w-[15%] px-2 py-4 text-center text-sm", render: (user) => {
            const canResend = user.status === "PENDING_INITIAL_PASSWORD";
            const canLock = getAuthUser()?.role === "OPERATOR_ADMIN" &&
              (user.role === "DRIVER" || user.role === "ASSISTANT") &&
              (user.status === "ACTIVE" || user.status === "LOCKED");
            return <div className="flex items-center justify-center gap-2">
              <button type="button" onClick={() => handleOpenDetail(user)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-900" title={t("staff.viewDetail")} aria-label={t("staff.viewDetail")}><FiEye size={16} /></button>
              <button type="button" onClick={() => handleResendInitialPassword(user)} disabled={!canResend} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:bg-transparent disabled:hover:text-gray-600" title={canResend ? t("staff.resendInitialPassword") : t("staff.resendInitialPasswordDisabledHint")} aria-label={t("staff.resendInitialPassword")}><FiMail size={16} /></button>
              {canLock && <button type="button" onClick={() => openLockConfirmation(user)} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${user.status === "ACTIVE" ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`} title={user.status === "ACTIVE" ? t("staff.lockUser") : t("staff.unlockUser")} aria-label={user.status === "ACTIVE" ? t("staff.lockUser") : t("staff.unlockUser")}>{user.status === "ACTIVE" ? <FiLock size={16} /> : <FiUnlock size={16} />}</button>}
            </div>;
          } },
        ]}
        rows={users}
        getRowKey={(user) => getUserId(user)}
        isLoading={isLoading}
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
            <Button variant="secondary" onClick={() => setOpenAdd(false)}>
              {tc("cancel")}
            </Button>
            <button
              type="button"
              onClick={handleCreateUser}
              disabled={isCreatingUser}
              className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-vr-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
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

      {lockTarget && (
        <Modal
          open
          onClose={() => !isLockingUser && setLockTarget(null)}
          title={lockTarget.status === "ACTIVE" ? t("staff.lockConfirmTitle") : t("staff.unlockConfirmTitle")}
          subtitle={lockTarget.displayName || lockTarget.email}
          icon={lockTarget.status === "ACTIVE" ? <FiLock /> : <FiUnlock />}
          footer={
            <>
              <Button variant="secondary" disabled={isLockingUser} onClick={() => setLockTarget(null)}>{tc("cancel")}</Button>
              <Button variant="primary" disabled={isLockingUser} onClick={() => void confirmLockAction()}>
                {isLockingUser ? tc("loading") : lockTarget.status === "ACTIVE" ? t("staff.lockUser") : t("staff.unlockUser")}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-6 text-gray-600">
            {lockTarget.status === "ACTIVE" ? t("staff.lockConfirmMessage") : t("staff.unlockConfirmMessage")}
          </p>
        </Modal>
      )}

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
        <Button variant="secondary" onClick={onClose}>
          {tc("close")}
        </Button>
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
              <div className="mt-3 flex flex-wrap items-center gap-2"><Badge tone="brand">{roleLabel(user.role)}</Badge><Badge tone={isActiveStatus(user.status) ? "success" : "neutral"}>{tc(`enumLabels.${user.status}`, { defaultValue: user.status })}</Badge></div>
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
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-vr-900">
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
            {/* Không lặp lại tên vai trò ở đây: ô "Vai trò" phía trên và chip
                cạnh tên đã hiện rồi. Trước đây chỗ này in enum thô của BE
                (ASSISTANT/DRIVER...) mà nhân sự nhà xe không đọc được. */}
            <p className="mt-1 text-sm text-gray-600">
              {roleDescription(user.role) || t("staff.noRoleDescription")}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}




