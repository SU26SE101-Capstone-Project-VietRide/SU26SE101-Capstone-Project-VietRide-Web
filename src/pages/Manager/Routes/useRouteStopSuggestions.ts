// Hook cục bộ: gợi ý điểm dừng trên tuyến — kho nhà xe (lọc theo khoảng cách tới
// đường, dedupe stop đã gắn) + địa điểm Goong dọc tuyến (cache theo routeKey,
// dedupe với kho lẫn với place trùng vị trí kho).
import { useCallback, useEffect, useMemo, useState } from "react";
import type { OperatorStop } from "../../../api/vietride";
import { distanceKmBetween } from "./geometry";
import {
  searchPlacesAlongRoute,
  stopPlaceCategories,
  type PlaceAlongRoute,
} from "../../../lib/googlePlacesSearch";
import {
  encodeGooglePolyline,
  projectPointOntoPolyline,
  type RouteCoordinate,
} from "./polyline";
import {
  readSessionCache,
  writeSessionCache,
} from "../../../utils/sessionCache";
import type { RouteStopDraft, StopSuggestion } from "./types";

// Xe khách 40 chỗ chỉ rẽ được từ đường lớn — gợi ý (kho lẫn Goong) phải nằm
// sát tuyến (đường lớn), không phải trong ngõ/phố cách tuyến vài km.
const maxDistanceToPathKm = 1;
const minGooglePlaceSpacingKm = 0.1;
// Blocklist type địa điểm — loại nhầm chỗ không phải điểm dừng khách dù
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
// Cache module-level: mỗi `routeKey` chỉ gọi Places API MỘT LẦN mỗi phiên —
// quét dọc tuyến là nhiều request nên tốn quota. KHÔNG đưa pathPoints.length vào key:
// polyline đổi độ dài liên tục khi thêm stop/kéo via-point lúc suggest-mode
// bật, đưa vào key sẽ gọi lại Google mỗi lần đổi (tốn quota) mà 2 polyline
// khác nhau cùng độ dài lại vô tình dùng chung cache (sai kết quả). Places
// trả về luôn được lọc lại theo khoảng cách tới polyline HIỆN TẠI (xem
// googleSuggestions bên dưới) nên chỉ gọi 1 lần/tuyến vẫn cho kết quả đúng.
const placesCache = new Map<string, PlaceAlongRoute[]>();

// Cache còn được ĐỔ XUỐNG sessionStorage: Map module-level chết theo mỗi lần
// F5, mà một lượt quét là ~84 request Goong. Địa điểm dọc tuyến không đổi theo
// giờ nên hạn 24h là thoải mái; sessionStorage tự sạch khi đóng tab.
const placesStorageKeyPrefix = "vietride.routeStopPlaces.";
const placesCacheMaxAgeMs = 24 * 60 * 60 * 1_000;

// Batch ĐANG BAY, theo cacheKey. Guard cũ chỉ nhìn `placesCache`, mà cache chỉ
// có sau khi batch resolve — trong 1-3 giây đang chạy, rời tab Điểm dừng rồi
// quay lại là bắn thêm nguyên một loạt 84 request nữa. Giữ promise ở đây để
// lượt sau bám vào đúng loạt đang chạy thay vì mở loạt mới.
const pendingPlaceBatches = new Map<string, Promise<PlaceAlongRoute[]>>();

function placesStorageKey(cacheKey: string) {
  return `${placesStorageKeyPrefix}${cacheKey}`;
}

/**
 * Đọc gợi ý đã cache: bộ nhớ trước, rồi tới sessionStorage (nạp ngược lên bộ
 * nhớ nếu có). Trả null khi chưa từng quét — caller dùng đúng tín hiệu đó để
 * quyết định gọi API hay báo đang tải.
 */
function readCachedPlaces(cacheKey: string): PlaceAlongRoute[] | null {
  const inMemory = placesCache.get(cacheKey);
  if (inMemory) {
    return inMemory;
  }

  const persisted = readSessionCache<PlaceAlongRoute[]>(
    placesStorageKey(cacheKey),
    placesCacheMaxAgeMs,
  );
  if (persisted) {
    placesCache.set(cacheKey, persisted);
    return persisted;
  }

  return null;
}

