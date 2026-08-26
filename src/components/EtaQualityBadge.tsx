// Pill "chất lượng ETA" dùng chung cho mọi chỗ hiển thị giờ đến dự kiến:
// timeline ETA của Trung tâm vận hành, thẻ ETA của chuyến đang chọn và thẻ
// theo dõi xe trung chuyển.
//
// Gom về một component vì đây là enum additive: BE thêm giá trị mới thì chỉ
// phải sửa `describeEtaQuality` + 2 key i18n, không phải đi tìm từng chỗ có
// `switch` viết tay.
import type { IconType } from "react-icons";
import { FiActivity, FiCompass, FiHelpCircle, FiMap } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import type { TrackingEstimateQuality } from "../api/vietride";
import { Badge } from "./ui/Badge";
import {
  describeEtaQuality,
  type EtaQualityKind,
} from "../utils/etaQuality";

const KIND_ICONS: Record<EtaQualityKind, IconType> = {
  TRAFFIC_AWARE: FiActivity,
  ROUTE_BASED: FiMap,
  FALLBACK: FiCompass,
  UNKNOWN: FiHelpCircle,
};

type EtaQualityBadgeProps = {
  /** `estimateQuality` (Tracking) hoặc `plannedEtaQuality` (Trip) */
  quality: TrackingEstimateQuality | null | undefined;
  className?: string;
};

export function EtaQualityBadge({
  quality,
  className = "",
}: EtaQualityBadgeProps) {
  const { t } = useTranslation("manager");
  const descriptor = describeEtaQuality(quality);

  // BE chưa gửi field chất lượng thì không dựng pill rỗng.
  if (!descriptor) return null;

  const Icon = KIND_ICONS[descriptor.kind];
  const label = t(descriptor.labelKey);
  const hint = t(descriptor.hintKey);

  return (
    <Badge
      tone={descriptor.tone}
      className={`gap-1 px-2 py-0.5 font-medium ${className}`.trim()}
    >
      {/* title nằm trên chính pill để hover ở đâu trong pill cũng ra tooltip */}
      <span
        className="inline-flex items-center gap-1"
        title={hint}
        aria-label={t("gps.etaQualityAria", { label, hint })}
        data-testid={`eta-quality-${descriptor.kind}`}
      >
        <Icon size={11} aria-hidden="true" />
        {label}
      </span>
    </Badge>
  );
}
