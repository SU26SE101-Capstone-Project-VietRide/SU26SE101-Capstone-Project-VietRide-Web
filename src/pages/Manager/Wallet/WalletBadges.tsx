import type {
  FinancialDataCompleteness,
  TripSettlementProcessingState,
} from "../../../api/vietride";
import { processingStateClass } from "./walletFormat";
import type { Translate } from "./walletTableShared";

export function ProcessingStateBadge({
  state,
  t,
}: {
  state?: TripSettlementProcessingState;
  t: Translate;
}) {
  if (!state) return null;

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${processingStateClass(state)}`}
    >
      {t(`wallet.processingState.${state}`)}
    </span>
  );
}

// dataCompleteness=PARTIAL nghĩa là tiền vẫn dùng được, chỉ thiếu metadata
// đối soát — badge KHÔNG được đọc như một lỗi hay dữ liệu không tin cậy.
export function DataCompletenessBadge({
  completeness,
  missingFields,
  t,
}: {
  completeness?: FinancialDataCompleteness;
  missingFields?: string[];
  t: Translate;
}) {
  if (completeness !== "PARTIAL") return null;

  const tooltip = missingFields?.length
    ? `${t("wallet.partialTooltip")} (${missingFields.join(", ")})`
    : t("wallet.partialTooltip");

  return (
    <span
      title={tooltip}
      className="ml-2 inline-flex cursor-help rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800"
    >
      {t("wallet.partialBadge")}
    </span>
  );
}
