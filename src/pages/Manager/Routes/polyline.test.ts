import { describe, expect, it } from "vitest";
import {
  decodeGooglePolyline,
  encodeGooglePolyline,
  estimateCoachDurationMinutes,
} from "./polyline";

describe("Google encoded polyline", () => {
  const points = [
    { latitude: 38.5, longitude: -120.2 },
    { latitude: 40.7, longitude: -120.95 },
    { latitude: 43.252, longitude: -126.453 },
  ];

  it("encodes coordinates using precision 5", () => {
    expect(encodeGooglePolyline(points)).toBe(
      "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
    );
  });

  it("decodes a precision-5 polyline", () => {
    expect(decodeGooglePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual(
      points,
    );
  });

  it("rejects an incomplete polyline", () => {
    expect(() => decodeGooglePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`"))
      .toThrow("Invalid encoded polyline");
  });

  it("uses a coach operating speed instead of optimistic car duration", () => {
    expect(estimateCoachDurationMinutes(435.4, 19_500)).toBe(581);
  });

  it("keeps a slower duration returned by the road router", () => {
    expect(estimateCoachDurationMinutes(100, 12_000)).toBe(200);
  });
});
