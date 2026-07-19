# API Driver Operations Day 39

Tài liệu này mô tả phần backend Day 39 đã hoàn thành: báo sự cố chuyến đi, xác nhận xe đến điểm dừng/điểm cuối, mở khóa quy trình dỡ và giao bưu kiện, notification sự cố và idempotency v2. Nội dung được trình bày theo cấu trúc của `API-Voucher.md`.

## Mục lục

- [Base URL](#base-url)
- [Xác thực và header chung](#xác-thực-và-header-chung)
- [Response envelope](#response-envelope)
- [Quy ước và business invariant](#quy-ước-và-business-invariant)
- [Tổng quan endpoint](#tổng-quan-endpoint)
- [Chi tiết endpoint](#chi-tiết-endpoint)
- [Idempotency v2](#idempotency-v2)
- [Integration event và notification](#integration-event-và-notification)
- [Mã lỗi](#mã-lỗi)
- [Flow tích hợp](#flow-tích-hợp)
- [Persistence thay đổi](#persistence-thay-đổi)

## Base URL

| Môi trường | Base URL | Ghi chú |
|---|---|---|
| Local Gateway | `http://localhost:3000` | Client gọi API qua Gateway |
| Local Trip direct | `http://localhost:5002` | Chỉ dùng debug/service test |
| Local Parcel direct | `http://localhost:5005` | Chỉ dùng debug/service test |
| Production | `https://api.vietride.online` | Gateway giữ nguyên path `/v1/...` |

Ứng dụng client phải gọi qua Gateway. Internal service không dùng user endpoint để thay thế service-to-service contract.

## Xác thực và header chung

### Driver/Assistant Trip API

```http
Authorization: Bearer <user_access_token>
Idempotency-Key: <unique-key>
Content-Type: application/json
```

Điều kiện:

- Role phải là `DRIVER` hoặc `ASSISTANT`.
- JWT `sub` phải trùng `driverUserId` hoặc `assistantUserId` được assign cho Trip.
- Client không được truyền `operatorId` hoặc `reportedByUserId`; backend derive từ Trip và JWT.

### Assistant Parcel API

```http
Authorization: Bearer <user_access_token>
Idempotency-Key: <unique-key>
Content-Type: application/json
```

Backend tiếp tục áp dụng tenant scope và kiểm tra assistant được assign theo contract Parcel hiện có.

## Response envelope

### Thành công

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "meta": {
    "traceId": "req-123",
    "timestamp": "2026-07-16T03:00:00Z"
  }
}
```

### Thất bại

```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "TRIP_NOT_IN_PROGRESS",
    "message": "Trip must be in progress."
  },
  "meta": {
    "traceId": "req-123",
    "timestamp": "2026-07-16T03:00:00Z"
  }
}
```

Validation error có thể kèm `error.fields`:

```json
{
  "field": "photoUrls",
  "message": "photoUrls must contain at most 3 items."
}
```

## Quy ước và business invariant

| Quy ước | Giá trị |
|---|---|
| JSON casing | `camelCase` |
| UUID | Chuỗi `Guid` |
| Timestamp | ISO-8601 UTC |
| Incident category | `TRAFFIC_JAM`, `VEHICLE_BREAKDOWN`, `ACCIDENT`, `WEATHER`, `OTHER` |
| Trip hợp lệ cho incident/arrival | `IN_PROGRESS` |
| TripStop transition | `PENDING -> ARRIVED` |
| Parcel unload transition | `IN_TRANSIT -> UNLOADED` |
| Parcel deliver transition | `UNLOADED -> DELIVERED_PENDING_CONFIRM` |

Các invariant chính:

- Incident không thay đổi trạng thái hoặc dữ liệu vận hành của Trip.
- TripStop arrival không thay đổi `estimatedArrivalTime`.
- Destination arrival không complete Trip và không thay đổi `Trip.status`.
- `destinationArrivedAt` là physical arrival anchor riêng, không dùng `completedAt` thay thế.
- Unload chỉ release cargo; không sinh delivery token.
- Deliver mới sinh delivery token 48 giờ và chuyển sang chờ người nhận xác nhận.
- Mỗi mutation và Outbox event được lưu trong cùng transaction.

## Tổng quan endpoint

| Method | Path | Role | Success | Mô tả |
|---|---|---|---:|---|
| POST | `/v1/driver/trips/{tripId}/incident` | `DRIVER`, `ASSISTANT` | `201` | Báo sự cố Trip đang chạy |
| POST | `/v1/driver/trips/{tripId}/stops/{stopId}/arrive` | `DRIVER`, `ASSISTANT` | `200` | Xác nhận đến TripStop |
| POST | `/v1/driver/trips/{tripId}/destination/arrive` | `DRIVER`, `ASSISTANT` | `200` | Xác nhận đến destination terminal |
| POST | `/v1/assistant/parcels/{parcelId}/unload` | Assigned assistant | `200` | Dỡ bưu kiện sau đúng arrival anchor |
| POST | `/v1/assistant/parcels/{parcelId}/deliver` | Assigned assistant | `200` | Chuyển bưu kiện sang chờ xác nhận giao |

Route cũ sau đây không còn hợp lệ:

```text
POST /v1/operator/trips/{tripId}/stops/{stopId}/arrive
```

Gateway phải trả `404` cho route Operator cũ; không có alias hoặc deprecation route.

## Chi tiết endpoint

### POST `/v1/driver/trips/{tripId}/incident`

Báo sự cố trên Trip đang `IN_PROGRESS`.

Header bắt buộc:

```http
Authorization: Bearer <token>
Idempotency-Key: incident-<tripId>-<client-operation-id>
```

Request body:

```json
{
  "category": "TRAFFIC_JAM",
  "description": "Kẹt xe tại nút giao",
  "photoUrls": [
    "https://storage.example/incident-1.jpg"
  ],
  "latitude": 10.7731,
  "longitude": 106.7032
}
```

Validation:

| Field | Bắt buộc | Rule |
|---|---:|---|
| `category` | Có | Case-sensitive, thuộc 5 category được hỗ trợ |
| `description` | Không | Trim; whitespace-only thành `null`; tối đa 500 ký tự |
| `photoUrls` | Không | Tối đa 3 absolute HTTPS URL; trim và giữ thứ tự |
| `latitude` | Không | Phải đi cùng `longitude`; khoảng `-90..90` |
| `longitude` | Không | Phải đi cùng `latitude`; khoảng `-180..180` |

Success `201`:

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "incidentId": "39000000-0000-4000-8000-000000000001",
    "tripId": "39000000-0000-4000-8000-000000000002",
    "reportedByUserId": "39000000-0000-4000-8000-000000000003",
    "category": "TRAFFIC_JAM",
    "description": "Kẹt xe tại nút giao",
    "photoUrls": [
      "https://storage.example/incident-1.jpg"
    ],
    "latitude": 10.7731,
    "longitude": 106.7032,
    "reportedAt": "2026-07-16T03:00:00Z"
  },
  "meta": {
    "traceId": "req-123",
    "timestamp": "2026-07-16T03:00:00Z"
  }
}
```

Side effects:

- Tạo đúng một Incident.
- Tạo đúng một Outbox event `trip.incident.reported`.
- Không thay đổi Trip.
- Notification fan-out đến active `OPERATOR_ADMIN` của đúng operator.

Errors: `403 FORBIDDEN`, `404 TRIP_NOT_FOUND`, `422 TRIP_NOT_IN_PROGRESS`, `422 VALIDATION_ERROR` và các idempotency errors.

### POST `/v1/driver/trips/{tripId}/stops/{stopId}/arrive`

Xác nhận xe đến một TripStop. Request body rỗng.

```http
POST /v1/driver/trips/39000000-0000-4000-8000-000000000002/stops/39000000-0000-4000-8000-000000000004/arrive
Authorization: Bearer <token>
Idempotency-Key: stop-arrive-39000000-0000-4000-8000-000000000004
Content-Type: application/json

{}
```

Business checks theo thứ tự:

1. Trip tồn tại.
2. Caller được assign cho Trip.
3. TripStop tồn tại và được lock.
4. TripStop vẫn `PENDING`.
5. Trip đang `IN_PROGRESS`.
6. Chuyển TripStop sang `ARRIVED`.

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "tripId": "39000000-0000-4000-8000-000000000002",
    "stopId": "39000000-0000-4000-8000-000000000004",
    "status": "ARRIVED",
    "actualArrivalTime": "2026-07-16T03:15:00Z"
  },
  "meta": {
    "traceId": "req-124",
    "timestamp": "2026-07-16T03:15:00Z"
  }
}
```

Side effects:

- Set `actualArrivalTime` đúng một lần.
- Giữ nguyên `estimatedArrivalTime`.
- Tạo đúng một Outbox event `trip.stop.arrived`.
- Request cạnh tranh với key khác: một winner `200`, request còn lại `409`.

Errors: `403 FORBIDDEN`, `404 TRIP_NOT_FOUND`, `404 TRIP_STOP_NOT_FOUND`, `409 TRIP_STOP_ALREADY_FINALIZED`, `422 TRIP_NOT_IN_PROGRESS` và idempotency errors.

### POST `/v1/driver/trips/{tripId}/destination/arrive`

Xác nhận xe đến destination terminal. Endpoint này hoạt động cả với express Trip không có TripStop. Request body rỗng.

```http
POST /v1/driver/trips/39000000-0000-4000-8000-000000000002/destination/arrive
Authorization: Bearer <token>
Idempotency-Key: destination-arrive-39000000-0000-4000-8000-000000000002
Content-Type: application/json

{}
```

Backend derive `destinationStationId` từ Route snapshot và atomically set:

- `Trip.destinationArrivedAt`
- `Trip.destinationArrivedByUserId`

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "tripId": "39000000-0000-4000-8000-000000000002",
    "destinationStationId": "39000000-0000-4000-8000-000000000005",
    "status": "ARRIVED",
    "actualArrivalTime": "2026-07-16T04:30:00Z"
  },
  "meta": {
    "traceId": "req-125",
    "timestamp": "2026-07-16T04:30:00Z"
  }
}
```

Side effects:

- Trip status giữ nguyên `IN_PROGRESS`.
- Không set `completedAt`.
- Tạo đúng một Outbox event `trip.destination.arrived`.
- Internal Trip snapshot expose thêm `destinationArrivedAt` cho Parcel.

Errors: `403 FORBIDDEN`, `404 TRIP_NOT_FOUND`, `409 TRIP_DESTINATION_ALREADY_ARRIVED`, `422 TRIP_NOT_IN_PROGRESS` và idempotency errors.

### POST `/v1/assistant/parcels/{parcelId}/unload`

Dỡ bưu kiện khỏi xe sau khi xe đã đến đúng arrival anchor. Request body rỗng.

```http
POST /v1/assistant/parcels/39000000-0000-4000-8000-000000000010/unload
Authorization: Bearer <token>
Idempotency-Key: parcel-unload-39000000-0000-4000-8000-000000000010
Content-Type: application/json

{}
```

Arrival gate:

| Parcel | Điều kiện unload |
|---|---|
| `dropoffStopId != null` | Matching TripStop phải là `ARRIVED` |
| `dropoffStopId == null` | Trip snapshot phải có `destinationArrivedAt` |

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "parcelId": "39000000-0000-4000-8000-000000000010",
    "status": "UNLOADED",
    "unloadedAt": "2026-07-16T04:35:00Z"
  },
  "meta": {
    "traceId": "req-126",
    "timestamp": "2026-07-16T04:35:00Z"
  }
}
```

Side effects:

- Chuyển duy nhất `IN_TRANSIT -> UNLOADED`.
- Release cargo ledger và giảm Trip cargo counters đúng một lần.
- Phát `parcel.parcel.unloaded`.
- Không set `deliveredPendingConfirmAt`.
- Không sinh delivery token.

Errors: `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS`, `422 DROP_OFF_STOP_NOT_ARRIVED`, `422 DESTINATION_TERMINAL_NOT_ARRIVED` và authorization/idempotency errors.

### POST `/v1/assistant/parcels/{parcelId}/deliver`

Chuyển Parcel đã unload sang trạng thái chờ người nhận xác nhận. Request body rỗng.

```http
POST /v1/assistant/parcels/39000000-0000-4000-8000-000000000010/deliver
Authorization: Bearer <token>
Idempotency-Key: parcel-deliver-39000000-0000-4000-8000-000000000010
Content-Type: application/json

{}
```

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "parcelId": "39000000-0000-4000-8000-000000000010",
    "status": "DELIVERED_PENDING_CONFIRM",
    "deliveredPendingConfirmAt": "2026-07-16T04:40:00Z",
    "deliveryTokenExpiresAt": "2026-07-18T04:40:00Z"
  },
  "meta": {
    "traceId": "req-127",
    "timestamp": "2026-07-16T04:40:00Z"
  }
}
```

Side effects:

- Chuyển duy nhất `UNLOADED -> DELIVERED_PENDING_CONFIRM`.
- Sinh delivery token có TTL 48 giờ.
- Phát `parcel.parcel.delivered_pending_confirm`.
- Không release cargo lần thứ hai.
- Existing `/confirm-delivery` tiếp tục là bước xác nhận cuối.

Errors: `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS` và authorization/idempotency errors.

## Idempotency v2

Tất cả mutation Day 39 bắt buộc `Idempotency-Key`.

Fingerprint bao gồm:

- Authenticated `sub`.
- HTTP method uppercase.
- `PathBase + Path`.
- Canonical query.
- Raw request body bytes.

Vì fingerprint có method/path/query/actor nên cùng một key không thể replay nhầm giữa incident, stop arrival, destination arrival, unload hoặc deliver.

Redis keys:

```text
<service>:idem:v2:processing:<SHA256(idempotencyKey)>
<service>:idem:v2:response:<SHA256(idempotencyKey)>
```

Quy tắc:

- Processing lock TTL: 120 giây.
- Cached response TTL: 24 giờ.
- Same key + same request sau khi hoàn thành: replay nguyên status/body.
- Same key + khác fingerprint: `422 IDEMPOTENCY_KEY_MISMATCH`.
- Same key trong lúc request đầu còn chạy: `409 IDEMPOTENCY_REQUEST_PENDING`.
- Exception hoặc response `5xx`: release lock, không cache.
- Chỉ lock owner được release processing key.

## Integration event và notification

### `trip.incident.reported`

```json
{
  "eventId": "uuid",
  "occurredAt": "2026-07-16T03:00:00Z",
  "incidentId": "uuid",
  "tripId": "uuid",
  "operatorId": "uuid",
  "reporterUserId": "uuid",
  "category": "TRAFFIC_JAM",
  "description": "Kẹt xe tại nút giao",
  "photoUrls": ["https://storage.example/incident-1.jpg"],
  "latitude": 10.7731,
  "longitude": 106.7032,
  "reportedAt": "2026-07-16T03:00:00Z"
}
```

Notification behavior:

- Resolve recipient bằng Identity internal API.
- Chỉ gửi đến active `OPERATOR_ADMIN` của đúng operator.
- Không gửi cho staff, inactive admin, reporter hoặc cross-operator user.
- Dedupe key: `trip.incident.reported:{eventId}:{userId}:INCIDENT_REPORTED`.
- Empty recipient list là success/no-op.
- Identity timeout/auth/non-2xx/invalid response phải throw để RabbitMQ retry.
- Không log description, photo URL, GPS hoặc full payload.

### `trip.stop.arrived`

```json
{
  "eventId": "uuid",
  "occurredAt": "2026-07-16T03:15:00Z",
  "tripId": "uuid",
  "stopId": "uuid",
  "operatorId": "uuid",
  "actorUserId": "uuid",
  "actualArrivalTime": "2026-07-16T03:15:00Z"
}
```

### `trip.destination.arrived`

```json
{
  "eventId": "uuid",
  "occurredAt": "2026-07-16T04:30:00Z",
  "tripId": "uuid",
  "destinationStationId": "uuid",
  "operatorId": "uuid",
  "actorUserId": "uuid",
  "actualArrivalTime": "2026-07-16T04:30:00Z"
}
```

### Parcel events

| Event | Phát khi | Side effect chính |
|---|---|---|
| `parcel.parcel.unloaded` | `IN_TRANSIT -> UNLOADED` | Cargo được release |
| `parcel.parcel.delivered_pending_confirm` | `UNLOADED -> DELIVERED_PENDING_CONFIRM` | Sinh token và notification giao hàng |

## Mã lỗi

| HTTP | Code | Nguyên nhân |
|---:|---|---|
| 401 | `UNAUTHORIZED` | Thiếu hoặc sai user access token |
| 403 | `FORBIDDEN` | Sai role, không được assign hoặc sai tenant |
| 404 | `TRIP_NOT_FOUND` | Không tìm thấy Trip/Route snapshot hợp lệ |
| 404 | `TRIP_STOP_NOT_FOUND` | Stop không thuộc Trip hoặc không tồn tại |
| 404 | `PARCEL_NOT_FOUND` | Không tìm thấy Parcel trong tenant scope |
| 409 | `TRIP_STOP_ALREADY_FINALIZED` | TripStop đã `ARRIVED` hoặc `SKIPPED` |
| 409 | `TRIP_DESTINATION_ALREADY_ARRIVED` | Destination arrival đã được ghi nhận |
| 409 | `INVALID_STATUS` | Parcel không ở trạng thái hợp lệ cho action |
| 409 | `IDEMPOTENCY_REQUEST_PENDING` | Request cùng key đang được xử lý |
| 422 | `TRIP_NOT_IN_PROGRESS` | Trip không ở `IN_PROGRESS` |
| 422 | `DROP_OFF_STOP_NOT_ARRIVED` | Chưa đến stop dỡ hàng |
| 422 | `DESTINATION_TERMINAL_NOT_ARRIVED` | Chưa có destination arrival anchor |
| 422 | `VALIDATION_ERROR` | Body/category/photo/GPS không hợp lệ |
| 422 | `IDEMPOTENCY_KEY_REQUIRED` | Mutation thiếu `Idempotency-Key` |
| 422 | `IDEMPOTENCY_KEY_MISMATCH` | Reuse key cho request khác fingerprint |
| 500 | `INTERNAL_ERROR` | Exception chưa được map |

## Flow tích hợp

### Incident

```text
Driver/Assistant
  -> POST incident qua Gateway
  -> Trip lock + validate assignment/state
  -> Incident + Outbox commit cùng transaction
  -> RabbitMQ trip.incident.reported
  -> Notification resolve active Operator Admin
  -> In-app notification + FCM delivery
```

### Stop-bound Parcel

```text
POST parcel/unload trước arrival
  -> 422 DROP_OFF_STOP_NOT_ARRIVED

POST trip/stops/{stopId}/arrive
  -> TripStop ARRIVED
  -> trip.stop.arrived

POST parcel/unload
  -> Parcel UNLOADED
  -> cargo RELEASED

POST parcel/deliver
  -> DELIVERED_PENDING_CONFIRM
  -> token 48h + notification

POST parcel/confirm-delivery
  -> final delivery confirmation
```

### Terminal-bound/Express Parcel

```text
POST parcel/unload trước destination arrival
  -> 422 DESTINATION_TERMINAL_NOT_ARRIVED

POST trip/destination/arrive
  -> destinationArrivedAt được set
  -> Trip status không đổi

POST parcel/unload
  -> UNLOADED

POST parcel/deliver
  -> DELIVERED_PENDING_CONFIRM
```

Express Trip không có TripStop vẫn dùng destination flow bình thường. Trip đã auto-complete nhưng chưa có `destinationArrivedAt` không được coi là đã tới bến.

## Persistence thay đổi

### Trip incidents

Thêm bảng `vietride_trip.incidents` với các nhóm field:

- Identity: `id`, `trip_id`, `reported_by_user_id`.
- Nội dung: `category`, `description`, `photo_urls` JSONB.
- Vị trí: `latitude DECIMAL(10,7)`, `longitude DECIMAL(10,7)`.
- Thời gian: `reported_at`, `resolved_at`, `created_at`, `updated_at`.
- Resolution: `resolved_by_user_id`, `resolution_note`.

PostgreSQL enum `incident_category` có đúng 5 labels. Migration có `Up()`/`Down()` và model snapshot đồng bộ.

### Trip destination arrival

Thêm hai nullable columns trên `trips`:

```text
destination_arrived_at TIMESTAMPTZ NULL
destination_arrived_by_user_id UUID NULL
```

`destination_arrived_by_user_id` là logical user reference, không tạo cross-database foreign key.

### Parcel

Không thêm status mới. Day 39 sửa đúng canonical state machine hiện có:

```text
IN_TRANSIT
  -> UNLOADED
  -> DELIVERED_PENDING_CONFIRM
  -> DELIVERED
```

Unload và deliver là hai transaction/business action độc lập, mỗi action có Outbox event riêng.
