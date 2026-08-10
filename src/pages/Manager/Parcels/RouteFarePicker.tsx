import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  FiCheck,
  FiChevronDown,
  FiLoader,
  FiSearch,
} from "react-icons/fi";
import type { OperatorRoute } from "../../../api/vietride";
import type { RouteFareSummary } from "./parcelFareHelpers";

export type RouteFarePickerOption = {
  route: OperatorRoute;
  summary: RouteFareSummary;
};

type RouteFarePickerProps = {
  selectedRoute: OperatorRoute | null;
  options: RouteFarePickerOption[];
  query: string;
  totalItems: number;
  isLoading: boolean;
  hasMore: boolean;
  disabled?: boolean;
  onQueryChange: (query: string) => void;
  onSelect: (option: RouteFarePickerOption) => void;
  onLoadMore: () => void;
};

const statusClass: Record<RouteFareSummary["status"], string> = {
  UNPRICED: "bg-slate-100 text-slate-600",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  SCHEDULED: "bg-blue-50 text-blue-700",
  EXPIRED: "bg-slate-100 text-slate-500",
  INCOMPLETE: "bg-amber-50 text-amber-700",
};

export function RouteFarePicker({
  selectedRoute,
  options,
  query,
  totalItems,
  isLoading,
  hasMore,
  disabled = false,
  onQueryChange,
  onSelect,
  onLoadMore,
}: RouteFarePickerProps) {
  const { t } = useTranslation("manager");
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] =
    useState<CSSProperties | null>(null);

  const updateDropdownPosition = useCallback(() => {
    const anchor = containerRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const viewportPadding = 16;
    const gap = 8;
    const availableBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const availableAbove = rect.top - gap - viewportPadding;
    const opensAbove = availableBelow < 260 && availableAbove > availableBelow;
    const availableHeight = opensAbove ? availableAbove : availableBelow;
    const width = Math.min(
      rect.width,
      Math.max(0, window.innerWidth - viewportPadding * 2),
    );
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
    );

    setDropdownPosition({
      left,
      width,
      maxHeight: Math.max(160, Math.min(360, availableHeight)),
      ...(opensAbove
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target) &&
        !dropdownRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleViewportChange(event: Event) {
      if (
        event.type === "scroll" &&
        event.target instanceof Node &&
        dropdownRef.current?.contains(event.target)
      ) {
        return;
      }
      updateDropdownPosition();
    }

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen, updateDropdownPosition]);

  function openPicker() {
    if (disabled) return;
    if (!isOpen) setActiveIndex(0);
    updateDropdownPosition();
    setIsOpen(true);
    if (selectedRoute && !isOpen) {
      onQueryChange("");
    }
  }

  function selectOption(option: RouteFarePickerOption) {
    if (!option.route.isActive) return;
    onSelect(option);
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      updateDropdownPosition();
      setIsOpen(true);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) =>
        Math.min(Math.max(current + direction, 0), Math.max(options.length - 1, 0)),
      );
      return;
    }

    if (event.key === "Enter" && isOpen && options[activeIndex]) {
      event.preventDefault();
      selectOption(options[activeIndex]);
    }
  }

  const displayValue = isOpen ? query : selectedRoute?.name ?? query;

  return (
    <>
      <div ref={containerRef} className="relative">
        <div className="relative">
        <FiSearch
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          size={17}
        />
        <input
          role="combobox"
          aria-label={t("parcels.route")}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            isOpen && options[activeIndex]
              ? `${listboxId}-${options[activeIndex].route.id}`
              : undefined
          }
          value={displayValue}
          disabled={disabled}
          placeholder={t("parcels.routeSearchPlaceholder")}
          onFocus={openPicker}
          onClick={openPicker}
          onKeyDown={handleKeyDown}
          onChange={(event) => {
            updateDropdownPosition();
            setIsOpen(true);
            setActiveIndex(0);
            onQueryChange(event.target.value);
          }}
          className="min-h-12 w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-11 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-vr-500 focus:ring-2 focus:ring-vr-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-600"
        />
        <FiChevronDown
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition ${
            isOpen ? "rotate-180" : ""
          }`}
          size={18}
        />
        </div>
      </div>

      {isOpen &&
        !disabled &&
        dropdownPosition &&
        createPortal(
        <div
          ref={dropdownRef}
          style={dropdownPosition}
          className="fixed z-[70] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        >
          <div
            id={listboxId}
            role="listbox"
            className="min-h-0 flex-1 overflow-y-auto p-1.5"
          >
            {options.map((option, index) => {
              const { route, summary } = option;
              const stationPair =
                route.originStation?.name && route.destinationStation?.name
                  ? `${route.originStation.name} → ${route.destinationStation.name}`
                  : "";

              return (
                <button
                  id={`${listboxId}-${route.id}`}
                  key={route.id}
                  type="button"
                  role="option"
                  disabled={!route.isActive}
                  aria-selected={selectedRoute?.id === route.id}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                  className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${
                    index === activeIndex
                      ? "bg-vr-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold leading-5 text-gray-900">
                      {route.name}
                    </span>
                    {stationPair && (
                      <span className="mt-0.5 block break-words text-xs leading-4 text-gray-500">
                        {stationPair}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass[summary.status]}`}
                    >
                      {!route.isActive
                        ? t("parcels.routeInactive")
                        : summary.status === "INCOMPLETE"
                        ? t("parcels.routeFareStatus.INCOMPLETE", {
                            count: summary.configuredSizeCount,
                          })
                        : t(`parcels.routeFareStatus.${summary.status}`)}
                    </span>
                    {selectedRoute?.id === route.id && (
                      <FiCheck className="mt-0.5 text-vr-600" size={16} />
                    )}
                  </span>
                </button>
              );
            })}

            {!isLoading && options.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-gray-500">
                {t("parcels.routeSearchEmpty")}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-3 py-2.5">
            <span className="text-xs text-gray-500">
              {t("parcels.routeSearchCount", {
                shown: options.length,
                total: totalItems,
              })}
            </span>
            {isLoading ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-vr-700">
                <FiLoader className="animate-spin" />
                {t("parcels.routeSearchLoading")}
              </span>
            ) : hasMore ? (
              <button
                type="button"
                onClick={onLoadMore}
                className="text-xs font-semibold text-vr-700 hover:text-vr-800"
              >
                {t("parcels.routeSearchMore")}
              </button>
            ) : null}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
