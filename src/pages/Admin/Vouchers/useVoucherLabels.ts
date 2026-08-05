import { useTranslation } from "react-i18next";
import type { AdminVoucher } from "../../../api/vietride";

// Hook cục bộ của màn Admin Vouchers: label dịch cho phạm vi áp dụng,
// nguồn tài trợ và phạm vi nhà xe của voucher.
export function useVoucherLabels() {
  const { t } = useTranslation("admin");

  const getApplicableLabel = (applicableTo = "all") => {
    const map: Record<string, string> = {
      all: t("vouchers.allServices"),
      rides: t("vouchers.tripsOnly"),
      parcels: t("vouchers.parcelsOnly"),
    };
    return map[applicableTo] ?? applicableTo;
  };

  const getFundingLabel = (fundingType = "VIETRIDE_FUNDED") => {
    const map: Record<string, string> = {
      VIETRIDE_FUNDED: t("vouchers.vietrideFunded"),
      OPERATOR_FUNDED: t("vouchers.operatorFunded"),
    };
    return map[fundingType] ?? fundingType;
  };

  const getOperatorScopeLabel = (voucher: AdminVoucher) => {
    if (voucher.operatorScope === "SELECTED_OPERATORS") {
      const count = voucher.applicableOperatorIds?.length ?? 0;
      return t("vouchers.selectedOperatorsCount", { count });
    }

    return t("vouchers.allOperators");
  };

  return { getApplicableLabel, getFundingLabel, getOperatorScopeLabel };
}
