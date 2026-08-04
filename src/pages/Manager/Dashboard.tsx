import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  FiBarChart2,
  FiDownload,
  FiEye,
  FiPackage,
  FiRefreshCw,
  FiTrendingUp,
  FiTruck,
} from "react-icons/fi";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getOperatorBookingStats,
  getOperatorParcelStats,
  getOperatorParcels,
  getOperatorRevenueAnalytics,
  getOperatorTrips,
  getOperatorVehicles,
  type BookingStatsItem,
  type OperatorParcelListItem,
  type OperatorRevenueAnalytics,
  type OperatorVehicle,
} from "../../api/vietride";
import { getAuthUser } from "../../auth";
import Pagination from "../../components/Pagination";
import { downloadCsv } from "../../utils/csv";
import { formatCurrency } from "../../utils/currency";

type KPICard = {
  labelKey: string;
  value: string;
  helper: string;
  change?: string;
  trend: "up" | "down" | "neutral";
  icon: ReactNode;
  iconClassName: string;
};

type RevenueChartPoint = {
  monthKey: string;
  month: string;
  revenue: number;
  bookings: number;
};

type ParcelStatusPoint = {
  key: string;
  value: number;
  color: string;
};

type ParcelRoutePoint = {
  routeId?: string;
  name: string;
  value: number;
  sharePercent: number;
  tripCount?: number;
  completionRatePercent?: number;
};

type Shipment = {
  id: string;
  code: string;
  route: string;
  sender: string;
  recipient: string;
  cost: number;
  status: string;
};

type DashboardSummary = {
  revenue: {
    currentMonth: number | null;
    previousMonth: number | null;
    yearToDate: number | null;
  };
  bookings: {
    currentMonth: number | null;
    previousMonth: number | null;
    yearToDate: number | null;
  };
  fleet: number | null;
  activeTrips: number | null;
};


function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentYearRange() {
  const now = new Date();
  return {
    from: toDateInput(new Date(now.getFullYear(), 0, 1)),
    to: toDateInput(now),
  };
}

function currentMonth() {
  return toDateInput(new Date()).slice(0, 7);
}

function previousMonth() {
  const now = new Date();
  return toDateInput(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(
    0,
    7,
  );
}

function getMonthKey(dateValue?: string) {
  if (!dateValue) {
    return "";
  }

  const matchedMonth = dateValue.match(/^(\d{4}-\d{2})/);
  if (matchedMonth) {
    return matchedMonth[1];
  }

  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? dateValue : toDateInput(parsed).slice(0, 7);
}

function monthLabel(monthKey: string) {
  const month = Number(monthKey.slice(5, 7));
  return Number.isFinite(month) && month > 0 ? `T${month}` : monthKey;
}

function formatCompactMoney(value: number) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  return value.toLocaleString("vi-VN");
}

function statusColor(key: string, index: number) {
  const normalized = key.toUpperCase();
  if (normalized.includes("CANCEL") || normalized.includes("FAIL")) return "#ef4444";
  if (normalized.includes("DELIVER") || normalized.includes("COMPLETE")) return "#10b981";
  if (normalized.includes("TRANSIT") || normalized.includes("LOADED")) return "#0ea5e9";
  if (normalized.includes("CONFIRM") || normalized.includes("PROCESS")) return "#2563eb";
  if (normalized.includes("PENDING") || normalized.includes("WAIT")) return "#f59e0b";
  return ["#64748b", "#8b5cf6", "#14b8a6"][index % 3];
}

