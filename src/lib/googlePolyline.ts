// Giải mã chuỗi "encoded polyline" của Google thành toạ độ bản đồ.
//
// Đặt ở lib vì cả màn Trung tâm vận hành lẫn wrapper Google Routes đều cần.
// `Manager/Routes/polyline.ts` vẫn giữ bản riêng vì trả về RouteCoordinate
// (latitude/longitude) theo shape form tuyến — chưa hợp nhất trong đợt này.
import type { GoogleMapCoordinate } from "./googleMaps";

export function decodeGooglePolyline(encoded: string): GoogleMapCoordinate[] {
  const coordinates: GoogleMapCoordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({ lat: latitude / 1e5, lng: longitude / 1e5 });
  }

  return coordinates;
}
