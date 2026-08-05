// Ô nhập thời lượng theo giờ + phút, giá trị quy đổi tổng số phút
import {
  inputClass,
  labelClass,
} from "../../../components/form/formClasses";
import { toNumber } from "../../../utils/number";

type DurationInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hourLabel: string;
  minuteLabel: string;
  disabled?: boolean;
};

export default function DurationInput({
  label,
  value,
  onChange,
  hourLabel,
  minuteLabel,
  disabled = false,
}: DurationInputProps) {
  const totalMinutes = Math.max(0, Math.round(value));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <label className="relative">
          <span className="sr-only">{hourLabel}</span>
          <input
            className={`${inputClass} pr-12`}
            value={hours}
            type="number"
            min={0}
            disabled={disabled}
            onChange={(event) =>
              onChange(Math.max(0, Math.floor(toNumber(event.target.value))) * 60 + minutes)
            }
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            {hourLabel}
          </span>
        </label>
        <label className="relative">
          <span className="sr-only">{minuteLabel}</span>
          <input
            className={`${inputClass} pr-14`}
            value={minutes}
            type="number"
            min={0}
            max={59}
            disabled={disabled}
            onChange={(event) => {
              const nextMinutes = Math.min(
                59,
                Math.max(0, Math.floor(toNumber(event.target.value))),
              );
              onChange(hours * 60 + nextMinutes);
            }}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            {minuteLabel}
          </span>
        </label>
      </div>
    </div>
  );
}
