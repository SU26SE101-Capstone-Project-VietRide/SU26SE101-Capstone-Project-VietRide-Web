import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheckCircle,
  FiDollarSign,
  FiEdit2,
  FiPackage,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiTruck,
  FiXCircle,
} from "react-icons/fi";
import {
  batchUpdateOperatorParcelRouteFares,
  exportOperatorParcelReport,
  getOperatorParcelReportSummary,
  getOperatorParcelRouteFares,
  getOperatorParcelStats,
  getOperatorRoutes,
  type OperatorParcelReportSummary,
  type OperatorParcelStats,
  type OperatorRoute,
  type ParcelRouteFare,
  type ParcelSizeCategory,
  updateOperatorParcelRouteFare,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import CurrencyInput from "../../../components/CurrencyInput";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CustomSelect from "../../../components/CustomSelect";
import { DetailItem } from "../../../components/DetailLayout";
import Pagination from "../../../components/Pagination";
import { formatDateTime } from "../../../utils/date";
import ParcelQueue from "./ParcelQueue";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";
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
  return value.toLocaleString("vi-VN");
}

function formatDate(value?: string | null) {
  return formatDateTime(value);
}

function normalizeStatus(status?: string) {
  return status?.replaceAll("_", " ") || "-";
}

export default function ParcelsList() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const user = getAuthUser();
  const canManageRouteFares = user?.role === "OPERATOR_ADMIN";
  const [summary, setSummary] = useState<OperatorParcelReportSummary | null>(null);
  const [routeFares, setRouteFares] = useState<ParcelRouteFare[]>([]);
  const [routes, setRoutes] = useState<OperatorRoute[]>([]);
  const [statusStats, setStatusStats] = useState<OperatorParcelStats | null>(null);
  const [routeStats, setRouteStats] = useState<OperatorParcelStats | null>(null);
  const [fromDate, setFromDate] = useState(monthStartIsoDate());
  const [toDate, setToDate] = useState(todayIsoDate());
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [farePage, setFarePage] = useState(1);
  const [fareRouteId, setFareRouteId] = useState("");
  const [fareSizeCategory, setFareSizeCategory] = useState<ParcelSizeCategory>("SMALL");
  const [farePrice, setFarePrice] = useState("");
  const [farePrices, setFarePrices] = useState(createEmptyFarePrices);
  const [fareEffectiveFrom, setFareEffectiveFrom] = useState(currentLocalDateTime);
  const [fareEffectiveUntil, setFareEffectiveUntil] = useState("");
  const [editingFare, setEditingFare] = useState<ParcelRouteFare | null>(null);
  const [isFareSaving, setIsFareSaving] = useState(false);
  const [fareMessage, setFareMessage] = useState("");
  const [fareError, setFareError] = useState("");
  const pageSize = 8;

  const pendingActionCount = useMemo(() => summary?.totalRejected ?? 0, [summary]);
  const paginatedRouteFares = useMemo(
    () => routeFares.slice((farePage - 1) * pageSize, farePage * pageSize),
    [farePage, routeFares],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [
        summaryResult,
        fareResult,
        routeResult,
        statusStatsResult,
        routeStatsResult,
      ] = await Promise.all([
        getOperatorParcelReportSummary({
          from: fromDate,
          to: toDate,
        }),
        getOperatorParcelRouteFares({ page: 1, pageSize: 100 }),
        getOperatorRoutes({ page: 1, pageSize: 100 }),
        canManageRouteFares
          ? getOperatorParcelStats({ from: fromDate, to: toDate, groupBy: "status" })
          : Promise.resolve(null),
        canManageRouteFares
          ? getOperatorParcelStats({
              from: fromDate,
              to: toDate,
              groupBy: "route",
              limit: 5,
            })
          : Promise.resolve(null),
      ]);

      setSummary(summaryResult);
      setRouteFares(fareResult.items);
      setRoutes(routeResult.items);
      setStatusStats(statusStatsResult);
      setRouteStats(routeStatsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("parcels.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [canManageRouteFares, fromDate, t, toDate]);

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

  async function runAction(action: () => Promise<void>) {
    setIsActionLoading(true);
    setError("");
    setMessage("");

    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("parcels.actionFailed"));
    } finally {
      setIsActionLoading(false);
    }
  }

  async function handleExportReport() {
    const report = await exportOperatorParcelReport({
      from: fromDate,
      to: toDate,
      format: "csv",
    });
    const url = URL.createObjectURL(report);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `parcel-report-${fromDate}-${toDate}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage(t("parcels.exportSuccess"));
  }

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

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
          <Field
            label={t("parcels.fromDate")}
            value={fromDate}
            type="date"
            onChange={setFromDate}
          />
          <Field
            label={t("parcels.toDate")}
            value={toDate}
            type="date"
            onChange={setToDate}
          />
          <button
            type="button"
            onClick={() => void loadData()}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
          >
            <FiSearch size={16} />
            {t("parcels.loadReport")}
          </button>
          <button
            type="button"
            onClick={() => void runAction(handleExportReport)}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg border border-vr-200 bg-vr-50 px-4 py-2 text-sm font-semibold text-vr-800 hover:bg-vr-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isActionLoading}
          >
            <FiDollarSign size={16} />
            {t("parcels.exportReport")}
          </button>
        </div>
      </section>

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<FiPackage />}
          label={t("parcels.todayOrders")}
          value={summary?.totalParcels ?? 0}
          isLoading={isLoading}
        />
        <MetricCard
          icon={<FiTruck />}
          label={t("parcels.inTransit")}
          value={summary?.totalLoaded ?? 0}
          isLoading={isLoading}
        />
        <MetricCard
          icon={<FiCheckCircle />}
          label={t("parcels.delivered")}
          value={summary?.totalDelivered ?? 0}
          isLoading={isLoading}
        />
        <MetricCard
          icon={<FiXCircle />}
          label={t("parcels.needsAction")}
          value={pendingActionCount}
          isLoading={isLoading}
        />
      </div>

      <ParcelQueue />

      <main className="space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {t("parcels.reportSummary")}
                </h2>
                <p className="text-sm text-gray-500">
                  {t("parcels.reportSummaryHint")}
                </p>
              </div>
              <div className="rounded-lg bg-vr-50 px-3 py-2 text-sm font-bold text-vr-800">
                {formatMoney(summary?.totalRevenue)} VND
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info label={t("parcels.loaded")} value={summary?.totalLoaded ?? 0} />
              <Info
                label={t("parcels.rejected")}
                value={summary?.totalRejected ?? 0}
              />
              <Info
                label={t("parcels.returned")}
                value={summary?.totalReturned ?? 0}
              />
              <Info
                label={t("parcels.refunded")}
                value={`${formatMoney(summary?.totalRefunded)} VND`}
              />
            </div>
          </section>

          {canManageRouteFares && (
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900">
                  {t("parcels.statusStats")}
                </h2>
                <p className="mb-4 text-sm text-gray-500">
                  {t("parcels.statusStatsHint")}
                </p>
                <div className="space-y-2">
                  {statusStats?.items.map((item) => (
                    <div
                      key={item.key ?? "unknown"}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-gray-700">
                        {normalizeStatus(item.key)}
                      </span>
                      <span className="font-bold text-gray-900">{item.count ?? 0}</span>
                    </div>
                  ))}
                  {!isLoading && !statusStats?.items.length && (
                    <p className="py-4 text-center text-sm text-gray-500">
                      {t("parcels.noStats")}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900">
                  {t("parcels.routeStats")}
                </h2>
                <p className="mb-4 text-sm text-gray-500">
                  {t("parcels.routeStatsHint")}
                </p>
                <div className="space-y-2">
                  {routeStats?.items.map((item) => (
                    <div
                      key={item.routeId ?? item.routeName ?? "unknown"}
                      className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm"
                    >
                      <span className="truncate font-medium text-gray-700">
                        {item.routeName ?? item.routeId ?? "-"}
                      </span>
                      <span className="shrink-0 font-bold text-gray-900">
                        {item.parcelCount ?? item.count ?? 0}
                      </span>
                    </div>
                  ))}
                  {!isLoading && !routeStats?.items.length && (
                    <p className="py-4 text-center text-sm text-gray-500">
                      {t("parcels.noStats")}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

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
              <div className="border-b border-gray-100 bg-gray-50/60 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div><h3 className="font-bold text-gray-900">{editingFare ? t("parcels.editFare") : t("parcels.createFare")}</h3><p className="text-sm text-gray-500">{t("parcels.fareFormHint")}</p></div>
                  {editingFare && <button type="button" onClick={resetFareForm} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold">{t("parcels.cancelEdit")}</button>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <label>
                    <span className={labelClass}>{t("parcels.route")}</span>
                    <CustomSelect
                      value={fareRouteId}
                      disabled={Boolean(editingFare)}
                      onChange={(event) => setFareRouteId(event.target.value)}
                      className={inputClass}
                    >
                      <option value="">{t("parcels.selectRoute")}</option>
                      {routes.map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.name}
                        </option>
                      ))}
                    </CustomSelect>
                  </label>
                  {editingFare && (
                    <>
                      <label>
                        <span className={labelClass}>{t("parcels.sizeCategory")}</span>
                        <CustomSelect
                          value={fareSizeCategory}
                          disabled
                          onChange={(event) =>
                            setFareSizeCategory(event.target.value as ParcelSizeCategory)
                          }
                          className={inputClass}
                        >
                          {parcelSizeCategories.map((size) => (
                            <option key={size} value={size}>
                              {t(`parcels.sizeCategories.${size}`)}
                            </option>
                          ))}
                        </CustomSelect>
                      </label>
                      <label>
                        <span className={labelClass}>{t("parcels.fee")}</span>
                        <CurrencyInput
                          value={farePrice}
                          onChange={(event) => setFarePrice(event.target.value)}
                          className={inputClass}
                          placeholder="50.000"
                        />
                      </label>
                    </>
                  )}
                  <label>
                    <span className={labelClass}>{t("parcels.effectiveFrom")}</span>
                    <CustomDateTimeInput
                      type="datetime-local"
                      value={fareEffectiveFrom}
                      onChange={(event) => setFareEffectiveFrom(event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>{t("parcels.effectiveUntil")}</span>
                    <CustomDateTimeInput
                      type="datetime-local"
                      value={fareEffectiveUntil}
                      onChange={(event) => setFareEffectiveUntil(event.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
                {!editingFare && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {parcelSizeCategories.map((sizeCategory) => (
                      <label key={sizeCategory}>
                        <span className={labelClass}>
                          {t(`parcels.sizeCategories.${sizeCategory}`)}
                        </span>
                        <CurrencyInput
                          value={farePrices[sizeCategory]}
                          onChange={(event) =>
                            setFarePrices((current) => ({
                              ...current,
                              [sizeCategory]: event.target.value,
                            }))
                          }
                          className={inputClass}
                          placeholder="0"
                        />
                      </label>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={isFareSaving}
                    onClick={() => void handleSaveFare()}
                    className="inline-flex min-w-44 items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {editingFare ? <FiSave /> : <FiPlus />}
                    {editingFare ? t("parcels.updateFare") : t("parcels.addFareBatch")}
                  </button>
                </div>                {fareError && <p className="mt-3 text-sm font-medium text-red-600">{fareError}</p>}
                {fareMessage && <p className="mt-3 text-sm font-medium text-emerald-700">{fareMessage}</p>}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3">{t("parcels.route")}</th>
                    <th className="px-5 py-3">{t("parcels.sizeCategory")}</th>
                    <th className="px-5 py-3">{t("parcels.fee")}</th>
                    <th className="px-5 py-3">{t("parcels.validity")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRouteFares.map((fare) => (
                    <tr
                      key={`${fare.routeId}-${fare.sizeCategory}-${fare.effectiveFrom}`}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-5 py-4 text-sm font-medium text-gray-900">
                        {routes.find((route) => route.id === fare.routeId)?.name || "Tuyến chưa có tên"}
                        {canManageRouteFares && (<button type="button" onClick={() => handleEditFare(fare)} className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:text-vr-700" aria-label={t("parcels.editFare")} title={t("parcels.editFare")}><FiEdit2 size={15} /></button>)}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                        {t(`parcels.sizeCategories.${fare.sizeCategory}`)}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {formatMoney(fare.priceVnd)} VND
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {formatDate(fare.effectiveFrom)} -{" "}
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
              totalItems={routeFares.length}
              onPageChange={setFarePage}
            />
          </section>
      </main>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  isLoading,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">{label}</p>
        <span className="text-vr-700">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900">
        {isLoading ? "-" : value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  currency = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  currency?: boolean;
}) {
  const isCustomDateTime =
    type === "date" ||
    type === "datetime-local" ||
    type === "time" ||
    type === "month" ||
    type === "week";

  return (
    <div>
      <label className={labelClass}>{label}</label>
      {isCustomDateTime ? (
        <CustomDateTimeInput
          className={inputClass}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : currency ? (
        <CurrencyInput
          className={inputClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={inputClass}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return <DetailItem label={label} value={value} />;
}



