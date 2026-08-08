// Ô tìm gộp khi ở chế độ "thêm điểm dừng": gõ ≥2 ký tự → gợi ý kho nhà xe
// (lọc client theo tên, tối đa 5) + gợi ý Google Places (autocomplete có
// debounce, theo đúng pattern session-token + place details của PlacePicker).
// Chọn 1 dòng bất kỳ → trả StopSuggestion cho nơi gọi (index pan map + mở popup).
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiMapPin, FiSearch } from "react-icons/fi";
import type { OperatorStop } from "../../../api/vietride";
import {
  loadGooglePlacesLibrary,
  type GoogleAutocompleteSessionToken,
  type GooglePlacePrediction,
  type GooglePlacesLibrary,
} from "../../../lib/googleMaps";
import type { StopSuggestion } from "./types";

type StopSearchBoxProps = {
  stops: OperatorStop[];
  onPick: (result: StopSuggestion) => void;
  disabled?: boolean;
};

const MAX_OPERATOR_MATCHES = 5;
const MIN_QUERY_LENGTH = 2;
const GOOGLE_DEBOUNCE_MS = 300;

function operatorStopToSuggestion(stop: OperatorStop): StopSuggestion {
  return {
    kind: "operatorStop",
    id: stop.id,
    name: stop.name,
    address: stop.address ?? "",
    latitude: stop.latitude,
    longitude: stop.longitude,
    distanceFromStartKm: 0,
  };
}

