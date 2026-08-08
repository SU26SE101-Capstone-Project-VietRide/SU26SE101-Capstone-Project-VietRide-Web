// Card chi tiết điểm dừng kiểu Google Maps (ảnh/rating/giờ mở cửa/SĐT/link) —
// dùng chung cho 2 nguồn: chấm gợi ý điểm dừng (suggestion) VÀ marker điểm
// dừng ĐÃ GẮN vào tuyến (đánh số 1..N). Tự gọi usePlaceDetails bên trong theo
// googlePlaceId truyền vào — không có googlePlaceId thì chỉ hiện tên/địa chỉ,
// không gọi API. Phần hành động (nút Thêm cho suggestion / nút Gỡ cho stop đã
// gắn) do component cha truyền qua `children` — card không biết ngữ cảnh gọi nó.
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPhone, FiStar } from "react-icons/fi";
import { buildPlacePhotoUrl } from "../../../lib/googlePlacesSearch";
import { usePlaceDetails } from "./usePlaceDetails";

type StopDetailCardProps = {
  // data-testid gắn trên wrapper ngoài cùng — caller tự chọn để test cũ
  // (stop-suggestion-popup) và test mới (stop marker) không đụng nhau.
  testId: string;
  title: string;
  // Badge nguồn gợi ý (kho nhà xe / Google) — chỉ suggestion dùng, stop đã gắn
  // không cần nên optional.
  titleBadge?: ReactNode;
  address?: string | null;
  googlePlaceId: string | null;
  // Dòng km/phút hiển thị dưới địa chỉ — caller tự format theo i18n phù hợp
  // ngữ cảnh (suggestMetrics dùng chung cho cả suggestion lẫn stop đã gắn vì
  // cùng ngữ nghĩa "cách bến đi ~X km · ~Y phút").
  metricsText?: string;
  onClose: () => void;
  // Slot hành động phía dưới: checkbox + nút Thêm (suggestion) hoặc nút Gỡ
  // (stop đã gắn) — card chi tiết không biết ngữ cảnh gọi nó.
  children?: ReactNode;
};

export default function StopDetailCard({
  testId,
  title,
  titleBadge,
  address,
  googlePlaceId,
  metricsText,
  onClose,
  children,
}: StopDetailCardProps) {
  const { t } = useTranslation("manager");
  const { details: placeDetails, isLoading: isLoadingPlaceDetails } =
    usePlaceDetails(googlePlaceId);
  const placePhotoUrl = placeDetails?.photoName
    ? buildPlacePhotoUrl(placeDetails.photoName)
    : null;
  // Ẩn ảnh khi load lỗi (403/404 do quyền photo API...) — reset lại khi đổi
  // địa điểm (identity mới của placePhotoUrl).
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);
  const [prevPhotoUrl, setPrevPhotoUrl] = useState(placePhotoUrl);
  if (placePhotoUrl !== prevPhotoUrl) {
    setPrevPhotoUrl(placePhotoUrl);
    setPhotoLoadFailed(false);
  }

  return (
    // overflow-visible ở wrapper NGOÀI để mũi neo tam giác (-top-2, nằm ngoài
    // mép trên) không bị cắt — bo góc + clip ảnh dồn xuống div bọc riêng bên
    // dưới thay vì overflow-hidden trên chính wrapper này
    <div
      data-testid={testId}
      className="relative w-80 max-w-[calc(100vw-1.5rem)] overflow-visible rounded-lg border border-gray-200 bg-white shadow-lg"
    >
      {/* Mũi neo tam giác trỏ lên chấm/marker trên bản đồ (kiểu Google Maps) */}
      <span
        aria-hidden="true"
        className="absolute -top-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-8 border-b-8 border-x-transparent border-b-white"
      />
      {/* Ảnh địa điểm (Places Photo) — chỉ hiện khi có photoName và chưa lỗi load.
          overflow-hidden + bo góc trên riêng ở đây để không cắt mũi neo phía trên. */}
      {placePhotoUrl && !photoLoadFailed && (
        <div className="overflow-hidden rounded-t-lg">
          <img
            src={placePhotoUrl}
            alt={title}
            className="h-28 w-full object-cover"
            onError={() => setPhotoLoadFailed(true)}
          />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{title}</span>
            {titleBadge}
          </div>
          <button
            type="button"
            aria-label={t("routes.suggestClose")}
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        <div className="mt-1 max-h-75 overflow-y-auto">
          {isLoadingPlaceDetails && (
            <div
              data-testid="place-details-skeleton"
              className="mt-1 space-y-1.5"
            >
              <div className="h-3 w-2/3 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
            </div>
          )}

          {/* Rating + loại địa điểm — chỉ hiện khi lấy được chi tiết từ Google */}
          {!isLoadingPlaceDetails &&
            placeDetails?.rating !== null &&
            placeDetails?.rating !== undefined && (
              <div className="flex items-center gap-1 text-xs text-gray-700">
                <FiStar className="fill-amber-400 text-amber-400" />
                <span className="font-medium">
                  {placeDetails.rating.toFixed(1)}
                </span>
                {placeDetails.userRatingCount !== null && (
                  <span className="text-gray-500">
                    ({placeDetails.userRatingCount})
                  </span>
                )}
                {placeDetails.primaryTypeLabel && (
                  <span className="text-gray-500">
                    · {placeDetails.primaryTypeLabel}
                  </span>
                )}
              </div>
            )}

          {address && <p className="mt-1 text-xs text-gray-500">{address}</p>}

          {/* Trạng thái mở/đóng cửa — chỉ hiện khi Google trả về openNow */}
          {!isLoadingPlaceDetails && placeDetails?.openNow === true && (
            <p className="mt-1 text-xs font-medium text-green-600">
              {t("routes.detailOpenNow")}
            </p>
          )}
          {!isLoadingPlaceDetails && placeDetails?.openNow === false && (
            <p className="mt-1 text-xs font-medium text-red-600">
              {t("routes.detailClosed")}
            </p>
          )}

          {!isLoadingPlaceDetails && placeDetails?.phone && (
            <a
              href={`tel:${placeDetails.phone}`}
              className="mt-1 flex items-center gap-1 text-xs text-vr-600 hover:underline"
            >
              <FiPhone />
              {placeDetails.phone}
            </a>
          )}

          {!isLoadingPlaceDetails && placeDetails?.googleMapsUri && (
            <a
              href={placeDetails.googleMapsUri}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-xs font-medium text-vr-600 hover:underline"
            >
              {t("routes.detailViewOnGoogle")}
            </a>
          )}

          {metricsText && (
            <p className="mt-1 text-xs text-gray-500">{metricsText}</p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
