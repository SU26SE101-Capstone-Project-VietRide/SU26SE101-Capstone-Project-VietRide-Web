import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiActivity, FiArrowDown, FiArrowUp, FiMap, FiRefreshCw } from "react-icons/fi";
import { getOperatorRoutes, getOperatorStations, type OperatorRoute, type OperatorStation } from "../../../api/vietride";
import { StatCard } from "../../../components/StatCard";
import Pagination from "../../../components/Pagination";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import CustomSelect from "../../../components/CustomSelect";
import { SearchInput } from "../../../components/ui/SearchInput";
import { Badge } from "../../../components/ui/Badge";

const PAGE_SIZE = 10;
const inputClass = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100";

export default function ManagerRouteManagementPage() {
  const { t, i18n } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const [items, setItems] = useState<OperatorRoute[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [originStationId, setOriginStationId] = useState("");
  const [destinationStationId, setDestinationStationId] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "totalDistanceKm" | "estimatedDurationMinutes">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [stations, setStations] = useState<OperatorStation[]>([]);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true); setError("");
    try {
      // BE nhận boolean `isActive`, không nhận `status` — gửi `status` là 422.
      const result = await getOperatorRoutes({
        page,
        pageSize: PAGE_SIZE,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(status ? { isActive: status === "ACTIVE" } : {}),
        ...(originStationId ? { originStationId } : {}),
        ...(destinationStationId ? { destinationStationId } : {}),
        sortBy,
        sortDir,
      });
      setItems(result.items); setTotalItems(result.totalItems); setTotalPages(result.totalPages); setHasNextPage(result.hasNextPage); setHasPreviousPage(result.hasPreviousPage);
    } catch (loadError) { setItems([]); setTotalItems(0); setError(loadError instanceof Error ? loadError.message : t("routeManagement.loadFailed")); } finally { setIsLoading(false); }
  }, [destinationStationId, originStationId, page, search, sortBy, sortDir, status, t]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  // Danh sách bến cho hai ô chọn bến đi/bến đến
  useEffect(() => {
    let ignore = false;
    void getOperatorStations({ page: 1, pageSize: 100, sortBy: "name", sortDir: "asc" })
      .then((result) => { if (!ignore) setStations(result.items); })
      .catch(() => { /* thiếu ô lọc bến không chặn bảng chính */ });
    return () => { ignore = true; };
  }, []);
  useToastFeedback({ message: "", error });
  const activeCount = useMemo(() => items.filter((route) => route.isActive).length, [items]);
  const inactiveCount = items.length - activeCount;
  const distance = useMemo(() => items.reduce((sum, route) => sum + (route.totalDistanceKm || 0), 0), [items]);
  const distanceLabel = i18n.language.startsWith("vi") ? "Khoảng cách" : "Distance";
  const viewRouteLabel = i18n.language.startsWith("vi") ? "Xem tuyến & điểm dừng" : "View route & stops";

  function toggleSort(nextSortBy: typeof sortBy) {
    if (sortBy === nextSortBy) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(nextSortBy);
      setSortDir("asc");
    }
    setPage(1);
  }

  function sortIcon(column: typeof sortBy) {
    if (sortBy !== column) return <span aria-hidden="true" className="text-base leading-none text-gray-500">↕</span>;
    return sortDir === "asc" ? <FiArrowUp aria-hidden="true" size={14} /> : <FiArrowDown aria-hidden="true" size={14} />;
  }

  return <div className="space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-3xl font-bold text-gray-900">{t("routeManagement.title")}</h1><p className="mt-1 max-w-3xl text-sm text-gray-600">{t("routeManagement.subtitle")}</p></div><button type="button" onClick={() => void load()} disabled={isLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"><FiRefreshCw size={16} className={isLoading ? "animate-spin" : ""} />{tc("refresh")}</button></header>
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label={t("routeManagement.total")} value={totalItems} icon={<FiMap size={20} />} iconClassName="bg-vr-50 text-vr-900" isLoading={isLoading} /><StatCard label={t("routeManagement.active")} value={activeCount} icon={<FiActivity size={20} />} iconClassName="bg-emerald-50 text-emerald-600" isLoading={isLoading} /><StatCard label={distanceLabel} value={`${distance.toLocaleString("vi-VN")} km`} icon={<FiMap size={20} />} iconClassName="bg-amber-50 text-amber-700" isLoading={isLoading} /></div>
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"><div className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_180px_200px_200px]"><SearchInput
  label={t("routeManagement.searchLabel")}
  value={search}
  onChange={(event) => { setSearch(event.target.value); setPage(1); }}
  placeholder={t("routeManagement.searchPlaceholder")}
  inputClassName={`${inputClass} pl-9`}
  wrapperClassName="relative"
/><CustomSelect aria-label={tc("status")} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className={`${inputClass} min-h-11`}><option value="">{tc("all")}</option><option value="ACTIVE">{tc("active")}</option><option value="INACTIVE">{tc("inactive")}</option></CustomSelect><CustomSelect aria-label={t("routeManagement.filterOrigin")} value={originStationId} onChange={(event) => { setOriginStationId(event.target.value); setPage(1); }} className={`${inputClass} min-h-11`}><option value="">{t("routeManagement.allOrigins")}</option>{stations.map((station) => <option key={station.id} value={station.stationId ?? station.id}>{station.station?.name ?? station.displayNameOverride ?? station.id}</option>)}</CustomSelect><CustomSelect aria-label={t("routeManagement.filterDestination")} value={destinationStationId} onChange={(event) => { setDestinationStationId(event.target.value); setPage(1); }} className={`${inputClass} min-h-11`}><option value="">{t("routeManagement.allDestinations")}</option>{stations.map((station) => <option key={station.id} value={station.stationId ?? station.id}>{station.station?.name ?? station.displayNameOverride ?? station.id}</option>)}</CustomSelect></div>
      {error ? <p className="px-5 py-10 text-center text-sm text-red-600">{error}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] table-fixed divide-y divide-gray-100 text-center text-sm"><thead className="bg-gray-50 text-center text-xs font-semibold uppercase tracking-wide text-gray-500"><tr><th aria-sort={sortBy === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="w-[18%] px-5 py-3 text-center"><button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center justify-center gap-1.5 font-semibold transition hover:text-vr-900" aria-label={t("routeManagement.sortName")}>{t("routeManagement.name")}{sortIcon("name")}</button></th><th className="w-[26%] px-5 py-3 text-left">{t("routeManagement.terminals")}</th><th aria-sort={sortBy === "totalDistanceKm" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="w-[11%] px-5 py-3 text-center"><button type="button" onClick={() => toggleSort("totalDistanceKm")} className="inline-flex items-center justify-center gap-1.5 font-semibold transition hover:text-vr-900" aria-label={t("routeManagement.sortDistance")}>{distanceLabel}{sortIcon("totalDistanceKm")}</button></th><th aria-sort={sortBy === "estimatedDurationMinutes" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="w-[14%] px-5 py-3 text-center"><button type="button" onClick={() => toggleSort("estimatedDurationMinutes")} className="inline-flex items-center justify-center gap-1.5 font-semibold transition hover:text-vr-900" aria-label={t("routeManagement.sortDuration")}>{t("routeManagement.duration")}{sortIcon("estimatedDurationMinutes")}</button></th><th className="w-[10%] px-5 py-3 text-center">{tc("status")}</th><th className="w-[21%] px-5 py-3 text-center">{tc("actions")}</th></tr></thead><tbody className="divide-y divide-gray-100">{items.map((route) => { const origin = route.originStation?.name || route.originStationId; const destination = route.destinationStation?.name || route.destinationStationId; return <tr key={route.id} className="transition-colors hover:bg-gray-50"><td className="px-5 py-4 align-middle text-center"><p className="break-words font-semibold text-gray-900">{route.name}</p></td><td className="px-5 py-4 align-middle text-left"><div className="flex min-w-0 flex-col items-start gap-1 text-left text-gray-600"><span className="break-words leading-5">{origin}</span><FiArrowDown aria-hidden="true" className="text-vr-500" size={15} /><span className="break-words leading-5">{destination}</span></div></td><td className="px-5 py-4 align-middle text-center text-gray-600">{route.totalDistanceKm.toLocaleString("vi-VN")} km</td><td className="px-5 py-4 align-middle text-center text-gray-600">{route.estimatedDurationMinutes} {t("routeManagement.minutes")}</td><td className="px-5 py-4 align-middle text-center"><Badge tone={route.isActive ? "success" : "neutral"}>{route.isActive ? tc("active") : tc("inactive")}</Badge></td><td className="px-5 py-4 align-middle text-center"><button type="button" onClick={() => navigate(`/manager/routes?routeId=${encodeURIComponent(route.id)}&tab=info`)} aria-label={`${viewRouteLabel}: ${route.name}`} className="inline-flex min-h-9 max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-vr-200 bg-vr-50 px-3 py-2 text-xs font-semibold text-vr-900 transition hover:border-vr-300 hover:bg-vr-100 focus:outline-none focus:ring-2 focus:ring-vr-200"><FiMap aria-hidden="true" size={15} />{viewRouteLabel}</button></td></tr>; })}</tbody></table>{!isLoading && items.length === 0 && <p className="px-5 py-10 text-center text-sm text-gray-500">{t("routeManagement.empty")}</p>}</div>}
      <Pagination page={page} pageSize={PAGE_SIZE} totalItems={totalItems} totalPages={totalPages} hasNextPage={hasNextPage} hasPreviousPage={hasPreviousPage} onPageChange={setPage} /></section>
    <span className="sr-only">{inactiveCount}</span>
  </div>;
}
