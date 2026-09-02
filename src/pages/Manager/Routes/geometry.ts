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

// Ngưỡng KHUYẾN CÁO, tách hẳn khỏi ngưỡng cứng bên trên (không được hạ ngưỡng
// cứng: nó phải khớp BE, hạ là FE chặn lưu những tuyến BE vẫn nhận).
//
// Directions snap mỗi điểm về đỉnh đường gần nhất trong đồ thị của nó. Đo thật
// trên khu Phú Nhuận: điểm gửi đi 10.7880,106.6720 bị snap sang 10.79065,
// 106.66662 — lệch 660m, rơi vào một trục khác hẳn, và lộ trình trả về luồn
// Đặng Văn Ngữ → Hoàng Diệu → Trương Quốc Dụng kèm một cú quay đầu để chạm cho
// được chỗ đó.
//
// Dưới ~150m thì lệch chỉ là bề ngang lòng đường, sai số geocode, hoặc toạ độ
// POI trỏ vào giữa toà nhà thay vì mặt tiền — đường đi không đổi. Trên mức đó
// thì bộ định tuyến buộc phải bám một con đường KHÁC để tới nơi, và trong ô phố
// dày đặc thì "đường khác" đó là hẻm. 500m của ngưỡng cứng quá rộng để cảnh báo
// sớm: lệch 400m vẫn lọt mà đã đủ ép đường vòng qua mấy dãy phố.
export const advisoryRouteWaypointDistanceKm = 0.15;

export type RouteGeometryWaypoint = RouteCoordinate & {
  id?: string;
  name?: string;
};

export function findRouteGeometryWaypointMismatches(
  path: RouteCoordinate[],
  waypoints: RouteGeometryWaypoint[],
  // Mặc định là ngưỡng CỨNG (chặn lưu). Truyền
  // `advisoryRouteWaypointDistanceKm` để lấy danh sách cảnh báo sớm lúc đang
  // soạn, trước khi user bấm Lưu rồi mới biết.
  thresholdKm: number = maximumRouteWaypointDistanceKm,
) {
  if (path.length < 2) {
    return [];
  }

  return waypoints
    .map((waypoint) => ({
      waypoint,
      distanceToPathKm: projectPointOntoPolyline(path, waypoint).distanceToPathKm,
    }))
    .filter(({ distanceToPathKm }) => distanceToPathKm > thresholdKm);
}

// Một phương án đường nhà cung cấp trả về — points đã decode, số liệu đã quy
// đổi km/phút
export type RoadRouteOption = {
  points: RouteCoordinate[];
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  // Mô tả tuyến (vd "qua QL20") — có thể vắng
  description?: string;
  // Số lần phải quay đầu, do Goong khai báo (xem GoongRoute.uTurnCount).
  // Vắng = không có thông tin, coi như không quay đầu.
  uTurnCount?: number;
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
    uTurnCount: route.uTurnCount,
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
  /**
   * Đường ĐANG hiển thị, dùng để xếp `intermediates` vào đúng chỗ giữa các điểm
   * dừng (xem `interleaveViaWaypoints`). Vắng thì lấy tạm đường gấp khúc nối
   * các điểm dừng — kém chính xác hơn nhưng vẫn hơn hẳn việc dồn hết xuống cuối.
   */
  referencePath?: RouteCoordinate[];
};

/**
 * Trộn điểm nắn vào danh sách điểm dừng theo ĐÚNG THỨ TỰ CHẠY.
 *
 * Trước đây điểm nắn bị nối thẳng vào sau toàn bộ điểm dừng. Với tuyến chưa có
 * điểm dừng thì vô hại, nhưng tuyến đã có điểm dừng thì thành ra bắt xe chạy hết
 * mọi điểm dừng rồi mới vòng ngược lại chỗ vừa kéo — lộ trình chốt khác hẳn cái
 * người dùng vừa thấy lúc kéo (lúc kéo chỉ tính lại chặng giữa hai điểm dừng kề
 * nên nó đúng thứ tự).
 *
 * Thứ tự các điểm DỪNG giữ nguyên như user khai báo — chỉ chèn điểm nắn vào khe
 * giữa chúng, dựa trên quãng đường từ đầu tuyến tới hình chiếu của từng điểm.
 */
