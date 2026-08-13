# Yêu cầu BE cập nhật API danh sách lịch chạy

## Phạm vi

Màn hình: `manager/trips`.

FE đã chuyển search, filter và pagination sang gọi API. BE cần cập nhật endpoint:

`GET /v1/operator/driver-schedules`

Không cần chỉnh source BE trong task FE này; file này dùng làm yêu cầu gửi team BE.

## Query params cần hỗ trợ

Giữ nguyên các params hiện tại:

- `page`
- `pageSize`
- `routeId`
- `driverUserId`
- `isActive`

Bổ sung:

| Param | Kiểu | Ý nghĩa |
|---|---|---|
| `search` | `string?` | Tìm theo tên tuyến và biển số xe |
| `vehicleTypeId` | `Guid?` | Lọc lịch theo loại xe được gán cho lịch |
| `isOneTime` | `bool?` | `true`: `validUntil == validFrom`; `false`: lịch lặp (`validUntil` null hoặc khác `validFrom`) |

Khi không truyền param hoặc truyền chuỗi rỗng, không áp dụng điều kiện lọc tương ứng.

## Yêu cầu search

Search cần áp dụng ở BE trước khi phân trang và tính `totalItems`:

- Tên tuyến (`Route.Name`)
- Biển số xe (`Vehicle.LicensePlate`)

Nên tìm không phân biệt hoa thường và hỗ trợ tìm một phần chuỗi.

## Yêu cầu pagination

`totalItems`, `totalPages`, `hasNextPage` phải phản ánh kết quả sau toàn bộ filter/search.

Thứ tự xử lý nên là:

1. Giới hạn theo `operatorId`.
2. Áp dụng các filter/search.
3. Tính tổng số bản ghi.
4. Sort ổn định.
5. `Skip/Take` theo `page/pageSize`.

## 4 stats trên FE

FE đang dùng cùng endpoint với các query count độc lập:

- Tổng lịch: không filter
- Lịch đang mở: `isActive=true`
- Lịch nháp/tạm dừng: `isActive=false`
- Lịch chạy một lần: `isOneTime=true`

Vì vậy API cần trả `totalItems` chính xác sau filter để các stats hiển thị đúng.

## Acceptance criteria

- `GET /v1/operator/driver-schedules?search=...` lọc được theo tên tuyến/biển số.
- `vehicleTypeId` lọc đúng các lịch có xe thuộc loại xe đó.
- `isOneTime` lọc đúng theo `validUntil` và `validFrom`.
- `totalItems` và pagination đúng sau filter.
- Có test cho từng filter, search và pagination.