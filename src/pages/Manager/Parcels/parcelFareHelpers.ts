import type {
  ParcelRouteFare,
  ParcelSizeCategory,
} from "../../../api/vietride";

export const parcelSizeCategories = [
  "SMALL",
  "MEDIUM",
  "LARGE",
  "EXTRA_LARGE",
] as const satisfies readonly ParcelSizeCategory[];

export type RouteFareTemporalStatus = "ACTIVE" | "SCHEDULED" | "EXPIRED";
export type RouteFareStatus =
  | "UNPRICED"
  | "ACTIVE"
  | "SCHEDULED"
  | "EXPIRED"
  | "INCOMPLETE";

export type RouteFareWindow = {
  effectiveFrom: string;
  effectiveUntil: string | null;
  fares: Partial<Record<ParcelSizeCategory, ParcelRouteFare>>;
  configuredSizeCount: number;
  temporalStatus: RouteFareTemporalStatus;
};

export type RouteFareSummary = {
  status: RouteFareStatus;
  configuredSizeCount: number;
  window: RouteFareWindow | null;
  hasScheduledWindow: boolean;
};

export type FareEditorMode = "CREATE" | "UPDATE" | "COMPLETE" | "RENEW";

export type FareSelection = {
  mode: FareEditorMode;
  prices: Record<ParcelSizeCategory, string>;
  effectiveFrom: string;
  effectiveUntil: string;
};

/**
 * Bỏ dấu + thường hoá để so khớp tìm kiếm. Người dùng gõ "da lat" phải khớp
 * "Đà Lạt"; `toLowerCase().includes()` trần thì không.
 */
export function stripDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}

export function createEmptyFarePrices(): Record<ParcelSizeCategory, string> {
  return {
    SMALL: "",
    MEDIUM: "",
    LARGE: "",
    EXTRA_LARGE: "",
  };
}

