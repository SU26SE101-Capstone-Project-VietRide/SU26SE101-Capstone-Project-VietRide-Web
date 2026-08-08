// Hook cục bộ: lấy chi tiết 1 địa điểm Google (ảnh, rating, giờ mở cửa...) để
// dựng card popup gợi ý điểm dừng kiểu Google Maps. Pattern derive/version
// giống useRouteStopSuggestions — KHÔNG setState đồng bộ trong effect, chỉ set
// khi fetch xong (né rule react-hooks/set-state-in-effect).
import { useEffect, useState } from "react";
import {
  getPlaceDetails,
  type PlaceDetails,
} from "../../../lib/googlePlacesSearch";

type UsePlaceDetailsResult = {
  details: PlaceDetails | null;
  isLoading: boolean;
};

export function usePlaceDetails(
  placeId: string | null,
): UsePlaceDetailsResult {
  const [state, setState] = useState<{
    placeId: string | null;
    details: PlaceDetails | null;
  }>({ placeId: null, details: null });

  useEffect(() => {
    if (!placeId) {
      return;
    }

    let cancelled = false;
    getPlaceDetails(placeId).then((details) => {
      if (cancelled) {
        return;
      }
      setState({ placeId, details });
    });

    return () => {
      cancelled = true;
    };
  }, [placeId]);

  if (!placeId) {
    return { details: null, isLoading: false };
  }

  // Kết quả trong state chưa khớp placeId hiện tại (đang chờ effect chạy xong
  // hoặc placeId vừa đổi) → coi như đang loading, không hiện dữ liệu cũ.
  const isLoading = state.placeId !== placeId;
  return { details: isLoading ? null : state.details, isLoading };
}
