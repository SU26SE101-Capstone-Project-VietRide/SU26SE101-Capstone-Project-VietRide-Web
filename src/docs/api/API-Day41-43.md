# API Day 41–43 — Reporting và Reliability

Tài liệu này tóm tắt các API và thay đổi vận hành được triển khai trong Day 41–43. Nội dung bám theo `VietRide_API_Contract_v1.md`, code hiện tại của các service và Gateway. Thành công của các endpoint xuất file là raw file response; các lỗi vẫn dùng ADR 0004.

## Mục lục

- [Base URL](#base-url)
- [Xác thực và header chung](#xác-thực-và-header-chung)
- [Quy ước response](#quy-ước-response)
- [Day 41 — Operator XLSX](#day-41--operator-xlsx)
- [Day 42 — Platform report](#day-42--platform-report)
- [Day 43 — DLQ và job health](#day-43--dlq-và-job-health)
- [Mã lỗi](#mã-lỗi)
- [Verification](#verification)

## Base URL

| Môi trường | Gateway | Service trực tiếp |
|---|---|---|
| Local | `http://localhost:3000` | Identity `:5001`, Trip `:5002`, Booking `:5003`, Payment `:5004`, Parcel `:5005` |
| Day 41–43 isolated E2E | `http://localhost:59430` | Identity `:59101`, Trip `:59102`, Booking `:59103`, Payment `:59104`, Parcel `:59105` |

Client bên ngoài nên gọi Gateway. Các service trực tiếp chỉ dùng cho internal JWT, health check hoặc test harness.

## Xác thực và header chung

| Loại endpoint | Xác thực | Header |
|---|---|---|
| Operator report | User access token, role `OPERATOR_ADMIN` hoặc `OPERATOR_STAFF` | `Authorization: Bearer <access_token>` |
| Platform report | User access token, role `SYSTEM_ADMIN` | `Authorization: Bearer <access_token>` |
| Internal source/job endpoint | Internal JWT, issuer/audience theo cấu hình Gateway | `X-Internal-Auth: Bearer <internal_jwt>` |
| Mutation khác trong Booking/Payment/Parcel | User hoặc Internal JWT theo endpoint | `Idempotency-Key: <uuid-v4>` khi contract yêu cầu |

Operator report luôn lấy `operatorId` từ claim JWT. Không truyền `operatorId` trong query hoặc body. Mọi query operator đều lọc tenant ở database sở hữu dữ liệu.

## Quy ước response

### Raw XLSX success

```http
HTTP/1.1 200 OK
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="bookings-report-20260718-20260718.xlsx"
```

Workbook rỗng vẫn hợp lệ. Writer dùng ClosedXML `0.105.0`, async row enumeration và seekable temp `FileStream` có `DeleteOnClose`; không tạo full output `byte[]` hoặc duplicate full row list.

### JSON success/error

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "meta": {
    "traceId": "req-123",
    "timestamp": "2026-07-18T10:00:00Z"
  }
}
```

Lỗi dùng `ApiResponse<T>`/ADR 0004:

```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "REPORT_RANGE_INVALID",
    "message": "The report date range is invalid."
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-18T10:00:00Z" }
}
```

## Day 41 — Operator XLSX

### Tổng quan route

Sáu route read-only được Gateway proxy đến service sở hữu database nguồn:

| Method | Path | Owner | Sheet | Filename prefix |
|---|---|---|---|---|
| GET | `/v1/operator/reports/bookings/export` | Booking | `Bookings` | `bookings-report` |
| GET | `/v1/operator/reports/parcels/export` | Parcel | `Parcels` | `parcels-report` |
| GET | `/v1/operator/reports/revenue/export` | Payment | `Revenue` | `revenue-report` |
| GET | `/v1/operator/reports/occupancy/export` | Trip | `Occupancy` | `occupancy-report` |
| GET | `/v1/operator/reports/cancellation/export` | Booking | `Cancellations` | `cancellation-report` |
| GET | `/v1/operator/reports/refunds/export` | Payment | `Refunds` | `refunds-report` |

### Query chung

| Query | Kiểu | Mặc định | Quy tắc |
|---|---|---|---|
| `from` | `YYYY-MM-DD` | 30 ngày gần nhất | Ngày ICT, inclusive |
| `to` | `YYYY-MM-DD` | Ngày ICT hiện tại | Ngày ICT, inclusive |

Backend chuyển ngày ICT thành UTC half-open interval `[fromUtc,toUtc)`. Khoảng tối đa là 92 ngày. `from > to`, ngày không hợp lệ hoặc vượt giới hạn trả `422 REPORT_RANGE_INVALID`.

### Cột workbook

Header ASCII ổn định. Không xuất PII hành khách, người gửi hoặc người nhận.

| Sheet | Cột theo thứ tự |
|---|---|
| `Bookings` | `booking_id`, `booking_code`, `trip_id`, `status`, `passenger_count`, `total_amount_vnd`, `created_at`, `confirmed_at`, `completed_at` |
| `Parcels` | `parcel_id`, `parcel_code`, `trip_id`, `status`, `size_category`, `total_price_vnd`, `deposit_amount_vnd`, `additional_amount_vnd`, `refund_amount_vnd`, `created_at`, `confirmed_at` |
| `Revenue` | `entry_id`, `entry_type`, `reference_type`, `reference_id`, `trip_id`, `amount_vnd`, `occurred_at`, `note` |
| `Occupancy` | `trip_id`, `route_id`, `status`, `departure_at`, `sellable_seat_count`, `booked_seat_count`, `occupancy_percent` |
| `Cancellations` | `booking_id`, `booking_code`, `trip_id`, `status`, `cancelled_at`, `cancellation_reason`, `total_amount_vnd` |
| `Refunds` | `entry_id`, `entry_type`, `reference_type`, `reference_id`, `trip_id`, `amount_vnd`, `occurred_at`, `note` |

Metric tiền là BIGINT VND. Ngày/giờ, ngày, số nguyên và phần trăm được ghi thành typed Excel cell, không stringify toàn bộ dữ liệu.

### Ví dụ gọi API

```bash
curl -L \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  "http://localhost:3000/v1/operator/reports/bookings/export?from=2026-07-01&to=2026-07-18" \
  -o bookings-report-20260701-20260718.xlsx
```

Thay `bookings` bằng `parcels`, `revenue`, `occupancy`, `cancellation` hoặc `refunds` để tải report tương ứng.

### Nguồn dữ liệu và giới hạn

- Booking và cancellation chỉ đọc Booking database; booking dùng `created_at`, cancellation dùng `cancelled_at`.
- Parcel chỉ đọc Parcel database và giữ nguyên route CSV cũ.
- Revenue/refund chỉ đọc immutable Payment `OperatorLedgerEntry`, gồm các loại đã khóa trong contract; không tạo attribution table mới.
- Occupancy chỉ đọc Trip/TripSeat; không gọi Booking hoặc Payment để suy diễn số ghế.
- Không có cross-database foreign key, Gateway aggregation hoặc integration event mới.
- Query stream và writer truyền `CancellationToken`; lỗi hoặc client abort phải dọn temp file.

### CSV Parcel legacy

Route cũ không bị đổi:

```http
GET /v1/operator/parcels/reports/export?format=csv
```

Route này tiếp tục trả `text/csv` với filename và header cũ. Không dùng route CSV để thay thế XLSX.

## Day 42 — Platform report

### GET `/v1/admin/reports/platform?from=&to=`

Booking là public facade; Gateway chỉ proxy đến Booking. Payment ledger là nguồn doanh thu authoritative. Các source Booking/Trip/Parcel/Payment chỉ đọc database của chính service.

Auth: `SYSTEM_ADMIN`.

`from` và `to` là RFC 3339 UTC timestamps, bắt buộc, `from < to`, metric dùng `[from,to)`. Khoảng tối đa theo contract là 366 ngày.

```bash
curl \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  "http://localhost:3000/v1/admin/reports/platform?from=2026-07-01T00:00:00Z&to=2026-08-01T00:00:00Z"
```

Response rút gọn:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "period": {
      "from": "2026-07-01T00:00:00Z",
      "to": "2026-08-01T00:00:00Z",
      "timezone": "UTC"
    },
    "totals": {
      "completedBookingCount": 120,
      "completedTripCount": 36,
      "deliveredParcelCount": 18,
      "bookingRevenueVnd": 48000000,
      "parcelRevenueVnd": 3200000,
      "netRevenueVnd": 51200000
    },
    "byOperator": [],
    "generatedAt": "2026-08-01T00:00:01Z"
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-08-01T00:00:01Z" }
}
```

### Reconciliation, projection và cache

- `platform_booking_stats`, `platform_trip_stats` và `platform_parcel_stats` được cập nhật trong transaction local và có backfill idempotent mỗi 5 phút.
- Raw source đối chiếu live aggregate với projection theo từng operator và đúng UTC range trước khi trả kết quả.
- Payment ledger dùng checked BIGINT aggregation; tổng breakdown phải bằng totals.
- Redis read-through dùng key `platform-report:v1:{fromUtc}:{toUtc}`, TTL 5 phút, có version và exact range.
- Mismatch, timeout, unavailable source hoặc payload malformed trả `503 UPSTREAM_UNAVAILABLE`; không trả partial/stale totals và không cache response lỗi.
- `byOperator` là union operator IDs từ các source, sort theo `netRevenueVnd DESC` rồi `operatorId`; thiếu Identity summary thì `operatorName` là `null`.

### Internal platform source

Payment expose raw internal endpoint, chỉ dùng Internal JWT:

```http
GET /internal/v1/reports/platform/ledger?from=2026-07-01T00:00:00Z&to=2026-08-01T00:00:00Z
```

Payload thành công:

```json
{
  "items": [
    {
      "operatorId": "uuid",
      "bookingRevenueVnd": 48000000,
      "parcelRevenueVnd": 3200000
    }
  ]
}
```

Booking, Trip và Parcel có các raw internal source tương ứng dưới `/internal/v1/reports/platform/...`; các route này không được proxy public qua Gateway.

## Day 43 — DLQ và job health

### GET `/v1/admin/outbox/dlq`

Identity sở hữu facade tổng hợp DLQ từ Identity, Trip, Booking, Payment, Parcel và Tracking.

Auth: `SYSTEM_ADMIN`.

Query:

| Query | Kiểu | Quy tắc |
|---|---|---|
| `cursor` | opaque string | Cursor tổng hợp service + terminal timestamp + event ID |
| `pageSize` | int | `1..100`, mặc định theo controller |
| `service` | string? | Lọc service nguồn |
| `eventType` | string? | Lọc event type |
| `sortDir` | `asc\|desc` | Mặc định `desc` |

```bash
curl \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  "http://localhost:3000/v1/admin/outbox/dlq?pageSize=50&sortDir=desc"
```

Response:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "service": "booking",
        "eventId": "uuid",
        "eventType": "booking.booking_confirmed",
        "payload": {},
        "retryCount": 6,
        "lastError": "broker unavailable",
        "createdAt": "2026-07-22T00:00:00Z",
        "terminalAt": "2026-07-22T00:01:00Z"
      }
    ],
    "nextCursor": null,
    "unavailableServices": []
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-22T00:01:01Z" }
}
```

Event vào DLQ sau lần publish thất bại thứ sáu (`retry_count > 5`). Mỗi service lưu DLQ trong database riêng, unique theo event ID; giữ event identity, type, payload, retry metadata và terminal timestamp. Payload không được ghi vào operational log. V1 chỉ review/list, không có replay hoặc purge.

Nếu một source tạm thời unavailable, facade vẫn trả `200` với các item khả dụng và `unavailableServices`; không dựng partial total giả.

### GET `/internal/jobs/status`

Route service-local, không qua Gateway. Các service có Hangfire trong scope gồm Identity, Trip, Booking, Payment và Parcel.

Auth: Internal JWT. Không mở Hangfire dashboard và không thay đổi schedule/readiness.

```bash
curl \
  -H "X-Internal-Auth: Bearer $INTERNAL_JWT" \
  "http://localhost:5003/internal/jobs/status"
```

Success là raw array:

```json
[
  {
    "jobId": "booking-platform-stats-backfill",
    "status": "Scheduled",
    "lastRun": "2026-07-22T00:00:00Z",
    "nextRun": "2026-07-22T00:05:00Z",
    "lagSeconds": 0
  }
]
```

`lagSeconds = max(0, nowUtc - nextRunUtc)` cho job quá hạn; là `null` khi job chưa có `nextRun` hoặc disabled. Endpoint read-only và không làm thay đổi schedule.

### Idempotency

Mọi POST/PATCH/PUT/DELETE trong Booking, Payment và Parcel thuộc inventory Day 43 phải kiểm tra idempotency. Các hành vi chính:

- Thiếu hoặc UUID-v4 không hợp lệ: `422 IDEMPOTENCY_KEY_REQUIRED` hoặc `VALIDATION_ERROR` theo contract endpoint.
- Cùng key, cùng request: replay nguyên status/body/content type.
- Cùng key, khác body/query: `422 IDEMPOTENCY_KEY_MISMATCH`.
- Request cùng key đang xử lý: `409 IDEMPOTENCY_REQUEST_PENDING`.
- Redis response TTL: 24 giờ; không cache response 5xx.
- VNPay callback và các exemption được inventory riêng với cơ chế HMAC/deduplication tương đương.

## Mã lỗi

| HTTP | Code | Ý nghĩa |
|---:|---|---|
| 401 | `AUTH_TOKEN_INVALID` / `UNAUTHORIZED` | JWT thiếu, sai hoặc hết hạn |
| 403 | `FORBIDDEN` | Không đúng role, tenant hoặc operator scope |
| 409 | `IDEMPOTENCY_REQUEST_PENDING` | Request cùng idempotency key đang xử lý |
| 422 | `IDEMPOTENCY_KEY_REQUIRED` | Mutation yêu cầu header idempotency nhưng bị thiếu |
| 422 | `IDEMPOTENCY_KEY_MISMATCH` | Reuse key với request khác |
| 422 | `REPORT_RANGE_INVALID` | Range ngày/giờ sai hoặc vượt giới hạn |
| 422 | `VALIDATION_ERROR` | Query/header/body không hợp lệ |
| 500 | `REPORT_VALUE_OVERFLOW` | Checked BIGINT aggregate vượt giới hạn |
| 503 | `UPSTREAM_UNAVAILABLE` | Source unavailable, timeout, malformed payload hoặc reconciliation mismatch |

## Verification

Full Day 41–43 E2E dùng isolated Docker stack với API/DB thật:

- Gateway, Identity, Trip, Booking, Payment, Parcel, Tracking, Notification.
- PostgreSQL, Redis và RabbitMQ thật; harness query trực tiếp DB/Redis/RabbitMQ để kiểm side effect.
- Sáu XLSX, tenant isolation, 10.000 dòng/report và client abort cleanup.
- Platform benchmark 20 operator, 100.000 booking/payment, 50.000 parcel, 10.000 trip; cache cold/warm và outage recovery.
- DLQ cursor pagination, degraded source, Internal JWT job health, idempotency inventory, RabbitMQ outage/drain và migration up/down/reapply.

Lệnh tổng hợp:

```bash
npm run e2e:day41-43
```

Các gate bổ sung: `npm run lint:ts`, `npm run test:ts`, `npm run build:ts`, `dotnet build`, `dotnet format --verify-no-changes`, `dotnet test`, `npm run verify:idempotency-inventory`, EF pending-model checks và Prisma validation.
