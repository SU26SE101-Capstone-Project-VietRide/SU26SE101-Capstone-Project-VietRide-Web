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
});