function isParcelSizeCategory(value: string): value is ParcelSizeCategory {
  return parcelSizeCategories.some((category) => category === value);
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getTemporalStatus(
  effectiveFrom: string,
  effectiveUntil: string | null,
  nowTimestamp: number,
): RouteFareTemporalStatus {
  const fromTimestamp = toTimestamp(effectiveFrom) ?? nowTimestamp;
  const untilTimestamp = toTimestamp(effectiveUntil);

  if (fromTimestamp > nowTimestamp) {
    return "SCHEDULED";
  }

  if (untilTimestamp !== null && untilTimestamp < nowTimestamp) {
    return "EXPIRED";
  }

  return "ACTIVE";
}

function windowPriority(window: RouteFareWindow) {
  if (window.temporalStatus === "ACTIVE") return 0;
  if (window.temporalStatus === "SCHEDULED") return 1;
  return 2;
}

export function getRouteFareSummary(
  routeId: string,
  routeFares: ParcelRouteFare[],
  now = new Date(),
): RouteFareSummary {
  const windows = new Map<string, RouteFareWindow>();

  routeFares
    .filter((fare) => fare.routeId === routeId && isParcelSizeCategory(fare.sizeCategory))
    .forEach((fare) => {
      const effectiveUntil = fare.effectiveUntil ?? null;
      const key = `${fare.effectiveFrom}|${effectiveUntil ?? ""}`;
      const current = windows.get(key) ?? {
        effectiveFrom: fare.effectiveFrom,
        effectiveUntil,
        fares: {},
        configuredSizeCount: 0,
        temporalStatus: getTemporalStatus(
          fare.effectiveFrom,
          effectiveUntil,
          now.getTime(),
        ),
      };

      current.fares[fare.sizeCategory] = fare;
      current.configuredSizeCount = Object.keys(current.fares).length;
      windows.set(key, current);
    });

  const selectedWindow = [...windows.values()].sort((left, right) => {
    const priorityDifference = windowPriority(left) - windowPriority(right);
    if (priorityDifference !== 0) return priorityDifference;

    const leftFrom = toTimestamp(left.effectiveFrom) ?? 0;
    const rightFrom = toTimestamp(right.effectiveFrom) ?? 0;
    return left.temporalStatus === "SCHEDULED"
      ? leftFrom - rightFrom
      : rightFrom - leftFrom;
  })[0];

  if (!selectedWindow) {
    return {
      status: "UNPRICED",
      configuredSizeCount: 0,
      window: null,
      hasScheduledWindow: false,
    };
  }

  return {
    status:
      selectedWindow.configuredSizeCount < parcelSizeCategories.length
        ? "INCOMPLETE"
        : selectedWindow.temporalStatus,
    configuredSizeCount: selectedWindow.configuredSizeCount,
    window: selectedWindow,
    hasScheduledWindow: [...windows.values()].some(
      (window) =>
        window !== selectedWindow && window.temporalStatus === "SCHEDULED",
    ),
  };
}

function pricesFromWindow(window: RouteFareWindow) {
  return parcelSizeCategories.reduce<Record<ParcelSizeCategory, string>>(
    (prices, category) => {
      const fare = window.fares[category];
      prices[category] = fare ? String(fare.priceVnd) : "";
      return prices;
    },
    createEmptyFarePrices(),
  );
}

export function buildFareSelection(
  summary: RouteFareSummary,
  now = new Date(),
): FareSelection {
  if (!summary.window) {
    return {
      mode: "CREATE",
      prices: createEmptyFarePrices(),
      effectiveFrom: now.toISOString(),
      effectiveUntil: "",
    };
  }

  if (summary.window.temporalStatus === "EXPIRED") {
    return {
      mode: "RENEW",
      prices: pricesFromWindow(summary.window),
      effectiveFrom: now.toISOString(),
      effectiveUntil: "",
    };
  }

  return {
    mode: summary.configuredSizeCount < parcelSizeCategories.length
      ? "COMPLETE"
      : "UPDATE",
    prices: pricesFromWindow(summary.window),
    effectiveFrom: summary.window.effectiveFrom,
    effectiveUntil: summary.window.effectiveUntil ?? "",
  };
}

/**
 * Selection khi bấm sửa từ một dòng bảng.
 *
 * BE giữ ĐÚNG MỘT bản ghi cho mỗi (tuyến, cỡ kiện) — `FindByRouteAndSizesAsync`
 * tra theo cặp đó rồi `ToDictionary(SizeCategory)`, nên không thể có hai bản ghi
 * cùng cỡ kiện trên một tuyến. Vì vậy giá luôn lấy theo TOÀN BỘ cỡ kiện của
 * tuyến, không lọc theo khung hiệu lực: các cỡ có thể đã trôi sang mốc hiệu lực
 * khác nhau (di sản của thời còn sửa lẻ từng cỡ), lọc theo khung sẽ để trống
 * những mức đang hiển thị ngay trên bảng và bắt người dùng gõ lại.
 *
 * Mốc hiệu lực thì lấy theo ĐÚNG dòng được bấm — đó là con số người dùng đang
 * nhìn thấy khi bấm bút chì.
 */
export function buildRouteFareSelection(
  routeFares: ParcelRouteFare[],
  target: ParcelRouteFare,
): FareSelection {
  const prices = createEmptyFarePrices();
  let configuredSizeCount = 0;

  routeFares.forEach((fare) => {
    if (fare.routeId !== target.routeId || !isParcelSizeCategory(fare.sizeCategory)) {
      return;
    }

    if (prices[fare.sizeCategory] === "") {
      configuredSizeCount += 1;
    }
    prices[fare.sizeCategory] = String(fare.priceVnd);
  });

  return {
    mode:
      configuredSizeCount < parcelSizeCategories.length ? "COMPLETE" : "UPDATE",
    prices,
    effectiveFrom: target.effectiveFrom,
    effectiveUntil: target.effectiveUntil ?? "",
  };
}

export function buildNextFareSelection(
  summary: RouteFareSummary,
): FareSelection | null {
  if (!summary.window?.effectiveUntil || summary.hasScheduledWindow) {
    return null;
  }

  const untilTimestamp = toTimestamp(summary.window.effectiveUntil);
  if (untilTimestamp === null) {
    return null;
  }

  return {
    mode: "RENEW",
    prices: pricesFromWindow(summary.window),
    effectiveFrom: new Date(untilTimestamp + 60_000).toISOString(),
    effectiveUntil: "",
  };
}
