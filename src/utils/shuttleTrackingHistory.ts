const STORAGE_KEY = "vietride.recentShuttleTrips";
const MAX_ENTRIES = 20;

export type RecentShuttleTrip = {
  shuttleTripId: string;
  mainTripId: string;
  createdAt: string;
};

function isRecentShuttleTrip(value: unknown): value is RecentShuttleTrip {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.shuttleTripId === "string" &&
    typeof record.mainTripId === "string" &&
    typeof record.createdAt === "string"
  );
}

// BE chưa có endpoint liệt kê ShuttleTrip, nên FE chỉ biết được các chuyến
// vừa được gán trên chính trình duyệt này (qua Dispatch), lưu tạm ở localStorage.
export function getRecentShuttleTrips(): RecentShuttleTrip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentShuttleTrip) : [];
  } catch {
    return [];
  }
}

export function addRecentShuttleTrip(entry: RecentShuttleTrip) {
  const current = getRecentShuttleTrips().filter(
    (item) => item.shuttleTripId !== entry.shuttleTripId,
  );

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([entry, ...current].slice(0, MAX_ENTRIES)),
    );
  } catch {
    // localStorage có thể đầy hoặc bị chặn; danh sách gần đây là tiện ích phụ, bỏ qua lỗi.
  }
}
