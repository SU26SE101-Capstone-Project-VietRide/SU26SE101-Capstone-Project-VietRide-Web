import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiDownload,
  FiEye,
  FiFilter,
  FiList,
  FiMail,
  FiPlus,
  FiSearch,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import {
  createOperatorUser,
  getInternalUser,
  getOperatorUsers,
  resendInitialPassword,
  type AdminUser,
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
  phone: "",
  role: "OPERATOR_STAFF",
};

const staffGroups = [
  { key: "ALL", label: "Tất cả nhân sự" },
  { key: "FIELD", label: "Tài xế & phụ xe" },
  { key: "OPS", label: "Quản trị & vận hành" },
] as const;

const roleOptions: Array<{ value: AdminUserRole; label: string; description: string }> = [
  {
    value: "OPERATOR_ADMIN",
    label: "Quản lý nhà xe",
    description: "Toàn quyền công ty, quản lý tuyến, xe, chuyến, giá vé và nhân sự.",
  },
  {
    value: "OPERATOR_STAFF",
    label: "Nhân viên vận hành",
    description: "Hỗ trợ vận hành, kiểm tra đặt vé và xử lý khách tại quầy.",
  },
  {
    value: "DRIVER",
    label: "Tài xế",
    description: "Xem chuyến được phân công và cập nhật vận hành chuyến.",
  },
  {
    value: "ASSISTANT",
    label: "Phụ xe",
    description: "Xác nhận hành khách lên xe và hỗ trợ hàng hóa.",
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

function normalizeVietnamPhone(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `+84${digits.slice(1)}`;
  }

  if (digits.startsWith("84")) {
    return `+${digits}`;
  }

  return digits;
}

export default function StaffPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] =
    useState<(typeof staffGroups)[number]["key"]>("ALL");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [users, setUsers] = useState<OperatorUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userForm, setUserForm] =
    useState<CreateOperatorUserRequest>(emptyUserForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [message, setMessage] = useState("");
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

  function roleLabel(role: AdminUserRole) {
    const roleOption = roleOptions.find((option) => option.value === role);

    if (roleOption) {
      return roleOption.label;
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
    return roleOptions.find((option) => option.value === role)?.description ?? "";
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
    setError("");
    setMessage("");
    await createOperatorUser({
      ...userForm,
      phone: normalizeVietnamPhone(userForm.phone),
    });
    await reloadUsers();
    setUserForm(emptyUserForm);
    setOpenAdd(false);
    setMessage(
      "Đã tạo nhân sự. Hệ thống sẽ gửi email để nhân sự đặt mật khẩu lần đầu.",
    );
  }

  async function handleResendInitialPassword(user: OperatorUser) {
    const userId = getUserId(user);

    if (!userId) {
      setError("Không tìm thấy mã nhân sự để gửi lại link đặt mật khẩu.");
      return;
    }

    setError("");
    setMessage("");
    await resendInitialPassword(userId);
    setMessage(`Đã gửi lại link đặt mật khẩu cho ${user.email}.`);
  }

  async function handleOpenDetail(user: OperatorUser) {
    const userId = getUserId(user);

    if (!userId) {
      setError("Không tìm thấy mã nhân sự để xem chi tiết.");
      return;
    }

    setOpenDetail(true);
    setSelectedUser(null);
    setIsDetailLoading(true);
    setError("");

    try {
      const detail = await getInternalUser(userId);
      setSelectedUser(detail);
    } catch (err) {
      setOpenDetail(false);
      setError(err instanceof Error ? err.message : "Failed to load user detail");
    } finally {
      setIsDetailLoading(false);
    }
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
            Quản lý tài khoản nội bộ, gửi link đặt mật khẩu lần đầu và phân nhóm vai trò vận hành.
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
              onClick={() => setActiveGroup(group.key)}
              className={`rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
                activeGroup === group.key
                  ? "bg-vr-50 text-vr-800 ring-1 ring-vr-200"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700">
            <FiMail size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900">
              Flow mật khẩu khởi tạo
            </p>
            <p className="mt-1 text-sm text-blue-800">
              Quản lý chỉ tạo hồ sơ nhân sự. Hệ thống gửi email để nhân sự tự đặt mật khẩu tại trang <span className="font-mono">/set-initial-password?token=...</span>, sau đó nhân sự đăng nhập bằng email và mật khẩu mới.
            </p>
          </div>
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
          <p className="text-sm text-gray-500">Cần đặt mật khẩu</p>
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
            <select
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="">Tất cả vai trò</option>
              {roleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {[...new Set(users.map((user) => user.status).filter(Boolean))].map(
                (status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ),
              )}
            </select>
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(user)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700"
                        title="Xem chi tiết"
                        aria-label="Xem chi tiết"
                      >
                        <FiEye size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResendInitialPassword(user)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        title="Gửi lại link đặt mật khẩu"
                        aria-label="Gửi lại link đặt mật khẩu"
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
        subtitle="Nhập email, tên hiển thị và vai trò. Hệ thống sẽ gửi link đặt mật khẩu lần đầu cho nhân sự."
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
              Thông tin nhân sự
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
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  type="tel"
                  value={userForm.phone}
                  onChange={(e) => updateUserForm("phone", e.target.value)}
                  placeholder="+84901234567"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Có thể nhập 0901234567, hệ thống sẽ tự đổi thành +84901234567.
                </p>
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
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-bold text-gray-900">
              Quyền theo vai trò
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
                    {role.label}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {role.description}
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
        isLoading={isDetailLoading}
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
  isLoading,
  roleLabel,
  roleDescription,
  onClose,
}: {
  open: boolean;
  user: AdminUser | null;
  isLoading: boolean;
  roleLabel: (role: AdminUserRole) => string;
  roleDescription: (role: AdminUserRole) => string;
  onClose: () => void;
}) {
  const { t: tc } = useTranslation("common");

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiUser size={20} />}
      title="Chi tiết nhân sự"
      subtitle="Thông tin tài khoản nội bộ của nhà xe."
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
      {isLoading && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
          Đang tải chi tiết nhân sự...
        </div>
      )}

      {!isLoading && user && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="Mã nhân sự" value={user.userId} />
            <DetailItem label="Tên hiển thị" value={user.displayName} />
            <DetailItem label="Email" value={user.email} />
            <DetailItem label="Số điện thoại" value={user.phone ?? "-"} />
            <DetailItem label="Vai trò" value={roleLabel(user.role)} />
            <DetailItem label="Trạng thái" value={user.status} />
            <DetailItem label="Ngày tạo" value={user.createdAt ?? "-"} />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-vr-700">
                <FiMail size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Mật khẩu khởi tạo
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Nếu nhân sự chưa nhận email hoặc link hết hạn, quay lại danh sách và bấm icon thư để gửi lại link đặt mật khẩu.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold text-gray-900">
              Quyền của vai trò
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {roleDescription(user.role) || "Chưa có mô tả quyền cho vai trò này."}
            </p>
            <p className="mt-2 font-mono text-xs text-gray-400">{user.role}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-gray-900">
        {value || "-"}
      </p>
    </div>
  );
}
