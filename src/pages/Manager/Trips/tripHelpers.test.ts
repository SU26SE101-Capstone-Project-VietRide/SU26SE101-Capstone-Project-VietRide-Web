import { describe, expect, it } from "vitest";
import type { OperatorDriverSchedule } from "../../../api/vietride";
import {
  isOneTimeSchedule,
  isSameDayOfWeek,
  isoWeekdayOf,
  normalizeDayOfWeek,
  resolveDayOfWeek,
  toTripScheduleFromApi,
} from "./tripHelpers";
import { emptyForm } from "./tripHelpers";

function schedule(
  overrides: Partial<OperatorDriverSchedule> = {},
): OperatorDriverSchedule {
  return {
    id: "schedule-12345678",
    operatorId: "operator-1",
    routeId: "route-1",
    vehicleId: "vehicle-1",
    driverUserId: "driver-1",
    assistantUserId: null,
    baseFare: null,
    departureTime: "08:00:00",
    effectiveFrom: "2026-09-01",
    validFrom: "2026-09-01",
    isActive: true,
    ...overrides,
  };
}

describe("normalizeDayOfWeek / isSameDayOfWeek", () => {
  it("sorts and de-duplicates so order from the API never causes a false diff", () => {
    expect(normalizeDayOfWeek([5, 1, 3, 1])).toEqual([1, 3, 5]);
    expect(isSameDayOfWeek([5, 3, 1], [1, 3, 5])).toBe(true);
    expect(isSameDayOfWeek([1, 3], [1, 3, 5])).toBe(false);
    expect(isSameDayOfWeek(undefined, [])).toBe(true);
  });
});

describe("isOneTimeSchedule", () => {
  it("only counts a schedule bounded to a single date as one-time", () => {
    expect(isOneTimeSchedule([3], "2026-09-02", "2026-09-02")).toBe(true);
    // Cùng một thứ nhưng không giới hạn ngày kết thúc là lịch lặp hằng tuần
    expect(isOneTimeSchedule([3], "2026-09-02", null)).toBe(false);
    expect(isOneTimeSchedule([3], "2026-09-02", "2026-09-30")).toBe(false);
    // Nhiều thứ thì không thể là lịch một lần dù bị chặn cùng ngày
    expect(isOneTimeSchedule([1, 3], "2026-09-02", "2026-09-02")).toBe(false);
  });
});

describe("isoWeekdayOf / resolveDayOfWeek", () => {
  it("converts Sunday to ISO 7 instead of 0", () => {
    // 2026-08-16 là Chủ nhật
    expect(isoWeekdayOf("2026-08-16T08:00")).toBe(7);
    // 2026-08-17 là Thứ 2
    expect(isoWeekdayOf("2026-08-17T08:00")).toBe(1);
    expect(isoWeekdayOf("không-phải-ngày")).toBeUndefined();
  });

  it("uses the departure weekday for one-time schedules and the chips otherwise", () => {
    expect(
      resolveDayOfWeek({
        ...emptyForm,
        isOneTime: true,
        departureAt: "2026-08-16T08:00",
        dayOfWeek: [1, 2, 3],
      }),
    ).toEqual([7]);

    expect(
      resolveDayOfWeek({
        ...emptyForm,
        isOneTime: false,
        departureAt: "2026-08-16T08:00",
        dayOfWeek: [5, 1, 3],
      }),
    ).toEqual([1, 3, 5]);
  });
});

describe("toTripScheduleFromApi", () => {
  it("keeps the exact dayOfWeek array from the API, including combos no preset can express", () => {
    // Bug cũ: hardcode recurrence "once" và vứt bỏ mảng ngày, nên lịch chạy
    // hằng ngày hay [1,3,5] đều hiện "Một lần".
    expect(
      toTripScheduleFromApi(schedule({ dayOfWeek: [1, 2, 3, 4, 5, 6, 7] }))
        .dayOfWeek,
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(
      toTripScheduleFromApi(schedule({ dayOfWeek: [5, 1, 3] })).dayOfWeek,
    ).toEqual([1, 3, 5]);
  });

  it("flags one-time schedules without collapsing repeating ones", () => {
    expect(
      toTripScheduleFromApi(
        schedule({ dayOfWeek: [3], validUntil: "2026-09-01" }),
      ).isOneTime,
    ).toBe(true);
    expect(
      toTripScheduleFromApi(schedule({ dayOfWeek: [1, 2, 3, 4, 5, 6, 7] }))
        .isOneTime,
    ).toBe(false);
  });

  it("reads the legacy daysOfWeek field when the API omits dayOfWeek", () => {
    expect(
      toTripScheduleFromApi(schedule({ daysOfWeek: [6, 7] })).dayOfWeek,
    ).toEqual([6, 7]);
  });

  it("maps validUntil so the form can show and diff the schedule end date", () => {
    expect(
      toTripScheduleFromApi(schedule({ validUntil: "2026-09-30" })).validUntil,
    ).toBe("2026-09-30");
    // null = không giới hạn -> "" để ô ngày trong form hiển thị rỗng
    expect(
      toTripScheduleFromApi(schedule({ validUntil: null })).validUntil,
    ).toBe("");
    expect(
      toTripScheduleFromApi(schedule({ effectiveUntil: "2026-10-15" }))
        .validUntil,
    ).toBe("2026-10-15");
  });
});
