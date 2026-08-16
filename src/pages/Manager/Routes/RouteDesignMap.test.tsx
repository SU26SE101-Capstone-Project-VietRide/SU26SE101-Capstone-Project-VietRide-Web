// Test RouteDesignMap: bản đồ phải nhận ĐỦ polyline các phương án, và các mảng
// overlay phải giữ identity ổn định giữa các render không liên quan — nếu không,
// GoogleMapCanvas sẽ gỡ + vẽ lại toàn bộ overlay MỖI render của trang (nguyên nhân
// đường mờ chớp/biến mất trên bản đồ thật).
import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GoogleMapPointMarker,
  GoogleMapPolyline,
} from "../../../components/GoogleMapCanvas";
import RouteDesignMap from "./RouteDesignMap";
import type { RoadRouteOption } from "./geometry";
import type { StopSuggestion } from "./types";

vi.mock("../../../lib/googlePlacesSearch", () => ({
  getPlaceDetails: vi.fn(),
  buildPlacePhotoUrl: vi.fn(() => "https://example.com/photo.jpg"),
}));

import {
  getPlaceDetails,
  buildPlacePhotoUrl,
} from "../../../lib/googlePlacesSearch";

const mockedGetPlaceDetails = vi.mocked(getPlaceDetails);
const mockedBuildPlacePhotoUrl = vi.mocked(buildPlacePhotoUrl);

// Mặc định mọi test: getPlaceDetails trả null (không có chi tiết) trừ khi test
// tự set lại — tránh phải await usePlaceDetails trong các test không liên quan.
beforeEach(() => {
  mockedGetPlaceDetails.mockReset().mockResolvedValue(null);
  mockedBuildPlacePhotoUrl.mockReset().mockReturnValue("https://example.com/photo.jpg");
});

const { canvasProps } = vi.hoisted(() => ({
  canvasProps: [] as Array<{
    anchorContent?: ReactNode;
    anchorPosition?: { lat: number; lng: number } | null;
    polylines?: GoogleMapPolyline[];
    markers?: unknown[];
    fitPoints?: unknown[];
    pointMarkers?: GoogleMapPointMarker[];
    onMapClick?: (position: { lat: number; lng: number }) => void;
  }>,
}));

