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
});
