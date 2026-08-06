# BE Gap — Đồng bộ doanh thu Dashboard Admin và Operator Admin

> Phạm vi: chỉ ghi nhận gap và yêu cầu xử lý phía Backend. Không phải task UI; không yêu cầu vẽ thêm chart hoặc thay đổi layout frontend trong tài liệu này.

## 1. Bối cảnh

Dashboard của System Admin đang gọi đồng thời ba API có liên quan đến dữ liệu tổng hợp:

```text
GET /v1/admin/booking-stats/aggregate
GET /v1/admin/dashboard/summary
GET /v1/admin/revenue/analytics
```

Các API cùng nhận khoảng thời gian của năm hiện tại (`from=YYYY-01-01`, `to=YYYY-12-31`), nhưng số liệu doanh thu trả về không đồng bộ. Ví dụ trên Dashboard:

- Stat tổng doanh thu hiển thị khoảng `4.100.000 VND`.
- Chart doanh thu theo tháng hiển thị riêng tháng 7 khoảng `137.600.000 VND`.

Với cùng một kỳ báo cáo, hai giá trị này không thể cùng đúng nếu các tháng còn lại không có doanh thu âm hoặc điều chỉnh tương ứng.

## 2. Gap A — System Admin: ba API chưa dùng chung source of truth

### API liên quan

#### A1. Booking aggregate

```http
GET /v1/admin/booking-stats/aggregate
  ?from=YYYY-01-01
  &to=YYYY-12-31
  &groupBy=month
```

Mục đích chính là thống kê số booking theo tháng. Nếu response có `totalRevenue` hoặc doanh thu trong item, field này phải được định nghĩa rõ là gross revenue, platform revenue hay một loại doanh thu khác.

#### A2. Dashboard summary

```http
GET /v1/admin/dashboard/summary
  ?from=YYYY-01-01
  &to=YYYY-12-31
```

Field hiện dùng cho stat:

```json
{
  "totalRevenue": {
    "currentValue": 0,
    "previousValue": 0,
    "changePercent": 0,
    "trend": "FLAT"
  }
}
```

#### A3. Revenue analytics

```http
GET /v1/admin/revenue/analytics
  ?from=YYYY-01-01
  &to=YYYY-12-31
  &groupBy=month
  &top=10
```

API này trả summary và dữ liệu theo tháng:

```json
{
  "summary": {
    "grossRevenueVnd": { "currentValue": 0 },
    "platformRevenueVnd": { "currentValue": 0 },
    "paidToOperatorsVnd": { "currentValue": 0 }
  },
  "monthly": [
    {
      "month": "2026-07",
      "grossRevenueVnd": 0,
      "platformRevenueVnd": 0,
      "paidToOperatorsVnd": 0
    }
  ]
}
```

### Yêu cầu BE xử lý

1. Chọn và công bố một source of truth cho doanh thu Admin, ưu tiên ledger/settlement đã hoàn tất; không cộng trực tiếp payment chưa hoàn tất.
2. Thống nhất định nghĩa:

```text
grossRevenueVnd = paidToOperatorsVnd + platformRevenueVnd
```

3. Trong cùng `from`, `to`, timezone và bộ filter, các giá trị sau phải khớp:

```text
dashboard.summary.totalRevenue.currentValue
= revenue.analytics.summary.grossRevenueVnd.currentValue
= SUM(revenue.analytics.monthly[].grossRevenueVnd)
```

4. Nếu `totalRevenue` trong `dashboard/summary` không phải gross revenue, BE phải đổi tên field hoặc bổ sung field có hậu tố rõ ràng, ví dụ `grossRevenueVnd`, `platformRevenueVnd`; không dùng tên `totalRevenue` cho nhiều nghĩa.
5. `booking-stats/aggregate` chỉ nên trả doanh thu nếu field đó cùng định nghĩa với analytics. Nếu không, loại bỏ field doanh thu khỏi aggregate hoặc ghi rõ semantic trong contract.
6. Ba API phải dùng cùng timezone của `period.timezone`, cùng điều kiện trạng thái giao dịch/booking, cùng quy tắc refund/reversal và cùng boundary đầu/cuối tháng.
7. Các tháng không có dữ liệu vẫn trả item có giá trị `0` để tổng theo tháng không bị thiếu tháng.

### Acceptance criteria — Admin

- Với cùng kỳ năm, stat tổng và tổng `monthly.grossRevenueVnd` bằng nhau.
- Case chỉ có doanh thu tháng 7: stat tổng bằng doanh thu tháng 7.
- Case có nhiều tháng: tổng monthly bằng summary.
- Refund/reversal không làm summary và monthly lệch nhau.
- Kiểm thử boundary `00:00:00` ngày đầu kỳ và `23:59:59` ngày cuối kỳ theo timezone response.
- Response có field/label thể hiện rõ đây là gross revenue, platform revenue hay paid-to-operators revenue.

## 3. Gap B — Operator Admin: Dashboard thiếu doanh thu theo năm

### Hiện trạng

Operator Admin Dashboard hiện lấy revenue analytics theo một tháng:

```http
GET /v1/operator/revenue/analytics?month=YYYY-MM
```

Do đó Dashboard có thể hiển thị doanh thu tháng hiện tại, nhưng chưa có tổng doanh thu của cả năm/YTD để đối chiếu xu hướng dài hạn.

### Yêu cầu BE

Bổ sung khả năng truy vấn analytics theo năm, giữ backward compatibility với request theo tháng. Có thể chọn một trong hai contract sau, nhưng phải thống nhất với FE:

#### Phương án khuyến nghị — from/to

```http
GET /v1/operator/revenue/analytics
  ?from=YYYY-01-01
  &to=YYYY-12-31
  &groupBy=month
```

#### Hoặc — year

```http
GET /v1/operator/revenue/analytics?year=YYYY&groupBy=month
```

Response cần có summary theo năm và danh sách 12 tháng:

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-12-31",
    "timezone": "Asia/Ho_Chi_Minh"
  },
  "summary": {
    "totalRevenueVnd": {
      "currentValue": 0,
      "previousValue": 0,
      "changePercent": 0,
      "trend": "FLAT"
    },
    "ticketRevenueVnd": { "currentValue": 0 },
    "parcelRevenueVnd": { "currentValue": 0 }
  },
  "monthly": [
    {
      "month": "2026-01",
      "revenueVnd": 0,
      "ticketRevenueVnd": 0,
      "parcelRevenueVnd": 0
    }
  ]
}
```

### Acceptance criteria — Operator Admin

- Truy vấn theo năm trả đủ 12 tháng, tháng không có dữ liệu có giá trị `0`.
- `summary.totalRevenueVnd.currentValue` bằng tổng `monthly[].revenueVnd`.
- Có thể so sánh năm hiện tại với cùng kỳ năm trước bằng cùng một timezone và quy tắc trạng thái.
- Không làm hỏng contract hiện tại `?month=YYYY-MM`.
- Phân biệt rõ `totalRevenueVnd`, `ticketRevenueVnd` và `parcelRevenueVnd`.
- Có test cho dữ liệu chỉ có tháng 7, nhiều tháng, tháng rỗng, refund/reversal và boundary ngày.

## 4. Bàn giao

BE cần cập nhật API contract/OpenAPI và cung cấp response mẫu cho:

1. Admin Dashboard summary.
2. Admin revenue analytics theo tháng.
3. Operator Admin revenue analytics theo năm.

Sau khi BE thống nhất contract và số liệu, FE mới map lại field nếu cần. Tài liệu này không yêu cầu thay đổi UI trong phạm vi hiện tại.
