export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

const averageCoachSpeedKmh = 45;

export function estimateCoachDurationMinutes(
  distanceKm: number,
  roadDurationSeconds = 0,
) {
  const distanceBasedMinutes =
    Number.isFinite(distanceKm) && distanceKm > 0
      ? Math.round((distanceKm / averageCoachSpeedKmh) * 60)
      : 0;
  const roadBasedMinutes =
    Number.isFinite(roadDurationSeconds) && roadDurationSeconds > 0
      ? Math.round(roadDurationSeconds / 60)
      : 0;

  return Math.max(1, distanceBasedMinutes, roadBasedMinutes);
}

export function parseGoogleDurationSeconds(duration: string) {
  const match = /^(\d+(?:\.\d+)?)s$/.exec(duration.trim());
  if (!match) {
    return 0;
  }

  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? seconds : 0;
}

function encodeValue(value: number) {
  let shifted = value < 0 ? ~(value << 1) : value << 1;
  let encoded = "";

  while (shifted >= 0x20) {
    encoded += String.fromCharCode((0x20 | (shifted & 0x1f)) + 63);
    shifted >>= 5;
  }

  return encoded + String.fromCharCode(shifted + 63);
}

export function encodeGooglePolyline(points: RouteCoordinate[]) {
  let previousLatitude = 0;
  let previousLongitude = 0;

  return points
    .map((point) => {
      const latitude = Math.round(point.latitude * 1e5);
      const longitude = Math.round(point.longitude * 1e5);
      const encoded =
        encodeValue(latitude - previousLatitude) +
        encodeValue(longitude - previousLongitude);

      previousLatitude = latitude;
      previousLongitude = longitude;
      return encoded;
    })
    .join("");
}

function decodeValue(encoded: string, startIndex: number) {
  let result = 0;
  let shift = 0;
  let index = startIndex;

  while (index < encoded.length) {
    const value = encoded.charCodeAt(index) - 63;
    index += 1;
    result |= (value & 0x1f) << shift;
    shift += 5;

    if (value < 0x20) {
      return {
        value: result & 1 ? ~(result >> 1) : result >> 1,
        nextIndex: index,
      };
    }
  }

  throw new Error("Invalid encoded polyline");
}

export function decodeGooglePolyline(encoded: string) {
  const points: RouteCoordinate[] = [];
  let latitude = 0;
  let longitude = 0;
  let index = 0;

  while (index < encoded.length) {
    const decodedLatitude = decodeValue(encoded, index);
    const decodedLongitude = decodeValue(encoded, decodedLatitude.nextIndex);
    latitude += decodedLatitude.value;
    longitude += decodedLongitude.value;
    index = decodedLongitude.nextIndex;

    points.push({
      latitude: latitude / 1e5,
      longitude: longitude / 1e5,
    });
  }

  return points;
}

// Chiếu một điểm lên polyline: tìm chân chiếu gần nhất trên từng segment
// (xấp xỉ equirectangular — đủ chính xác cho khoảng cách nội tuyến vài trăm km),
// trả km tích luỹ dọc đường tại chân chiếu + khoảng cách vuông góc tới đường.
const earthRadiusKm = 6371;

function toXY(point: RouteCoordinate, refLatitudeRad: number) {
  const latRad = (point.latitude * Math.PI) / 180;
  const lngRad = (point.longitude * Math.PI) / 180;
  return {
    x: earthRadiusKm * lngRad * Math.cos(refLatitudeRad),
    y: earthRadiusKm * latRad,
  };
}

export function projectPointOntoPolyline(
  path: RouteCoordinate[],
  point: RouteCoordinate,
) {
  if (path.length < 2) {
    return { distanceFromStartKm: 0, distanceToPathKm: Number.POSITIVE_INFINITY };
  }

  const refLatitudeRad = (point.latitude * Math.PI) / 180;
  const target = toXY(point, refLatitudeRad);
  let cumulativeKm = 0;
  let bestDistanceKm = Number.POSITIVE_INFINITY;
  let bestFromStartKm = 0;

  for (let index = 0; index < path.length - 1; index += 1) {
    const start = toXY(path[index], refLatitudeRad);
    const end = toXY(path[index + 1], refLatitudeRad);
    const segmentX = end.x - start.x;
    const segmentY = end.y - start.y;
    const segmentLengthKm = Math.hypot(segmentX, segmentY);
    // Segment suy biến (2 điểm trùng) → so khoảng cách tới điểm đầu
    const rawT =
      segmentLengthKm === 0
        ? 0
        : ((target.x - start.x) * segmentX + (target.y - start.y) * segmentY) /
          (segmentLengthKm * segmentLengthKm);
    const t = Math.min(1, Math.max(0, rawT));
    const footX = start.x + t * segmentX;
    const footY = start.y + t * segmentY;
    const distanceKm = Math.hypot(target.x - footX, target.y - footY);

    if (distanceKm < bestDistanceKm) {
      bestDistanceKm = distanceKm;
      bestFromStartKm = cumulativeKm + t * segmentLengthKm;
    }

    cumulativeKm += segmentLengthKm;
  }

  return { distanceFromStartKm: bestFromStartKm, distanceToPathKm: bestDistanceKm };
}
