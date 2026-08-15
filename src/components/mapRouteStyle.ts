// Bảng màu + cỡ marker của TUYẾN trên bản đồ, dùng chung cho mọi màn có vẽ
// tuyến: Tuyến & điểm dừng, Trung tâm vận hành và trang chia sẻ hành trình
// công khai. Cùng một tuyến nhìn ở ba nơi phải ra đúng một kiểu — trước đây
// trang chia sẻ tự khai một bảng màu riêng nên khách nhận link thấy tuyến khác
// hẳn tuyến nhà xe nhìn trong app.
//
// Đây là file hằng số thuần (không React) nên import được từ cả page lẫn
// component mà không vướng react-refresh.

/** Bến đi — pin teal, cùng tông nhận diện tuyến của app. */
export const originStopColor = "#0f766e";
/** Bến đến — pin đỏ. */
export const destinationStopColor = "#dc2626";
/** Điểm dừng giữa tuyến — đĩa trắng, viền + số màu bến đi. */
export const intermediateStopColor = "#ffffff";

/** Đoạn tuyến xe đã chạy qua — đậm. */
export const routeTraveledColor = "#0f766e";
/** Đoạn tuyến còn lại phía trước — cùng tông nhưng nhạt hơn. */
export const routeRemainingColor = "#5eafa8";

// Marker giữ kích thước pixel cố định ở mọi mức zoom: ở mức nhìn cả tuyến liên
// tỉnh vẫn phải đọc được pin và số thứ tự điểm dừng.
export const routeEndpointPinScale = 0.8;
export const routeStopBadgeScale = 0.95;

/** Xe đang chạy (có tốc độ) — cùng màu với đội xe ở Trung tâm vận hành. */
export const vehicleMovingColor = "#16a34a";
/** Xe đang dừng/đỗ. */
export const vehicleIdleColor = "#f59e0b";
