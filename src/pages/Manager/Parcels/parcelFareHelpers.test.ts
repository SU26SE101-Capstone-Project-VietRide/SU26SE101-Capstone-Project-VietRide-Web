import { describe, expect, it } from "vitest";
import type {
  ParcelRouteFare,
  ParcelRouteFareEntry,
} from "../../../api/vietride";
import {
  buildFareSelection,
  buildGroupFareSelection,
  buildNextFareSelection,
  commonEffectiveWindow,
  configuredSizeCount,
  hasMixedEffectiveWindows,
  getRouteFareSummary,
  parcelSizeCategories,
  stripDiacritics,
} from "./parcelFareHelpers";

const now = new Date("2026-08-10T03:00:00Z");

function fare(
  sizeCategory: ParcelRouteFare["sizeCategory"],
  overrides: Partial<ParcelRouteFare> = {},
): ParcelRouteFare {
  return {
    routeId: "route-1",
    operatorId: "operator-1",
    sizeCategory,
    priceVnd: 50_000,
    effectiveFrom: "2026-08-01T00:00:00Z",
    effectiveUntil: "2026-08-31T23:59:59Z",
    ...overrides,
  };
}

describe("parcel fare route summaries", () => {
  it("marks a complete active window and prefills it for safe updates", () => {
    const fares = parcelSizeCategories.map((category, index) =>
      fare(category, { priceVnd: (index + 1) * 10_000 }),
    );
    const summary = getRouteFareSummary("route-1", fares, now);

    expect(summary.status).toBe("ACTIVE");
    expect(summary.hasScheduledWindow).toBe(false);
    expect(buildFareSelection(summary, now)).toEqual({
      mode: "UPDATE",
      prices: {
        SMALL: "10000",
        MEDIUM: "20000",
        LARGE: "30000",
        EXTRA_LARGE: "40000",
      },
      effectiveFrom: "2026-08-01T00:00:00Z",
      effectiveUntil: "2026-08-31T23:59:59Z",
    });
  });

  it("marks missing size prices as incomplete", () => {
    const summary = getRouteFareSummary(
      "route-1",
      [fare("SMALL"), fare("MEDIUM")],
      now,
    );

    expect(summary.status).toBe("INCOMPLETE");
    expect(buildFareSelection(summary, now).mode).toBe("COMPLETE");
  });

  it("renews an expired window while preserving prices as suggestions", () => {
    const summary = getRouteFareSummary(
      "route-1",
      parcelSizeCategories.map((category) =>
        fare(category, { effectiveUntil: "2026-08-05T00:00:00Z" }),
      ),
      now,
    );
    const selection = buildFareSelection(summary, now);

    expect(summary.status).toBe("EXPIRED");
    expect(selection.mode).toBe("RENEW");
    expect(selection.effectiveFrom).toBe(now.toISOString());
    expect(selection.prices.SMALL).toBe("50000");
  });

  it("only schedules a next window when the selected window has an end", () => {
    const closedSummary = getRouteFareSummary(
      "route-1",
      parcelSizeCategories.map((category) => fare(category)),
      now,
    );
    const openSummary = getRouteFareSummary(
      "route-1",
      parcelSizeCategories.map((category) =>
        fare(category, { effectiveUntil: null }),
      ),
      now,
    );

    expect(buildNextFareSelection(closedSummary)?.effectiveFrom).toBe(
      "2026-09-01T00:00:59.000Z",
    );
    expect(buildNextFareSelection(openSummary)).toBeNull();
  });

  it("does not create another next window when one is already scheduled", () => {
    const summary = getRouteFareSummary(
      "route-1",
      [
        ...parcelSizeCategories.map((category) => fare(category)),
        ...parcelSizeCategories.map((category) =>
          fare(category, {
            effectiveFrom: "2026-09-01T00:00:00Z",
            effectiveUntil: null,
          }),
        ),
      ],
      now,
    );

    expect(summary.hasScheduledWindow).toBe(true);
    expect(buildNextFareSelection(summary)).toBeNull();
  });

  // Ô tìm kiếm bảng giá trước đây so khớp có dấu nên gõ không dấu là ra rỗng —
  // trông y như bộ lọc hỏng.
  describe("stripDiacritics", () => {
    it("khớp được khi người dùng gõ không dấu", () => {
      expect(stripDiacritics("Đà Lạt")).toBe("da lat");
      expect(stripDiacritics("Hồ Chí Minh - Đà Lạt")).toContain("da lat");
      expect(stripDiacritics("  Bến Xe Miền Đông  ")).toBe("ben xe mien dong");
    });

    it("xử lý cả chữ Đ hoa lẫn đ thường", () => {
      expect(stripDiacritics("ĐÀ NẴNG")).toBe("da nang");
      expect(stripDiacritics("đà nẵng")).toBe("da nang");
    });
  });
});

// API list gom theo tuyến: cảnh báo khi các mức lệch khoảng hiệu lực, và tuyệt
// đối không tự lấy mốc của SMALL hay của phần tử đầu tiên làm mốc chung.
describe("nhóm cước theo tuyến", () => {
  const uniform: ParcelRouteFareEntry[] = parcelSizeCategories.map(
    (sizeCategory, index) => ({
      sizeCategory,
      priceVnd: (index + 1) * 10_000,
      effectiveFrom: "2026-08-01T00:00:00Z",
      effectiveUntil: null,
    }),
  );

  it("coi hai chuỗi lệch offset nhưng cùng thời điểm là đồng nhất", () => {
    const sameInstant: ParcelRouteFareEntry[] = [
      { ...uniform[0], effectiveFrom: "2026-08-27T16:30:00Z" },
      { ...uniform[1], effectiveFrom: "2026-08-27T23:30:00+07:00" },
    ];

    expect(hasMixedEffectiveWindows(sameInstant)).toBe(false);
    expect(commonEffectiveWindow(sameInstant)?.effectiveFrom).toBe(
      "2026-08-27T16:30:00Z",
    );
  });

  it("báo lệch và KHÔNG trả mốc chung khi hiệu lực khác nhau", () => {
    const mixed: ParcelRouteFareEntry[] = [
      uniform[0],
      { ...uniform[1], effectiveUntil: "2026-12-01T09:00:00Z" },
    ];

    expect(hasMixedEffectiveWindows(mixed)).toBe(true);
    expect(commonEffectiveWindow(mixed)).toBeNull();

    const selection = buildGroupFareSelection({ routeId: "route-1", fares: mixed });
    expect(selection.hasMixedWindows).toBe(true);
    // Form phải để trống phần hiệu lực, không mượn mốc của mức đầu tiên
    expect(selection.effectiveFrom).toBe("");
    expect(selection.effectiveUntil).toBe("");
  });

  it("gom đủ bốn mức và báo COMPLETE khi tuyến còn thiếu cỡ kiện", () => {
    const partial = uniform.slice(0, 2);

    const selection = buildGroupFareSelection({ routeId: "route-1", fares: partial });

    expect(selection.mode).toBe("COMPLETE");
    expect(selection.prices.SMALL).toBe("10000");
    expect(selection.prices.LARGE).toBe("");
    expect(configuredSizeCount(partial)).toBe(2);
  });

  it("giữ UPDATE khi tuyến đã đủ bốn mức đồng nhất", () => {
    const selection = buildGroupFareSelection({ routeId: "route-1", fares: uniform });

    expect(selection.mode).toBe("UPDATE");
    expect(selection.hasMixedWindows).toBe(false);
    expect(selection.effectiveFrom).toBe("2026-08-01T00:00:00Z");
  });
});
