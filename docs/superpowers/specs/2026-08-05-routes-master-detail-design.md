# Routes Master–Detail — Design Spec

**Ngày:** 2026-08-05 · **Trạng thái:** Đã duyệt (owner) · **Màn:** `/manager/routes`

## Vấn đề
Màn Routes là 5 khối xếp dọc 1 cột (Quản lý bến → Form tuyến → Tuyến thay thế → Điểm dừng → Bản đồ). Pain point owner xác nhận: cuộn dài khó tìm khu vực thao tác; flow tạo tuyến mới rối (không rõ bước nào trước); khối Quản lý bến ít dùng nhưng chen đầu trang.

## Thiết kế (phương án A đã duyệt)

**Layout master–detail:**
- Cột trái (~280-320px, mobile là dropdown/danh sách thu gọn): danh sách tuyến + ô tìm kiếm + nút "+ Tạo tuyến". Chọn tuyến → cột phải làm việc trên tuyến đó.
- Cột phải: header tên tuyến đang chọn + nút "Quản lý bến"; 3 tab:
  1. **Thông tin** — RouteFormSection + GeometryPanel/bản đồ đặt cạnh nhau (2 cột trên xl, dọc trên mobile)
  2. **Điểm dừng** — StopEditorCard + RouteStopList (+ bản đồ nếu bố cục cho phép)
  3. **Tuyến thay thế** — AlternativeRoutesSection
- Chưa chọn tuyến → cột phải hiện empty-state hướng dẫn chọn/tạo tuyến.

**URL:** giữ `?routeId=` sẵn có, thêm `&tab=info|stops|alternatives` (mặc định info). F5/share giữ đúng ngữ cảnh.

**Quản lý bến:** rút `StationManagementPanel` khỏi luồng chính → Modal (wide) mở từ nút "Quản lý bến" ở header cột phải. Trong dropdown chọn bến của form tuyến thêm mục "+ Tạo bến mới" mở cùng modal đó.

**Tạo tuyến:** nút "+ Tạo tuyến" mở modal chỉ gồm thông tin cơ bản (tên, bến đi, bến đến — đúng các field bắt buộc hiện có của createOperatorRoute). Tạo thành công → auto-select tuyến mới (`?routeId=`) + chuyển tab Điểm dừng để bổ sung tiếp. Các field nâng cao sửa sau trong tab Thông tin.

**Không đổi:** logic API/hooks (useRouteGeometry, useAlternativeRoutes, useStationManagement, useStopForm), validate, i18n key sẵn có. Các section component vừa tách được lắp lại, chỉ chỉnh props/bố cục khi cần.

**Test:** cập nhật index.test.tsx theo layout mới (giữ assertion hành vi: load list, chọn tuyến, deep-link routeId; thêm case tab param + tạo tuyến qua modal). i18n key mới đủ vi/en, chạy cả check-i18n lẫn scan-missing-i18n.