export default function StopSearchBox({
  stops,
  onPick,
  disabled = false,
}: StopSearchBoxProps) {
  const { t } = useTranslation("manager");
  const [query, setQuery] = useState("");
  const [googleSuggestions, setGoogleSuggestions] = useState<
    GooglePlacePrediction[]
  >([]);
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);
  const placesLibraryRef = useRef<GooglePlacesLibrary | null>(null);
  const sessionTokenRef =
    useRef<GoogleAutocompleteSessionToken | null>(null);
  const requestSequenceRef = useRef(0);

  const trimmedQuery = query.trim();
  const isQueryLongEnough = trimmedQuery.length >= MIN_QUERY_LENGTH;

  const operatorMatches = useMemo(() => {
    if (!isQueryLongEnough) {
      return [];
    }

    const lowerQuery = trimmedQuery.toLowerCase();
    return stops
      .filter((stop) => stop.name.toLowerCase().includes(lowerQuery))
      .slice(0, MAX_OPERATOR_MATCHES);
  }, [isQueryLongEnough, stops, trimmedQuery]);

  // Nạp Google Places library một lần — thất bại (thiếu key/lỗi mạng) thì im
  // lặng, chỉ còn nhóm kho nhà xe hoạt động.
  useEffect(() => {
    let active = true;

    void loadGooglePlacesLibrary()
      .then((library) => {
        if (active) {
          placesLibraryRef.current = library;
        }
      })
      .catch(() => {
        placesLibraryRef.current = null;
      });

    return () => {
      active = false;
    };
  }, []);

  // Debounce 300ms cho nhánh Google — chỉ chạy khi library đã sẵn sàng.
  useEffect(() => {
    if (!isQueryLongEnough) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const library = placesLibraryRef.current;
      if (!library) {
        return;
      }

      const requestId = ++requestSequenceRef.current;
      sessionTokenRef.current ??= new library.AutocompleteSessionToken();

      void library.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        includedRegionCodes: ["vn"],
        input: trimmedQuery,
        language: "vi",
        region: "vn",
        sessionToken: sessionTokenRef.current,
      })
        .then((response) => {
          if (requestId !== requestSequenceRef.current) {
            return;
          }

          const predictions = response.suggestions
            .map((suggestion) => suggestion.placePrediction)
            .filter(
              (prediction): prediction is GooglePlacePrediction =>
                prediction !== undefined,
            );
          setGoogleSuggestions(predictions);
        })
        .catch(() => {
          if (requestId === requestSequenceRef.current) {
            setGoogleSuggestions([]);
          }
        });
    }, GOOGLE_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isQueryLongEnough, trimmedQuery]);

  function handleQueryChange(value: string) {
    setQuery(value);
    // Xoá gợi ý Google cũ ngay khi input ngắn lại dưới ngưỡng — tránh hiện
    // gợi ý cũ đứng yên trong lúc chờ hiệu ứng debounce mới.
    if (value.trim().length < MIN_QUERY_LENGTH) {
      setGoogleSuggestions([]);
    }
  }

  function handlePickOperatorStop(stop: OperatorStop) {
    onPick(operatorStopToSuggestion(stop));
    setQuery("");
    setGoogleSuggestions([]);
  }

  async function handlePickGooglePrediction(
    prediction: GooglePlacePrediction,
  ) {
    setIsResolvingPlace(true);

    try {
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: [
          "id",
          "displayName",
          "formattedAddress",
          "location",
          "addressComponents",
        ],
      });

      const latitude = place.location?.lat();
      const longitude = place.location?.lng();

      if (
        typeof latitude !== "number" ||
        typeof longitude !== "number" ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        return;
      }

      const address =
        place.formattedAddress ?? prediction.text.toString();
      const name =
        place.displayName ??
        prediction.mainText?.toString() ??
        address.split(",")[0]?.trim() ??
        address;
      const placeId = place.id ?? prediction.placeId;

      onPick({
        kind: "googlePlace",
        id: placeId,
        name,
        address,
        latitude,
        longitude,
        distanceFromStartKm: 0,
        googlePlaceId: placeId,
      });
      sessionTokenRef.current = null;
      setQuery("");
      setGoogleSuggestions([]);
    } finally {
      setIsResolvingPlace(false);
    }
  }

  const hasResults = operatorMatches.length > 0 || googleSuggestions.length > 0;

  return (
    <div className="space-y-2">
      <div className="relative">
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder={t("routes.stopSearchPlaceholder")}
          disabled={disabled || isResolvingPlace}
          autoComplete="off"
        />
      </div>

      {isQueryLongEnough && (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          {operatorMatches.length > 0 && (
            <div>
              <p className="px-3 pt-2 text-xs font-semibold uppercase text-gray-400">
                {t("routes.stopSearchGroupOperator")}
              </p>
              {operatorMatches.map((stop) => (
                <button
                  key={stop.id}
                  type="button"
                  onClick={() => handlePickOperatorStop(stop)}
                  disabled={disabled || isResolvingPlace}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-vr-50 disabled:opacity-60"
                >
                  <FiMapPin className="mt-0.5 shrink-0 text-vr-700" size={14} />
                  <span>
                    <span className="block font-semibold text-gray-900">
                      {stop.name}
                    </span>
                    {stop.address && (
                      <span className="block text-xs text-gray-500">
                        {stop.address}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}

          {googleSuggestions.length > 0 && (
            <div>
              <p className="px-3 pt-2 text-xs font-semibold uppercase text-gray-400">
                {t("routes.stopSearchGroupGoogle")}
              </p>
              {googleSuggestions.map((prediction) => (
                <button
                  key={prediction.placeId}
                  type="button"
                  onClick={() => void handlePickGooglePrediction(prediction)}
                  disabled={disabled || isResolvingPlace}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-vr-50 disabled:opacity-60"
                >
                  <FiMapPin className="mt-0.5 shrink-0 text-gray-400" size={14} />
                  <span>
                    <span className="block font-semibold text-gray-900">
                      {prediction.mainText?.toString() ??
                        prediction.text.toString()}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {prediction.secondaryText?.toString() ??
                        prediction.text.toString()}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {!hasResults && (
            <p className="px-3 py-2 text-sm text-gray-500">
              {t("routes.stopSearchEmpty")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
