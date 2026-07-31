import { afterEach, describe, expect, it, vi } from "vitest";
import { loadGoogleMapsLibrary } from "./googleMaps";

describe("loadGoogleMapsLibrary", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "google");
    document
      .querySelector('script[src^="https://maps.googleapis.com/maps/api/js?"]')
      ?.remove();
    vi.unstubAllEnvs();
  });

  it("combines rendering constructors with LatLngBounds from the core library", async () => {
    class Map {}
    class Circle {}
    class Polyline {}
    class InfoWindow {}
    class LatLngBounds {}

    const importLibrary = vi.fn(async (name: string) => {
      if (name === "maps") {
        return { Map, Circle, Polyline, InfoWindow };
      }

      if (name === "core") {
        return { LatLngBounds };
      }

      return {};
    });

    Object.defineProperty(window, "google", {
      configurable: true,
      value: { maps: { importLibrary } },
    });

    const library = await loadGoogleMapsLibrary();

    expect(importLibrary).toHaveBeenCalledWith("maps");
    expect(importLibrary).toHaveBeenCalledWith("core");
    expect(library).toMatchObject({
      Map,
      Circle,
      Polyline,
      InfoWindow,
      LatLngBounds,
    });
  });

  it("keeps the full browser referrer for path-based key restrictions", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");

    class Map {}
    class Circle {}
    class Polyline {}
    class InfoWindow {}
    class LatLngBounds {}

    const importLibrary = vi.fn(async (name: string) => {
      if (name === "maps") {
        return { Map, Circle, Polyline, InfoWindow };
      }

      if (name === "core") {
        return { LatLngBounds };
      }

      return {};
    });
    const libraryPromise = loadGoogleMapsLibrary();
    const script = document.querySelector<HTMLScriptElement>(
      'script[src^="https://maps.googleapis.com/maps/api/js?"]',
    );

    expect(script).not.toBeNull();
    expect(
      new URL(script?.src ?? window.location.href).searchParams.has(
        "auth_referrer_policy",
      ),
    ).toBe(false);

    Object.defineProperty(window, "google", {
      configurable: true,
      value: { maps: { importLibrary } },
    });
    const readyCallback = Reflect.get(
      window,
      "__vietRideGoogleMapsReady",
    );
    if (typeof readyCallback !== "function") {
      throw new Error("Google Maps callback was not registered.");
    }

    readyCallback();

    await expect(libraryPromise).resolves.toMatchObject({
      Map,
      LatLngBounds,
    });
  });
});