import type {
  IncidentCategory,
  IncidentStatus,
  OperatorIncident,
} from "../../../api/vietride";

export const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100";
export const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";

export const categoryBadgeClass: Record<IncidentCategory, string> = {
  TRAFFIC_JAM: "bg-amber-50 text-amber-800 ring-1 ring-amber-100",
  VEHICLE_BREAKDOWN: "bg-red-50 text-red-800 ring-1 ring-red-100",
  ACCIDENT: "bg-red-100 text-red-900 ring-1 ring-red-200",
  WEATHER: "bg-sky-50 text-sky-800 ring-1 ring-sky-100",
  OTHER: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
};

export const statusBadgeClass: Record<IncidentStatus, string> = {
  OPEN: "bg-red-50 text-red-700 ring-1 ring-red-100",
  RESOLVED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
};

export function badgeClassFor(
  map: Record<string, string>,
  value: string,
  fallback: string,
) {
  return map[value] ?? fallback;
}

/**
 * Toạ độ báo cáo — BE cho phép null cả hai. Chỉ dựng link bản đồ khi có đủ cặp.
 */
export function incidentMapUrl(incident: OperatorIncident): string | null {
  if (incident.latitude == null || incident.longitude == null) return null;
  return `https://www.google.com/maps?q=${incident.latitude},${incident.longitude}`;
}

/** Nhãn người báo — `displayName`/`role` có thể null khi Identity lookup thiếu hồ sơ */
export function reporterLabel(
  incident: OperatorIncident,
  unknownLabel: string,
): string {
  return incident.reporter.displayName?.trim() || unknownLabel;
}
