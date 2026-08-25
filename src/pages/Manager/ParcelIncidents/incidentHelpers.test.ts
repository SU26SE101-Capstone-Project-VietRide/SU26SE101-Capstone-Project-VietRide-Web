import { describe, expect, it } from "vitest";
import type { ParcelCustodyEvent } from "../../../api/vietride";
import { slaTone } from "../../../utils/parcelReliability";
import {
  hasIncidentAction,
  incidentStatusTone,
  mergeCustodyEvents,
  oldestSequence,
} from "./incidentHelpers";

function eventAt(sequence: number, eventId = `event-${sequence}`) {
  return {
    eventId,
    eventType: "HANDOFF",
    actorRole: "DRIVER",
    occurredAt: "2026-08-21T10:00:00+07:00",
    recordedAt: "2026-08-21T10:00:05+07:00",
    source: "DRIVER_APP",
    evidenceReferences: [],
    sequence,
  } satisfies ParcelCustodyEvent;
}

describe("hasIncidentAction", () => {
  it("chỉ mở nút theo đúng danh sách BE trả về", () => {
    expect(hasIncidentAction(["ASSIGN", "MARK_FOUND"], "ASSIGN")).toBe(true);
    expect(hasIncidentAction(["ASSIGN"], "DECLARE_LOST")).toBe(false);
  });

  it("chưa tải được chi tiết thì không mở nút nào", () => {
    expect(hasIncidentAction(undefined, "RESOLVE")).toBe(false);
  });
});

describe("oldestSequence", () => {
  it("lấy sequence NHỎ NHẤT chứ không phải phần tử cuối mảng", () => {
    // Thứ tự mảng do BE quyết định — không được coi là bảo đảm
    expect(
      oldestSequence({
        items: [eventAt(9), eventAt(3), eventAt(7)],
        nextCursor: 3,
      }),
    ).toBe(3);
  });

  it("lịch sử rỗng thì không có cursor để xin tiếp", () => {
    expect(oldestSequence({ items: [], nextCursor: null })).toBeNull();
    expect(oldestSequence(undefined)).toBeNull();
  });
});

describe("mergeCustodyEvents", () => {
  it("khử trùng theo eventId và sắp mới nhất lên đầu", () => {
    const merged = mergeCustodyEvents(
      [eventAt(9), eventAt(7)],
      [eventAt(7), eventAt(5)],
    );

    expect(merged.map((event) => event.sequence)).toEqual([9, 7, 5]);
  });
});

describe("tone", () => {
  it("chỉ nhuộm đỏ trạng thái thật sự xấu", () => {
    expect(slaTone("BREACHED")).toBe("danger");
    expect(slaTone("DUE_SOON")).toBe("warning");
    expect(incidentStatusTone("LOST_CONFIRMED")).toBe("danger");
    // Đang xử lý không phải là hỏng
    expect(incidentStatusTone("SEARCHING")).toBe("info");
    expect(incidentStatusTone("RESOLVED")).toBe("success");
  });
});
