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
 * Giữ họ màu ngữ nghĩa (đỏ/hồng = hỏng, lục = xong, lam = đang chạy, hổ phách =
 * chờ) nhưng cả bảy bậc đã chạy qua validator bảng màu (5 kiểm tra: dải sáng,
 * sàn chroma, tách biệt mù màu, sàn thị lực thường, tương phản nền).
 *
 * Bản trước FAIL 3/5: `#374151` nằm ngoài dải sáng VÀ đọc ra như xám thuần
 * (chroma 0,031), còn sky-700 với indigo-700 chỉ cách nhau ΔE 14,1 — dưới sàn
 * 15, tức người mắt thường cũng khó phân biệt. Bản này 0 FAIL.
 *
 * Thứ tự lát bánh do BE trả nên CẶP NÀO CŨNG có thể nằm cạnh nhau — bảng màu
 * được kiểm theo chế độ all-pairs chứ không chỉ các cặp kề.
 *
 * Còn đúng một cảnh báo: EXPIRED ↔ CANCELLED cách ΔE 6,8 dưới protanopia, nằm
 * trong dải 6–8 chỉ hợp lệ khi có kênh mã hoá thứ hai. Ở đây có đủ: chú giải
 * liệt kê TÊN từng trạng thái kèm số lượng, và `paddingAngle` chừa khe giữa các
 * lát. Không được bỏ hai thứ đó khi sửa biểu đồ.
 */
export function statusColor(key: string, index: number) {
  const normalized = key.toUpperCase();
  if (normalized.includes("EXPIRED")) return "#854d0e"; // amber-800
  if (normalized.includes("REJECT")) return "#86198f"; // fuchsia-800
  if (normalized.includes("CANCEL") || normalized.includes("FAIL")) return "#e11d48"; // rose-600
  if (normalized.includes("DELIVER") || normalized.includes("COMPLETE")) return "#047857"; // emerald-700
  if (normalized.includes("TRANSIT") || normalized.includes("LOADED")) return "#0284c7"; // sky-600
  if (normalized.includes("CONFIRM") || normalized.includes("PROCESS")) return "#4f46e5"; // indigo-600
  if (normalized.includes("PENDING") || normalized.includes("WAIT")) return "#d97706"; // amber-600
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


