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
  type OperatorVehicle,
} from "../../api/vietride";
import { getAuthUser } from "../../auth";
import Pagination from "../../components/Pagination";
import { downloadCsv } from "../../utils/csv";

type KPICard = {
  labelKey: string;
  value: string;
  change?: string;
  trend: "up" | "down" | "neutral";
  icon: ReactNode;
};

type RevenueChartPoint = {
  month: string;
  revenue: number;
  orders: number;
};

type ParcelChartPoint = {
  name: string;
  value: number;
  color?: string;
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
  totalRevenue: number;
  totalBookings: number;
  fleet: number | null;
  activeTrips: number | null;
  revenueChange?: number;
};

const parcelStatusColors = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
];

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function currentYearRange() {
  const now = new Date();
  return {
    from: toDateInput(new Date(now.getFullYear(), 0, 1)),
    to: toDateInput(new Date(now.getFullYear(), 11, 31)),
  };
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthLabel(dateValue?: string) {
  if (!dateValue) {
    return "N/A";
  }

  const parsed = new Date(dateValue.length === 7 ? `${dateValue}-01` : dateValue);
  const month = parsed.getMonth() + 1;
  return Number.isNaN(month) ? dateValue : `T${month}`;
}

function asHundredMillion(value = 0) {
  return Math.round(value / 100_000_000);
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

function mapBookingStats(items: BookingStatsItem[]): RevenueChartPoint[] {
  const monthlyStats = new Map<string, { revenue: number; orders: number }>();

  for (const item of items) {
    const month = monthLabel(item.date);
    const current = monthlyStats.get(month) ?? { revenue: 0, orders: 0 };
    current.revenue += item.totalRevenue ?? 0;
    current.orders += item.totalBookings ?? 0;
    monthlyStats.set(month, current);
  }

  return Array.from(monthlyStats.entries())
    .map(([month, value]) => ({
      month,
      revenue: asHundredMillion(value.revenue),
      orders: value.orders,
    }))
    .sort((a, b) => {
      const aMonth = Number(a.month.slice(1));
      const bMonth = Number(b.month.slice(1));
      return (Number.isFinite(aMonth) ? aMonth : 13) -
        (Number.isFinite(bMonth) ? bMonth : 13);
    });
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
  const [parcelStatusData, setParcelStatusData] = useState<ParcelChartPoint[]>([]);
  const [parcelRouteData, setParcelRouteData] = useState<ParcelChartPoint[]>([]);
  const [vehicles, setVehicles] = useState<OperatorVehicle[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>({
    totalRevenue: 0,
    totalBookings: 0,
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

    try {
      const bookingStats = await getOperatorBookingStats({
        ...currentYearRange(),
        groupBy: "date",
      });
      setRevenueData(mapBookingStats(bookingStats.items));
      setSummary((current) => ({
        ...current,
        totalRevenue:
          bookingStats.totalRevenue ??
          sumStats(bookingStats.items, "totalRevenue"),
        totalBookings:
          bookingStats.totalBookings ??
          sumStats(bookingStats.items, "totalBookings"),
      }));
    } catch (error) {
      setRevenueData([]);
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
        setRevenueData(
          analytics.monthly.map((item) => ({
            month: monthLabel(item.month),
            revenue: asHundredMillion(item.revenueVnd),
            orders: item.tripCount,
          })),
        );
        setSummary((current) => ({
          ...current,
          totalRevenue: analytics.summary.totalRevenueVnd.currentValue,
          revenueChange: analytics.summary.totalRevenueVnd.changePercent,
        }));
        setParcelRouteData(
          analytics.routePerformance
            .slice(0, 5)
            .map((item) => ({ name: item.routeName, value: item.parcelCount })),
        );
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
            name: item.key ?? "Không xác định",
            value: item.count ?? 0,
            color: parcelStatusColors[index % parcelStatusColors.length],
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
        setParcelRouteData(
          routeStats.items.map((item) => ({
            name: item.routeName ?? item.key ?? "Không xác định",
            value: item.parcelCount ?? item.count ?? 0,
          })),
        );
      } catch (error) {
        appendError("Thống kê tuyến parcel", error);
      }
    } else {
      setParcelStatusData([]);
      setParcelRouteData([]);
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

  const kpis: KPICard[] = useMemo(
    () => [
      {
        labelKey: "dashboard.revenue",
        value: formatCompactMoney(summary.totalRevenue),
        change:
          summary.revenueChange === undefined
            ? undefined
            : `${summary.revenueChange > 0 ? "+" : ""}${summary.revenueChange.toFixed(1)}%`,
        trend:
          summary.revenueChange === undefined || summary.revenueChange === 0
            ? "neutral"
            : summary.revenueChange > 0
              ? "up"
              : "down",
        icon: <FiBarChart2 className="h-6 w-6" />,
      },
      {
        labelKey: "dashboard.bookings",
        value: formatCompactNumber(summary.totalBookings),
        trend: "neutral",
        icon: <FiPackage className="h-6 w-6" />,
      },
      {
        labelKey: "dashboard.fleet",
        value: summary.fleet === null ? "-" : formatCompactNumber(summary.fleet),
        trend: "neutral",
        icon: <FiTruck className="h-6 w-6" />,
      },
      {
        labelKey: "dashboard.activeTrips",
        value:
          summary.activeTrips === null
            ? "-"
            : formatCompactNumber(summary.activeTrips),
        trend: "neutral",
        icon: <FiTrendingUp className="h-6 w-6" />,
      },
    ],
    [summary],
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
          <p className="font-medium">Một số dữ liệu chưa tải được:</p>
          <p className="mt-1">{loadErrors.join(" | ")}</p>
        </div>
      )}

      {!isOperatorAdmin && (
        <div
          className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800"
          role="status"
        >
          Tài khoản nhân viên chỉ xem số liệu được BE cấp quyền. Doanh thu, thống kê parcel và danh sách chuyến tổng hợp dành cho Admin nhà xe.
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("dashboard.title")}</h1>
          <p className="mt-1 text-gray-600">{t("dashboard.date")}</p>
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
          <div
            key={kpi.labelKey}
            className="rounded-lg border border-gray-200 bg-white p-4 transition hover:shadow-md"
          >
            <div className="mb-3 flex items-start justify-between">
              <div className="text-vr-600">{kpi.icon}</div>
              {kpi.change && (
                <span
                  className={`text-xs font-semibold ${
                    kpi.trend === "up"
                      ? "text-emerald-600"
                      : kpi.trend === "down"
                        ? "text-red-600"
                        : "text-gray-600"
                  }`}
                >
                  {kpi.change}
                </span>
              )}
            </div>
            <p className="mb-1 text-xs text-gray-600">{t(kpi.labelKey)}</p>
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("dashboard.revenueChart")}
            </h2>
            <button
              type="button"
              onClick={() => navigate("/manager/reports")}
              className="cursor-pointer text-sm font-medium text-vr-600 hover:text-vr-700"
            >
              {tc("viewAll")}
            </button>
          </div>
          {revenueData.length === 0 ? (
            renderEmpty(isLoading ? "Đang tải dữ liệu..." : "Chưa có dữ liệu doanh thu.")
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name={`${t("dashboard.chartRevenue")} (100 triệu đ)`}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  name={t("dashboard.chartBookings")}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("dashboard.parcelStatus")}
          </h2>
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
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie
                    data={parcelStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                  >
                    {parcelStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 text-sm">
                {parcelStatusData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-gray-700">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.name.replaceAll("_", " ")}
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
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("dashboard.parcelDetail")}
            </h2>
            <button
              type="button"
              onClick={() => navigate("/manager/parcels")}
              className="cursor-pointer text-sm font-medium text-vr-600 hover:text-vr-700"
            >
              {tc("viewAll")}
            </button>
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
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={parcelRouteData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#9ca3af" />
                <YAxis dataKey="name" type="category" stroke="#9ca3af" width={95} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("dashboard.fleetStatus")}
          </h2>
          {vehicles.length === 0 ? (
            renderEmpty(isLoading ? "Đang tải dữ liệu..." : "Chưa có phương tiện.")
          ) : (
            <div className="space-y-3">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicleId(vehicle)}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                >
                  <div className="flex items-center gap-2">
                    <FiTruck size={16} className="text-vr-600" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {vehicle.licensePlate}
                      </p>
                      <p className="text-xs text-gray-500">
                        {vehicle.vehicleTypeName ?? vehicle.vehicleTypeCode ?? "-"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-gray-700">
                    {vehicle.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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
                    {shipment.cost.toLocaleString("vi-VN")} đ
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
