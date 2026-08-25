// Type cục bộ của màn Trips — dùng chung giữa index, ScheduleForm, ScheduleTable, tripHelpers.

import type { BusinessCode } from "../../../api/vietride";

export type ResourceStatus = "active" | "inactive" | "available" | "busy";
export type ScheduleStatus = "draft" | "open" | "blocked";

export type RouteOption = {
  id: string;
  /** Mã tuyến do nhà xe đặt — có thể null với tuyến tạo trước khi BE thêm mã. */
  code?: BusinessCode;
  name: string;
  origin: string;
  destination: string;
  status: ResourceStatus;
  baseFare?: number;
  distanceKm?: number;
  durationMinutes?: number;
};

export type VehicleOption = {
  id: string;
  plate: string;
  /**
   * MÃ loại xe (`SLEEPER_BUS`, `SHUTTLE_16_SEAT`...) — dùng để so khớp, xem
   * `isShuttle16SeatVehicle`. KHÔNG đem hiển thị: người dùng đọc mã BE không
   * hiểu. Hiển thị dùng `vehicleTypeName`.
   */
  vehicleType: string;
  /** Tên loại xe do BE trả (`displayName`), đã theo ngôn ngữ nhà xe nhập. */
  vehicleTypeName?: string;
  vehicleTypeId?: string;
  seats: number;
  status: ResourceStatus;
};

export type StaffOption = {
  id: string;
  name: string;
  role: "driver" | "assistant";
  status: ResourceStatus;
};

export type ScheduleForm = {
  routeId: string;
  vehicleId: string;
  driverId: string;
  assistantId: string;
  departureAt: string;
  // Chỉ để hiển thị/validate phía client — BE tự tính estimatedArrivalTime từ
  // route.estimatedDurationMinutes lúc sinh Trip, không nhận field này.
  arrivalEstimate: string;
  // Ngày kết thúc lịch (YYYY-MM-DD). "" = không giới hạn -> gửi null cho BE.
  validUntil: string;
  baseFare: string;
  // Lịch chạy MỘT LẦN: dayOfWeek = đúng thứ của ngày khởi hành và
  // validUntil = validFrom. Ngược lại là lịch lặp theo dayOfWeek bên dưới.
  isOneTime: boolean;
  // Các thứ trong tuần theo chuẩn ISO 1..7 (1 = Thứ 2). Đây là mô hình THẬT của
  // BE (IReadOnlyCollection<int>, validate 1..7) — mọi tổ hợp đều hợp lệ, không
  // bị bó vào vài preset cố định.
  dayOfWeek: number[];
};

export type TripSchedule = ScheduleForm & {
  id: string;
  status: ScheduleStatus;
  routeName?: string;
  /** Mã tuyến của lịch chạy — hiển thị kèm tên tuyến, xem `BusinessCode`. */
  routeCode?: BusinessCode;
  vehiclePlate?: string;
  driverName?: string;
  assistantName?: string;
};
