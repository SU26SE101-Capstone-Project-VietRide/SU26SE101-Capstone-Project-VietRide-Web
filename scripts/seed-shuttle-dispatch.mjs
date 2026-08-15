// Dựng dữ liệu cho màn Điều phối trung chuyển (Manager → Dispatch) và, kèm cờ
// --start-main-trip, cho cả màn Trung tâm vận hành.
//
// Hàng đợi "yêu cầu trung chuyển" CHỈ sinh ra từ booking của hành khách có
// `shuttlePickup` — `POST /v1/bookings` chỉ mở cho role PASSENGER, phía operator
// không có endpoint tạo booking. Vì vậy script cần một tài khoản hành khách và
// ví của tài khoản đó phải đủ tiền: BE trả 402 PAYMENT_INSUFFICIENT_WALLET nếu
// thiếu, và nạp ví là redirect VNPay nên không tự động hoá được.
//
// Chạy khô mặc định — phải có --apply mới ghi.
import { pathToFileURL } from "node:url";

const PRODUCTION_HOSTS = new Set(["api.vietride.online"]);

// Bến phải cách giờ khởi hành đủ xa: BE chốt cửa nhận trung chuyển trước giờ
// chạy (hard cutoff), đặt sát giờ sẽ bị từ chối và hàng đợi vẫn trống.
const MIN_MINUTES_BEFORE_DEPARTURE = 120;

// Điểm đón rải quanh bến trong bán kính này. Gần quá thì mọi điểm trùng nhau
// trên bản đồ, xa quá thì BE có thể coi là ngoài vùng phục vụ.
const PICKUP_RADIUS_KM = { min: 1.5, max: 5 };

const PICKUP_STREETS = [
  "Nguyễn Huệ",
  "Lê Lợi",
  "Trần Hưng Đạo",
  "Nguyễn Thị Minh Khai",
  "Cách Mạng Tháng Tám",
  "Điện Biên Phủ",
  "Hai Bà Trưng",
  "Võ Văn Tần",
];

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function readValueArgument(argument, name) {
  const prefix = `--${name}=`;
  return argument.startsWith(prefix) ? argument.slice(prefix.length) : null;
}

export function parseArgs(argv) {
  const config = {
    tripId: "",
    bookings: 3,
    seats: 1,
    assign: false,
    startShuttle: false,
    startMainTrip: false,
    apply: false,
    allowProduction: false,
    help: false,
  };

  for (const argument of argv) {
    if (argument === "--apply") {
      config.apply = true;
      continue;
    }
    if (argument === "--allow-production") {
      config.allowProduction = true;
      continue;
    }
    if (argument === "--assign") {
      config.assign = true;
      continue;
    }
    if (argument === "--start") {
      config.startShuttle = true;
      continue;
    }
    if (argument === "--start-main-trip") {
      config.startMainTrip = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      config.help = true;
      continue;
    }

    const tripId = readValueArgument(argument, "trip");
    if (tripId !== null) {
      config.tripId = tripId.trim();
      continue;
    }

    const bookings = readValueArgument(argument, "bookings");
    if (bookings !== null) {
      const parsed = Number.parseInt(bookings, 10);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
        throw new Error("--bookings phải là số nguyên 1..10.");
      }
      config.bookings = parsed;
      continue;
    }

    const seats = readValueArgument(argument, "seats");
    if (seats !== null) {
      const parsed = Number.parseInt(seats, 10);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) {
        throw new Error("--seats phải là số nguyên 1..4.");
      }
      config.seats = parsed;
      continue;
    }

    throw new Error(`Tham số không hiểu: ${argument}`);
  }

  // Khởi hành chuyến trung chuyển thì đương nhiên phải có chuyến để khởi hành.
  if (config.startShuttle && !config.assign) {
    throw new Error("--start phải đi kèm --assign.");
  }

  return config;
}

