import { useCallback, useEffect, useRef, useState } from "react";
import { FiActivity, FiSearch, FiX } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { getAdminActivityLogs, getAdminUsers, type AdminActivityLog, type AdminUser, type PagedResult } from "../../../api/vietride";
import { ActivityLogDetails } from "./ActivityLogDetails";
import { ActivityLogTable } from "./ActivityLogTable";
import { localDateToUtcExclusiveEnd, localDateToUtcStart } from "./activityLogFilters";
import CustomSelect from "../../../components/CustomSelect";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";

const DEFAULT_PAGE_SIZE = 20;
const ACTION_GROUPS = [
  { key: "users", actions: ["LOCK_USER", "UNLOCK_USER"] },
  { key: "operators", actions: ["APPROVE_OPERATOR", "REJECT_OPERATOR", "SUSPEND_OPERATOR"] },
  { key: "stations", actions: ["STATION_MERGED"] },
] as const;

const emptyPage = (page: number, pageSize: number): PagedResult<AdminActivityLog> => ({ items: [], page, pageSize, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false });

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default function ActivityLogs() {
  const { t } = useTranslation("admin");
  const [searchParams, setSearchParams] = useSearchParams();
  const page = positiveInteger(searchParams.get("page"), 1);
  const pageSize = positiveInteger(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
  const userId = searchParams.get("userId") ?? "";
  const action = searchParams.get("action") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const actorParam = searchParams.get("actor") ?? "";
  const [actorQuery, setActorQuery] = useState(actorParam);
  const [actorOptions, setActorOptions] = useState<AdminUser[]>([]);
  const [isSearchingActors, setIsSearchingActors] = useState(false);
  const [result, setResult] = useState<PagedResult<AdminActivityLog>>(() => emptyPage(page, pageSize));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AdminActivityLog | null>(null);
  const logRequestId = useRef(0);
  const actorRequestId = useRef(0);

  const updateFilters = useCallback((changes: Record<string, string | number | undefined>, resetPage = true) => {
    setIsLoading(true);
    setError(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(changes).forEach(([key, value]) => {
        if (value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      });
      if (resetPage) next.set("page", "1");
      if (!next.has("pageSize")) next.set("pageSize", String(DEFAULT_PAGE_SIZE));
      return next;
    });
  }, [setSearchParams]);

  useEffect(() => {
    const requestId = ++logRequestId.current;
    void getAdminActivityLogs({
      page,
      pageSize,
      ...(userId ? { userId } : {}),
      ...(action ? { action } : {}),
      ...(from ? { from: localDateToUtcStart(from) } : {}),
      ...(to ? { to: localDateToUtcExclusiveEnd(to) } : {}),
    }).then((nextResult) => {
      if (requestId !== logRequestId.current) return;
      setResult(nextResult);
    }).catch(() => {
      if (requestId !== logRequestId.current) return;
      setError("load-failed");
      setResult(emptyPage(page, pageSize));
    }).finally(() => {
      if (requestId === logRequestId.current) setIsLoading(false);
    });
  }, [action, from, page, pageSize, retryVersion, to, userId]);

  useEffect(() => {
    if (actorQuery.trim().length < 2 || userId) return;
    const timeout = window.setTimeout(() => {
      const requestId = ++actorRequestId.current;
      setIsSearchingActors(true);
      void getAdminUsers({ search: actorQuery.trim(), page: 1, pageSize: 10 }).then((users) => {
        if (requestId === actorRequestId.current) setActorOptions(users.items);
      }).catch(() => {
        if (requestId === actorRequestId.current) setActorOptions([]);
      }).finally(() => {
        if (requestId === actorRequestId.current) setIsSearchingActors(false);
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [actorQuery, userId]);

  const clearFilters = () => {
    setIsLoading(true);
    setError(null);
    setActorQuery("");
    setActorOptions([]);
    setSearchParams((current) => {
      const next = new URLSearchParams();
      next.set("page", "1");
      next.set("pageSize", current.get("pageSize") ?? String(DEFAULT_PAGE_SIZE));
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-4"><div className="rounded-2xl bg-vr-50 p-3 text-vr-700"><FiActivity size={24} /></div><div><h1 className="text-2xl font-bold text-slate-900">{t("activityLogs.title")}</h1><p className="mt-1 text-sm text-slate-600">{t("activityLogs.subtitle")}</p></div></header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label={t("activityLogs.filters")}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2"><label htmlFor="activity-actor" className="mb-1.5 block text-sm font-semibold text-slate-700">{t("activityLogs.actorFilter")}</label><div className="relative"><FiSearch className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input id="activity-actor" value={actorQuery} autoComplete="off" onChange={(event) => { actorRequestId.current += 1; setIsSearchingActors(false); setActorOptions([]); setActorQuery(event.target.value); updateFilters({ userId: undefined, actor: undefined }); }} placeholder={t("activityLogs.actorPlaceholder")} className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-9 text-sm outline-none focus:border-vr-500 focus:ring-2 focus:ring-vr-100" />{actorQuery && <button type="button" onClick={() => { actorRequestId.current += 1; setIsSearchingActors(false); setActorOptions([]); setActorQuery(""); updateFilters({ userId: undefined, actor: undefined }); }} aria-label={t("activityLogs.clearActor")} className="absolute right-2.5 top-2.5 p-1 text-slate-400"><FiX /></button>}</div>{(isSearchingActors || actorOptions.length > 0) && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">{isSearchingActors ? <p className="px-4 py-3 text-sm text-slate-500">{t("activityLogs.searchingActors")}</p> : actorOptions.map((user) => <button key={user.userId} type="button" onClick={() => { const label = `${user.displayName} (${user.email})`; setActorQuery(label); setActorOptions([]); updateFilters({ userId: user.userId, actor: label }); }} className="block w-full px-4 py-3 text-left hover:bg-slate-50"><span className="block text-sm font-semibold text-slate-900">{user.displayName}</span><span className="block text-xs text-slate-500">{user.email} · {user.role}</span></button>)}</div>}</div>
          <div><span className="mb-1.5 block text-sm font-semibold text-slate-700">{t("activityLogs.actionFilter")}</span><CustomSelect aria-label={t("activityLogs.actionFilter")} value={action} onChange={(event) => updateFilters({ action: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">{t("activityLogs.allActions")}</option>{ACTION_GROUPS.flatMap((group) => [<option key={`${group.key}-heading`} value={`__${group.key}`} disabled>{t(`activityLogs.actionGroups.${group.key}`)}</option>, ...group.actions.map((item) => <option key={item} value={item}>{t(`activityLogs.actions.${item}`)}</option>)])}</CustomSelect></div>
          <label className="min-w-0"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{t("activityLogs.from")}</span><CustomDateTimeInput type="date" value={from} max={to || undefined} onChange={(event) => updateFilters({ from: event.target.value })} placeholder={t("activityLogs.from")} aria-label={t("activityLogs.from")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label>
          <label className="min-w-0"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{t("activityLogs.to")}</span><CustomDateTimeInput type="date" value={to} min={from || undefined} onChange={(event) => updateFilters({ to: event.target.value })} placeholder={t("activityLogs.to")} aria-label={t("activityLogs.to")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={clearFilters} className="text-sm font-semibold text-slate-600 hover:text-slate-900">{t("activityLogs.clearFilters")}</button><label className="flex items-center gap-2 text-sm font-medium text-slate-600">{t("activityLogs.pageSize")}<select aria-label={t("activityLogs.pageSize")} value={pageSize} onChange={(event) => updateFilters({ pageSize: event.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5">{[20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label></div>
      </section>

      <ActivityLogTable result={result} isLoading={isLoading} error={error} onRetry={() => { setIsLoading(true); setError(null); setRetryVersion((value) => value + 1); }} onPageChange={(nextPage) => updateFilters({ page: nextPage }, false)} onViewDetails={setSelectedLog} />
      <ActivityLogDetails log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}




