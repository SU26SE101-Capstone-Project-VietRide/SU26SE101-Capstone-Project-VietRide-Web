import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  FiBookOpen,
  FiBox,
  FiDollarSign,
  FiFilter,
  FiRefreshCw,
  FiTruck,
} from "react-icons/fi";
import {
  getAdminPlatformReport,
  type AdminPlatformReport,
} from "../../api/vietride";
import CustomDateTimeInput from "../../components/CustomDateTimeInput";
import Pagination from "../../components/Pagination";
import {
  formatDateInputValue,
  formatDateTime,
  toExclusiveUtcDayEnd,
  toUtcDayStart,
} from "../../utils/date";

type ReportFilters = {
  from: string;
  to: string;
};

function createInitialFilters(): ReportFilters {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: formatDateInputValue(monthStart),
    to: formatDateInputValue(now),
  };
}

export default function AdminReports() {
  const { t, i18n } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [draftFilters, setDraftFilters] = useState<ReportFilters>(createInitialFilters);
  const [filters, setFilters] = useState<ReportFilters>(createInitialFilters);
  const [report, setReport] = useState<AdminPlatformReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    let ignore = false;

    async function loadReport() {
      const from = toUtcDayStart(filters.from);
      const to = toExclusiveUtcDayEnd(filters.to);

      if (!from || !to) {
        setError(t("reports.dateRequired"));
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const result = await getAdminPlatformReport({ from, to });
        if (!ignore) {
          setReport(result);
        }
      } catch (loadError) {
        if (!ignore) {
          setReport(null);
          setError(
            loadError instanceof Error ? loadError.message : t("reports.loadFailed"),
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadReport();
    return () => {
      ignore = true;
    };
  }, [filters, reloadKey, t]);

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language === "vi" ? "vi-VN" : "en-US"),
    [i18n.language],
  );
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language === "vi" ? "vi-VN" : "en-US", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }),
    [i18n.language],
  );

  const operatorRows = report?.byOperator ?? [];
  const paginatedRows = operatorRows.slice((page - 1) * pageSize, page * pageSize);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    if (!draftFilters.from || !draftFilters.to || draftFilters.from > draftFilters.to) {
      setError(t("reports.invalidDateRange"));
      return;
    }

    setPage(1);
    setFilters(draftFilters);
  }

  const metrics = report
    ? [
        {
          label: t("reports.completedBookings"),
          value: numberFormatter.format(report.totals.completedBookingCount),
          icon: <FiBookOpen />,
        },
        {
          label: t("reports.completedTrips"),
          value: numberFormatter.format(report.totals.completedTripCount),
          icon: <FiTruck />,
        },
        {
          label: t("reports.deliveredParcels"),
          value: numberFormatter.format(report.totals.deliveredParcelCount),
          icon: <FiBox />,
        },
        {
          label: t("reports.bookingRevenue"),
          value: currencyFormatter.format(report.totals.bookingRevenueVnd),
          icon: <FiDollarSign />,
        },
        {
          label: t("reports.parcelRevenue"),
          value: currencyFormatter.format(report.totals.parcelRevenueVnd),
          icon: <FiDollarSign />,
        },
        {
          label: t("reports.netRevenue"),
          value: currencyFormatter.format(report.totals.netRevenueVnd),
          icon: <FiDollarSign />,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("reports.title")}</h1>
          <p className="mt-1 text-gray-600">{t("reports.subtitle")}</p>
          {report && (
            <p className="mt-2 text-xs text-gray-500">
              {t("reports.generatedAt", { date: formatDateTime(report.generatedAt) })}
            </p>
          )}
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
        className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-[220px_220px_auto] sm:items-end"
      >
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-gray-600">{tc("from")}</span>
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
          <span className="mb-1.5 block text-xs font-semibold text-gray-600">{tc("to")}</span>
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

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white px-5 py-16 text-center text-sm text-gray-500">
          {t("reports.loading")}
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-600">{metric.label}</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">{metric.value}</p>
                  </div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-vr-50 text-vr-700">
                    {metric.icon}
                  </span>
                </div>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-lg font-bold text-gray-900">{t("reports.byOperator")}</h2>
              <p className="mt-1 text-sm text-gray-500">{t("reports.byOperatorHint")}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-700">
                    <th className="px-5 py-3">{t("reports.operator")}</th>
                    <th className="px-5 py-3 text-right">{t("reports.completedBookings")}</th>
                    <th className="px-5 py-3 text-right">{t("reports.completedTrips")}</th>
                    <th className="px-5 py-3 text-right">{t("reports.deliveredParcels")}</th>
                    <th className="px-5 py-3 text-right">{t("reports.bookingRevenue")}</th>
                    <th className="px-5 py-3 text-right">{t("reports.parcelRevenue")}</th>
                    <th className="px-5 py-3 text-right">{t("reports.netRevenue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
                    <tr key={row.operatorId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {row.operatorName || t("reports.unknownOperator")}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-gray-400">{row.operatorId}</p>
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-700">{numberFormatter.format(row.completedBookingCount)}</td>
                      <td className="px-5 py-4 text-right text-sm text-gray-700">{numberFormatter.format(row.completedTripCount)}</td>
                      <td className="px-5 py-4 text-right text-sm text-gray-700">{numberFormatter.format(row.deliveredParcelCount)}</td>
                      <td className="px-5 py-4 text-right text-sm text-gray-700">{currencyFormatter.format(row.bookingRevenueVnd)}</td>
                      <td className="px-5 py-4 text-right text-sm text-gray-700">{currencyFormatter.format(row.parcelRevenueVnd)}</td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">{currencyFormatter.format(row.netRevenueVnd)}</td>
                    </tr>
                  ))}
                  {operatorRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-500">
                        {t("reports.empty")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={operatorRows.length}
              onPageChange={setPage}
            />
          </section>
        </>
      )}
    </div>
  );
}
