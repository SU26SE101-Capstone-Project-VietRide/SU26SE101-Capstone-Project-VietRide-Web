// Diễn giải field chất lượng ETA của BE (`estimateQuality` bên Tracking và
// `plannedEtaQuality` bên Trip) thành thứ UI dùng được: nhãn, tooltip, tone pill.
//
// Enum là additive — Day 51 BE thêm `ROUTE_BASED` và nói rõ còn có thể thêm nữa
// — nên hàm ở đây KHÔNG bao giờ trả về null cho giá trị lạ mà lùi về nhánh
// `UNKNOWN` với nhãn trung tính. Nhờ vậy giá trị enum mới không làm mất cả khối
// ETA hay ném lỗi ở tầng render.
import type { TrackingEstimateQuality } from "../api/vietride";
import type { BadgeTone } from "../components/ui/Badge";

/** Nhánh hiển thị; `UNKNOWN` gom mọi giá trị BE thêm về sau */
export type EtaQualityKind =
  | "TRAFFIC_AWARE"
  | "ROUTE_BASED"
  | "FALLBACK"
  | "UNKNOWN";

export type EtaQualityDescriptor = {
  kind: EtaQualityKind;
  /** Key i18n namespace `manager` cho nhãn ngắn trên pill */
  labelKey: string;
  /** Key i18n cho câu giải thích cách tính (tooltip) */
  hintKey: string;
  tone: BadgeTone;
};

// Không dùng `danger`/`warning` cho FALLBACK: đây là mức chính xác thấp hơn,
// không phải trạng thái xấu của chuyến — xem ghi chú tone trong Badge.tsx.
const DESCRIPTORS: Record<EtaQualityKind, EtaQualityDescriptor> = {
  TRAFFIC_AWARE: {
    kind: "TRAFFIC_AWARE",
    labelKey: "gps.etaTrafficAware",
    hintKey: "gps.etaTrafficAwareHint",
    tone: "success",
  },
  ROUTE_BASED: {
    kind: "ROUTE_BASED",
    labelKey: "gps.etaRouteBased",
    hintKey: "gps.etaRouteBasedHint",
    tone: "info",
  },
  FALLBACK: {
    kind: "FALLBACK",
    labelKey: "gps.etaFallbackQuality",
    hintKey: "gps.etaFallbackQualityHint",
    tone: "neutral",
  },
  UNKNOWN: {
    kind: "UNKNOWN",
    labelKey: "gps.etaQualityUnknown",
    hintKey: "gps.etaQualityUnknownHint",
    tone: "neutral",
  },
};

function toKind(quality: string): EtaQualityKind {
  switch (quality) {
    case "TRAFFIC_AWARE":
    case "ROUTE_BASED":
    case "FALLBACK":
      return quality;
    default:
      return "UNKNOWN";
  }
}

/**
 * `null` chỉ khi BE không gửi field (chưa có dữ liệu chất lượng) — lúc đó ẩn
 * hẳn badge. Chuỗi rỗng cũng coi như không có.
 */
export function describeEtaQuality(
  quality: TrackingEstimateQuality | null | undefined,
): EtaQualityDescriptor | null {
  if (typeof quality !== "string" || quality.trim() === "") return null;

  return DESCRIPTORS[toKind(quality)];
}
