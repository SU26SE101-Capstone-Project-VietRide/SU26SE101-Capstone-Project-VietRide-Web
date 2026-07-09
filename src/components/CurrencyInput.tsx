type CurrencyChangeEvent = {
  target: {
    value: string;
  };
};

type CurrencyInputProps = {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: CurrencyChangeEvent) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
};

function normalizeCurrency(value: string | number | undefined) {
  return String(value ?? "").replace(/[^\d]/g, "");
}

function formatCurrency(value: string | number | undefined) {
  const normalized = normalizeCurrency(value);
  if (!normalized) return "";

  return Number(normalized).toLocaleString("vi-VN");
}

export default function CurrencyInput({
  value,
  defaultValue,
  onChange,
  className = "",
  disabled = false,
  placeholder,
  required = false,
}: CurrencyInputProps) {
  const displayValue =
    value === undefined ? undefined : formatCurrency(value);
  const displayDefaultValue =
    defaultValue === undefined ? undefined : formatCurrency(defaultValue);

  return (
    <input
      className={className}
      type="text"
      inputMode="numeric"
      value={displayValue}
      defaultValue={displayDefaultValue}
      disabled={disabled}
      placeholder={placeholder}
      required={required}
      onChange={(event) => {
        onChange?.({ target: { value: normalizeCurrency(event.target.value) } });
      }}
    />
  );
}
