// Cảnh báo nhà xe sắp chạm / đã chạm hạn mức gói đang dùng, kèm nút nhảy
// thẳng tới các gói còn chứa nổi quy mô của họ (handoff §1 mục 1).
//
// Vì sao cần: hạn mức chỉ lộ ra lúc thao tác bị chặn — thêm xe thứ 21 mới biết
// gói chỉ cho 20. Lúc đó họ đang dở việc, và phải tự mò sang màn gói. Báo trước
// ở ngưỡng 80% cho họ thời gian xoay xở.
import { useTranslation } from "react-i18next";
import { FiAlertTriangle, FiArrowRight } from "react-icons/fi";
import { Button } from "../../../components/ui/Button";
import type { UsagePressure } from "../../../utils/subscription";
import { formatNumber } from "./subscriptionHelpers";

type UsagePressureBannerProps = {
  pressures: UsagePressure[];
  // Có gói nào lớn hơn để mời không — không có thì đừng dựng nút dẫn tới hư không
  hasUpgradeOption: boolean;
  onChoosePlan: () => void;
};

export default function UsagePressureBanner({
  pressures,
  hasUpgradeOption,
  onChoosePlan,
}: UsagePressureBannerProps) {
  const { t } = useTranslation("manager");

  if (pressures.length === 0) return null;

  // Đã chạm hạn mức là đang bị chặn thao tác — nặng hơn hẳn "sắp chạm"
  const hasReached = pressures.some((pressure) => pressure.reached);

  return (
    <section
      data-testid="usage-pressure-banner"
      className={`flex flex-wrap items-start justify-between gap-4 rounded-lg border p-5 ${
        hasReached
          ? "border-red-200 bg-red-50/70"
          : "border-amber-200 bg-amber-50/70"
      }`}
    >
      <div className="min-w-0">
        <p
          className={`flex items-center gap-2 font-semibold ${
            hasReached ? "text-red-800" : "text-amber-900"
          }`}
        >
          <FiAlertTriangle className="shrink-0" />
          {t(
            hasReached
              ? "packages.usageReachedTitle"
              : "packages.usageNearTitle",
          )}
        </p>
        <ul className="mt-2 space-y-1 text-sm text-gray-700">
          {pressures.map((pressure) => (
            <li
              key={pressure.limitKey}
              data-testid={`usage-pressure-${pressure.limitKey}`}
              className="tabular-nums"
            >
              {t(
                pressure.reached
                  ? "packages.usageReachedItem"
                  : "packages.usageNearItem",
                {
                  label: t(`packages.limitLabels.${pressure.limitKey}`),
                  used: formatNumber(pressure.used),
                  limit: formatNumber(pressure.limit),
                },
              )}
            </li>
          ))}
        </ul>
      </div>

      {hasUpgradeOption ? (
        <Button
          variant="primary"
          data-testid="usage-pressure-cta"
          onClick={onChoosePlan}
        >
          {t("packages.usageChoosePlanCta")}
          <FiArrowRight size={16} />
        </Button>
      ) : (
        // Không gói tiêu chuẩn nào đủ lớn → lối ra duy nhất là xin gói riêng
        <p className="max-w-xs text-sm text-gray-600">
          {t("packages.usageNoPlanFitsHint")}
        </p>
      )}
    </section>
  );
}
