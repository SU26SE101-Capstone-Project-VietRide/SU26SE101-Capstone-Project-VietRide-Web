// Câu tóm tắt bằng tiếng Việt thường của lịch sắp tạo. Form gồm nhiều ô rời
// (ngày giờ, các thứ, ngày kết thúc) mà người dùng phải tự ghép trong đầu mới
// hiểu lịch chạy ra sao — dòng này nói thẳng kết quả.
import { useTranslation } from "react-i18next";
import { FiCalendar } from "react-icons/fi";
import { formatDateOnly } from "../../../utils/date";
import { normalizeDayOfWeek } from "./tripHelpers";
import type { ScheduleForm } from "./types";

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export default function ScheduleSummary({ form }: { form: ScheduleForm }) {
  const { t } = useTranslation("manager");

  if (!form.departureAt) {
    return (
      <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
        {t("trips.summaryPending")}
      </p>
    );
  }

  const [datePart, timePart = ""] = form.departureAt.split("T");
  const startDate = formatDateOnly(datePart);
  const days = normalizeDayOfWeek(form.dayOfWeek);

  const frequency = form.isOneTime
    ? t("trips.summaryOnce")
    : days.length === 7
      ? t("trips.summaryDaily")
      : t("trips.summaryWeekdays", {
          days: days
            .map((day) => t(`trips.weekdaysShort.${WEEKDAY_KEYS[day - 1]}`))
            .join(", "),
        });

  const ending = form.isOneTime
    ? null
    : form.validUntil
      ? t("trips.summaryUntil", { date: formatDateOnly(form.validUntil) })
      : t("trips.summaryNoEnd");

  return (
    <div className="rounded-lg border-l-4 border-vr-500 bg-vr-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-vr-700">
        {t("trips.summaryTitle")}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-vr-900">
        <FiCalendar className="shrink-0 text-vr-700" aria-hidden="true" />
        <span className="font-bold">{frequency}</span>
        <span>{t("trips.summaryAt", { time: timePart })}</span>
        <span className="text-vr-400">·</span>
        <span>{t("trips.summaryFrom", { date: startDate })}</span>
        {ending ? (
          <>
            <span className="text-vr-400">·</span>
            <span>{ending}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}
