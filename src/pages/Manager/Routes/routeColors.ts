// Bảng màu đường của màn Routes — để ở module riêng (không nằm trong file
// component) vì cả RouteDesignMap lẫn chú giải của AlternativeRouteWorkspace
// đều dùng; export hàm/hằng từ file component sẽ vi phạm react-refresh.

// Tuyến chính (teal) và tuyến thay thế đang soạn (cam) — hai màu nhận diện của
// màn thiết kế tuyến.
export const mainRouteColor = "#0f766e";
export const alternativeRouteColor = "#f59e0b";

// Phương án đường CHƯA CHỌN dùng cùng tông với tuyến đang soạn, chỉ pha trắng
// cho nhạt bớt: vẫn thấy rõ là đường của app chứ không lẫn vào đường phố trong
// bản đồ, nhưng không tranh chỗ với tuyến đang chọn.
const dimmedRouteWhiteRatio = 0.38;

export function dimRouteColor(hex: string): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return hex;
  }

  const channels = [0, 2, 4].map((offset) =>
    Number.parseInt(normalized.slice(offset, offset + 2), 16),
  );
  if (channels.some((channel) => Number.isNaN(channel))) {
    return hex;
  }

  return `#${channels
    .map((channel) =>
      Math.round(channel + (255 - channel) * dimmedRouteWhiteRatio)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
