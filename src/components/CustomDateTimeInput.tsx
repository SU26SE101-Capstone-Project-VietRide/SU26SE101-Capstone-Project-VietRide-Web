import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";
import {
  SKIN_CLASS_PATTERNS,
  stripSkinClasses,
} from "./ui/controlClasses";

// Khoảng hở tối thiểu giữa bảng lịch và mép màn hình
const viewportPadding = 8;
// Khoảng cách giữa ô nhập và bảng lịch
const triggerGap = 4;
// Dưới mức này thì bảng cuộn cũng không dùng được — thà để nó tràn nhẹ còn hơn
// ép thành một khe nhìn không ra gì
const minCalendarHeight = 220;

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
  /**
   * Bật viền báo lỗi. Phải là prop chứ không phải class truyền vào
   * `className`: `stripSkinClasses` lọc mất mọi `border-*` của call site.
   */
  invalid?: boolean;
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
  invalid = false,
  "aria-label": ariaLabel,
}: CustomDateTimeInputProps) {
  /*
    Skin bám sát `CustomSelect` vì hai ô này luôn đứng cạnh nhau trên cùng một
    hàng lọc — lệch bo góc hay lệch chiều cao là thấy ngay. Class của call site
    đi qua `stripSkinClasses` nên chỉ phần bố cục (bề rộng, cột grid) còn tác
    dụng; trước đây chuỗi `inputClass` của từng màn đè lên đây, khiến sửa
    component không màn nào đổi.
  */
  const mergedTriggerClassName = [
    "flex min-h-[50px] w-full items-center justify-between gap-3 rounded-[9999px] border border-[#bfe1ec] bg-white px-4 py-3 text-left text-[17px] font-medium text-slate-700 shadow-[0_0_0_1px_rgba(175,219,234,0.18)] transition focus:border-[#2bb7b0] focus:outline-none focus:ring-4 focus:ring-[#dff7f5] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 disabled:opacity-100",
    stripSkinClasses(className, [...SKIN_CLASS_PATTERNS, /^px(?:-|$)/]),
    invalid ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "",
  ]
    .filter(Boolean)
    .join(" ");

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
  const [calendarPosition, setCalendarPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const monthDays = useMemo(() => getMonthDays(cursor), [cursor]);
  const weekDays = useMemo(
    () =>
      [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ].map((day) => t(`dateTimePicker.weekdays.${day}`)),
    [t],
  );
  const monthLabel = new Intl.DateTimeFormat(
    i18n?.resolvedLanguage || i18n?.language,
    {
      month: "long",
      year: "numeric",
    },
  ).format(cursor);
  const isTimeOnly = type === "time";
  const isDateOnly = type === "date" || type === "month" || type === "week";
  const minDateValue = min?.split("T")[0];
  const maxDateValue = max?.split("T")[0];

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        !rootRef.current?.contains(event.target as Node) &&
        !calendarRef.current?.contains(event.target as Node)
      ) {
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
      commit(
        `${dateValue}T${toTimeValue(selectedTime.hour, selectedTime.minute)}`,
      );
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

  const updateCalendarPosition = useCallback(() => {
    const button = triggerRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const width =
      !isTimeOnly && !isDateOnly
        ? Math.min(560, window.innerWidth - 16)
        : Math.min(352, window.innerWidth - 16);

    // Đo bảng lịch THẬT khi nó đã render. Lần mở đầu tiên chưa có gì để đo nên
    // đành ước lượng — nhưng chỉ ước lượng một nhịp, `useLayoutEffect` bên dưới
    // đo lại ngay trước khi trình duyệt vẽ. `scrollHeight` là chiều cao NỘI
    // DUNG (không bị `maxHeight` cắt), nếu không thì lần tính sau lại lấy chính
    // chiều cao đã bị kẹp làm chuẩn và bảng không bao giờ bung lại được.
    const measured = calendarRef.current?.scrollHeight ?? 0;
    const height = measured > 0 ? measured : isTimeOnly ? 260 : 460;

    const spaceBelow =
      window.innerHeight - rect.bottom - triggerGap - viewportPadding;
    const spaceAbove = rect.top - triggerGap - viewportPadding;
    // Mở lên trên khi bên dưới không đủ mà bên trên rộng hơn. Bản cũ đòi bên
    // trên phải chứa TRỌN bảng mới chịu mở lên; cả hai bên đều thiếu thì nó rơi
    // vào nhánh mở xuống, tràn khỏi màn hình, và không có gì kẹp lại — mấy hàng
    // ngày cuối cùng với nút Xong nằm ngoài tầm với, đúng như bảng giá cước
    // hàng hoá với ô "Hiệu lực từ" nằm sát đáy hộp thoại.
    const openAbove = height > spaceBelow && spaceAbove > spaceBelow;
    // Không bên nào chứa nổi thì bảng tự cuộn trong phần chỗ nó có
    const maxHeight = Math.max(
      minCalendarHeight,
      openAbove ? spaceAbove : spaceBelow,
    );
    const boxHeight = Math.min(height, maxHeight);
    const top = openAbove
      ? rect.top - triggerGap - boxHeight
      : Math.min(
          rect.bottom + triggerGap,
          window.innerHeight - viewportPadding - boxHeight,
        );

    setCalendarPosition({
      top: Math.max(viewportPadding, top),
      left: Math.min(
        Math.max(viewportPadding, rect.left),
        window.innerWidth - width - viewportPadding,
      ),
      width,
      maxHeight,
    });
  }, [isDateOnly, isTimeOnly]);

  // Đặt lại vị trí NGAY SAU khi bảng render (đo được chiều cao thật), và bám
  // theo khi cửa sổ đổi kích thước hay có gì đó cuộn — ô nhập nằm trong hộp
  // thoại cuộn được, mà bảng lịch thì `fixed` nên nó không tự đi theo.
  useLayoutEffect(() => {
    if (!isOpen || disabled) {
      return;
    }

    updateCalendarPosition();

    const reposition = () => updateCalendarPosition();
    window.addEventListener("resize", reposition);
    // `true` để bắt cả cuộn bên trong hộp thoại, không riêng cuộn trang
    window.addEventListener("scroll", reposition, true);

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [disabled, isOpen, updateCalendarPosition]);

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

      setCursor(
        new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
      );
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

          setCursor(
            new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
          );
          updateCalendarPosition();
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={mergedTriggerClassName}
      >
        <span className={selectedValue ? "text-gray-900" : "text-gray-500"}>
          {displayValue(selectedValue, type) ||
            placeholder ||
            t("dateTimePicker.selectDate")}
        </span>
        {isTimeOnly ? (
          <FiClock className="shrink-0 text-vr-800" size={17} />
        ) : (
          <FiCalendar className="shrink-0 text-vr-800" size={17} />
        )}
      </button>

      {isOpen &&
        !disabled &&
        createPortal(
          <div
            ref={calendarRef}
            data-testid="datetime-picker-panel"
            // `overflow-y-auto`: khi màn hình quá thấp để chứa trọn bảng thì cuộn
            // BÊN TRONG bảng, thay vì để phần dưới tràn ra ngoài màn hình
            className={`fixed z-[100] max-w-full overflow-y-auto overscroll-contain rounded-xl border border-vr-100 bg-white p-3 text-sm shadow-2xl shadow-vr-900/20 ${
              !isTimeOnly && !isDateOnly
                ? "w-[min(35rem,calc(100vw-2rem))]"
                : "w-[min(22rem,calc(100vw-2rem))]"
            }`}
            style={
              calendarPosition
                ? {
                    top: calendarPosition.top,
                    left: calendarPosition.left,
                    width: calendarPosition.width,
                    maxHeight: calendarPosition.maxHeight,
                  }
                : undefined
            }
          >
            <div
              className={
                !isTimeOnly && !isDateOnly
                  ? "grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]"
                  : ""
              }
            >
              {!isTimeOnly && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        setCursor(
                          new Date(
                            cursor.getFullYear(),
                            cursor.getMonth() - 1,
                            1,
                          ),
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
                          new Date(
                            cursor.getFullYear(),
                            cursor.getMonth() + 1,
                            1,
                          ),
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
                      const isCurrentMonth =
                        date.getMonth() === cursor.getMonth();
                      const isSelected =
                        dateValue === toDateValue(selectedDate);
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
                                ? "bg-vr-800 font-bold text-white shadow-sm"
                                : isCurrentMonth
                                  ? "text-gray-800 hover:bg-vr-50"
                                  : "text-gray-500 hover:bg-gray-50"
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
                      onChange={(minute) =>
                        commitTime(selectedTime.hour, minute)
                      }
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
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  // Cột phút có 60 dòng mà khung chỉ cao ~5 dòng, nên giá trị đang chọn gần như
  // luôn nằm ngoài tầm nhìn khi mở bảng chọn — không kéo nó vào thì đổi từ bước
  // 5 phút sang từng phút lại thành khó dùng hơn trước. `block: "nearest"` để
  // chỉ cuộn trong khung này, không kéo cả trang.
  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [value]);

  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-gray-500">{label}</p>
      <div className="max-h-40 overflow-auto rounded-lg border border-gray-100 p-1">
        {values.map((item) => (
          <button
            key={item}
            ref={item === value ? selectedRef : undefined}
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
