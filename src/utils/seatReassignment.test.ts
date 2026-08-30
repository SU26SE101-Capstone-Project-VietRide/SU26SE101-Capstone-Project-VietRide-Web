import { describe, expect, it } from "vitest";
import type { SubstituteVehiclePreviewResult } from "../api/vietride";
import {
  buildSeatAssignments,
  duplicateSeatSelections,
  isSeatSelectionComplete,
  keptSeatCount,
  missingSeatSelections,
  passengersNeedingSeat,
  pruneSeatSelections,
  seatOptionsFor,
  takenSeatsExcept,
} from "./seatReassignment";

const KEPT_PASSENGER = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const MOVED_PASSENGER = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const SECOND_MOVED_PASSENGER = "cccccccc-cccc-4ccc-8ccc-ccccccccccc3";
const BOOKING_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Xe mới giữ được A1, mất A2 — đúng ví dụ thứ hai của handoff. */
function preview(
  overrides: Partial<SubstituteVehiclePreviewResult> = {},
): SubstituteVehiclePreviewResult {
  return {
    tripId: "11111111-1111-4111-8111-111111111111",
    replacementVehicleId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    previewToken: "a".repeat(64),
    passengers: [
      {
        bookingId: BOOKING_ID,
        passengerId: KEPT_PASSENGER,
        originalSeatNumber: "A1",
        proposedSeatNumber: "A1",
        requiresAdminSelection: false,
        alternativeSeatNumbers: [],
      },
      {
        bookingId: BOOKING_ID,
        passengerId: MOVED_PASSENGER,
        originalSeatNumber: "A2",
        proposedSeatNumber: null,
        requiresAdminSelection: true,
        alternativeSeatNumbers: ["A5", "A10"],
      },
    ],
    availableSeatNumbers: ["A1", "A5", "A10"],
    ...overrides,
  };
}

/** Hai khách cùng mất ghế và cùng nhìn thấy một danh sách ghế thay thế. */
function previewWithTwoMoved(): SubstituteVehiclePreviewResult {
  return preview({
    passengers: [
      ...preview().passengers,
      {
        bookingId: BOOKING_ID,
        passengerId: SECOND_MOVED_PASSENGER,
        originalSeatNumber: "A3",
        proposedSeatNumber: null,
        requiresAdminSelection: true,
        alternativeSeatNumbers: ["A5", "A10"],
      },
    ],
  });
}

describe("passengersNeedingSeat", () => {
  it("chỉ lấy khách BE không giữ được ghế cũ", () => {
    expect(
      passengersNeedingSeat(preview()).map((item) => item.passengerId),
    ).toEqual([MOVED_PASSENGER]);
  });

  it("preview rỗng/null thì không có ai phải chọn", () => {
    expect(passengersNeedingSeat(null)).toEqual([]);
  });
});

describe("seatOptionsFor", () => {
  it("loại ghế BE đã giữ cho khách khác", () => {
    // A1 đã thuộc về khách giữ nguyên ghế nên không bao giờ được chào lại.
    const options = seatOptionsFor(preview(), preview().passengers[1], {});
    expect(options).toEqual(["A5", "A10"]);
    expect(options).not.toContain("A1");
  });

  it("loại ghế khách khác vừa chọn", () => {
    const data = previewWithTwoMoved();
    const options = seatOptionsFor(data, data.passengers[2], {
      [MOVED_PASSENGER]: "A5",
    });

    expect(options).toEqual(["A10"]);
  });

  it("KHÔNG loại ghế của chính khách đó — nếu không lựa chọn tự biến mất", () => {
    const data = previewWithTwoMoved();
    const options = seatOptionsFor(data, data.passengers[1], {
      [MOVED_PASSENGER]: "A5",
      [SECOND_MOVED_PASSENGER]: "A10",
    });

    expect(options).toEqual(["A5"]);
  });
});

