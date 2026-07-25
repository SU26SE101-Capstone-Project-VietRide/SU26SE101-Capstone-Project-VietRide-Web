import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FiMapPin, FiSearch } from "react-icons/fi";
import GoogleMapCanvas from "./GoogleMapCanvas";
import {
  loadGoogleGeocodingLibrary,
  loadGooglePlacesLibrary,
  type GoogleAutocompleteSessionToken,
  type GoogleGeocoderInstance,
  type GoogleGeocoderResult,
  type GoogleMapCoordinate,
  type GooglePlace,
  type GooglePlacePrediction,
  type GooglePlacesLibrary,
} from "../lib/googleMaps";
import { extractGoogleAddressParts } from "../lib/googlePlaces";

export type PlaceSelection = {
  placeId: string;
  name: string;
  address: string;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
};

type PlacePickerProps = {
  label: string;
  placeholder: string;
  selectedPlace?: PlaceSelection | null;
  onSelect: (place: PlaceSelection) => void;
};

type PlaceSuggestion = {
  label: string;
  mainText: string;
  placeId: string;
  prediction: GooglePlacePrediction;
  secondaryText: string;
};

const defaultCenter: GoogleMapCoordinate = {
  lat: 10.7769,
  lng: 106.7009,
};

function getCoordinate(place: GooglePlace) {
  const latitude = place.location?.lat();
  const longitude = place.location?.lng();

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return { latitude, longitude };
}

function placeToSelection(
  place: GooglePlace,
  prediction: GooglePlacePrediction,
) {
  const coordinate = getCoordinate(place);
  if (!coordinate) {
    return null;
  }

  const address = place.formattedAddress ?? prediction.text.toString();
  const addressParts = extractGoogleAddressParts(place.addressComponents);
  const name =
    place.displayName ??
    prediction.mainText?.toString() ??
    address.split(",")[0]?.trim() ??
    address;

  return {
    placeId: place.id ?? prediction.placeId,
    name,
    address,
    city: addressParts.city,
    province: addressParts.province,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
  } satisfies PlaceSelection;
}

function geocoderResultToSelection(
  result: GoogleGeocoderResult,
  fallbackPosition: GoogleMapCoordinate,
) {
  const latitude = result.geometry?.location?.lat() ?? fallbackPosition.lat;
  const longitude = result.geometry?.location?.lng() ?? fallbackPosition.lng;
  const address = result.formatted_address ?? `${latitude}, ${longitude}`;
  const addressParts = extractGoogleAddressParts(result.address_components);
  const name = address.split(",")[0]?.trim() || address;

  return {
    placeId: result.place_id ?? `${latitude},${longitude}`,
    name,
    address,
    city: addressParts.city,
    province: addressParts.province,
    latitude,
    longitude,
  } satisfies PlaceSelection;
}

function toSuggestion(prediction: GooglePlacePrediction): PlaceSuggestion {
  return {
    label: prediction.text.toString(),
    mainText:
      prediction.mainText?.toString() ?? prediction.text.toString(),
    placeId: prediction.placeId,
    prediction,
    secondaryText: prediction.secondaryText?.toString() ?? "",
  };
}

