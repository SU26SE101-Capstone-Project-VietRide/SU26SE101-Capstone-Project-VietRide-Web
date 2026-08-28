// Lịch sử điều phối của một chuyến trung chuyển: ai gán, ai đổi xe/tài xế, lúc
// nào, vì lý do gì.
//
// Nguồn: `GET /v1/operator/shuttle-trips/{id}/assignment-history` — BE sắp sẵn
// mới nhất trước (`assignedAt DESC`) nên ở đây không sắp lại.
//
// Tự nạp dữ liệu và chỉ nạp KHI MỞ, cùng lý do với
// `ShuttleTripPassengersSection`: trang cha đã quá dài, và phần lớn lượt mở chi
// tiết chuyến không ai xem tới lịch sử.
//
// Đổi chuyến thì component được remount bằng `key={shuttleTripId}` ở nơi gọi,
// nên không cần effect dọn state — dọn bằng effect sẽ vi phạm rule
// `react-hooks/set-state-in-effect`.
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiRefreshCw,
} from "react-icons/fi";
import {
  getOperatorShuttleAssignmentHistory,
  type ShuttleAssignmentHistoryItem,
} from "../../../api/vietride";
import { formatTime } from "./dispatchHelpers";

const pageSize = 20;

export default function ShuttleAssignmentHistorySection({
  shuttleTripId,
}: {
  shuttleTripId: string;
}) {
  const { t } = useTranslation("manager");
  const [isExpanded, setIsExpanded] = useState(false);
  const [items, setItems] = useState<ShuttleAssignmentHistoryItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadPage = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setError("");
      try {
        const result = await getOperatorShuttleAssignmentHistory(shuttleTripId, {
          page: nextPage,
          pageSize,
        });
        // Nối thêm chứ không thay: nút "Tải thêm" phải giữ lại các trang trước.
        setItems((current) =>
          nextPage === 1 ? result.items : [...current, ...result.items],
        );
        setPage(result.page);
        setHasNextPage(result.hasNextPage);
      } catch {
        setError(t("dispatch.assignmentHistoryFailed"));
      } finally {
        setIsLoading(false);
      }
    },
    [shuttleTripId, t],
  );

  // Lazy-load ngay trong handler mở, không qua effect: gọi setState từ effect
  // vi phạm `react-hooks/set-state-in-effect`, mà ở đây việc nạp vốn là hệ quả
  // trực tiếp của một cú bấm chứ không phải đồng bộ với hệ thống ngoài.
  function toggleExpanded() {
    setIsExpanded((current) => {
      const next = !current;
      // Chỉ gọi API ở lần mở ĐẦU TIÊN. Đóng rồi mở lại không gọi lại — dữ liệu
      // audit chỉ đổi khi có mutation, mà lúc đó trang cha đã nạp lại danh sách.
      if (next && page === 0 && !isLoading) {
        void loadPage(1);
      }
      return next;
    });
  }

  function actorName(item: ShuttleAssignmentHistoryItem) {
    // Tên actor thiếu do dữ liệu lịch sử hỏng thì giữ `userId` để còn nhận diện
    return item.assignedBy.displayName?.trim() || item.assignedBy.userId;
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={toggleExpanded}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-gray-900"
      >
        <span className="inline-flex items-center gap-2">
          <FiClock className="text-vr-900" size={15} aria-hidden="true" />
          {t("dispatch.assignmentHistory")}
        </span>
        {isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          {!error && items.length === 0 && !isLoading && (
            <p className="text-xs text-gray-500">
              {t("dispatch.assignmentHistoryEmpty")}
            </p>
          )}

          <ol className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-gray-100 px-3 py-2.5"
              >
                <p className="text-sm font-semibold text-gray-900">
                  {t(
                    item.action === "INITIAL_ASSIGNED"
                      ? "dispatch.assignedByInitial"
                      : "dispatch.assignedByReassigned",
                    { name: actorName(item), time: formatTime(item.assignedAt) },
                  )}
                </p>
                {/* Snapshot before/after là dữ liệu cố định lúc thao tác — chỉ
                    hiện phần thực sự đổi, `INITIAL_ASSIGNED` không có "trước". */}
                {item.previousDriver && item.currentDriver && (
                  <p className="mt-1 text-xs text-gray-600">
                    {t("dispatch.assignmentDriverChange", {
                      from:
                        item.previousDriver.displayName ||
                        item.previousDriver.id,
                      to:
                        item.currentDriver.displayName || item.currentDriver.id,
                    })}
                  </p>
                )}
                {item.previousVehicle && item.currentVehicle && (
                  <p className="mt-0.5 text-xs text-gray-600">
                    {t("dispatch.assignmentVehicleChange", {
                      from: item.previousVehicle.licensePlate,
                      to: item.currentVehicle.licensePlate,
                    })}
                  </p>
                )}
                {item.reason && (
                  <p className="mt-1 text-xs text-gray-500">
                    {t("dispatch.assignmentReason")}: {item.reason}
                  </p>
                )}
              </li>
            ))}
          </ol>

          {hasNextPage && (
            <button
              type="button"
              onClick={() => void loadPage(page + 1)}
              disabled={isLoading}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
            >
              <FiRefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              {t("dispatch.assignmentHistoryLoadMore")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