function vehicleStatusClass(status: string) {
  const normalized = status.toUpperCase();
  if (normalized.includes("ACTIVE") || normalized.includes("AVAILABLE") || normalized.includes("READY")) return "bg-emerald-50 text-emerald-700";
  if (normalized.includes("TRIP") || normalized.includes("RUN") || normalized.includes("BUSY")) return "bg-sky-50 text-sky-700";
  if (normalized.includes("MAINTENANCE") || normalized.includes("REPAIR")) return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function formatCompactNumber(value: number) {
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toLocaleString("vi-VN");
}

function sumStats(items: BookingStatsItem[], key: keyof BookingStatsItem) {
  return items.reduce((total, item) => {
    const value = item[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}

function aggregateBookingStats(items: BookingStatsItem[]) {
  const monthlyStats = new Map<string, { revenue: number; bookings: number }>();

  for (const item of items) {
    const monthKey = getMonthKey(item.date);
    if (!monthKey) {
      continue;
    }

    const current = monthlyStats.get(monthKey) ?? { revenue: 0, bookings: 0 };
    current.revenue += item.totalRevenue ?? 0;
    current.bookings += item.totalBookings ?? 0;
    monthlyStats.set(monthKey, current);
  }

  return monthlyStats;
}

function mapDashboardChart(
  bookingItems: BookingStatsItem[],
  revenueItems: OperatorRevenueAnalytics["monthly"] = [],
): RevenueChartPoint[] {
  const monthlyStats = aggregateBookingStats(bookingItems);

  for (const item of revenueItems) {
    const monthKey = getMonthKey(item.month);
    if (!monthKey) {
      continue;
    }

    const current = monthlyStats.get(monthKey) ?? { revenue: 0, bookings: 0 };
    current.revenue = item.ticketRevenueVnd;
    monthlyStats.set(monthKey, current);
  }

  return Array.from(monthlyStats.entries())
    .map(([monthKey, value]) => ({
      monthKey,
      month: monthLabel(monthKey),
      revenue: value.revenue,
      bookings: value.bookings,
    }))
    .sort((first, second) => first.monthKey.localeCompare(second.monthKey));
}

function percentageChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) {
    return undefined;
  }

  return ((current - previous) / previous) * 100;
}

function compactRouteName(name: string) {
  return name.length > 24 ? `${name.slice(0, 22)}…` : name;
}

function mapShipment(parcel: OperatorParcelListItem): Shipment {
  return {
    id: parcel.parcelId,
    code: parcel.parcelCode,
    route: parcel.route?.routeName ?? parcel.routeName ?? "-",
    sender: parcel.sender?.name ?? parcel.senderName ?? "-",
    recipient: parcel.recipient?.name ?? parcel.recipientName ?? "-",
    cost: (parcel.depositAmount ?? 0) + (parcel.balanceAmount ?? 0),
    status: parcel.status,
  };
}

function vehicleId(vehicle: OperatorVehicle) {
  return vehicle.vehicleId ?? vehicle.id ?? vehicle.licensePlate;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không thể tải dữ liệu.";
}

export default function ManagerDashboard() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const role = getAuthUser()?.role;
  const isOperatorAdmin = role === "OPERATOR_ADMIN";
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueChartPoint[]>([]);
  const [parcelStatusData, setParcelStatusData] = useState<ParcelStatusPoint[]>([]);
  const [parcelRouteData, setParcelRouteData] = useState<ParcelRoutePoint[]>([]);
  const [parcelRouteTotal, setParcelRouteTotal] = useState(0);
  const [vehicles, setVehicles] = useState<OperatorVehicle[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>({
    revenue: {
      currentMonth: null,
      previousMonth: null,
      yearToDate: null,
    },
    bookings: {
      currentMonth: null,
      previousMonth: null,
      yearToDate: null,
    },
    fleet: null,
    activeTrips: null,
  });
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [shipmentTotal, setShipmentTotal] = useState(0);
  const [shipmentPage, setShipmentPage] = useState(1);
  const pageSize = 8;

  const appendError = useCallback((source: string, error: unknown) => {
    const message = `${source}: ${errorMessage(error)}`;
    setLoadErrors((current) =>
      current.includes(message) ? current : [...current, message],
    );
  }, []);

  const loadShipments = useCallback(async () => {
    try {
      const result = await getOperatorParcels({
        page: shipmentPage,
        pageSize,
      });
      setShipments(result.items.map(mapShipment));
      setShipmentTotal(result.totalItems);
    } catch (error) {
      setShipments([]);
      setShipmentTotal(0);
      appendError("Parcel", error);
    }
  }, [appendError, shipmentPage]);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setLoadErrors([]);

    let bookingItems: BookingStatsItem[] = [];
    let routePerformance: OperatorRevenueAnalytics["routePerformance"] = [];

    try {
      const bookingStats = await getOperatorBookingStats({
        ...currentYearRange(),
        groupBy: "date",
      });
      bookingItems = bookingStats.items;
      const monthlyStats = aggregateBookingStats(bookingItems);
      const thisMonthStats = monthlyStats.get(currentMonth());
      const lastMonthStats = monthlyStats.get(previousMonth());

      setRevenueData(mapDashboardChart(bookingItems));
      setSummary((current) => ({
        ...current,
        revenue: {
          currentMonth: thisMonthStats?.revenue ?? 0,
          previousMonth: lastMonthStats?.revenue ?? 0,
          yearToDate:
            bookingStats.totalRevenue ??
            sumStats(bookingStats.items, "totalRevenue"),
        },
        bookings: {
          currentMonth: thisMonthStats?.bookings ?? 0,
          previousMonth: lastMonthStats?.bookings ?? 0,
          yearToDate:
            bookingStats.totalBookings ??
            sumStats(bookingStats.items, "totalBookings"),
        },
      }));
    } catch (error) {
      setRevenueData([]);
      setSummary((current) => ({
        ...current,
        revenue: {
          currentMonth: null,
          previousMonth: null,
          yearToDate: null,
        },
        bookings: {
          currentMonth: null,
          previousMonth: null,
          yearToDate: null,
        },
      }));
      appendError("Booking", error);
    }

    try {
      const fleet = await getOperatorVehicles({ page: 1, pageSize: 5 });
      setVehicles(fleet.items);
      setSummary((current) => ({ ...current, fleet: fleet.totalItems }));
    } catch (error) {
      setVehicles([]);
      setSummary((current) => ({ ...current, fleet: null }));
      appendError("Phương tiện", error);
    }

    if (isOperatorAdmin) {
      const { from, to } = currentYearRange();

      try {
        const analytics = await getOperatorRevenueAnalytics(currentMonth());
        routePerformance = analytics.routePerformance;
        setRevenueData(mapDashboardChart(bookingItems, analytics.monthly));
        setSummary((current) => ({
          ...current,
          revenue: {
            ...current.revenue,
            currentMonth: analytics.summary.ticketRevenueVnd.currentValue,
            previousMonth: analytics.summary.ticketRevenueVnd.previousValue,
          },
        }));

        const analyticsParcelTotal = routePerformance.reduce(
          (total, item) => total + item.parcelCount,
          0,
        );
        if (analyticsParcelTotal > 0) {
          setParcelRouteTotal(analyticsParcelTotal);
          setParcelRouteData(
            [...routePerformance]
              .sort((first, second) => second.parcelCount - first.parcelCount)
              .slice(0, 5)
              .map((item) => ({
                routeId: item.routeId,
                name: item.routeName,
                value: item.parcelCount,
                sharePercent: (item.parcelCount / analyticsParcelTotal) * 100,
                tripCount: item.tripCount,
                completionRatePercent: item.completionRatePercent,
              })),
          );
        }
      } catch (error) {
        appendError("Doanh thu", error);
      }

      try {
        const trips = await getOperatorTrips({
          page: 1,
          pageSize: 1,
          status: "IN_PROGRESS",
          sortBy: "departureAt",
          sortDir: "asc",
        });
        setSummary((current) => ({
          ...current,
          activeTrips: trips.totalItems,
        }));
      } catch (error) {
        setSummary((current) => ({ ...current, activeTrips: null }));
        appendError("Chuyến đang chạy", error);
      }

      try {
        const statusStats = await getOperatorParcelStats({
          from,
          to,
          groupBy: "status",
        });
        setParcelStatusData(
          statusStats.items.map((item, index) => ({
            key: item.key ?? "UNKNOWN",
            value: item.count ?? 0,
            color: statusColor(item.key ?? "UNKNOWN", index),
          })),
        );
      } catch (error) {
        setParcelStatusData([]);
        appendError("Thống kê parcel", error);
      }

      try {
        const routeStats = await getOperatorParcelStats({
          from,
          to,
          groupBy: "route",
          limit: 5,
        });
        const total = routeStats.totalParcels;
        setParcelRouteTotal(total);
        setParcelRouteData(
          [...routeStats.items]
            .sort(
              (first, second) =>
                (second.parcelCount ?? second.count ?? 0) -
                (first.parcelCount ?? first.count ?? 0),
            )
            .slice(0, 5)
            .map((item) => {
              const name = item.routeName ?? item.key ?? "Không xác định";
              const value = item.parcelCount ?? item.count ?? 0;
              const analyticsRoute = routePerformance.find(
                (route) =>
                  route.routeId === item.routeId || route.routeName === name,
              );
              return {
                routeId: item.routeId,
                name,
                value,
                sharePercent: total > 0 ? (value / total) * 100 : 0,
                tripCount: analyticsRoute?.tripCount,
                completionRatePercent: analyticsRoute?.completionRatePercent,
              };
            }),
        );
      } catch (error) {
        appendError("Thống kê tuyến parcel", error);
      }
    } else {
      setParcelStatusData([]);
      setParcelRouteData([]);
      setParcelRouteTotal(0);
      setSummary((current) => ({ ...current, activeTrips: null }));
    }

    setIsLoading(false);
  }, [appendError, isOperatorAdmin]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadDashboard();
    });

    return () => {
      cancelled = true;
    };
  }, [loadDashboard]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadShipments();
    });

    return () => {
      cancelled = true;
    };
  }, [loadShipments]);

  const kpis: KPICard[] = useMemo(() => {
    const buildChange = (current: number | null, previous: number | null) => {
      if (current !== null && current > 0 && previous === 0) {
        return {
          change: t("dashboard.newVsLastMonth"),
          trend: "up" as const,
        };
      }

      const changeValue = percentageChange(current, previous);
      if (changeValue === undefined) {
        return { trend: "neutral" as const };
      }

      return {
        change: `${changeValue > 0 ? "+" : ""}${changeValue.toFixed(1)}%`,
        trend:
          changeValue === 0
            ? ("neutral" as const)
            : changeValue > 0
              ? ("up" as const)
              : ("down" as const),
      };
    };

    const revenueChange = buildChange(
      summary.revenue.currentMonth,
      summary.revenue.previousMonth,
    );
    const bookingChange = buildChange(
      summary.bookings.currentMonth,
      summary.bookings.previousMonth,
    );
    const year = new Date().getFullYear();

    return [
      {
        labelKey: "dashboard.revenue",
        value:
          summary.revenue.currentMonth === null
            ? "-"
            : formatCurrency(summary.revenue.currentMonth),
        helper:
          summary.revenue.yearToDate === null
            ? t("dashboard.unavailable")
            : t("dashboard.yearToDateValue", {
                year,
                value: formatCurrency(summary.revenue.yearToDate),
              }),
        ...revenueChange,
        icon: <FiBarChart2 className="h-5 w-5" />,
        iconClassName: "bg-sky-50 text-sky-600",
      },
      {
        labelKey: "dashboard.bookings",
        value:
          summary.bookings.currentMonth === null
            ? "-"
            : formatCompactNumber(summary.bookings.currentMonth),
        helper:
          summary.bookings.yearToDate === null
            ? t("dashboard.unavailable")
            : t("dashboard.yearToDateValue", {
                year,
                value: formatCompactNumber(summary.bookings.yearToDate),
              }),
        ...bookingChange,
        icon: <FiPackage className="h-5 w-5" />,
        iconClassName: "bg-violet-50 text-violet-600",
      },
      {
        labelKey: "dashboard.fleet",
        value: summary.fleet === null ? "-" : formatCompactNumber(summary.fleet),
        helper: t("dashboard.fleetHelper"),
        trend: "neutral",
        icon: <FiTruck className="h-5 w-5" />,
        iconClassName: "bg-amber-50 text-amber-600",
      },
      {
        labelKey: "dashboard.activeTrips",
        value:
          summary.activeTrips === null
            ? "-"
            : formatCompactNumber(summary.activeTrips),
        helper: t("dashboard.activeTripsHelper"),
        trend: "neutral",
        icon: <FiTrendingUp className="h-5 w-5" />,
        iconClassName: "bg-emerald-50 text-emerald-600",
      },
    ];
  }, [summary, t]);

  const parcelStatusTotal = useMemo(
    () => parcelStatusData.reduce((total, item) => total + item.value, 0),
    [parcelStatusData],
  );

  const handleRefresh = async () => {
    await Promise.all([loadDashboard(), loadShipments()]);
  };

  const handleExportShipments = () => {
    downloadCsv(
      "dashboard-parcels.csv",
      ["Mã", "Tuyến", "Người gửi", "Người nhận", "Số tiền", "Trạng thái"],
      shipments.map((shipment) => [
        shipment.code,
        shipment.route,
        shipment.sender,
        shipment.recipient,
        shipment.cost,
        shipment.status,
      ]),
    );
  };

  const getStatusBadge = (status: string) => {
    const normalized = status.toUpperCase();
    const isCompleted = normalized === "DELIVERED" || normalized === "COMPLETED";
    const isInTransit = normalized === "IN_TRANSIT" || normalized === "LOADED";
    const isCancelled = normalized === "CANCELLED" || normalized === "REJECTED";
    const style = isCompleted
      ? "bg-emerald-50 text-emerald-700"
      : isInTransit
        ? "bg-sky-50 text-sky-700"
        : isCancelled
          ? "bg-red-50 text-red-700"
          : "bg-amber-50 text-amber-700";
    const label = isCompleted
      ? t("dashboard.completed")
      : isInTransit
        ? t("dashboard.inTransit")
        : isCancelled
          ? t("dashboard.cancelled")
          : t("dashboard.waiting");

    return (
      <span className={`rounded-full px-3 py-1 text-xs font-medium ${style}`}>
        {label}
      </span>
    );
  };

  const renderEmpty = (message: string) => (
    <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
      {message}
    </div>
  );

  return (
    <div className="space-y-6 pb-4">
      {loadErrors.length > 0 && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          <p className="font-medium">{t("dashboard.someDataFailed")}</p>
          <p className="mt-1">{loadErrors.join(" | ")}</p>
        </div>
      )}

      {!isOperatorAdmin && (
        <div
          className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800"
          role="status"
        >
          {t("dashboard.staffScopeNotice")}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("dashboard.title")}</h1>
          <p className="mt-1 text-gray-600">
            {t("dashboard.periodContext", {
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear(),
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={isLoading}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-white transition hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          {tc("refresh")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <article
            key={kpi.labelKey}
            aria-label={t(kpi.labelKey)}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className={`rounded-xl p-2.5 ${kpi.iconClassName}`}>
                {kpi.icon}
              </div>
              {kpi.change && (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    kpi.trend === "up"
                      ? "bg-emerald-50 text-emerald-700"
                      : kpi.trend === "down"
                        ? "bg-red-50 text-red-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {kpi.change}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-gray-600">{t(kpi.labelKey)}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-gray-950">
              {kpi.value}
            </p>
            <p className="mt-2 text-xs text-gray-500">{kpi.helper}</p>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t("dashboard.revenueChart")}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("dashboard.revenueChartHint")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/manager/reports")}
              className="cursor-pointer text-left text-sm font-medium text-vr-600 hover:text-vr-700"
            >
              {tc("viewAll")}
            </button>
          </div>
          {revenueData.length === 0 ? (
            renderEmpty(isLoading ? "Đang tải dữ liệu..." : "Chưa có dữ liệu doanh thu.")
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={revenueData}
                margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                />
                <YAxis
                  yAxisId="bookings"
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                />
                <YAxis
                  yAxisId="revenue"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatCompactMoney}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }}
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#e5e7eb",
                    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
                  }}
                />
                <Legend iconType="circle" />
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0284c7"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#ffffff", strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                  name={`${t("dashboard.chartRevenue")} (VND)`}
                />
                <Bar
                  yAxisId="bookings"
                  dataKey="bookings"
                  fill="#8b5cf6"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
                  name={t("dashboard.chartBookings")}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t("dashboard.parcelStatus")}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("dashboard.yearToDate")}
              </p>
            </div>
            {parcelStatusTotal > 0 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {parcelStatusTotal} {t("dashboard.parcelsUnit")}
              </span>
            )}
          </div>
          {parcelStatusData.length === 0 ? (
            renderEmpty(
              isOperatorAdmin
                ? isLoading
                  ? "Đang tải dữ liệu..."
                  : "Chưa có dữ liệu parcel."
                : "Không có quyền xem thống kê này.",
            )
          ) : (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={parcelStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={84}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {parcelStatusData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <strong className="text-2xl text-gray-950">{parcelStatusTotal}</strong>
                  <span className="text-xs text-gray-500">
                    {t("dashboard.parcelStatusTotal")}
                  </span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {parcelStatusData.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-gray-700">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {tc(`enumLabels.${item.key}`, {
                        defaultValue: item.key.replaceAll("_", " "),
                      })}
                    </span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t("dashboard.parcelDetail")}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("dashboard.parcelRouteHint")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                {t("dashboard.parcelRouteTotal", { count: parcelRouteTotal })}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {t("dashboard.topRoutes", { count: parcelRouteData.length })}
              </span>
            </div>
          </div>
          {parcelRouteData.length === 0 ? (
            renderEmpty(
              isOperatorAdmin
                ? isLoading
                  ? "Đang tải dữ liệu..."
                  : "Chưa có dữ liệu parcel theo tuyến."
                : "Không có quyền xem thống kê này.",
            )
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(240px,0.6fr)]">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={parcelRouteData}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 20, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="parcelRouteBar" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0284c7" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke="#e5e7eb"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    width={145}
                    tickFormatter={compactRouteName}
                    tick={{ fill: "#374151", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: "#e5e7eb",
                      boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
                    }}
                  />
                  <Bar
                    dataKey="value"
                    name={t("dashboard.parcelsUnit")}
                    fill="url(#parcelRouteBar)"
                    radius={[0, 8, 8, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>

              <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-slate-50/70 px-4">
                {parcelRouteData.map((route, index) => (
                  <div key={route.routeId ?? route.name} className="py-3.5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-sky-700 shadow-sm">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {route.name}
                          </p>
                          <span className="shrink-0 text-sm font-bold text-gray-950">
                            {route.value}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                          <span>
                            {t("dashboard.shareOfTotal", {
                              percent: route.sharePercent.toFixed(1),
                            })}
                          </span>
                          {route.tripCount !== undefined && (
                            <span>
                              {t("dashboard.tripCount", { count: route.tripCount })}
                            </span>
                          )}
                          {route.completionRatePercent !== undefined && (
                            <span>
                              {t("dashboard.completionRate", {
                                percent: route.completionRatePercent.toFixed(1),
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t("dashboard.fleetStatus")}</h2>
              <p className="mt-1 text-sm text-gray-500">Theo dõi trạng thái phương tiện trong ngày</p>
            </div>
            <span className="rounded-full bg-vr-50 px-3 py-1 text-xs font-semibold text-vr-700">{vehicles.length} xe</span>
          </div>
          {vehicles.length === 0 ? (
            renderEmpty(isLoading ? "Đang tải dữ liệu..." : "Chưa có phương tiện.")
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicleId(vehicle)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gradient-to-r from-slate-50 to-white p-3.5 transition hover:border-vr-100 hover:shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vr-50 text-vr-600"><FiTruck size={18} /></span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {vehicle.licensePlate}
                      </p>
                      <p className="text-xs text-gray-500">
                        {vehicle.vehicleTypeName ?? vehicle.vehicleTypeCode ?? "-"}
                      </p>
                    </div>
                  </div>
                  <span className={"shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold " + vehicleStatusClass(vehicle.status)}>
                    {vehicle.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("dashboard.recentShipments")}
          </h2>
          <button
            type="button"
            onClick={handleExportShipments}
            disabled={shipments.length === 0}
            className="flex cursor-pointer items-center gap-2 text-sm font-medium text-vr-600 hover:text-vr-700 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            <FiDownload size={16} />
            {tc("exportCsv")}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">{t("dashboard.parcelCode")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">{t("dashboard.route")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">{t("dashboard.sender")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">{t("dashboard.recipient")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">{t("dashboard.amount")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">{tc("status")}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {shipments.map((shipment) => (
                <tr key={shipment.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{shipment.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{shipment.route}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{shipment.sender}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{shipment.recipient}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {formatCurrency(shipment.cost)}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(shipment.status)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => navigate(`/manager/parcels?parcelId=${shipment.id}`)}
                      className="cursor-pointer rounded p-2 text-vr-600 hover:bg-vr-50"
                      title={tc("details")}
                      aria-label={`${tc("details")} ${shipment.code}`}
                    >
                      <FiEye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && shipments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                    {t("dashboard.noShipments")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={shipmentPage}
          pageSize={pageSize}
          totalItems={shipmentTotal}
          onPageChange={setShipmentPage}
        />
      </section>
    </div>
  );
}