export default function PlacePicker({
  label,
  placeholder,
  selectedPlace,
  onSelect,
}: PlacePickerProps) {
  const selectedPlaceId = selectedPlace?.placeId ?? "";
  const selectedPlaceName = selectedPlace?.name ?? "";
  const [queryDraft, setQueryDraft] = useState({
    ownerPlaceId: selectedPlaceId,
    value: selectedPlaceName,
  });
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [placesLibrary, setPlacesLibrary] =
    useState<GooglePlacesLibrary | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState("");
  const requestSequenceRef = useRef(0);
  const sessionTokenRef =
    useRef<GoogleAutocompleteSessionToken | null>(null);
  const geocoderRef = useRef<GoogleGeocoderInstance | null>(null);
  const query =
    queryDraft.ownerPlaceId === selectedPlaceId
      ? queryDraft.value
      : selectedPlaceName;

  const center = useMemo<GoogleMapCoordinate>(
    () =>
      selectedPlace
        ? {
            lat: selectedPlace.latitude,
            lng: selectedPlace.longitude,
          }
        : defaultCenter,
    [selectedPlace],
  );

  const markers = useMemo(
    () =>
      selectedPlace
        ? [
            {
              color: "#14b8a6",
              description: [selectedPlace.address],
              id: selectedPlace.placeId,
              position: center,
              radiusMeters: 90,
              selected: true,
              title: selectedPlace.name,
            },
          ]
        : [],
    [center, selectedPlace],
  );

  useEffect(() => {
    let active = true;

    void loadGooglePlacesLibrary()
      .then((library) => {
        if (active) {
          setPlacesLibrary(library);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Không thể tải Google Places.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const searchPlaces = useCallback(
    async (rawQuery: string) => {
      const input = rawQuery.trim();
      if (input.length < 2) {
        setSuggestions([]);
        setMessage("Nhập ít nhất 2 ký tự để tìm địa điểm.");
        return;
      }

      if (!placesLibrary) {
        setMessage("Google Places đang được tải, vui lòng thử lại.");
        return;
      }

      const requestId = ++requestSequenceRef.current;
      sessionTokenRef.current ??=
        new placesLibrary.AutocompleteSessionToken();
      setIsSearching(true);
      setMessage("");

      try {
        const response =
          await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions(
            {
              includedRegionCodes: ["vn"],
              input,
              language: "vi",
              region: "vn",
              sessionToken: sessionTokenRef.current,
            },
          );

        if (requestId !== requestSequenceRef.current) {
          return;
        }

        const nextSuggestions = response.suggestions
          .map((suggestion) => suggestion.placePrediction)
          .filter(
            (prediction): prediction is GooglePlacePrediction =>
              prediction !== undefined,
          )
          .map(toSuggestion);
        setSuggestions(nextSuggestions);
        setMessage(
          nextSuggestions.length
            ? ""
            : "Không tìm thấy địa điểm phù hợp tại Việt Nam.",
        );
      } catch (error) {
        if (requestId === requestSequenceRef.current) {
          setSuggestions([]);
          setMessage(
            error instanceof Error
              ? error.message
              : "Không thể tìm địa điểm lúc này.",
          );
        }
      } finally {
        if (requestId === requestSequenceRef.current) {
          setIsSearching(false);
        }
      }
    },
    [placesLibrary],
  );

  useEffect(() => {
    const input = query.trim();
    if (
      input.length < 2 ||
      input === selectedPlaceName ||
      !placesLibrary
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void searchPlaces(input);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [placesLibrary, query, searchPlaces, selectedPlaceName]);

  async function selectSuggestion(suggestion: PlaceSuggestion) {
    const requestId = ++requestSequenceRef.current;
    setIsSearching(true);
    setMessage("");

    try {
      const place = suggestion.prediction.toPlace();
      await place.fetchFields({
        fields: [
          "id",
          "displayName",
          "formattedAddress",
          "location",
          "addressComponents",
        ],
      });
      const selection = placeToSelection(place, suggestion.prediction);

      if (!selection) {
        throw new Error("Google Places chưa trả về tọa độ cho địa điểm này.");
      }

      onSelect(selection);
      sessionTokenRef.current = null;
      setQueryDraft({
        ownerPlaceId: selection.placeId,
        value: selection.name,
      });
      setSuggestions([]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể lấy chi tiết địa điểm đã chọn.",
      );
    } finally {
      if (requestId === requestSequenceRef.current) {
        setIsSearching(false);
      }
    }
  }

  const reverseLookup = useCallback(
    async (position: GoogleMapCoordinate) => {
      const requestId = ++requestSequenceRef.current;
      setIsSearching(true);
      setMessage("");

      try {
        if (!geocoderRef.current) {
          const geocodingLibrary = await loadGoogleGeocodingLibrary();
          geocoderRef.current = new geocodingLibrary.Geocoder();
        }

        const response = await geocoderRef.current.geocode({
          language: "vi",
          location: position,
          region: "VN",
        });
        const result = response.results[0];
        if (!result) {
          throw new Error(
            "Không lấy được thông tin tại vị trí đã chọn trên bản đồ.",
          );
        }

        const selection = geocoderResultToSelection(result, position);
        onSelect(selection);
        sessionTokenRef.current = null;
        setQueryDraft({
          ownerPlaceId: selection.placeId,
          value: selection.name,
        });
        setSuggestions([]);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Không thể lấy thông tin vị trí đã chọn.",
        );
      } finally {
        if (requestId === requestSequenceRef.current) {
          setIsSearching(false);
        }
      }
    },
    [onSelect],
  );

  function handleQueryChange(value: string) {
    setQueryDraft({
      ownerPlaceId: selectedPlaceId,
      value,
    });
    setMessage("");
  }

  function handleManualSearch() {
    void searchPlaces(query);
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">
          {label}
        </span>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleManualSearch();
                }
              }}
              placeholder={placeholder}
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            onClick={handleManualSearch}
            disabled={isSearching || !placesLibrary}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <FiSearch size={16} />
            {isSearching ? "Đang tìm..." : "Tìm"}
          </button>
        </div>
      </label>

      {suggestions.length > 0 && (
        <div
          className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm"
          role="listbox"
          aria-label="Kết quả tìm địa điểm"
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.placeId}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => void selectSuggestion(suggestion)}
              className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-vr-50"
            >
              <span className="font-semibold text-gray-900">
                {suggestion.mainText}
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {suggestion.secondaryText || suggestion.label}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <GoogleMapCanvas
          ariaLabel={`Bản đồ chọn ${label.toLowerCase()}`}
          center={center}
          focusCenter={selectedPlace ? center : null}
          markers={markers}
          onMapClick={reverseLookup}
          scrollWheelZoom
          zoom={13}
          className="h-60 w-full"
          emptyState="Tìm địa điểm hoặc bấm trực tiếp lên bản đồ để chọn."
        />
      </div>

      {selectedPlace && (
        <div className="rounded-lg border border-vr-100 bg-vr-50 px-3 py-2 text-sm text-vr-900">
          <div className="flex gap-2">
            <FiMapPin className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">{selectedPlace.name}</p>
              <p className="mt-0.5 text-xs text-vr-800">
                {selectedPlace.address}
              </p>
            </div>
          </div>
        </div>
      )}

      {message && <p className="text-xs text-amber-700">{message}</p>}
    </div>
  );
}
