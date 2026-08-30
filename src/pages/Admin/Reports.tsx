import { useToastFeedback } from "../../hooks/useToastFeedback";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  FiArrowRight,
  FiBookOpen,
  FiBox,
  FiCalendar,
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
import { StatCard } from "../../components/StatCard";
import { formatDateInputValue } from "../../utils/date";
import { formatCurrency } from "../../utils/currency";
import { Button } from "../../components/ui/Button";

type ReportFilters = {
  from: string;
  to: string;
};

type ReportPreset = "last7Days" | "last30Days" | "thisMonth" | "thisQuarter";

const MAX_REPORT_RANGE_DAYS = 366;
const REPORT_PRESETS: ReportPreset[] = [
  "last7Days",
  "last30Days",
  "thisMonth",
  "thisQuarter",
];

function createInitialFilters(): ReportFilters {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: formatDateInputValue(monthStart),
    to: formatDateInputValue(now),
  };
}

function createPresetFilters(
  preset: ReportPreset,
  currentDate = new Date(),
): ReportFilters {
  const to = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  );
  let from = new Date(to);

  if (preset === "last7Days") {
    from.setDate(to.getDate() - 6);
  } else if (preset === "last30Days") {
    from.setDate(to.getDate() - 29);
  } else if (preset === "thisMonth") {
    from = new Date(to.getFullYear(), to.getMonth(), 1);
  } else {
    from = new Date(to.getFullYear(), Math.floor(to.getMonth() / 3) * 3, 1);
  }

  return {
    from: formatDateInputValue(from),
    to: formatDateInputValue(to),
  };
}

function formatFilterDate(value: string, formatter: Intl.DateTimeFormat) {
  const [year, month, day] = value.split("-").map(Number);
  return formatter.format(new Date(year, month - 1, day));
}

