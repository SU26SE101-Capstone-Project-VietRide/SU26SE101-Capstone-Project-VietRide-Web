import type {
  FinancialDataCompleteness,
  TripSettlementProcessingState,
} from "../../../api/vietride";
import { FinancialDataCompletenessBadge } from "../../../components/FinancialDataCompletenessBadge";
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
  return (
    <FinancialDataCompletenessBadge
      completeness={completeness}
      missingFields={missingFields}
      label={t("wallet.partialBadge")}
      tooltip={t("wallet.partialTooltip")}
      className="ml-2"
    />
  );
}
