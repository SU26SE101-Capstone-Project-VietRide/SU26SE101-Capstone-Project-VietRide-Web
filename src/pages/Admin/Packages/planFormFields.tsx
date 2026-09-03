// Field dùng chung của form gói dịch vụ — cả modal tạo/sửa gói tiêu chuẩn lẫn
// modal duyệt gói riêng đều dựng cùng bộ input (6 hạn mức, 3 module, 2 giá).
import CurrencyInput from "../../../components/CurrencyInput";
import Checkbox from "../../../components/form/Checkbox";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import { toNumber } from "../../../utils/number";

export function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        type="number"
        value={value}
        onChange={(event) => onChange(toNumber(event.target.value))}
      />
    </div>
  );
}

export function CurrencyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="relative">
        <CurrencyInput
          className={`${inputClass} pr-10`}
          value={value}
          onChange={(event) => onChange(toNumber(event.target.value))}
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-slate-500">đ</span>
      </div>
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`group flex cursor-pointer items-start justify-between gap-4 rounded-2xl border p-4 transition ${checked ? "border-vr-200 bg-vr-50" : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white"}`}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-800">{label}</span>
        <span className="mt-1 block text-xs font-normal leading-5 text-gray-500">{description}</span>
      </span>
      <Checkbox
        size="md"
        className="mt-0.5"
        checked={checked}
        onChange={onChange}
      />
    </label>
  );
}
