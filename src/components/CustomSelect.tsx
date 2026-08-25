import { createPortal } from "react-dom";
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { FiCheck, FiChevronDown, FiSearch } from "react-icons/fi";

type SelectChangeEvent = {
  target: {
    value: string;
  };
};

type OptionElementProps = {
  value?: string | number;
  disabled?: boolean;
  children?: ReactNode;
};

type CustomSelectOption = {
  value: string;
  label: ReactNode;
  text: string;
  disabled: boolean;
};

type CustomSelectProps = {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: SelectChangeEvent) => void;
  className?: string;
  allowWrap?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  children: ReactNode;
  "aria-label"?: string;
};

function getTextFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getTextFromNode).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getTextFromNode(node.props.children);
  }

  return "";
}

function toOptions(children: ReactNode): CustomSelectOption[] {
  return Children.toArray(children)
    .filter((child): child is ReactElement<OptionElementProps> =>
      isValidElement<OptionElementProps>(child),
    )
    .map((child) => {
      const text = getTextFromNode(child.props.children).trim();

      return {
        value:
          child.props.value === undefined ? text : String(child.props.value),
        label: child.props.children,
        text,
        disabled: Boolean(child.props.disabled),
      };
    });
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export default function CustomSelect({
  value,
  defaultValue,
  onChange,
  className = "",
  allowWrap = false,
  disabled = false,
  searchable = false,
  searchPlaceholder = "Search options",
  emptyMessage = "No matching options",
  children,
  "aria-label": ariaLabel,
}: CustomSelectProps) {
  const options = useMemo(() => toOptions(children), [children]);
  const fallbackValue = options.find((option) => !option.disabled)?.value ?? "";
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(
    String(defaultValue ?? value ?? fallbackValue),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const listboxId = useId();
  const selectedValue = String(isControlled ? value : internalValue);
  const selectedOption =
    options.find((option) => option.value === selectedValue) ?? options[0];
  const normalizedSearchTerm = normalizeSearchText(searchTerm);
  const visibleOptions = useMemo(
    () =>
      !searchable || !normalizedSearchTerm
        ? options
        : options.filter((option) =>
            normalizeSearchText(option.text).includes(normalizedSearchTerm),
          ),
    [normalizedSearchTerm, options, searchable],
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (isOpen && searchable) {
      searchInputRef.current?.focus();
    }
  }, [isOpen, searchable]);

  function commit(nextValue: string) {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onChange?.({ target: { value: nextValue } });
    setIsOpen(false);
    setSearchTerm("");
  }

  function moveActive(delta: number) {
    if (visibleOptions.length === 0) return;

    setActiveIndex((current) => {
      let next = current;

      for (let step = 0; step < visibleOptions.length; step += 1) {
        next =
          (next + delta + visibleOptions.length) % visibleOptions.length;
        if (!visibleOptions[next]?.disabled) return next;
      }

      return current;
    });
  }

  function updateMenuPosition() {
    const button = rootRef.current?.querySelector("button");
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const searchHeight = searchable ? 58 : 0;
    const preferredHeight = Math.min(
      346,
      Math.max(160, options.length * 42 + 8 + searchHeight),
    );
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openAbove = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(preferredHeight, openAbove ? spaceAbove : spaceBelow));
    const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 16);
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    setMenuPosition({ top: openAbove ? rect.top - maxHeight - 4 : rect.bottom + 4, left, width, maxHeight });
  }

  function openList() {
    setSearchTerm("");
    updateMenuPosition();
    setActiveIndex(
      Math.max(
        0,
        options.findIndex((option) => option.value === selectedValue),
      ),
    );
    setIsOpen(true);
  }

  function closeList(returnFocus = false) {
    setIsOpen(false);
    setSearchTerm("");
    if (returnFocus) {
      rootRef.current?.querySelector("button")?.focus();
    }
  }

  function handleSearchChange(nextSearchTerm: string) {
    setSearchTerm(nextSearchTerm);
    const normalizedQuery = normalizeSearchText(nextSearchTerm);
    const nextOptions = !normalizedQuery
      ? options
      : options.filter((option) =>
          normalizeSearchText(option.text).includes(normalizedQuery),
        );
    setActiveIndex(
      Math.max(
        0,
        nextOptions.findIndex((option) => !option.disabled),
      ),
    );
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const activeOption = visibleOptions[activeIndex];
      if (activeOption && !activeOption.disabled) {
        commit(activeOption.value);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeList(true);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) openList();
      moveActive(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) openList();
      moveActive(-1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isOpen) {
        const activeOption = visibleOptions[activeIndex];
        if (activeOption && !activeOption.disabled) commit(activeOption.value);
        return;
      }
      openList();
      return;
    }

    if (event.key === "Escape") {
      closeList();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => {
          if (isOpen) {
            closeList();
            return;
          }

          openList();
        }}
        onKeyDown={handleKeyDown}
        className={`${className} flex min-h-11 w-full items-center justify-between gap-3 text-left transition focus:border-vr-500 focus:ring-2 focus:ring-vr-500/30 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 disabled:opacity-100`}
      >
        <span className={`min-w-0 flex-1 ${allowWrap ? "whitespace-normal break-words" : "truncate"}`}>
          {selectedOption?.label ?? ""}
        </span>
        <FiChevronDown
          className={`shrink-0 text-vr-800 transition ${isOpen ? "rotate-180" : ""}`}
          size={17}
        />
      </button>

      {isOpen && !disabled && createPortal(
          <div
            ref={menuRef}
            className="fixed z-[100] flex flex-col overflow-hidden rounded-xl border border-vr-100 bg-white text-sm shadow-2xl shadow-vr-900/20"
            style={menuPosition ? { top: menuPosition.top, left: menuPosition.left, width: menuPosition.width, maxHeight: menuPosition.maxHeight } : undefined}
          >
          {searchable && (
            <div className="shrink-0 border-b border-gray-100 bg-white p-2">
              <div className="relative">
                <FiSearch
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  size={16}
                />
                <input
                  ref={searchInputRef}
                  role="combobox"
                  aria-label={searchPlaceholder}
                  aria-autocomplete="list"
                  aria-controls={listboxId}
                  aria-expanded="true"
                  aria-activedescendant={
                    visibleOptions[activeIndex]
                      ? `${listboxId}-option-${activeIndex}`
                      : undefined
                  }
                  value={searchTerm}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:border-vr-500 focus:bg-white focus:ring-2 focus:ring-vr-100"
                />
              </div>
            </div>
          )}
          <div
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            className="min-h-0 flex-1 overflow-auto p-1"
          >
          {visibleOptions.map((option, index) => {
            const isSelected = option.value === selectedValue;
            const isActive = index === activeIndex;

            return (
              <button
                key={`${option.value}-${index}`}
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(option.value)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:text-gray-500 ${
                  isSelected
                    ? "bg-vr-100 font-semibold text-vr-900"
                    : isActive
                      ? "bg-vr-50 text-gray-950"
                      : "text-gray-700 hover:bg-vr-50"
                }`}
              >
                <span className={`min-w-0 flex-1 ${allowWrap ? "whitespace-normal break-words" : "truncate"}`}>
                  {option.label}
                </span>
                {isSelected && <FiCheck className="shrink-0" size={16} />}
              </button>
            );
          })}
          {visibleOptions.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-500" role="status">
              {emptyMessage}
            </p>
          )}
          </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