export function isProductionBaseUrl(value) {
  try {
    return PRODUCTION_HOSTS.has(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Chọn chuyến để đặt vé kèm trung chuyển: còn chỗ, chưa chạy, và cách giờ khởi
 * hành đủ xa để không rơi vào cửa đóng của BE.
 */
export function pickTrip(trips, now = Date.now()) {
  const earliestDeparture = now + MIN_MINUTES_BEFORE_DEPARTURE * 60_000;

  return (
    trips
      .filter((trip) => {
        if (trip.status !== "SCHEDULED") return false;
        const departure = new Date(trip.departureAt ?? trip.departureTime).getTime();
        return Number.isFinite(departure) && departure >= earliestDeparture;
      })
      .sort(
        (left, right) =>
          new Date(left.departureAt ?? left.departureTime).getTime() -
          new Date(right.departureAt ?? right.departureTime).getTime(),
      )[0] ?? null
  );
}

/**
 * Rải `count` điểm đón quanh bến theo hình nan quạt, cách đều nhau về góc để
 * bản đồ nhìn ra được thứ tự đón thay vì chụm một chỗ.
 */
export function buildShuttlePickups(station, count) {
  const pickups = [];

  for (let index = 0; index < count; index += 1) {
    const angle = (2 * Math.PI * index) / count;
    const spread =
      count === 1
        ? PICKUP_RADIUS_KM.min
        : PICKUP_RADIUS_KM.min +
          ((PICKUP_RADIUS_KM.max - PICKUP_RADIUS_KM.min) * index) / (count - 1);

    // 1 độ vĩ ≈ 111 km; kinh độ co lại theo cos(vĩ độ).
    const latitude = station.latitude + (spread / 111) * Math.cos(angle);
    const longitude =
      station.longitude +
      (spread / (111 * Math.cos((station.latitude * Math.PI) / 180))) *
        Math.sin(angle);

    const street = PICKUP_STREETS[index % PICKUP_STREETS.length];
    pickups.push({
      address: `${12 + index * 7} ${street}, ${station.city ?? "TP.HCM"}`,
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
    });
  }

  return pickups;
}

/** Ghế trống đầu tiên theo sơ đồ ghế của chuyến. */
export function pickAvailableSeats(seatMap, needed, alreadyTaken = []) {
  const taken = new Set(alreadyTaken);
  const seats = [];

  for (const seat of seatMap) {
    if (seats.length >= needed) break;
    const seatNumber = seat.seatNumber ?? seat.number;
    if (!seatNumber || taken.has(seatNumber)) continue;
    // BE dùng nhiều tên trạng thái; chỉ nhận ghế chắc chắn còn trống.
    const status = String(seat.status ?? "AVAILABLE").toUpperCase();
    if (status !== "AVAILABLE" && seat.isAvailable === false) continue;
    if (status === "BOOKED" || status === "HELD" || status === "SOLD") continue;
    seats.push({ seatNumber });
  }

  if (seats.length < needed) {
    throw new Error(
      `Chuyến không còn đủ ghế trống (cần ${needed}, còn ${seats.length}).`,
    );
  }

  return seats;
}

function unwrapData(payload) {
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "data" in payload
  ) {
    return payload.data;
  }

  return payload;
}

function errorDetails(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  const error =
    payload.error && typeof payload.error === "object" ? payload.error : {};

  return {
    code: typeof error.code === "string" ? error.code : undefined,
    message:
      typeof error.message === "string"
        ? error.message
        : typeof payload.message === "string"
          ? payload.message
          : undefined,
  };
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError("Server trả về JSON không hợp lệ.", response.status);
    }
  }

  if (!response.ok) {
    const details = errorDetails(payload);
    throw new ApiError(
      details.message || `Request thất bại với status ${response.status}.`,
      response.status,
      details.code,
    );
  }

  return unwrapData(payload);
}

async function login(baseUrl, email, password, expectedRoles, label) {
  if (!email || !password) {
    throw new Error(`Thiếu email/mật khẩu cho ${label} (xem --help).`);
  }

  const data = await requestJson(baseUrl, "/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (typeof data?.accessToken !== "string") {
    throw new Error(`Đăng nhập ${label} không trả về access token.`);
  }
  if (expectedRoles.length > 0 && !expectedRoles.includes(data.user?.role)) {
    throw new Error(
      `Tài khoản ${label} có role ${data.user?.role}, cần ${expectedRoles.join(" hoặc ")}.`,
    );
  }

  return data.accessToken;
}

function authHeaders(accessToken, idempotencyKey) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
  };
}

