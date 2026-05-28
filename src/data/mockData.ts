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
  createdAt: string;
};

export type Parcel = {
  id: string;
  code: string;
  sender: string;
  senderContact: string;
  recipient: string;
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
};

export type Voucher = {
  id: string;
  code: string;
  discount: number;
  active: boolean;
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
    createdAt: "2026-05-12T10:30:00",
  },
];

export const parcels: Parcel[] = [
  {
    id: "p1",
    code: "KG-10291",
    sender: "Cty Minh Phát",
    senderContact: "Anh Tuấn",
    recipient: "Lê Văn Hùng",
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
  { tripCode: "VR-2401", label: "VR-2401 · HCM -> Đà Lạt", currentKg: 380, maxKg: 500 },
  { tripCode: "VR-2402", label: "VR-2402 · HCM -> Nha Trang", currentKg: 220, maxKg: 500 },
  { tripCode: "VR-2403", label: "VR-2403 · HCM -> Vũng Tàu", currentKg: 470, maxKg: 500 },
  { tripCode: "VR-2410", label: "VR-2410 · HN -> Sapa", currentKg: 120, maxKg: 400 },
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
  },
  {
    id: "u2",
    name: "Manager One",
    email: "manager@vietride.com",
    role: "manager",
    active: true,
  },
  {
    id: "u3",
    name: "Operator A",
    email: "op1@vietride.com",
    role: "operator",
    active: true,
  },
];

export const vouchers: Voucher[] = [
  { id: "v1", code: "SUMMER20", discount: 20, active: true },
  { id: "v2", code: "STUDENT15", discount: 15, active: true },
  { id: "v3", code: "CORP25", discount: 25, active: false },
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
