import { useToastFeedback } from "../../../hooks/useToastFeedback";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheckCircle,
  FiEdit2,
  FiPackage,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSave,
  FiTruck,
  FiXCircle,
} from "react-icons/fi";
import {
  batchUpdateOperatorParcelRouteFares,
  getOperatorParcelReportSummary,
  getOperatorParcelRouteFares,
  getOperatorRoutes,
  type OperatorParcelReportSummary,
  type OperatorRoute,
  type ParcelRouteFare,
  type ParcelSizeCategory,
  updateOperatorParcelRouteFare,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import CurrencyInput from "../../../components/CurrencyInput";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";
import { StatCard } from "../../../components/StatCard";
import { formatCurrency } from "../../../utils/currency";
import Pagination from "../../../components/Pagination";
import { formatDateTime } from "../../../utils/date";
import ParcelQueue from "./ParcelQueue";
import {
  inputClass,
  labelClass,
} from "../../../components/form/formClasses";
type FareSort = "priceAsc" | "priceDesc";

const parcelSizeCategories: ParcelSizeCategory[] = [
  "SMALL",
  "MEDIUM",
  "LARGE",
  "EXTRA_LARGE",
];

function createEmptyFarePrices(): Record<ParcelSizeCategory, string> {
  return {
    SMALL: "",
    MEDIUM: "",
    LARGE: "",
    EXTRA_LARGE: "",
  };
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIsoDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function currentLocalDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function toLocalDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
function formatMoney(value = 0) {
  return formatCurrency(value);
}

function formatDate(value?: string | null) {
  return formatDateTime(value);
}


export default function ParcelsList() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const user = getAuthUser();
  const canManageRouteFares = user?.role === "OPERATOR_ADMIN";
  const [summary, setSummary] = useState<OperatorParcelReportSummary | null>(null);
  const [routeFares, setRouteFares] = useState<ParcelRouteFare[]>([]);
  const [routes, setRoutes] = useState<OperatorRoute[]>([]);
  const [fromDate] = useState(monthStartIsoDate());
  const [toDate] = useState(todayIsoDate());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [farePage, setFarePage] = useState(1);
  const [fareSearch, setFareSearch] = useState("");
  const [fareSizeFilter, setFareSizeFilter] = useState<"" | ParcelSizeCategory>("");
  const [fareSort, setFareSort] = useState<FareSort>("priceAsc");
  const [fareRouteId, setFareRouteId] = useState("");
  const [fareSizeCategory, setFareSizeCategory] = useState<ParcelSizeCategory>("SMALL");
  const [farePrice, setFarePrice] = useState("");
  const [farePrices, setFarePrices] = useState(createEmptyFarePrices);
  const [fareEffectiveFrom, setFareEffectiveFrom] = useState(currentLocalDateTime);
  const [fareEffectiveUntil, setFareEffectiveUntil] = useState("");
  const [editingFare, setEditingFare] = useState<ParcelRouteFare | null>(null);
  const [isFareModalOpen, setIsFareModalOpen] = useState(false);
  const [isFareSaving, setIsFareSaving] = useState(false);
  const [fareMessage, setFareMessage] = useState("");
  const [fareError, setFareError] = useState("");
  useToastFeedback({ message: fareMessage, error: error || fareError });
  const pageSize = 8;

  const pendingActionCount = useMemo(() => summary?.totalRejected ?? 0, [summary]);
  const filteredRouteFares = useMemo(() => {
    const query = fareSearch.trim().toLocaleLowerCase();
    return routeFares
      .filter((fare) => {
        const routeName = routes.find((route) => route.id === fare.routeId)?.name ?? "";
        const matchesSearch = !query || routeName.toLocaleLowerCase().includes(query);
        const matchesSize = !fareSizeFilter || fare.sizeCategory === fareSizeFilter;
        return matchesSearch && matchesSize;
      })
      .sort((left, right) => fareSort === "priceAsc" ? left.priceVnd - right.priceVnd : right.priceVnd - left.priceVnd);
  }, [fareSearch, fareSizeFilter, fareSort, routeFares, routes]);

  const paginatedRouteFares = useMemo(
    () => filteredRouteFares.slice((farePage - 1) * pageSize, farePage * pageSize),
    [farePage, filteredRouteFares],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [
        summaryResult,
        fareResult,
        routeResult,      ] = await Promise.all([getOperatorParcelReportSummary({
          from: fromDate,
          to: toDate,
        }),
        getOperatorParcelRouteFares({ page: 1, pageSize: 100 }),
        getOperatorRoutes({ page: 1, pageSize: 100 }),
      ]);

      setSummary(summaryResult);
      setRouteFares(fareResult.items);
      setRoutes(routeResult.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : tRef.current("parcels.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate]);

  function resetFareForm() {
    setEditingFare(null);
    setFareRouteId("");
    setFareSizeCategory("SMALL");
    setFarePrice("");
    setFarePrices(createEmptyFarePrices());
    setFareEffectiveFrom(currentLocalDateTime());
    setFareEffectiveUntil("");
    setFareError("");
    setFareMessage("");
    setIsFareModalOpen(false);
  }

  function handleEditFare(fare: ParcelRouteFare) {
    setEditingFare(fare);
    setFareRouteId(fare.routeId);
    setFareSizeCategory(fare.sizeCategory);
    setFarePrice(String(fare.priceVnd));
    setFareEffectiveFrom(toLocalDateTime(fare.effectiveFrom));
    setFareEffectiveUntil(toLocalDateTime(fare.effectiveUntil));
    setFareError("");
    setFareMessage("");
    setIsFareModalOpen(true);
  }

  async function handleSaveFare() {
    const batchItems = parcelSizeCategories.map((sizeCategory) => ({
      sizeCategory,
      priceVnd: Number(farePrices[sizeCategory]),
    }));
    const hasInvalidBatchPrice = batchItems.some(
      (item) => !Number.isFinite(item.priceVnd) || item.priceVnd <= 0,
    );

    if (
      !fareRouteId ||
      !fareEffectiveFrom ||
      (editingFare
        ? !farePrice || Number(farePrice) <= 0
        : hasInvalidBatchPrice)
    ) {
      setFareError(t(editingFare ? "parcels.fareRequired" : "parcels.batchFareRequired"));
      return;
    }

    setIsFareSaving(true);
    setFareError("");
    setFareMessage("");
    try {
      const effectiveUntil = fareEffectiveUntil
        ? new Date(fareEffectiveUntil).toISOString()
        : null;
      const effectiveFrom = new Date(fareEffectiveFrom).toISOString();

      if (editingFare) {
        await updateOperatorParcelRouteFare(
          editingFare.routeId,
          editingFare.sizeCategory,
          {
            priceVnd: Number(farePrice),
            effectiveFrom,
            effectiveUntil,
          },
        );
      } else {
        await batchUpdateOperatorParcelRouteFares(fareRouteId, {
          effectiveFrom,
          effectiveUntil,
          items: batchItems,
        });
      }

      const result = await getOperatorParcelRouteFares({ page: 1, pageSize: 100 });
      setRouteFares(result.items);
      setFareMessage(t(editingFare ? "parcels.fareUpdated" : "parcels.batchFareCreated"));
      setEditingFare(null);
      setIsFareModalOpen(false);
      setFareRouteId("");
      setFarePrice("");
      setFarePrices(createEmptyFarePrices());
      setFareEffectiveUntil("");
      setFareEffectiveFrom(currentLocalDateTime());
    } catch (err) {
      setFareError(err instanceof Error ? err.message : t("parcels.fareSaveFailed"));
    } finally {
      setIsFareSaving(false);
    }
  }
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("parcels.title")}
          </h1>
          <p className="mt-1 text-gray-600">{t("parcels.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <FiRefreshCw size={16} />
          {tc("refresh")}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<FiPackage />} label={t("parcels.todayOrders")} value={summary?.totalParcels ?? 0} iconClassName="bg-vr-50 text-vr-700" />
        <StatCard icon={<FiTruck />} label={t("parcels.inTransit")} value={summary?.totalLoaded ?? 0} iconClassName="bg-blue-50 text-blue-700" />
        <StatCard icon={<FiCheckCircle />} label={t("parcels.delivered")} value={summary?.totalDelivered ?? 0} iconClassName="bg-emerald-50 text-emerald-700" />
        <StatCard icon={<FiXCircle />} label={t("parcels.needsAction")} value={pendingActionCount} iconClassName="bg-amber-50 text-amber-700" />
      </div>
      <ParcelQueue />

      <main className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-5">
              <h2 className="text-lg font-bold text-gray-900">
                {t("parcels.routeFares")}
              </h2>
              <p className="text-sm text-gray-500">
                {t("parcels.routeFaresHint")}
              </p>
            </div>
            {canManageRouteFares && (
              <div className="flex justify-end border-b border-gray-100 bg-gray-50/60 p-4">
                <button type="button" onClick={() => { resetFareForm(); setIsFareModalOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-vr-600">
                  <FiPlus size={16} />{t("parcels.createFare")}
                </button>
              </div>
            )}
            <Modal
              open={isFareModalOpen}
              onClose={resetFareForm}
              title={editingFare ? t("parcels.editFare") : t("parcels.createFare")}
              subtitle={t("parcels.fareFormHint")}
              icon={<FiPackage size={20} />}
              wide
              footer={<>
                <button type="button" onClick={resetFareForm} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t("parcels.cancelEdit")}</button>
                <button type="button" disabled={isFareSaving} onClick={() => void handleSaveFare()} className="inline-flex min-w-44 items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  {editingFare ? <FiSave /> : <FiPlus />}{editingFare ? t("parcels.updateFare") : t("parcels.addFareBatch")}
                </button>
              </>}
            >
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <label><span className={labelClass}>{t("parcels.route")}</span><CustomSelect value={fareRouteId} disabled={Boolean(editingFare)} onChange={(event) => setFareRouteId(event.target.value)} className={inputClass}>
                    <option value="">{t("parcels.selectRoute")}</option>{routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
                  </CustomSelect></label>
                  {editingFare && <><label><span className={labelClass}>{t("parcels.sizeCategory")}</span><CustomSelect value={fareSizeCategory} disabled onChange={(event) => setFareSizeCategory(event.target.value as ParcelSizeCategory)} className={inputClass}>
                    {parcelSizeCategories.map((size) => <option key={size} value={size}>{t(`parcels.sizeCategories.${size}`)}</option>)}
                  </CustomSelect></label><label><span className={labelClass}>{t("parcels.fee")}</span><CurrencyInput value={farePrice} onChange={(event) => setFarePrice(event.target.value)} className={inputClass} placeholder="50.000" /></label></>}
                  <label><span className={labelClass}>{t("parcels.effectiveFrom")}</span><CustomDateTimeInput type="datetime-local" value={fareEffectiveFrom} onChange={(event) => setFareEffectiveFrom(event.target.value)} className={inputClass} /></label>
                  <label><span className={labelClass}>{t("parcels.effectiveUntil")}</span><CustomDateTimeInput type="datetime-local" value={fareEffectiveUntil} onChange={(event) => setFareEffectiveUntil(event.target.value)} className={inputClass} /></label>
                </div>
                {!editingFare && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{parcelSizeCategories.map((sizeCategory) => <label key={sizeCategory}><span className={labelClass}>{t(`parcels.sizeCategories.${sizeCategory}`)}</span><CurrencyInput value={farePrices[sizeCategory]} onChange={(event) => setFarePrices((current) => ({ ...current, [sizeCategory]: event.target.value }))} className={inputClass} placeholder="0" /></label>)}</div>}
                {fareError && <p className="text-sm font-medium text-red-600">{fareError}</p>}
                {fareMessage && <p className="text-sm font-medium text-emerald-700">{fareMessage}</p>}
              </div>
            </Modal>
            <div className="border-b border-gray-100 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">{t("parcels.fareSearch")}</span>
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input value={fareSearch} onChange={(event) => { setFareSearch(event.target.value); setFarePage(1); }} placeholder={t("parcels.fareSearchPlaceholder")} className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-vr-400 focus:ring-2 focus:ring-vr-100" />
                </label>
                <CustomSelect value={fareSizeFilter} onChange={(event) => { setFareSizeFilter(event.target.value as "" | ParcelSizeCategory); setFarePage(1); }} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-vr-400 focus:ring-2 focus:ring-vr-100 lg:w-48">
                  <option value="">{t("parcels.allSizeCategories")}</option>
                  {parcelSizeCategories.map((size) => <option key={size} value={size}>{t("parcels.sizeCategories." + size)}</option>)}
                </CustomSelect>
                <CustomSelect value={fareSort} onChange={(event) => setFareSort(event.target.value as FareSort)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-vr-400 focus:ring-2 focus:ring-vr-100 lg:w-48">
                  <option value="priceAsc">{t("parcels.priceLowToHigh")}</option>
                  <option value="priceDesc">{t("parcels.priceHighToLow")}</option>
                </CustomSelect>
              </div>
            </div>
            <div className="w-full overflow-hidden">
              <table className="w-full table-fixed whitespace-nowrap">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[13%]" />
                  <col className="w-[18%]" />
                  <col className="w-[17%]" />
                  <col className="w-[22%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="whitespace-nowrap px-4 py-3">{t("parcels.route")}</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center">{t("parcels.sizeCategory")}</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center">{t("parcels.fee")}</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center">{t("parcels.effectiveFrom")}</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center">{t("parcels.effectiveUntil")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRouteFares.map((fare) => (
                    <tr
                      key={`${fare.routeId}-${fare.sizeCategory}-${fare.effectiveFrom}`}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="min-w-0 px-4 py-3 text-sm font-medium text-gray-900">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="min-w-0 truncate" title={routes.find((route) => route.id === fare.routeId)?.name || t("parcels.unnamedRoute")}>
                            {routes.find((route) => route.id === fare.routeId)?.name || t("parcels.unnamedRoute")}
                          </span>
                          {canManageRouteFares && (<button type="button" onClick={() => handleEditFare(fare)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-300 hover:text-vr-700" aria-label={t("parcels.editFare")} title={t("parcels.editFare")}><FiEdit2 size={15} /></button>)}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center text-sm font-semibold text-gray-900">
                        {t(`parcels.sizeCategories.${fare.sizeCategory}`)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center text-sm text-gray-700">
                        {formatMoney(fare.priceVnd)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center text-sm text-gray-700">
                        {formatDate(fare.effectiveFrom)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center text-sm text-gray-700">
                        {formatDate(fare.effectiveUntil)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isLoading && routeFares.length === 0 && (
              <p className="border-t border-gray-100 px-5 py-6 text-center text-sm text-gray-500">
                {t("parcels.noRouteFares")}
              </p>
            )}
            <Pagination
              page={farePage}
              pageSize={pageSize}
              totalItems={filteredRouteFares.length}
              onPageChange={setFarePage}
            />
          </section>
      </main>
    </div>
  );
}





