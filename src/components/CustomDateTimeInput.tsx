import { createPortal } from "react-dom";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { FiCalendar, FiChevronLeft, FiChevronRight, FiClock } from "react-icons/fi";
import { useTranslation } from "react-i18next";

type DateTimeChangeEvent = {
  target: {
    value: string;
  };
};

type CustomDateTimeInputProps = {
  type: "date" | "datetime-local" | "time" | "month" | "week";
  value?: string;
  defaultValue?: string;
  onChange?: (event: DateTimeChangeEvent) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  min?: string;
  max?: string;
  "aria-label"?: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeValue(hour: number, minute: number) {
  return `${pad(hour)}:${pad(minute)}`;
}

function parseDatePart(value?: string) {
  const [datePart] = (value ?? "").split("T");
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(datePart);

  if (!match) return null;

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function parseTimePart(value?: string) {
  const timePart = value?.includes("T") ? value.split("T")[1] : value;
  const match = /^(\d{2}):(\d{2})/.exec(timePart ?? "");

  return {
    hour: match ? Number(match[1]) : 9,
    minute: match ? Number(match[2]) : 0,
  };
}

function displayValue(value: string, type: CustomDateTimeInputProps["type"]) {
  if (!value) return "";

  if (type === "datetime-local") {
    const [datePart, timePart] = value.split("T");
    return `${datePart ?? ""} ${timePart ?? ""}`.trim();
  }

  return value;
}

function getMonthDays(cursor: Date) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export default function CustomDateTimeInput({
  type,
  value,
  defaultValue,
  onChange,
  className = "",
  disabled = false,
  placeholder,
  min,
  max,
  "aria-label": ariaLabel,
}: CustomDateTimeInputProps) {
  const { t, i18n } = useTranslation("common");
  const isControlled = value !== undefined;
  const initialValue = value ?? defaultValue ?? "";
  const [internalValue, setInternalValue] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const selectedValue = isControlled ? (value ?? "") : internalValue;
  const selectedDate = useMemo(
    () => parseDatePart(selectedValue) ?? new Date(),
    [selectedValue],
  );
  const selectedTime = parseTimePart(selectedValue);
  const [cursor, setCursor] = useState(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [calendarPosition, setCalendarPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const monthDays = useMemo(() => getMonthDays(cursor), [cursor]);
  const weekDays = useMemo(
    () => ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map((day) => t(`dateTimePicker.weekdays.${day}`)),
    [t],
  );
  const monthLabel = new Intl.DateTimeFormat(i18n?.resolvedLanguage || i18n?.language, {
    month: "long",
    year: "numeric",
  }).format(cursor);
  const isTimeOnly = type === "time";
  const isDateOnly = type === "date" || type === "month" || type === "week";
  const minDateValue = min?.split("T")[0];
  const maxDateValue = max?.split("T")[0];

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node) && !calendarRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function isDateOutsideRange(dateValue: string) {
    return Boolean(
      (minDateValue && dateValue < minDateValue) ||
      (maxDateValue && dateValue > maxDateValue),
    );
  }

  function commit(nextValue: string, close = false) {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onChange?.({ target: { value: nextValue } });
    if (close) setIsOpen(false);
  }

  function commitDate(date: Date) {
    const dateValue = toDateValue(date);

    if (isDateOutsideRange(dateValue)) return;

    if (type === "datetime-local") {
      commit(`${dateValue}T${toTimeValue(selectedTime.hour, selectedTime.minute)}`);
      return;
    }

    commit(dateValue, true);
  }

  function commitTime(hour: number, minute: number) {
    const timeValue = toTimeValue(hour, minute);

    if (type === "datetime-local") {
      commit(`${toDateValue(selectedDate)}T${timeValue}`);
      return;
    }

    commit(timeValue, true);
  }

  function updateCalendarPosition() {
    const button = triggerRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = !isTimeOnly && !isDateOnly ? Math.min(560, window.innerWidth - 16) : Math.min(352, window.innerWidth - 16);
    const height = isTimeOnly ? 260 : isDateOnly ? 420 : 420;
    const openAbove = window.innerHeight - rect.bottom < height + 16 && rect.top > height + 16;
    setCalendarPosition({ top: openAbove ? rect.top - height : rect.bottom, left: Math.min(rect.left, window.innerWidth - width - 8), width });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isOpen) {
        setIsOpen(false);
        return;
      }

      setCursor(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
            updateCalendarPosition();
      setIsOpen(true);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            return;
          }

          setCursor(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
          updateCalendarPosition();
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={`${className} flex min-h-11 w-full items-center justify-between gap-3 text-left transition focus:border-vr-700 focus:outline-none focus:ring-2 focus:ring-vr-500/30 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:opacity-100`}
      >
        <span className={selectedValue ? "text-gray-900" : "text-gray-400"}>
          {displayValue(selectedValue, type) || placeholder || t("dateTimePicker.selectDate")}
        </span>
        {isTimeOnly ? (
          <FiClock className="shrink-0 text-vr-800" size={17} />
        ) : (
          <FiCalendar className="shrink-0 text-vr-800" size={17} />
        )}
      </button>

      {isOpen && !disabled && createPortal(
        <div
          ref={calendarRef}
          className={`fixed z-[100] max-w-full rounded-xl border border-vr-100 bg-white p-3 text-sm shadow-2xl shadow-vr-900/20 ${
            !isTimeOnly && !isDateOnly
              ? "w-[min(35rem,calc(100vw-2rem))]"
              : "w-[min(22rem,calc(100vw-2rem))]"
          }`}
          style={calendarPosition ? { top: calendarPosition.top, left: calendarPosition.left, width: calendarPosition.width } : undefined}
        >
          <div
            className={!isTimeOnly && !isDateOnly ? "grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]" : ""}
          >
          {!isTimeOnly && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setCursor(
                      new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
                    )
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-vr-50 hover:text-vr-900"
                  aria-label={t("dateTimePicker.previousMonth")}
                >
                  <FiChevronLeft size={18} />
                </button>
                <p className="font-semibold text-gray-900">{monthLabel}</p>
                <button
                  type="button"
                  onClick={() =>
                    setCursor(
                      new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
                    )
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-vr-50 hover:text-vr-900"
                  aria-label={t("dateTimePicker.nextMonth")}
                >
                  <FiChevronRight size={18} />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500">
                {weekDays.map((day) => (
                  <span key={day} className="py-1">
                    {day}
                  </span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {monthDays.map((date) => {
                  const dateValue = toDateValue(date);
                  const isCurrentMonth = date.getMonth() === cursor.getMonth();
                  const isSelected = dateValue === toDateValue(selectedDate);
                  const isDateDisabled = isDateOutsideRange(dateValue);

                  return (
                    <button
                      key={dateValue}
                      type="button"
                      aria-label={dateValue}
                      disabled={isDateDisabled}
                      onClick={() => commitDate(date)}
                      className={`h-9 rounded-lg text-sm transition ${
                        isDateDisabled
                          ? "cursor-not-allowed text-gray-300"
                          : isSelected
                            ? "bg-vr-600 font-bold text-white shadow-sm"
                            : isCurrentMonth
                              ? "text-gray-800 hover:bg-vr-50"
                              : "text-gray-400 hover:bg-gray-50"
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!isDateOnly && (
            <div
              className={
                isTimeOnly
                  ? ""
                  : "border-t border-gray-100 pt-4 md:border-l md:border-t-0 md:pl-4 md:pt-0"
              }
            >
              <div className="grid grid-cols-2 gap-3">
                <TimeColumn
                  label={t("dateTimePicker.hour")}
                  value={selectedTime.hour}
                  max={23}
                  onChange={(hour) => commitTime(hour, selectedTime.minute)}
                />
                <TimeColumn
                  label={t("dateTimePicker.minute")}
                  value={selectedTime.minute}
                  max={59}
                  step={5}
                  onChange={(minute) => commitTime(selectedTime.hour, minute)}
                />
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-vr-950 hover:bg-vr-600"
                >
                  {t("dateTimePicker.done")}
                </button>
              </div>
            </div>
          )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function TimeColumn({
  label,
  value,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const values = Array.from(
    { length: Math.floor(max / step) + 1 },
    (_, index) => index * step,
  );

  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-gray-500">{label}</p>
      <div className="max-h-40 overflow-auto rounded-lg border border-gray-100 p-1">
        {values.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={`block w-full rounded-md px-2 py-1.5 text-center ${
              item === value
                ? "bg-vr-100 font-bold text-vr-900"
                : "text-gray-700 hover:bg-vr-50"
            }`}
          >
            {pad(item)}
          </button>
        ))}
      </div>
    </div>
  );
}