// Một loạt quét cho `cacheKey`. Gọi lại khi đang bay thì nhận đúng promise cũ.
function loadPlaces(
  cacheKey: string,
  encodedPolyline: string,
): Promise<PlaceAlongRoute[]> {
  const pending = pendingPlaceBatches.get(cacheKey);
  if (pending) {
    return pending;
  }

  // Mỗi danh mục (bến xe / trạm dừng chân) là một loạt request riêng — gọi
  // song song rồi gộp + dedupe theo placeId ở đây.
  const batch = Promise.all(
    stopPlaceCategories.map((category) =>
      searchPlacesAlongRoute(encodedPolyline, category),
    ),
  )
    .then((resultsPerQuery) => {
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
      writeSessionCache<PlaceAlongRoute[]>(
        placesStorageKey(cacheKey),
        mergedResult,
      );
      return mergedResult;
    })
    .finally(() => {
      pendingPlaceBatches.delete(cacheKey);
    });

  pendingPlaceBatches.set(cacheKey, batch);
  return batch;
}

// Chỉ dùng trong test để reset cache giữa các case — không export ra ngoài module hook.
export function __clearPlacesCacheForTest() {
  placesCache.clear();
  pendingPlaceBatches.clear();
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(placesStorageKeyPrefix))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // sessionStorage bị chặn — không có gì để dọn.
  }
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
  // Đếm số lần cache địa điểm thực sự thay đổi — dùng để buộc useMemo bên
  // dưới đọc lại `placesCache` (Map mutate không tự trigger re-render).
  const [placesVersion, setPlacesVersion] = useState(0);
  // routeKey mà người dùng đã BẤM tìm gợi ý. Trước đây chỉ cần bước chân vào
  // tab Điểm dừng là tự bắn ~84 request Goong, kể cả khi chỉ định xem lại danh
  // sách điểm dừng đã gắn — phần lớn lượt quét đó không ai dùng tới. Giờ phải
  // có chủ đích; tuyến đã quét rồi thì cache trả kết quả ngay, không bắt bấm lại.
  const [requestedKey, setRequestedKey] = useState("");

  const hasValidPath = pathPoints.length >= 2;
  const cacheKey = routeKey;

  useEffect(() => {
    // Không setState đồng bộ trong effect: khi disabled/path không hợp lệ, chưa
    // được yêu cầu, hoặc đã có cache thì đơn giản không làm gì — output cuối
    // được derive/gate ở useMemo bên dưới.
    if (
      !enabled ||
      !hasValidPath ||
      requestedKey !== cacheKey ||
      readCachedPlaces(cacheKey)
    ) {
      return;
    }

    let cancelled = false;
    const encodedPolyline = encodeGooglePolyline(pathPoints);

    // Batch tự lo phần gộp + ghi cache; ở đây chỉ cần biết lúc nào xong để
    // buộc useMemo bên dưới đọc lại. Bám vào loạt đang bay nếu có.
    void loadPlaces(cacheKey, encodedPolyline).then(() => {
      if (cancelled) {
        return;
      }
      setPlacesVersion((version) => version + 1);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hasValidPath, cacheKey, requestedKey]);

  // Đọc kết quả địa điểm hiện có trong cache cho cacheKey hiện tại (rỗng nếu
  // chưa fetch xong). `placesVersion` chỉ để buộc recompute sau khi cache thay đổi.
  const places = useMemo(
    () => readCachedPlaces(cacheKey) ?? [],
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

  // Gợi ý từ địa điểm Goong dọc tuyến: cách đường <= 1km, loại type trong
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

  // Bấm "Tìm gợi ý quanh tuyến" — đánh dấu đúng routeKey đang mở, effect trên
  // sẽ chạy loạt quét (hoặc bám vào loạt đang bay của cùng key).
  const requestPlaces = useCallback(() => {
    setRequestedKey(cacheKey);
  }, [cacheKey]);

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
      return {
        suggestions: [] as StopSuggestion[],
        isLoadingPlaces: false,
        canRequestPlaces: false,
        requestPlaces,
      };
    }

    const hasPlaces = readCachedPlaces(cacheKey) !== null;
    const isScanning = requestedKey === cacheKey && !hasPlaces;

    return {
      suggestions: rawSuggestions,
      // CHỈ true khi đang thực sự quét. Nếu để nguyên "chưa có cache = đang
      // tải" thì panel sẽ báo "đang tìm..." vĩnh viễn cho tuyến chưa ai bấm.
      isLoadingPlaces: isScanning,
      // Còn quét được (chưa có kết quả, chưa bấm) → UI hiện nút cho bấm
      canRequestPlaces: !hasPlaces && !isScanning,
      requestPlaces,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    hasValidPath,
    rawSuggestions,
    cacheKey,
    placesVersion,
    requestedKey,
  ]);
}
