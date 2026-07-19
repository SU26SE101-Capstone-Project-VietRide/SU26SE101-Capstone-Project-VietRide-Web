import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FiEye, FiFileText, FiFilter, FiRefreshCw } from "react-icons/fi";
import {
  getAdminActivityLogs,
  type AdminActivityLog,
} from "../../api/vietride";
import CustomDateTimeInput from "../../components/CustomDateTimeInput";
import { DetailItem } from "../../components/DetailLayout";
import Modal from "../../components/Modal";
import Pagination from "../../components/Pagination";
import {
  formatDateInputValue,
  formatDateTime,
  toExclusiveUtcDayEnd,
  toUtcDayStart,
} from "../../utils/date";

type LogFilters = {
  userId: string;
  action: string;
  from: string;
  to: string;
};

function createInitialFilters(): LogFilters {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    userId: "",
    action: "",
    from: formatDateInputValue(monthStart),
    to: formatDateInputValue(now),
  };
}

const actionButtonClass =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-vr-700 transition hover:bg-vr-50";

export default function ActivityLogs() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [draftFilters, setDraftFilters] = useState<LogFilters>(createInitialFilters);
  const [filters, setFilters] = useState<LogFilters>(createInitialFilters);
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [selected, setSelected] = useState<AdminActivityLog | null>(null);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const pageSize = 15;

  useEffect(() => {
    let ignore = false;

    async function loadLogs() {
      setIsLoading(true);
      setError("");

      try {
        const result = await getAdminActivityLogs({
          page,
          pageSize,
          userId: filters.userId.trim() || undefined,
          action: filters.action.trim() || undefined,
          from: toUtcDayStart(filters.from),
          to: toExclusiveUtcDayEnd(filters.to),
        });

        if (!ignore) {
          setLogs(result.items);
          setTotalItems(result.totalItems);
        }
      } catch (loadError) {
        if (!ignore) {
          setLogs([]);
          setTotalItems(0);
          setError(
            loadError instanceof Error
              ? loadError.message
              : t("activityLogs.loadFailed"),
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadLogs();
    return () => {
      ignore = true;
    };
  }, [filters, page, pageSize, reloadKey, t]);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setFilters(draftFilters);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("activityLogs.title")}
          </h1>
          <p className="mt-1 text-gray-600">{t("activityLogs.subtitle")}</p>
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

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_180px_180px_auto] xl:items-end"
      >
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-gray-600">
            {t("activityLogs.actorId")}
          </span>
          <input
            value={draftFilters.userId}
            onChange={(event) =>
              setDraftFilters((current) => ({ ...current, userId: event.target.value }))
            }
            placeholder="UUID"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-vr-500"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-gray-600">
            {t("activityLogs.action")}
          </span>
          <input
            value={draftFilters.action}
            onChange={(event) =>
              setDraftFilters((current) => ({ ...current, action: event.target.value }))
            }
            placeholder="LOCK_USER"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-vr-500"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-gray-600">
            {tc("from")}
          </span>
          <CustomDateTimeInput
            type="date"
            value={draftFilters.from}
            onChange={(event) =>
              setDraftFilters((current) => ({ ...current, from: event.target.value }))
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-gray-600">
            {tc("to")}
          </span>
          <CustomDateTimeInput
            type="date"
            value={draftFilters.to}
            onChange={(event) =>
              setDraftFilters((current) => ({ ...current, to: event.target.value }))
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-vr-600"
        >
          <FiFilter />
          {tc("filter")}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-700">
                <th className="px-5 py-3">{t("activityLogs.time")}</th>
                <th className="px-5 py-3">{t("activityLogs.actor")}</th>
                <th className="px-5 py-3">{t("activityLogs.action")}</th>
                <th className="px-5 py-3">{t("activityLogs.ipAddress")}</th>
                <th className="px-5 py-3">{t("activityLogs.userAgent")}</th>
                <th className="px-5 py-3 text-center">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-gray-900">
                      {log.actor?.displayName || "-"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{log.actor?.email || "-"}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full bg-vr-50 px-2.5 py-1 font-mono text-xs font-semibold text-vr-800">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-gray-600">
                    {log.ipAddress || "-"}
                  </td>
                  <td className="max-w-xs truncate px-5 py-4 text-xs text-gray-500">
                    {log.userAgent || "-"}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => setSelected(log)}
                      className={actionButtonClass}
                      title={tc("details")}
                      aria-label={tc("details")}
                    >
                      <FiEye />
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-500">
                    {t("activityLogs.empty")}
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-500">
                    {t("activityLogs.loading")}
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

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        wide
        icon={<FiFileText size={20} />}
        title={t("activityLogs.detailTitle")}
        subtitle={selected?.action}
        footer={
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {tc("close")}
          </button>
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label={t("activityLogs.logId")} value={selected.id} />
              <DetailItem label={t("activityLogs.time")} value={formatDateTime(selected.createdAt)} />
              <DetailItem label={t("activityLogs.action")} value={selected.action} />
              <DetailItem label={t("activityLogs.actor")} value={selected.actor?.displayName || "-"} />
              <DetailItem label={tc("email")} value={selected.actor?.email || "-"} />
              <DetailItem label={t("activityLogs.actorId")} value={selected.actor?.id || "-"} />
              <DetailItem label={t("activityLogs.ipAddress")} value={selected.ipAddress || "-"} />
              <DetailItem label={t("users.role")} value={selected.actor?.role || "-"} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-gray-900">
                {t("activityLogs.metadata")}
              </p>
              <pre className="max-h-80 overflow-auto rounded-lg border border-gray-200 bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(selected.metadata ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
