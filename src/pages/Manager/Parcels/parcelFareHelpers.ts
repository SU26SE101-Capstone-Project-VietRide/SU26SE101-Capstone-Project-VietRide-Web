import type {
  ParcelRouteFare,
  ParcelRouteFareEntry,
  ParcelRouteFareGroup,
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

// ── API list gom theo tuyến (BE commit 9e1488a2) ───────────────────────────

/**
 * Khoá so sánh khoảng hiệu lực, ĐÃ chuẩn hoá về mốc thời gian thật.
 *
 * Không so chuỗi thô: hai chuỗi lệch offset timezone (`...T16:30:00Z` và
 * `...T23:30:00+07:00`) là cùng một thời điểm nhưng khác ký tự, so thô sẽ báo
 * "không đồng nhất" oan.
 */
export function fareWindowKey(fare: ParcelRouteFareEntry): string {
  const from = new Date(fare.effectiveFrom).getTime();
  const until = fare.effectiveUntil
    ? new Date(fare.effectiveUntil).getTime()
    : null;

  return `${from}|${until ?? "NO_LIMIT"}`;
}

/** Các mức giá của tuyến đang dùng nhiều khoảng hiệu lực khác nhau. */
export function hasMixedEffectiveWindows(
  fares: readonly ParcelRouteFareEntry[],
): boolean {
  return new Set(fares.map(fareWindowKey)).size > 1;
}

/**
 * Khoảng hiệu lực dùng chung của tuyến, hoặc `null` khi mỗi mức một kiểu.
 *
 * Trả `null` là tín hiệu để form ĐỂ TRỐNG phần hiệu lực: theo handoff BE, khi
 * không đồng nhất thì tuyệt đối không tự lấy mốc của `SMALL` hay của phần tử
 * đầu tiên — người điều hành phải tự chọn một khoảng chung.
 */
export function commonEffectiveWindow(
  fares: readonly ParcelRouteFareEntry[],
): { effectiveFrom: string; effectiveUntil: string | null } | null {
  if (fares.length === 0 || hasMixedEffectiveWindows(fares)) {
    return null;
  }

  return {
    effectiveFrom: fares[0].effectiveFrom,
    effectiveUntil: fares[0].effectiveUntil,
  };
}

/** Giá theo từng cỡ kiện; cỡ chưa cấu hình để chuỗi rỗng. */
export function pricesFromFareEntries(
  fares: readonly ParcelRouteFareEntry[],
): Record<ParcelSizeCategory, string> {
  const prices = createEmptyFarePrices();
  fares.forEach((fare) => {
    if (isParcelSizeCategory(fare.sizeCategory)) {
      prices[fare.sizeCategory] = String(fare.priceVnd);
    }
  });

  return prices;
}

/** Số cỡ kiện đã cấu hình thật của tuyến (BE không sinh mức giả). */
export function configuredSizeCount(
  fares: readonly ParcelRouteFareEntry[],
): number {
  return new Set(
    fares
      .map((fare) => fare.sizeCategory)
      .filter((size): size is ParcelSizeCategory => isParcelSizeCategory(size)),
  ).size;
}

/** Selection để mở form sửa từ một dòng tuyến trong bảng. */
export function buildGroupFareSelection(
  group: ParcelRouteFareGroup,
): FareSelection & { hasMixedWindows: boolean } {
  const window = commonEffectiveWindow(group.fares);

  return {
    mode:
      configuredSizeCount(group.fares) < parcelSizeCategories.length
        ? "COMPLETE"
        : "UPDATE",
    prices: pricesFromFareEntries(group.fares),
    // Không đồng nhất → để trống, bắt người dùng chọn khoảng chung
    effectiveFrom: window?.effectiveFrom ?? "",
    effectiveUntil: window?.effectiveUntil ?? "",
    hasMixedWindows: hasMixedEffectiveWindows(group.fares),
  };
}

/**
 * Trải item gom nhóm về mảng phẳng cho các helper cũ (`getRouteFareSummary`,
 * `buildFareSelection`, `buildNextFareSelection`) dùng lại nguyên vẹn.
 *
 * `operatorId` để rỗng: API list mới không trả field này nữa và không helper
 * nào ở đây đọc tới nó.
 */
export function flattenFareGroup(
  group: ParcelRouteFareGroup | null | undefined,
): ParcelRouteFare[] {
  if (!group) return [];

  return group.fares.map((fare) => ({
    routeId: group.routeId,
    operatorId: "",
    sizeCategory: fare.sizeCategory,
    priceVnd: fare.priceVnd,
    effectiveFrom: fare.effectiveFrom,
    effectiveUntil: fare.effectiveUntil,
  }));
}
