// Panel chuẩn hoá / chỉnh sửa chi tiết trạm đang chọn (cột trái của aside)
import { useTranslation } from "react-i18next";
import { FiMapPin, FiSave } from "react-icons/fi";
import { type AdminLocation } from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import PlacePicker, {
  type PlaceSelection,
} from "../../../components/PlacePicker";
import StationFacilityFields from "./StationFacilityFields";
import StationScheduleFields from "./StationScheduleFields";
import {
  inputClass,
  labelClass,
  type AlertState,
  type OperatingDayKey,
  type OperatingDaySchedule,
  type StationForm,
} from "./stationHelpers";

type StationEditorPanelProps = {
  form: StationForm;
  locations: AdminLocation[];
  selectedPlace: PlaceSelection | null;
  customFacility: string;
  alert: AlertState | null;
  isSaving: boolean;
  onFormChange: (form: StationForm) => void;
  onApplyPlace: (place: PlaceSelection) => void;
  onUpdateOperatingDay: (
    day: OperatingDayKey,
    updates: Partial<OperatingDaySchedule>,
  ) => void;
  onToggleFacility: (facility: string) => void;
  onRemoveFacility: (facility: string) => void;
  onAddCustomFacility: () => void;
  onCustomFacilityChange: (value: string) => void;
  onSave: () => void;
};

export default function StationEditorPanel({
  form,
  locations,
  selectedPlace,
  customFacility,
  alert,
  isSaving,
  onFormChange,
  onApplyPlace,
  onUpdateOperatingDay,
  onToggleFacility,
  onRemoveFacility,
  onAddCustomFacility,
  onCustomFacilityChange,
  onSave,
}: StationEditorPanelProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-vr-50 p-2 text-vr-700">
          <FiMapPin />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {t("stations.normalizeTitle")}
          </h2>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <PlacePicker
          label={t("stations.stationName")}
          placeholder={t("stations.searchPlaceholder")}
          selectedPlace={selectedPlace}
          onSelect={onApplyPlace}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass}>{t("stations.location")}</span>
            <CustomSelect
              className={inputClass}
              value={form.locationId}
              onChange={(event) =>
                onFormChange({ ...form, locationId: event.target.value })
              }
            >
              <option value="">{t("stations.noLocation")}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} - {location.name}
                </option>
              ))}
            </CustomSelect>
          </label>
          <label>
            <span className={labelClass}>{t("stations.ward")}</span>
            <input
              className={inputClass}
              value={form.ward}
              onChange={(event) =>
                onFormChange({ ...form, ward: event.target.value })
              }
            />
          </label>
          <label>
            <span className={labelClass}>{t("stations.city")}</span>
            <input
              className={inputClass}
              value={form.city}
              onChange={(event) =>
                onFormChange({ ...form, city: event.target.value })
              }
            />
          </label>
          <label>
            <span className={labelClass}>{tc("phone")}</span>
            <input
              className={inputClass}
              value={form.contactPhone}
              onChange={(event) =>
                onFormChange({ ...form, contactPhone: event.target.value })
              }
            />
          </label>
          <label>
            <span className={labelClass}>{tc("email")}</span>
            <input
              className={inputClass}
              value={form.contactEmail}
              onChange={(event) =>
                onFormChange({ ...form, contactEmail: event.target.value })
              }
            />
          </label>
        </div>
        <StationScheduleFields
          operatingHours={form.operatingHours}
          onUpdateDay={onUpdateOperatingDay}
        />

        <StationFacilityFields
          facilities={form.facilities}
          customFacility={customFacility}
          onToggleFacility={onToggleFacility}
          onRemoveFacility={onRemoveFacility}
          onAddCustomFacility={onAddCustomFacility}
          onCustomFacilityChange={onCustomFacilityChange}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.supportsShuttle}
            onChange={(event) =>
              onFormChange({
                ...form,
                supportsShuttle: event.target.checked,
              })
            }
            className="h-4 w-4 cursor-pointer accent-vr-500"
          />
          {t("stations.supportsShuttle")}
        </label>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FiSave />
        {t("stations.saveStation")}
      </button>

      {alert && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2.5 text-sm ${alert.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}
        >
          {alert.message}
        </div>
      )}
    </div>
  );
}