export function interleaveViaWaypoints(
  stops: RouteCoordinate[],
  vias: RouteCoordinate[],
  reference: RouteCoordinate[],
): RouteCoordinate[] {
  if (vias.length === 0) {
    return stops;
  }

  if (stops.length === 0 || reference.length < 2) {
    return [...stops, ...vias];
  }

  const markOf = (point: RouteCoordinate) =>
    projectPointOntoPolyline(reference, point).distanceFromStartKm;
  const stopMarks = stops.map(markOf);
  const placed = vias
    .map((point) => ({ mark: markOf(point), point }))
    .sort((first, second) => first.mark - second.mark);

  const ordered: RouteCoordinate[] = [];
  let cursor = 0;

  stops.forEach((stop, index) => {
    while (cursor < placed.length && placed[cursor].mark <= stopMarks[index]) {
      ordered.push(placed[cursor].point);
      cursor += 1;
    }

    ordered.push(stop);
  });

  return [...ordered, ...placed.slice(cursor).map((entry) => entry.point)];
}

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
// tổng km lệch dưới 1.5% VÀ toàn bộ hành lang đường không lệch quá 2km.
const matchingPathKmRatio = 0.015;
const matchingPathMaxDivergenceKm = 2;
const matchingPathSampleCount = 400;

function maxSampledPathDivergenceKm(
  source: RouteCoordinate[],
  reference: RouteCoordinate[],
) {
  const sampledSource = samplePath(source, matchingPathSampleCount);
  const sampledReference = samplePath(reference, matchingPathSampleCount);

  return sampledSource.reduce(
    (maximum, point) =>
      Math.max(
        maximum,
        projectPointOntoPolyline(sampledReference, point).distanceToPathKm,
      ),
    0,
  );
}

