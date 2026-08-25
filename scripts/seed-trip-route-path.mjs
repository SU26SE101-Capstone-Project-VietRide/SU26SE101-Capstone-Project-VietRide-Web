// Vá lộ trình (pathPolyline) cho tuyến của các chuyến đang chạy để test bản đồ
// Trung tâm vận hành.
//
// Bản đồ chỉ vẽ được tuyến khi Route có pathPolyline: endpoint
// `GET /v1/tracking/trips/{tripId}/route-geometry` trả `geometry: null` khi
// tuyến chưa lưu đường, và contract cấm client nối bến/điểm dừng thành tuyến
// giả. Script này lấy đúng dãy bến + điểm dừng của chuyến, hỏi Goong Direction
// đường bộ đi qua chúng rồi lưu polyline vào tuyến qua API sẵn có.
//
// Chạy khô mặc định — phải có --apply mới ghi.
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const PRODUCTION_HOSTS = new Set(["api.vietride.online"]);

// Trần waypoint mỗi lần gọi Directions. Không lấy mẫu bớt: BE bắt buộc MỌI
// bến/điểm dừng phải nằm trong 500 m quanh polyline (RouteGeometryValidator),
// bỏ điểm nào là lưu sẽ bị từ chối ROUTE_GEOMETRY_STOP_MISMATCH.
const MAX_WAYPOINTS = 25;

const GOONG_REST_BASE_URL =
  process.env.VITE_GOONG_REST_BASE_URL?.trim() || "https://rsapi.goong.io";

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
    apply: false,
    allowProduction: false,
    force: false,
    help: false,
    tripId: "",
    travelMode: "TRUCK",
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

    if (argument === "--force") {
      config.force = true;
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

    const travelMode = readValueArgument(argument, "travel-mode");
    if (travelMode !== null) {
      if (travelMode !== "TRUCK" && travelMode !== "DRIVE") {
        throw new Error("travel-mode must be TRUCK or DRIVE.");
      }
      config.travelMode = travelMode;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
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

/**
 * Bến đi → điểm dừng (theo sequence) → bến đến của một chuyến, lấy từ response
 * route-geometry. Cùng thứ tự mà bản đồ dùng để vẽ, nên polyline tính ra chắc
 * chắn đi qua đủ waypoint mà BE sẽ kiểm.
 */
export function buildWaypoints(routeContext) {
  const waypoints = [];
  const origin = routeContext?.originStation;
  if (origin) {
    waypoints.push({
      name: origin.name,
      latitude: origin.latitude,
      longitude: origin.longitude,
    });
  }

  for (const stop of [...(routeContext?.intermediateStops ?? [])].sort(
    (left, right) => left.sequence - right.sequence,
  )) {
    waypoints.push({
      name: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
    });
  }

  const destination = routeContext?.destinationStation;
  if (destination) {
    waypoints.push({
      name: destination.name,
      latitude: destination.latitude,
      longitude: destination.longitude,
    });
  }

  return waypoints;
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
      throw new ApiError("Server returned invalid JSON.", response.status);
    }
  }

  if (!response.ok) {
    const details = errorDetails(payload);
    throw new ApiError(
      details.message || `Request failed with status ${response.status}.`,
      response.status,
      details.code,
    );
  }

  return unwrapData(payload);
}

async function resolveAccessToken(baseUrl) {
  const configuredToken = process.env.VIETRIDE_SEED_ACCESS_TOKEN?.trim();
  if (configuredToken) {
    return configuredToken;
  }

  const email = process.env.VIETRIDE_SEED_ADMIN_EMAIL?.trim();
  const password = process.env.VIETRIDE_SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Cần VIETRIDE_SEED_ACCESS_TOKEN hoặc cả VIETRIDE_SEED_ADMIN_EMAIL và " +
        "VIETRIDE_SEED_ADMIN_PASSWORD.",
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

  if (loginData.user?.role !== "OPERATOR_ADMIN") {
    throw new Error("Tài khoản seed phải là OPERATOR_ADMIN.");
  }

  return loginData.accessToken;
}

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function loadLiveTrips(baseUrl, accessToken) {
  const trips = [];

  for (const status of ["IN_PROGRESS", "DISRUPTED"]) {
    const query = new URLSearchParams({
      status,
      page: "1",
      pageSize: "100",
    });
    const data = await requestJson(
      baseUrl,
      `/v1/operator/trips?${query.toString()}`,
      { headers: authHeaders(accessToken) },
    );
    for (const item of data?.items ?? []) {
      if (!trips.some((trip) => trip.tripId === item.tripId)) {
        trips.push(item);
      }
    }
  }

  return trips;
}

