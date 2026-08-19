import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiSearch } from "react-icons/fi";
import { searchStations, type Station } from "../../../api/vietride";

type StationSearchBoxProps = {
  selectedStation: Station | null;
  onClear: () => void;
  onSelect: (station: Station) => void;
};

export default function StationSearchBox({
  selectedStation,
  onClear,
  onSelect,
}: StationSearchBoxProps) {
  const { t } = useTranslation("manager");
  const [query, setQuery] = useState(selectedStation?.name ?? "");
  const [results, setResults] = useState<Station[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState("");
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    const input = query.trim();

    if (input === selectedStation?.name || input.length < 2) {
      return;
    }

    const requestId = ++requestSequenceRef.current;

    const timeoutId = window.setTimeout(() => {
      setIsSearching(true);
      setMessage("");

      void searchStations({ q: input })
        .then((stations) => {
          if (requestId !== requestSequenceRef.current) {
            return;
          }

          setResults(stations);
          setMessage(
            stations.length ? "" : t("routes.stationSearchNoResults"),
          );
        })
        .catch(() => {
          if (requestId === requestSequenceRef.current) {
            setResults([]);
            setMessage(t("routes.stationSearchFailed"));
          }
        })
        .finally(() => {
          if (requestId === requestSequenceRef.current) {
            setIsSearching(false);
          }
        });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [query, selectedStation?.name, t]);

  function handleQueryChange(value: string) {
    const input = value.trim();
    requestSequenceRef.current += 1;
    setQuery(value);
    setResults([]);
    setIsSearching(false);
    setMessage(
      input && input.length < 2 ? t("routes.stationSearchMinChars") : "",
    );

    if (selectedStation && value !== selectedStation.name) {
      onClear();
    }
  }

  function handleSelect(station: Station) {
    onSelect(station);
    setQuery(station.name);
    setResults([]);
    setMessage("");
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="sr-only">{t("routes.searchStations")}</span>
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            aria-label={t("routes.searchStations")}
            autoComplete="off"
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
            placeholder={t("routes.stationSearchPlaceholder")}
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
          />
        </div>
      </label>

      {isSearching && (
        <p className="text-xs text-gray-500">
          {t("routes.stationSearching")}
        </p>
      )}

      {results.length > 0 && (
        <div
          aria-label={t("routes.stationSearchResults")}
          className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-sm"
          role="listbox"
        >
          {results.map((station) => (
            <button
              key={station.id}
              aria-selected={station.id === selectedStation?.id}
              className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-vr-50"
              role="option"
              type="button"
              onClick={() => handleSelect(station)}
            >
              <span className="block font-semibold text-gray-900">
                {station.name}
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {[station.ward, station.city].filter(Boolean).join(", ")}
              </span>
            </button>
          ))}
        </div>
      )}

      {message && <p className="text-xs text-amber-700">{message}</p>}
    </div>
  );
}
