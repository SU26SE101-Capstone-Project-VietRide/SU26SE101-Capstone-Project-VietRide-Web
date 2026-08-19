/**
 * Bảng màu categorical dùng chung cho mọi biểu đồ.
 *
 * Trước đây mỗi biểu đồ tự chọn màu: biểu đồ cột dùng sky-600 + teal-500, donut
 * ngay cạnh nó lại dùng orange-500 + amber-500 — hai sắc LIỀN KỀ cho hai hạng
 * mục cần phân biệt, gần như không tách được bằng mắt và hoàn toàn không tách
 * được nếu mù màu. Không màu nào thuộc thang thương hiệu.
 *
 * Hai ràng buộc của bảng này, đã đo:
 * - Mỗi màu ≥ 3:1 với nền trắng (thấp nhất 4,54:1) để nhìn rõ cả khi in đen
 *   trắng hoặc trên màn kém.
 * - Hai màu liền nhau cách nhau ≥ 30° hue (thấp nhất 37,6°) để phân biệt được
 *   không phụ thuộc độ sáng.
 *
 * Bắt đầu bằng `vr-800` để biểu đồ neo vào màu thương hiệu.
 */
export const CHART_CATEGORICAL_COLORS = [
  "#2d8282", // vr-800
  "#1d4ed8", // blue-700
  "#b45309", // amber-700
  "#7e22ce", // purple-700
  "#be123c", // rose-700
  "#15803d", // green-700
] as const;

/** Màu theo chỉ số, quay vòng khi vượt quá số màu có sẵn. */
export function chartColorAt(index: number): string {
  return CHART_CATEGORICAL_COLORS[index % CHART_CATEGORICAL_COLORS.length];
}

/** Màu lưới/trục — xám trung tính, không thuộc bảng categorical. */
export const CHART_GRID_COLOR = "#e5e7eb";
