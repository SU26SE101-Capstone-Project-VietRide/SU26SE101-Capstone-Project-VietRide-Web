# BE gap — `GET /v1/admin/locations` thiếu filter `type` và `parentCode`

Phát hiện 2026-08-11, đối chiếu source BE commit `fb4ed963`.

## Hiện trạng

`AdminLocationsController.GetAsync` chỉ khai bốn query:

```csharp
[FromQuery] int? page,
[FromQuery] int? pageSize,
[FromQuery] string? search,
[FromQuery] bool? isActive
```

`ListAdminLocationsQuery` và `ListAdminLocationsHandler` cũng chỉ chuyển bốn
tham số đó xuống `ILocationRepository.ListAsync`.

Hệ quả: gửi thêm `type` hoặc `parentCode` lên endpoint này thì **ASP.NET bỏ qua
im lặng** — không `422`, không cảnh báo, chỉ trả về danh sách chưa lọc. Nhìn từ
UI thì bộ lọc "cấp hành chính" và "trực thuộc tỉnh/thành" bấm vào không có tác
dụng gì.

Endpoint public `GET /v1/locations` thì **có** đủ `type` + `parentCode` +
`search` (`ListLocationsHandler`), nhưng chỉ trả bản ghi `isActive = true` và
không phân trang, nên không thay thế được endpoint admin.

## Cách FE đang chống chế

`src/pages/Admin/Locations/index.tsx` tải trọn danh mục qua
`fetchAllAdminLocations()` (trang 1 để biết `totalPages`, rồi lấy các trang còn
lại song song theo lô 8), sau đó lọc `search` / `isActive` / `type` /
`parentCode` và phân trang hoàn toàn phía client.

Chấp nhận được vì danh mục hành chính nhỏ và gần như tĩnh — đo trên production
2026-08-11: 34 bản ghi cấp tỉnh/thành + 3.321 bản ghi cấp xã (687 `WARD`,
2.621 `COMMUNE`, 13 `SPECIAL_ZONE`) = **3.355 bản ghi**, tức 34 trang ở
`pageSize=100` (mức trần BE cho phép).

## Đề nghị BE

Thêm `type` và `parentCode` vào `ListAdminLocationsQuery` + controller, lọc ngay
ở repository giống `ListLocationsHandler`:

- `type`: trim + uppercase, validate thuộc `PROVINCE | MUNICIPALITY | WARD |
  COMMUNE | SPECIAL_ZONE`, sai thì `422 VALIDATION_ERROR` field `type`.
- `parentCode`: lọc theo `parent.Code`; khác `/v1/locations` ở chỗ endpoint admin
  **không** nên bắt parent phải active, vì admin cần sửa cả nhánh đã tắt.

Sau khi BE có, FE bỏ `fetchAllAdminLocations()` và quay lại phân trang phía
server — sửa ở `loadLocations` cùng hai test trong `index.test.tsx` đang khoá
hành vi client-side.
