// Symbol path dùng chung cho marker bản đồ, để màn Tuyến & điểm dừng và màn
// Trung tâm vận hành vẽ RA CÙNG MỘT thứ: cùng hình pin bến đi/bến đến, cùng
// đĩa số cho điểm dừng. Trước đây mỗi màn tự khai một hình riêng nên cùng một
// tuyến nhìn ở hai màn lại ra hai kiểu.

// Pin bến đi/bến đến có mũi neo tại (0,0): kích thước cố định theo pixel nên
// luôn chỉ đúng tọa độ, không phình to theo zoom như Circle tính bằng mét.
export const routeEndpointPinPath =
  "M 0 0 C -2 -3 -14 -14 -14 -25 C -14 -33 -8 -39 0 -39 C 8 -39 14 -33 14 -25 C 14 -14 2 -3 0 0 Z";

// Đĩa tròn cho marker điểm dừng đánh số 1..N
export const stopNumberPath = "M 0 -11 a 11 11 0 1 1 0 22 a 11 11 0 1 1 0 -22 Z";

// Marker xe = đĩa tròn màu trạng thái + mũi tên chỉ hướng chạy đè lên. Một
// Symbol của Google chỉ nhận ĐÚNG MỘT màu fill nên phải xếp chồng hai marker
// cùng toạ độ; chỉ mũi tên xoay, đĩa tròn đứng yên.
//
// Vòng tròn phải vẽ bằng hai nửa cung: cung SVG có điểm đầu trùng điểm cuối là
// suy biến, trình duyệt bỏ qua không vẽ gì.
export const vehicleDiscPath = "M 0 -11 A 11 11 0 1 0 0 11 A 11 11 0 1 0 0 -11 Z";

// Mũi tên điều hướng: đỉnh ở mũi, khuyết một góc ở đuôi để đọc rõ chiều ngay cả
// khi marker chỉ còn hơn chục pixel. Ở rotation = 0 mũi tên chỉ lên hướng bắc.
export const vehicleArrowPath = "M 0 -6.5 L 5 5.5 L 0 2.5 L -5 5.5 Z";
