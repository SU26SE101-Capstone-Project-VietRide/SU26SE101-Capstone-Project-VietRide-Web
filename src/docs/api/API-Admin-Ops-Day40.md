# API Admin Operations Day 40

Tài liệu này mô tả contract backend Day 40 đã hoàn thành: quản trị User,
ActivityLog bất biến, chuẩn hóa và merge Station, canonical Station resolution,
Booking Station redirect, Station audit consumer và platform earned report.

Public API đi qua Gateway và dùng ADR 0004 `ApiResponse`. Các endpoint
`/internal/v1/...` chỉ dùng Internal JWT, trả raw DTO và không được expose qua
Gateway.

## Mục lục

- [Phạm vi](#phạm-vi)
- [Base URL](#base-url)
- [Xác thực và header](#xác-thực-và-header)
- [Response contract](#response-contract)
- [Business invariant](#business-invariant)
- [Tổng quan endpoint](#tổng-quan-endpoint)
- [Chi tiết public endpoint](#chi-tiết-public-endpoint)
- [Internal contract](#internal-contract)
- [Idempotency](#idempotency)
- [Integration event và consumer](#integration-event-và-consumer)
- [Mã lỗi](#mã-lỗi)
- [Flow tích hợp](#flow-tích-hợp)
- [Persistence](#persistence)
- [Verification](#verification)

## Phạm vi

### Trong phạm vi

- `SYSTEM_ADMIN` list/filter/page/sort User và xem soft-deleted User có kiểm soát.
- Lock/unlock User với PostgreSQL row lock, refresh-token revoke, Redis lockout
  reset và ActivityLog.
- Query ActivityLog và database immutability.
- Existing Station PATCH phát `trip.station.normalized`.
- Station merge atomic, OperatorStation collision collapse, Trip-owned FK
  relink và direct redirect flatten.
- Internal canonical Station resolution.
- Booking redirect consumer và advisory-lock canonicalization cho Station writer.
- Identity Station audit consumer.
- Booking, Trip, Parcel earned-report source và Payment orchestration.

### Ngoài phạm vi

- Access-token denylist hoặc phục hồi refresh token đã revoke.
- Public API expose deleted/merged Station.
- Cross-database foreign key.
- Stats materialization, Redis report cache và advanced analytics; defer Day 42.
- Payment ledger time làm nguồn earned report.

## Base URL

| Môi trường | Base URL | Ghi chú |
|---|---|---|
| Local Gateway | `http://localhost:3000` | Client gọi public API |
| Identity direct | `http://localhost:5001` | Chỉ debug/service test |
| Trip direct | `http://localhost:5002` | Chỉ debug/service test |
| Booking direct | `http://localhost:5003` | Chỉ debug/service test |
| Payment direct | `http://localhost:5004` | Chỉ debug/service test |
| Parcel direct | `http://localhost:5005` | Chỉ debug/service test |
| Production | `https://api.vietride.online` | Gateway giữ path `/v1/...` |

## Xác thực và header

### Public read API

```http
Authorization: Bearer <system-admin-access-token>
```

- JWT phải hợp lệ và role là `SYSTEM_ADMIN`.
- Gateway enforce RBAC; downstream service vẫn kiểm tra authorization.
- Read endpoint không yêu cầu `Idempotency-Key`.

### Public mutation

```http
Authorization: Bearer <system-admin-access-token>
Idempotency-Key: <unique-operation-key>
Content-Type: application/json
```

Key bắt buộc cho lock/unlock User, Station PATCH, Station merge và existing
Station DELETE. Actor lấy từ JWT; IP và user-agent lấy từ request context.

### Internal API

```http
X-Internal-Auth: <internal-jwt>
Content-Type: application/json
```

Internal endpoint không nhận user Bearer token. Read-only
`POST /internal/v1/operators/summaries/batch` là ngoại lệ được freeze, không
yêu cầu idempotency.

## Response contract

### Public success

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "meta": {
    "traceId": "req-400001",
    "timestamp": "2026-07-17T03:00:00Z"
  }
}
```

### Public failure

```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "from must be earlier than to.",
    "fields": [
      { "field": "from", "message": "from must be earlier than to." }
    ]
  },
  "meta": {
    "traceId": "req-400002",
    "timestamp": "2026-07-17T03:00:00Z"
  }
}
```

`error.fields` có thể không xuất hiện khi lỗi không gắn với field cụ thể.

### Internal success

Internal success trả raw DTO, không bọc ADR 0004:

```json
{
  "items": [
    {
      "operatorId": "40000000-0000-4000-8000-000000000010",
      "completedBookingCount": 12,
      "bookingRevenueVnd": 2400000
    }
  ]
}
```

## Business invariant

| Quy ước | Giá trị |
|---|---|
| JSON casing | `camelCase` |
| UUID | Canonical UUID/GUID |
| Report timestamp | RFC 3339 UTC, bắt buộc hậu tố `Z` |
| Report range | `[from,to)`, tối đa 366 ngày |
| Money | BIGINT VND; Parcel net có thể âm |
| Pagination | `page=1`, `pageSize=20`, tối đa 100 |
| Public role | `SYSTEM_ADMIN` |
| Event exchange | `vietride.events` |

Các invariant bắt buộc:

- User list không trả password hash, OAuth subject, token, OTP hoặc
  failed-login internals.
- Self-lock và self-unlock bị từ chối.
- Manual lock chỉ tạo `ACTIVE -> LOCKED`; ensure-lock trên User đã `LOCKED`
  giữ nguyên `lockedFromStatus`.
- Unlock chỉ restore `ACTIVE` hoặc `PENDING_EMAIL_VERIFICATION`; không tự verify
  email và không phục hồi refresh token đã revoke.
- Login, Google login, refresh, forgot/reset password, OTP failure,
  failed-login và admin lock/unlock dùng cùng per-User row-lock protocol.
- Station merge lock hai Station theo UUID ascending và recheck dưới lock.
- Merge không được tạo Route có origin trùng destination.
- Station mutation và Outbox event commit cùng transaction.
- Booking active được relink; Booking terminal giữ source Station ID/snapshot.
- Earned report chỉ đếm terminal status với terminal timestamp tương ứng.
- Report totals phải bằng tổng `byOperator`; overflow hoặc upstream failure
  không được trả partial response.

## Tổng quan endpoint

### Public Gateway

| Method | Path | Success | Mô tả |
|---|---|---:|---|
| GET | `/v1/admin/users` | 200 | Danh mục User |
| POST | `/v1/admin/users/{userId}/lock` | 200 | Lock User |
| POST | `/v1/admin/users/{userId}/unlock` | 200 | Unlock User |
| GET | `/v1/admin/activity-logs` | 200 | Query ActivityLog |
| PATCH | `/v1/admin/stations/{stationId}` | 200 | Normalize Station |
| POST | `/v1/admin/stations/{primaryStationId}/merge` | 200 | Merge Station |
| GET | `/v1/admin/reports/platform` | 200 | Platform earned report |

`POST /v1/admin/users` và Station GET/DELETE là existing contracts; Day 40 không
định nghĩa lại chúng.

### Internal service

| Method | Path | Success | Mô tả |
|---|---|---:|---|
| GET | `/internal/v1/stations/{id}` | 200 | Resolve Station |
| GET | `/internal/v1/reports/platform/bookings` | 200 | Booking source |
| GET | `/internal/v1/reports/platform/trips` | 200 | Trip source |
| GET | `/internal/v1/reports/platform/parcels` | 200 | Parcel source |
| POST | `/internal/v1/operators/summaries/batch` | 200 | Operator names |

## Chi tiết public endpoint

### GET `/v1/admin/users`

```http
GET /v1/admin/users?search=an&role=PASSENGER&status=ACTIVE&includeDeleted=false&page=1&pageSize=20&sortBy=createdAt&sortDir=desc
Authorization: Bearer <token>
```

| Query | Mặc định | Rule |
|---|---:|---|
| `search` | Không | Email/displayName/phone case-insensitive; tối đa 255 ký tự |
| `role` | Không | Thuộc `UserRole` |
| `status` | Không | Thuộc `UserStatus` |
| `operatorId` | Không | UUID |
| `includeDeleted` | `false` | `true` dùng IgnoreQueryFilters |
| `page` | `1` | > 0 |
| `pageSize` | `20` | 1..100 |
| `sortBy` | `createdAt` | `createdAt,email,displayName,role,status` |
| `sortDir` | `desc` | `asc` hoặc `desc` |

`status=DELETED` với `includeDeleted=false` trả empty page.

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": "40000000-0000-4000-8000-000000000001",
        "email": "passenger@example.test",
        "displayName": "Test Passenger",
        "phone": "+84901234567",
        "avatarUrl": null,
        "role": "PASSENGER",
        "status": "ACTIVE",
        "operatorId": null,
        "createdAt": "2026-07-01T03:00:00Z",
        "updatedAt": "2026-07-17T03:00:00Z",
        "deletedAt": null
      }
    ],
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "meta": { "traceId": "req-400003", "timestamp": "2026-07-17T03:00:00Z" }
}
```

Errors: `401 UNAUTHORIZED`, `403 FORBIDDEN`, `400 INVALID_SORT_FIELD`,
`422 VALIDATION_ERROR`.

### POST `/v1/admin/users/{userId}/lock`

Body rỗng, bắt buộc key:

```http
POST /v1/admin/users/40000000-0000-4000-8000-000000000001/lock
Authorization: Bearer <token>
Idempotency-Key: lock-user-40000000-0000-4000-8000-000000000001
Content-Type: application/json

{}
```

Thứ tự xử lý:

1. Từ chối self-lock và target không tồn tại.
2. `SELECT users ... FOR UPDATE`, reload/recheck status.
3. `ACTIVE -> LOCKED`, set `lockedFromStatus=ACTIVE`; hoặc ensure-lock nếu đã
   `LOCKED`.
4. Revoke mọi active refresh token với `ADMIN_REVOKE`.
5. Insert `LOCK_USER` ActivityLog.
6. Commit User, token revocation và audit trong cùng transaction.

Success:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "userId": "40000000-0000-4000-8000-000000000001",
    "status": "LOCKED",
    "statusChanged": true
  },
  "meta": { "traceId": "req-400004", "timestamp": "2026-07-17T03:05:00Z" }
}
```

Ensure-lock trả `statusChanged=false`, nhưng vẫn revoke active refresh token và
ghi audit cho logical request. Access token đã phát sống tới expiry.

Errors: `403 FORBIDDEN`, `404 RESOURCE_NOT_FOUND`,
`422 USER_INVALID_STATUS_TRANSITION` và idempotency errors.

### POST `/v1/admin/users/{userId}/unlock`

```http
POST /v1/admin/users/40000000-0000-4000-8000-000000000001/unlock
Authorization: Bearer <token>
Idempotency-Key: unlock-user-40000000-0000-4000-8000-000000000001
Content-Type: application/json

{}
```

Sau khi lock/reload User, backend xác nhận origin là `ACTIVE` hoặc
`PENDING_EMAIL_VERIFICATION`, xóa Redis
`identity:login_lockout:{userId}`, reset failed-login fields, clear origin và
insert `UNLOCK_USER` trong transaction.

Redis failure rollback command. Nếu DB commit fail sau Redis reset, DB
`LOCKED` vẫn chặn login; retry sẽ reset Redis lại.

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "userId": "40000000-0000-4000-8000-000000000001",
    "status": "PENDING_EMAIL_VERIFICATION",
    "statusChanged": true
  },
  "meta": { "traceId": "req-400005", "timestamp": "2026-07-17T03:10:00Z" }
}
```

Status response là origin thực tế, không hardcode `ACTIVE`.

### GET `/v1/admin/activity-logs`

```http
GET /v1/admin/activity-logs?userId=40000000-0000-4000-8000-000000000002&action=LOCK_USER&from=2026-07-17T00:00:00Z&to=2026-07-18T00:00:00Z&page=1&pageSize=20
Authorization: Bearer <token>
```

| Query | Rule |
|---|---|
| `userId` | Actor UUID |
| `action` | Thuộc `ActivityLogAction` |
| `from`,`to` | RFC 3339 UTC, range `[from,to)` |
| `page` | > 0, mặc định 1 |
| `pageSize` | 1..100, mặc định 20 |

Sort mặc định `createdAt DESC,id DESC`.

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": "40000000-0000-4000-8000-000000000020",
        "actor": {
          "id": "40000000-0000-4000-8000-000000000002",
          "email": "system-admin@example.test",
          "displayName": "System Admin",
          "role": "SYSTEM_ADMIN"
        },
        "action": "LOCK_USER",
        "metadata": {
          "targetUserId": "40000000-0000-4000-8000-000000000001",
          "previousStatus": "ACTIVE",
          "newStatus": "LOCKED",
          "statusChanged": true
        },
        "ipAddress": "192.0.2.10",
        "userAgent": "admin-test-client/1.0",
        "createdAt": "2026-07-17T03:05:00Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "meta": { "traceId": "req-400006", "timestamp": "2026-07-17T03:15:00Z" }
}
```

Metadata dùng allow-list, không chứa password, OTP, token hoặc full payload.
Direct SQL `UPDATE/DELETE` phải bị PostgreSQL trigger từ chối.

### PATCH `/v1/admin/stations/{stationId}`

Giữ nguyên existing PATCH surface:

```json
{
  "name": "Bến xe Miền Đông",
  "addressStreet": "292 Đinh Bộ Lĩnh",
  "locationId": "40000000-0000-4000-8000-000000000031",
  "city": "Thành phố Hồ Chí Minh",
  "province": "Hồ Chí Minh",
  "latitude": 10.8142,
  "longitude": 106.7108,
  "contactPhone": "+84281234567",
  "contactEmail": "station@example.test",
  "operatingHours": { "open": "05:00", "close": "22:00" },
  "facilities": ["parking", "waiting-room"],
  "supportsShuttle": true,
  "isActive": true
}
```

- Ít nhất một field.
- Coordinates gửi theo cặp và đúng range.
- Slug derive deterministic từ `name + city + province`; collision dùng
  Station-ID hash suffix, không tạo `STATION_SLUG_CONFLICT`.
- Station đã merged không được normalize.
- Update và `trip.station.normalized` Outbox commit cùng transaction.

Success trả `StationDto` gồm:

```text
id,name,slug,addressStreet,locationId,city,province,
latitude,longitude,contactPhone,contactEmail,
operatingHours,facilities,supportsShuttle,isActive,
createdAt,updatedAt
```

### POST `/v1/admin/stations/{primaryStationId}/merge`

```http
POST /v1/admin/stations/40000000-0000-4000-8000-000000000030/merge
Authorization: Bearer <token>
Idempotency-Key: merge-station-40000000-0000-4000-8000-000000000030
Content-Type: application/json

{ "duplicateId": "40000000-0000-4000-8000-000000000032" }
```

Preconditions:

- IDs non-empty và khác nhau.
- Primary active, non-deleted, canonical.
- Duplicate non-deleted, canonical.
- Lock hai Station UUID ascending, sau đó recheck.
- Preflight từ chối Route origin bằng destination.

Primary thắng `name,slug,city,province`. Nullable profile field chỉ lấy từ
duplicate khi primary null; coordinates merge theo cặp;
`supportsShuttle = primary OR duplicate`.

Atomic relink:

```text
OperatorStation.stationId
Route.originStationId
Route.destinationStationId
AlternativeRoute.destinationStationId
ShuttleTrip.stationId
Station.mergedIntoStationId của redirect cũ
```

OperatorStation collision giữ primary row, OR `isActive`, fill nullable config
khi primary null và xóa duplicate mapping. Duplicate được finalize:

```text
isActive = false
deletedAt = now
mergedIntoStationId = primaryStationId
```

Success:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "primaryStation": {
      "id": "40000000-0000-4000-8000-000000000030",
      "name": "Bến xe Miền Đông",
      "slug": "ben-xe-mien-dong",
      "addressStreet": "292 Đinh Bộ Lĩnh",
      "locationId": null,
      "city": "Thành phố Hồ Chí Minh",
      "province": "Hồ Chí Minh",
      "latitude": 10.8142,
      "longitude": 106.7108,
      "contactPhone": null,
      "contactEmail": null,
      "operatingHours": null,
      "facilities": null,
      "supportsShuttle": true,
      "isActive": true,
      "createdAt": "2026-07-01T03:00:00Z",
      "updatedAt": "2026-07-17T03:20:00Z"
    },
    "duplicateStationId": "40000000-0000-4000-8000-000000000032",
    "relinkedCounts": {
      "operatorMappings": 1,
      "collapsedOperatorMappings": 1,
      "routeOrigins": 2,
      "routeDestinations": 1,
      "alternativeRoutes": 1,
      "shuttleTrips": 1,
      "flattenedRedirects": 0
    }
  },
  "meta": { "traceId": "req-400007", "timestamp": "2026-07-17T03:20:00Z" }
}
```

Conflict trả `409 STATION_MERGE_CONFLICT`; không partial relink, redirect,
soft-delete hoặc Outbox.

### GET `/v1/admin/reports/platform`

```http
GET /v1/admin/reports/platform?from=2026-07-01T00:00:00Z&to=2026-07-18T00:00:00Z
Authorization: Bearer <token>
```

`from` và `to` bắt buộc, strict RFC 3339 UTC kết thúc bằng `Z`, `from < to`,
tối đa 366 ngày.

Earned metrics:

```text
Booking: COMPLETED + completed_at
         completedBookingCount, SUM(total_amount)
Trip:    COMPLETED + completed_at
         completedTripCount
Parcel:  DELIVERY_CONFIRMED + confirmed_at
         deliveredParcelCount,
         SUM(deposit_amount + additional_amount - refund_amount)
```

Success:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "period": {
      "from": "2026-07-01T00:00:00Z",
      "to": "2026-07-18T00:00:00Z",
      "timezone": "UTC"
    },
    "totals": {
      "completedBookingCount": 12,
      "completedTripCount": 8,
      "deliveredParcelCount": 5,
      "bookingRevenueVnd": 2400000,
      "parcelRevenueVnd": -50000,
      "netRevenueVnd": 2350000
    },
    "byOperator": [
      {
        "operatorId": "40000000-0000-4000-8000-000000000010",
        "operatorName": "Operator A",
        "completedBookingCount": 12,
        "completedTripCount": 8,
        "deliveredParcelCount": 5,
        "bookingRevenueVnd": 2400000,
        "parcelRevenueVnd": -50000,
        "netRevenueVnd": 2350000
      }
    ],
    "generatedAt": "2026-07-18T03:00:00Z"
  },
  "meta": { "traceId": "req-400008", "timestamp": "2026-07-18T03:00:00Z" }
}
```

`byOperator` là union ID từ ba source, sort `netRevenueVnd DESC` rồi
`operatorId ASC`. Missing operator giữ metrics với `operatorName=null`.
`netRevenueVnd = bookingRevenueVnd + parcelRevenueVnd`; signed negative là hợp
lệ. Totals bằng tổng breakdown.

Payment gọi ba source song song với timeout 5 giây, lookup Identity theo chunk
500. Không đọc foreign DB, không cache, không ghi Payment DB.

## Internal contract

### GET `/internal/v1/stations/{id}`

```json
{
  "id": "40000000-0000-4000-8000-000000000030",
  "name": "Bến xe Miền Đông",
  "slug": "ben-xe-mien-dong",
  "city": "Thành phố Hồ Chí Minh",
  "province": "Hồ Chí Minh",
  "latitude": 10.8142,
  "longitude": 106.7108,
  "supportsShuttle": true,
  "isActive": true,
  "isMerged": false,
  "canonicalStationId": "40000000-0000-4000-8000-000000000030",
  "createdAt": "2026-07-01T03:00:00Z",
  "updatedAt": "2026-07-17T03:20:00Z"
}
```

| Station state | Result |
|---|---|
| Active canonical | 200, `isMerged=false`, canonical ID bằng request ID |
| Soft-deleted do merge | 200, `isMerged=true`, canonical ID là target |
| Ordinary deleted | 404 `STATION_NOT_FOUND` |
| Không tồn tại | 404 `STATION_NOT_FOUND` |

Chỉ merged case dùng IgnoreQueryFilters. DTO không chứa contact phone/email.

### GET `/internal/v1/reports/platform/bookings`

```json
{
  "items": [
    {
      "operatorId": "40000000-0000-4000-8000-000000000010",
      "completedBookingCount": 12,
      "bookingRevenueVnd": 2400000
    }
  ]
}
```

### GET `/internal/v1/reports/platform/trips`

```json
{
  "items": [
    {
      "operatorId": "40000000-0000-4000-8000-000000000010",
      "completedTripCount": 8
    }
  ]
}
```

### GET `/internal/v1/reports/platform/parcels`

```json
{
  "items": [
    {
      "operatorId": "40000000-0000-4000-8000-000000000010",
      "deliveredParcelCount": 5,
      "parcelRevenueVnd": -50000
    }
  ]
}
```

Ba source dùng cùng strict UTC `[from,to)`. PostgreSQL `SUM(BIGINT)` được đọc
dạng `NUMERIC`, checked-convert về Int64. Parcel revenue không clamp âm.

### POST `/internal/v1/operators/summaries/batch`

```json
{
  "operatorIds": [
    "40000000-0000-4000-8000-000000000010",
    "40000000-0000-4000-8000-000000000011"
  ]
}
```

Raw response:

```json
[
  {
    "operatorId": "40000000-0000-4000-8000-000000000010",
    "operatorName": "Operator A"
  }
]
```

Tối đa 500 distinct non-empty IDs; empty list trả empty list; response sort ID
ascending và có thể include soft-deleted Operator. Missing ID không làm report
fail.

## Idempotency

Lock/unlock và Station merge dùng shared
`VietRide.Shared.Web.Idempotency.RequireIdempotencyAttribute`; no-body endpoint
dùng `AllowRequestBody=false`. Station PATCH tiếp tục dùng existing idempotency
filter contract.

| Tình huống | HTTP/code |
|---|---|
| Thiếu key | `422 IDEMPOTENCY_KEY_REQUIRED` |
| Cùng key, khác fingerprint | `422 IDEMPOTENCY_KEY_MISMATCH` |
| Request cùng key đang xử lý | `409 IDEMPOTENCY_REQUEST_PENDING` |
| Same key + same request đã xong | Replay nguyên status/body |
| Exception hoặc 5xx | Release reservation, không cache |

Completed replay không dispatch MediatR lần hai. GET và read-only internal POST
không dùng key.

## Integration event và consumer

### `trip.station.normalized`

```json
{
  "eventId": "40000000-0000-4000-8000-000000000040",
  "eventType": "trip.station.normalized",
  "occurredAt": "2026-07-17T03:15:00Z",
  "actorUserId": "40000000-0000-4000-8000-000000000002",
  "ipAddress": "192.0.2.10",
  "userAgent": "admin-test-client/1.0",
  "stationId": "40000000-0000-4000-8000-000000000030",
  "before": {
    "id": "40000000-0000-4000-8000-000000000030",
    "name": "Ben xe Mien Dong",
    "slug": "ben-xe-mien-dong-cu",
    "city": "Thu Duc",
    "province": "Ho Chi Minh",
    "latitude": 10.8142,
    "longitude": 106.7108,
    "supportsShuttle": false,
    "isActive": true
  },
  "after": {
    "id": "40000000-0000-4000-8000-000000000030",
    "name": "Bến xe Miền Đông",
    "slug": "ben-xe-mien-dong",
    "city": "Thành phố Hồ Chí Minh",
    "province": "Hồ Chí Minh",
    "latitude": 10.8142,
    "longitude": 106.7108,
    "supportsShuttle": true,
    "isActive": true
  }
}
```

Snapshot allow-list không chứa contact phone/email.

### `trip.station.merged`

```json
{
  "eventId": "40000000-0000-4000-8000-000000000041",
  "eventType": "trip.station.merged",
  "occurredAt": "2026-07-17T03:20:00Z",
  "actorUserId": "40000000-0000-4000-8000-000000000002",
  "ipAddress": "192.0.2.10",
  "userAgent": "admin-test-client/1.0",
  "primaryStationId": "40000000-0000-4000-8000-000000000030",
  "duplicateStationId": "40000000-0000-4000-8000-000000000032",
  "primaryBefore": {},
  "duplicateBefore": {},
  "primaryAfter": {},
  "relinkedCounts": {
    "operatorMappings": 1,
    "collapsedOperatorMappings": 1,
    "routeOrigins": 2,
    "routeDestinations": 1,
    "alternativeRoutes": 1,
    "shuttleTrips": 1,
    "flattenedRedirects": 0
  }
}
```

Ba Station snapshot dùng field allow-list như normalized event. Trip Outbox
commit cùng Station transaction.

### Booking consumer

Durable queue: `booking.station-merged`.

- `booking_station_redirects` đồng thời là redirect graph và event marker.
- Same `source_event_id` replay ACK/no-op.
- Same duplicate với target/event khác là poison conflict.
- Resolver có visited set và tối đa 32 hop.
- Out-of-order `A -> B`, `B -> C` phải flatten `A -> C` và `B -> C`.
- Bulk relink chỉ `PENDING_PAYMENT`, `CONFIRMED`.
- Terminal Booking giữ source Station ID/snapshot.
- Create/round-trip/edit pickup/dropoff và consumer dùng chung PostgreSQL
  advisory-lock namespace, UUID ascending.
- Không phát Payment/refund event.

### Identity consumer

| Event | ActivityLog action |
|---|---|
| `trip.station.normalized` | `STATION_NORMALIZED` |
| `trip.station.merged` | `STATION_MERGED` |

`ActivityLog.userId=actorUserId`, `source_event_id=eventId`. Atomic insert dùng
`ON CONFLICT DO NOTHING`. Missing actor retry/DLQ, không tạo fake User.

Structured logs không được in full event, contact PII, IP hoặc user-agent.

## Mã lỗi

| HTTP | Code | Nguyên nhân |
|---:|---|---|
| 400 | `INVALID_SORT_FIELD` | User sort field ngoài allow-list |
| 401 | `UNAUTHORIZED` | User JWT/Internal JWT không hợp lệ |
| 403 | `FORBIDDEN` | Sai role hoặc self-lock/unlock |
| 404 | `RESOURCE_NOT_FOUND` | User target không tồn tại |
| 404 | `STATION_NOT_FOUND` | Station không tồn tại/ordinary deleted |
| 409 | `STATION_MERGE_CONFLICT` | Merge precondition/domain conflict |
| 409 | `IDEMPOTENCY_REQUEST_PENDING` | Request cùng key đang xử lý |
| 422 | `VALIDATION_ERROR` | Body/query/range không hợp lệ |
| 422 | `USER_INVALID_STATUS_TRANSITION` | Lock/unlock transition sai |
| 422 | `IDEMPOTENCY_KEY_REQUIRED` | Mutation thiếu key |
| 422 | `IDEMPOTENCY_KEY_MISMATCH` | Key trùng, fingerprint khác |
| 500 | `REPORT_VALUE_OVERFLOW` | Source/aggregate vượt Int64 |
| 502 | `UPSTREAM_UNAVAILABLE` | Timeout/network/5xx/payload unusable |
| 500 | `INTERNAL_ERROR` | Exception chưa map |

Payment propagate upstream `REPORT_VALUE_OVERFLOW` thành cùng public 500.
Các upstream failure khác trở thành 502, không partial/cache/DB write.

## Flow tích hợp

### Lock/unlock

```text
SYSTEM_ADMIN -> Gateway RBAC -> shared idempotency
  -> User SELECT FOR UPDATE -> recheck state
  -> lock: revoke refresh token + LOCK_USER audit
  -> unlock: reset Redis/DB lockout + restore origin + UNLOCK_USER audit
  -> commit -> ADR 0004 response
```

Auth commit trước thì lock sau revoke refresh token vừa tạo. Lock commit trước
thì auth recheck thấy `LOCKED` và không phát token. Unlock không promote pending
email thành active.

### Station merge

```text
POST merge -> lock primary/duplicate UUID ascending
  -> preflight Route invariant -> merge profile
  -> relink OperatorStation/Route/AlternativeRoute/ShuttleTrip
  -> flatten redirects -> soft-delete duplicate
  -> Outbox trip.station.merged -> commit
  -> Booking relink active rows
  -> Identity immutable audit
```

### Platform report

```text
SYSTEM_ADMIN -> Payment validates UTC range
  -> Booking + Trip + Parcel internal calls in parallel
  -> checked Int64 values -> union operator IDs
  -> Identity names in chunks of 500
  -> sort + checked totals -> ADR 0004 response
```

## Persistence

### Identity

```text
users.locked_from_status user_status NULL
```

Origin chỉ nhận `ACTIVE|PENDING_EMAIL_VERIFICATION`; `LOCKED` phải có origin.
ActivityLog thêm `source_event_id UUID NULL`, partial unique index và index
`(created_at DESC,id DESC)`. Trigger chặn UPDATE/DELETE.

### Trip

```text
stations.merged_into_station_id UUID NULL
```

Self-FK `ON DELETE RESTRICT`, check khác chính nó và partial redirect index.
Completed report index:

```text
(completed_at,operator_id)
WHERE status='COMPLETED' AND completed_at IS NOT NULL
```

### Booking

```text
booking_station_redirects
  duplicate_station_id UUID PRIMARY KEY
  canonical_station_id UUID NOT NULL
  source_event_id UUID NOT NULL UNIQUE
  occurred_at TIMESTAMPTZ NOT NULL
  created_at TIMESTAMPTZ NOT NULL
  updated_at TIMESTAMPTZ NOT NULL
  CHECK duplicate_station_id <> canonical_station_id
```

Không có cross-DB FK. Có index `canonical_station_id` và partial completed
report index `(completed_at,operator_id)`.

### Parcel

Partial report index:

```text
(confirmed_at,operator_id)
WHERE status='DELIVERY_CONFIRMED' AND confirmed_at IS NOT NULL
```

### Payment

Không thêm materialized report, cache hoặc DB write. Mọi count/revenue/totals
dùng checked `long`.

## Gateway routing

```text
/v1/admin/users             -> Identity
/v1/admin/activity-logs     -> Identity
/v1/admin/stations          -> Trip
/v1/admin/reports/platform  -> Payment
```

Internal routes không public. Longest-prefix phải đưa platform report tới
Payment.

## Verification

- `docs/handoff/day-40-plan.md` — APPROVED.
- `docs/handoff/day-40-checklist.md` — READY.
- `npm run e2e:day40` — isolated real stack `20/20` pass.
- Identity, Trip, Booking, Parcel, Payment build/format/test pass.
- Gateway test/build pass; Postman Day 40 có 14 request.
- Migration up/down/reapply pass.
- Identity và Booking PostgreSQL race gates chạy tối thiểu 50 vòng/case.

Không coi HTTP 2xx đơn thuần là acceptance. E2E phải kiểm tra database, Outbox,
consumer marker, redirect graph, signed/overflow report, upstream failure và
cleanup isolated stack.

## Implementation references

- `docs/handoff/day-40-plan.md`
- `docs/handoff/day-40-checklist.md`
- `apps/identity/src/VietRide.Identity.Api/Controllers/AdminUsersController.cs`
- `apps/identity/src/VietRide.Identity.Api/Controllers/AdminActivityLogsController.cs`
- `apps/trip/src/VietRide.Trip.Api/Controllers/AdminStationsController.cs`
- `apps/trip/src/VietRide.Trip.Api/Controllers/InternalStationsController.cs`
- `apps/payment/src/VietRide.Payment.Api/Controllers/AdminPlatformReportsController.cs`
- `apps/booking/src/VietRide.Booking.Api/Controllers/InternalPlatformReportsController.cs`
- `apps/trip/src/VietRide.Trip.Application/Events/StationMergedIntegrationEvent.cs`
- `apps/trip/src/VietRide.Trip.Application/Events/StationNormalizedIntegrationEvent.cs`
