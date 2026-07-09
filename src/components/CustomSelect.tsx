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
import { FiCheck, FiChevronDown } from "react-icons/fi";

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
  disabled?: boolean;
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

export default function CustomSelect({
  value,
  defaultValue,
  onChange,
  className = "",
  disabled = false,
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
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedValue = String(isControlled ? value : internalValue);
  const selectedOption =
    options.find((option) => option.value === selectedValue) ?? options[0];

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function commit(nextValue: string) {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onChange?.({ target: { value: nextValue } });
    setIsOpen(false);
  }

  function moveActive(delta: number) {
    if (options.length === 0) return;

    setActiveIndex((current) => {
      let next = current;

      for (let step = 0; step < options.length; step += 1) {
        next = (next + delta + options.length) % options.length;
        if (!options[next]?.disabled) return next;
      }

      return current;
    });
  }

  function openList() {
    setActiveIndex(
      Math.max(
        0,
        options.findIndex((option) => option.value === selectedValue),
      ),
    );
    setIsOpen(true);
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
        const activeOption = options[activeIndex];
        if (activeOption && !activeOption.disabled) commit(activeOption.value);
        return;
      }
      openList();
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
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
            setIsOpen(false);
            return;
          }

          openList();
        }}
        onKeyDown={handleKeyDown}
        className={`${className} flex min-h-11 w-full items-center justify-between gap-3 text-left transition focus:border-vr-700 focus:outline-none focus:ring-2 focus:ring-vr-500/30 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:opacity-100`}
      >
        <span className="min-w-0 flex-1 truncate">
          {selectedOption?.label ?? ""}
        </span>
        <FiChevronDown
          className={`shrink-0 text-vr-800 transition ${isOpen ? "rotate-180" : ""}`}
          size={17}
        />
      </button>

      {isOpen && !disabled && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-vr-100 bg-white p-1 text-sm shadow-xl shadow-vr-900/10"
        >
          {options.map((option, index) => {
            const isSelected = option.value === selectedValue;
            const isActive = index === activeIndex;

            return (
              <button
                key={`${option.value}-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(option.value)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:text-gray-400 ${
                  isSelected
                    ? "bg-vr-100 font-semibold text-vr-900"
                    : isActive
                      ? "bg-vr-50 text-gray-950"
                      : "text-gray-700 hover:bg-vr-50"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">
                  {option.label}
                </span>
                {isSelected && <FiCheck className="shrink-0" size={16} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
