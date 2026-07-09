import { FiEye, FiFilter, FiSearch, FiUser } from "react-icons/fi";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DetailItem } from "../../components/DetailLayout";
import Modal from "../../components/Modal";
import Pagination from "../../components/Pagination";
import { type AdminUser, type AdminUserRole } from "../../api/vietride";
import { formatDateTime } from "../../utils/date";
import { formatVietnamPhoneForDisplay } from "../../utils/phone";

function isActiveStatus(status: string) {
  return ["ACTIVE", "APPROVED", "active"].includes(status);
}

const passengerAvatarUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='32' fill='%23eff6ff'/%3E%3Ccircle cx='64' cy='48' r='22' fill='%233b82f6'/%3E%3Cpath d='M28 106c5-24 19-36 36-36s31 12 36 36' fill='%231d4ed8'/%3E%3C/svg%3E";

const mockPassengerUsers: AdminUser[] = [
  {
    userId: "passenger-001",
    email: "minh.nguyen@example.com",
    displayName: "Nguyễn Hoàng Minh",
    phone: "+84901234567",
    role: "PASSENGER",
    status: "ACTIVE",
    operatorId: null,
    createdAt: "2026-07-01T08:20:00+07:00",
  },
  {
    userId: "passenger-002",
    email: "linh.tran@example.com",
    displayName: "Trần Gia Linh",
    phone: "+84981234567",
    role: "PASSENGER",
    status: "ACTIVE",
    operatorId: null,
    createdAt: "2026-07-03T14:35:00+07:00",
  },
  {
    userId: "passenger-003",
    email: "anh.pham@example.com",
    displayName: "Phạm Quang Anh",
    phone: "+84701234567",
    role: "PASSENGER",
    status: "PENDING_EMAIL_VERIFICATION",
    operatorId: null,
    createdAt: "2026-07-05T09:10:00+07:00",
  },
];

export default function Users() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [searchTerm, setSearchTerm] = useState("");
  const [users] = useState<AdminUser[]>(mockPassengerUsers);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filtered = useMemo(
    () =>
      users.filter(
        (u) =>
          u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [searchTerm, users],
  );

  const paginatedUsers = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page],
  );

  const roleLabel = (role: AdminUserRole) => {
    const map: Record<string, string> = {
      PASSENGER: t("users.customer"),
      OPERATOR_ADMIN: t("users.manager"),
      OPERATOR_STAFF: t("users.operator"),
      SYSTEM_ADMIN: t("users.admin"),
      DRIVER: t("users.driver"),
      ASSISTANT: t("users.assistant"),
      customer: t("users.customer"),
      manager: t("users.manager"),
      operator: t("users.operator"),
      admin: t("users.admin"),
    };
    return map[role] ?? role;
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
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t("users.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
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

        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {t("users.fullName")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {tc("email")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  {tc("phone")}
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
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">
                  {tc("actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((u) => (
                <tr
                  key={u.userId}
                  className="border-b border-gray-100 hover:bg-gray-50 transition"
                >
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {u.displayName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatVietnamPhoneForDisplay(u.phone)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {roleLabel(u.role)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDateTime(u.createdAt)}
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
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => setSelected(u)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-vr-600 transition hover:bg-vr-50"
                      title={tc("details")}
                      aria-label={tc("details")}
                    >
                      <FiEye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setPage}
        />
      </div>

      <UserDetailModal
        open={selected !== null}
        user={selected}
        roleLabel={roleLabel}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function UserDetailModal({
  open,
  user,
  roleLabel,
  onClose,
}: {
  open: boolean;
  user: AdminUser | null;
  roleLabel: (role: AdminUserRole) => string;
  onClose: () => void;
}) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiUser size={20} />}
      title={tc("details")}
      subtitle={t("users.subtitle")}
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
              src={passengerAvatarUrl}
              alt={user.displayName}
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
            <DetailItem label={t("users.fullName")} value={user.displayName} />
            <DetailItem label={tc("email")} value={user.email} />
            <DetailItem
              label={tc("phone")}
              value={formatVietnamPhoneForDisplay(user.phone)}
            />
            <DetailItem label={t("users.role")} value={roleLabel(user.role)} />
            <DetailItem label={tc("status")} value={user.status} />
            <DetailItem
              label={t("users.joined")}
              value={formatDateTime(user.createdAt)}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold text-gray-900">
              {t("users.customer")}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {t("users.passengerDetailHint")}
            </p>
            <p className="mt-2 font-mono text-xs text-gray-400">{user.role}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
