// Skeleton panel phải trong lúc tải danh sách tuyến lần đầu: thanh tiêu đề +
// tab giả + khung bản đồ map-first với panel nổi mờ — thay cho empty-state
// "chưa chọn tuyến" gây hiểu nhầm.
export default function RouteDetailSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-testid="route-detail-skeleton"
      className="min-w-0 animate-pulse space-y-4"
    >
      {/* Thanh tiêu đề + hàng tab giả */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="h-6 w-56 rounded bg-gray-200" />
        <div className="mt-4 flex gap-2">
          <div className="h-8 w-24 rounded-lg bg-gray-200" />
          <div className="h-8 w-24 rounded-lg bg-gray-100" />
        </div>
      </div>

      {/* Khung bản đồ toàn khung + panel nổi bên trái mờ */}
      <div className="relative h-105 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:h-140">
        <div className="h-full w-full bg-gray-100" />
        <div className="absolute top-4 left-4 hidden w-75 space-y-3 rounded-xl bg-white/90 p-4 shadow-sm lg:block">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-1.5">
              <div className="h-3 w-28 rounded bg-gray-100" />
              <div className="h-9 w-full rounded-lg bg-gray-200" />
            </div>
          ))}
        </div>
        <div className="absolute bottom-3 left-3 h-12 w-2/3 rounded-xl bg-white/90 shadow-sm" />
      </div>
    </div>
  );
}
