import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useLatestRequest } from "../../../hooks/useLatestRequest";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FiRefreshCw, FiTruck } from "react-icons/fi";
import {
  getOperatorBookingStats,
  getOperatorParcelStats,
  getOperatorParcels,
  getOperatorRevenueAnalytics,
  getOperatorTrips,
  getOperatorVehicles,
  type BookingStatsItem,
  type OperatorRevenueAnalytics,
  type OperatorVehicle,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import CustomSelect from "../../../components/CustomSelect";
import { downloadCsv } from "../../../utils/csv";
import EmptyChartState from "./EmptyChartState";
import KpiGrid from "./KpiGrid";
import ParcelRouteChart from "./ParcelRouteChart";
import ParcelStatusChart from "./ParcelStatusChart";
import RecentShipmentsTable from "./RecentShipmentsTable";
import RevenueChart from "./RevenueChart";
import { useOperatorSubscription } from "../../../contexts/operatorSubscriptionContext";
import {
  aggregateBookingStats,
  currentMonth,
  currentYearRange,
  errorMessage,
  mapDashboardChart,
  mapShipment,
  statusColor,
  sumStats,
  vehicleId,
  vehicleStatusClass,
  type DashboardSummary,
  type ParcelRoutePoint,
  type ParcelStatusPoint,
  type RevenueChartPoint,
  type Shipment,
} from "./dashboardHelpers";
import { Badge } from "../../../components/ui/Badge";

function revenueMonthOptions() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return { value: `${year}-${month}`, label: `${month}/${year}` };
  });
}

