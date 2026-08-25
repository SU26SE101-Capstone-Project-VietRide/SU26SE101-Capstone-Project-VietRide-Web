// Form primitive dùng riêng cho màn Routes (Input, NumberInput, StationSelect)
// — ngoại lệ named export theo CODE_CONVENTIONS §3 (nhóm component siêu nhỏ liên quan chặt)
import { useTranslation } from "react-i18next";
import CurrencyInput from "../../../components/CurrencyInput";
import CustomSelect from "../../../components/CustomSelect";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import { toNumber } from "../../../utils/number";
import type { StationOption } from "./types";

type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  /** Gợi ý dưới ô — dùng cho luật nhập liệu, không dùng để báo lỗi. */
  hint?: string;
  /** Lỗi của RIÊNG field này. Có lỗi thì `hint` bị thay chứ không hiện cả hai. */
  error?: string;
  maxLength?: number;
  /** Chuẩn hoá giá trị ngay khi gõ (ví dụ mã tuyến luôn viết hoa). */
  transform?: (value: string) => string;
};

// <label> bọc control thay vì đứng cạnh: <label> anh em không có htmlFor thì
// KHÔNG gắn với input nào cả — trình đọc màn hình đọc ra ô trống (axe: label).
export function Input({ label, value, onChange, placeholder, type = "text", disabled = false, hint, error, maxLength, transform }: InputProps) {
  // aria-invalid + thông báo lỗi ngay dưới ô: lỗi mã tuyến là lỗi của MỘT field,
  // đẩy lên toast chung thì người dùng không biết ô nào sai.
  return <label className="block"><span className={labelClass}>{label}</span><input className={`${inputClass} ${error ? "border-red-400 focus:border-red-500" : ""}`} value={value} type={type} placeholder={placeholder} disabled={disabled} maxLength={maxLength} aria-invalid={error ? true : undefined} onChange={(event) => onChange(transform ? transform(event.target.value) : event.target.value)} />{error ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-gray-500">{hint}</span> : null}</label>;
}

type StationSelectProps = {
  label: string;
  stations: StationOption[];
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function StationSelect({ label, stations, value, placeholder, onChange, disabled = false }: StationSelectProps) {
  const { t } = useTranslation("common");
  const hasSelectedValue = value && !stations.some((station) => station.id === value);

  // Không gắn aria-label ở đây: CustomSelect render ra <button> và tên khả
  // truy cập của nó chính là option đang chọn — thêm aria-label sẽ đè mất giá
  // trị đó. Rule `label` của axe cũng chỉ soi input/select/textarea gốc.
  return <div>
    <label className={labelClass}>{label}</label>
    <CustomSelect
      className={inputClass}
      allowWrap
      value={value}
      disabled={disabled}
      searchable
      searchPlaceholder={t("searchOptions", { label })}
      emptyMessage={t("noMatchingOptions")}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {hasSelectedValue && <option value={value}>{value}</option>}
      {stations.map((station) => <option key={station.id} value={station.id}>{station.name} · {[station.ward, station.city].filter(Boolean).join(", ")}</option>)}
    </CustomSelect>
  </div>;
}

type NumberInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  currency?: boolean;
};

export function NumberInput({ label, value, onChange, disabled = false, currency = false }: NumberInputProps) {
  return <label className="block"><span className={labelClass}>{label}</span>{currency ? <CurrencyInput className={inputClass} value={value} disabled={disabled} onChange={(event) => onChange(toNumber(event.target.value))} /> : <input className={inputClass} value={value} type="number" disabled={disabled} onChange={(event) => onChange(toNumber(event.target.value))} />}</label>;
}
