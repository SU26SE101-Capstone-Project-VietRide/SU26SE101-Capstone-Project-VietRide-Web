// Hook cục bộ: gợi ý điểm dừng trên tuyến — kho nhà xe (lọc theo khoảng cách tới
// đường, dedupe stop đã gắn) + Google Places dọc tuyến (cache theo routeKey,
// dedupe với kho lẫn với place trùng vị trí kho).
import { useEffect, useMemo, useState } from "react";
import type { OperatorStop } from "../../../api/vietride";
import { distanceKmBetween } from "./geometry";
import {
  searchPlacesAlongRoute,
  type PlaceAlongRoute,
} from "../../../lib/googlePlacesSearch";
import {
  encodeGooglePolyline,
  projectPointOntoPolyline,
  type RouteCoordinate,
} from "./polyline";
import type { RouteStopDraft, StopSuggestion } from "./types";

// Xe khách 40 chỗ chỉ rẽ được từ đường lớn — gợi ý (kho lẫn Google) phải nằm
// sát tuyến (đường lớn), không phải trong ngõ/phố cách tuyến vài km.
const maxDistanceToPathKm = 1;
const minGooglePlaceSpacingKm = 0.1;
// Blocklist type Google Places — loại nhầm chỗ không phải điểm dừng khách dù
// tên khớp query (VD: "Trạm Sạc Xe Điện (TRẠM DỪNG CHÂN)" khớp textQuery vì
// tên chứa chữ). Dùng blocklist chứ không allowlist: trạm dừng chân VN thực
// tế hay mang type restaurant/food/gas_station rất đa dạng, allowlist sẽ giết
// nhầm các trạm hợp lệ.
const blockedPlaceTypes = new Set([
  "electric_vehicle_charging_station",
  "car_dealer",
  "car_repair",
  "car_wash",
  "atm",
  "bank",
  "insurance_agency",
  "real_estate_agency",
]);
// Places API textQuery KHÔNG hỗ trợ toán tử OR ("|") — Google match cả chuỗi
// theo nghĩa đen nên "bến xe | trạm dừng chân" chỉ ra kết quả thưa/thất
// thường. Tách thành nhiều query riêng, gọi song song rồi gộp + dedupe theo
// placeId ở tầng hook.
const googlePlacesTextQueries = ["bến xe", "trạm dừng chân"];

// Cache module-level: mỗi `routeKey` chỉ gọi Google Places API MỘT LẦN mỗi
// phiên — search along route tốn quota. KHÔNG đưa pathPoints.length vào key:
// polyline đổi độ dài liên tục khi thêm stop/kéo via-point lúc suggest-mode
// bật, đưa vào key sẽ gọi lại Google mỗi lần đổi (tốn quota) mà 2 polyline
// khác nhau cùng độ dài lại vô tình dùng chung cache (sai kết quả). Places
// trả về luôn được lọc lại theo khoảng cách tới polyline HIỆN TẠI (xem
// googleSuggestions bên dưới) nên chỉ gọi 1 lần/tuyến vẫn cho kết quả đúng.
const placesCache = new Map<string, PlaceAlongRoute[]>();

// Chỉ dùng trong test để reset cache giữa các case — không export ra ngoài module hook.
export function __clearPlacesCacheForTest() {
  placesCache.clear();
}

type UseRouteStopSuggestionsParams = {
  enabled: boolean;
  routeKey: string;
  pathPoints: RouteCoordinate[];
  stops: OperatorStop[];
  // Chỉ cần stopId để dedupe stop đã gắn — nhận cả RouteStopDraft (tuyến chính)
  // lẫn AlternativeStopDraft (tuyến thay thế, không có allowPickup/allowDropoff/
  // routeName) qua kiểu tối thiểu này (xem useAlternativeRouteWorkspace).
  currentRouteStops: Pick<RouteStopDraft, "stopId">[];
};