describe("takenSeatsExcept", () => {
  it("gộp cả ghế BE giữ sẵn lẫn ghế người khác vừa chọn", () => {
    const taken = takenSeatsExcept(previewWithTwoMoved(), {
      [SECOND_MOVED_PASSENGER]: "A10",
    }, MOVED_PASSENGER);

    expect([...taken].sort()).toEqual(["A1", "A10"]);
  });
});

describe("missingSeatSelections / isSeatSelectionComplete", () => {
  it("chưa chọn ghế thì chưa gửi được", () => {
    expect(missingSeatSelections(preview(), {})).toHaveLength(1);
    expect(isSeatSelectionComplete(preview(), {})).toBe(false);
  });

  it("chọn đủ thì hoàn tất", () => {
    const selections = { [MOVED_PASSENGER]: "A5" };
    expect(missingSeatSelections(preview(), selections)).toHaveLength(0);
    expect(isSeatSelectionComplete(preview(), selections)).toBe(true);
  });

  it("giữ được toàn bộ ghế thì không cần chọn gì", () => {
    const allKept = preview({
      passengers: [preview().passengers[0]],
    });

    expect(isSeatSelectionComplete(allKept, {})).toBe(true);
  });

  it("chuỗi rỗng/khoảng trắng không tính là đã chọn", () => {
    expect(isSeatSelectionComplete(preview(), { [MOVED_PASSENGER]: "  " })).toBe(
      false,
    );
  });
});

describe("duplicateSeatSelections", () => {
  it("bắt hai khách cùng chọn một ghế", () => {
    expect(
      duplicateSeatSelections(previewWithTwoMoved(), {
        [MOVED_PASSENGER]: "A5",
        [SECOND_MOVED_PASSENGER]: "A5",
      }),
    ).toEqual(["A5"]);
  });

  it("không báo trùng khi mỗi người một ghế", () => {
    expect(
      duplicateSeatSelections(previewWithTwoMoved(), {
        [MOVED_PASSENGER]: "A5",
        [SECOND_MOVED_PASSENGER]: "A10",
      }),
    ).toEqual([]);
  });
});

describe("buildSeatAssignments", () => {
  it("chỉ gửi ghế cho khách mất ghế cũ", () => {
    expect(
      buildSeatAssignments(preview(), {
        [MOVED_PASSENGER]: "A5",
        // Khách giữ nguyên ghế đã được BE tự gán — gửi thêm là sai hợp đồng
        [KEPT_PASSENGER]: "A1",
      }),
    ).toEqual([{ passengerId: MOVED_PASSENGER, newSeatNumber: "A5" }]);
  });

  it("giữ được toàn bộ ghế thì trả mảng rỗng", () => {
    const allKept = preview({ passengers: [preview().passengers[0]] });
    expect(buildSeatAssignments(allKept, {})).toEqual([]);
  });
});

describe("pruneSeatSelections", () => {
  it("bỏ khách không còn trong preview mới", () => {
    expect(
      pruneSeatSelections(preview(), {
        [MOVED_PASSENGER]: "A5",
        "dddddddd-dddd-4ddd-8ddd-ddddddddddd9": "A7",
      }),
    ).toEqual({ [MOVED_PASSENGER]: "A5" });
  });

  it("bỏ ghế mà xe mới không có", () => {
    expect(pruneSeatSelections(preview(), { [MOVED_PASSENGER]: "B9" })).toEqual(
      {},
    );
  });

  it("bỏ bản trùng để map không tự mâu thuẫn", () => {
    expect(
      pruneSeatSelections(previewWithTwoMoved(), {
        [MOVED_PASSENGER]: "A5",
        [SECOND_MOVED_PASSENGER]: "A5",
      }),
    ).toEqual({ [MOVED_PASSENGER]: "A5" });
  });
});

describe("keptSeatCount", () => {
  it("đếm khách giữ nguyên ghế cũ", () => {
    expect(keptSeatCount(preview())).toBe(1);
    expect(keptSeatCount(null)).toBe(0);
  });
});
