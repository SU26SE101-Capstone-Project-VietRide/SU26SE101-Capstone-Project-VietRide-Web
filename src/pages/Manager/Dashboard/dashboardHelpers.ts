import type {
  BookingStatsItem,
  OperatorParcelListItem,
  OperatorRevenueAnalytics,
  OperatorVehicle,
} from "../../../api/vietride";
import { formatCurrency } from "../../../utils/currency";
import { chartColorAt } from "../../../lib/chartColors";

// Type dữ liệu dùng chung giữa index và các sub-component của màn Dashboard
export type RevenueChartPoint = {
  monthKey: string;
  month: string;
  revenue: number;
  bookings: number;
};

export type ParcelStatusPoint = {
  key: string;
  value: number;
  color: string;
};

export type ParcelRoutePoint = {
  routeId?: string;
  name: string;
  value: number;
  sharePercent: number;
  tripCount?: number;
  completionRatePercent?: number;
};

export type Shipment = {
  id: string;
  code: string;
  route: string;
  sender: string;
  recipient: string;
  cost: number;
  status: string;
};

export type DashboardSummary = {
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

export function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function currentYearRange() {
  const now = new Date();
  return {
    from: toDateInput(new Date(now.getFullYear(), 0, 1)),
    to: toDateInput(now),
  };
}

export function currentMonth() {
  return toDateInput(new Date()).slice(0, 7);
}

export function previousMonth() {
  const now = new Date();
  return toDateInput(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(
    0,
    7,
  );
}

export function getMonthKey(dateValue?: string) {
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

export function monthLabel(monthKey: string) {
  const month = Number(monthKey.slice(5, 7));
  return Number.isFinite(month) && month > 0 ? `T${month}` : monthKey;
}

// Giữ nguyên số tiền đầy đủ, KHÔNG rút gọn hay làm tròn. Nhãn trục dài thì nới
// `width` của YAxis bên RevenueChart, đừng đụng vào con số.
export function formatCompactMoney(value: number) {
  return formatCurrency(value);
}

/**
 * Màu theo trạng thái cho biểu đồ tròn/cột.
 *
 * Giữ nguyên họ màu ngữ nghĩa (đỏ = hỏng, xanh lá = xong, xanh dương = đang
 * chạy, hổ phách = chờ) nhưng đẩy xuống bậc đủ tương phản: bản cũ có 4/7 màu
 * dưới 3:1 với nền trắng (PENDING `#f59e0b` chỉ 2,15:1).
 *
 * EXPIRED chuyển sang xám trung tính thay vì cam: đây là trạng thái đã chết,
 * và quan trọng hơn — bản cũ để nó cách PENDING đúng **13°** hue nên hai lát
 * bánh cạnh nhau gần như không phân biệt được, càng không nếu mù màu.
 */
export function statusColor(key: string, index: number) {
  const normalized = key.toUpperCase();
  if (normalized.includes("EXPIRED")) return "#374151"; // gray-700
  if (normalized.includes("REJECT")) return "#991b1b"; // red-800
  if (normalized.includes("CANCEL") || normalized.includes("FAIL")) return "#dc2626"; // red-600
  if (normalized.includes("DELIVER") || normalized.includes("COMPLETE")) return "#15803d"; // green-700
  if (normalized.includes("TRANSIT") || normalized.includes("LOADED")) return "#0369a1"; // sky-700
  if (normalized.includes("CONFIRM") || normalized.includes("PROCESS")) return "#4338ca"; // indigo-700
  if (normalized.includes("PENDING") || normalized.includes("WAIT")) return "#a16207"; // amber-700
  return chartColorAt(index);
}

export function vehicleStatusClass(status: string) {
  const normalized = status.toUpperCase();
  if (normalized.includes("ACTIVE") || normalized.includes("AVAILABLE") || normalized.includes("READY")) return "bg-emerald-50 text-emerald-700";
  if (normalized.includes("TRIP") || normalized.includes("RUN") || normalized.includes("BUSY")) return "bg-sky-50 text-sky-700";
  if (normalized.includes("MAINTENANCE") || normalized.includes("REPAIR")) return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export function formatCompactNumber(value: number) {
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toLocaleString("vi-VN");
}

export function sumStats(items: BookingStatsItem[], key: keyof BookingStatsItem) {
  return items.reduce((total, item) => {
    const value = item[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}

export function aggregateBookingStats(items: BookingStatsItem[]) {
  const monthlyStats = new Map<string, { revenue: number; bookings: number }>();

  for (const item of items) {
    const monthKey = getMonthKey(item.date);
    if (!monthKey) {
      continue;
    }

    const current = monthlyStats.get(monthKey) ?? { revenue: 0, bookings: 0 };
    current.revenue += 0;
    current.bookings += item.totalBookings ?? 0;
    monthlyStats.set(monthKey, current);
  }

  return monthlyStats;
}

export function mapDashboardChart(
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
    current.revenue = item.netRevenueVnd;
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

export function compactRouteName(name: string) {
  return name.length > 24 ? `${name.slice(0, 22)}…` : name;
}

export function mapShipment(parcel: OperatorParcelListItem): Shipment {
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

export function vehicleId(vehicle: OperatorVehicle) {
  return vehicle.vehicleId ?? vehicle.id ?? vehicle.licensePlate;
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}