export default function AdminReports() {
  const { t, i18n } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const [draftFilters, setDraftFilters] =
    useState<ReportFilters>(createInitialFilters);
  const [filters, setFilters] = useState<ReportFilters>(createInitialFilters);
  const [report, setReport] = useState<AdminPlatformReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    let ignore = false;

    async function loadReport() {
      const from = filters.from;
      const to = filters.to;

      if (!from || !to) {
        setError(tRef.current("reports.dateRequired"));
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
            loadError instanceof Error
              ? loadError.message
              : tRef.current("reports.loadFailed"),
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
  }, [filters, reloadKey]);

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language === "vi" ? "vi-VN" : "en-US"),
    [i18n.language],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language === "vi" ? "vi-VN" : "en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [i18n.language],
  );
  const appliedPeriodLabel = t("reports.viewingPeriod", {
    from: formatFilterDate(filters.from, dateFormatter),
    to: formatFilterDate(filters.to, dateFormatter),
  });
  const operatorRows = report?.byOperator ?? [];
  const paginatedRows = operatorRows.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  function applyFilters(event: FormEvent) {
    event.preventDefault();
    const fromDate = new Date(`${draftFilters.from}T00:00:00Z`);
    const toDate = new Date(`${draftFilters.to}T00:00:00Z`);
    const rangeDays = (toDate.getTime() - fromDate.getTime()) / 86_400_000;

    if (
      !draftFilters.from ||
      !draftFilters.to ||
      draftFilters.from > draftFilters.to ||
      rangeDays > MAX_REPORT_RANGE_DAYS
    ) {
      setFilterError(t("reports.invalidDateRange"));
      return;
    }

    setFilterError("");
    setPage(1);
    setFilters(draftFilters);
  }

  function updateDraftFilter(field: keyof ReportFilters, value: string) {
    setFilterError("");
    setDraftFilters((current) => ({ ...current, [field]: value }));
  }

  function applyPreset(preset: ReportPreset) {
    const nextFilters = createPresetFilters(preset);
    setFilterError("");
    setDraftFilters(nextFilters);
    setPage(1);
    setFilters(nextFilters);
  }

  const metrics = report
    ? [
        {
          label: t("reports.completedBookings"),
          value: numberFormatter.format(report.totals.completedBookingCount),
          icon: <FiBookOpen size={20} />,
          iconClassName: "bg-vr-50 text-vr-900",
        },
        {
          label: t("reports.completedTrips"),
          value: numberFormatter.format(report.totals.completedTripCount),
          icon: <FiTruck size={20} />,
          iconClassName: "bg-blue-50 text-blue-700",
        },
        {
          label: t("reports.deliveredParcels"),
          value: numberFormatter.format(report.totals.deliveredParcelCount),
          icon: <FiBox size={20} />,
          iconClassName: "bg-amber-50 text-amber-700",
        },
        {
          label: t("reports.bookingRevenue"),
          value: formatCurrency(report.totals.netTicketRevenueVnd),
          icon: <FiDollarSign size={20} />,
          iconClassName: "bg-emerald-50 text-emerald-700",
        },
        {
          label: t("reports.parcelRevenue"),
          value: formatCurrency(report.totals.netParcelRevenueVnd),
          icon: <FiDollarSign size={20} />,
          iconClassName: "bg-emerald-50 text-emerald-700",
        },
        {
          label: t("reports.netRevenue"),
          value: formatCurrency(report.totals.netTransportRevenueVnd),
          icon: <FiDollarSign size={20} />,
          iconClassName: "bg-emerald-50 text-emerald-700",
        },
      ]
    : [];

  useToastFeedback({ error });
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("reports.title")}
          </h1>
          <p className="mt-1 text-gray-600">{t("reports.subtitle")}</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={isLoading}
        >
          <FiRefreshCw className={isLoading ? "animate-spin" : ""} />
          {tc("refresh")}
        </Button>
      </header>

      <form
        onSubmit={applyFilters}
        className="overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-sm"
      >
        <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-vr-50 text-vr-900">
              <FiCalendar size={20} />
            </span>
            <div>
              <h2 className="text-[2rem] font-bold leading-tight text-gray-900">
                {t("reports.dateRangeTitle")}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("reports.dateRangeHint")}
              </p>
            </div>
          </div>
          <p
            aria-live="polite"
            className="inline-flex w-fit items-center rounded-full border border-[#bfe1ec] bg-[#e9f8f7] px-3 py-1.5 text-[13px] font-medium text-[#0e6d6b]"
          >
            {appliedPeriodLabel}
          </p>
        </div>

        <div className="px-5 pb-5 pt-4 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] lg:items-end">
            <label>
              <span className="mb-2 block text-sm font-medium text-gray-700">
                {tc("from")}
              </span>
              <CustomDateTimeInput
                type="date"
                value={draftFilters.from}
                onChange={(event) =>
                  updateDraftFilter("from", event.target.value)
                }
              />
            </label>
            <span className="hidden h-12 items-center justify-center text-gray-500 lg:flex">
              <FiArrowRight size={18} />
            </span>
            <label>
              <span className="mb-2 block text-sm font-medium text-gray-700">
                {tc("to")}
              </span>
              <CustomDateTimeInput
                type="date"
                value={draftFilters.to}
                onChange={(event) =>
                  updateDraftFilter("to", event.target.value)
                }
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[18px] border border-[#2bb7b0] bg-[#2bb7b0] px-5 text-base font-semibold text-white shadow-sm transition hover:bg-[#1fa8a0]"
            >
              <FiFilter size={16} />
              {t("reports.applyFilters")}
            </button>
          </div>

          {filterError && (
            <p role="alert" className="mt-3 text-sm font-medium text-red-600">
              {filterError}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
            <span className="mr-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">
              {t("reports.quickRanges")}
            </span>
            {REPORT_PRESETS.map((preset) => {
              const presetFilters = createPresetFilters(preset);
              const isActive =
                draftFilters.from === presetFilters.from &&
                draftFilters.to === presetFilters.to;

              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => applyPreset(preset)}
                  className={[
                    "cursor-pointer rounded-[18px] border px-4 py-2 text-sm font-medium transition",
                    isActive
                      ? "border-[#2bb7b0] bg-[#ebfffd] text-[#0c6f68] shadow-[0_0_0_1px_rgba(43,183,176,0.18)]"
                      : "border-[#cfe7ee] bg-white text-gray-700 hover:border-[#9ad7d8] hover:bg-[#f5fffe]",
                  ].join(" ")}
                >
                  {t("reports." + preset)}
                </button>
              );
            })}
          </div>
        </div>
      </form>

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white px-5 py-16 text-center text-sm text-gray-500">
          {t("reports.loading")}
        </div>
      ) : error ? null : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map((metric) => (
              <StatCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                icon={metric.icon}
                iconClassName={metric.iconClassName}
              />
            ))}
          </section>

          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-lg font-bold text-gray-900">
                {t("reports.byOperator")}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("reports.byOperatorHint")}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-700">
                    <th className="px-5 py-3">{t("reports.operator")}</th>
                    <th className="px-5 py-3 text-center">
                      {t("reports.completedBookings")}
                    </th>
                    <th className="px-5 py-3 text-center">
                      {t("reports.completedTrips")}
                    </th>
                    <th className="px-5 py-3 text-center">
                      {t("reports.deliveredParcels")}
                    </th>
                    <th className="px-5 py-3 text-center">
                      {t("reports.bookingRevenue")}
                    </th>
                    <th className="px-5 py-3 text-center">
                      {t("reports.parcelRevenue")}
                    </th>
                    <th className="px-5 py-3 text-center">
                      {t("reports.netRevenue")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
                    <tr
                      key={row.operatorId}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {row.operatorName || t("reports.unknownOperator")}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-center text-sm text-gray-700">
                        {numberFormatter.format(row.completedBookingCount)}
                      </td>
                      <td className="px-5 py-4 text-center text-sm text-gray-700">
                        {numberFormatter.format(row.completedTripCount)}
                      </td>
                      <td className="px-5 py-4 text-center text-sm text-gray-700">
                        {numberFormatter.format(row.deliveredParcelCount)}
                      </td>
                      <td className="px-5 py-4 text-center text-sm text-gray-700">
                        {formatCurrency(row.netTicketRevenueVnd)}
                      </td>
                      <td className="px-5 py-4 text-center text-sm text-gray-700">
                        {formatCurrency(row.netParcelRevenueVnd)}
                      </td>
                      <td className="px-5 py-4 text-center text-sm font-semibold text-gray-900">
                        {formatCurrency(row.netTransportRevenueVnd)}
                      </td>
                    </tr>
                  ))}
                  {operatorRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-12 text-center text-sm text-gray-500"
                      >
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
