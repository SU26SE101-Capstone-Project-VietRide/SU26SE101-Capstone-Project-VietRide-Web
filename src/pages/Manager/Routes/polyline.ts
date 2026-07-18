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