function previousMonthOf(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function ManagerDashboard() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  // Giữ tham chiếu t mới nhất để callback tải dữ liệu không refetch khi đổi ngôn ngữ
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const navigate = useNavigate();
  const role = getAuthUser()?.role;
  const isOperatorAdmin = role === "OPERATOR_ADMIN";
  const { hasModule } = useOperatorSubscription();
  const parcelEnabled =
    !isOperatorAdmin || hasModule("enableParcel");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRevenueMonth, setSelectedRevenueMonth] =
    useState(currentMonth);
  const revenueMonths = useMemo(() => revenueMonthOptions(), []);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueChartPoint[]>([]);
  const [parcelStatusData, setParcelStatusData] = useState<ParcelStatusPoint[]>(
    [],
  );
  const [parcelRouteData, setParcelRouteData] = useState<ParcelRoutePoint[]>(
    [],
  );
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
  const pageSize = 10;
  // Hai loader chạy độc lập nhau nên mỗi cái một bộ đếm riêng
  const startDashboardRequest = useLatestRequest();
  const startShipmentsRequest = useLatestRequest();

  const appendError = useCallback((source: string, error: unknown) => {
    const message = `${source}: ${errorMessage(error, tRef.current("dashboard.loadFailed"))}`;
    setLoadErrors((current) =>
      current.includes(message) ? current : [...current, message],
    );
  }, []);

  const loadShipments = useCallback(async () => {
    const isLatest = startShipmentsRequest();

    if (!parcelEnabled) {
      setShipments([]);
      setShipmentTotal(0);
      return;
    }

    try {
      const result = await getOperatorParcels({
        page: shipmentPage,
        pageSize,
      });
      if (!isLatest()) return;
      setShipments(result.items.map(mapShipment));
      setShipmentTotal(result.totalItems);
    } catch (error) {
      if (!isLatest()) return;
      setShipments([]);
      setShipmentTotal(0);
      appendError("Parcel", error);
    }
  }, [appendError, parcelEnabled, shipmentPage, startShipmentsRequest]);

  const loadDashboard = useCallback(async () => {
    // Loader chạy tuần tự và ghi state ngay sau từng nguồn (widget nào về trước
    // hiện trước). Vì vậy chốt chặn đặt ngay sau mỗi `await`: đổi tháng doanh thu
    // khi lượt cũ chưa xong thì lượt cũ dừng hẳn tại đó, không ghi đè lượt mới.
    const isLatest = startDashboardRequest();
    setIsLoading(true);
    setLoadErrors([]);

    let bookingItems: BookingStatsItem[] = [];
    let routePerformance: NonNullable<OperatorRevenueAnalytics["routePerformance"]> = [];

    try {
      const bookingStats = await getOperatorBookingStats({
        ...currentYearRange(),
        groupBy: "date",
      });
      if (!isLatest()) return;
      bookingItems = bookingStats.items;
      const monthlyStats = aggregateBookingStats(bookingItems);
      const thisMonthStats = monthlyStats.get(selectedRevenueMonth);
      const lastMonthStats = monthlyStats.get(
        previousMonthOf(selectedRevenueMonth),
      );

      setRevenueData(mapDashboardChart(bookingItems));
      setSummary((current) => ({
        ...current,
        revenue: {
          currentMonth: thisMonthStats?.revenue ?? 0,
          previousMonth: lastMonthStats?.revenue ?? 0,
          yearToDate: null,
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
      if (!isLatest()) return;
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
      if (!isLatest()) return;
      setVehicles(fleet.items);
      setSummary((current) => ({ ...current, fleet: fleet.totalItems }));
    } catch (error) {
      if (!isLatest()) return;
      setVehicles([]);
      setSummary((current) => ({ ...current, fleet: null }));
      appendError(tRef.current("dashboard.errorSourceFleet"), error);
    }

    if (isOperatorAdmin) {
      const { from, to } = currentYearRange();

      try {
        const analytics =
          await getOperatorRevenueAnalytics({ month: selectedRevenueMonth });
        if (!isLatest()) return;
        routePerformance = analytics.routePerformance ?? [];
        const selectedYear = selectedRevenueMonth.slice(0, 4);
        const yearToDate = analytics.monthly
          .filter((item) => item.month.startsWith(selectedYear))
          .reduce((total, item) => total + item.netRevenueVnd, 0);
        setRevenueData(mapDashboardChart(bookingItems, analytics.monthly));
        setSummary((current) => ({
          ...current,
          revenue: {
            ...current.revenue,
            currentMonth: analytics.summary.netRevenueVnd.currentValue,
            previousMonth: analytics.summary.netRevenueVnd.previousValue,
            yearToDate,
          },
        }));

        if (parcelEnabled) {
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
                  sharePercent:
                    (item.parcelCount / analyticsParcelTotal) * 100,
                  tripCount: item.tripCount,
                  completionRatePercent: item.completionRatePercent,
                })),
            );
          }
        }
      } catch (error) {
        if (!isLatest()) return;
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
        if (!isLatest()) return;
        setSummary((current) => ({
          ...current,
          activeTrips: trips.totalItems,
        }));
      } catch (error) {
        if (!isLatest()) return;
        setSummary((current) => ({ ...current, activeTrips: null }));
        appendError(tRef.current("dashboard.errorSourceActiveTrips"), error);
      }

      if (parcelEnabled) {
        try {
          const statusStats = await getOperatorParcelStats({
            from,
            to,
            groupBy: "status",
          });
          if (!isLatest()) return;
          setParcelStatusData(
            statusStats.items.map((item, index) => ({
              key: item.key ?? "UNKNOWN",
              value: item.count ?? 0,
              color: statusColor(item.key ?? "UNKNOWN", index),
            })),
          );
        } catch (error) {
          if (!isLatest()) return;
          setParcelStatusData([]);
          appendError(tRef.current("dashboard.errorSourceParcelStats"), error);
        }

        try {
          const routeStats = await getOperatorParcelStats({
            from,
            to,
            groupBy: "route",
            limit: 5,
          });
          if (!isLatest()) return;
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
                const name =
                  item.routeName ??
                  item.key ??
                  tRef.current("dashboard.unknownRoute");
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
          if (!isLatest()) return;
          appendError(
            tRef.current("dashboard.errorSourceParcelRouteStats"),
            error,
          );
        }
      } else {
        setParcelStatusData([]);
        setParcelRouteData([]);
        setParcelRouteTotal(0);
      }
    } else {
      setParcelStatusData([]);
      setParcelRouteData([]);
      setParcelRouteTotal(0);
      setSummary((current) => ({ ...current, activeTrips: null }));
    }

    if (isLatest()) setIsLoading(false);
  }, [
    appendError,
    isOperatorAdmin,
    parcelEnabled,
    selectedRevenueMonth,
    startDashboardRequest,
  ]);

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
      [
        t("dashboard.csvCode"),
        t("dashboard.route"),
        t("dashboard.sender"),
        t("dashboard.recipient"),
        t("dashboard.amount"),
        tc("status"),
      ],
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

  useToastFeedback({ error: loadErrors.length > 0 ? loadErrors.join(" | ") : "" });
  return (
    <div className="space-y-6 pb-4">
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
          <h1 className="text-3xl font-bold text-gray-900">
            {t("dashboard.title")}
          </h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isOperatorAdmin && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <CustomSelect
                value={selectedRevenueMonth}
                onChange={(event) =>
                  setSelectedRevenueMonth(event.target.value)
                }
                className="min-w-[132px] rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-medium text-gray-800"
                aria-label={t("dashboard.revenueMonth")}
              >
                {revenueMonths.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CustomSelect>
            </label>
          )}
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isLoading}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-vr-800 px-4 py-2 text-white transition hover:bg-vr-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw
              size={18}
              className={isLoading ? "animate-spin" : ""}
            />
            {tc("refresh")}
          </button>
        </div>
      </div>

      <KpiGrid summary={summary} />

      <div
        className={`grid grid-cols-1 gap-6 ${
          parcelEnabled ? "lg:grid-cols-3" : "lg:grid-cols-2"
        }`}
      >
        <RevenueChart data={revenueData} isLoading={isLoading} />

        {parcelEnabled && <ParcelStatusChart
          data={parcelStatusData}
          total={parcelStatusTotal}
          isLoading={isLoading}
          isOperatorAdmin={isOperatorAdmin}
        />}
      </div>

      <div
        className={`grid grid-cols-1 gap-6 ${
          parcelEnabled ? "lg:grid-cols-3" : "lg:grid-cols-1"
        }`}
      >
        {parcelEnabled && <ParcelRouteChart
          data={parcelRouteData}
          total={parcelRouteTotal}
          isLoading={isLoading}
          isOperatorAdmin={isOperatorAdmin}
        />}

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t("dashboard.fleetStatus")}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("dashboard.fleetStatusHint")}
              </p>
            </div>
            <Badge tone="brand">
              {t("dashboard.vehicleCount", { count: vehicles.length })}
            </Badge>
          </div>
          {vehicles.length === 0 ? (
            <EmptyChartState
              message={
                isLoading
                  ? t("dashboard.loadingData")
                  : t("dashboard.noVehicles")
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicleId(vehicle)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gradient-to-r from-slate-50 to-white p-3.5 transition hover:border-vr-100 hover:shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vr-50 text-vr-900">
                      <FiTruck size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {vehicle.licensePlate}
                      </p>
                      <p className="text-xs text-gray-500">
                        {vehicle.vehicleTypeName ??
                          vehicle.vehicleTypeCode ??
                          "-"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold " +
                      vehicleStatusClass(vehicle.status)
                    }
                  >
                    {tc(`enumLabels.${vehicle.status}`, {
                      defaultValue: vehicle.status,
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {parcelEnabled && <RecentShipmentsTable
        shipments={shipments}
        isLoading={isLoading}
        page={shipmentPage}
        pageSize={pageSize}
        totalItems={shipmentTotal}
        onPageChange={setShipmentPage}
        onExport={handleExportShipments}
        onViewShipment={(shipmentId) =>
          navigate(`/manager/parcels?parcelId=${shipmentId}`)
        }
      />}
    </div>
  );
}





