export type Trip = {
  id: string;
  code: string;
  route: string;
  vehicle: string;
  driver: string;
  departAt: string;
  seats: number;
  revenue: number;
  status: "completed" | "running" | "upcoming" | "cancelled";
};

export type Booking = {
  id: string;
  code: string;
  tripCode: string;
  passenger: string;
  phone: string;
  seat: string;
  price: number;
  status: "paid" | "pending" | "cancelled";
  paymentMethod?: "cash" | "wallet" | "vnpay";
  refundStatus?: "not_applicable" | "pending" | "refunded" | "failed";
  refundAmount?: number;
  cancellationFee?: number;
  cancelledAt?: string;
  cancelledBy?: "passenger" | "operator" | "system";
  refundReason?: string;
  refundTransactionId?: string;
  createdAt: string;
};

export type Parcel = {
  id: string;
  code: string;
  sender: string;
  senderContact: string;
  recipient: string;
  recipientContact?: string;
  route: string;
  weightKg: number;
  fee: number;
  status: "in_transit" | "delivered" | "pending_pickup";
  pickupAt?: string;
};

export type Operator = {
  id: string;
  name: string;
  revenue: number;
  bookings: number;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "operator" | "customer";
  active: boolean;
  createdAt: string;
};

export type VoucherType = "package" | "event" | "operator";

export type Voucher = {
  id: string;
  code: string;
  name: string;
  description?: string;
  voucherType: VoucherType;
  discount: number;
  discountType: "percent" | "fixed";
  minOrderValue?: number;
  maxUsagePerUser?: number;
  quantity: number;
  usedCount: number;
  expiryDate: string;
  applicableTo: "all" | "rides" | "parcels" | "packages";
  active: boolean;
  operatorId?: string;
  createdBy: "admin" | "operator";
  createdAt: string;
};

