// Bộ chọn thứ trong tuần — thay cho dropdown 4 preset cũ. BE nhận
// dayOfWeek là mảng ISO 1..7 tuỳ ý (CreateDriverScheduleValidator chỉ ràng
// NotEmpty + InclusiveBetween(1,7)), nên UI phải cho chọn tự do mọi tổ hợp.
import { useTranslation } from "react-i18next";
import { FieldLabel } from "./formControls";
import { isSameDayOfWeek, normalizeDayOfWeek } from "./tripHelpers";

const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const PRESETS: { key: string; days: number[] }[] = [
  { key: "daily", days: [1, 2, 3, 4, 5, 6, 7] },
  { key: "weekdays", days: [1, 2, 3, 4, 5] },
  { key: "weekend", days: [6, 7] },
];

export default function WeekdayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  const { t } = useTranslation("manager");
  const selected = normalizeDayOfWeek(value);

  function toggle(day: number) {
    onChange(
      selected.includes(day)
        ? selected.filter((item) => item !== day)
        : normalizeDayOfWeek([...selected, day]),
    );
  }

  // Khối riêng trải hết chiều ngang để phần "chạy thứ mấy" — khái niệm cốt lõi
  // của lịch lặp — nổi lên rõ, còn hàng chip giữ bề rộng vừa phải bên trong
  // (trải đủ 1180px thì mỗi chip rộng ~165px, nhìn giãn và xấu).
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
      {/* Nhãn và nhóm "chọn nhanh" cùng một hàng: tiết kiệm chiều dọc và cho
          thấy đây là hai cách thao tác trên cùng một thứ. */}
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <FieldLabel label={t("trips.weekdaysLabel")} required inline />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-gray-500">{t("trips.weekdayPresets")}</span>
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => onChange(preset.days)}
              className={`font-semibold transition hover:underline ${
                isSameDayOfWeek(selected, preset.days)
                  ? "text-vr-800 underline"
                  : "text-vr-600"
              }`}
            >
              {t(`trips.weekdayPreset.${preset.key}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid max-w-xl grid-cols-7 gap-1.5 sm:gap-2">
        {ISO_WEEKDAYS.map((day, index) => {
          const isOn = selected.includes(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={isOn}
              onClick={() => toggle(day)}
              className={`h-11 rounded-lg border text-sm font-semibold transition ${
                isOn
                  ? "border-vr-500 bg-vr-500 text-white shadow-sm"
                  : "border-gray-200 bg-white text-gray-600 hover:border-vr-300 hover:bg-vr-50"
              }`}
            >
              {t(`trips.weekdaysShort.${WEEKDAY_KEYS[index]}`)}
            </button>
          );
        })}
      </div>
      {/* Tắt hết thứ thì BE từ chối (validator DayOfWeek NotEmpty) — cảnh báo
          ngay tại chỗ thay vì đợi bấm lưu mới báo lỗi. */}
      {selected.length === 0 ? (
        <p className="mt-2 text-xs font-medium text-amber-700">
          {t("trips.weekdaysEmptyHint")}
        </p>
      ) : null}
    </div>
  );
}
