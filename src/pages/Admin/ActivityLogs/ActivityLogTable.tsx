import { FiEye } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import type { AdminActivityLog, PagedResult } from "../../../api/vietride";
import Pagination from "../../../components/Pagination";
import { TableSkeletonRows } from "../../../components/TableSkeletonRows";
import { formatIpAddress, getActionPresentation, getActivityContext } from "./activityLogPresentation";

type ActivityLogTableProps = {
  result: PagedResult<AdminActivityLog>;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onViewDetails: (log: AdminActivityLog) => void;
};

export function ActivityLogTable({ result, isLoading, error, onRetry, onPageChange, onViewDetails }: ActivityLogTableProps) {
  const { t, i18n } = useTranslation("admin");
  const formatTime = (value: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  if (error && !isLoading) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center"><p className="font-semibold text-red-800">{t("activityLogs.loadFailed")}</p><button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">{t("activityLogs.retry")}</button></div>;
  }

  if (!isLoading && result.items.length === 0) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><p className="font-semibold text-slate-800">{t("activityLogs.empty")}</p><p className="mt-1 text-sm text-slate-500">{t("activityLogs.emptyHint")}</p></div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-busy={isLoading}>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50"><tr>{["time", "actor", "action", "context", "ip", "details"].map((key) => <th key={key} scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t(`activityLogs.${key}`)}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <TableSkeletonRows columns={6} rows={6} testId="activity-log-skeleton" /> : result.items.map((log) => {
              const action = getActionPresentation(log.action, i18n.language);
              return <tr key={log.id} className="hover:bg-slate-50/70"><td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">{formatTime(log.createdAt)}</td><td className="px-4 py-4"><p className="text-sm font-semibold text-slate-900">{log.actor.displayName}</p><p className="text-xs text-slate-500">{log.actor.email}</p><p className="mt-1 text-xs font-medium text-slate-600">{log.actor.role}</p></td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${action.badgeClassName}`}>{action.label}</span></td><td className="max-w-xs px-4 py-4 text-sm text-slate-700">{getActivityContext(log.action, log.metadata, i18n.language)}</td><td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-slate-600">{formatIpAddress(log.ipAddress)}</td><td className="px-4 py-4"><button type="button" onClick={() => onViewDetails(log)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><FiEye />{t("activityLogs.view")}</button></td></tr>;
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {isLoading ? Array.from({ length: 4 }, (_, index) => <div key={index} data-testid={index === 0 ? "activity-log-mobile-skeleton" : undefined} className="animate-pulse p-5"><div className="h-4 w-2/3 rounded bg-slate-200" /><div className="mt-3 h-4 w-full rounded bg-slate-200" /><div className="mt-3 h-8 w-1/3 rounded bg-slate-200" /></div>) : result.items.map((log) => {
          const action = getActionPresentation(log.action, i18n.language);
          return <article key={log.id} className="space-y-3 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{log.actor.displayName}</p><p className="text-xs text-slate-500">{formatTime(log.createdAt)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${action.badgeClassName}`}>{action.label}</span></div><p className="text-sm text-slate-700">{getActivityContext(log.action, log.metadata, i18n.language)}</p><div className="flex items-center justify-between"><span className="font-mono text-xs text-slate-500">{formatIpAddress(log.ipAddress)}</span><button type="button" onClick={() => onViewDetails(log)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><FiEye />{t("activityLogs.view")}</button></div></article>;
        })}
      </div>

      {!isLoading && <Pagination page={result.page} pageSize={result.pageSize} totalItems={result.totalItems} totalPages={result.totalPages} hasNextPage={result.hasNextPage} hasPreviousPage={result.hasPreviousPage} onPageChange={onPageChange} />}
    </div>
  );
}