function getRouteContext(baseUrl, accessToken, tripId) {
  return requestJson(baseUrl, `/v1/tracking/trips/${tripId}/route-geometry`, {
    headers: authHeaders(accessToken),
  });
}

function putRouteGeometry(baseUrl, accessToken, routeId, pathPolyline) {
  return requestJson(baseUrl, `/v1/operator/routes/${routeId}/geometry`, {
    method: "PUT",
    headers: {
      ...authHeaders(accessToken),
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({ pathPolyline }),
  });
}

function toRouteCoordinate(point) {
  return `${point.latitude},${point.longitude}`;
}

function sumLegMetric(legs, field) {
  if (!Array.isArray(legs)) {
    return 0;
  }

  return legs.reduce((total, leg) => {
    const value = leg?.[field]?.value;
    return typeof value === "number" ? total + value : total;
  }, 0);
}

// Trả về { encodedPolyline, distanceKm, durationMinutes } cho đường bộ đi qua
// lần lượt toàn bộ waypoint. Dùng Direction của Goong — response theo đúng
// format Google (routes[].legs[].distance.value, overview_polyline.points).
export async function computeRoadPolyline(waypoints, apiKey, travelMode) {
  const url = new URL(`${GOONG_REST_BASE_URL}/Direction`);
  url.searchParams.set("origin", toRouteCoordinate(waypoints[0]));
  // Goong không có tham số waypoints riêng: điểm dừng đi chung `destination`,
  // ngăn bằng `;`, phần tử cuối là bến đến.
  url.searchParams.set(
    "destination",
    waypoints.slice(1).map(toRouteCoordinate).join(";"),
  );
  // CLI giữ nguyên TRUCK/DRIVE cho quen tay; Goong nhận truck/car
  url.searchParams.set("vehicle", travelMode === "DRIVE" ? "car" : "truck");
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url);
  const body = await response.json().catch(() => null);

  if (!response.ok || !Array.isArray(body?.routes) || body.routes.length === 0) {
    const detail =
      body?.error?.message ?? `Goong Direction trả về ${response.status}.`;
    throw new Error(detail);
  }

  const route = body.routes[0];
  const encodedPolyline = route?.overview_polyline?.points;
  if (typeof encodedPolyline !== "string" || !encodedPolyline) {
    throw new Error("Goong Direction không trả về polyline.");
  }

  const distanceMeters = sumLegMetric(route.legs, "distance");
  const durationSeconds = sumLegMetric(route.legs, "duration");

  return {
    encodedPolyline,
    distanceKm: Number((distanceMeters / 1000).toFixed(1)),
    durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
  };
}

function printHelp() {
  console.log(`
Vá lộ trình (pathPolyline) cho tuyến của các chuyến đang chạy — để bản đồ Trung
tâm vận hành vẽ được nguyên tuyến và vị trí xe trên tuyến đó.

Usage:
  npm run seed:trip-route
  npm run seed:trip-route -- --apply [options]

Options:
  --trip=<tripId>        chỉ xử lý một chuyến (mặc định: mọi chuyến IN_PROGRESS + DISRUPTED)
  --force                ghi đè cả khi tuyến ĐÃ có lộ trình
  --travel-mode=TRUCK    TRUCK (mặc định, xe khách lớn) hoặc DRIVE
  --apply                ghi thật; không có thì chỉ in kế hoạch
  --allow-production     bắt buộc kèm --apply khi trỏ vào api.vietride.online
  --help                 in hướng dẫn này

Environment (đọc thêm từ .env trong thư mục hiện tại):
  VIETRIDE_SEED_API_BASE_URL     mặc định http://localhost:3000
  VIETRIDE_SEED_ACCESS_TOKEN     hoặc VIETRIDE_SEED_ADMIN_EMAIL + VIETRIDE_SEED_ADMIN_PASSWORD
  VIETRIDE_GOONG_API_KEY         hoặc VITE_GOONG_API_KEY

Lưu ý:
  - Chuyến đang chạy theo LỘ TRÌNH THAY THẾ lấy polyline của alternative route;
    script này chỉ ghi vào tuyến chính nên hãy sửa lộ trình thay thế trong màn
    "Tuyến & điểm dừng".
  - BE bắt mọi bến/điểm dừng phải nằm trong 500 m quanh polyline, nên tuyến quá
    ${MAX_WAYPOINTS} waypoint bị bỏ qua thay vì lấy mẫu bớt.
`);
}

