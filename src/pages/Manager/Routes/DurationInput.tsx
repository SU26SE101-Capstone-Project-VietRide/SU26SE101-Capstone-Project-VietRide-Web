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
  segmentedUnits?: boolean;
};

export default function DurationInput({
  label,
  value,
  onChange,
  hourLabel,
  minuteLabel,
  disabled = false,
  segmentedUnits = false,
}: DurationInputProps) {
  const totalMinutes = Math.max(0, Math.round(value));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <label
          className={
            segmentedUnits
              ? "flex min-h-11 overflow-hidden rounded-lg border border-gray-200 bg-white transition focus-within:border-vr-500 focus-within:ring-1 focus-within:ring-vr-500/35"
              : "relative"
          }
        >
          <span className="sr-only">{hourLabel}</span>
          <input
            className={
              segmentedUnits
                ? "w-0 min-w-0 flex-1 bg-transparent px-1.5 py-2 text-center text-sm font-bold tabular-nums text-gray-950 outline-none [appearance:textfield] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-950 disabled:opacity-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                : `${inputClass} pr-12`
            }
            value={hours}
            type="number"
            min={0}
            disabled={disabled}
            onChange={(event) =>
              onChange(Math.max(0, Math.floor(toNumber(event.target.value))) * 60 + minutes)
            }
          />
          <span
            className={
              segmentedUnits
                ? "pointer-events-none flex min-w-10 items-center justify-center border-l border-gray-200 bg-gray-50 px-1.5 text-sm font-semibold text-gray-700"
                : "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500"
            }
          >
            {hourLabel}
          </span>
        </label>
        <label
          className={
            segmentedUnits
              ? "flex min-h-11 overflow-hidden rounded-lg border border-gray-200 bg-white transition focus-within:border-vr-500 focus-within:ring-1 focus-within:ring-vr-500/35"
              : "relative"
          }
        >
          <span className="sr-only">{minuteLabel}</span>
          <input
            className={
              segmentedUnits
                ? "w-0 min-w-0 flex-1 bg-transparent px-1.5 py-2 text-center text-sm font-bold tabular-nums text-gray-950 outline-none [appearance:textfield] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-950 disabled:opacity-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                : `${inputClass} pr-14`
            }
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
          <span
            className={
              segmentedUnits
                ? "pointer-events-none flex min-w-12 items-center justify-center border-l border-gray-200 bg-gray-50 px-1.5 text-sm font-semibold text-gray-700"
                : "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500"
            }
          >
            {minuteLabel}
          </span>
        </label>
      </div>
    </div>
  );
}
