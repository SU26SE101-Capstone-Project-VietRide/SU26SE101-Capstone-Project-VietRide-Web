import type { ChangeEvent, ReactNode } from "react";
import { FiSearch } from "react-icons/fi";
import CustomSelect from "./CustomSelect";

export type PersonnelFilterOption = {
  value: string;
  label: ReactNode;
};

export type PersonnelFiltersProps = {
  search: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  role: string;
  rolePlaceholder: ReactNode;
  roleOptions: PersonnelFilterOption[];
  onRoleChange: (value: string) => void;
  status: string;
  statusPlaceholder: ReactNode;
  statusOptions: PersonnelFilterOption[];
  onStatusChange: (value: string) => void;
  children?: ReactNode;
  action?: ReactNode;
};

const selectClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";

export function PersonnelFilters({
  search,
  searchPlaceholder,
  onSearchChange,
  role,
  rolePlaceholder,
  roleOptions,
  onRoleChange,
  status,
  statusPlaceholder,
  statusOptions,
  onStatusChange,
  children,
  action,
}: PersonnelFiltersProps) {
  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
            placeholder={searchPlaceholder}
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <CustomSelect
            className={selectClass}
            value={role}
            onChange={(event) => onRoleChange(event.target.value)}
          >
            <option value="">{rolePlaceholder}</option>
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </CustomSelect>
          <CustomSelect
            className={selectClass}
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
          >
            <option value="">{statusPlaceholder}</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </CustomSelect>
          {children}
          {action}
        </div>
      </div>
    </div>
  );
}