export type Package = {
  id: string;
  name: string;
  description: string;
  price: number;
  maxVehicles: number;
  maxRoutes: number;
  features: string[];
  duration: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PackagePurchase = {
  id: string;
  packageId: string;
  operatorId: string;
  months: number;
  totalPrice: number;
  discountAmount: number;
  voucherCode?: string;
  paymentMethod: "wallet" | "qr_code";
  status: "pending" | "completed" | "cancelled";
  purchasedAt: string;
  expiryAt: string;
};

export type OperatorSubscription = {
  operatorId: string;
  currentPackageId?: string;
  expiryDate?: string;
  remainingDays?: number;
  totalVehiclesUsed: number;
  totalRoutesUsed: number;
  status: "active" | "expired" | "none";
};

export type Policy = {
  id: string;
  title: string;
  description: string;
  content: string;
  policyType: "for_operator" | "for_user";
  category: string;
  version: number;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type OperatorPolicy = {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  operatorId: string;
  version: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

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

export type StaffMember = {
  id: string;
  name: string;
  role: "driver" | "dispatcher" | "seller";
  phone: string;
  license: string | null;
  trips: number;
  rating: number;
  status: "on_duty" | "leave";
};

export type FleetVehicle = {
  id: string;
  plate: string;
  model: string;
  year: number;
  capacity: number;
  driver: string | null;
  status: "active" | "maintenance" | "inactive";
};

export type RouteCard = {
  id: string;
  code: string;
  title: string;
  stops: number;
  duration: string;
  tripsPerWeek: number;
  distanceKm: number;
  status: "running" | "draft";
};

export type ManagerTripStatus =
  | "running"
  | "departed"
  | "upcoming"
  | "cancelled"
  | "completed";

export type ManagerTrip = {
  id: string;
  code: string;
  route: string;
  departAt: string;
  driver: string;
  vehiclePlate: string;
  seatsSold: number;
  seatsTotal: number;
  status: ManagerTripStatus;
};

export type TripCargoLoad = {
  tripCode: string;
  label: string;
  currentKg: number;
  maxKg: number;
};

export const trips: Trip[] = [
  {
    id: "1",
    code: "ABC-001",
    route: "Sài Gòn → Cần Thơ",
    vehicle: "VR-XYZ-001",
    driver: "Nguyễn Văn A",
    departAt: "2026-05-14T07:00:00",
    seats: 45,
    revenue: 4200000,
    status: "completed",
  },
  {
    id: "2",
    code: "ABC-002",
    route: "Sài Gòn → Vũng Tàu",
    vehicle: "VR-XYZ-002",
    driver: "Trần Văn B",
    departAt: "2026-05-14T08:30:00",
    seats: 38,
    revenue: 2800000,
    status: "running",
  },
  {
    id: "3",
    code: "ABC-003",
    route: "Hà Nội → Hải Phòng",
    vehicle: "VR-XYZ-003",
    driver: "Phạm Văn C",
    departAt: "2026-05-14T14:00:00",
    seats: 42,
    revenue: 3500000,
    status: "upcoming",
  },
];

export const managerTrips: ManagerTrip[] = [
  {
    id: "t1",
    code: "VR-2401",
    route: "HCM → Đà Lạt",
    departAt: "2026-05-18T06:00:00",
    driver: "Nguyễn Văn An",
    vehiclePlate: "51B-12345",
    seatsSold: 38,
    seatsTotal: 40,
    status: "running",
  },
  {
    id: "t2",
    code: "VR-2402",
    route: "HCM → Nha Trang",
    departAt: "2026-05-18T07:30:00",
    driver: "Trần Minh Tuấn",
    vehiclePlate: "51B-22334",
    seatsSold: 40,
    seatsTotal: 40,
    status: "departed",
  },
  {
    id: "t3",
    code: "VR-2403",
    route: "HCM → Vũng Tàu",
    departAt: "2026-05-18T09:00:00",
    driver: "Lê Hoàng Nam",
    vehiclePlate: "51B-33445",
    seatsSold: 22,
    seatsTotal: 34,
    status: "upcoming",
  },
  {
    id: "t4",
    code: "VR-2398",
    route: "HCM → Cần Thơ",
    departAt: "2026-05-17T14:00:00",
    driver: "Phạm Quốc Huy",
    vehiclePlate: "51B-44556",
    seatsSold: 0,
    seatsTotal: 0,
    status: "cancelled",
  },
  {
    id: "t5",
    code: "VR-2390",
    route: "HCM → Đà Lạt",
    departAt: "2026-05-17T06:00:00",
    driver: "Nguyễn Văn An",
    vehiclePlate: "51B-12345",
    seatsSold: 40,
    seatsTotal: 40,
    status: "completed",
  },
  {
    id: "t6",
    code: "VR-2410",
    route: "HN → Sapa",
    departAt: "2026-05-19T05:30:00",
    driver: "Đỗ Văn Long",
    vehiclePlate: "29A-11223",
    seatsSold: 28,
    seatsTotal: 32,
    status: "upcoming",
  },
  {
    id: "t7",
    code: "VR-2411",
    route: "HCM → Đà Lạt",
    departAt: "2026-05-19T22:00:00",
    driver: "Võ Thị Mai",
    vehiclePlate: "51B-55667",
    seatsSold: 12,
    seatsTotal: 40,
    status: "upcoming",
  },
];

export const bookings: Booking[] = [
  {
    id: "b1",
    code: "BK-88421",
    tripCode: "VR-2401",
    passenger: "Nguyễn Thu Hà",
    phone: "0901 234 567",
    seat: "A12",
    price: 320000,
    status: "paid",
    paymentMethod: "vnpay",
    refundStatus: "not_applicable",
    createdAt: "2026-05-14T06:10:00",
  },
  {
    id: "b2",
    code: "BK-88422",
    tripCode: "VR-2401",
    passenger: "Trần Văn Bình",
    phone: "0902 111 222",
    seat: "B04",
    price: 320000,
    status: "paid",
    paymentMethod: "wallet",
    refundStatus: "not_applicable",
    createdAt: "2026-05-14T07:00:00",
  },
  {
    id: "b3",
    code: "BK-88423",
    tripCode: "VR-2402",
    passenger: "Lê Thị Cẩm",
    phone: "0903 333 444",
    seat: "C08",
    price: 280000,
    status: "pending",
    paymentMethod: "vnpay",
    refundStatus: "not_applicable",
    createdAt: "2026-05-14T08:15:00",
  },
  {
    id: "b4",
    code: "BK-88424",
    tripCode: "VR-2403",
    passenger: "Phạm Minh Đức",
    phone: "0904 555 666",
    seat: "D01",
    price: 150000,
    status: "pending",
    paymentMethod: "wallet",
    refundStatus: "not_applicable",
    createdAt: "2026-05-14T09:20:00",
  },
  {
    id: "b5",
    code: "BK-88425",
    tripCode: "VR-2398",
    passenger: "Hoàng Anh Tuấn",
    phone: "0905 777 888",
    seat: "E11",
    price: 210000,
    status: "cancelled",
    paymentMethod: "vnpay",
    refundStatus: "pending",
    refundAmount: 168000,
    cancellationFee: 42000,
    cancelledAt: "2026-05-14T08:30:00",
    cancelledBy: "passenger",
    refundReason: "Khách hủy trong thời hạn được hoàn 80%.",
    createdAt: "2026-05-13T12:00:00",
  },
  {
    id: "b6",
    code: "BK-88426",
    tripCode: "VR-2390",
    passenger: "Đặng Thu Trang",
    phone: "0906 999 000",
    seat: "F02",
    price: 320000,
    status: "paid",
    paymentMethod: "wallet",
    refundStatus: "not_applicable",
    createdAt: "2026-05-12T10:30:00",
  },
  {
    id: "b7",
    code: "BK-88427",
    tripCode: "VR-2410",
    passenger: "Vũ Minh Khang",
    phone: "0907 111 222",
    seat: "G06",
    price: 450000,
    status: "cancelled",
    paymentMethod: "wallet",
    refundStatus: "refunded",
    refundAmount: 450000,
    cancellationFee: 0,
    cancelledAt: "2026-05-14T10:15:00",
    cancelledBy: "operator",
    refundReason: "Nhà xe hủy chuyến, hoàn 100% vào ví khách hàng.",
    refundTransactionId: "RF-20260514-002",
    createdAt: "2026-05-13T16:20:00",
  },
  {
    id: "b8",
    code: "BK-88428",
    tripCode: "VR-2411",
    passenger: "Bùi Thanh Mai",
    phone: "0908 333 444",
    seat: "H03",
    price: 320000,
    status: "cancelled",
    paymentMethod: "vnpay",
    refundStatus: "failed",
    refundAmount: 256000,
    cancellationFee: 64000,
    cancelledAt: "2026-05-14T11:05:00",
    cancelledBy: "passenger",
    refundReason: "Giao dịch hoàn qua cổng thanh toán thất bại, cần kiểm tra lại.",
    refundTransactionId: "RF-20260514-003",
    createdAt: "2026-05-13T21:40:00",
  },
];

export const parcels: Parcel[] = [
  {
    id: "p1",
    code: "KG-10291",
    sender: "Cty Minh Phát",
    senderContact: "Anh Tuấn",
    recipient: "Lê Văn Hùng",
    recipientContact: "0987 654 321",
    route: "HCM → Đà Lạt",
    weightKg: 12,
    fee: 120000,
    status: "in_transit",
  },
  {
    id: "p2",
    code: "KG-10292",
    sender: "Shop Lan Chi",
    senderContact: "Chị Lan",
    recipient: "Nguyễn Văn Em",
    recipientContact: "0912 345 678",
    route: "HCM → Nha Trang",
    weightKg: 5,
    fee: 50000,
    status: "delivered",
    pickupAt: "2026-05-14T09:20:00",
  },
  {
    id: "p3",
    code: "KG-10293",
    sender: "Kho Tổng HCM",
    senderContact: "Mr. Hùng",
    recipient: "CTy ABC",
    recipientContact: "0909 888 777",
    route: "HCM → Cần Thơ",
    weightKg: 45,
    fee: 180000,
    status: "pending_pickup",
  },
  {
    id: "p4",
    code: "KG-10294",
    sender: "Điện máy Xanh",
    senderContact: "Hotline",
    recipient: "Trần Thị B",
    recipientContact: "0933 222 111",
    route: "HCM → Vũng Tàu",
    weightKg: 8,
    fee: 80000,
    status: "delivered",
  },
  {
    id: "p5",
    code: "KG-10295",
    sender: "Fashion House",
    senderContact: "Ms. Mai",
    recipient: "Boutique Sapa",
    recipientContact: "0977 555 444",
    route: "HN → Sapa",
    weightKg: 3,
    fee: 60000,
    status: "in_transit",
  },
];

export const staffMembers: StaffMember[] = [
  {
    id: "s1",
    name: "Nguyễn Văn An",
    role: "driver",
    phone: "0901 111 222",
    license: "E - 2025",
    trips: 142,
    rating: 4.9,
    status: "on_duty",
  },
  {
    id: "s2",
    name: "Trần Thị Bích",
    role: "dispatcher",
    phone: "0902 222 333",
    license: null,
    trips: 128,
    rating: 4.8,
    status: "on_duty",
  },
  {
    id: "s3",
    name: "Lê Văn Cường",
    role: "seller",
    phone: "0903 333 444",
    license: null,
    trips: 0,
    rating: 4.7,
    status: "leave",
  },
  {
    id: "s4",
    name: "Phạm Hoàng Dũng",
    role: "driver",
    phone: "0904 444 555",
    license: "D - 2026",
    trips: 98,
    rating: 4.6,
    status: "on_duty",
  },
  {
    id: "s5",
    name: "Võ Thị Em",
    role: "driver",
    phone: "0905 555 666",
    license: "E - 2024",
    trips: 201,
    rating: 5.0,
    status: "leave",
  },
];

export const fleetVehicles: FleetVehicle[] = [
  {
    id: "v1",
    plate: "51B-12345",
    model: "Hyundai Universe 40s",
    year: 2022,
    capacity: 40,
    driver: "Nguyễn Văn An",
    status: "active",
  },
  {
    id: "v2",
    plate: "51B-22334",
    model: "Thaco Mobihome",
    year: 2021,
    capacity: 34,
    driver: "Trần Minh Tuấn",
    status: "active",
  },
  {
    id: "v3",
    plate: "51B-33445",
    model: "Hyundai County",
    year: 2020,
    capacity: 29,
    driver: null,
    status: "maintenance",
  },
  {
    id: "v4",
    plate: "51B-44556",
    model: "Samco Felix",
    year: 2019,
    capacity: 45,
    driver: "Phạm Quốc Huy",
    status: "active",
  },
  {
    id: "v5",
    plate: "29A-11223",
    model: "Hyundai Universe",
    year: 2023,
    capacity: 40,
    driver: "Đỗ Văn Long",
    status: "inactive",
  },
  {
    id: "v6",
    plate: "51B-55667",
    model: "Thaco Bluesky 120s",
    year: 2022,
    capacity: 40,
    driver: "Võ Thị Mai",
    status: "active",
  },
];

export const routeCards: RouteCard[] = [
  {
    id: "r1",
    code: "R-DL01",
    title: "HCM → Đà Lạt",
    stops: 6,
    duration: "7h 30m",
    tripsPerWeek: 18,
    distanceKm: 308,
    status: "running",
  },
  {
    id: "r2",
    code: "R-NT01",
    title: "HCM → Nha Trang",
    stops: 5,
    duration: "9h 00m",
    tripsPerWeek: 12,
    distanceKm: 445,
    status: "running",
  },
  {
    id: "r3",
    code: "R-VT01",
    title: "HCM → Vũng Tàu",
    stops: 3,
    duration: "2h 15m",
    tripsPerWeek: 24,
    distanceKm: 125,
    status: "running",
  },
  {
    id: "r4",
    code: "R-CT01",
    title: "HCM → Cần Thơ",
    stops: 4,
    duration: "3h 30m",
    tripsPerWeek: 16,
    distanceKm: 169,
    status: "running",
  },
  {
    id: "r5",
    code: "R-SP01",
    title: "HN → Sapa",
    stops: 4,
    duration: "6h 00m",
    tripsPerWeek: 6,
    distanceKm: 315,
    status: "running",
  },
  {
    id: "r6",
    code: "R-HP01",
    title: "HN → Hải Phòng",
    stops: 3,
    duration: "2h 00m",
    tripsPerWeek: 22,
    distanceKm: 120,
    status: "draft",
  },
];

export const tripCargoLoads: TripCargoLoad[] = [
  {
    tripCode: "VR-2401",
    label: "VR-2401 · HCM -> Đà Lạt",
    currentKg: 380,
    maxKg: 500,
  },
  {
    tripCode: "VR-2402",
    label: "VR-2402 · HCM -> Nha Trang",
    currentKg: 220,
    maxKg: 500,
  },
  {
    tripCode: "VR-2403",
    label: "VR-2403 · HCM -> Vũng Tàu",
    currentKg: 470,
    maxKg: 500,
  },
  {
    tripCode: "VR-2410",
    label: "VR-2410 · HN -> Sapa",
    currentKg: 120,
    maxKg: 400,
  },
];

export const operators: Operator[] = [
  { id: "op1", name: "Nhà xe Hương Hà", revenue: 12500000000, bookings: 1245 },
  { id: "op2", name: "Nhà xe Thắng Lợi", revenue: 11800000000, bookings: 1156 },
  {
    id: "op3",
    name: "Nhà xe Sài Gòn Express",
    revenue: 10200000000,
    bookings: 998,
  },
];

export const users: User[] = [
  {
    id: "u1",
    name: "Admin",
    email: "admin@vietride.com",
    role: "admin",
    active: true,
    createdAt: "2026-01-01",
  },
  {
    id: "u2",
    name: "Manager One",
    email: "manager@vietride.com",
    role: "manager",
    active: true,
    createdAt: "2026-02-15",
  },
  {
    id: "u3",
    name: "Operator A",
    email: "op1@vietride.com",
    role: "operator",
    active: true,
    createdAt: "2026-03-10",
  },
];

export const vouchers: Voucher[] = [
  {
    id: "v1",
    code: "SUMMER20",
    name: "Summer - 20%",
    description: "Summer promotion campaign",
    voucherType: "event",
    discount: 20,
    discountType: "percent",
    minOrderValue: 200000,
    maxUsagePerUser: 1,
    quantity: 5000,
    usedCount: 1200,
    expiryDate: "2026-08-31",
    applicableTo: "all",
    active: true,
    createdBy: "admin",
    createdAt: "2026-06-01",
  },
  {
    id: "v2",
    code: "STUDENT15",
    name: "Student - 15%",
    description: "Student discount voucher",
    voucherType: "event",
    discount: 15,
    discountType: "percent",
    minOrderValue: 100000,
    maxUsagePerUser: 2,
    quantity: 3000,
    usedCount: 800,
    expiryDate: "2026-12-31",
    applicableTo: "all",
    active: true,
    createdBy: "admin",
    createdAt: "2026-05-15",
  },
  {
    id: "v3",
    code: "FIRST50K",
    name: "New Account - 50K",
    description: "Welcome bonus for new accounts",
    voucherType: "event",
    discount: 50000,
    discountType: "fixed",
    minOrderValue: 200000,
    maxUsagePerUser: 1,
    quantity: 10000,
    usedCount: 5600,
    expiryDate: "2026-12-31",
    applicableTo: "all",
    active: true,
    createdBy: "admin",
    createdAt: "2026-01-01",
  },
  {
    id: "v4",
    code: "PKG100K",
    name: "Package Premium - 100K",
    description: "Promotion for Premium package purchase",
    voucherType: "package",
    discount: 100000,
    discountType: "fixed",
    minOrderValue: 0,
    maxUsagePerUser: 5,
    quantity: 100,
    usedCount: 35,
    expiryDate: "2026-12-31",
    applicableTo: "all",
    active: true,
    createdBy: "admin",
    createdAt: "2026-06-01",
  },
  {
    id: "v5",
    code: "OP-LOYAL10",
    name: "Loyal Customer - 10%",
    description: "Voucher for loyal customers",
    voucherType: "operator",
    discount: 10,
    discountType: "percent",
    minOrderValue: 150000,
    maxUsagePerUser: 3,
    quantity: 500,
    usedCount: 120,
    expiryDate: "2026-09-30",
    applicableTo: "rides",
    active: true,
    operatorId: "op1",
    createdBy: "operator",
    createdAt: "2026-06-10",
  },
];

export const packages: Package[] = [
  {
    id: "pkg1",
    name: "Basic Package",
    description: "Ideal for new operators",
    price: 1000000,
    maxVehicles: 5,
    maxRoutes: 3,
    features: [
      "Max 5 vehicles",
      "Max 3 routes",
      "Basic support",
      "100K promotion voucher",
    ],
    duration: 3,
    active: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-06-01",
  },
  {
    id: "pkg2",
    name: "Professional Package",
    description: "For growing operators",
    price: 3000000,
    maxVehicles: 20,
    maxRoutes: 10,
    features: [
      "Max 20 vehicles",
      "Max 10 routes",
      "Priority support",
      "300K promotion voucher",
      "Advanced analytics",
    ],
    duration: 3,
    active: true,
    createdAt: "2026-01-15",
    updatedAt: "2026-06-01",
  },
  {
    id: "pkg3",
    name: "Enterprise Package",
    description: "For large-scale operators",
    price: 8000000,
    maxVehicles: 100,
    maxRoutes: 50,
    features: [
      "Max 100 vehicles",
      "Max 50 routes",
      "24/7 dedicated support",
      "1M promotion voucher",
      "API access",
      "Custom integration",
    ],
    duration: 3,
    active: true,
    createdAt: "2026-02-01",
    updatedAt: "2026-06-01",
  },
];

export const packagePurchases: PackagePurchase[] = [
  {
    id: "pur1",
    packageId: "pkg1",
    operatorId: "op1",
    months: 3,
    totalPrice: 3000000,
    discountAmount: 200000,
    voucherCode: "PKG100K",
    paymentMethod: "wallet",
    status: "completed",
    purchasedAt: "2026-04-01",
    expiryAt: "2026-07-01",
  },
  {
    id: "pur2",
    packageId: "pkg2",
    operatorId: "op1",
    months: 6,
    totalPrice: 18000000,
    discountAmount: 500000,
    voucherCode: "SUMMER20",
    paymentMethod: "qr_code",
    status: "completed",
    purchasedAt: "2026-05-15",
    expiryAt: "2026-11-15",
  },
];

export const operatorSubscriptions: OperatorSubscription[] = [
  {
    operatorId: "op1",
    currentPackageId: "pkg2",
    expiryDate: "2026-11-15",
    remainingDays: 153,
    totalVehiclesUsed: 18,
    totalRoutesUsed: 8,
    status: "active",
  },
];

export const policies: Policy[] = [
  {
    id: "pol1",
    title: "Terms of Service for Operators",
    description: "General terms and conditions for operator partners",
    content:
      "1. Operators must comply with all local regulations.\n2. Service level agreements and performance standards apply.\n3. Revenue sharing model is 85% for operators, 15% for platform.",
    policyType: "for_operator",
    category: "Terms",
    version: 2,
    active: true,
    createdBy: "admin",
    createdAt: "2026-01-01",
    updatedAt: "2026-06-01",
  },
  {
    id: "pol2",
    title: "Cancellation Policy for Operators",
    description: "Cancellation and refund policy for operator cancellations",
    content:
      "1. Free cancellation up to 2 hours before trip.\n2. 50% refund if cancelled 1-2 hours before.\n3. No refund if cancelled less than 1 hour before.",
    policyType: "for_operator",
    category: "Cancellation",
    version: 1,
    active: true,
    createdBy: "admin",
    createdAt: "2026-02-15",
    updatedAt: "2026-06-01",
  },
  {
    id: "pol3",
    title: "Privacy Policy",
    description: "How we collect and use user data",
    content:
      "We collect user data for service improvement and personalization. Your data is protected by industry-standard encryption. We do not share your data with third parties without consent.",
    policyType: "for_user",
    category: "Privacy",
    version: 3,
    active: true,
    createdBy: "admin",
    createdAt: "2026-01-01",
    updatedAt: "2026-05-20",
  },
  {
    id: "pol4",
    title: "Safety Guidelines",
    description: "User safety and security guidelines",
    content:
      "1. Share trip details with trusted contacts.\n2. Meet drivers in public, well-lit areas.\n3. Report unsafe behavior immediately.\n4. Always wear seatbelt and follow traffic rules.",
    policyType: "for_user",
    category: "Safety",
    version: 2,
    active: true,
    createdBy: "admin",
    createdAt: "2026-03-01",
    updatedAt: "2026-06-01",
  },
];

export const operatorPolicies: OperatorPolicy[] = [
  {
    id: "oppol1",
    title: "Driver Code of Conduct",
    description: "Standard guidelines for our drivers",
    content:
      "1. Professional behavior at all times.\n2. Vehicle must be clean and well-maintained.\n3. Arrive 5 minutes early for pickups.\n4. Treat passengers with respect and courtesy.",
    category: "Conduct",
    operatorId: "op1",
    version: 1,
    active: true,
    createdAt: "2026-04-01",
    updatedAt: "2026-06-01",
  },
  {
    id: "oppol2",
    title: "Vehicle Maintenance Schedule",
    description: "Required maintenance for fleet vehicles",
    content:
      "1. Weekly inspections for all vehicles.\n2. Monthly oil changes.\n3. Quarterly brake and tire checks.\n4. Annual comprehensive inspection required.",
    category: "Maintenance",
    operatorId: "op1",
    version: 1,
    active: true,
    createdAt: "2026-05-01",
    updatedAt: "2026-06-01",
  },
];

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

export const monthlyRevenue = [
  { month: "Jan", value: 85 },
  { month: "Feb", value: 92 },
  { month: "Mar", value: 78 },
  { month: "Apr", value: 105 },
  { month: "May", value: 128 },
  { month: "Jun", value: 165 },
  { month: "Jul", value: 170 },
  { month: "Aug", value: 200 },
  { month: "Sep", value: 230 },
  { month: "Oct", value: 210 },
  { month: "Nov", value: 240 },
  { month: "Dec", value: 235 },
];