vi.mock("../../../components/GoogleMapCanvas", () => ({
  default: (props: (typeof canvasProps)[number]) => {
    canvasProps.push(props);
    return (
      <div data-testid="canvas">
        {/* Card neo (popup gợi ý điểm dừng) trong thật render qua OverlayView —
            mock render thẳng anchorContent để các assertion popup cũ vẫn chạy */}
        {props.anchorContent ? (
          <div data-testid="map-anchor">{props.anchorContent}</div>
        ) : null}
      </div>
    );
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
    emptyText: "empty",
  };
}

describe("RouteDesignMap", () => {
  it("uses precise fixed-size pins for route endpoints instead of large circles", () => {
    canvasProps.length = 0;
    render(
      <RouteDesignMap
        {...buildProps()}
        points={[
          {
            id: "origin-station-1",
            name: "Điểm đi",
            latitude: 10.77,
            longitude: 106.69,
            color: "#0f766e",
          },
          {
            id: "stop-1-1",
            name: "Điểm dừng",
            latitude: 11.2,
            longitude: 107.5,
            color: "#2563eb",
          },
          {
            id: "destination-station-2",
            name: "Điểm đến",
            latitude: 11.94,
            longitude: 108.44,
            color: "#dc2626",
          },
        ]}
      />,
    );

    const { markers = [], pointMarkers = [] } = canvasProps.at(-1) ?? {};
    const origin = pointMarkers.find(
      (marker) => marker.id === "route-endpoint-origin-station-1",
    );
    const destination = pointMarkers.find(
      (marker) => marker.id === "route-endpoint-destination-station-2",
    );

    expect(markers).toHaveLength(0);
    expect(origin).toMatchObject({
      position: { lat: 10.77, lng: 106.69 },
      title: "Điểm đi",
      icon: { fillColor: "#0f766e", scale: 0.82 },
    });
    expect(destination).toMatchObject({
      position: { lat: 11.94, lng: 108.44 },
      title: "Điểm đến",
      icon: { fillColor: "#dc2626", scale: 0.82 },
    });
    expect(
      pointMarkers.some(
        (marker) => marker.id === "route-endpoint-stop-1-1",
      ),
    ).toBe(false);
  });

  it("passes every route option polyline to the map canvas", () => {
    canvasProps.length = 0;
    render(<RouteDesignMap {...buildProps()} />);

    const { polylines = [] } = canvasProps.at(-1) ?? {};
    // Đường mờ (chưa chọn) có thêm lớp "vùng bắt click" rộng vô hình
    // (id -hit) đè lên đường mảnh — dễ bấm chọn hơn, kiểu Google Maps thật.
    expect(polylines.map((polyline) => polyline.id).sort()).toEqual([
      "route-option-0",
      "route-option-1",
      "route-option-1-hit",
      "route-option-2",
      "route-option-2-hit",
    ]);
    // Phương án chọn đậm + nổi trên, phương án khác mờ + click được
    const selected = polylines.find((p) => p.id === "route-option-0");
    const dimmed = polylines.find((p) => p.id === "route-option-1");
    const dimmedHit = polylines.find((p) => p.id === "route-option-1-hit");
    const optionLabels = canvasProps
      .at(-1)
      ?.pointMarkers?.filter((marker) =>
        marker.id.startsWith("route-option-label-"),
      );
    expect(selected?.opacity).toBe(1);
    // Mọi tuyến chưa chọn dùng CHUNG một màu cùng tông tuyến chính nhưng nhạt
    // hơn (#0f766e pha trắng); lớp hit vẫn vô hình.
    expect(dimmed).toMatchObject({ color: "#6aaaa5", opacity: 0.9 });
    expect(dimmedHit).toMatchObject({
      color: "#6aaaa5",
      opacity: 0,
      weight: 18,
    });
    expect((selected?.zIndex ?? 0) > (dimmed?.zIndex ?? 0)).toBe(true);
    expect(typeof dimmed?.onClick).toBe("function");
    expect(typeof dimmedHit?.onClick).toBe("function");
    expect(new Set(polylines.map((polyline) => polyline.color))).toEqual(
      new Set(["#0f766e", "#6aaaa5"]),
    );
    // Tuyến ĐANG CHỌN cũng phải có bubble giờ (trước đây bị bỏ qua nên chỉ đọc
    // được giờ của những phương án không dùng), nhưng tô đặc màu tuyến đang
    // chọn + chữ trắng để không lẫn với bubble trắng của phương án khác.
    expect(optionLabels?.map((label) => label.id)).toEqual([
      "route-option-label-selected",
      "route-option-label-1",
      "route-option-label-2",
    ]);
    const selectedLabel = optionLabels?.find(
      (label) => label.id === "route-option-label-selected",
    );
    expect(selectedLabel).toMatchObject({
      icon: { fillColor: "#0f766e" },
      label: { color: "#ffffff", text: "routes.routeOptionDurationHours" },
    });
    expect(
      (selectedLabel?.zIndex ?? 0) >
        (optionLabels?.find((label) => label.id === "route-option-label-1")
          ?.zIndex ?? 0),
    ).toBe(true);
    optionLabels
      ?.filter((label) => label.id !== "route-option-label-selected")
      .forEach((label) => {
        const index = Number(label.id?.split("-").at(-1));
        expect(label.icon?.strokeColor).toBe(
          polylines.find((polyline) => polyline.id === `route-option-${index}`)
            ?.color,
        );
      });
  });

  // selectedOptionIndex = -1: đường ĐÃ LƯU đang chọn không trùng phương án nào
  // nên map không có RoadRouteOption để lấy số phút — số phút do caller truyền.
  it("labels the saved line with the duration passed in when no option is selected", () => {
    canvasProps.length = 0;
    render(
      <RouteDesignMap
        {...buildProps()}
        selectedOptionIndex={-1}
        selectedPathDurationMinutes={95}
      />,
    );

    const labels = (canvasProps.at(-1)?.pointMarkers ?? []).filter((marker) =>
      marker.id.startsWith("route-option-label-"),
    );
    expect(labels.map((label) => label.id)).toEqual([
      "route-option-label-selected",
      "route-option-label-0",
      "route-option-label-1",
      "route-option-label-2",
    ]);
  });

  it("bỏ bubble tuyến đang chọn khi chưa có số phút", () => {
    canvasProps.length = 0;
    render(
      <RouteDesignMap
        {...buildProps()}
        selectedOptionIndex={-1}
        selectedPathDurationMinutes={0}
      />,
    );

    const labels = (canvasProps.at(-1)?.pointMarkers ?? []).filter((marker) =>
      marker.id.startsWith("route-option-label-"),
    );
    expect(
      labels.some((label) => label.id === "route-option-label-selected"),
    ).toBe(false);
  });

  // Bubble thời lượng phải nằm trên ĐOẠN TÁCH của chính phương án đó — các
  // phương án Google trùng tuyến đang chọn gần hết chiều dài, đặt theo tỉ lệ
  // chiều dài là bubble rơi vào đoạn trùng, nhìn ra tưởng nhãn của tuyến chính
  it("anchors each duration bubble on the part where its own option diverges", () => {
    canvasProps.length = 0;
    render(<RouteDesignMap {...buildProps()} />);

    const labels = (canvasProps.at(-1)?.pointMarkers ?? []).filter((marker) =>
      marker.id.startsWith("route-option-label-"),
    );
    const positionOf = (id: string) =>
      labels.find((label) => label.id === id)?.position;

    // Đúng điểm giữa riêng của từng phương án, không phải điểm nào của tuyến
    // đang chọn (routeOptions[0])
    expect(positionOf("route-option-label-1")).toEqual({ lat: 10.95, lng: 107.9 });
    expect(positionOf("route-option-label-2")).toEqual({ lat: 11.5, lng: 107.2 });
    // Bubble của tuyến đang chọn thì ngược lại: nằm trên chính nó.
    expect(positionOf("route-option-label-selected")).toEqual({
      lat: 11.2,
      lng: 107.5,
    });
    labels
      .filter((label) => label.id !== "route-option-label-selected")
      .forEach((label) => {
        expect(routeOptions[0].points).not.toContainEqual({
          latitude: label.position.lat,
          longitude: label.position.lng,
        });
      });
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

  // Kéo mượt hơn: trong lúc kéo (native marker chấm tròn hoặc túm thân đường),
  // đường ĐANG CHỌN phải bám thẳng qua điểm dưới tay chuột NGAY LẬP TỨC thay
  // vì giữ nguyên đường bộ cũ chờ throttle 350ms trả kết quả mới.
  it("previews the selected line as a straight path through the point being natively dragged", () => {
    canvasProps.length = 0;
    render(
      <RouteDesignMap
        {...buildProps()}
        viaPoints={[{ latitude: 11.3, longitude: 107.3 }]}
        onAddViaPoint={vi.fn()}
        onBeginViaDrag={vi.fn()}
        onDragViaPoint={vi.fn()}
        onMoveViaPoint={vi.fn()}
        onRemoveViaPoint={vi.fn()}
      />,
    );

    const viaMarker = canvasProps
      .at(-1)
      ?.pointMarkers?.find((marker) => marker.id === "via-point-0");
    expect(typeof viaMarker?.onDrag).toBe("function");

    act(() => {
      viaMarker?.onDrag?.({ lat: 11.35, lng: 107.35 });
    });

    const selected = canvasProps
      .at(-1)
      ?.polylines?.find((polyline) => polyline.id === "route-option-0");
    // pathPoints[0]/[2] của buildProps() làm điểm đầu/cuối, điểm giữa là vị
    // trí đang kéo — không phải đường bộ gốc (11.2, 107.5) đã fetch trước đó.
    expect(selected?.path).toEqual([
      { lat: 10.77, lng: 106.69 },
      { lat: 11.35, lng: 107.35 },
      { lat: 11.94, lng: 108.44 },
    ]);
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

  // m-A regression: chọn gợi ý từ ô search (externalActiveSuggestion) phải
  // được đưa vào fitPoints để bản đồ bay tới thấy chấm, kể cả khi nó nằm
  // ngoài polyline/phương án hiện có (vd kết quả Google Places xa tuyến).
  it("includes externalActiveSuggestion coordinate in fitPoints", () => {
    canvasProps.length = 0;
    const farAwaySuggestion: StopSuggestion = {
      kind: "googlePlace",
      id: "far-place",
      name: "Xa tuyến",
      address: "Địa chỉ xa",
      latitude: 20.5,
      longitude: 105.9,
      distanceFromStartKm: 999,
      googlePlaceId: "far-place",
    };

    render(
      <RouteDesignMap
        {...buildProps()}
        externalActiveSuggestion={farAwaySuggestion}
      />,
    );

    const { fitPoints = [] } = canvasProps.at(-1) ?? {};
    expect(fitPoints).toContainEqual({ lat: 20.5, lng: 105.9 });
  });
});

const suggestions: StopSuggestion[] = [
  {
    kind: "operatorStop",
    id: "s1",
    name: "Bến xe Miền Đông",
    address: "292 Đinh Bộ Lĩnh, Bình Thạnh",
    latitude: 10.815,
    longitude: 106.71,
    distanceFromStartKm: 12.3,
  },
  {
    kind: "googlePlace",
    id: "p1",
    name: "Ngã tư Hàng Xanh",
    address: "Hàng Xanh, Bình Thạnh",
    latitude: 10.8,
    longitude: 106.71,
    distanceFromStartKm: 20.5,
    googlePlaceId: "p1",
  },
];

describe("RouteDesignMap — gợi ý điểm dừng", () => {
  it("hiện chấm gợi ý và mở popup khi click, đúng nút theo kind", () => {
    canvasProps.length = 0;
    render(<RouteDesignMap {...buildProps()} suggestions={suggestions} />);

    const { pointMarkers = [] } = canvasProps.at(-1) ?? {};
    const marker = pointMarkers.find((m) => m.id === "suggest-operatorStop-s1");
    expect(marker).toBeTruthy();
    expect(screen.queryByTestId("stop-suggestion-popup")).toBeNull();

    act(() => marker?.onClick?.());

    expect(screen.getByTestId("stop-suggestion-popup")).toBeInTheDocument();
    expect(screen.getByText("routes.suggestAdd")).toBeInTheDocument();
  });

  it("click nền bản đồ khi popup đang mở → đóng popup (giải phóng tầm nhìn)", () => {
    canvasProps.length = 0;
    render(<RouteDesignMap {...buildProps()} suggestions={suggestions} />);

    const { pointMarkers = [] } = canvasProps.at(-1) ?? {};
    const marker = pointMarkers.find((m) => m.id === "suggest-operatorStop-s1");
    act(() => marker?.onClick?.());
    expect(screen.getByTestId("stop-suggestion-popup")).toBeInTheDocument();

    // Popup mở → RouteDesignMap phải gắn onMapClick để bấm ra chỗ trống là đóng
    const mapClick = canvasProps.at(-1)?.onMapClick;
    expect(mapClick).toBeTruthy();
    act(() => mapClick?.({ lat: 10.5, lng: 106.5 }));

    expect(screen.queryByTestId("stop-suggestion-popup")).toBeNull();
  });

  it("neo popup đúng lat/lng của gợi ý đang mở, đóng popup thì anchor về null", () => {
    canvasProps.length = 0;
    render(<RouteDesignMap {...buildProps()} suggestions={suggestions} />);

    expect(canvasProps.at(-1)?.anchorPosition).toBeNull();

    const { pointMarkers = [] } = canvasProps.at(-1) ?? {};
    const marker = pointMarkers.find((m) => m.id === "suggest-operatorStop-s1");
    act(() => marker?.onClick?.());

    expect(canvasProps.at(-1)?.anchorPosition).toEqual({
      lat: suggestions[0].latitude,
      lng: suggestions[0].longitude,
    });
    expect(canvasProps.at(-1)?.anchorContent).toBeTruthy();

    fireEvent.click(screen.getByLabelText("routes.suggestClose"));

    expect(canvasProps.at(-1)?.anchorPosition).toBeNull();
  });

  it("gọi onAddSuggestion với options mặc định true khi bấm nút hành động", () => {
    canvasProps.length = 0;
    const onAddSuggestion = vi.fn();
    render(
      <RouteDesignMap
        {...buildProps()}
        suggestions={suggestions}
        onAddSuggestion={onAddSuggestion}
      />,
    );

    const { pointMarkers = [] } = canvasProps.at(-1) ?? {};
    const marker = pointMarkers.find((m) => m.id === "suggest-operatorStop-s1");
    act(() => marker?.onClick?.());

    fireEvent.click(screen.getByText("routes.suggestAdd"));

    expect(onAddSuggestion).toHaveBeenCalledWith(suggestions[0], {
      allowPickup: true,
      allowDropoff: true,
    });
    expect(screen.queryByTestId("stop-suggestion-popup")).toBeNull();
  });

  it("bỏ tick Đón khách → gọi onAddSuggestion với allowPickup false", () => {
    canvasProps.length = 0;
    const onAddSuggestion = vi.fn();
    render(
      <RouteDesignMap
        {...buildProps()}
        suggestions={suggestions}
        onAddSuggestion={onAddSuggestion}
      />,
    );

    const { pointMarkers = [] } = canvasProps.at(-1) ?? {};
    const marker = pointMarkers.find((m) => m.id === "suggest-operatorStop-s1");
    act(() => marker?.onClick?.());

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByText("routes.suggestAdd"));

    expect(onAddSuggestion).toHaveBeenCalledWith(suggestions[0], {
      allowPickup: false,
      allowDropoff: true,
    });
  });

  it("bấm nút đóng → popup biến mất", () => {
    canvasProps.length = 0;
    render(<RouteDesignMap {...buildProps()} suggestions={suggestions} />);

    const { pointMarkers = [] } = canvasProps.at(-1) ?? {};
    const marker = pointMarkers.find((m) => m.id === "suggest-operatorStop-s1");
    act(() => marker?.onClick?.());

    expect(screen.getByTestId("stop-suggestion-popup")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("routes.suggestClose"));

    expect(screen.queryByTestId("stop-suggestion-popup")).toBeNull();
  });

  it("marker của gợi ý googlePlace hiện nút suggestCreateAdd", () => {
    canvasProps.length = 0;
    render(<RouteDesignMap {...buildProps()} suggestions={suggestions} />);

    const { pointMarkers = [] } = canvasProps.at(-1) ?? {};
    const marker = pointMarkers.find((m) => m.id === "suggest-googlePlace-p1");
    expect(marker).toBeTruthy();

    act(() => marker?.onClick?.());

    expect(screen.getByText("routes.suggestCreateAdd")).toBeInTheDocument();
  });

  // C-1 regression: gợi ý chọn từ ô search (StopSearchBox) không nhất thiết nằm
  // trong `suggestions` (mảng chấm ≤3km dọc tuyến, chưa gắn) — vd search trả về
  // một địa điểm Google cách xa polyline. Guard tự đóng popup khi item "không
  // còn trong danh sách" KHÔNG được áp dụng cho gợi ý đến từ externalActiveSuggestion.
  it("externalActiveSuggestion không nằm trong suggestions vẫn mở popup và không tự đóng", () => {
    canvasProps.length = 0;
    const notInList: StopSuggestion = {
      kind: "googlePlace",
      id: "search-result-1",
      name: "Địa điểm từ tìm kiếm",
      address: "Đường ABC",
      latitude: 10.9,
      longitude: 106.9,
      distanceFromStartKm: 5,
      googlePlaceId: "search-result-1",
    };

    const view = render(
      <RouteDesignMap
        {...buildProps()}
        suggestions={suggestions}
        externalActiveSuggestion={null}
      />,
    );
    view.rerender(
      <RouteDesignMap
        {...buildProps()}
        suggestions={suggestions}
        externalActiveSuggestion={notInList}
      />,
    );

    expect(screen.getByTestId("stop-suggestion-popup")).toBeInTheDocument();
    expect(screen.getByText("routes.suggestCreateAdd")).toBeInTheDocument();
  });
});

describe("RouteDesignMap — card chi tiết địa điểm (Google Places Details)", () => {
  it("click chấm googlePlace → gọi getPlaceDetails và hiện rating + địa chỉ + nút mở Google Maps", async () => {
    canvasProps.length = 0;
    mockedGetPlaceDetails.mockResolvedValue({
      placeId: "p1",
      name: "Ngã tư Hàng Xanh",
      address: "Hàng Xanh, Bình Thạnh",
      rating: 4.5,
      userRatingCount: 200,
      phone: "+84 28 1234 5678",
      primaryTypeLabel: "Trạm dừng chân",
      openNow: true,
      weekdayHours: [],
      photoName: "places/p1/photos/photo-1",
      googleMapsUri: "https://maps.google.com/?cid=p1",
    });

    render(<RouteDesignMap {...buildProps()} suggestions={suggestions} />);

    const { pointMarkers = [] } = canvasProps.at(-1) ?? {};
    const marker = pointMarkers.find((m) => m.id === "suggest-googlePlace-p1");
    act(() => marker?.onClick?.());

    expect(mockedGetPlaceDetails).toHaveBeenCalledWith("p1");

    await waitFor(() => {
      expect(screen.getByText("4.5")).toBeInTheDocument();
    });
    expect(screen.getByText("(200)")).toBeInTheDocument();
    expect(screen.getByText("Ngã tư Hàng Xanh", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("routes.detailOpenNow")).toBeInTheDocument();
    const link = screen.getByText("routes.detailViewOnGoogle");
    expect(link).toHaveAttribute("href", "https://maps.google.com/?cid=p1");
  });

  it("click chấm operatorStop không có googlePlaceId → không gọi getPlaceDetails, card như cũ", () => {
    canvasProps.length = 0;
    render(<RouteDesignMap {...buildProps()} suggestions={suggestions} />);

    const { pointMarkers = [] } = canvasProps.at(-1) ?? {};
    const marker = pointMarkers.find((m) => m.id === "suggest-operatorStop-s1");
    act(() => marker?.onClick?.());

    expect(mockedGetPlaceDetails).not.toHaveBeenCalled();
    expect(screen.getByTestId("stop-suggestion-popup")).toBeInTheDocument();
    expect(screen.queryByText("routes.detailOpenNow")).toBeNull();
  });
});

const stopMarkers = [
  {
    stopId: "stop-1",
    orderIndex: 1,
    name: "Trạm Dừng Chân Phúc Lộc Thọ",
    latitude: 11.1,
    longitude: 107.1,
    address: "QL20, Định Quán",
    googlePlaceId: null,
    distanceFromOriginKm: 45.2,
    estimatedDurationFromOriginMinutes: 60,
  },
];

describe("RouteDesignMap — card chi tiết marker điểm dừng ĐÃ GẮN", () => {
  it("click marker số → hiện card cùng loại kiểu Google Maps với title #N · tên + nút gỡ (không có googlePlaceId → card gọn)", () => {
    canvasProps.length = 0;
    const onRequestRemoveStop = vi.fn();
    render(
      <RouteDesignMap
        {...buildProps()}
        stopMarkers={stopMarkers}
        selectedStopId=""
        onSelectStop={vi.fn()}
        onRequestRemoveStop={onRequestRemoveStop}
      />,
    );

    const { pointMarkers = [] } = canvasProps.at(-1) ?? {};
    const marker = pointMarkers.find((m) => m.id === "route-stop-stop-1");
    expect(marker).toBeTruthy();
    expect(screen.queryByTestId("stop-detail-popup")).toBeNull();

    act(() => marker?.onClick?.());

    expect(mockedGetPlaceDetails).not.toHaveBeenCalled();
    expect(screen.getByTestId("stop-detail-popup")).toBeInTheDocument();
    expect(
      screen.getByText("#1 · Trạm Dừng Chân Phúc Lộc Thọ"),
    ).toBeInTheDocument();
    expect(screen.getByText("routes.removeRouteStop")).toBeInTheDocument();
  });

  it("click marker số vẫn gọi onSelectStop như cũ (đồng bộ highlight panel)", () => {
    canvasProps.length = 0;
    const onSelectStop = vi.fn();
    render(
      <RouteDesignMap
        {...buildProps()}
        stopMarkers={stopMarkers}
        onSelectStop={onSelectStop}
      />,
    );

    const { pointMarkers = [] } = canvasProps.at(-1) ?? {};
    const marker = pointMarkers.find((m) => m.id === "route-stop-stop-1");
    act(() => marker?.onClick?.());

    expect(onSelectStop).toHaveBeenCalledWith("stop-1");
  });

  it("bấm nút Gỡ khỏi tuyến → gọi onRequestRemoveStop với stopId", () => {
    canvasProps.length = 0;
    const onRequestRemoveStop = vi.fn();
    render(
      <RouteDesignMap
        {...buildProps()}
        stopMarkers={stopMarkers}
        onSelectStop={vi.fn()}
        onRequestRemoveStop={onRequestRemoveStop}
      />,
    );

    const { pointMarkers = [] } = canvasProps.at(-1) ?? {};
    const marker = pointMarkers.find((m) => m.id === "route-stop-stop-1");
    act(() => marker?.onClick?.());

    fireEvent.click(screen.getByText("routes.removeRouteStop"));

    expect(onRequestRemoveStop).toHaveBeenCalledWith("stop-1");
  });

  it("không truyền onRequestRemoveStop (viewer) → card hiện nhưng không có nút gỡ", () => {
    canvasProps.length = 0;
    render(
      <RouteDesignMap
        {...buildProps()}
        stopMarkers={stopMarkers}
        onSelectStop={vi.fn()}
      />,
    );

    const { pointMarkers = [] } = canvasProps.at(-1) ?? {};
    const marker = pointMarkers.find((m) => m.id === "route-stop-stop-1");
    act(() => marker?.onClick?.());

    expect(screen.getByTestId("stop-detail-popup")).toBeInTheDocument();
    expect(screen.queryByText("routes.removeRouteStop")).toBeNull();
  });

  it("mở card gợi ý khi card stop đã gắn đang mở → chỉ còn card gợi ý (một card một thời điểm)", () => {
    canvasProps.length = 0;
    render(
      <RouteDesignMap
        {...buildProps()}
        stopMarkers={stopMarkers}
        onSelectStop={vi.fn()}
        suggestions={suggestions}
      />,
    );

    const { pointMarkers = [] } = canvasProps.at(-1) ?? {};
    const stopMarker = pointMarkers.find((m) => m.id === "route-stop-stop-1");
    act(() => stopMarker?.onClick?.());
    expect(screen.getByTestId("stop-detail-popup")).toBeInTheDocument();

    const { pointMarkers: pointMarkersAfter = [] } = canvasProps.at(-1) ?? {};
    const suggestionMarker = pointMarkersAfter.find(
      (m) => m.id === "suggest-operatorStop-s1",
    );
    act(() => suggestionMarker?.onClick?.());

    expect(screen.queryByTestId("stop-detail-popup")).toBeNull();
    expect(screen.getByTestId("stop-suggestion-popup")).toBeInTheDocument();
  });

  it("mở card stop đã gắn khi card gợi ý đang mở → chỉ còn card stop (ngược lại)", () => {
    canvasProps.length = 0;
    render(
      <RouteDesignMap
        {...buildProps()}
        stopMarkers={stopMarkers}
        onSelectStop={vi.fn()}
        suggestions={suggestions}
      />,
    );

    const { pointMarkers = [] } = canvasProps.at(-1) ?? {};
    const suggestionMarker = pointMarkers.find(
      (m) => m.id === "suggest-operatorStop-s1",
    );
    act(() => suggestionMarker?.onClick?.());
    expect(screen.getByTestId("stop-suggestion-popup")).toBeInTheDocument();

    const { pointMarkers: pointMarkersAfter = [] } = canvasProps.at(-1) ?? {};
    const stopMarker = pointMarkersAfter.find((m) => m.id === "route-stop-stop-1");
    act(() => stopMarker?.onClick?.());

    expect(screen.queryByTestId("stop-suggestion-popup")).toBeNull();
    expect(screen.getByTestId("stop-detail-popup")).toBeInTheDocument();
  });
});
