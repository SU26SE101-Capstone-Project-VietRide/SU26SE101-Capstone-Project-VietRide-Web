import { StrictMode } from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import type { GoogleMapsLibrary } from "../lib/googleMaps";
import GoogleMapCanvas from "./GoogleMapCanvas";

const { loadGoogleMapsLibraryMock } = vi.hoisted(() => ({
  loadGoogleMapsLibraryMock: vi.fn(),
}));

vi.mock("../lib/googleMaps", () => ({
  loadGoogleMapsLibrary: loadGoogleMapsLibraryMock,
}));

describe("GoogleMapCanvas", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not crash while cleaning up unavailable Google Maps listeners", async () => {
    const mapCreated = vi.fn();
    const circleCreated = vi.fn();

    class Map {
      constructor() {
        mapCreated();
      }

      addListener() {
        return { remove: vi.fn() };
      }

      fitBounds() {}

      panTo() {}

      setCenter() {}

      setZoom() {}
    }

    class Circle {
      constructor() {
        circleCreated();
      }

      addListener() {
        return undefined;
      }

      setMap() {}
    }

    class InfoWindow {
      close() {}

      open() {}

      setContent() {}

      setPosition() {}
    }

    class LatLngBounds {
      extend() {}

      isEmpty() {
        return true;
      }
    }

    class Polyline {
      setMap() {}
    }

    loadGoogleMapsLibraryMock.mockResolvedValue({
      Circle,
      InfoWindow,
      LatLngBounds,
      Map,
      Polyline,
    } as unknown as GoogleMapsLibrary);

    const view = render(
      <GoogleMapCanvas
        ariaLabel="Route map"
        center={{ lat: 10.8, lng: 106.7 }}
        markers={[
          {
            color: "#14b8a6",
            id: "station",
            position: { lat: 10.8, lng: 106.7 },
            title: "Station",
          },
        ]}
        zoom={12}
      />,
    );

    await waitFor(() => {
      expect(mapCreated).toHaveBeenCalledOnce();
      expect(circleCreated).toHaveBeenCalledOnce();
    });

    expect(() => view.unmount()).not.toThrow();
  });
  it("creates one stable Google Maps element in React StrictMode", async () => {
    const receivedElements: HTMLElement[] = [];
    const receivedOptions: unknown[] = [];

    class Map {
      constructor(element: HTMLElement, options: unknown) {
        receivedElements.push(element);
        receivedOptions.push(options);
      }

      addListener() {
        return { remove: vi.fn() };
      }

      setCenter() {}

      setZoom() {}
    }

    class Circle {
      addListener() {
        return { remove: vi.fn() };
      }

      setMap() {}
    }

    class InfoWindow {
      close() {}

      open() {}

      setContent() {}

      setPosition() {}
    }

    class LatLngBounds {
      extend() {}

      isEmpty() {
        return true;
      }
    }

    class Polyline {
      setMap() {}
    }

    loadGoogleMapsLibraryMock.mockResolvedValue({
      Circle,
      InfoWindow,
      LatLngBounds,
      Map,
      Polyline,
    } as unknown as GoogleMapsLibrary);

    const view = render(
      <StrictMode>
        <GoogleMapCanvas
          ariaLabel="Route map"
          center={{ lat: 10.8, lng: 106.7 }}
          mapStyleUrl="https://tiles.example.test/light.json"
          zoom={12}
        />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(receivedElements).toHaveLength(1);
    });

    expect(receivedElements[0]).toBeInstanceOf(HTMLElement);
    expect(receivedElements[0].isConnected).toBe(true);
    expect(receivedOptions[0]).toMatchObject({
      cameraControl: false,
      mapStyleUrl: "https://tiles.example.test/light.json",
      renderingType: "RASTER",
      rotateControl: false,
      scaleControl: false,
      zoomControl: true,
    });
    expect(
      view.container.querySelector('[aria-label="Route map"]'),
    ).toContainElement(receivedElements[0]);
    expect(receivedElements[0]).toBe(
      view.container.querySelector(
        '[aria-label="Route map"] > div:first-child',
      ),
    );
  });
  // Marker Symbol reconcile theo id: mảng pointMarkers đổi identity (preview
  // reroute trong lúc kéo làm nhãn bubble đổi liên tục) thì marker giữ nguyên
  // id + hình dạng KHÔNG được gỡ + vẽ lại — recreate giữa gesture là đứt kéo;
  // chỉ đổi vị trí thì dời tại chỗ bằng setPosition.
  it("keeps unchanged point markers alive when the marker array identity changes", async () => {
    type MarkerOptions = {
      draggable?: boolean;
      label?: { text: string };
      position: { lat: number; lng: number };
    };

    const markerInstances: Marker[] = [];

    class Marker {
      options: MarkerOptions;
      setMap = vi.fn();
      setPosition = vi.fn();

      constructor(options: MarkerOptions) {
        this.options = options;
        markerInstances.push(this);
      }

      addListener() {
        return { remove: vi.fn() };
      }
    }

    class Map {
      addListener() {
        return { remove: vi.fn() };
      }

      fitBounds() {}

      panTo() {}

      setCenter() {}

      setZoom() {}
    }

    class InfoWindow {
      close() {}

      open() {}

      setContent() {}

      setPosition() {}
    }

    class LatLngBounds {
      extend() {}

      isEmpty() {
        return true;
      }
    }

    class Circle {
      addListener() {
        return { remove: vi.fn() };
      }

      setMap() {}
    }

    class Polyline {
      setMap() {}
    }

    loadGoogleMapsLibraryMock.mockResolvedValue({
      Circle,
      InfoWindow,
      LatLngBounds,
      Map,
      Marker,
      Polyline,
    } as unknown as GoogleMapsLibrary);

    const viaMarker = {
      draggable: true,
      id: "via-point-0",
      position: { lat: 11.0, lng: 107.0 },
    };
    const buildLabel = (text: string) => ({
      id: "route-option-label-0",
      label: { text },
      position: { lat: 11.2, lng: 107.4 },
    });

    const view = render(
      <GoogleMapCanvas
        ariaLabel="Route map"
        center={{ lat: 10.8, lng: 106.7 }}
        pointMarkers={[viaMarker, buildLabel("5 giờ 10 phút")]}
        zoom={12}
      />,
    );

    await waitFor(() => {
      expect(markerInstances).toHaveLength(2);
    });
    const viaInstance = markerInstances.find(
      (instance) => instance.options.draggable,
    );
    expect(viaInstance).toBeDefined();

    // Preview trong lúc kéo: mảng mới hoàn toàn — via marker cùng id + hình
    // dạng nhưng vị trí mới, nhãn bubble đổi text (hình dạng đổi → vẽ lại)
    view.rerender(
      <GoogleMapCanvas
        ariaLabel="Route map"
        center={{ lat: 10.8, lng: 106.7 }}
        pointMarkers={[
          { ...viaMarker, position: { lat: 11.05, lng: 107.05 } },
          buildLabel("5 giờ 25 phút"),
        ]}
        zoom={12}
      />,
    );

    await waitFor(() => {
      // Chỉ nhãn bubble bị vẽ lại (instance thứ 3) — via marker giữ nguyên
      expect(markerInstances).toHaveLength(3);
    });
    expect(viaInstance?.setMap).not.toHaveBeenCalledWith(null);
    expect(viaInstance?.setPosition).toHaveBeenCalledWith({
      lat: 11.05,
      lng: 107.05,
    });
  });

  it("cancels initialization when the map element is removed", async () => {
    let initializeMap: FrameRequestCallback | undefined;
    const cancelAnimationFrameMock = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      initializeMap = callback;
      return 42;
    });

    const mapCreated = vi.fn();

    class Map {
      constructor() {
        mapCreated();
      }
    }

    loadGoogleMapsLibraryMock.mockResolvedValue({
      Map,
    } as unknown as GoogleMapsLibrary);

    const view = render(
      <GoogleMapCanvas
        ariaLabel="Route map"
        center={{ lat: 10.8, lng: 106.7 }}
        zoom={12}
      />,
    );

    await waitFor(() => {
      expect(initializeMap).toBeDefined();
    });

    view.unmount();
    initializeMap?.(0);

    expect(cancelAnimationFrameMock).toHaveBeenCalledWith(42);
    expect(mapCreated).not.toHaveBeenCalled();
  });

  // Overlay neo card (OverlayView) dựng full mock google.maps.OverlayView tốn
  // công hơn giá trị mang lại (phải giả lập panes + projection thật) — test này
  // chỉ khẳng định TRADE-OFF tối thiểu: đổi anchorPosition qua lại (kể cả khi
  // OverlayView không có trong mock library) và unmount không crash. Việc vẽ
  // đúng vị trí pixel đã được cover gián tiếp qua test RouteDesignMap (assert
  // anchorPosition truyền đúng lat/lng của gợi ý).
  it("không crash khi anchorPosition/anchorContent đổi hoặc về null", async () => {
    class Map {
      addListener() {
        return { remove: vi.fn() };
      }

      fitBounds() {}

      panTo() {}

      setCenter() {}

      setZoom() {}
    }

    class Circle {
      addListener() {
        return { remove: vi.fn() };
      }

      setMap() {}
    }

    class InfoWindow {
      close() {}

      open() {}

      setContent() {}

      setPosition() {}
    }

    class LatLngBounds {
      extend() {}

      isEmpty() {
        return true;
      }
    }

    class Polyline {
      setMap() {}
    }

    loadGoogleMapsLibraryMock.mockResolvedValue({
      Circle,
      InfoWindow,
      LatLngBounds,
      Map,
      Polyline,
    } as unknown as GoogleMapsLibrary);

    const view = render(
      <GoogleMapCanvas
        ariaLabel="Route map"
        anchorContent={<span>popup</span>}
        anchorPosition={{ lat: 10.8, lng: 106.7 }}
        center={{ lat: 10.8, lng: 106.7 }}
        zoom={12}
      />,
    );

    await waitFor(() => {
      expect(loadGoogleMapsLibraryMock).toHaveBeenCalled();
    });

    expect(() =>
      view.rerender(
        <GoogleMapCanvas
          ariaLabel="Route map"
          anchorContent={<span>popup</span>}
          anchorPosition={{ lat: 11.1, lng: 107.2 }}
          center={{ lat: 10.8, lng: 106.7 }}
          zoom={12}
        />,
      ),
    ).not.toThrow();

    expect(() =>
      view.rerender(
        <GoogleMapCanvas
          ariaLabel="Route map"
          anchorContent={null}
          anchorPosition={null}
          center={{ lat: 10.8, lng: 106.7 }}
          zoom={12}
        />,
      ),
    ).not.toThrow();

    expect(() => view.unmount()).not.toThrow();
  });

  // Maps JS API không có option strokeDashArray: đường đứt nét = thân đường
  // trong suốt + Symbol gạch lặp lại (icons). Đường tham chiếu (tuyến chính vẽ
  // nền ở tab Tuyến thay thế) dựa hoàn toàn vào nhánh này.
  it("draws a dashed polyline as repeated stroke symbols on a transparent line", async () => {
    const polylineOptions: Array<Record<string, unknown>> = [];

    class Map {
      addListener() {
        return { remove: vi.fn() };
      }

      fitBounds() {}

      panTo() {}

      setCenter() {}

      setZoom() {}
    }

    class Circle {
      addListener() {
        return undefined;
      }

      setMap() {}
    }

    class InfoWindow {
      close() {}

      open() {}

      setContent() {}

      setPosition() {}
    }

    class LatLngBounds {
      extend() {}

      isEmpty() {
        return true;
      }
    }

    class Polyline {
      constructor(options: Record<string, unknown>) {
        polylineOptions.push(options);
      }

      addListener() {
        return { remove: vi.fn() };
      }

      setMap() {}
    }

    loadGoogleMapsLibraryMock.mockResolvedValue({
      Circle,
      InfoWindow,
      LatLngBounds,
      Map,
      Polyline,
    } as unknown as GoogleMapsLibrary);

    const path = [
      { lat: 10.8, lng: 106.7 },
      { lat: 11.9, lng: 108.4 },
    ];
    render(
      <GoogleMapCanvas
        ariaLabel="Route map"
        center={{ lat: 10.8, lng: 106.7 }}
        polylines={[
          { color: "#0f766e", dashed: true, id: "reference", path, weight: 5 },
          { color: "#f59e0b", id: "active", path, weight: 6 },
        ]}
        zoom={8}
      />,
    );

    await waitFor(() => expect(polylineOptions).toHaveLength(2));

    const [dashed, solid] = polylineOptions;
    // Thân đường trong suốt, màu nằm ở Symbol gạch
    expect(dashed.strokeOpacity).toBe(0);
    expect(dashed.icons).toMatchObject([
      { icon: { strokeColor: "#0f766e", scale: 5 }, repeat: "20px" },
    ]);
    // Đường thường không đụng tới: vẫn liền nét, không có icons
    expect(solid.strokeOpacity).toBe(1);
    expect(solid.icons).toBeUndefined();
  });

  // Bám xe: mỗi điểm GPS mới phải PAN theo, nhưng KHÔNG kéo zoom về mức mặc
  // định — nếu không, điều độ viên phóng to xem xe đang ở làn nào là bị giật ra
  // ngay ở ping kế tiếp.
  it("locks the focus zoom once and only pans on later focus updates", async () => {
    const panTo = vi.fn();
    const setZoom = vi.fn();

    class Map {
      addListener() {
        return { remove: vi.fn() };
      }

      fitBounds() {}

      panTo(...args: unknown[]) {
        panTo(...args);
      }

      setCenter() {}

      setZoom(...args: unknown[]) {
        setZoom(...args);
      }
    }

    class Circle {
      addListener() {
        return undefined;
      }

      setMap() {}
    }

    class InfoWindow {
      close() {}

      open() {}

      setContent() {}

      setPosition() {}
    }

    class LatLngBounds {
      extend() {}

      isEmpty() {
        return true;
      }
    }

    class Polyline {
      addListener() {
        return { remove: vi.fn() };
      }

      setMap() {}
    }

    loadGoogleMapsLibraryMock.mockResolvedValue({
      Circle,
      InfoWindow,
      LatLngBounds,
      Map,
      Polyline,
    } as unknown as GoogleMapsLibrary);

    // center/zoom là hằng ổn định như caller thật (FleetMap) — object mới mỗi
    // lần render sẽ kích effect đồng bộ center/zoom, không phải nhánh đang test
    const mapCenter = { lat: 10.8, lng: 106.7 };

    const view = render(
      <GoogleMapCanvas
        ariaLabel="Fleet map"
        center={mapCenter}
        focusCenter={{ lat: 10.8, lng: 106.7 }}
        focusZoom={14}
        zoom={11}
      />,
    );

    await waitFor(() => expect(panTo).toHaveBeenCalledTimes(1));
    expect(setZoom).toHaveBeenCalledWith(14);
    setZoom.mockClear();

    // Điểm GPS mới: pan theo xe, giữ nguyên mức zoom người dùng đang xem
    view.rerender(
      <GoogleMapCanvas
        ariaLabel="Fleet map"
        center={mapCenter}
        focusCenter={{ lat: 10.81, lng: 106.72 }}
        focusZoom={14}
        zoom={11}
      />,
    );

    await waitFor(() => expect(panTo).toHaveBeenCalledTimes(2));
    expect(panTo).toHaveBeenLastCalledWith({ lat: 10.81, lng: 106.72 });
    expect(setZoom).not.toHaveBeenCalled();

    // Bỏ bám rồi bám lại (chọn chuyến khác) → khoá lại mức zoom từ đầu
    view.rerender(
      <GoogleMapCanvas
        ariaLabel="Fleet map"
        center={mapCenter}
        focusCenter={null}
        focusZoom={14}
        zoom={11}
      />,
    );
    view.rerender(
      <GoogleMapCanvas
        ariaLabel="Fleet map"
        center={mapCenter}
        focusCenter={{ lat: 10.9, lng: 106.9 }}
        focusZoom={14}
        zoom={11}
      />,
    );

    await waitFor(() => expect(setZoom).toHaveBeenCalledWith(14));
  });
  it("reuses a polyline instance when only its path changes", async () => {
    // Kéo nắn đường đổi path mỗi nhịp chuột. Trước đây mỗi lần đổi là gỡ + dựng
    // lại TOÀN BỘ polyline (vài nghìn đỉnh) → đường nháy và giật; pool reconcile
    // theo id phải giữ nguyên instance và chỉ gọi setPath.
    const polylineCreated = vi.fn();
    const setPath = vi.fn();
    const setPolylineOptions = vi.fn();
    const polylineRemoved = vi.fn();

    class Map {
      addListener() {
        return { remove: vi.fn() };
      }

      fitBounds() {}

      panTo() {}

      setCenter() {}

      setZoom() {}
    }

    class Circle {
      addListener() {
        return { remove: vi.fn() };
      }

      setMap() {}
    }

    class InfoWindow {
      close() {}

      open() {}

      setContent() {}

      setPosition() {}
    }

    class LatLngBounds {
      extend() {}

      isEmpty() {
        return true;
      }
    }

    class Polyline {
      constructor() {
        polylineCreated();
      }

      addListener() {
        return { remove: vi.fn() };
      }

      setMap(map: unknown) {
        if (map === null) {
          polylineRemoved();
        }
      }

      setOptions(options: unknown) {
        setPolylineOptions(options);
      }

      setPath(path: unknown) {
        setPath(path);
      }
    }

    loadGoogleMapsLibraryMock.mockResolvedValue({
      Circle,
      InfoWindow,
      LatLngBounds,
      Map,
      Polyline,
    } as unknown as GoogleMapsLibrary);

    const mapCenter = { lat: 10.8, lng: 106.7 };
    const firstPath = [
      { lat: 10.8, lng: 106.7 },
      { lat: 10.9, lng: 106.8 },
    ];

    const view = render(
      <GoogleMapCanvas
        ariaLabel="Route map"
        center={mapCenter}
        polylines={[{ color: "#0f766e", id: "route", path: firstPath }]}
        zoom={12}
      />,
    );

    await waitFor(() => expect(polylineCreated).toHaveBeenCalledTimes(1));

    const secondPath = [
      { lat: 10.8, lng: 106.7 },
      { lat: 10.85, lng: 106.9 },
      { lat: 10.9, lng: 106.8 },
    ];

    view.rerender(
      <GoogleMapCanvas
        ariaLabel="Route map"
        center={mapCenter}
        polylines={[{ color: "#0f766e", id: "route", path: secondPath }]}
        zoom={12}
      />,
    );

    await waitFor(() => expect(setPath).toHaveBeenCalledWith(secondPath));
    expect(polylineCreated).toHaveBeenCalledTimes(1);
    expect(polylineRemoved).not.toHaveBeenCalled();
    // Kiểu vẽ không đổi → không đụng setOptions
    expect(setPolylineOptions).not.toHaveBeenCalled();

    // Đổi độ dày (vd đường trở thành đường đang chọn) → setOptions tại chỗ,
    // vẫn không dựng lại instance
    view.rerender(
      <GoogleMapCanvas
        ariaLabel="Route map"
        center={mapCenter}
        polylines={[
          { color: "#0f766e", id: "route", path: secondPath, weight: 8 },
        ]}
        zoom={12}
      />,
    );

    await waitFor(() =>
      expect(setPolylineOptions).toHaveBeenCalledWith(
        expect.objectContaining({ strokeWeight: 8 }),
      ),
    );
    expect(polylineCreated).toHaveBeenCalledTimes(1);

    // Đường biến mất khỏi props → gỡ khỏi bản đồ
    view.rerender(
      <GoogleMapCanvas
        ariaLabel="Route map"
        center={mapCenter}
        polylines={[]}
        zoom={12}
      />,
    );

    await waitFor(() => expect(polylineRemoved).toHaveBeenCalled());
  });
});
