import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlaceDetails } from "../../../lib/googlePlacesSearch";

vi.mock("../../../lib/googlePlacesSearch", () => ({
  getPlaceDetails: vi.fn(),
}));

import { getPlaceDetails } from "../../../lib/googlePlacesSearch";
import { usePlaceDetails } from "./usePlaceDetails";

const mockedGetPlaceDetails = vi.mocked(getPlaceDetails);

const fakeDetails: PlaceDetails = {
  placeId: "place-1",
  name: "Trạm dừng chân Madagui",
  address: "QL20, Đạ Huoai, Lâm Đồng",
  rating: 4.3,
  userRatingCount: 128,
  phone: "+84 251 3874 999",
  primaryTypeLabel: "Trạm dừng chân",
  openNow: true,
  weekdayHours: ["Thứ Hai: 00:00–24:00"],
  photoName: "places/place-1/photos/photo-1",
  googleMapsUri: "https://maps.google.com/?cid=123",
};

describe("usePlaceDetails", () => {
  it("placeId null → không gọi API, trả details null và isLoading false", () => {
    const { result } = renderHook(() => usePlaceDetails(null));
    expect(mockedGetPlaceDetails).not.toHaveBeenCalled();
    expect(result.current).toEqual({ details: null, isLoading: false });
  });

  it("placeId đổi → gọi API, isLoading true rồi trả details khi xong", async () => {
    let resolveFn: (details: PlaceDetails | null) => void = () => {};
    mockedGetPlaceDetails.mockReturnValue(
      new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );

    const { result } = renderHook(() => usePlaceDetails("place-1"));

    expect(mockedGetPlaceDetails).toHaveBeenCalledWith("place-1");
    expect(result.current.isLoading).toBe(true);
    expect(result.current.details).toBeNull();

    resolveFn(fakeDetails);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.details).toEqual(fakeDetails);
  });

  it("API trả null (lỗi/thiếu key) → details null, isLoading false", async () => {
    mockedGetPlaceDetails.mockResolvedValue(null);

    const { result } = renderHook(() => usePlaceDetails("place-2"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.details).toBeNull();
  });

  it("guard race: đổi placeId trước khi promise cũ resolve → bỏ qua kết quả cũ", async () => {
    let resolveFirst: (details: PlaceDetails | null) => void = () => {};
    mockedGetPlaceDetails.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const secondDetails: PlaceDetails = { ...fakeDetails, placeId: "place-2" };
    mockedGetPlaceDetails.mockResolvedValueOnce(secondDetails);

    const { result, rerender } = renderHook(
      ({ placeId }: { placeId: string | null }) => usePlaceDetails(placeId),
      { initialProps: { placeId: "place-1" } },
    );

    rerender({ placeId: "place-2" });

    await waitFor(() => {
      expect(result.current.details).toEqual(secondDetails);
    });

    // Promise của placeId cũ resolve muộn — không được ghi đè kết quả của placeId mới.
    resolveFirst(fakeDetails);
    expect(result.current.details).toEqual(secondDetails);
  });
});
