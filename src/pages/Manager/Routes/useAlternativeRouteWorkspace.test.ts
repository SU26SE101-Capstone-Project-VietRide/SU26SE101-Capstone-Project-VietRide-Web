// Test prefill bến đến cho nháp tuyến thay thế MỚI: chưa chọn bến đến → mặc
// định lấy bến đến của tuyến chính (để map auto-fetch phương án Google ngay khi
// mở tab), KHÔNG bật dirty; đã chọn bến/mở alt có sẵn thì không ghi đè.
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StationOption } from "./types";
import type { TranslateFn } from "./types";

vi.mock("../../../api/vietride", () => ({
  createAlternativeRoute: vi.fn(),
  createOperatorStop: vi.fn(),
  deleteAlternativeRoute: vi.fn(),
  setAlternativeRouteActive: vi.fn(),
  updateAlternativeRoute: vi.fn(),
  updateAlternativeRouteGeometry: vi.fn(),
}));

vi.mock("./geometry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./geometry")>();
  return { ...actual, requestRoadGeometry: vi.fn() };
});

import {
  deleteAlternativeRoute,
  setAlternativeRouteActive,
  type AlternativeRoute,
} from "../../../api/vietride";
import { useAlternativeRouteWorkspace } from "./useAlternativeRouteWorkspace";

function makeStation(overrides: Partial<StationOption>): StationOption {
  return {
    id: "station-1",
    name: "Bến",
    city: "TP.HCM",
    latitude: 10.77,
    longitude: 106.69,
    ...overrides,
  } as StationOption;
}

const originStation = makeStation({ id: "origin-1", name: "Bến đi" });
const mainDestinationStation = makeStation({
  id: "dest-main",
  name: "Bến đến tuyến chính",
  latitude: 11.94,
  longitude: 108.44,
});
const stations = [originStation, mainDestinationStation];

function renderWorkspace(mainDestinationStationId: string) {
  return renderHook(() =>
    useAlternativeRouteWorkspace({
      selectedRouteId: "route-1",
      originStationId: originStation.id,
      mainDestinationStationId,
      mainRoutePathPoints: [],
      stations,
      stops: [],
      // Tắt workspace để test prefill thuần form — không auto-fetch Google
      isWorkspaceActive: false,
      canManageRoutes: true,
      toastError: vi.fn(),
      toastSuccess: vi.fn(),
      t: ((key: string) => key) as TranslateFn,
    }),
  );
}

describe("useAlternativeRouteWorkspace — prefill bến đến cho nháp mới", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults the draft destination to the main route destination without marking dirty", async () => {
    const { result } = renderWorkspace(mainDestinationStation.id);

    await waitFor(() => {
      expect(result.current.altForm.destinationStationId).toBe(
        mainDestinationStation.id,
      );
    });
    expect(result.current.isAltDirty).toBe(false);
  });

  it("leaves the draft destination empty when the main route has no destination", () => {
    const { result } = renderWorkspace("");

    expect(result.current.altForm.destinationStationId).toBe("");
    expect(result.current.isAltDirty).toBe(false);
  });

  it("does not override a destination the user already picked", async () => {
    const { result } = renderWorkspace(mainDestinationStation.id);

    await waitFor(() => {
      expect(result.current.altForm.destinationStationId).toBe(
        mainDestinationStation.id,
      );
    });

    const otherStationId = "dest-other";
    act(() => {
      result.current.updateAltField("destinationStationId", otherStationId);
    });

    await waitFor(() => {
      expect(result.current.altForm.destinationStationId).toBe(otherStationId);
    });
    expect(result.current.isAltDirty).toBe(true);
  });
});

// BE xoá MỀM tuyến thay thế (DeactivateAlternativeRouteCommand): bản ghi còn
// nguyên, GET danh sách vẫn trả về. UI phải giữ item lại + khôi phục được, chứ
// không được gỡ khỏi danh sách như xoá cứng.
describe("useAlternativeRouteWorkspace — xoá mềm & khôi phục", () => {
  const altOne: AlternativeRoute = {
    id: "alt-1",
    routeId: "route-1",
    name: "Alt One",
    description: "",
    destinationStationId: mainDestinationStation.id,
    totalDistanceKm: 55,
    estimatedDurationMinutes: 75,
    isActive: true,
    stops: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the deactivated alternative in the list instead of removing it", async () => {
    vi.mocked(deleteAlternativeRoute).mockResolvedValue({ isActive: false });
    const { result } = renderWorkspace(mainDestinationStation.id);

    act(() => {
      result.current.applyAlternatives([altOne]);
    });
    await act(async () => {
      await result.current.handleDeleteAlternativeRoute(altOne);
    });

    expect(deleteAlternativeRoute).toHaveBeenCalledWith("alt-1");
    expect(result.current.alternativeRoutes).toHaveLength(1);
    expect(result.current.alternativeRoutes[0].isActive).toBe(false);
    // Bản đã ngưng không chiếm chỗ trong trần 2 bản
    expect(result.current.activeAlternativeCount).toBe(0);
    expect(result.current.selectedAlternative?.id).toBe("alt-1");
  });

  it("restores through a PATCH that carries isActive only", async () => {
    const deactivated = { ...altOne, isActive: false };
    vi.mocked(setAlternativeRouteActive).mockResolvedValue(altOne);
    const { result } = renderWorkspace(mainDestinationStation.id);

    act(() => {
      result.current.applyAlternatives([deactivated]);
    });
    await act(async () => {
      await result.current.handleRestoreAlternativeRoute(deactivated);
    });

    expect(setAlternativeRouteActive).toHaveBeenCalledWith("alt-1", true);
    expect(result.current.alternativeRoutes[0].isActive).toBe(true);
    expect(result.current.activeAlternativeCount).toBe(1);
  });
});
