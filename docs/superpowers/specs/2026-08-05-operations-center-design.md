# Trung tâm vận hành (Operations Center) — Design Spec

**Ngày:** 2026-08-05 · **Trạng thái:** Đã duyệt (owner) · **Phạm vi:** role Manager (OPERATOR_ADMIN / OPERATOR_STAFF)

## Vấn đề

4 màn Manager — Chuyến (Trips), Điều chỉnh lộ trình (RouteETA), Tuyến & điểm dừng (Routes), Theo dõi GPS — cô lập hoàn toàn: không deep-link, mọi lựa chọn là local state (F5 mất), nơi phát hiện sự cố (GPS) và nơi xử lý (Trips) tách rời, người duyệt đề xuất lộ trình (RouteETA) không có bản đồ để so sánh.

## Quyết định thiết kế

Tách theo bản chất công việc: **vận hành realtime** (gộp về 1 màn) vs **cấu hình** (giữ riêng).

### Sidebar Manager: 4 mục → 3 mục

| Mục | Path | Nguồn gốc | Role |
|---|---|---|---|
| Trung tâm vận hành | `/manager/operations` | GPS + panel điều hành chuyến (Trips) + duyệt đề xuất (RouteETA) | cả 2 (tab đề xuất chỉ OPERATOR_ADMIN) |
| Lịch chạy | `/manager/trips` | Trips bỏ phần điều hành, còn lịch định kỳ | cả 2 |
| Tuyến & điểm dừng | `/manager/routes` | Routes giữ nguyên + deep-link | cả 2 |

Redirect: `/manager/gps` và `/manager/route-eta` → `/manager/operations` (giữ bookmark cũ, cùng pattern redirect legacy sẵn có trong App.tsx).

### Bố cục màn Trung tâm vận hành

- **Trái: bản đồ đội xe lớn** (tái dùng FleetMap/FleetMapLegend/gpsHelpers từ GPS). Marker màu theo trạng thái (chạy/trễ/sự cố). Góc trên: badge "N đề xuất lộ trình chờ duyệt" (chỉ OPERATOR_ADMIN, bấm mở panel đề xuất).
- **Phải: panel ngữ cảnh** —
  - Chưa chọn gì: KPI đội xe + danh sách xe có tìm/lọc (FleetMetricCard, FleetVehicleList, FleetFilterBar).
  - Chọn 1 xe (click marker hoặc list): chi tiết chuyến — tuyến (link sang Routes đúng tuyến), biển số, tài xế, ETA, vệt xe, trạng thái realtime (TripTrackingPanel) + **hành động**: Thay xe, Huỷ chuyến (logic chuyển từ TripOperationsPanel), sức chứa hàng.
  - Panel đề xuất lộ trình (OPERATOR_ADMIN): danh sách đề xuất PENDING (logic từ RouteETA) + **bản đồ so sánh** lộ trình hiện tại (xám) vs đề xuất (`snapshot.pathPolyline`, xanh) + nút Duyệt/Từ chối (giữ xử lý conflict STALE/NOT_PENDING sẵn có).

### Trục liên kết & URL

- `tripId` là khoá chung. Chọn chuyến sync lên URL `?tripId=...` (share/F5 giữ ngữ cảnh). Panel đề xuất: `?panel=proposals`.
- Sửa bug sẵn có: click marker xe không sync với state theo dõi chuyến (2 state cùng là tripId nhưng tách rời) — gộp làm một.
- Routes đọc `?routeId=` → gọi `handleSelectRoute` sẵn có. Link "xem tuyến" từ panel chi tiết chuyến trỏ `/manager/routes?routeId=...`.
- Mẫu deep-link noi theo: `Dashboard → /manager/parcels?parcelId=...` (đã có trong repo).

### Di chuyển file (không viết lại)

- `GPS/*` (FleetMap, FleetVehicleList, FleetFilterBar, FleetMetricCard, FleetMapLegend, TripTrackingPanel, gpsHelpers) → `Operations/`; xoá thư mục GPS.
- `TripOperationsPanel` (Trips) → thành `Operations/TripActionsPanel.tsx`, bỏ dropdown chọn chuyến (nhận `tripId` từ map/list), giữ nguyên logic capacity/substitute/disrupt; Trips còn lịch chạy.
- `RouteETA/index.tsx` → thành `Operations/ProposalsPanel.tsx` + thêm bản đồ so sánh (tái dùng decode polyline + GoogleMapCanvas); xoá thư mục RouteETA.

### Ngoài phạm vi (ghi nhận, không làm đợt này)

- Nút "đổi lộ trình chủ động" wire API `changeOperatorTripRoute` (đang không có UI nào gọi) — chờ quyết định nghiệp vụ.
- Badge "tuyến có N chuyến đang chạy" bên màn Routes (cần API đếm chuyến theo tuyến).
- Fix N+1 `getTrackingTripLatest` trong load đội xe (cần API batch phía BE).
- Bug mục C của AUDIT_REPORT.md (nút Sửa lịch không gọi API...) — đợt riêng.

### Test & i18n

- Màn mới có `index.test.tsx` (render + load fleet + chọn chuyến qua URL param) theo convention.
- Test TripOperationsPanel chuyển theo panel mới; test Trips/RouteETA cập nhật theo cấu trúc mới, giữ assertion hành vi.
- Mọi chuỗi mới qua i18n namespace `manager` + `nav`, parity vi/en 100% (check-i18n.mjs).
- Verify: typecheck → lint → test → build xanh. Không tự commit (rule CLAUDE.md).
