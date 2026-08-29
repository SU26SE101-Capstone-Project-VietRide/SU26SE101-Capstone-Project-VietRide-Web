import type {
  IncidentCategory,
  IncidentStatus,
  OperatorIncident,
} from "../../../api/vietride";

export const inputClass =
  "h-12 w-full rounded-[9999px] border border-slate-300 bg-white px-4 py-3 text-[15px] text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-vr-500 focus:ring-4 focus:ring-vr-100";
export const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";

/**
 * LOẠI sự cố dùng pill trung tính — cố ý không mã hoá bằng màu.
 *
 * Trước đây `ACCIDENT` là đỏ đậm và `VEHICLE_BREAKDOWN` là đỏ nhạt, đứng ngay
 * cạnh pill TRẠNG THÁI `OPEN` cũng màu đỏ. Hai pill đỏ liền nhau, một cái nói
 * "chuyện gì xảy ra" một cái nói "đã xử lý chưa" — người đọc không có cách nào
 * biết cái nào là cái nào. Màu ở màn này chỉ dành cho trạng thái.
 */
export const categoryBadgeClass: Record<IncidentCategory, string> = {
  TRAFFIC_JAM: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
  VEHICLE_BREAKDOWN: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
  ACCIDENT: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
  WEATHER: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
  OTHER: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
};

/** TRẠNG THÁI là chỗ duy nhất được dùng màu ngữ nghĩa ở màn này. */
export const statusBadgeClass: Record<IncidentStatus, string> = {
  OPEN: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
  RESOLVED: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100",
};

export function badgeClassFor(
  map: Record<string, string>,
  value: string,
  fallback: string,
) {
  return map[value] ?? fallback;
}

/** Nhãn người báo — `displayName`/`role` có thể null khi Identity lookup thiếu hồ sơ */
export function reporterLabel(
  incident: OperatorIncident,
  unknownLabel: string,
): string {
  return incident.reporter.displayName?.trim() || unknownLabel;
}
