// Panel chuẩn hoá / chỉnh sửa chi tiết trạm đang chọn (cột trái của aside)
import { useTranslation } from "react-i18next";
import Checkbox from "../../../components/form/Checkbox";
import { FiMapPin, FiSave } from "react-icons/fi";
import { type AdminLocation } from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import PlacePicker, {
  type PlaceSelection,
} from "../../../components/PlacePicker";
import StationFacilityFields from "./StationFacilityFields";
import StationScheduleFields from "./StationScheduleFields";
import {
  displayCityName,
  inputClass,
  labelClass,
  type OperatingDayKey,
  type OperatingDaySchedule,
  type StationForm,
} from "./stationHelpers";
import { Button } from "../../../components/ui/Button";

type StationEditorPanelProps = {
  /** Mã tỉnh/thành đang chọn ở cấp trên của cascade */
  provinceCode: string;
  onProvinceChange: (provinceCode: string) => void;
  wards: AdminLocation[];
  isLoadingWards: boolean;
  form: StationForm;
  locations: AdminLocation[];
  selectedPlace: PlaceSelection | null;
  customFacility: string;
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
  provinceCode,
  onProvinceChange,
  wards,
  isLoadingWards,
  form,
  locations,
  selectedPlace,
  customFacility,
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
        <div className="rounded-lg bg-vr-50 p-2 text-vr-900">
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
          {/* Bến gắn vào Location cấp phường/xã. Chọn hai cấp vì danh sách
              phường/xã phải hỏi riêng theo tỉnh (GET /v1/locations?parentCode=). */}
          <label>
            <span className={labelClass}>{t("stations.province")}</span>
            <CustomSelect
              aria-label={t("stations.province")}
              className={inputClass}
              value={provinceCode}
              searchable
              searchPlaceholder={tc("searchOptions", {
                label: t("stations.province"),
              })}
              emptyMessage={tc("noMatchingOptions")}
              onChange={(event) => onProvinceChange(event.target.value)}
            >
              <option value="">{t("stations.selectProvince")}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.code}>
                  {location.name}
                </option>
              ))}
            </CustomSelect>
          </label>
          <label>
            <span className={labelClass}>{t("stations.wardLocation")}</span>
            <CustomSelect
              aria-label={t("stations.wardLocation")}
              className={inputClass}
              value={form.locationId}
              disabled={!provinceCode || isLoadingWards}
              searchable
              searchPlaceholder={tc("searchOptions", {
                label: t("stations.wardLocation"),
              })}
              emptyMessage={tc("noMatchingOptions")}
              onChange={(event) =>
                onFormChange({ ...form, locationId: event.target.value })
              }
            >
              <option value="">
                {isLoadingWards
                  ? t("stations.loadingWards")
                  : t("stations.selectWard")}
              </option>
              {wards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.name}
                </option>
              ))}
            </CustomSelect>
          </label>

          {/* city/ward là snapshot BE suy ra từ hierarchy — sửa tay không có
              tác dụng, nên hiển thị chỉ đọc thay vì input đánh lừa người dùng. */}
          <div className="sm:col-span-2 rounded-lg border border-gray-100 bg-slate-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-slate-600">
              {t("stations.derivedLocationLabel")}
            </p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {[form.ward, displayCityName(form.city)].filter(Boolean).join(", ") || "—"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {t("stations.derivedLocationHint")}
            </p>
          </div>
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
          <Checkbox
            checked={form.supportsShuttle}
            onChange={(checked) =>
              onFormChange({ ...form, supportsShuttle: checked })
            }
          />
          {t("stations.supportsShuttle")}
        </label>
      </div>

      <Button variant="primary" className="mt-5 w-full" onClick={onSave} disabled={isSaving}>
        <FiSave />
        {t("stations.saveStation")}
      </Button>

    </div>
  );
}
