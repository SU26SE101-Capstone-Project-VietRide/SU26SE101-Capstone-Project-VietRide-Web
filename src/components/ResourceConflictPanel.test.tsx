import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ResourceAvailabilityResult,
  ResourceConflict,
} from "../api/vietride";
import ResourceConflictPanel from "./ResourceConflictPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${Object.values(values).join(" ")}` : key,
  }),
}));

function conflict(overrides: Partial<ResourceConflict> = {}): ResourceConflict {
  return {
    resourceRole: "DRIVER",
    resourceId: "driver-1",
    reason: "TIME_OVERLAP",
    conflictingSourceType: "TRIP",
    conflictingSourceId: "trip-1",
    sampleRequestedStartAt: "2026-09-10T08:00:00+07:00",
    blockingUntil: "2026-09-10T12:00:00+07:00",
    earliestFeasibleStartAt: "2026-09-10T12:30:00+07:00",
    requiredTravelMinutes: null,
    turnaroundMinutes: 30,
    ...overrides,
  };
}

function result(conflicts: ResourceConflict[]): ResourceAvailabilityResult {
  return {
    available: false,
    turnaroundMinutes: 30,
    conflicts,
    hasMore: false,
  };
}

describe("ResourceConflictPanel", () => {
  // jsdom không cài scrollIntoView; stub để vừa test được vừa khớp guard `?.`
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  it("không chiếm chỗ khi chưa kiểm tra", () => {
    const { container } = render(<ResourceConflictPanel result={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  // Lịch lặp trả một conflict cho mỗi lần lặp — không gom thì modal ngập vài
  // chục dòng gần như giống hệt và form bị đẩy khỏi màn hình.
  it("gom conflict trùng tài nguyên và lý do, giữ mốc sớm nhất", () => {
    render(
      <ResourceConflictPanel
        result={result([
          conflict({ sampleRequestedStartAt: "2026-09-24T08:00:00+07:00" }),
          conflict({ sampleRequestedStartAt: "2026-09-10T08:00:00+07:00" }),
          conflict({ sampleRequestedStartAt: "2026-09-17T08:00:00+07:00" }),
        ])}
      />,
    );

    // Ba lần lặp của cùng một tài xế gộp thành một dòng.
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText(/resourceConflict\.summary 1/)).toBeInTheDocument();
    // Mốc hiển thị là lần SỚM NHẤT (10/09), không phải phần tử đầu mảng (24/09).
    expect(
      screen.getByText(/resourceConflict\.occurrencesFrom 3 10-09-2026/),
    ).toBeInTheDocument();
  });

  it("tách nhóm theo vai trò và theo lý do", () => {
    render(
      <ResourceConflictPanel
        result={result([
          conflict({ resourceRole: "DRIVER", reason: "TIME_OVERLAP" }),
          conflict({
            resourceRole: "ASSISTANT",
            resourceId: "assistant-1",
            reason: "TIME_OVERLAP",
          }),
          conflict({ resourceRole: "DRIVER", reason: "TURNAROUND_REQUIRED" }),
        ])}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText(/resourceConflict\.summary 3/)).toBeInTheDocument();
  });

  it("nêu rõ khi không có giờ bắt đầu khả thi", () => {
    render(
      <ResourceConflictPanel
        result={result([
          conflict({
            reason: "REPOSITION_REQUIRED",
            earliestFeasibleStartAt: null,
            requiredTravelMinutes: 120,
          }),
        ])}
      />,
    );

    expect(
      screen.getByText("resourceConflict.noFeasibleStart"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/resourceConflict\.requiredTravel 120/),
    ).toBeInTheDocument();
  });

  it("hiện cảnh báo còn xung đột chưa liệt kê", () => {
    render(
      <ResourceConflictPanel
        result={{ ...result([conflict()]), hasMore: true }}
      />,
    );

    expect(
      screen.getByText("resourceConflict.hasMoreShort"),
    ).toBeInTheDocument();
  });

  // Nút kiểm tra ở footer, panel ở đầu modal — không tự cuộn thì bấm xong
  // người dùng không thấy kết quả hiện ở đâu.
  it("kéo kết quả vào khung nhìn sau khi kiểm tra", () => {
    const { rerender } = render(<ResourceConflictPanel result={null} />);
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(<ResourceConflictPanel result={result([conflict()])} />);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    // KHÔNG có behavior:"smooth" — animation bị scroll anchoring huỷ khi panel
    // nở ra, đo trên browser thật thấy khung cuộn xuống đáy thay vì lên trên.
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });

  it("cuộn cả khi kết quả là không có xung đột", () => {
    const { rerender } = render(<ResourceConflictPanel result={null} />);
    rerender(
      <ResourceConflictPanel
        result={{ ...result([]), available: true }}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    // Screen reader phải đọc được kết quả mà không cần dời con trỏ.
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