function printHelp() {
  console.log(`
Dựng dữ liệu cho màn Điều phối trung chuyển (và Trung tâm vận hành).

Usage:
  npm run seed:shuttle -- [options]

Options:
  --trip=<tripId>     chuyến chính để đặt vé kèm trung chuyển (bỏ trống = tự chọn)
  --bookings=3        số booking cần tạo, 1..10 (mặc định 3)
  --seats=1           số ghế mỗi booking, 1..4 (mặc định 1)
  --assign            tạo luôn chuyến trung chuyển từ các yêu cầu vừa sinh
  --start             tài xế khởi hành chuyến trung chuyển (đi kèm --assign)
  --start-main-trip   tài xế khởi hành chuyến chính → hiện ở Trung tâm vận hành
  --apply             thực sự ghi; mặc định chỉ in kế hoạch
  --allow-production  bắt buộc khi trỏ vào api.vietride.online
  --help              in hướng dẫn này

Environment:
  VIETRIDE_SEED_API_BASE_URL       mặc định http://localhost:3000
  VIETRIDE_SEED_ADMIN_EMAIL        tài khoản OPERATOR_ADMIN
  VIETRIDE_SEED_ADMIN_PASSWORD
  VIETRIDE_PASSENGER_EMAIL         tài khoản PASSENGER (ví phải đủ tiền)
  VIETRIDE_PASSENGER_PASSWORD
  VIETRIDE_DRIVER_EMAIL            chỉ cần khi dùng --assign / --start*
  VIETRIDE_DRIVER_PASSWORD

Lưu ý: ví hành khách phải đủ tiền trước khi chạy. Nạp ví là redirect VNPay nên
script không tự làm được; thiếu tiền BE trả 402 PAYMENT_INSUFFICIENT_WALLET.
`);
}

async function resolveTargetTrip(baseUrl, operatorToken, passengerToken, config) {
  if (config.tripId) {
    return requestJson(baseUrl, `/v1/trips/${config.tripId}`, {
      headers: authHeaders(passengerToken),
    });
  }

  const list = await requestJson(
    baseUrl,
    "/v1/operator/trips?status=SCHEDULED&page=1&pageSize=50",
    { headers: authHeaders(operatorToken) },
  );
  const candidate = pickTrip(list?.items ?? []);
  if (!candidate) {
    throw new Error(
      `Không tìm thấy chuyến SCHEDULED nào khởi hành sau ${MIN_MINUTES_BEFORE_DEPARTURE} phút nữa. ` +
        "Tạo lịch chạy mới ở màn Chuyến đi rồi chạy lại, hoặc chỉ định --trip=<tripId>.",
    );
  }

  return requestJson(baseUrl, `/v1/trips/${candidate.tripId}`, {
    headers: authHeaders(passengerToken),
  });
}

async function assertStationSupportsShuttle(baseUrl, operatorToken, stationId) {
  const list = await requestJson(
    baseUrl,
    "/v1/operator/stations?supportsShuttle=true&page=1&pageSize=100",
    { headers: authHeaders(operatorToken) },
  );
  const station = (list?.items ?? []).find(
    (item) => (item.id ?? item.stationId) === stationId,
  );

  if (!station) {
    throw new Error(
      "Bến đi của chuyến chưa bật hỗ trợ trung chuyển. Vào màn Bến xe bật " +
        "'Hỗ trợ trung chuyển' cho bến này rồi chạy lại.",
    );
  }

  return station;
}

/** Xe đang hoạt động, đủ chỗ cho số khách cần đón. */
export function pickVehicle(vehicles, passengerCount) {
  return (
    vehicles
      .filter(
        (vehicle) =>
          String(vehicle.status ?? "").toUpperCase() === "ACTIVE" &&
          vehicle.isActive !== false &&
          (vehicle.totalSeats ?? 0) >= passengerCount,
      )
      // Xe nhỏ nhất còn vừa: giữ xe lớn cho nhóm đông hơn.
      .sort((left, right) => left.totalSeats - right.totalSeats)[0] ?? null
  );
}

export function pickDriver(users) {
  return (
    users.find(
      (user) =>
        String(user.role ?? "").toUpperCase() === "DRIVER" &&
        String(user.status ?? "").toUpperCase() === "ACTIVE",
    ) ?? null
  );
}

