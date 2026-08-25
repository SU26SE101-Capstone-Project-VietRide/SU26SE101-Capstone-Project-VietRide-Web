// Helper hình học + gọi Directions API (Goong) cho màn Routes
import {
  goongDirections,
  type GoongDirectionsRequest,
  type GoongRoute,
} from "../../../lib/goongApi";
import { getGoongApiKey } from "../../../lib/goongConfig";
import {
  decodeGooglePolyline,
  projectPointOntoPolyline,
  type RouteCoordinate,
} from "./polyline";

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceKmBetween(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) {
  const earthRadiusKm = 6371;
  const latDistance = toRadians(second.latitude - first.latitude);
  const lonDistance = toRadians(second.longitude - first.longitude);
  const firstLat = toRadians(first.latitude);
  const secondLat = toRadians(second.latitude);
  const haversine =
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(lonDistance / 2) ** 2;

  return (
    2 *
    earthRadiusKm *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function calculatePathDistance(points: RouteCoordinate[]) {
  return points.slice(1).reduce(
    (total, point, index) => total + distanceKmBetween(points[index], point),
    0,
  );
}

// Phải khớp với RouteGeometryValidator.MaximumWaypointDistanceMeters ở BE.
export const maximumRouteWaypointDistanceKm = 0.5;

export type RouteGeometryWaypoint = RouteCoordinate & {
  id?: string;
  name?: string;
};

export function findRouteGeometryWaypointMismatches(
  path: RouteCoordinate[],
  waypoints: RouteGeometryWaypoint[],
) {
  if (path.length < 2) {
    return [];
  }

  return waypoints
    .map((waypoint) => ({
      waypoint,
      distanceToPathKm: projectPointOntoPolyline(path, waypoint).distanceToPathKm,
    }))
    .filter(({ distanceToPathKm }) => distanceToPathKm > maximumRouteWaypointDistanceKm);
}

// Một phương án đường nhà cung cấp trả về — points đã decode, số liệu đã quy
// đổi km/phút
export type RoadRouteOption = {
  points: RouteCoordinate[];
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  // Mô tả tuyến (vd "qua QL20") — có thể vắng
  description?: string;
};

// Tối đa số phương án hiển thị cho user chọn (thường trả 1-3)
const maxRouteOptions = 3;

// Một phần tử routes[] của Directions → RoadRouteOption; null nếu polyline rỗng
function parseRouteOption(route: GoongRoute): RoadRouteOption | null {
  const points = decodeGooglePolyline(route.encodedPolyline);
  if (points.length < 2) {
    return null;
  }

  return {
    points,
    totalDistanceKm: Number((route.distanceMeters / 1000).toFixed(1)),
    estimatedDurationMinutes: Math.max(
      1,
      Math.round(route.durationSeconds / 60),
    ),
    description: route.summary || undefined,
  };
}

// Loại phương tiện để tính đường: TRUCK (xe khách lớn — mặc định, tránh đường
// cấm/hạn chế xe lớn) hoặc DRIVE (xe nhỏ <16 chỗ). Quy đổi sang `vehicle` của
// Goong ngay tại chỗ gọi API.
export type RouteTravelMode = "DRIVE" | "TRUCK";

// Tùy chọn bổ sung khi tính đường
export type RoadGeometryOptions = {
  // Xin NHIỀU phương án cho user chọn (dãy bubble thời lượng trên bản đồ).
  // Mặc định false: preview lúc kéo nắn và các màn auto-fill chỉ lấy đường tốt
  // nhất, xin thêm phương án chỉ tổ chậm và tốn quota.
  alternatives?: boolean;
  // Điểm nắn lộ trình do user kéo/click trên bản đồ — gửi dạng waypoint `via: true`
  // (đi ngang qua, không tính là điểm dừng) như hành vi kéo đường của Google Maps
  intermediates?: RouteCoordinate[];
  // Mặc định TRUCK — app nhà xe khách, xe lớn là chuẩn
  travelMode?: RouteTravelMode;
};

// Ngưỡng coi lộ trình TRUCK "đi vòng đáng kể" so với DRIVE cùng cặp điểm —
// vượt một trong hai là hiện cảnh báo đường hạn chế xe lớn
const truckDetourKmRatio = 1.1;
const truckDetourExtraMinutes = 10;

// Phương án tốt nhất của một mode = thời lượng ngắn nhất (đề xuất chính của Google
// thường đứng đầu nhưng không đảm bảo — tự chọn min cho chắc)
export function bestRouteOption(options: RoadRouteOption[]): RoadRouteOption {
  return options.reduce((best, option) =>
    option.estimatedDurationMinutes < best.estimatedDurationMinutes
      ? option
      : best,
  );
}

// TRUCK dài hơn đáng kể DRIVE (>10% km hoặc >10 phút, so phương án tốt nhất mỗi
// mode) → đường ngắn nhất có đoạn hạn chế xe lớn, lộ trình đã phải đi vòng
export function isTruckDetour(
  truckOptions: RoadRouteOption[],
  driveOptions: RoadRouteOption[],
): boolean {
  if (truckOptions.length === 0 || driveOptions.length === 0) {
    return false;
  }

  const truck = bestRouteOption(truckOptions);
  const drive = bestRouteOption(driveOptions);

  return (
    truck.totalDistanceKm > drive.totalDistanceKm * truckDetourKmRatio ||
    truck.estimatedDurationMinutes >
      drive.estimatedDurationMinutes + truckDetourExtraMinutes
  );
}

// Ngưỡng coi 2 phương án là "gần trùng" (đôi khi API trả 2 đường lệch không
// đáng kể): lệch km dưới 1% và cùng số phút → bỏ bản đứng sau, đỡ chồng bubble
const duplicateOptionKmRatio = 0.01;

// Lọc phương án gần trùng — giữ bản đứng trước (đề xuất chính của API)
export function dedupeRouteOptions(
  options: RoadRouteOption[],
): RoadRouteOption[] {
  return options.filter(
    (option, index) =>
      !options
        .slice(0, index)
        .some(
          (previous) =>
            Math.abs(option.totalDistanceKm - previous.totalDistanceKm) <
              previous.totalDistanceKm * duplicateOptionKmRatio &&
            option.estimatedDurationMinutes ===
              previous.estimatedDurationMinutes,
        ),
  );
}

// Ngưỡng coi một phương án "trùng ~" một đường có sẵn (vd polyline đã lưu):
// tổng km lệch dưới 1.5% VÀ trung điểm 2 đường cách nhau dưới 2km
const matchingPathKmRatio = 0.015;
const matchingPathMidpointKm = 2;

// Tìm index phương án trùng ~ đường path (polyline đã lưu / đang áp) — -1 nếu không có
export function findMatchingRouteOption(
  options: RoadRouteOption[],
  path: RouteCoordinate[],
): number {
  if (path.length < 2) {
    return -1;
  }

  const pathKm = calculatePathDistance(path);
  const pathMidpoint = path[Math.floor(path.length / 2)];

  return options.findIndex((option) => {
    if (option.points.length < 2) {
      return false;
    }

    const optionKm = calculatePathDistance(option.points);
    const optionMidpoint = option.points[Math.floor(option.points.length / 2)];

    return (
      Math.abs(optionKm - pathKm) / Math.max(pathKm, 0.1) <
        matchingPathKmRatio &&
      distanceKmBetween(pathMidpoint, optionMidpoint) < matchingPathMidpointKm
    );
  });
}

// Lọc BỎ các phương án trùng ~ đường `path` — dùng khi soạn tuyến thay thế:
// phương án trùng tuyến chính đang hiện hành thì không phải "thay thế".
// Cùng ngưỡng với findMatchingRouteOption; path chưa đủ 2 điểm → giữ nguyên.
export function excludeMatchingRouteOptions(
  options: RoadRouteOption[],
  path: RouteCoordinate[],
): RoadRouteOption[] {
  if (path.length < 2) {
    return options;
  }

  return options.filter(
    (option) => findMatchingRouteOption([option], path) === -1,
  );
}

// ── Neo nhãn thời lượng của phương án chưa chọn ───────────────────────────
// Các phương án trả về thường TRÙNG tuyến đang chọn gần hết chiều dài,
// chỉ tách ra một đoạn. Đặt bubble theo tỉ lệ chiều dài (40%/55%/70%) thì rơi
// đúng đoạn trùng → nhìn như đang gắn nhãn cho tuyến chính. Thay vào đó lấy
// điểm TÁCH XA tuyến đang chọn nhất của chính phương án đó làm neo.

// Số điểm lấy mẫu khi quét phương án (polyline có thể vài nghìn điểm)
const labelAnchorSampleCount = 80;
// Số điểm lấy mẫu của đường tham chiếu khi đo khoảng cách
const labelAnchorReferenceSampleCount = 400;
// Bỏ 12% đầu/cuối: hai đầu luôn trùng bến đi/bến đến của mọi phương án
const labelAnchorEdgeSkipRatio = 0.12;
// Dưới ngưỡng này coi như phương án không tách khỏi tuyến đang chọn → không có
// chỗ nào "của riêng nó" để gắn nhãn, nơi gọi tự lùi về vị trí theo tỉ lệ
const labelAnchorMinDivergenceKm = 0.25;
// Hai bubble gần nhau dưới ngưỡng này coi như chồng chỗ — thử điểm tách khác
const labelAnchorSeparationKm = 12;

// Lấy mẫu đều tối đa maxCount điểm (giữ nguyên điểm đầu/cuối)
function samplePath(points: RouteCoordinate[], maxCount: number) {
  if (points.length <= maxCount || maxCount < 2) {
    return points;
  }

  const step = (points.length - 1) / (maxCount - 1);

  return Array.from(
    { length: maxCount },
    (_unused, index) => points[Math.round(index * step)],
  );
}

// Điểm trên `optionPoints` tách xa `referencePoints` nhất — null khi hai đường
// gần như trùng nhau hoặc thiếu dữ liệu. `takenAnchors` là các neo đã cấp cho
// phương án trước: ưu tiên điểm tách đủ xa chúng để 2 bubble không đè nhau.
export function findRouteLabelAnchor(
  optionPoints: RouteCoordinate[],
  referencePoints: RouteCoordinate[],
  takenAnchors: RouteCoordinate[] = [],
): RouteCoordinate | null {
  if (optionPoints.length === 0 || referencePoints.length < 2) {
    return null;
  }

  const reference = samplePath(
    referencePoints,
    labelAnchorReferenceSampleCount,
  );
  const skip = Math.floor(optionPoints.length * labelAnchorEdgeSkipRatio);
  const inner = optionPoints.slice(skip, optionPoints.length - skip);
  const candidates = samplePath(
    inner.length > 0 ? inner : optionPoints,
    labelAnchorSampleCount,
  )
    .map((point) => ({
      point,
      distanceKm: projectPointOntoPolyline(reference, point).distanceToPathKm,
    }))
    .filter(({ distanceKm }) => Number.isFinite(distanceKm))
    .sort((first, second) => second.distanceKm - first.distanceKm);

  if (
    candidates.length === 0 ||
    candidates[0].distanceKm < labelAnchorMinDivergenceKm
  ) {
    return null;
  }

  // Điểm tách xa nhất mà không đụng bubble đã đặt; không có thì đành lấy xa nhất
  const free = candidates.find(({ point }) =>
    takenAnchors.every(
      (anchor) =>
        distanceKmBetween(anchor, point) >= labelAnchorSeparationKm,
    ),
  );

  return (free ?? candidates[0]).point;
}

/**
 * Gọi Directions Goong → trả MẢNG phương án (tối đa 3, phần tử đầu là đề xuất
 * chính). Luôn có ít nhất 1 phần tử, ngược lại throw `errorMessage`.
 * Nhiều hơn 1 phương án chỉ có khi `opts.alternatives` bật.
 */
// ── Tự sinh phương án đường thay thế ──────────────────────────────────────
// Google Routes có `computeAlternativeRoutes` trả sẵn 2-3 corridor khác nhau.
// Goong KHÔNG có: đã probe thật `alternatives=true` trên HCM–Đà Lạt/Vũng Tàu/
// Cần Thơ/Nha Trang và HN–Hải Phòng, cả `car` lẫn `truck` — luôn đúng 1 đường
// (dạng số kiểu OSRM thì Goong trả về không phải JSON).
//
// Nên dãy bubble chọn đường được dựng lại bằng cách ÉP đường đi vòng: lấy vài
// điểm nằm lệch sang hai bên tuyến chính rồi hỏi lại đường qua đó. Kết quả vẫn
// là đường bộ thật của Goong, chỉ khác corridor. Bản nào trùng tuyến chính hoặc
// vòng quá đáng thì loại ngay tại đây.

// Vị trí (theo tỉ lệ chiều dài tuyến) đặt điểm thử lệch. Tránh hai đầu vì mọi
// phương án đều chụm về bến đi/bến đến.
const detourProbeFractions = [0.35, 0.65];
// Độ lệch sang bên, tính theo % chiều dài tuyến rồi kẹp trong [5, 30] km:
// lệch ít quá thì Goong trả lại đúng tuyến chính, nhiều quá thì ra đường vô lý.
const detourOffsetRatio = 0.08;
const minDetourOffsetKm = 5;
const maxDetourOffsetKm = 30;
// Phương án dài/lâu hơn tuyến chính quá ngưỡng này thì không đáng đề xuất
const maxDetourDistanceRatio = 1.5;
const maxDetourDurationRatio = 1.5;

const kmPerLatitudeDegree = 111.32;

/**
 * Điểm nằm lệch `offsetKm` vuông góc với hướng đi của tuyến tại vị trí
 * `fraction`. `side` = +1/-1 cho hai bên. Null khi không xác định được hướng.
 */
function offsetAcrossPath(
  path: RouteCoordinate[],
  fraction: number,
  offsetKm: number,
  side: 1 | -1,
): RouteCoordinate | null {
  if (path.length < 2) {
    return null;
  }

  const index = Math.min(
    path.length - 1,
    Math.max(0, Math.round((path.length - 1) * fraction)),
  );
  const anchor = path[index];
  // Lấy hướng trên một đoạn ngắn quanh điểm neo cho đỡ nhiễu bởi khúc cua lẻ
  const window = Math.max(1, Math.round(path.length * 0.02));
  const before = path[Math.max(0, index - window)];
  const after = path[Math.min(path.length - 1, index + window)];

  const latScale = Math.cos(toRadians(anchor.latitude));
  const eastward = (after.longitude - before.longitude) * latScale;
  const northward = after.latitude - before.latitude;
  const length = Math.hypot(eastward, northward);
  if (length === 0) {
    return null;
  }

  // Vector vuông góc (quay 90°) đã chuẩn hoá
  const perpendicularEast = -northward / length;
  const perpendicularNorth = eastward / length;

  return {
    latitude:
      anchor.latitude +
      side * perpendicularNorth * (offsetKm / kmPerLatitudeDegree),
    longitude:
      anchor.longitude +
      side *
        perpendicularEast *
        (offsetKm / (kmPerLatitudeDegree * (latScale || 1))),
  };
}

/** Bộ điểm thử lệch hai bên tuyến chính. */
function buildDetourProbes(primary: RoadRouteOption): RouteCoordinate[] {
  const offsetKm = Math.min(
    maxDetourOffsetKm,
    Math.max(minDetourOffsetKm, primary.totalDistanceKm * detourOffsetRatio),
  );

  return detourProbeFractions
    .flatMap((fraction) =>
      ([1, -1] as const).map((side) =>
        offsetAcrossPath(primary.points, fraction, offsetKm, side),
      ),
    )
    .filter((point): point is RouteCoordinate => point !== null);
}

/** Loại phương án vòng quá đáng so với tuyến chính. */
function isReasonableDetour(option: RoadRouteOption, primary: RoadRouteOption) {
  return (
    option.totalDistanceKm <=
      primary.totalDistanceKm * maxDetourDistanceRatio &&
    option.estimatedDurationMinutes <=
      primary.estimatedDurationMinutes * maxDetourDurationRatio
  );
}

export async function requestRoadGeometry(
  points: RouteCoordinate[],
  errorMessage: string,
  opts?: RoadGeometryOptions,
): Promise<RoadRouteOption[]> {
  if (!getGoongApiKey() || points.length < 2) {
    throw new Error(errorMessage);
  }

  const toLatLng = (point: RouteCoordinate) => ({
    lat: point.latitude,
    lng: point.longitude,
  });
  const stopWaypoints = points.slice(1, -1).map(toLatLng);
  const viaWaypoints = (opts?.intermediates ?? []).map(toLatLng);
  const request: GoongDirectionsRequest = {
    // Vẫn gửi cờ cho Goong: hiện họ luôn trả 1 đường, nhưng nếu sau này bật thì
    // ta nhận phương án THẬT và bỏ qua hẳn phần tự sinh bên dưới.
    alternatives: opts?.alternatives ?? false,
    destination: toLatLng(points[points.length - 1]),
    origin: toLatLng(points[0]),
    vehicle: opts?.travelMode === "DRIVE" ? "car" : "truck",
    // Điểm dừng của tuyến đứng trước, rồi tới điểm nắn lộ trình — Goong đi
    // waypoint theo đúng thứ tự mảng (flow nắn đường thực tế chỉ dùng khi
    // tuyến chưa có điểm dừng nên hai nhóm không chen nhau)
    waypoints: [...stopWaypoints, ...viaWaypoints],
  };

  let routes: GoongRoute[];
  try {
    routes = await goongDirections(request);
  } catch {
    throw new Error(errorMessage);
  }

  const options = routes
    .map(parseRouteOption)
    .filter((option): option is RoadRouteOption => option !== null)
    .slice(0, maxRouteOptions);

  if (options.length === 0) {
    throw new Error(errorMessage);
  }

  // Chỉ dựng phương án thay thế cho tuyến TRẦN (chưa có điểm dừng / điểm nắn):
  // có waypoint rồi thì đường đã bị ghim, ép vòng thêm chỉ ra lộ trình vô nghĩa
  // — đúng như hồi Google cũng không trả alternative trong trường hợp đó.
  const wantsAlternatives =
    (opts?.alternatives ?? false) && stopWaypoints.length === 0 && viaWaypoints.length === 0;
  if (!wantsAlternatives || options.length >= maxRouteOptions) {
    return options;
  }

  const primary = options[0];
  const detours = await Promise.all(
    buildDetourProbes(primary).map((probe) =>
      goongDirections({ ...request, waypoints: [toLatLng(probe)] })
        .then((detourRoutes) => detourRoutes.map(parseRouteOption))
        .catch(() => []),
    ),
  );

  const candidates = detours
    .flat()
    .filter((option): option is RoadRouteOption => option !== null)
    .filter((option) => isReasonableDetour(option, primary));

  // Bỏ bản trùng tuyến chính, rồi bỏ các bản gần trùng nhau — cùng ngưỡng với
  // lúc Google trả nhiều phương án nên UI không phải phân biệt nguồn gốc.
  return dedupeRouteOptions([
    ...options,
    ...excludeMatchingRouteOptions(candidates, primary.points),
  ]).slice(0, maxRouteOptions);
}

// ---------------------------------------------------------------------------
// KÉO NẮN: tính lại ĐÚNG CHẶNG đang nắn rồi ghép vào đường thật
// ---------------------------------------------------------------------------
// Không được vẽ đoạn thẳng trong lúc kéo — đường luôn phải bám mặt
// đường, chỉ có chấm trắng chạy theo tay. Muốn vậy thì preview cũng phải là
// đường bộ thật, nên nó phải VỀ NHANH: thay vì tính lại cả tuyến (origin →
// mọi điểm dừng → destination) mỗi nhịp kéo, chỉ tính lại chặng giữa hai "mỏ
// neo" kề điểm đang kéo rồi ghép hình đường trả về vào đúng chỗ đó.
// Request 2 waypoint + 1 via về nhanh hơn hẳn cả tuyến, và cũng rẻ hơn.

// Chỉ số đỉnh gần `point` nhất trên `path`. Dùng bình phương khoảng cách theo độ
// (lng nhân cos(lat) để bù méo kinh tuyến) — chỉ cần so sánh tương đối nên không
// cần haversine, path có thể tới hàng nghìn đỉnh và hàm này chạy mỗi lượt kéo.
export function findNearestPathIndex(
  path: RouteCoordinate[],
  point: RouteCoordinate,
) {
  const lngScale = Math.cos(toRadians(point.latitude));
  let bestIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;

  path.forEach((vertex, index) => {
    const latDelta = vertex.latitude - point.latitude;
    const lngDelta = (vertex.longitude - point.longitude) * lngScale;
    const score = latDelta * latDelta + lngDelta * lngDelta;

    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

export type PathAnchorWindow = {
  previousIndex: number;
  nextIndex: number;
};

// Khoảng [previousIndex, nextIndex] trên `path` cần tính lại khi kéo điểm tại
// `seed`. Mỏ neo = điểm dừng của tuyến + các điểm nắn KHÁC; hai đầu đường luôn
// là mỏ neo ngầm. Mỏ neo rơi trúng đúng đỉnh của seed bị bỏ qua — không thì
// cửa sổ co về rỗng và không còn gì để tính lại.
export function findPathAnchorWindow(
  path: RouteCoordinate[],
  anchors: RouteCoordinate[],
  seed: RouteCoordinate,
): PathAnchorWindow | null {
  if (path.length < 2) {
    return null;
  }

  const lastIndex = path.length - 1;
  const seedIndex = findNearestPathIndex(path, seed);

  if (seedIndex < 0) {
    return null;
  }

  let previousIndex = 0;
  let nextIndex = lastIndex;

  anchors.forEach((anchor) => {
    const anchorIndex = findNearestPathIndex(path, anchor);

    if (anchorIndex < 0 || anchorIndex === seedIndex) {
      return;
    }

    if (anchorIndex < seedIndex && anchorIndex > previousIndex) {
      previousIndex = anchorIndex;
    }

    if (anchorIndex > seedIndex && anchorIndex < nextIndex) {
      nextIndex = anchorIndex;
    }
  });

  return { previousIndex, nextIndex };
}

// Thay đoạn [previousIndex, nextIndex] của `path` bằng hình đường mới `segment`.
// `segment` do Directions trả về khi tính chặng path[previousIndex] → path[nextIndex]
// nên hai đầu đã trùng sẵn — ghép xong đường liền mạch, không có mối nối gãy.
export function splicePathSegment(
  path: RouteCoordinate[],
  { previousIndex, nextIndex }: PathAnchorWindow,
  segment: RouteCoordinate[],
): RouteCoordinate[] {
  if (segment.length === 0) {
    return path;
  }

  return [
    ...path.slice(0, previousIndex),
    ...segment,
    ...path.slice(nextIndex + 1),
  ];
}
