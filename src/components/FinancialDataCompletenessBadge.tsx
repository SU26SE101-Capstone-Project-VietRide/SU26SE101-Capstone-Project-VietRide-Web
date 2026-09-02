import type { FinancialDataCompleteness } from "../api/vietride";

export function FinancialDataCompletenessBadge({
  completeness,
  missingFields,
  label,
  tooltip,
  className = "",
}: {
  completeness?: FinancialDataCompleteness;
  missingFields?: string[];
  label: string;
  tooltip: string;
  className?: string;
}) {
  if (completeness !== "PARTIAL") return null;

  const details = missingFields?.length
    ? `${tooltip} (${missingFields.join(", ")})`
    : tooltip;

  return (
    <span
      title={details}
      className={`inline-flex cursor-help rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ${className}`}
    >
      {label}
    </span>
  );
}
