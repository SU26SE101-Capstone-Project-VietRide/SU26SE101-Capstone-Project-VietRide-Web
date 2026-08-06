// Form primitive dùng riêng cho màn Routes (Input, NumberInput, StationSelect)
// — ngoại lệ named export theo CODE_CONVENTIONS §3 (nhóm component siêu nhỏ liên quan chặt)
import CurrencyInput from "../../../components/CurrencyInput";
import CustomSelect from "../../../components/CustomSelect";
import {
  inputClass,
  labelClass,
} from "../../../components/form/formClasses";
import { toNumber } from "../../../utils/number";
import type { StationOption } from "./types";

type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
};

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: InputProps) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        value={value}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

type StationSelectProps = {
  label: string;
  stations: StationOption[];
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function StationSelect({
  label,
  stations,
  value,
  placeholder,
  onChange,
  disabled = false,
}: StationSelectProps) {
  const hasSelectedValue =
    value && !stations.some((station) => station.id === value);

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <CustomSelect
        className={inputClass}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {hasSelectedValue && <option value={value}>{value}</option>}
        {stations.map((station) => (
          <option key={station.id} value={station.id}>
            {station.name} · {[station.ward, station.city].filter(Boolean).join(", ")}
          </option>
        ))}
      </CustomSelect>
    </div>
  );
}

type NumberInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  currency?: boolean;
};

export function NumberInput({
  label,
  value,
  onChange,
  disabled = false,
  currency = false,
}: NumberInputProps) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {currency ? (
        <CurrencyInput
          className={inputClass}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(toNumber(event.target.value))}
        />
      ) : (
        <input
          className={inputClass}
          value={value}
          type="number"
          disabled={disabled}
          onChange={(event) => onChange(toNumber(event.target.value))}
        />
      )}
    </div>
  );
}
