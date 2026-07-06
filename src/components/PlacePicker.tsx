import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { FiMapPin, FiSearch } from "react-icons/fi";

export type PlaceSelection = {
  placeId: string;
  name: string;
  address: string;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
};

type NominatimResult = {
  place_id?: number | string;
  osm_id?: number | string;
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, unknown>;
};

type PlacePickerProps = {
  label: string;
  placeholder: string;
  selectedPlace?: PlaceSelection | null;
  onSelect: (place: PlaceSelection) => void;
};

const defaultCenter: LatLngExpression = [10.7769, 106.7009];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseNominatimResult(value: unknown): PlaceSelection | null {
  if (!isRecord(value)) {
    return null;
  }

  const result = value as NominatimResult;
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const address = isRecord(result.address) ? result.address : {};
  const city =
    toStringValue(address.city) ||
    toStringValue(address.town) ||
    toStringValue(address.village) ||
    toStringValue(address.county);
  const province =
    toStringValue(address.state) ||
    toStringValue(address.province) ||
    toStringValue(address.region);
  const displayName = result.display_name ?? "";
  const name = result.name || displayName.split(",")[0]?.trim() || displayName;
  const placeId = String(result.place_id ?? result.osm_id ?? `${latitude},${longitude}`);

  return {
    placeId,
    name,
    address: displayName,
    city,
    province,
    latitude,
    longitude,
  };
}

function parseResults(payload: unknown) {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => parseNominatimResult(item))
    .filter((item): item is PlaceSelection => item !== null);
}

function MapFlyTo({ center }: { center: LatLngExpression }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, 14, { duration: 0.45 });
  }, [center, map]);

  return null;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export default function PlacePicker({
  label,
  placeholder,
  selectedPlace,
  onSelect,
}: PlacePickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSelection[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState("");

  const center = useMemo<LatLngExpression>(
    () =>
      selectedPlace
        ? [selectedPlace.latitude, selectedPlace.longitude]
        : defaultCenter,
    [selectedPlace],
  );

  async function searchPlaces() {
    if (!query.trim()) {
      setMessage("Nhập tên địa điểm để tìm kiếm.");
      return;
    }

    setIsSearching(true);
    setMessage("");

    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("limit", "6");
      url.searchParams.set("q", query.trim());
      const response = await fetch(url.toString());
      const payload: unknown = await response.json();
      const nextResults = parseResults(payload);
      setResults(nextResults);
      setMessage(nextResults.length ? "" : "Không tìm thấy địa điểm phù hợp.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể tìm địa điểm lúc này.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function reverseLookup(latitude: number, longitude: number) {
    setIsSearching(true);
    setMessage("");

    try {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("lat", String(latitude));
      url.searchParams.set("lon", String(longitude));
      const response = await fetch(url.toString());
      const payload: unknown = await response.json();
      const place = parseNominatimResult(payload);

      if (place) {
        onSelect(place);
        setResults([place]);
        setQuery(place.name);
      } else {
        setMessage("Không lấy được thông tin địa điểm đã chọn.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể lấy thông tin địa điểm đã chọn.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  function selectPlace(place: PlaceSelection) {
    onSelect(place);
    setQuery(place.name);
    setResults([]);
    setMessage("");
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
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
            />
          </div>
          <button
            type="button"
            onClick={() => void searchPlaces()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FiSearch size={16} />
            {isSearching ? "..." : "Tìm"}
          </button>
        </div>
      </label>

      {results.length > 0 && (
        <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 bg-white">
          {results.map((place) => (
            <button
              key={place.placeId}
              type="button"
              onClick={() => selectPlace(place)}
              className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-vr-50"
            >
              <span className="font-semibold text-gray-900">{place.name}</span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {place.address}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <MapContainer center={center} zoom={13} className="h-60 w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapFlyTo center={center} />
          <ClickHandler onPick={(lat, lon) => void reverseLookup(lat, lon)} />
          {selectedPlace && (
            <CircleMarker
              center={[selectedPlace.latitude, selectedPlace.longitude]}
              radius={8}
              pathOptions={{ color: "#0f766e", fillColor: "#14b8a6", fillOpacity: 0.85 }}
            />
          )}
        </MapContainer>
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
