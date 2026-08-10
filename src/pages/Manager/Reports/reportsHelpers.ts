// Helper thuần của màn Reports — không phụ thuộc React.
import { formatDateInputValue } from "../../../utils/date";

export type ExportRange = {
  from: string;
  to: string;
};

export function createInitialExportRange(): ExportRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);

  return {
    from: formatDateInputValue(from),
    to: formatDateInputValue(to),
  };
}

export function isValidExportRange({ from, to }: ExportRange) {
  const fromTime = Date.parse(`${from}T00:00:00.000Z`);
  const toTime = Date.parse(`${to}T00:00:00.000Z`);
  const rangeInDays = (toTime - fromTime) / 86_400_000;

  return (
    Number.isFinite(fromTime) &&
    Number.isFinite(toTime) &&
    rangeInDays >= 0 &&
    rangeInDays < 92
  );
}

// "YYYY-MM" theo lịch ĐỊA PHƯƠNG (giờ Việt Nam của trình duyệt) — dùng
// getFullYear()/getMonth() trực tiếp, KHÔNG round-trip qua toISOString().
// Bug cũ: new Date(year, month, 1) tạo mốc nửa đêm local rồi đổi UTC qua
// toISOString() luôn lùi về tháng trước với UTC+7 (nửa đêm 01/08 giờ VN =
// 17:00 31/07 UTC), khiến value gửi lên API luôn lệch 1 tháng so với label
// hiển thị trên dropdown.
function toMonthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthValue() {
  return toMonthValue(new Date());
}

export function monthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();

  for (let offset = 0; offset < 12; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    options.push({
      value: toMonthValue(date),
      label: `${date.getMonth() + 1}/${date.getFullYear()}`,
    });
  }

  return options;
}

export function monthLabel(value: string) {
  const [, month] = value.split("-");
  return month ? `T${Number(month)}` : value;
}
