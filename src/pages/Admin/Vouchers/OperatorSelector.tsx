import { useTranslation } from "react-i18next";
import type { AdminOperator } from "../../../api/vietride";
import { labelClass } from "../../../components/form/formClasses";
import Checkbox from "../../../components/form/Checkbox";

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
  const visibleOperatorIds = operators.map((operator) => operator.operatorId);
  const visibleSelectedOperatorIds = selectedOperatorIds.filter((operatorId) =>
    visibleOperatorIds.includes(operatorId),
  );

  function toggleOperator(operatorId: string) {
    const nextOperatorIds = visibleSelectedOperatorIds.includes(operatorId)
      ? visibleSelectedOperatorIds.filter((id) => id !== operatorId)
      : [...visibleSelectedOperatorIds, operatorId];

    onChange(nextOperatorIds);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <label className={labelClass}>{t("vouchers.selectOperators")}</label>
        <span className="text-xs font-medium text-gray-500">
          {t("vouchers.selectedOperatorsCount", {
            count: visibleSelectedOperatorIds.length,
          })}
        </span>
      </div>
      <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
        {operators.length > 0 ? (
          <div className="space-y-1">
            {operators.map((operator) => {
              const checked = visibleSelectedOperatorIds.includes(
                operator.operatorId,
              );

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
        ) : (
          <p className="px-3 py-2 text-sm text-gray-500">
            {t("vouchers.noOperatorsAvailable")}
          </p>
        )}
      </div>
    </div>
  );
}
