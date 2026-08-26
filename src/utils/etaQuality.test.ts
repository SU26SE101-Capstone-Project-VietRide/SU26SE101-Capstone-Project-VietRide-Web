import { describe, expect, it } from "vitest";
import { describeEtaQuality } from "./etaQuality";

describe("describeEtaQuality", () => {
  it("nhận diện đủ ba giá trị enum BE công bố", () => {
    expect(describeEtaQuality("TRAFFIC_AWARE")).toMatchObject({
      kind: "TRAFFIC_AWARE",
      labelKey: "gps.etaTrafficAware",
      tone: "success",
    });
    expect(describeEtaQuality("ROUTE_BASED")).toMatchObject({
      kind: "ROUTE_BASED",
      labelKey: "gps.etaRouteBased",
      tone: "info",
    });
    expect(describeEtaQuality("FALLBACK")).toMatchObject({
      kind: "FALLBACK",
      labelKey: "gps.etaFallbackQuality",
      tone: "neutral",
    });
  });

  // Enum additive: giá trị BE thêm sau này phải rơi vào nhãn trung tính chứ
  // không được ném lỗi hay trả null (null là ẩn cả badge).
  it("lùi về nhãn trung tính cho giá trị enum chưa biết", () => {
    expect(describeEtaQuality("SATELLITE_AWARE")).toMatchObject({
      kind: "UNKNOWN",
      labelKey: "gps.etaQualityUnknown",
      tone: "neutral",
    });
    expect(describeEtaQuality("traffic_aware")).toMatchObject({
      kind: "UNKNOWN",
    });
  });

  it("trả null khi BE không gửi field", () => {
    expect(describeEtaQuality(undefined)).toBeNull();
    expect(describeEtaQuality(null)).toBeNull();
    expect(describeEtaQuality("   ")).toBeNull();
  });
});