export function useRouteStopSuggestions({
  enabled,
  routeKey,
  pathPoints,
  stops,
  currentRouteStops,
}: UseRouteStopSuggestionsParams) {
  // Đếm số lần cache Google Places thực sự thay đổi — dùng để buộc useMemo bên
  // dưới đọc lại `placesCache` (Map mutate không tự trigger re-render).
  const [placesVersion, setPlacesVersion] = useState(0);

  const hasValidPath = pathPoints.length >= 2;
  const cacheKey = routeKey;

  useEffect(() => {
    // Không setState đồng bộ trong effect: khi disabled/path không hợp lệ hoặc đã
    // có cache, đơn giản không làm gì — output cuối được derive/gate ở useMemo bên dưới.
    if (!enabled || !hasValidPath || placesCache.has(cacheKey)) {
      return;
    }

    let cancelled = false;
    const encodedPolyline = encodeGooglePolyline(pathPoints);

    Promise.all(
      googlePlacesTextQueries.map((query) =>
        searchPlacesAlongRoute(encodedPolyline, query),
      ),
    ).then((resultsPerQuery) => {
      if (cancelled) {
        return;
      }
      // Gộp kết quả nhiều query + dedupe theo placeId (giữ bản ghi đầu tiên).
      const seenPlaceIds = new Set<string>();
      const mergedResult: PlaceAlongRoute[] = [];
      for (const results of resultsPerQuery) {
        for (const place of results) {
          if (seenPlaceIds.has(place.placeId)) {
            continue;
          }
          seenPlaceIds.add(place.placeId);
          mergedResult.push(place);
        }
      }
      placesCache.set(cacheKey, mergedResult);
      setPlacesVersion((version) => version + 1);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hasValidPath, cacheKey]);

  // Đọc kết quả Google Places hiện có trong cache cho cacheKey hiện tại (rỗng nếu
  // chưa fetch xong). `placesVersion` chỉ để buộc recompute sau khi cache thay đổi.
  const places = useMemo(
    () => placesCache.get(cacheKey) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheKey, placesVersion],
  );

  // Gợi ý từ kho nhà xe: có toạ độ, cách đường <= 1km, chưa gắn vào tuyến hiện tại.
  const operatorSuggestions = useMemo<StopSuggestion[]>(() => {
    if (!enabled || !hasValidPath) {
      return [];
    }

    const attachedStopIds = new Set(
      currentRouteStops.map((draft) => draft.stopId),
    );

    const result: StopSuggestion[] = [];
    for (const stop of stops) {
      if (attachedStopIds.has(stop.id)) {
        continue;
      }

      const projection = projectPointOntoPolyline(pathPoints, {
        latitude: stop.latitude,
        longitude: stop.longitude,
      });
      if (projection.distanceToPathKm > maxDistanceToPathKm) {
        continue;
      }

      result.push({
        kind: "operatorStop",
        id: stop.id,
        name: stop.name,
        address: stop.address ?? "",
        latitude: stop.latitude,
        longitude: stop.longitude,
        distanceFromStartKm: projection.distanceFromStartKm,
        googlePlaceId: stop.googlePlaceId ?? undefined,
      });
    }
    return result;
  }, [enabled, hasValidPath, stops, currentRouteStops, pathPoints]);

  // Gợi ý từ Google Places dọc tuyến: cách đường <= 1km, loại type trong
  // blocklist, không trùng googlePlaceId với stop kho, không quá gần
  // (< 0.1km) một gợi ý kho.
  const googleSuggestions = useMemo<StopSuggestion[]>(() => {
    if (!enabled || !hasValidPath || places.length === 0) {
      return [];
    }

    const warehouseGooglePlaceIds = new Set(
      stops
        .map((stop) => stop.googlePlaceId)
        .filter((id): id is string => !!id),
    );

    const result: StopSuggestion[] = [];
    for (const place of places) {
      if (warehouseGooglePlaceIds.has(place.placeId)) {
        continue;
      }

      if (place.types.some((type) => blockedPlaceTypes.has(type))) {
        continue;
      }

      const projection = projectPointOntoPolyline(pathPoints, place);
      if (projection.distanceToPathKm > maxDistanceToPathKm) {
        continue;
      }

      const tooCloseToWarehouseSuggestion = operatorSuggestions.some(
        (suggestion) =>
          distanceKmBetween(suggestion, place) < minGooglePlaceSpacingKm,
      );
      if (tooCloseToWarehouseSuggestion) {
        continue;
      }

      result.push({
        kind: "googlePlace",
        id: place.placeId,
        name: place.name,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        distanceFromStartKm: projection.distanceFromStartKm,
        googlePlaceId: place.placeId,
      });
    }
    return result;
  }, [enabled, hasValidPath, places, stops, pathPoints, operatorSuggestions]);

  const rawSuggestions = useMemo<StopSuggestion[]>(
    () =>
      [...operatorSuggestions, ...googleSuggestions].sort(
        (a, b) => a.distanceFromStartKm - b.distanceFromStartKm,
      ),
    [operatorSuggestions, googleSuggestions],
  );

  // Output cuối cùng: gate theo enabled/hasValidPath ở đây (không phải trong effect)
  // để tránh setState đồng bộ trong effect — disabled/path rỗng thì trả rỗng ngay.
  return useMemo(() => {
    if (!enabled || !hasValidPath) {
      return { suggestions: [] as StopSuggestion[], isLoadingPlaces: false };
    }
    return {
      suggestions: rawSuggestions,
      isLoadingPlaces: !placesCache.has(cacheKey),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hasValidPath, rawSuggestions, cacheKey, placesVersion]);
}
