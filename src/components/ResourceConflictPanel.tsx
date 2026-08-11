import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FiAlertTriangle, FiCheckCircle } from "react-icons/fi";
import type {
  ResourceAvailabilityResult,
  ResourceConflict,
} from "../api/vietride";
import { formatDateTime } from "../utils/date";

type ResourceConflictPanelProps = {
  result: ResourceAvailabilityResult | null;
  loading?: boolean;
};

type ConflictGroup = {
  key: string;
  conflict: ResourceConflict;
  occurrences: number;
};

// Lịch lặp sinh ra một conflict cho MỖI lần lặp, nên cùng một tài xế trùng giờ
// có thể trả về vài chục dòng gần như giống hệt (chỉ khác ngày) và đẩy form ra
// khỏi màn hình. Gom theo tài nguyên + lý do, giữ lần sớm nhất làm đại diện vì
// đó là mốc người dùng cần sửa trước.
function groupConflicts(conflicts: ResourceConflict[]): ConflictGroup[] {
  const groups = new Map<string, ConflictGroup>();

  for (const conflict of conflicts) {
    const key = `${conflict.resourceRole}|${conflict.resourceId}|${conflict.reason}`;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, { key, conflict, occurrences: 1 });
      continue;
    }

    existing.occurrences += 1;
    if (
      conflict.sampleRequestedStartAt < existing.conflict.sampleRequestedStartAt
    ) {
      existing.conflict = conflict;
    }
  }

  return [...groups.values()];
}

// Render kết quả preview availability. Preview trả HTTP 200 kể cả khi
// available=false nên panel này là chỗ duy nhất người dùng thấy conflict —
// không được coi 200 là thành công (handoff mục 6.1 và 14.3).
export default function ResourceConflictPanel({
  result,
  loading = false,
}: ResourceConflictPanelProps) {
  const { t } = useTranslation("manager");
  const containerRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(
    () => groupConflicts(result?.conflicts ?? []),
    [result],
  );

  // Nút kiểm tra nằm ở footer còn panel ở đầu modal, nên bấm xong kết quả hiện
  // ngoài tầm nhìn. Kéo panel vào khung nhìn để người dùng thấy ngay xung đột.
  useEffect(() => {
    if (!result) {
      return;
    }

    // Cuộn tức thì, KHÔNG dùng behavior:"smooth": panel nở ra làm nội dung dài
    // thêm, browser giữ nguyên vị trí nhìn (scroll anchoring) và huỷ luôn
    // animation — đo thật thấy khung cuộn xuống đáy và panel vẫn khuất.
    // jsdom không cài scrollIntoView — guard để test không vỡ.
    containerRef.current?.scrollIntoView?.({ block: "start" });
  }, [result]);

  if (loading) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        {t("resourceConflict.checking")}
      </p>
    );
  }

  // Chưa bấm kiểm tra thì không chiếm chỗ của form. Cảnh báo "kết quả chỉ để
  // tham khảo" đã nằm ở nhánh available=true — đúng lúc nó có ý nghĩa.
  if (!result) {
    return null;
  }

  if (result.available) {
    return (
      <div
        ref={containerRef}
        role="status"
        className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
      >
        <p className="flex items-center gap-2 font-semibold">
          <FiCheckCircle aria-hidden="true" />
          {t("resourceConflict.previewOk")}
        </p>
        <p className="mt-1 text-xs text-emerald-700">
          {t("resourceConflict.previewAdvisory")}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="status"
      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <p className="flex items-center gap-2 font-semibold">
        <FiAlertTriangle aria-hidden="true" />
        {t("resourceConflict.summary", { count: groups.length })}
      </p>

      {/* Cao tối đa ~3 nhóm rồi cuộn, để form phía dưới luôn còn nhìn thấy. */}
      <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
        {groups.map(({ key, conflict, occurrences }) => (
          <li key={key} className="rounded-md bg-white/70 px-2.5 py-2">
            <p className="font-semibold">
              {t(`resourceConflict.role.${conflict.resourceRole}`)} ·{" "}
              {t(`resourceConflict.reason.${conflict.reason}`)}
            </p>
            <p className="mt-0.5 text-xs">
              {occurrences > 1
                ? t("resourceConflict.occurrencesFrom", {
                    count: occurrences,
                    time: formatDateTime(conflict.sampleRequestedStartAt),
                  })
                : t("resourceConflict.blockingUntil", {
                    time: formatDateTime(conflict.blockingUntil),
                  })}
            </p>
            {conflict.requiredTravelMinutes !== null && (
              <p className="text-xs">
                {t("resourceConflict.requiredTravel", {
                  minutes: conflict.requiredTravelMinutes,
                })}
              </p>
            )}
            {conflict.earliestFeasibleStartAt === null && (
              <p className="text-xs">{t("resourceConflict.noFeasibleStart")}</p>
            )}
          </li>
        ))}
      </ul>

      {result.hasMore && (
        <p className="mt-2 text-xs">{t("resourceConflict.hasMoreShort")}</p>
      )}
    </div>
  );
}
