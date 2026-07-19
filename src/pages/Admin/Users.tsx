import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiEye,
  FiLock,
  FiRefreshCw,
  FiSearch,
  FiUnlock,
  FiUser,
} from "react-icons/fi";
import {
  getAdminUsers,
  lockAdminUser,
  unlockAdminUser,
  type AdminUser,
  type AdminUserRole,
} from "../../api/vietride";
import { getAuthUser } from "../../auth";
import CustomSelect from "../../components/CustomSelect";
import { DetailItem } from "../../components/DetailLayout";
import Modal from "../../components/Modal";
import Pagination from "../../components/Pagination";
import { formatDateTime } from "../../utils/date";
import { formatVietnamPhoneForDisplay } from "../../utils/phone";

const fallbackAvatarUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='32' fill='%23ecfeff'/%3E%3Ccircle cx='64' cy='48' r='22' fill='%235bc7ca'/%3E%3Cpath d='M28 106c5-24 19-36 36-36s31 12 36 36' fill='%231e8f93'/%3E%3C/svg%3E";

const actionButtonClass =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

function isActiveStatus(status: string) {
  return status.toUpperCase() === "ACTIVE";
}

function isLockedStatus(status: string) {
  return status.toUpperCase() === "LOCKED";
}

export default function Users() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const currentUserId = getAuthUser()?.id;
  const [searchTerm, setSearchTerm] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [actionUserId, setActionUserId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const pageSize = 10;

  useEffect(() => {
    let ignore = false;
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setMessage(null);

      try {
        const result = await getAdminUsers({
          page,
          pageSize,
          search: searchTerm.trim() || undefined,
          role: role || undefined,
          status: status || undefined,
          includeDeleted: includeDeleted || undefined,
          sortBy: "createdAt",
          sortDir: "desc",
        });

        if (!ignore) {
          setUsers(result.items);
          setTotalItems(result.totalItems);
        }
      } catch (error) {
        if (!ignore) {
          setUsers([]);
          setTotalItems(0);
          setMessage({
            tone: "error",
            text: error instanceof Error ? error.message : t("users.loadFailed"),
          });
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [includeDeleted, page, reloadKey, role, searchTerm, status, t]);

  const roleLabel = (userRole: AdminUserRole) => {
    const labels: Record<string, string> = {
      PASSENGER: t("users.customer"),
      OPERATOR_ADMIN: t("users.operatorAdmin"),
      OPERATOR_STAFF: t("users.operatorStaff"),
      SYSTEM_ADMIN: t("users.systemAdmin"),
      DRIVER: t("users.driver"),
      ASSISTANT: t("users.assistant"),
    };
    return labels[userRole] ?? userRole;
  };

  async function toggleLock(user: AdminUser) {
    const shouldUnlock = isLockedStatus(user.status);
    const confirmed = window.confirm(
      shouldUnlock
        ? t("users.unlockConfirm", { name: user.displayName })
        : t("users.lockConfirm", { name: user.displayName }),
    );

    if (!confirmed) {
      return;
    }

    setActionUserId(user.userId);
    setMessage(null);

    try {
      const result = shouldUnlock
        ? await unlockAdminUser(user.userId)
        : await lockAdminUser(user.userId);
      const updateUser = (item: AdminUser) =>
        item.userId === user.userId ? { ...item, status: result.status } : item;

      setUsers((current) => current.map(updateUser));
      setSelected((current) => (current ? updateUser(current) : current));
      setMessage({
        tone: "success",
        text: shouldUnlock ? t("users.unlockSuccess") : t("users.lockSuccess"),
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : t("users.actionFailed"),
      });
    } finally {
      setActionUserId("");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("users.title")}</h1>
          <p className="mt-1 text-gray-600">{t("users.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <FiRefreshCw />
          {tc("refresh")}
        </button>
      </header>

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            message.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid gap-3 border-b border-gray-100 p-4 md:grid-cols-[minmax(260px,1fr)_220px_200px_auto]">
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder={t("users.searchPlaceholder")}
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-vr-500 focus:bg-white"
            />
          </div>
          <CustomSelect
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">{t("users.allRoles")}</option>
            <option value="PASSENGER">{t("users.customer")}</option>
            <option value="OPERATOR_ADMIN">{t("users.operatorAdmin")}</option>
            <option value="OPERATOR_STAFF">{t("users.operatorStaff")}</option>
            <option value="DRIVER">{t("users.driver")}</option>
            <option value="ASSISTANT">{t("users.assistant")}</option>
            <option value="SYSTEM_ADMIN">{t("users.systemAdmin")}</option>
          </CustomSelect>
          <CustomSelect
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">{t("users.allStatuses")}</option>
            <option value="ACTIVE">{tc("active")}</option>
            <option value="LOCKED">{t("users.locked")}</option>
          </CustomSelect>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(event) => {
                setIncludeDeleted(event.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 cursor-pointer accent-vr-500"
            />
            {t("users.includeDeleted")}
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-700">
                <th className="px-5 py-3">{t("users.fullName")}</th>
                <th className="px-5 py-3">{tc("email")}</th>
                <th className="px-5 py-3">{tc("phone")}</th>
                <th className="px-5 py-3">{t("users.role")}</th>
                <th className="px-5 py-3">{t("users.joined")}</th>
                <th className="px-5 py-3">{tc("status")}</th>
                <th className="px-5 py-3 text-center">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const canToggle =
                  user.userId !== currentUserId &&
                  (isActiveStatus(user.status) || isLockedStatus(user.status));

                return (
                  <tr key={user.userId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                      {user.displayName || "-"}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{user.email}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      {formatVietnamPhoneForDisplay(user.phone)}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">{roleLabel(user.role)}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      {formatDateTime(user.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isActiveStatus(user.status)
                            ? "bg-emerald-50 text-emerald-700"
                            : isLockedStatus(user.status)
                              ? "bg-rose-50 text-rose-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {user.status || "-"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelected(user)}
                          className={actionButtonClass}
                          title={tc("details")}
                          aria-label={tc("details")}
                        >
                          <FiEye size={16} />
                        </button>
                        {(isActiveStatus(user.status) || isLockedStatus(user.status)) && (
                          <button
                            type="button"
                            onClick={() => void toggleLock(user)}
                            disabled={!canToggle || actionUserId === user.userId}
                            className={`${actionButtonClass} ${
                              isLockedStatus(user.status)
                                ? "text-emerald-600 hover:bg-emerald-50"
                                : "text-rose-600 hover:bg-rose-50"
                            }`}
                            title={
                              user.userId === currentUserId
                                ? t("users.selfLockBlocked")
                                : isLockedStatus(user.status)
                                  ? t("users.unlock")
                                  : t("users.lock")
                            }
                            aria-label={
                              isLockedStatus(user.status)
                                ? t("users.unlock")
                                : t("users.lock")
                            }
                          >
                            {isLockedStatus(user.status) ? <FiUnlock /> : <FiLock />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-500">
                    {t("users.empty")}
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-500">
                    {t("users.loading")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
        />
      </section>

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
      title={t("users.detailTitle")}
      subtitle={t("users.subtitle")}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tc("close")}
        </button>
      }
    >
      {user && (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center">
            <img
              src={user.avatarUrl || fallbackAvatarUrl}
              alt={user.displayName}
              width={72}
              height={72}
              loading="lazy"
              className="h-[72px] w-[72px] rounded-lg border border-white bg-white object-cover shadow-sm"
            />
            <div className="min-w-0">
              <p className="text-lg font-bold text-gray-900">{user.displayName || "-"}</p>
              <p className="mt-1 break-words text-sm text-gray-600">{user.email || "-"}</p>
              <p className="mt-2 text-sm font-semibold text-vr-700">{roleLabel(user.role)}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label={t("users.userId")} value={user.userId} />
            <DetailItem label={t("users.fullName")} value={user.displayName} />
            <DetailItem label={tc("email")} value={user.email} />
            <DetailItem label={tc("phone")} value={formatVietnamPhoneForDisplay(user.phone)} />
            <DetailItem label={t("users.role")} value={roleLabel(user.role)} />
            <DetailItem label={tc("status")} value={user.status} />
            <DetailItem label={t("users.operatorId")} value={user.operatorId || "-"} />
            <DetailItem label={t("users.joined")} value={formatDateTime(user.createdAt)} />
            <DetailItem label={t("users.updatedAt")} value={formatDateTime(user.updatedAt)} />
          </div>
        </div>
      )}
    </Modal>
  );
}
