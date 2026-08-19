import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiMapPin, FiRefreshCw } from "react-icons/fi";
import { getOperatorStations, type OperatorStation } from "../../../api/vietride";
import { StatCard } from "../../../components/StatCard";
import Pagination from "../../../components/Pagination";
import CustomSelect from "../../../components/CustomSelect";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useLatestRequest } from "../../../hooks/useLatestRequest";
import { SearchInput } from "../../../components/ui/SearchInput";
import { Badge } from "../../../components/ui/Badge";

const PAGE_SIZE = 10;
const inputClass = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100";

function stationName(item: OperatorStation) {
  return item.displayNameOverride?.trim() || item.station?.name || "-";
}

function stationAddress(item: OperatorStation) {
  return item.station?.address || item.station?.addressStreet || "-";
}

export default function ManagerStationsPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [items, setItems] = useState<OperatorStation[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [shuttleFilter, setShuttleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const startRequest = useLatestRequest();

  const load = useCallback(async () => {
    const isLatest = startRequest();
    setIsLoading(true);
    setError("");
    try {
      // `isActive` là cờ của liên kết nhà xe–bến; `supportsShuttle` là cờ của
      // chính cái bến. BE coi đây là hai khái niệm riêng, không gộp.
      const result = await getOperatorStations({
        page,
        pageSize: PAGE_SIZE,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(activeFilter ? { isActive: activeFilter === "ACTIVE" } : {}),
        ...(shuttleFilter ? { supportsShuttle: shuttleFilter === "SHUTTLE" } : {}),
        sortBy: "name",
        sortDir: "asc",
      });
      if (!isLatest()) return;
      setItems(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
      setHasNextPage(result.hasNextPage);
      setHasPreviousPage(result.hasPreviousPage);
    } catch (loadError) {
      if (!isLatest()) return;
      setItems([]);
      setTotalItems(0);
      setError(loadError instanceof Error ? loadError.message : t("stations.loadFailed"));
    } finally {
      if (isLatest()) setIsLoading(false);
    }
  }, [activeFilter, page, search, shuttleFilter, startRequest, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useToastFeedback({ message: "", error });

  const activeCount = useMemo(() => items.filter((item) => item.isActive !== false).length, [items]);
  const shuttleCount = useMemo(() => items.filter((item) => item.station?.supportsShuttle).length, [items]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("stations.title")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">{t("stations.subtitle")}</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={isLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60">
          <FiRefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> {tc("refresh")}
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("stations.total")} value={totalItems} icon={<FiMapPin size={20} />} iconClassName="bg-vr-50 text-vr-900" isLoading={isLoading} />
        <StatCard label={t("stations.active")} value={activeCount} icon={<FiMapPin size={20} />} iconClassName="bg-emerald-50 text-emerald-600" isLoading={isLoading} />
        <StatCard label={t("stations.shuttle")} value={shuttleCount} icon={<FiMapPin size={20} />} iconClassName="bg-amber-50 text-amber-700" isLoading={isLoading} />
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_220px]">
            <SearchInput
              label={t("stations.searchLabel")}
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder={t("stations.searchPlaceholder")}
              inputClassName={`${inputClass} pl-9`}
              wrapperClassName="relative"
            />
            <CustomSelect aria-label={t("stations.filterActive")} value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(1); }} className={inputClass}>
              <option value="">{t("stations.allActive")}</option>
              <option value="ACTIVE">{tc("active")}</option>
              <option value="INACTIVE">{tc("inactive")}</option>
            </CustomSelect>
            <CustomSelect aria-label={t("stations.filterShuttle")} value={shuttleFilter} onChange={(event) => { setShuttleFilter(event.target.value); setPage(1); }} className={inputClass}>
              <option value="">{t("stations.allShuttle")}</option>
              <option value="SHUTTLE">{t("stations.shuttleOnly")}</option>
              <option value="NON_SHUTTLE">{t("stations.nonShuttleOnly")}</option>
            </CustomSelect>
          </div>
        </div>
        {error ? <p className="px-5 py-10 text-center text-sm text-red-600">{error}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-[25%] px-5 py-3 text-left">{t("stations.name")}</th>
                  <th className="w-[43%] px-5 py-3 text-left">{t("stations.address")}</th>
                  <th className="w-[16%] px-5 py-3 text-center whitespace-nowrap">{t("stations.shuttle")}</th>
                  <th className="w-[16%] px-5 py-3 text-center">{tc("status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-5 py-4 align-middle text-left">
                      <p className="break-words font-semibold text-gray-900">{stationName(item)}</p>
                    </td>
                    <td className="px-5 py-4 align-middle text-left text-gray-600" title={stationAddress(item)}>
                      <p className="break-words">{stationAddress(item)}</p>
                    </td>
                    <td className="px-5 py-4 align-middle text-center text-gray-600">{item.station?.supportsShuttle ? tc("yes") : tc("no")}</td>
                    <td className="px-5 py-4 align-middle text-center"><Badge tone={item.isActive !== false ? "success" : "neutral"}>{item.isActive !== false ? tc("active") : tc("inactive")}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && items.length === 0 && <p className="px-5 py-10 text-center text-sm text-gray-500">{t("stations.empty")}</p>}
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} totalItems={totalItems} totalPages={totalPages} hasNextPage={hasNextPage} hasPreviousPage={hasPreviousPage} onPageChange={setPage} />
      </section>
    </div>
  );
}
