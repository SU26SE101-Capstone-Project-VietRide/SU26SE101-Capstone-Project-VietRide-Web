import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminOperator } from "../../../api/vietride";
import Checkbox from "../../../components/form/Checkbox";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import { SearchInput } from "../../../components/ui/SearchInput";

type OperatorSelectorProps = {
  operators: AdminOperator[];
  selectedOperatorIds: string[];
  onChange: (operatorIds: string[]) => void;
};

export default function OperatorSelector({
  operators,
  selectedOperatorIds,
  onChange,
}: OperatorSelectorProps) {
  const { t } = useTranslation("admin");
  const [search, setSearch] = useState("");
  const filteredOperators = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return operators;
    }

    return operators.filter((operator) =>
      [operator.name, operator.contactEmail, operator.operatorId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [operators, search]);

  const visibleOperatorIds = operators.map((operator) => operator.operatorId);
  const visibleSelectedOperatorIds = selectedOperatorIds.filter((operatorId) =>
    visibleOperatorIds.includes(operatorId),
  );
  const allFilteredOperatorsSelected =
    filteredOperators.length > 0 &&
    filteredOperators.every((operator) =>
      selectedOperatorIds.includes(operator.operatorId),
    );

  function toggleOperator(operatorId: string) {
    onChange(
      selectedOperatorIds.includes(operatorId)
        ? selectedOperatorIds.filter((id) => id !== operatorId)
        : [...selectedOperatorIds, operatorId],
    );
  }

  function toggleAllFilteredOperators() {
    const filteredOperatorIds = new Set(
      filteredOperators.map((operator) => operator.operatorId),
    );

    if (allFilteredOperatorsSelected) {
      onChange(
        selectedOperatorIds.filter((operatorId) =>
          !filteredOperatorIds.has(operatorId),
        ),
      );
      return;
    }

    onChange([
      ...selectedOperatorIds,
      ...filteredOperators
        .map((operator) => operator.operatorId)
        .filter((operatorId) => !selectedOperatorIds.includes(operatorId)),
    ]);
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className={labelClass}>{t("vouchers.selectOperators")}</label>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span className="text-xs font-medium text-gray-500">
            {t("vouchers.selectedOperatorsCount", {
              count: visibleSelectedOperatorIds.length,
            })}
          </span>
          <button
            type="button"
            onClick={toggleAllFilteredOperators}
            disabled={filteredOperators.length === 0}
            className="rounded-lg border border-vr-200 px-3 py-1.5 text-xs font-semibold text-vr-900 transition hover:bg-vr-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {allFilteredOperatorsSelected
              ? t("vouchers.clearSelectedOperators")
              : t("vouchers.selectAllOperators")}
          </button>
        </div>
      </div>

      <SearchInput
        label={t("vouchers.searchOperators")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("vouchers.searchOperatorsPlaceholder")}
        inputClassName={`${inputClass} pl-9`}
        wrapperClassName="relative mt-2"
      />

      <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
        {operators.length > 0 && filteredOperators.length > 0 ? (
          <div className="space-y-1">
            {filteredOperators.map((operator) => {
              const checked = selectedOperatorIds.includes(operator.operatorId);

              return (
                <label
                  key={operator.operatorId}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-sm ${
                    checked
                      ? "bg-vr-50 text-vr-800"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={checked}
                    onChange={() => toggleOperator(operator.operatorId)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {operator.name}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {operator.contactEmail || operator.operatorId}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : operators.length > 0 ? (
          <p className="px-3 py-2 text-sm text-gray-500">
            {t("vouchers.searchOperatorsEmpty")}
          </p>
        ) : (
          <p className="px-3 py-2 text-sm text-gray-500">
            {t("vouchers.noOperatorsAvailable")}
          </p>
        )}
      </div>

      {operators.length > 0 && (
        <p className="mt-1 text-right text-xs text-gray-500">
          {t("vouchers.operatorSearchCount", {
            shown: filteredOperators.length,
            total: operators.length,
          })}
        </p>
      )}
    </div>
  );
}