async function assignShuttleTrip(baseUrl, operatorToken, trip, groups, bookingIds) {
  const group = groups.find((item) => item.mainTripId === trip.tripId) ?? groups[0];
  if (!group) {
    throw new Error("Không có nhóm yêu cầu nào để gán xe.");
  }

  const [vehiclePage, userPage] = await Promise.all([
    requestJson(baseUrl, "/v1/operator/vehicles?page=1&pageSize=100", {
      headers: authHeaders(operatorToken),
    }),
    requestJson(baseUrl, "/v1/operator/users?role=DRIVER&page=1&pageSize=100", {
      headers: authHeaders(operatorToken),
    }),
  ]);

  const passengerCount = group.pendingPassengerCount ?? bookingIds.length;
  const vehicle = pickVehicle(vehiclePage?.items ?? [], passengerCount);
  const driver = pickDriver(userPage?.items ?? []);
  if (!vehicle) {
    throw new Error(`Không có xe ACTIVE nào đủ ${passengerCount} chỗ.`);
  }
  if (!driver) {
    throw new Error("Không có tài xế ACTIVE nào để gán.");
  }

  // Đón khách phải kết thúc trước giờ chuyến chính chạy; lùi 5 phút cho an toàn
  // vì BE chốt cửa đúng mốc đó.
  const departure = new Date(trip.departureTime).getTime();
  const scheduledEndTime = new Date(departure - 5 * 60_000).toISOString();
  const scheduledDepartureTime = new Date(departure - 65 * 60_000).toISOString();

  const result = await requestJson(baseUrl, "/v1/operator/shuttle-trips", {
    method: "POST",
    headers: authHeaders(operatorToken, `seed-shuttle-trip-${trip.tripId}`),
    body: JSON.stringify({
      mainTripId: trip.tripId,
      driverUserId: driver.userId ?? driver.id,
      vehicleId: vehicle.vehicleId ?? vehicle.id,
      scheduledDepartureTime,
      scheduledEndTime,
      orderedBookingIds: group.suggestedBookingOrder?.length
        ? group.suggestedBookingOrder
        : bookingIds,
      notes: "Seed data",
      direction: group.direction ?? "INBOUND_TO_STATION",
    }),
  });

  return result.shuttleTripId;
}

