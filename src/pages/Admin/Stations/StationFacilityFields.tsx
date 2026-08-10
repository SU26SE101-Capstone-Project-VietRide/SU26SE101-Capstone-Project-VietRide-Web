// Khối tiện ích (facilities) của form trạm: checkbox chuẩn + tag tuỳ chỉnh
import { useTranslation } from "react-i18next";
import { FiPlus, FiX } from "react-icons/fi";
import { facilityOptions, inputClass } from "./stationHelpers";
import Checkbox from "../../../components/form/Checkbox";

type StationFacilityFieldsProps = {
  facilities: string[];
  customFacility: string;
  onToggleFacility: (facility: string) => void;
  onRemoveFacility: (facility: string) => void;
  onAddCustomFacility: () => void;
  onCustomFacilityChange: (value: string) => void;
};

export default function StationFacilityFields({
  facilities,
  customFacility,
  onToggleFacility,
  onRemoveFacility,
  onAddCustomFacility,
  onCustomFacilityChange,
}: StationFacilityFieldsProps) {
  const { t } = useTranslation("admin");

  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-bold text-gray-900">
        {t("stations.facilities")}
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        {t("stations.facilitiesHint")}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {facilityOptions.map((facility) => (
          <label
            key={facility}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700"
          >
            <Checkbox
              checked={facilities.some(
                (item) => item.toLowerCase() === facility.toLowerCase(),
              )}
              onChange={() => onToggleFacility(facility)}
            />
            {t(`stations.facilityOptions.${facility}`)}
          </label>
        ))}
      </div>

      {facilities
        .filter(
          (facility) =>
            !facilityOptions.some(
              (option) => option.toLowerCase() === facility.toLowerCase(),
            ),
        )
        .map((facility) => (
          <span
            key={facility}
            className="mr-2 mt-3 inline-flex items-center gap-1 rounded-full bg-vr-50 px-3 py-1.5 text-xs font-semibold text-vr-700"
          >
            {facility}
            <button
              type="button"
              onClick={() => onRemoveFacility(facility)}
              aria-label={t("stations.removeFacility", {
                facility,
              })}
              className="rounded-full p-0.5 hover:bg-vr-100"
            >
              <FiX />
            </button>
          </span>
        ))}

      <div className="mt-4 flex gap-2">
        <input
          className={inputClass}
          value={customFacility}
          onChange={(event) => onCustomFacilityChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAddCustomFacility();
            }
          }}
          placeholder={t("stations.customFacilityPlaceholder")}
        />
        <button
          type="button"
          onClick={onAddCustomFacility}
          disabled={!customFacility.trim()}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-vr-200 bg-vr-50 px-3 py-2 text-sm font-semibold text-vr-700 disabled:opacity-50"
        >
          <FiPlus />
          {t("stations.addFacility")}
        </button>
      </div>
    </section>
  );
}
