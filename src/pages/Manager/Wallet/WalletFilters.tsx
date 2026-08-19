import type { ReactNode } from "react";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CustomSelect from "../../../components/CustomSelect";
import type { Translate } from "./walletTableShared";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-vr-500 focus:ring-2 focus:ring-vr-100";

export type DateFieldOption = { value: string; label: string };

// Bộ lọc dùng chung cho cả 3 tab: search (debounce ở component cha), khoảng
// ngày + dropdown chọn field ngày đang lọc (nhãn phải khớp field đang chọn —
// xem FE-REQUEST-operator-wallet-transparency-RESPONSE.md §10), và một slot
// filter riêng theo tab (loại giao dịch / trạng thái đối soát).
export function WalletFilters({
  searchTerm,
  onSearchChange,
  dateField,
  dateFieldOptions,
  onDateFieldChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  searchPlaceholder,
  t,
  extraFilter,
}: {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  dateField: string;
  dateFieldOptions: DateFieldOption[];
  onDateFieldChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  searchPlaceholder: string;
  t: Translate;
  extraFilter?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:items-center lg:flex-wrap">
      <input
        type="search"
        value={searchTerm}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        className={`flex-1 ${inputClass} lg:min-w-64`}
      />
      {extraFilter}
      {dateFieldOptions.length > 1 && (
        <CustomSelect
          value={dateField}
          onChange={(event) => onDateFieldChange(event.target.value)}
          aria-label={t("wallet.dateFieldLabel")}
          className={`${inputClass} lg:w-56`}
        >
          {dateFieldOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </CustomSelect>
      )}
      <div className="flex items-center gap-2">
        <CustomDateTimeInput
          type="date"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
          className={inputClass}
          placeholder={t("wallet.dateFrom")}
        />
        <span className="text-sm text-gray-500">-</span>
        <CustomDateTimeInput
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
          className={inputClass}
          placeholder={t("wallet.dateTo")}
        />
      </div>
    </div>
  );
}
