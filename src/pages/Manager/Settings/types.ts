import type { FareSurchargeStatus } from "../../../api/vietride";

// Type cục bộ của màn Cấu hình. Chỉ còn phần phụ thu theo dịp — đúng bằng
// những gì BE `/v1/operator/fare-surcharges` cho nhà xe tự đặt.
//
// File cũ (`operatorConfigDefaults.ts`) còn seed sẵn chính sách đặt vé + gửi
// hàng cho `operatorId: "op1"`; đó là dữ liệu giả, BE không có endpoint tương
// ứng nên đã bỏ cùng hai tab đó.

/** Một dịp phụ thu, map 1-1 với `FareSurchargePeriodDto` của BE. */
export type HolidayPricingPeriod = {
  /** = `periodId` của BE */
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  surchargePercent: number;
  /** = `isActive` — nhà xe bật/tắt thủ công, khác với `status` theo ngày */
  active: boolean;
  /** Trạng thái BE tự tính theo ngày Asia/Ho_Chi_Minh + cờ bật/tắt */
  status: FareSurchargeStatus;
};

export type OperatorConfig = {
  /** = `isEnabled` của `GET/PUT /v1/operator/fare-surcharges/settings` */
  autoApplyHolidayPricing: boolean;
  holidayPeriods: HolidayPricingPeriod[];
};
