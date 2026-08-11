// Form control cục bộ của màn Admin Vouchers (Field, DetailItem).
// DetailItem ở đây markup KHÁC components/DetailLayout (không viền card) — giữ local.
import CurrencyInput from "../../../components/CurrencyInput";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import { inputClass, labelClass } from "../../../components/form/formClasses";

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  currency?: boolean;
  disabled?: boolean;
};

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  currency = false,
  disabled = false,
}: FieldProps) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {type === "datetime-local" || type === "date" ? (
        <CustomDateTimeInput
          className={inputClass}
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : currency ? (
        <CurrencyInput
          className={inputClass}
          value={value}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={inputClass}
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

type DetailItemProps = {
  label: string;
  value: string;
};

export function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value || "-"}</p>
    </div>
  );
}
