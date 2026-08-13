// Giả lập xe chạy dọc lộ trình của một chuyến: đọc polyline tuyến rồi bắn
// `gps:update` qua socket tracking như app tài xế, để test bản đồ Trung tâm vận
// hành (icon xe di chuyển, đoạn "đã đi" / "chưa đi", ETA realtime).
//
// Yêu cầu: tuyến ĐÃ có lộ trình (chạy `npm run seed:trip-route -- --apply`
// trước nếu chưa), và tài khoản đăng nhập phải là TÀI XẾ/PHỤ XE được phân công
// đúng chuyến đó — gateway chỉ nhận gps:update từ scope DRIVER/ASSISTANT.
import { pathToFileURL } from "node:url";
import { io } from "socket.io-client";

const PRODUCTION_HOSTS = new Set(["api.vietride.online"]);
const TRACKING_SOCKET_PATH = "/tracking/socket.io";
const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function toDegrees(value) {
  return (value * 180) / Math.PI;
}

export function haversineMeters(first, second) {
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

// Hướng di chuyển 0-360 độ (0 = bắc) — payload gps:update nhận headingDeg
export function bearingDegrees(first, second) {
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const y = Math.sin(longitudeDelta) * Math.cos(secondLatitude);
  const x =
    Math.cos(firstLatitude) * Math.sin(secondLatitude) -
    Math.sin(firstLatitude) * Math.cos(secondLatitude) * Math.cos(longitudeDelta);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/** Quãng đường cộng dồn tới từng đỉnh của polyline. */
export function buildPathProgress(points) {
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(
      cumulative[index - 1] + haversineMeters(points[index - 1], points[index]),
    );
  }

  return { cumulative, totalMeters: cumulative[cumulative.length - 1] ?? 0 };
}

/**
 * Vị trí trên polyline sau khi đã đi `meters`. Nội suy tuyến tính trong đoạn
 * đang nằm — ở khoảng cách vài chục mét giữa hai đỉnh thì sai số không đáng kể.
 */
export function positionAtDistance(points, cumulative, meters) {
  if (points.length === 0) return null;
  if (points.length === 1) {
    return { ...points[0], headingDeg: 0 };
  }

  const total = cumulative[cumulative.length - 1];
  const clamped = Math.max(0, Math.min(meters, total));

  let index = 1;
  while (index < cumulative.length - 1 && cumulative[index] < clamped) {
    index += 1;
  }

  const start = points[index - 1];
  const end = points[index];
  const segmentMeters = cumulative[index] - cumulative[index - 1];
  const ratio =
    segmentMeters === 0 ? 0 : (clamped - cumulative[index - 1]) / segmentMeters;

  return {
    latitude: start.latitude + (end.latitude - start.latitude) * ratio,
    longitude: start.longitude + (end.longitude - start.longitude) * ratio,
    headingDeg: bearingDegrees(start, end),
  };
}

function readValueArgument(argument, name) {
  const prefix = `--${name}=`;
  return argument.startsWith(prefix) ? argument.slice(prefix.length) : null;
}

function parsePositiveNumber(name, value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return parsed;
}

export function parseArgs(argv) {
  const config = {
    tripId: "",
    speedKmh: 45,
    intervalSeconds: 3,
    startPercent: 0,
    loop: false,
    allowProduction: false,
    help: false,
  };

  for (const argument of argv) {
    if (argument === "--loop") {
      config.loop = true;
      continue;
    }

    if (argument === "--allow-production") {
      config.allowProduction = true;
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

    const speed = readValueArgument(argument, "speed");
    if (speed !== null) {
      config.speedKmh = parsePositiveNumber("speed", speed);
      continue;
    }

    const interval = readValueArgument(argument, "interval");
    if (interval !== null) {
      config.intervalSeconds = parsePositiveNumber("interval", interval);
      continue;
    }

    const startPercent = readValueArgument(argument, "start");
    if (startPercent !== null) {
      const parsed = Number(startPercent);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw new Error("start must be between 0 and 100.");
      }
      config.startPercent = parsed;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!config.help && !config.tripId) {
    throw new Error("Thiếu --trip=<tripId>.");
  }

  return config;
}

export function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function isProductionUrl(value) {
  return PRODUCTION_HOSTS.has(new URL(value).hostname.toLowerCase());
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      payload?.error?.message ??
      payload?.message ??
      `Request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return payload && typeof payload === "object" && "data" in payload
    ? payload.data
    : payload;
}

async function resolveDriverToken(baseUrl) {
  const configuredToken = process.env.VIETRIDE_DRIVER_ACCESS_TOKEN?.trim();
  if (configuredToken) {
    return configuredToken;
  }

  const email = process.env.VIETRIDE_DRIVER_EMAIL?.trim();
  const password = process.env.VIETRIDE_DRIVER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Cần VIETRIDE_DRIVER_ACCESS_TOKEN hoặc cả VIETRIDE_DRIVER_EMAIL và " +
        "VIETRIDE_DRIVER_PASSWORD (tài khoản tài xế được phân công chuyến).",
    );
  }

  const loginData = await requestJson(baseUrl, "/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (typeof loginData?.accessToken !== "string") {
    throw new Error("Login response does not contain an access token.");
  }

  const role = loginData.user?.role;
  if (role !== "DRIVER" && role !== "ASSISTANT") {
    throw new Error(
      `Tài khoản phải là DRIVER hoặc ASSISTANT (đang là ${role ?? "?"}).`,
    );
  }

  return loginData.accessToken;
}

async function loadRoutePoints(baseUrl, accessToken, tripId) {
  const context = await requestJson(
    baseUrl,
    `/v1/tracking/trips/${tripId}/route-geometry`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const points = context?.geometry?.points ?? [];

  if (points.length < 2) {
    throw new Error(
      "Tuyến của chuyến này chưa có lộ trình. Chạy " +
        "`npm run seed:trip-route -- --trip=<tripId> --apply` trước.",
    );
  }

  return points;
}

function connectTrackingSocket(baseUrl, accessToken) {
  const socket = io(baseUrl, {
    path: TRACKING_SOCKET_PATH,
    auth: { token: accessToken },
    transports: ["websocket"],
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("Hết 10s chờ kết nối socket tracking."));
    }, 10_000);

    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      socket.close();
      reject(new Error(`Không kết nối được socket: ${error.message}`));
    });
  });
}

function printHelp() {
  console.log(`
Giả lập xe chạy dọc lộ trình của một chuyến (bắn gps:update như app tài xế).

Usage:
  npm run simulate:trip-gps -- --trip=<tripId> [options]

Options:
  --trip=<tripId>     chuyến cần giả lập (bắt buộc)
  --speed=45          tốc độ km/h (mặc định 45)
  --interval=3        giây giữa hai điểm GPS (mặc định 3)
  --start=0           bắt đầu ở % chiều dài tuyến (mặc định 0)
  --loop              chạy tới đích rồi quay lại đầu tuyến
  --allow-production  bắt buộc khi trỏ vào api.vietride.online
  --help              in hướng dẫn này

Environment (đọc thêm từ .env trong thư mục hiện tại):
  VIETRIDE_SEED_API_BASE_URL      mặc định http://localhost:3000
  VIETRIDE_DRIVER_ACCESS_TOKEN    hoặc VIETRIDE_DRIVER_EMAIL + VIETRIDE_DRIVER_PASSWORD

Ctrl+C để dừng.
`);
}

export async function main(argv = process.argv.slice(2)) {
  const config = parseArgs(argv);
  if (config.help) {
    printHelp();
    return;
  }

  try {
    process.loadEnvFile?.();
  } catch {
    // Không có .env thì đọc từ biến môi trường thật
  }

  const baseUrl = normalizeBaseUrl(
    process.env.VIETRIDE_SEED_API_BASE_URL ||
      process.env.VITE_API_BASE_URL ||
      "http://localhost:3000",
  );

  if (isProductionUrl(baseUrl) && !config.allowProduction) {
    throw new Error(
      "Bắn GPS giả vào production bị chặn. Thêm --allow-production nếu thực sự cố ý.",
    );
  }

  const accessToken = await resolveDriverToken(baseUrl);
  const points = await loadRoutePoints(baseUrl, accessToken, config.tripId);
  const { cumulative, totalMeters } = buildPathProgress(points);
  const metersPerTick = (config.speedKmh / 3.6) * config.intervalSeconds;

  console.log(`API: ${baseUrl}`);
  console.log(
    `Tuyến: ${points.length} điểm · ${(totalMeters / 1000).toFixed(1)} km · ` +
      `${config.speedKmh} km/h · mỗi ${config.intervalSeconds}s`,
  );

  const socket = await connectTrackingSocket(baseUrl, accessToken);
  console.log("Đã kết nối socket tracking. Ctrl+C để dừng.");

  let travelled = (config.startPercent / 100) * totalMeters;
  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    socket.close();
    console.log("\nĐã dừng giả lập.");
  };
  process.on("SIGINT", stop);

  const timer = setInterval(() => {
    const position = positionAtDistance(points, cumulative, travelled);
    const payload = {
      tripId: config.tripId,
      latitude: Number(position.latitude.toFixed(6)),
      longitude: Number(position.longitude.toFixed(6)),
      speedKmh: config.speedKmh,
      headingDeg: Number(position.headingDeg.toFixed(1)),
      recordedAt: new Date().toISOString(),
    };

    socket
      .timeout(5_000)
      .emitWithAck("gps:update", payload)
      .then((ack) => {
        if (ack?.success) {
          const percent = ((travelled / totalMeters) * 100).toFixed(1);
          console.log(
            `${percent.padStart(5)}%  ${payload.latitude}, ${payload.longitude}`,
          );
          return;
        }

        console.error(`gps:update bị từ chối: ${ack?.error ?? "UNKNOWN"}`);
        stop();
      })
      .catch((error) => {
        console.error(`gps:update lỗi: ${error.message}`);
        stop();
      });

    travelled += metersPerTick;
    if (travelled > totalMeters) {
      if (!config.loop) {
        console.log("Đã tới cuối tuyến.");
        stop();
        return;
      }
      travelled = 0;
    }
  }, config.intervalSeconds * 1000);
}

const isExecutedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isExecutedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
