// Test StopSearchBox: gõ ≥2 ký tự phải lọc kho nhà xe theo tên (client-side) và
// gọi Google Places autocomplete (mock) cho nhóm địa điểm; chọn 1 dòng phải gọi
// onPick với đúng StopSuggestion (kind + id/googlePlaceId + toạ độ).
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OperatorStop } from "../../../api/vietride";
import type { StopSuggestion } from "./types";
import StopSearchBox from "./StopSearchBox";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { loadGooglePlacesLibraryMock, fetchAutocompleteSuggestionsMock } =
  vi.hoisted(() => ({
    loadGooglePlacesLibraryMock: vi.fn(),
    fetchAutocompleteSuggestionsMock: vi.fn(),
  }));

vi.mock("../../../lib/googleMaps", () => ({
  loadGooglePlacesLibrary: loadGooglePlacesLibraryMock,
}));

const stops: OperatorStop[] = [
  {
    id: "stop-1",
    operatorId: "op-1",
    name: "Bến xe Miền Đông",
    description: null,
    latitude: 10.8,
    longitude: 106.7,
    address: "292 Đinh Bộ Lĩnh",
    googlePlaceId: null,
    isActive: true,
  },
  {
    id: "stop-2",
    operatorId: "op-1",
    name: "Kho Đà Lạt",
    description: null,
    latitude: 11.9,
    longitude: 108.4,
    address: "Đà Lạt",
    googlePlaceId: null,
    isActive: true,
  },
];

function makeFakePlace() {
  return {
    id: "google-place-1",
    displayName: "Chợ Bến Thành",
    formattedAddress: "Chợ Bến Thành, Quận 1",
    location: {
      lat: () => 10.772,
      lng: () => 106.698,
    },
    addressComponents: [],
    fetchFields: vi.fn().mockResolvedValue(undefined),
  };
}

function setupGooglePlacesLibrary() {
  loadGooglePlacesLibraryMock.mockResolvedValue({
    AutocompleteSessionToken: class {},
    AutocompleteSuggestion: {
      fetchAutocompleteSuggestions: fetchAutocompleteSuggestionsMock,
    },
  });
}

describe("StopSearchBox", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("hiện gợi ý kho nhà xe khớp tên khi gõ ≥2 ký tự", async () => {
    setupGooglePlacesLibrary();
    fetchAutocompleteSuggestionsMock.mockResolvedValue({ suggestions: [] });
    const onPick = vi.fn();

    render(<StopSearchBox stops={stops} onPick={onPick} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "bến" } });

    expect(
      await screen.findByText("Bến xe Miền Đông"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Kho Đà Lạt")).not.toBeInTheDocument();
  });

  it("chọn dòng kho nhà xe → onPick nhận StopSuggestion kind operatorStop", async () => {
    setupGooglePlacesLibrary();
    fetchAutocompleteSuggestionsMock.mockResolvedValue({ suggestions: [] });
    const onPick = vi.fn();

    render(<StopSearchBox stops={stops} onPick={onPick} />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "bến" },
    });

    const row = await screen.findByText("Bến xe Miền Đông");
    fireEvent.click(row);

    expect(onPick).toHaveBeenCalledTimes(1);
    const result = onPick.mock.calls[0][0] as StopSuggestion;
    expect(result.kind).toBe("operatorStop");
    expect(result.id).toBe("stop-1");
    expect(result.distanceFromStartKm).toBe(0);
  });

  it("chọn dòng Google → onPick nhận StopSuggestion kind googlePlace kèm toạ độ", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupGooglePlacesLibrary();

    const fakePlace = makeFakePlace();
    fetchAutocompleteSuggestionsMock.mockResolvedValue({
      suggestions: [
        {
          placePrediction: {
            placeId: "google-place-1",
            text: { toString: () => "Chợ Bến Thành, Quận 1" },
            mainText: { toString: () => "Chợ Bến Thành" },
            secondaryText: { toString: () => "Quận 1" },
            toPlace: () => fakePlace,
          },
        },
      ],
    });
    const onPick = vi.fn();

    render(<StopSearchBox stops={stops} onPick={onPick} />);

    // Chờ effect nạp Google Places library (promise) chạy xong trước khi gõ,
    // để lúc debounce bắn request thì placesLibraryRef đã sẵn sàng.
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "cho ben thanh" },
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    const row = await screen.findByText("Chợ Bến Thành");
    fireEvent.click(row);

    await act(async () => {
      await Promise.resolve();
    });

    expect(onPick).toHaveBeenCalledTimes(1);

    const result = onPick.mock.calls[0][0] as StopSuggestion;
    expect(result.kind).toBe("googlePlace");
    expect(result.googlePlaceId).toBe("google-place-1");
    expect(result.latitude).toBe(10.772);
    expect(result.longitude).toBe(106.698);
    expect(result.distanceFromStartKm).toBe(0);
  });
});
