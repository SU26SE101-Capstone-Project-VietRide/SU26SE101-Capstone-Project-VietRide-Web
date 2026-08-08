// Tìm địa điểm dọc theo tuyến (Places API New — searchAlongRoute). Lỗi/thiếu key
// → trả mảng rỗng im lặng: gợi ý Google là tính năng phụ, không được chặn flow.
import { isRecord } from "../utils/typeGuards";

const searchTextEndpoint = "https://places.googleapis.com/v1/places:searchText";
const placeDetailsBaseUrl = "https://places.googleapis.com/v1/places";
const placeDetailsFieldMask =
  "id,displayName,formattedAddress,rating,userRatingCount,internationalPhoneNumber,primaryTypeDisplayName,regularOpeningHours,photos,googleMapsUri";

export type PlaceAlongRoute = {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  types: string[];
};

// Map 1 phần tử "places" trả về từ API sang PlaceAlongRoute; trả null nếu thiếu
// field bắt buộc (id/location) — bị loại khỏi kết quả cuối cùng.
function toPlaceAlongRoute(place: unknown): PlaceAlongRoute | null {
  if (!isRecord(place)) {
    return null;
  }

  const { id, displayName, formattedAddress, location, types, primaryType } =
    place;
  if (typeof id !== "string" || !isRecord(location)) {
    return null;
  }

  const { latitude, longitude } = location;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  const name =
    isRecord(displayName) && typeof displayName.text === "string"
      ? displayName.text
      : "";
  const address =
    typeof formattedAddress === "string" ? formattedAddress : "";

  // Gộp primaryType vào types (nếu có và chưa nằm trong mảng) để lọc
  // blocklist type ở tầng hook chỉ cần đọc 1 field duy nhất.
  const typeList = Array.isArray(types)
    ? types.filter((t): t is string => typeof t === "string")
    : [];
  if (typeof primaryType === "string" && !typeList.includes(primaryType)) {
    typeList.push(primaryType);
  }

  return {
    placeId: id,
    name,
    address,
    latitude,
    longitude,
    types: typeList,
  };
}

export async function searchPlacesAlongRoute(
  encodedPolyline: string,
  textQuery: string,
): Promise<PlaceAlongRoute[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_ROUTES_API_KEY?.trim();
  if (!apiKey || !encodedPolyline) {
    return [];
  }

  try {
    const response = await fetch(searchTextEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType",
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "vi",
        searchAlongRouteParameters: { polyline: { encodedPolyline } },
      }),
    });
    if (!response.ok) {
      return [];
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.places)) {
      return [];
    }

    return payload.places
      .map(toPlaceAlongRoute)
      .filter((place): place is PlaceAlongRoute => place !== null);
  } catch {
    return [];
  }
}

// Chi tiết 1 địa điểm — dùng để dựng card kiểu Google Maps khi bấm chấm gợi ý.
export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  userRatingCount: number | null;
  phone: string | null;
  primaryTypeLabel: string | null;
  openNow: boolean | null;
  weekdayHours: string[];
  photoName: string | null;
  googleMapsUri: string | null;
};

// Cache module-level theo placeId — mỗi placeId chỉ gọi Places Details API MỘT
// LẦN mỗi phiên (giống pattern placesCache trong useRouteStopSuggestions).
const placeDetailsCache = new Map<string, PlaceDetails | null>();

// Chỉ dùng trong test để reset cache giữa các case — không export ra ngoài module hook.
export function __clearPlaceDetailsCacheForTest() {
  placeDetailsCache.clear();
}

// Map payload chi tiết trả về từ Places API New sang PlaceDetails. Trả null
// nếu thiếu field bắt buộc (id).
function toPlaceDetails(payload: unknown): PlaceDetails | null {
  if (!isRecord(payload)) {
    return null;
  }

  const {
    id,
    displayName,
    formattedAddress,
    rating,
    userRatingCount,
    internationalPhoneNumber,
    primaryTypeDisplayName,
    regularOpeningHours,
    photos,
    googleMapsUri,
  } = payload;
  if (typeof id !== "string") {
    return null;
  }

  const name =
    isRecord(displayName) && typeof displayName.text === "string"
      ? displayName.text
      : "";
  const address =
    typeof formattedAddress === "string" ? formattedAddress : "";
  const primaryTypeLabel =
    isRecord(primaryTypeDisplayName) &&
    typeof primaryTypeDisplayName.text === "string"
      ? primaryTypeDisplayName.text
      : null;

  let openNow: boolean | null = null;
  let weekdayHours: string[] = [];
  if (isRecord(regularOpeningHours)) {
    if (typeof regularOpeningHours.openNow === "boolean") {
      openNow = regularOpeningHours.openNow;
    }
    if (Array.isArray(regularOpeningHours.weekdayDescriptions)) {
      weekdayHours = regularOpeningHours.weekdayDescriptions.filter(
        (line): line is string => typeof line === "string",
      );
    }
  }

  let photoName: string | null = null;
  if (Array.isArray(photos) && photos.length > 0 && isRecord(photos[0])) {
    const firstPhotoName = photos[0].name;
    photoName = typeof firstPhotoName === "string" ? firstPhotoName : null;
  }

  return {
    placeId: id,
    name,
    address,
    rating: typeof rating === "number" ? rating : null,
    userRatingCount:
      typeof userRatingCount === "number" ? userRatingCount : null,
    phone:
      typeof internationalPhoneNumber === "string"
        ? internationalPhoneNumber
        : null,
    primaryTypeLabel,
    openNow,
    weekdayHours,
    photoName,
    googleMapsUri: typeof googleMapsUri === "string" ? googleMapsUri : null,
  };
}

// Lấy chi tiết 1 địa điểm (ảnh, rating, giờ mở cửa, SĐT...) để dựng card kiểu
// Google Maps khi bấm chấm gợi ý. Lỗi/thiếu key → null im lặng, cache theo
// placeId để không gọi lại API khi mở/đóng popup nhiều lần cùng 1 địa điểm.
export async function getPlaceDetails(
  placeId: string,
): Promise<PlaceDetails | null> {
  if (placeDetailsCache.has(placeId)) {
    return placeDetailsCache.get(placeId) ?? null;
  }

  const apiKey = import.meta.env.VITE_GOOGLE_ROUTES_API_KEY?.trim();
  if (!apiKey || !placeId) {
    return null;
  }

  try {
    const response = await fetch(`${placeDetailsBaseUrl}/${placeId}`, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": placeDetailsFieldMask,
      },
    });
    if (!response.ok) {
      placeDetailsCache.set(placeId, null);
      return null;
    }

    const payload: unknown = await response.json();
    const details = toPlaceDetails(payload);
    placeDetailsCache.set(placeId, details);
    return details;
  } catch {
    placeDetailsCache.set(placeId, null);
    return null;
  }
}

// Dựng URL ảnh địa điểm từ photoName trả về ở getPlaceDetails (photos[0].name).
// Thiếu API key → null (không hiển thị ảnh thay vì gọi URL hỏng).
export function buildPlacePhotoUrl(
  photoName: string,
  maxWidthPx = 640,
): string | null {
  const apiKey = import.meta.env.VITE_GOOGLE_ROUTES_API_KEY?.trim();
  if (!apiKey || !photoName) {
    return null;
  }
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${apiKey}`;
}
