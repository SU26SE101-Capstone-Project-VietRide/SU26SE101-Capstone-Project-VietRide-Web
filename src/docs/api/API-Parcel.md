# API Parcel Service

Tài liệu này được lập từ code hiện tại của Parcel service trong `apps/parcel` và shared .NET web libraries. Chỉ các hành vi nhìn thấy trong code được mô tả; phần chưa đủ context được đánh dấu `⚠️ TODO: cần xác nhận thêm`.

## Mục lục

- [Base URL](#base-url)
- [Xác thực và header chung](#xác-thực-và-header-chung)
- [Response envelope](#response-envelope)
- [Quy ước chung](#quy-ước-chung)
- [Tổng quan endpoint](#tổng-quan-endpoint)
- [Chi tiết endpoint](#chi-tiết-endpoint)
- [Mã lỗi theo code](#mã-lỗi-theo-code)

## Base URL

| Môi trường | Base URL | Nguồn |
|---|---:|---|
| Local direct Parcel | `http://localhost:5005` | `apps/parcel/src/VietRide.Parcel.Api/Properties/launchSettings.json` |
| Swagger production | `https://api.vietride.online/docs` | URL do user cung cấp |
| Production API | `https://api.vietride.online` | URL Swagger do user cung cấp; Gateway route table giữ nguyên path `/v1/...` khi proxy Parcel |

Service phụ thuộc cấu hình trong `appsettings.Development.json`: Trip `http://localhost:5002`, Booking `http://localhost:5003`, Payment `http://localhost:5004`, Identity `http://localhost:5001`.

## Xác thực và header chung

| Loại endpoint | Auth | Header |
|---|---|---|
| User-facing có `[Authorize]` | FE/Mobile gửi user access token tới Gateway. Gateway verify RS256 bằng JWKS từ Identity (`issuer=vietride-identity`, `audience=vietride-api`), kiểm role theo route, rồi mint internal JWT và forward Parcel bằng `X-Internal-Auth`. | `Authorization: Bearer <access_token>` |
| Internal endpoint | Internal JWT HS256, issuer `vietride-gateway`, audience `vietride-internal`, secret `INTERNAL_JWT_SECRET`, clock skew 5 giây. Token đọc từ `X-Internal-Auth`, có hoặc không có prefix `Bearer `. | `X-Internal-Auth: Bearer <internal_jwt>` |
| Mutation có `[RequireIdempotencyKey]` | Bắt buộc có idempotency key. Thiếu header trả `422 VALIDATION_ERROR`. Middleware Redis xử lý `POST`/`PATCH`: replay cùng body, `422 IDEMPOTENCY_KEY_MISMATCH` nếu cùng key khác body, TTL 24h. | `Idempotency-Key: <unique-key>` |
| Correlation | Nếu có, response meta dùng `X-Request-Id`; nếu không có có thể rỗng hoặc trace id của ASP.NET tùy path. | `X-Request-Id: <request-id>` |

Claims được controller đọc:

| Claim | Dùng cho |
|---|---|
| `sub` hoặc `ClaimTypes.NameIdentifier` | `userId` hiện tại |
| `operatorId` | scope operator cho operator/assistant endpoints |
| `role` hoặc `ClaimTypes.Role` | role authorization |

## Response envelope

Success được `ApiResponseResultFilter` wrap tự động, trừ endpoint trả file CSV và một endpoint internal tracking đã tự wrap.

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "meta": {
    "traceId": "req-123",
    "timestamp": "2026-07-05T10:00:00.0000000Z"
  }
}
```

Error:

```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more validation errors occurred.",
    "fields": [
      { "field": "sizeCategory", "message": "SizeCategory must be a valid ParcelSizeCategory value." }
    ]
  },
  "meta": {
    "traceId": "req-123",
    "timestamp": "2026-07-05T10:00:00.0000000Z"
  }
}
```

Model-binding lỗi JSON/type/missing non-null field trả HTTP `400` với `VALIDATION_ERROR`. FluentValidation và `CodedValidationException` trả HTTP `422`.

## Quy ước chung

| Quy ước | Giá trị thực tế trong code |
|---|---|
| JSON casing | camelCase theo `JsonSerializerDefaults.Web`/ASP.NET Core mặc định |
| UUID | `Guid`, ví dụ `11111111-1111-4111-8111-111111111111` |
| DateOnly query | `YYYY-MM-DD` |
| DateTimeOffset JSON | ISO-8601 |
| Money | `long` VND, không decimal |
| `ParcelSizeCategory` | `SMALL`, `MEDIUM`, `LARGE`, `EXTRA_LARGE`; parse ignore-case ở validator |
| `ParcelDeliveryMethod` | `TERMINAL_PICKUP` |
| `PaymentMethod` | `VNPAY`, `WALLET` |
| `ParcelStatus` | `PENDING_OPERATOR_REVIEW`, `PENDING_PAYMENT`, `PENDING`, `PENDING_ADDITIONAL_PAYMENT`, `LOADED`, `IN_TRANSIT`, `PENDING_TRANSFER_CONFIRM`, `TRANSFER_ESCALATED`, `UNLOADED`, `DELIVERED_PENDING_CONFIRM`, `DELIVERY_CONFIRMED`, `DELIVERY_REJECTED`, `RETURN_INITIATED`, `RETURNED`, `PENDING_OPERATOR_ACTION`, `CANCELLED`, `REJECTED`, `EXPIRED` |

## Tổng quan endpoint

| Method | Path | Mô tả ngắn |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/ready` | Readiness |
| GET | `/v1/ping` | Ping Parcel |
| GET | `/v1/parcels/available-trips` | Passenger tìm chuyến có thể gửi hàng |
| POST | `/v1/parcels` | Passenger tạo parcel |
| GET | `/v1/parcels/received` | Passenger xem parcel mình nhận |
| GET | `/v1/parcels/{parcelId}` | Xem chi tiết parcel |
| POST | `/v1/parcels/delivery/confirm` | Người nhận xác nhận giao hàng bằng token |
| POST | `/v1/parcels/delivery/reject` | Người nhận từ chối giao hàng bằng token |
| POST | `/v1/parcels/delivery/undo-reject` | Undo từ chối giao hàng bằng token |
| GET | `/v1/operator/parcels/reports/summary` | Operator xem báo cáo tổng hợp |
| GET | `/v1/operator/parcels/reports/export` | Operator export CSV |
| PATCH | `/v1/operator/parcels/{parcelId}/review` | Operator duyệt/từ chối parcel |
| POST | `/v1/operator/parcels/{parcelId}/request-transfer` | Operator yêu cầu chuyển parcel sang trip khác |
| POST | `/v1/operator/parcels/{parcelId}/return` | Operator trả hàng |
| POST | `/v1/operator/parcels/{parcelId}/cancel` | Operator hủy parcel |
| POST | `/v1/operator/parcels/{parcelId}/confirm-delivery` | Operator xác nhận giao hàng thủ công |
| PATCH | `/v1/operator/parcels/{parcelId}/status` | Operator override status, hiện chỉ hỗ trợ `RETURNED` |
| POST | `/v1/operator/parcel-route-fares` | Operator admin tạo fare gửi hàng theo route/size |
| GET | `/v1/operator/parcel-route-fares` | Operator admin/staff list fare |
| PATCH | `/v1/operator/parcel-route-fares/{routeId}/{sizeCategory}` | Operator admin cập nhật fare |
| POST | `/v1/assistant/parcels/{parcelId}/reweigh` | Assistant cân lại parcel |
| POST | `/v1/assistant/parcels/{parcelId}/confirm-delivery` | Assistant xác nhận giao hàng thủ công |
| POST | `/v1/assistant/parcels/{parcelId}/unload` | Assistant unload parcel |
| POST | `/internal/v1/parcels/{parcelId}/mark-loaded` | Internal mark loaded |
| POST | `/internal/v1/parcels/{parcelId}/confirm-transfer` | Internal confirm transfer |
| GET | `/internal/v1/parcels/{parcelId}` | Internal lấy parcel snapshot |
| GET | `/internal/v1/parcels/{parcelId}/access-check` | Internal kiểm tra quyền truy cập parcel |
| GET | `/internal/v1/trips/{tripId}/tracking-authorization/parcels` | Internal kiểm tra quyền tracking theo trip |

## Chi tiết endpoint

### GET `/health`

Liveness, không auth. Response không dùng `ApiResponse` envelope.

```json
{ "status": "ok", "service": "Parcel" }
```

```bash
curl "http://localhost:5005/health"
```

```js
await fetch("http://localhost:5005/health").then(r => r.json());
```

### GET `/ready`

Readiness, không auth. Chạy health checks có tag `ready` cho Postgres/Redis/RabbitMQ nếu config tương ứng tồn tại.

```json
{
  "status": "healthy",
  "service": "Parcel",
  "totalDurationMs": 12.3,
  "checks": [
    { "name": "postgres", "status": "healthy", "durationMs": 10.1, "description": null, "error": null }
  ]
}
```

```bash
curl "http://localhost:5005/ready"
```

```js
await fetch("http://localhost:5005/ready").then(r => r.json());
```

### GET `/v1/ping`

Ping endpoint public, không auth.

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "service": "Parcel",
    "status": "ok",
    "timestamp": "2026-07-05T10:00:00Z"
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T10:00:00.0000000Z" }
}
```

```bash
curl "http://localhost:5005/v1/ping"
```

```js
await fetch(`${baseUrl}/v1/ping`).then(r => r.json());
```

### GET `/v1/parcels/available-trips`

Passenger tìm trip có thể gửi parcel.

Auth: `Authorization: Bearer <token>` role `PASSENGER`.

Query params:

| Tên | Kiểu | Bắt buộc | Default | Validation |
|---|---|---:|---:|---|
| `originStationId` | Guid | Có | - | NotEmpty |
| `destinationStationId` | Guid | Có | - | NotEmpty |
| `departureDate` | DateOnly | Có | - | NotEmpty, không phải default |
| `estimatedWeightKg` | decimal | Có | - | `> 0` |
| `sizeCategory` | string | Có | - | enum `ParcelSizeCategory`, ignore-case |
| `page` | int | Không | `1` | `>= 1` |
| `pageSize` | int | Không | `20` | `1..100` |

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "tripId": "11111111-1111-4111-8111-111111111111",
        "routeId": "22222222-2222-4222-8222-222222222222",
        "operatorName": "VietRide Operator",
        "departureDateTime": "2026-07-05T08:00:00+07:00",
        "availableCargoWeightKg": 20.5,
        "priceVnd": 50000
      }
    ],
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T10:00:00.0000000Z" }
}
```

Errors trong code: `401/403` auth, `422 VALIDATION_ERROR`, `422 INVALID_SIZE_CATEGORY`, `404 OPERATOR_NOT_FOUND`, `503 TRIP_SEARCH_UNAVAILABLE`, `503 OPERATOR_LOOKUP_UNAVAILABLE`.

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5005/v1/parcels/available-trips?originStationId=11111111-1111-4111-8111-111111111111&destinationStationId=22222222-2222-4222-8222-222222222222&departureDate=2026-07-05&estimatedWeightKg=2.5&sizeCategory=SMALL&page=1&pageSize=20"
```

```js
await fetch(`${baseUrl}/v1/parcels/available-trips?originStationId=${originStationId}&destinationStationId=${destinationStationId}&departureDate=2026-07-05&estimatedWeightKg=2.5&sizeCategory=SMALL`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());
```

### POST `/v1/parcels`

Passenger tạo parcel.

Headers bắt buộc: `Authorization: Bearer <token>` role `PASSENGER`, `Idempotency-Key`.

Request body:

```json
{
  "tripId": "11111111-1111-4111-8111-111111111111",
  "dropoffStopId": "22222222-2222-4222-8222-222222222222",
  "bookingId": null,
  "itemName": "Áo khoác",
  "description": "Gói hàng nhỏ",
  "sizeCategory": "SMALL",
  "estimatedWeightKg": 2.5,
  "photoUrl": "https://example.com/photo.jpg",
  "recipient": {
    "fullName": "Nguyen Van A",
    "phoneNumber": "0900000000",
    "email": "a@example.com"
  },
  "deliveryMethod": "TERMINAL_PICKUP",
  "paymentMethod": "VNPAY"
}
```

Validation:

| Field | Kiểu | Bắt buộc | Rule |
|---|---|---:|---|
| `tripId` | Guid | Có | NotEmpty |
| `dropoffStopId` | Guid? | Không | Không có rule riêng |
| `bookingId` | Guid? | Không | Không có rule riêng |
| `itemName` | string? | Không | Không có rule riêng |
| `description` | string? | Không | max 2000 nếu không null |
| `sizeCategory` | string | Có | enum `ParcelSizeCategory`, ignore-case |
| `estimatedWeightKg` | decimal | Có | `> 0` |
| `photoUrl` | string? | Không | Không có rule riêng |
| `recipient.fullName` | string | Có | NotEmpty, max 255 |
| `recipient.phoneNumber` | string | Có | NotEmpty, max 20 |
| `recipient.email` | string? | Không | max 255, email nếu không null |
| `deliveryMethod` | string | Có | chỉ `TERMINAL_PICKUP` |
| `paymentMethod` | string | Có | `VNPAY` hoặc `WALLET` |

Success `201`:

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "parcelId": "33333333-3333-4333-8333-333333333333",
    "parcelCode": "PRC123456",
    "status": "PENDING_PAYMENT",
    "totalAmount": 50000,
    "paymentRedirectUrl": "https://payment.example/redirect"
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T10:00:00.0000000Z" }
}
```

Errors trong code: `400 VALIDATION_ERROR` model binding, `401/403`, `403 USER_NOT_PASSENGER`, `403 USER_INACTIVE`, `403 FORBIDDEN`, `404 USER_NOT_FOUND`, `404 TRIP_NOT_FOUND`, `404 BOOKING_NOT_FOUND`, `409 BOOKING_ALREADY_HAS_PARCEL`, `409 BOOKING_TRIP_MISMATCH`, `409 BOOKING_USER_MISMATCH`, `409 BOOKING_NOT_CONFIRMED`, `409 TRIP_NOT_OPEN_FOR_PARCEL`, `409 TRIP_CARGO_CAPACITY_EXCEEDED`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 USER_LOOKUP_UNAVAILABLE`, `503 TRIP_SERVICE_UNAVAILABLE`, `503 BOOKING_SERVICE_UNAVAILABLE`, `503 PAYMENT_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/parcels" \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: parcel-create-001" -H "Content-Type: application/json" \
  -d '{"tripId":"11111111-1111-4111-8111-111111111111","dropoffStopId":null,"bookingId":null,"itemName":"Áo khoác","description":"Gói hàng nhỏ","sizeCategory":"SMALL","estimatedWeightKg":2.5,"photoUrl":null,"recipient":{"fullName":"Nguyen Van A","phoneNumber":"0900000000","email":"a@example.com"},"deliveryMethod":"TERMINAL_PICKUP","paymentMethod":"VNPAY"}'
```

```js
await fetch(`${baseUrl}/v1/parcels`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": "parcel-create-001", "Content-Type": "application/json" },
  body: JSON.stringify(body)
}).then(r => r.json());
```

### GET `/v1/parcels/received`

Passenger lấy danh sách parcel mà user hiện tại là recipient.

Auth: `Authorization: Bearer <token>` role `PASSENGER`.

Query: `page` int default `1`, rule `>= 1`; `pageSize` int default `20`, rule `1..100`.

Success `200`: `PagedResult<ReceivedParcelResponse>`.

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "parcelId": "33333333-3333-4333-8333-333333333333",
        "parcelCode": "PRC123456",
        "status": "DELIVERED_PENDING_CONFIRM",
        "originStation": { "id": "11111111-1111-4111-8111-111111111111", "name": "Bến A" },
        "destinationStation": { "id": "22222222-2222-4222-8222-222222222222", "name": "Bến B" },
        "eta": "2026-07-05T12:00:00+07:00",
        "senderUserId": "44444444-4444-4444-8444-444444444444",
        "recipientName": "Nguyen Van A",
        "sizeCategory": "SMALL",
        "createdAt": "2026-07-05T08:00:00Z",
        "operatorId": "55555555-5555-4555-8555-555555555555",
        "tripId": "11111111-1111-4111-8111-111111111111"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T10:00:00.0000000Z" }
}
```

Errors trong controller metadata: `401`, `403`, `503`.

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5005/v1/parcels/received?page=1&pageSize=20"
```

```js
await fetch(`${baseUrl}/v1/parcels/received?page=1&pageSize=20`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
```

### GET `/v1/parcels/{parcelId}`

Lấy chi tiết parcel. Auth bất kỳ role có token; handler kiểm quyền bằng `userId`/`operatorId`.

Path params: `parcelId` Guid bắt buộc.

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "parcelId": "33333333-3333-4333-8333-333333333333",
    "parcelCode": "PRC123456",
    "status": "PENDING",
    "senderUserId": "44444444-4444-4444-8444-444444444444",
    "recipientUserId": null,
    "recipientName": "Nguyen Van A",
    "recipientPhone": "0900000000",
    "operatorId": "55555555-5555-4555-8555-555555555555",
    "tripId": "11111111-1111-4111-8111-111111111111",
    "dropoffStopId": null,
    "description": "Gói hàng nhỏ",
    "sizeCategory": "SMALL",
    "estimatedWeightKg": 2.5,
    "actualWeightKg": null,
    "deliveryMethod": "TERMINAL_PICKUP",
    "depositAmount": 50000,
    "additionalAmount": 0,
    "createdAt": "2026-07-05T08:00:00Z",
    "loadedAt": null,
    "unloadedAt": null,
    "deliveredPendingConfirmAt": null,
    "confirmedAt": null,
    "rejectedAt": null,
    "originStationName": "Bến A",
    "destinationStationName": "Bến B",
    "eta": null
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T10:00:00.0000000Z" }
}
```

Errors trong code/controller metadata: `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`.

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5005/v1/parcels/33333333-3333-4333-8333-333333333333"
```

```js
await fetch(`${baseUrl}/v1/parcels/${parcelId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
```

### Public delivery endpoints

Các endpoint này `[AllowAnonymous]` nhưng vẫn bắt buộc `Idempotency-Key`.

#### POST `/v1/parcels/delivery/confirm`

Body:

```json
{ "token": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }
```

Success `200` data:

```json
{ "parcelId": "33333333-3333-4333-8333-333333333333", "status": "DELIVERY_CONFIRMED", "confirmedAt": "2026-07-05T10:00:00Z" }
```

Errors trong code: `400 PARCEL_DELIVERY_TOKEN_INVALID`, `400 PARCEL_DELIVERY_TOKEN_EXPIRED`, `400 PARCEL_DELIVERY_TOKEN_REVOKED`, `400 PARCEL_NOT_PENDING_CONFIRM`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`.

```bash
curl -X POST "http://localhost:5005/v1/parcels/delivery/confirm" -H "Idempotency-Key: delivery-confirm-001" -H "Content-Type: application/json" -d '{"token":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}'
```

```js
await fetch(`${baseUrl}/v1/parcels/delivery/confirm`, { method: "POST", headers: { "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).then(r => r.json());
```

#### POST `/v1/parcels/delivery/reject`

Body:

```json
{ "token": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "rejectionReason": "Người nhận từ chối" }
```

Success data: `{ "parcelId": "...", "status": "DELIVERY_REJECTED", "rejectedAt": "...", "canUndoUntil": "..." }`.

Errors trong code: `400 PARCEL_DELIVERY_TOKEN_INVALID`, `400 PARCEL_DELIVERY_TOKEN_EXPIRED`, `400 PARCEL_DELIVERY_TOKEN_REVOKED`, `400 PARCEL_NOT_PENDING_CONFIRM`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`.

```bash
curl -X POST "http://localhost:5005/v1/parcels/delivery/reject" -H "Idempotency-Key: delivery-reject-001" -H "Content-Type: application/json" -d '{"token":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","rejectionReason":"Người nhận từ chối"}'
```

```js
await fetch(`${baseUrl}/v1/parcels/delivery/reject`, { method: "POST", headers: { "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ token, rejectionReason }) }).then(r => r.json());
```

#### POST `/v1/parcels/delivery/undo-reject`

Body:

```json
{ "token": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }
```

Success data: `{ "parcelId": "...", "status": "DELIVERED_PENDING_CONFIRM", "undoneAt": "..." }`.

Errors trong code: `400 PARCEL_DELIVERY_TOKEN_INVALID`, `400 PARCEL_DELIVERY_TOKEN_EXPIRED`, `400 PARCEL_DELIVERY_TOKEN_REVOKED`, `400 PARCEL_NOT_DELIVERY_REJECTED`, `400 PARCEL_DELIVERY_REJECTED_WINDOW_EXPIRED`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`.

```bash
curl -X POST "http://localhost:5005/v1/parcels/delivery/undo-reject" -H "Idempotency-Key: delivery-undo-001" -H "Content-Type: application/json" -d '{"token":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}'
```

```js
await fetch(`${baseUrl}/v1/parcels/delivery/undo-reject`, { method: "POST", headers: { "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).then(r => r.json());
```

### Operator parcel endpoints

Tất cả endpoint trong nhóm này yêu cầu `Authorization: Bearer <token>` role `OPERATOR_ADMIN` hoặc `OPERATOR_STAFF`, và claim `operatorId`; nếu thiếu `operatorId` trả `403 FORBIDDEN`.

#### GET `/v1/operator/parcels/reports/summary`

Query: `from` DateOnly? optional, `to` DateOnly? optional. Nếu `from > to`, code ném `ArgumentException`, filter map thành `500 INTERNAL_ERROR`.

Success data:

```json
{
  "operatorId": "55555555-5555-4555-8555-555555555555",
  "from": "2026-07-01",
  "to": "2026-07-05",
  "totalParcels": 10,
  "totalLoaded": 8,
  "totalDelivered": 6,
  "totalRejected": 1,
  "totalReturned": 1,
  "totalRevenue": 500000,
  "totalRefunded": 100000,
  "source": "db"
}
```

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5005/v1/operator/parcels/reports/summary?from=2026-07-01&to=2026-07-05"
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/reports/summary?from=2026-07-01&to=2026-07-05`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
```

#### GET `/v1/operator/parcels/reports/export`

Query: `from` DateOnly? optional, `to` DateOnly? optional, `format` string? optional. Handler chỉ hỗ trợ CSV; format khác ném `ArgumentException`, filter map thành `500 INTERNAL_ERROR`.

Success `200` content type từ handler, file download CSV, không wrap envelope.

```bash
curl -H "Authorization: Bearer $TOKEN" -o parcel-report.csv "http://localhost:5005/v1/operator/parcels/reports/export?format=csv"
```

```js
const blob = await fetch(`${baseUrl}/v1/operator/parcels/reports/export?format=csv`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.blob());
```

#### PATCH `/v1/operator/parcels/{parcelId}/review`

Headers: auth operator, `Idempotency-Key`.

Body:

```json
{ "decision": "APPROVED", "depositAmount": 50000, "reason": null, "paymentMethod": "VNPAY" }
```

Validation: `decision` must be `APPROVED` or `REJECTED`; khi `APPROVED`, `paymentMethod` NotEmpty và là `WALLET`/`VNPAY`, `depositAmount > 0`; khi `REJECTED`, `reason` NotEmpty.

Success data: `{ "parcelId": "...", "parcelCode": "PRC123456", "status": "PENDING_PAYMENT", "depositAmount": 50000, "paymentRedirectUrl": "..." }`.

Errors trong code: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS`, `409 INVALID_DECISION`, `409 RACE_LOST`, `422 INVALID_DECISION`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 PAYMENT_SERVICE_UNAVAILABLE`.

```bash
curl -X PATCH "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/review" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: review-001" -H "Content-Type: application/json" -d '{"decision":"APPROVED","depositAmount":50000,"reason":null,"paymentMethod":"VNPAY"}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/${parcelId}/review`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ decision: "APPROVED", depositAmount: 50000, reason: null, paymentMethod: "VNPAY" }) }).then(r => r.json());
```

#### POST `/v1/operator/parcels/{parcelId}/request-transfer`

Body: `{ "targetTripId": "11111111-1111-4111-8111-111111111111", "reason": "Trip disrupted" }`.

Success data `OperationalParcelResponse`: `parcelId`, `parcelCode`, `status`, optional `tripId`, `transferTargetTripId`, `transferConfirmedAt`, `returnReason`, `returnedAt`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `404 TRIP_NOT_FOUND`, `409 INVALID_TRANSITION`, `409 INVALID_TRANSFER_TARGET`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/request-transfer" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: transfer-001" -H "Content-Type: application/json" -d '{"targetTripId":"11111111-1111-4111-8111-111111111111","reason":"Trip disrupted"}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/${parcelId}/request-transfer`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ targetTripId, reason }) }).then(r => r.json());
```

#### POST `/v1/operator/parcels/{parcelId}/return`

Body: `{ "returnReason": "Không giao được" }`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_TRANSITION`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_NOT_FOUND`, `503 TRIP_CARGO_CAPACITY_EXCEEDED`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/return" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: return-001" -H "Content-Type: application/json" -d '{"returnReason":"Không giao được"}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/${parcelId}/return`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ returnReason }) }).then(r => r.json());
```

#### POST `/v1/operator/parcels/{parcelId}/cancel`

Body: `{ "reason": "Khách yêu cầu hủy", "refundChoice": "AUTO" }`.

`refundChoice` là string optional. Enum trong code: `FULL_REFUND`, `POLICY_REFUND`, `NO_REFUND`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_TRANSITION`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 INVALID_REFUND_CHOICE`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_NOT_FOUND`, `503 TRIP_CARGO_CAPACITY_EXCEEDED`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/cancel" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: cancel-001" -H "Content-Type: application/json" -d '{"reason":"Khách yêu cầu hủy","refundChoice":null}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/${parcelId}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ reason, refundChoice: null }) }).then(r => r.json());
```

#### POST `/v1/operator/parcels/{parcelId}/confirm-delivery`

Body: `{ "note": "Đã xác nhận tại quầy" }`. Validation: `note` NotEmpty, max 500.

Success data: `{ "parcelId": "...", "status": "DELIVERY_CONFIRMED", "confirmedAt": "..." }`.

Errors: `400 PARCEL_NOT_PENDING_CONFIRM`, `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`.

```bash
curl -X POST "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/confirm-delivery" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: manual-confirm-001" -H "Content-Type: application/json" -d '{"note":"Đã xác nhận tại quầy"}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/${parcelId}/confirm-delivery`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ note }) }).then(r => r.json());
```

#### PATCH `/v1/operator/parcels/{parcelId}/status`

Body: `{ "targetStatus": "RETURNED", "reason": "Đã hoàn tất trả hàng" }`. Validation: `targetStatus` NotEmpty, `reason` NotEmpty. Handler chỉ hỗ trợ target status `RETURNED`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_TRANSITION`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`.

```bash
curl -X PATCH "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/status" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: status-001" -H "Content-Type: application/json" -d '{"targetStatus":"RETURNED","reason":"Đã hoàn tất trả hàng"}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/${parcelId}/status`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ targetStatus: "RETURNED", reason }) }).then(r => r.json());
```

### Operator parcel route fare endpoints

#### POST `/v1/operator/parcel-route-fares`

Auth role `OPERATOR_ADMIN`, claim `operatorId`, `Idempotency-Key`.

Body:

```json
{
  "routeId": "22222222-2222-4222-8222-222222222222",
  "sizeCategory": "SMALL",
  "priceVnd": 50000,
  "effectiveFrom": "2026-07-05T00:00:00Z",
  "effectiveUntil": null
}
```

Validation: `routeId` NotEmpty; `sizeCategory` NotEmpty + valid enum; `priceVnd >= 1000`; `effectiveFrom` NotEmpty; nếu có `effectiveUntil` thì phải `> effectiveFrom`.

Success `201` data: `routeId`, `sizeCategory`, `operatorId`, `priceVnd`, `effectiveFrom`, `effectiveUntil`, `createdAt`, `updatedAt`.

Errors: `403 FORBIDDEN`, `404 ROUTE_NOT_FOUND`, `409 PARCEL_ROUTE_FARE_EXISTS`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/operator/parcel-route-fares" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: fare-create-001" -H "Content-Type: application/json" -d '{"routeId":"22222222-2222-4222-8222-222222222222","sizeCategory":"SMALL","priceVnd":50000,"effectiveFrom":"2026-07-05T00:00:00Z","effectiveUntil":null}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcel-route-fares`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
```

#### GET `/v1/operator/parcel-route-fares`

Auth role `OPERATOR_ADMIN` hoặc `OPERATOR_STAFF`.

Query: `routeId` Guid? optional, `sizeCategory` string? optional, `page` default `1`, `pageSize` default `20`. Handler validate `page >= 1`, `pageSize 1..100`, `sizeCategory` valid enum nếu có.

Errors: `403 FORBIDDEN`, `422 VALIDATION_ERROR`.

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5005/v1/operator/parcel-route-fares?page=1&pageSize=20&sizeCategory=SMALL"
```

```js
await fetch(`${baseUrl}/v1/operator/parcel-route-fares?page=1&pageSize=20`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
```

#### PATCH `/v1/operator/parcel-route-fares/{routeId}/{sizeCategory}`

Auth role `OPERATOR_ADMIN`, `Idempotency-Key`.

Path params: `routeId` Guid, `sizeCategory` string.

Body:

```json
{ "priceVnd": 60000, "effectiveFrom": "2026-07-05T00:00:00Z", "effectiveUntil": null }
```

Validation: ít nhất một field update phải được gửi; `priceVnd >= 1000` nếu có. `effectiveFrom/effectiveUntil` parse theo `DateTimeOffset`; handler có kiểm `effectiveUntil > effectiveFrom` khi đủ dữ liệu.

Errors: `403 FORBIDDEN`, `404 ROUTE_NOT_FOUND`, `404 PARCEL_ROUTE_FARE_NOT_FOUND`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X PATCH "http://localhost:5005/v1/operator/parcel-route-fares/$ROUTE_ID/SMALL" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: fare-update-001" -H "Content-Type: application/json" -d '{"priceVnd":60000,"effectiveFrom":null,"effectiveUntil":null}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcel-route-fares/${routeId}/SMALL`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ priceVnd: 60000, effectiveFrom: null, effectiveUntil: null }) }).then(r => r.json());
```

### Assistant endpoints

Tất cả yêu cầu `Authorization: Bearer <token>` role `ASSISTANT`, claim `operatorId`, và `Idempotency-Key`.

#### POST `/v1/assistant/parcels/{parcelId}/reweigh`

Body: `{ "actualWeightKg": 3.2, "actualSizeCategory": "MEDIUM", "paymentMethod": "WALLET" }`.

Validation: `actualWeightKg > 0`, `actualSizeCategory` NotEmpty, `paymentMethod` `WALLET`/`VNPAY`.

Success data: `parcelId`, `parcelCode`, `status`, `additionalAmount`, `paymentRedirectUrl`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS`, `409 RACE_LOST`, `422 INVALID_SIZE_CATEGORY`, `422 ADDITIONAL_PAYMENT_NOT_REQUIRED`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 PAYMENT_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/assistant/parcels/$PARCEL_ID/reweigh" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: reweigh-001" -H "Content-Type: application/json" -d '{"actualWeightKg":3.2,"actualSizeCategory":"MEDIUM","paymentMethod":"WALLET"}'
```

```js
await fetch(`${baseUrl}/v1/assistant/parcels/${parcelId}/reweigh`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ actualWeightKg: 3.2, actualSizeCategory: "MEDIUM", paymentMethod: "WALLET" }) }).then(r => r.json());
```

#### POST `/v1/assistant/parcels/{parcelId}/confirm-delivery`

Giống operator manual confirm delivery. Body `{ "note": "Đã xác nhận tại quầy" }`. Errors giống endpoint operator tương ứng.

```bash
curl -X POST "http://localhost:5005/v1/assistant/parcels/$PARCEL_ID/confirm-delivery" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: assistant-confirm-001" -H "Content-Type: application/json" -d '{"note":"Đã xác nhận tại quầy"}'
```

```js
await fetch(`${baseUrl}/v1/assistant/parcels/${parcelId}/confirm-delivery`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ note }) }).then(r => r.json());
```

#### POST `/v1/assistant/parcels/{parcelId}/unload`

Không có body. Success data: `{ "parcelId": "...", "parcelCode": "PRC123456", "status": "DELIVERED_PENDING_CONFIRM" }`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `404 TRIP_NOT_FOUND`, `409 INVALID_STATUS`, `409 RACE_LOST`, `422 DROP_OFF_STOP_NOT_FOUND`, `422 DROP_OFF_STOP_NOT_ALLOWED`, `422 DROP_OFF_STOP_NOT_ARRIVED`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_SERVICE_UNAVAILABLE`, `503 TRIP_CARGO_CAPACITY_EXCEEDED`.

