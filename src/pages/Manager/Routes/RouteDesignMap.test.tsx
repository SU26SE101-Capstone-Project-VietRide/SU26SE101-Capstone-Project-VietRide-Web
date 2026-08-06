// Test RouteDesignMap: bản đồ phải nhận ĐỦ polyline các phương án, và các mảng
// overlay phải giữ identity ổn định giữa các render không liên quan — nếu không,
// GoogleMapCanvas sẽ gỡ + vẽ lại toàn bộ overlay MỖI render của trang (nguyên nhân
// đường mờ chớp/biến mất trên bản đồ thật).
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GoogleMapPolyline } from "../../../components/GoogleMapCanvas";
import RouteDesignMap from "./RouteDesignMap";
import type { RoadRouteOption } from "./geometry";

const { canvasProps } = vi.hoisted(() => ({
  canvasProps: [] as Array<{
    polylines?: GoogleMapPolyline[];
    markers?: unknown[];
    fitPoints?: unknown[];
    pointMarkers?: Array<{ id: string }>;
  }>,
}));

vi.mock("../../../components/GoogleMapCanvas", () => ({
  default: (props: (typeof canvasProps)[number]) => {
    canvasProps.push(props);
    return <div data-testid="canvas" />;
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const routeOptions: RoadRouteOption[] = [
  {
    points: [
      { latitude: 10.77, longitude: 106.69 },
      { latitude: 11.2, longitude: 107.5 },
      { latitude: 11.94, longitude: 108.44 },
    ],
    totalDistanceKm: 308,
    estimatedDurationMinutes: 310,
  },
  {
    points: [
      { latitude: 10.77, longitude: 106.69 },
      { latitude: 10.95, longitude: 107.9 },
      { latitude: 11.94, longitude: 108.44 },
    ],
    totalDistanceKm: 410.2,
    estimatedDurationMinutes: 372,
  },
  {
    points: [
      { latitude: 10.77, longitude: 106.69 },
      { latitude: 11.5, longitude: 107.2 },
      { latitude: 11.94, longitude: 108.44 },
    ],
    totalDistanceKm: 355.4,
    estimatedDurationMinutes: 345,
  },
];

function buildProps() {
  return {
    points: [],
    pathPoints: routeOptions[0].points,
    routeOptions,
    selectedOptionIndex: 0,
    onSelectOption: vi.fn(),
    isEditing: false,
    onAppendPoint: vi.fn(),
    emptyText: "empty",
  };
}

describe("RouteDesignMap", () => {
  it("passes every route option polyline to the map canvas", () => {
    canvasProps.length = 0;
    render(<RouteDesignMap {...buildProps()} />);

    const { polylines = [] } = canvasProps.at(-1) ?? {};
    expect(polylines.map((polyline) => polyline.id).sort()).toEqual([
      "route-option-0",
      "route-option-1",
      "route-option-2",
    ]);
    // Phương án chọn đậm + nổi trên, phương án khác mờ + click được
    const selected = polylines.find((p) => p.id === "route-option-0");
    const dimmed = polylines.find((p) => p.id === "route-option-1");
    expect(selected?.opacity).toBe(1);
    expect((dimmed?.opacity ?? 1) < 1).toBe(true);
    expect((selected?.zIndex ?? 0) > (dimmed?.zIndex ?? 0)).toBe(true);
    expect(typeof dimmed?.onClick).toBe("function");
  });

  // Túm thẳng thân đường (một nhịp kiểu Google): chỉ đường ĐANG CHỌN đã áp mới
  // có onMouseDown; đường mờ chỉ click-để-chọn như cũ
  it("wires the one-motion grab (mousedown) on the selected applied line only", () => {
    canvasProps.length = 0;
    render(
      <RouteDesignMap
        {...buildProps()}
        viaPoints={[]}
        onAddViaPoint={vi.fn()}
        onBeginViaDrag={vi.fn()}
        onDragViaPoint={vi.fn()}
        onMoveViaPoint={vi.fn()}
        onRemoveViaPoint={vi.fn()}
      />,
    );

    const { polylines = [] } = canvasProps.at(-1) ?? {};
    const selected = polylines.find((p) => p.id === "route-option-0");
    const dimmed = polylines.find((p) => p.id === "route-option-1");
    expect(typeof selected?.onMouseDown).toBe("function");
    expect(typeof selected?.onClick).toBe("function");
    expect(dimmed?.onMouseDown).toBeUndefined();
  });

  it("keeps overlay array identities stable across unrelated re-renders", () => {
    canvasProps.length = 0;
    const props = buildProps();
    const view = render(<RouteDesignMap {...props} />);

    // Re-render với cùng dữ liệu (trang cha re-render vì state khác) — mảng
    // polyline/marker/fitPoints phải GIỮ identity để canvas không gỡ + vẽ lại overlay
    view.rerender(<RouteDesignMap {...props} />);

    expect(canvasProps.length).toBeGreaterThanOrEqual(2);
    const first = canvasProps.at(-2);
    const second = canvasProps.at(-1);
    expect(second?.polylines).toBe(first?.polylines);
    expect(second?.markers).toBe(first?.markers);
    expect(second?.fitPoints).toBe(first?.fitPoints);
  });
});