// Tìm index phương án trùng ~ đường path (polyline đã lưu / đang áp) — -1 nếu không có
export function findMatchingRouteOption(
  options: RoadRouteOption[],
  path: RouteCoordinate[],
): number {
  if (path.length < 2) {
    return -1;
  }

  const pathKm = calculatePathDistance(path);

  return options.findIndex((option) => {
    if (option.points.length < 2) {
      return false;
    }

    const optionKm = calculatePathDistance(option.points);
    if (
      Math.abs(optionKm - pathKm) / Math.max(pathKm, 0.1) >=
      matchingPathKmRatio
    ) {
      return false;
    }

    // Đo cả hai chiều để bắt được trường hợp một polyline có thêm nhánh
    // ngắn mà chiều ngược lại (option → path) không đi qua đúng đoạn đó.
    const maxDivergenceKm = Math.max(
      maxSampledPathDivergenceKm(option.points, path),
      maxSampledPathDivergenceKm(path, option.points),
    );

    return maxDivergenceKm < matchingPathMaxDivergenceKm;
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
// Độ lệch sang bên, tính theo % chiều dài tuyến. Tuyến ngắn/đô thị dùng sàn
// thấp hơn: ép lệch 5km trên hành trình 30-50km thường đẩy waypoint quá xa,
// khiến mọi detour hợp lệ bị trần 1.5x loại sạch.
const detourOffsetRatio = 0.08;
const shortRouteThresholdKm = 100;
const shortRouteMinDetourOffsetKm = 2;
const longRouteMinDetourOffsetKm = 5;
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
  const minOffsetKm =
    primary.totalDistanceKm < shortRouteThresholdKm
      ? shortRouteMinDetourOffsetKm
      : longRouteMinDetourOffsetKm;
  const offsetKm = Math.min(
    maxDetourOffsetKm,
    Math.max(minOffsetKm, primary.totalDistanceKm * detourOffsetRatio),
  );

  return detourProbeFractions
    .flatMap((fraction) =>
      ([1, -1] as const).map((side) =>
        offsetAcrossPath(primary.points, fraction, offsetKm, side),
      ),
    )
    .filter((point): point is RouteCoordinate => point !== null);
}

// ── Loại phương án đâm vào đường cụt ──────────────────────────────────────
// Điểm thử lệch được gửi cho Goong như một ĐIỂM ĐẾN trung gian (API Direction
// nối origin → waypoint → destination), KHÔNG phải điểm "đi ngang qua". Nên khi
// nó rơi trúng hẻm cụt / đường nội bộ — mà nó rơi mù quáng theo hình học, không
// ai bảo đảm chỗ đó có đường tử tế — xe buộc phải chui vào tới nơi rồi quay đầu
// ra bằng đúng lối cũ.
//
// Ngưỡng tỉ lệ bên dưới không bắt được kiểu này: một cú chui hẻm 2km trên tuyến
// 900km chỉ làm tổng quãng đường nhích 0.2%, lọt ngưỡng 1.5 lần quá dễ. Dấu
// hiệu không nằm ở SỐ KM mà ở HÌNH đường — đoạn quay ra đi lại đúng chỗ vừa đi
// qua. Tuyến A→B hợp lệ không lặp lại điểm nào trên mặt đường, nên chỉ cần tìm
// hai điểm sát nhau về không gian mà cách nhau xa dọc theo đường.

// Hai điểm cách nhau dưới ngưỡng này (~80m) coi như cùng một chỗ trên mặt
// đường: đủ rộng để khớp hai chiều của một đường đôi, đủ hẹp để hai con đường
// song song khác nhau không bị gộp làm một
const revisitProximityKm = 0.08;
// ...và phải cách nhau ít nhất chừng này DỌC THEO ĐƯỜNG mới tính là quay đầu;
// dưới mức đó chỉ là khúc cua gấp, vòng xuyến hay nhánh lên cầu vượt
const revisitMinPathGapKm = 0.5;
// Đi lặp quá chừng này (tức hẻm sâu ~600m, vào và ra) thì chắc chắn là chui vào
// rồi quay đầu chứ không phải một corridor thay thế
const maxRetracedSpanKm = 1.2;
// Ngoài tỉ lệ còn chặn theo số km tuyệt đối: trên tuyến liên tỉnh 900km thì
// ngưỡng 1.5 lần cho phép dôi ra 450km — rộng tới mức không còn là hàng rào
const maxDetourExtraKm = 120;
// Trần số lần hỏi lại đường ở tầng chữa. Mỗi lần là một request Goong nữa, nên
// tầng này chỉ chạy khi tầng 1 CHƯA đủ phương án — xem `stillNeeded` bên dưới.
// Để 4 (chữa hết bản hỏng) vì đo thật cho thấy chặn ở 2 là mất trắng phương án:
// HCM–Vũng Tàu có 4 bản thô hỏng cả 4, chữa 2 bản đầu vẫn ra 0, chữa hết mới ra
// 2 phương án sạch (−1.5km và +3.0km, không quay đầu, không đi lại).
const maxRefinedDetours = 4;

/**
 * Chiều dài khúc "đi vào rồi quay đầu ra" DÀI NHẤT của một đường, tính bằng km
 * dọc theo đường — hẻm cụt sâu 600m cho ra ~1.2km vì tính cả lượt vào lẫn lượt
 * ra. Trả 0 khi đường không lặp lại chỗ nào.
 *
 * Chia điểm vào lưới ô vuông cỡ `revisitProximityKm` rồi chỉ so với 8 ô kề:
 * polyline có thể vài nghìn đỉnh nên so từng cặp (O(n²) haversine) là đủ chậm
 * để thấy được khi bấm tính đường.
 */
export function longestRetracedSpanKm(points: RouteCoordinate[]) {
  if (points.length < 3) {
    return 0;
  }

  const cumulative: number[] = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(
      cumulative[index - 1] +
        distanceKmBetween(points[index - 1], points[index]),
    );
  }

  const latCell = revisitProximityKm / kmPerLatitudeDegree;
  // Kẹp sàn cho cos(lat) phòng vĩ độ cực — ô lưới phình ra còn hơn chia cho 0
  const latScale = Math.max(0.1, Math.cos(toRadians(points[0].latitude)));
  const lngCell = latCell / latScale;

  const buckets = new Map<string, number[]>();
  let longest = 0;

  points.forEach((point, index) => {
    const latBucket = Math.floor(point.latitude / latCell);
    const lngBucket = Math.floor(point.longitude / lngCell);

    for (let latStep = -1; latStep <= 1; latStep += 1) {
      for (let lngStep = -1; lngStep <= 1; lngStep += 1) {
        const neighbours = buckets.get(
          `${latBucket + latStep}:${lngBucket + lngStep}`,
        );
        if (!neighbours) {
          continue;
        }

        neighbours.forEach((other) => {
          const gap = cumulative[index] - cumulative[other];
          if (
            gap > revisitMinPathGapKm &&
            gap > longest &&
            distanceKmBetween(points[other], point) <= revisitProximityKm
          ) {
            longest = gap;
          }
        });
      }
    }

    const key = `${latBucket}:${lngBucket}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(index);
    } else {
      buckets.set(key, [index]);
    }
  });

  return longest;
}

// Phương án phải kết thúc ĐÚNG chỗ tuyến chính kết thúc. So với điểm cuối của
// TUYẾN CHÍNH chứ không phải toạ độ bến do user nhập: Directions snap cả hai đầu
// về đồ thị đường của nó, nên bến nằm lệch trục 600m thì MỌI phương án đều cách
// toạ độ gốc 600m — so với toạ độ gốc là loại sạch cả những bản hoàn toàn tốt.
const sameTerminusKm = 0.3;

// Tuyến dài vẫn cần tách ít nhất 2km. Với tuyến ngắn/đô thị, hai trục đường song
// song cách nhau 0.5-1.5km đã là hành lang khác thực sự, nên scale theo chiều dài.
function minCorridorDivergenceKm(primaryDistanceKm: number) {
  return Math.min(2, Math.max(0.5, primaryDistanceKm * 0.025));
}

function reachesSameEnds(option: RoadRouteOption, primary: RoadRouteOption) {
  const optionEnd = option.points[option.points.length - 1];
  const primaryEnd = primary.points[primary.points.length - 1];

  return (
    distanceKmBetween(option.points[0], primary.points[0]) <= sameTerminusKm &&
    distanceKmBetween(optionEnd, primaryEnd) <= sameTerminusKm
  );
}

/**
 * Phương án có dùng được không. Bốn nhóm điều kiện, theo đúng thứ tự rẻ→đắt:
 *
 * 1. Về được đích — điều kiện tiên quyết, phương án không tới nơi thì vô nghĩa.
 * 2. Không quay đầu — `uTurnCount` do chính Goong khai báo. Xe khách 45 chỗ
 *    quay đầu giữa quốc lộ là chuyện không làm được, chưa nói tới trong hẻm.
 * 3. Không đi lại chỗ vừa đi (`longestRetracedSpanKm`) — bắt nốt kiểu lộn lại
 *    mà Goong không đánh dấu là maneuver quay đầu.
 * 4. Vòng có chừng mực: theo tỉ lệ VÀ theo số km tuyệt đối.
 *
 * Đi vòng hay đi đường khác hẳn đều được — miễn là một lộ trình xe chạy được.
 */
function isUsableDetour(option: RoadRouteOption, primary: RoadRouteOption) {
  return (
    reachesSameEnds(option, primary) &&
    (option.uTurnCount ?? 0) === 0 &&
    longestRetracedSpanKm(option.points) <= maxRetracedSpanKm &&
    option.totalDistanceKm <=
      primary.totalDistanceKm * maxDetourDistanceRatio &&
    option.totalDistanceKm - primary.totalDistanceKm <= maxDetourExtraKm &&
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
  const stopPoints = points.slice(1, -1);
  const viaPoints = opts?.intermediates ?? [];
  const stopWaypoints = stopPoints.map(toLatLng);
  const viaWaypoints = viaPoints.map(toLatLng);
  const request: GoongDirectionsRequest = {
    // Vẫn gửi cờ cho Goong: hiện họ luôn trả 1 đường, nhưng nếu sau này bật thì
    // ta nhận phương án THẬT và bỏ qua hẳn phần tự sinh bên dưới.
    alternatives: opts?.alternatives ?? false,
    destination: toLatLng(points[points.length - 1]),
    origin: toLatLng(points[0]),
    vehicle: opts?.travelMode === "DRIVE" ? "car" : "truck",
    // Goong đi waypoint theo ĐÚNG thứ tự mảng, nên điểm nắn phải được chèn vào
    // đúng khe giữa các điểm dừng chứ không dồn xuống cuối
    waypoints: interleaveViaWaypoints(
      stopPoints,
      viaPoints,
      opts?.referencePath ?? points,
    ).map(toLatLng),
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

  const routeThrough = (probe: RouteCoordinate) =>
    goongDirections({ ...request, waypoints: [toLatLng(probe)] })
      .then((detourRoutes) =>
        detourRoutes
          .map(parseRouteOption)
          .filter((option): option is RoadRouteOption => option !== null),
      )
      .catch(() => []);

  // TẦNG 1 — điểm thử lệch đặt mù theo hình học. Điểm này rơi vào đâu thì không
  // ai bảo đảm: ruộng, sườn núi, hay một con hẻm. Mà Directions coi nó là điểm
  // ĐẾN bắt buộc, nên bản thô hay dính "chui vào rồi quay đầu ra".
  const rough = (await Promise.all(buildDetourProbes(primary).map(routeThrough)))
    .flat();

  const usable = rough.filter((option) => isUsableDetour(option, primary));

  // TẦNG 2 — chữa các bản hỏng thay vì vứt đi. Lấy điểm TÁCH XA tuyến chính
  // nhất trên chính bản hỏng đó rồi hỏi lại đường qua nó: điểm ấy nằm trên một
  // polyline Goong vừa trả về, tức chắc chắn là đường xe chạy được thật, chứ
  // không phải toạ độ bịa ra. Đo trên HCM–Đà Lạt: bản +41km kèm 1 cú quay đầu
  // chữa xong còn +16km, một bản khác hết sạch quay đầu.
  // Đủ phương án rồi thì không chữa nữa — dãy bubble chỉ hiện được `maxRouteOptions`
  // đường, chữa thêm là đốt quota Goong lấy thứ không ai nhìn thấy.
  const stillNeeded = maxRouteOptions - options.length - usable.length;

  const anchors: RouteCoordinate[] = [];
  const needRefining = (stillNeeded <= 0 ? [] : rough)
    .filter((option) => !usable.includes(option))
    .map((option) => {
      const anchor = findRouteLabelAnchor(option.points, primary.points, anchors);
      if (anchor) {
        anchors.push(anchor);
      }

      return anchor;
    })
    .filter((anchor): anchor is RouteCoordinate => anchor !== null)
    .slice(0, maxRefinedDetours);

  const refined = (await Promise.all(needRefining.map(routeThrough))).flat();

  const candidates = [...usable, ...refined.filter((option) => isUsableDetour(option, primary))]
    // Phải tách khỏi tuyến chính thành một HÀNH LANG khác, không phải vài khúc
    // ngoằn ngoèo quanh chính nó
    .filter((option) => {
      const anchor = findRouteLabelAnchor(option.points, primary.points);
      return (
        anchor !== null &&
        projectPointOntoPolyline(primary.points, anchor).distanceToPathKm >=
          minCorridorDivergenceKm(primary.totalDistanceKm)
      );
    })
    // Vòng ít hơn thì xếp trước — nhà xe cần bản đỡ tốn dầu nhất trước tiên
    .sort((first, second) => first.totalDistanceKm - second.totalDistanceKm);

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
