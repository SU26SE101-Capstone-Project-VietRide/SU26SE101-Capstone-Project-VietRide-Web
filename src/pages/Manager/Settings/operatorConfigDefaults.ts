// Cấu hình mặc định cho màn Settings (chuyển từ src/data/mockData.ts —
// phần duy nhất còn được dùng). Các field chưa có API tương ứng vẫn seed từ đây.

export type HolidayPricingPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  surchargePercent: number;
  active: boolean;
};

export type OperatorConfig = {
  operatorId: string;
  defaultHolidaySurchargePercent: number;
  autoApplyHolidayPricing: boolean;
  holidayPeriods: HolidayPricingPeriod[];
  cancelHoursBefore: number;
  refundPercent: number;
  holdSeatMinutes: number;
  allowGuestBooking: boolean;
  minAdvanceBookingHours: number;
  maxTicketsPerBooking: number;
  requireOtpOnDelivery: boolean;
  maxParcelWeightKg: number;
  insuranceThresholdVnd: number;
  autoCloseParcelDays: number;
  parcelBaseFeeVnd: number;
};

export const operatorConfigs: OperatorConfig[] = [
  {
    operatorId: "op1",
    defaultHolidaySurchargePercent: 15,
    autoApplyHolidayPricing: true,
    holidayPeriods: [
      {
        id: "hp1",
        name: "Tết Nguyên Đán 2026",
        startDate: "2026-02-10",
        endDate: "2026-02-20",
        surchargePercent: 30,
        active: true,
      },
      {
        id: "hp2",
        name: "30/4 – 1/5",
        startDate: "2026-04-29",
        endDate: "2026-05-02",
        surchargePercent: 20,
        active: true,
      },
      {
        id: "hp3",
        name: "Lễ 2/9",
        startDate: "2026-09-01",
        endDate: "2026-09-03",
        surchargePercent: 15,
        active: false,
      },
    ],
    cancelHoursBefore: 6,
    refundPercent: 80,
    holdSeatMinutes: 15,
    allowGuestBooking: true,
    minAdvanceBookingHours: 2,
    maxTicketsPerBooking: 10,
    requireOtpOnDelivery: true,
    maxParcelWeightKg: 50,
    insuranceThresholdVnd: 2_000_000,
    autoCloseParcelDays: 7,
    parcelBaseFeeVnd: 30_000,
  },
];