```bash
curl -X POST "http://localhost:5005/v1/assistant/parcels/$PARCEL_ID/unload" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: unload-001"
```

```js
await fetch(`${baseUrl}/v1/assistant/parcels/${parcelId}/unload`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key } }).then(r => r.json());
```

### Internal endpoints

Tất cả endpoint internal yêu cầu `X-Internal-Auth: Bearer <internal_jwt>`.

#### POST `/internal/v1/parcels/{parcelId}/mark-loaded`

Headers: `X-Internal-Auth`, `Idempotency-Key`.

Body: `{ "tripId": "11111111-1111-4111-8111-111111111111", "parcelCode": "PRC123456", "confirmedByUserId": null }`.

Success data: `{ "parcelId": "...", "parcelCode": "PRC123456", "status": "LOADED" }`.

Errors: `401 AUTH_TOKEN_INVALID`, `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_NOT_FOUND`, `503 TRIP_CARGO_CAPACITY_EXCEEDED`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/internal/v1/parcels/$PARCEL_ID/mark-loaded" -H "X-Internal-Auth: Bearer $INTERNAL_JWT" -H "Idempotency-Key: mark-loaded-001" -H "Content-Type: application/json" -d '{"tripId":"11111111-1111-4111-8111-111111111111","parcelCode":"PRC123456","confirmedByUserId":null}'
```

```js
await fetch(`${baseUrl}/internal/v1/parcels/${parcelId}/mark-loaded`, { method: "POST", headers: { "X-Internal-Auth": `Bearer ${internalJwt}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ tripId, parcelCode, confirmedByUserId: null }) }).then(r => r.json());
```

#### POST `/internal/v1/parcels/{parcelId}/confirm-transfer`

Body: `{ "targetTripId": "11111111-1111-4111-8111-111111111111", "parcelCode": "PRC123456", "confirmedByUserId": "44444444-4444-4444-8444-444444444444" }`.

Errors: `401 AUTH_TOKEN_INVALID`, `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `404 TRIP_NOT_FOUND`, `409 INVALID_TRANSITION`, `409 INVALID_TRANSFER_TARGET`, `409 RACE_LOST`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/internal/v1/parcels/$PARCEL_ID/confirm-transfer" -H "X-Internal-Auth: Bearer $INTERNAL_JWT" -H "Idempotency-Key: confirm-transfer-001" -H "Content-Type: application/json" -d '{"targetTripId":"11111111-1111-4111-8111-111111111111","parcelCode":"PRC123456","confirmedByUserId":"44444444-4444-4444-8444-444444444444"}'
```

```js
await fetch(`${baseUrl}/internal/v1/parcels/${parcelId}/confirm-transfer`, { method: "POST", headers: { "X-Internal-Auth": `Bearer ${internalJwt}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ targetTripId, parcelCode, confirmedByUserId }) }).then(r => r.json());
```

#### GET `/internal/v1/parcels/{parcelId}`

Success data: `parcelId`, `tripId`, `status`, `senderUserId`, `recipientUserId`, `operatorId`, `dropoffStopId`.

Errors: `401 AUTH_TOKEN_INVALID`, `404 PARCEL_NOT_FOUND`.

```bash
curl -H "X-Internal-Auth: Bearer $INTERNAL_JWT" "http://localhost:5005/internal/v1/parcels/$PARCEL_ID"
```

```js
await fetch(`${baseUrl}/internal/v1/parcels/${parcelId}`, { headers: { "X-Internal-Auth": `Bearer ${internalJwt}` } }).then(r => r.json());
```

#### GET `/internal/v1/parcels/{parcelId}/access-check`

Query: `userId` Guid? optional, `operatorId` Guid? optional.

Success data: `{ "parcelId": "...", "allowed": true, "role": "SENDER" }`. `role` có thể là `SENDER`, `RECIPIENT`, `OPERATOR`, `NONE`.

Errors: `401 AUTH_TOKEN_INVALID`, `404 PARCEL_NOT_FOUND`.

```bash
curl -H "X-Internal-Auth: Bearer $INTERNAL_JWT" "http://localhost:5005/internal/v1/parcels/$PARCEL_ID/access-check?userId=$USER_ID"
```

```js
await fetch(`${baseUrl}/internal/v1/parcels/${parcelId}/access-check?userId=${userId}`, { headers: { "X-Internal-Auth": `Bearer ${internalJwt}` } }).then(r => r.json());
```

#### GET `/internal/v1/trips/{tripId}/tracking-authorization/parcels`

Query: `userId` Guid? optional, `role` string? optional, `operatorId` Guid? optional.

Success data: `{ "allowed": true, "scope": "OPERATOR", "error": null }`. `scope` khi allowed có thể là `OPERATOR`, `PARCEL_SENDER`, `PARCEL_RECIPIENT`.

Errors: `401 AUTH_TOKEN_INVALID`. Khi không đủ quyền theo parcel/trip, handler trả `200` với `{ "allowed": false, "scope": null, "error": "ACCESS_DENIED" }`.

```bash
curl -H "X-Internal-Auth: Bearer $INTERNAL_JWT" "http://localhost:5005/internal/v1/trips/$TRIP_ID/tracking-authorization/parcels?userId=$USER_ID&role=PASSENGER"
```

```js
await fetch(`${baseUrl}/internal/v1/trips/${tripId}/tracking-authorization/parcels?userId=${userId}&role=PASSENGER`, { headers: { "X-Internal-Auth": `Bearer ${internalJwt}` } }).then(r => r.json());
```

## Mã lỗi theo code

Các mã dưới đây xuất hiện trực tiếp trong Parcel/API/shared code đã đọc:

| HTTP | Code | Nguyên nhân |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Model binding JSON/type/missing field |
| 400 | `PARCEL_DELIVERY_TOKEN_INVALID` | Delivery token không tồn tại |
| 400 | `PARCEL_DELIVERY_TOKEN_EXPIRED` | Delivery token hết hạn |
| 400 | `PARCEL_DELIVERY_TOKEN_REVOKED` | Delivery token đã revoke |
| 400 | `PARCEL_NOT_PENDING_CONFIRM` | Parcel không ở trạng thái chờ xác nhận giao |
| 400 | `PARCEL_NOT_DELIVERY_REJECTED` | Undo reject khi parcel không ở trạng thái rejected |
| 400 | `PARCEL_DELIVERY_REJECTED_WINDOW_EXPIRED` | Hết cửa sổ undo reject |
| 401 | `AUTH_TOKEN_INVALID` | Internal JWT thiếu/sai |
| 401 | `UNAUTHORIZED` | Thiếu/sai user auth hoặc claim user id invalid |
| 403 | `FORBIDDEN` | Không có quyền, thiếu `operatorId`, hoặc operator không sở hữu parcel/trip |
| 403 | `USER_NOT_PASSENGER` | User tạo parcel không phải passenger |
| 403 | `USER_INACTIVE` | User inactive |
| 404 | `PARCEL_NOT_FOUND` | Không tìm thấy parcel hoặc parcel code/trip mismatch bị che thành not found |
| 404 | `TRIP_NOT_FOUND` | Không tìm thấy trip |
| 404 | `ROUTE_NOT_FOUND` | Không tìm thấy route khi thao tác fare |
| 404 | `PARCEL_ROUTE_FARE_NOT_FOUND` | Không tìm thấy fare route/size |
| 404 | `USER_NOT_FOUND` | Không tìm thấy user |
| 404 | `BOOKING_NOT_FOUND` | Không tìm thấy booking |
| 404 | `OPERATOR_NOT_FOUND` | Không tìm thấy operator khi enrich available trips |
| 409 | `INVALID_STATUS` | Trạng thái hiện tại không cho phép thao tác |
| 409 | `INVALID_TRANSITION` | Chuyển trạng thái không hợp lệ |
| 409 | `INVALID_TRANSFER_TARGET` | Trip chuyển không hợp lệ |
| 409 | `RACE_LOST` | Optimistic/concurrent update thất bại |
| 409 | `PARCEL_ROUTE_FARE_EXISTS` | Fare route/size đã tồn tại |
| 409 | `BOOKING_ALREADY_HAS_PARCEL` | Booking đã gắn parcel |
| 409 | `BOOKING_TRIP_MISMATCH` | Booking không thuộc trip request |
| 409 | `BOOKING_USER_MISMATCH` | Booking không thuộc user request |
| 409 | `BOOKING_NOT_CONFIRMED` | Booking chưa confirmed |
| 409 | `TRIP_NOT_OPEN_FOR_PARCEL` | Trip không mở nhận parcel |
| 409 | `TRIP_CARGO_CAPACITY_EXCEEDED` | Vượt tải cargo |
| 422 | `VALIDATION_ERROR` | FluentValidation hoặc validation thủ công |
| 422 | `INVALID_SIZE_CATEGORY` | Size category không hợp lệ |
| 422 | `INVALID_DECISION` | Review decision không hợp lệ |
| 422 | `INVALID_REFUND_CHOICE` | Refund choice không hợp lệ |
| 422 | `ADDITIONAL_PAYMENT_NOT_REQUIRED` | Reweigh không cần thanh toán thêm |
| 422 | `DROP_OFF_STOP_NOT_FOUND` | Không tìm thấy stop unload |
| 422 | `DROP_OFF_STOP_NOT_ALLOWED` | Stop không cho drop-off |
| 422 | `DROP_OFF_STOP_NOT_ARRIVED` | Stop chưa arrived |
| 422 | `IDEMPOTENCY_KEY_MISMATCH` | Reuse idempotency key với body khác |
| 503 | `TRIP_SERVICE_UNAVAILABLE` | Lỗi transport/dependency trip service |
| 503 | `TRIP_SEARCH_UNAVAILABLE` | Trip search lỗi transport |
| 503 | `OPERATOR_LOOKUP_UNAVAILABLE` | Identity/operator lookup lỗi |
| 503 | `USER_LOOKUP_UNAVAILABLE` | User lookup lỗi |
| 503 | `BOOKING_SERVICE_UNAVAILABLE` | Booking service lỗi |
| 503 | `PAYMENT_SERVICE_UNAVAILABLE` | Payment service lỗi |
| 500 | `INTERNAL_ERROR` | Exception không map rõ, ví dụ `ArgumentException` ở report format/date |

## Flow và lưu ý đặc biệt

- Passenger thường gọi `GET /v1/parcels/available-trips` trước, sau đó `POST /v1/parcels`.
- Parcel tạo bằng `paymentMethod=VNPAY` có thể trả `paymentRedirectUrl`; `WALLET` có thể trả null tùy handler Payment.
- Operator review `APPROVED` cần `depositAmount` và `paymentMethod`; `REJECTED` cần `reason`.
- Delivery public dùng `token` dạng Guid, không dùng Authorization header, nhưng bắt buộc `Idempotency-Key`.
- Internal endpoints dùng `X-Internal-Auth`, không dùng `Authorization`.
- Parcel service không tự rate-limit. Khi đi qua Gateway, request chịu global rate limit `120 req / 60s` theo `RATE_LIMIT_DEFAULT_PER_MIN`, Redis-backed mặc định; `THROTTLER_STORAGE_DISABLE_REDIS=1` chuyển sang in-memory.
