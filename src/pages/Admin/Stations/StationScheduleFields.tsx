// Khối lịch hoạt động theo ngày trong tuần của form trạm
import { useTranslation } from "react-i18next";
import Checkbox from "../../../components/form/Checkbox";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import {
  operatingDayKeys,
  type OperatingDayKey,
  type OperatingDaySchedule,
  type OperatingHoursForm,
} from "./stationHelpers";

type StationScheduleFieldsProps = {
  operatingHours: OperatingHoursForm;
  onUpdateDay: (
    day: OperatingDayKey,
    updates: Partial<OperatingDaySchedule>,
  ) => void;
};

export default function StationScheduleFields({
  operatingHours,
  onUpdateDay,
}: StationScheduleFieldsProps) {
  const { t } = useTranslation("admin");

  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-bold text-gray-900">
        {t("stations.operatingHours")}
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        {t("stations.operatingHoursHint")}
      </p>
      <div className="mt-4 space-y-3">
        {operatingDayKeys.map((day) => {
          const schedule = operatingHours[day];
          return (
            <div
              key={day}
              className="grid items-center gap-3 sm:grid-cols-[92px_minmax(0,1fr)_16px_minmax(0,1fr)]"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                <Checkbox
                  checked={schedule.enabled}
                  onChange={(checked) => onUpdateDay(day, { enabled: checked })}
                />
                {t(`stations.days.${day}`)}
              </label>
              <CustomDateTimeInput
                type="time"
                value={schedule.open}
                disabled={!schedule.enabled}
                onChange={(event) =>
                  onUpdateDay(day, {
                    open: event.target.value,
                  })
                }
              />
              <span className="text-center text-gray-500">–</span>
              <CustomDateTimeInput
                type="time"
                value={schedule.close}
                disabled={!schedule.enabled}
                onChange={(event) =>
                  onUpdateDay(day, {
                    close: event.target.value,
                  })
                }
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