async function planTrip(baseUrl, accessToken, trip, force) {
  const label = `${trip.route.name || `${trip.route.originName} - ${trip.route.destinationName}`} · ${trip.vehicle.licensePlate}`;

  let routeContext;
  try {
    routeContext = await getRouteContext(baseUrl, accessToken, trip.tripId);
  } catch (error) {
    return { trip, label, action: "fail", reason: error.message };
  }

  if (routeContext?.geometry && !force) {
    return { trip, label, action: "skip", reason: "tuyến đã có lộ trình" };
  }

  const waypoints = buildWaypoints(routeContext);
  if (waypoints.length < 2) {
    return {
      trip,
      label,
      action: "fail",
      reason: "thiếu toạ độ bến đi/bến đến",
    };
  }

  if (waypoints.length > MAX_WAYPOINTS) {
    return {
      trip,
      label,
      action: "fail",
      reason: `${waypoints.length} waypoint, vượt hạn mức ${MAX_WAYPOINTS}`,
    };
  }

  return { trip, label, action: "write", routeContext, waypoints };
}

export async function main(argv = process.argv.slice(2)) {
  const config = parseArgs(argv);
  if (config.help) {
    printHelp();
    return;
  }

  // Node >= 20.12: nạp .env cạnh package.json để dùng chung key Goong với FE
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
  const apiKey = (
    process.env.VIETRIDE_GOONG_API_KEY ||
    process.env.VITE_GOONG_API_KEY ||
    ""
  ).trim();
  if (!apiKey) {
    throw new Error(
      "Thiếu VIETRIDE_GOONG_API_KEY (hoặc VITE_GOONG_API_KEY).",
    );
  }

  console.log(`Mode: ${config.apply ? "APPLY" : "DRY RUN"}`);
  console.log(`API: ${baseUrl}`);

  if (config.apply && isProductionUrl(baseUrl) && !config.allowProduction) {
    throw new Error(
      "Ghi vào production bị chặn. Kiểm tra lại đích rồi thêm --allow-production " +
        "nếu thực sự cố ý.",
    );
  }

  const accessToken = await resolveAccessToken(baseUrl);
  const allTrips = await loadLiveTrips(baseUrl, accessToken);
  const trips = config.tripId
    ? allTrips.filter((trip) => trip.tripId === config.tripId)
    : allTrips;

  if (trips.length === 0) {
    console.log(
      config.tripId
        ? `Không thấy chuyến ${config.tripId} trong danh sách đang chạy.`
        : "Không có chuyến IN_PROGRESS/DISRUPTED nào.",
    );
    return;
  }

  const plans = [];
  for (const trip of trips) {
    plans.push(await planTrip(baseUrl, accessToken, trip, config.force));
  }

  console.table(
    plans.map((plan) => ({
      tripId: plan.trip.tripId,
      trip: plan.label,
      action: plan.action,
      waypoints: plan.waypoints?.length ?? "-",
      reason: plan.reason ?? "",
    })),
  );

  if (!config.apply) {
    console.log("Chưa ghi gì. Thêm --apply để lưu lộ trình.");
    return;
  }

  const summary = { written: 0, skipped: 0, failed: 0 };
  for (const plan of plans) {
    if (plan.action === "skip") {
      summary.skipped += 1;
      continue;
    }

    if (plan.action === "fail") {
      summary.failed += 1;
      console.error(`FAIL ${plan.label}: ${plan.reason}`);
      continue;
    }

    try {
      const road = await computeRoadPolyline(
        plan.waypoints,
        apiKey,
        config.travelMode,
      );
      await putRouteGeometry(
        baseUrl,
        accessToken,
        plan.trip.route.routeId,
        road.encodedPolyline,
      );
      summary.written += 1;
      console.log(
        `OK   ${plan.label}: ${road.distanceKm} km · ${road.durationMinutes} phút ` +
          `· ${plan.waypoints.length} waypoint`,
      );
    } catch (error) {
      summary.failed += 1;
      console.error(
        `FAIL ${plan.label}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  console.log(
    `Done: ${summary.written} tuyến đã lưu lộ trình, ${summary.skipped} bỏ qua, ` +
      `${summary.failed} lỗi.`,
  );
  console.log(
    "Mở lại Trung tâm vận hành và chọn chuyến để thấy tuyến vẽ trên bản đồ.",
  );

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

const isExecutedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isExecutedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
