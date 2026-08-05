import { useTranslation } from "react-i18next";
import CurrencyInput from "../../../components/CurrencyInput";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import {
  inputClass,
  labelClass,
} from "../../../components/form/formClasses";

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  currency?: boolean;
  maxLength?: number;
};

export default function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
  currency = false,
  maxLength,
}: FieldProps) {
  const { t } = useTranslation("manager");
  const isAtCharacterLimit = Boolean(maxLength && value.length >= maxLength);
  const fieldClassName = isAtCharacterLimit ? inputClass + " border-amber-400 bg-amber-50 focus:border-amber-500 focus:ring-amber-500/30" : inputClass;

  const isCustomDateTime =
    type === "date" ||
    type === "datetime-local" ||
    type === "time" ||
    type === "month" ||
    type === "week";

  return (
    <div>
      <label className={labelClass}>{label}</label>
      {isCustomDateTime ? (
        <CustomDateTimeInput
          className={fieldClassName}
          type={type}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : currency ? (
        <CurrencyInput
          className={inputClass}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={inputClass}
          type={type}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {maxLength && (
        <p className={isAtCharacterLimit ? "mt-1 text-xs font-medium text-amber-700" : "mt-1 text-xs text-gray-500"}>
          {isAtCharacterLimit ? t("vouchers.characterLimitReached") : ""} {value.length}/{maxLength} {t("vouchers.charactersCount")}
        </p>
      )}
    </div>
  );
}