async function main(argv, env) {
  let config;
  try {
    config = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  if (config.help) {
    printHelp();
    return;
  }

  const baseUrl = (
    env.VIETRIDE_SEED_API_BASE_URL ||
    env.VITE_API_BASE_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");

  if (config.apply && isProductionBaseUrl(baseUrl) && !config.allowProduction) {
    console.error(
      `${baseUrl} là môi trường production — thêm --allow-production nếu bạn thật sự muốn ghi vào đó.`,
    );
    process.exitCode = 1;
    return;
  }

  const operatorToken = await login(
    baseUrl,
    env.VIETRIDE_SEED_ADMIN_EMAIL?.trim(),
    env.VIETRIDE_SEED_ADMIN_PASSWORD,
    ["OPERATOR_ADMIN"],
    "operator admin",
  );
  const passengerToken = await login(
    baseUrl,
    env.VIETRIDE_PASSENGER_EMAIL?.trim(),
    env.VIETRIDE_PASSENGER_PASSWORD,
    ["PASSENGER"],
    "hành khách",
  );

  const trip = await resolveTargetTrip(baseUrl, operatorToken, passengerToken, config);
  const station = await assertStationSupportsShuttle(
    baseUrl,
    operatorToken,
    trip.originStation.id,
  );
  const pickups = buildShuttlePickups(
    {
      latitude: Number(station.latitude),
      longitude: Number(station.longitude),
      city: station.city,
    },
    config.bookings,
  );

  console.log(`API      : ${baseUrl}`);
  console.log(`Chuyến   : ${trip.tripId} · khởi hành ${trip.departureTime}`);
  console.log(`Bến đi   : ${trip.originStation.name} (hỗ trợ trung chuyển)`);
  console.log(`Giá vé   : ${trip.effectiveFare ?? trip.baseFare} VND/ghế`);
  console.log(
    `Sẽ tạo   : ${config.bookings} booking × ${config.seats} ghế, mỗi booking một điểm đón:`,
  );
  for (const [index, pickup] of pickups.entries()) {
    console.log(
      `  ${index + 1}. ${pickup.address} (${pickup.latitude}, ${pickup.longitude})`,
    );
  }

  if (!config.apply) {
    console.log("\nChạy khô — thêm --apply để thực sự tạo.");
    return;
  }

  const seatMap = await requestJson(baseUrl, `/v1/trips/${trip.tripId}/seat-map`, {
    headers: authHeaders(passengerToken),
  });
  const seatPool = seatMap?.seats ?? seatMap?.items ?? seatMap ?? [];
  const takenSeats = [];
  const bookingIds = [];

  for (const [index, pickup] of pickups.entries()) {
    const seats = pickAvailableSeats(seatPool, config.seats, takenSeats);
    takenSeats.push(...seats.map((seat) => seat.seatNumber));

    try {
      const booking = await requestJson(baseUrl, "/v1/bookings", {
        method: "POST",
        // Khoá dedupe suy ra từ chuyến + thứ tự: chạy lại script không đẻ thêm
        // booking trùng.
        headers: authHeaders(
          passengerToken,
          `seed-shuttle-${trip.tripId}-${index + 1}`,
        ),
        body: JSON.stringify({
          tripId: trip.tripId,
          pickup: { stationId: trip.originStation.id },
          dropoff: { stationId: trip.destinationStation.id },
          shuttlePickup: pickup,
          seats,
          paymentMethod: "WALLET",
        }),
      });
      bookingIds.push(booking.bookingId);
      console.log(`✓ Booking ${index + 1}: ${booking.bookingId}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === "PAYMENT_INSUFFICIENT_WALLET") {
        console.error(
          `\n✗ Ví hành khách không đủ tiền (đã tạo ${bookingIds.length}/${pickups.length} booking).\n` +
            "  Nạp ví qua VNPay ở app hành khách rồi chạy lại — script sẽ bỏ qua các " +
            "booking đã tạo nhờ Idempotency-Key.",
        );
        process.exitCode = 1;
        return;
      }
      throw error;
    }
  }

  const requests = await requestJson(
    baseUrl,
    `/v1/operator/shuttle-requests?mainTripId=${trip.tripId}&page=1&pageSize=20`,
    { headers: authHeaders(operatorToken) },
  );
  const groups = requests?.items ?? [];
  console.log(
    `\nHàng đợi trung chuyển: ${groups.length} nhóm, ` +
      `${groups.reduce((total, group) => total + (group.pendingPassengerCount ?? 0), 0)} khách chờ.`,
  );

  let shuttleTripId = null;
  if (config.assign) {
    shuttleTripId = await assignShuttleTrip(
      baseUrl,
      operatorToken,
      trip,
      groups,
      bookingIds,
    );
    console.log(`✓ Chuyến trung chuyển: ${shuttleTripId}`);
  }

  if (config.startShuttle || config.startMainTrip) {
    const driverToken = await login(
      baseUrl,
      env.VIETRIDE_DRIVER_EMAIL?.trim(),
      env.VIETRIDE_DRIVER_PASSWORD,
      ["DRIVER"],
      "tài xế",
    );

    if (config.startMainTrip) {
      await requestJson(baseUrl, `/v1/driver/trips/${trip.tripId}/start`, {
        method: "POST",
        headers: authHeaders(driverToken, `seed-start-trip-${trip.tripId}`),
        body: "{}",
      });
      console.log("✓ Chuyến chính đã IN_PROGRESS — hiện ở Trung tâm vận hành.");
    }

    if (config.startShuttle && shuttleTripId) {
      await requestJson(
        baseUrl,
        `/v1/driver/shuttle-trips/${shuttleTripId}/start`,
        {
          method: "POST",
          headers: authHeaders(driverToken, `seed-start-shuttle-${shuttleTripId}`),
          body: "{}",
        },
      );
      console.log("✓ Chuyến trung chuyển đã IN_PROGRESS.");
    }
  }

  console.log("\nBước tiếp theo:");
  if (!config.assign) {
    console.log("  • Mở màn Điều phối trung chuyển để tự gán xe cho hàng đợi vừa tạo.");
  }
  console.log(
    `  • Bắn GPS cho chuyến chính:  npm run simulate:trip-gps -- --trip=${trip.tripId}`,
  );
  if (shuttleTripId) {
    console.log(
      "  • GPS của xe trung chuyển đi qua event `shuttle:gps:update` (app tài xế),\n" +
        "    simulate:trip-gps hiện chỉ bắn cho chuyến chính.",
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2), process.env).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
