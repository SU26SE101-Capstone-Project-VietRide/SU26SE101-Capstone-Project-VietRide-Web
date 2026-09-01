import { useTranslation } from "react-i18next";

// Hook cục bộ của màn Admin Vouchers: label dịch cho dịch vụ áp dụng.
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

  return { getApplicableLabel };
}
