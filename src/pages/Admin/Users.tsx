import { useToastFeedback } from "../../hooks/useToastFeedback";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiActivity, FiEye, FiKey, FiLock, FiSearch, FiUnlock, FiUser, FiUsers } from "react-icons/fi";
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
import { PersonnelTable } from "../../components/PersonnelTable";
import { formatDateTime } from "../../utils/date";
import { formatVietnamPhoneForDisplay } from "../../utils/phone";
import { StatCard } from "../../components/StatCard";

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
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const currentUserId = getAuthUser()?.id;
  const [searchTerm, setSearchTerm] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [actionUserId, setActionUserId] = useState("");
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
        const listUsers = getAdminUsers;
        const result = await listUsers({
          page,
          pageSize,
          search: searchTerm.trim() || undefined,
          role: role || undefined,
          status: status || undefined,
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
            text:
              error instanceof Error
                ? error.message
                : tRef.current("users.loadFailed"),
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
  }, [page, role, searchTerm, status]);

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

  useToastFeedback({ message: message?.tone === "success" ? message.text : "", error: message?.tone === "error" ? message.text : "" });
  return (
    <div className="space-y-6">
      <header>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("users.title")}
          </h1>
          <p className="mt-1 text-gray-600">{t("users.subtitle")}</p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("users.total")} value={users.length} icon={<FiUsers size={20} />} iconClassName="bg-vr-50 text-vr-700" />
        <StatCard label={tc("active")} value={users.filter((user) => isActiveStatus(user.status)).length} icon={<FiActivity size={20} />} iconClassName="bg-emerald-50 text-emerald-700" />
        <StatCard label={t("users.operatorStaff")} value={users.filter((user) => user.role === "OPERATOR_STAFF").length} icon={<FiUsers size={20} />} iconClassName="bg-blue-50 text-blue-700" />
        <StatCard label={tc("enumLabels.PENDING_INITIAL_PASSWORD")} value={users.filter((user) => user.status === "PENDING_INITIAL_PASSWORD").length} icon={<FiKey size={20} />} iconClassName="bg-amber-50 text-amber-700" />
      </div>
      <PersonnelTable
        toolbar={<div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_220px_200px]">
          <div className="relative"><FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="search" placeholder={t("users.searchPlaceholder")} value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setPage(1); }} className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-vr-500 focus:bg-white" /></div>
          <CustomSelect value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"><option value="">{t("users.allRoles")}</option><option value="PASSENGER">{t("users.customer")}</option><option value="OPERATOR_ADMIN">{t("users.operatorAdmin")}</option><option value="OPERATOR_STAFF">{t("users.operatorStaff")}</option><option value="DRIVER">{t("users.driver")}</option><option value="ASSISTANT">{t("users.assistant")}</option><option value="SYSTEM_ADMIN">{t("users.systemAdmin")}</option></CustomSelect>
          <CustomSelect value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"><option value="">{t("users.allStatuses")}</option><option value="ACTIVE">{tc("active")}</option><option value="LOCKED">{t("users.locked")}</option><option value="PENDING_EMAIL_VERIFICATION">{tc("enumLabels.PENDING_EMAIL_VERIFICATION")}</option><option value="PENDING_INITIAL_PASSWORD">{tc("enumLabels.PENDING_INITIAL_PASSWORD")}</option><option value="DELETED">{tc("enumLabels.DELETED")}</option></CustomSelect>
        </div>}
        columns={[
          { key: "name", header: t("users.fullName"), headerClassName: "w-[20%] px-4 py-3", cellClassName: "w-[20%] px-4 py-4", render: (user) => <div className="flex items-center gap-3"><img src={user.avatarUrl || fallbackAvatarUrl} alt={user.displayName || user.email} width={40} height={40} loading="lazy" className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 bg-white object-cover" /><span className="truncate whitespace-nowrap text-sm font-semibold text-gray-900">{user.displayName || "-"}</span></div> },
          { key: "email", header: tc("email"), headerClassName: "w-[24%] px-4 py-3", cellClassName: "w-[24%] px-4 py-4 text-sm text-gray-600", render: (user) => <span className="block max-w-[220px] truncate" title={user.email}>{user.email}</span> },
          { key: "phone", header: tc("phone"), headerClassName: "w-[12%] px-4 py-3", cellClassName: "w-[12%] px-4 py-4 text-sm whitespace-nowrap text-gray-600", render: (user) => formatVietnamPhoneForDisplay(user.phone) },
          { key: "role", header: t("users.role"), headerClassName: "w-[18%] px-4 py-3", cellClassName: "w-[18%] px-4 py-4 text-sm text-gray-700", render: (user) => <span className="block truncate">{roleLabel(user.role)}</span> },
          { key: "status", header: tc("status"), headerClassName: "w-[16%] px-4 py-3", cellClassName: "w-[16%] px-4 py-4 text-sm", render: (user) => <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${isActiveStatus(user.status) ? "bg-emerald-50 text-emerald-700" : isLockedStatus(user.status) ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{user.status ? tc(`enumLabels.${user.status}`, { defaultValue: user.status }) : "-"}</span> },
          { key: "actions", header: tc("actions"), headerClassName: "w-[120px] px-2 py-3 text-center", cellClassName: "sticky right-0 w-[120px] bg-white px-2 py-4", render: (user) => { const canToggle = user.userId !== currentUserId && (isActiveStatus(user.status) || isLockedStatus(user.status)); return <div className="mx-auto flex w-[80px] justify-center gap-2"><button type="button" aria-label="details" onClick={() => setSelected(user)} className={actionButtonClass}><FiEye size={16} /></button>{(isActiveStatus(user.status) || isLockedStatus(user.status)) ? <button type="button" onClick={() => void toggleLock(user)} disabled={!canToggle || actionUserId === user.userId} className={actionButtonClass}>{isLockedStatus(user.status) ? <FiUnlock /> : <FiLock />}</button> : <span className="h-8 w-8" />}</div>; } },
        ]}
        rows={users}
        getRowKey={(user) => user.userId}
        isLoading={isLoading}
        wrapperClassName="overflow-hidden rounded-lg border border-gray-200"
        loadingContent={<UserTableSkeletonRows />}
        emptyMessage={t("users.empty")}
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={(nextPage) => { setIsLoading(true); setPage(nextPage); }}
      />

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
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="h-20 bg-transparent" />
            <div className="px-5 pb-5">
              <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex min-w-0 items-end gap-4">
                  <img
                    src={user.avatarUrl || fallbackAvatarUrl}
                    alt={user.displayName || user.email}
                    width={88}
                    height={88}
                    loading="lazy"
                    className="h-[88px] w-[88px] shrink-0 rounded-2xl border-4 border-white bg-white object-cover shadow-md"
                  />
                  <div className="min-w-0 pb-1">
                    <p className="truncate text-xl font-bold text-gray-900">
                      {user.displayName || "-"}
                    </p>
                    <p
                      className="mt-1 truncate text-sm text-gray-500"
                      title={user.email}
                    >
                      {user.email || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 pb-1">
                  <span className="rounded-full bg-vr-50 px-3 py-1.5 text-xs font-semibold text-vr-700">
                    {roleLabel(user.role)}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${isActiveStatus(user.status) ? "bg-emerald-50 text-emerald-700" : isLockedStatus(user.status) ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}
                  >
                    {tc(`enumLabels.${user.status}`, {
                      defaultValue: user.status,
                    })}
                  </span>
                </div>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-500">
                {t("users.passengerDetailHint")}
              </p>
            </div>
          </section>
          <section className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {t("users.accountInformation")}
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  {t("users.accountInformationHint")}
                </p>
              </div>
              <FiUser className="text-vr-600" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem
                label={tc("phone")}
                value={formatVietnamPhoneForDisplay(user.phone)}
              />
              <DetailItem label={t("users.userId")} value={user.userId} />
              <DetailItem
                label={t("users.updatedAt")}
                value={formatDateTime(user.updatedAt)}
              />
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />
  );
}

function UserTableSkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => (
        <tr
          key={index}
          className="border-b border-gray-100"
          aria-hidden="true"
          data-testid={index === 0 ? "users-table-skeleton" : undefined}
        >
          <td className="px-4 py-4">
            <SkeletonBlock className="h-10 w-full" />
          </td>
          <td className="px-4 py-4">
            <SkeletonBlock className="h-4 w-full" />
          </td>
          <td className="px-4 py-4">
            <SkeletonBlock className="h-4 w-full" />
          </td>
          <td className="px-4 py-4">
            <SkeletonBlock className="h-4 w-full" />
          </td>
          <td className="px-4 py-4">
            <SkeletonBlock className="h-6 w-20" />
          </td>
          <td className="sticky right-0 bg-white px-2 py-4">
            <div className="mx-auto flex w-[80px] gap-2">
              <SkeletonBlock className="h-9 w-9" />
              <SkeletonBlock className="h-9 w-9" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
