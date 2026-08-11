# API Driver, Assistant and Vehicle Resource Availability

> Tài liệu handoff cho Frontend/Mobile/AI Agent. Nội dung được đối chiếu từ Gateway routes, Trip/Identity controllers, request DTO, FluentValidation, middleware, handlers, persistence service và test trong source hiện tại ngày **2026-08-11**.
>
> Phạm vi: các API đọc/ghi trực tiếp liên quan tới availability của tài xế, phụ xe, phương tiện; DriverSchedule; Trip/ShuttleTrip lifecycle; đổi route/xe/crew; và projection assignment của xe. Đây không phải tài liệu cho toàn bộ API của monorepo.

## Mục lục

- [1. Trạng thái deploy và base URL](#1-trạng-thái-deploy-và-base-url)
- [2. Xác thực, phân quyền và token hết hạn](#2-xác-thực-phân-quyền-và-token-hết-hạn)
- [3. Quy ước chung](#3-quy-ước-chung)
- [4. Rule availability thực tế](#4-rule-availability-thực-tế)
- [5. Bảng tổng quan endpoint](#5-bảng-tổng-quan-endpoint)
- [6. Schema dùng chung](#6-schema-dùng-chung)
- [7. Operator Admin Web - DriverSchedule](#7-operator-admin-web---driverschedule)
- [8. Operator Admin Web - Shuttle](#8-operator-admin-web---shuttle)
- [9. Operator Admin Web - Trip mutation và Vehicle assignment](#9-operator-admin-web---trip-mutation-và-vehicle-assignment)
- [10. Driver Mobile - Main Trip và Shuttle lifecycle](#10-driver-mobile---main-trip-và-shuttle-lifecycle)
- [11. Flow tích hợp bắt buộc](#11-flow-tích-hợp-bắt-buộc)
- [12. Mapping trách nhiệm cho 3 FE dev/agent](#12-mapping-trách-nhiệm-cho-3-fe-devagent)
- [13. Happy case và exception case đã có test](#13-happy-case-và-exception-case-đã-có-test)
- [14. Điểm FE phải lưu ý và TODO cần xác nhận](#14-điểm-fe-phải-lưu-ý-và-todo-cần-xác-nhận)

## 1. Trạng thái deploy và base URL

| Môi trường | Base URL FE gọi | Nguồn |
|---|---|---|
| Production | `https://api.vietride.online` | URL Swagger được cung cấp và runbook production |
| Local qua Gateway | `http://localhost:3000` | `.env.example`, Docker README và Postman environment |
| Trip service trực tiếp | `http://localhost:5002` | `TRIP_PORT=5002`; chỉ dùng cho backend/integration test, **không dùng từ FE** |
| Staging | ⚠️ TODO: cần xác nhận thêm | Không tìm thấy public staging base URL trong config/source |

Swagger UI production: `https://api.vietride.online/docs`.

OpenAPI Trip production: `https://api.vietride.online/api-specs/trip`.

### Release blocker hiện tại

Tại thời điểm đối chiếu **2026-08-11**, source branch hiện tại có hai endpoint:

- `POST /v1/operator/driver-schedules/availability-check`
- `POST /v1/operator/shuttle-trips/availability-check`

Nhưng OpenAPI Trip đang chạy trên production **chưa chứa hai path trên**. FE không được coi hai endpoint này đã sẵn sàng trên production cho tới khi backend được merge/deploy và OpenAPI production hiển thị chúng.

## 2. Xác thực, phân quyền và token hết hạn

### 2.1 Access token

- FE gửi `Authorization: Bearer <accessToken>` tới Gateway.
- Access token là JWT `RS256`, `issuer=vietride-identity`, `audience=vietride-api`.
- Gateway chỉ chấp nhận `RS256`, cho phép lệch clock 5 giây và verify bằng JWKS.
- Access token hiện được phát với `expiresInSeconds=900` (15 phút).
- Refresh token có TTL 30 ngày trong source.
- FE **không gửi** `X-Internal-Auth`. Gateway tự bỏ user `Authorization`, tạo Internal JWT và gắn `X-Internal-Auth` khi proxy tới Trip service.
- Có thể gửi `X-Request-Id` để trace; nếu không có, Gateway tự tạo. Response trả lại `X-Request-Id` và `meta.traceId`.

### 2.2 Lấy token

`POST {BASE_URL}/v1/auth/login`

```json
{
  "email": "operator@example.com",
  "password": "your-password"
}
```

Validation: `email` bắt buộc và đúng định dạng email; `password` bắt buộc, không rỗng.

Headers: `Content-Type: application/json`; không cần access token và không cần `Idempotency-Key`.

Success `200` dùng wrapper chuẩn, `data` có:

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "raw-refresh-token",
  "expiresInSeconds": 900,
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "email": "operator@example.com",
    "phone": "0900000000",
    "displayName": "Operator Admin",
    "role": "OPERATOR_ADMIN",
    "operatorId": "22222222-2222-4222-8222-222222222222",
    "status": "ACTIVE"
  }
}
```

Ở response login, `avatarUrl` xuất hiện khi user có giá trị; nếu null thì bị omit.

Lỗi có thể xảy ra theo handler/validator:

| HTTP | Code | Nguyên nhân |
|---:|---|---|
| 401 | `AUTH_INVALID_CREDENTIALS` | Email không tồn tại, không có password hash hoặc password sai |
| 403 | `AUTH_ACCOUNT_LOCKED` | Tài khoản ở trạng thái `LOCKED` |
| 403 | `AUTH_EMAIL_NOT_VERIFIED` | Tài khoản không phải passenger đang `PENDING_EMAIL_VERIFICATION` |
| 403 | `AUTH_PENDING_INITIAL_PASSWORD` | Operator/staff chưa đặt initial password |
| 403 | `FORBIDDEN` | Tài khoản không active, hoặc operator registration chưa `APPROVED` |
| 422 | `VALIDATION_ERROR` | Email rỗng/sai định dạng hoặc password rỗng |

```bash
curl -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"operator@example.com","password":"your-password"}'
```

```js
const loginResponse = await fetch(`${BASE_URL}/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({
    email: 'operator@example.com',
    password: 'your-password'
  })
});
const loginPayload = await loginResponse.json();
if (!loginResponse.ok) throw loginPayload;
const { accessToken, refreshToken } = loginPayload.data;
```

Refresh bằng `POST {BASE_URL}/v1/auth/refresh`:

```json
{
  "refreshToken": "raw-refresh-token"
}
```

`refreshToken` bắt buộc, không rỗng. Success trả lại token bundle và rotate refresh token. Lưu ý implementation refresh hiện không map `avatarUrl`, nên field này bị omit trong response refresh kể cả khi login trước đó từng trả field đó.

Headers: `Content-Type: application/json`; không cần access token và không cần `Idempotency-Key`.

| HTTP | Code | Nguyên nhân |
|---:|---|---|
| 401 | `AUTH_TOKEN_INVALID` | Refresh token không tồn tại, hết hạn, bị revoke hoặc bị reuse; reuse có thể revoke cả token family |
| 422 | `VALIDATION_ERROR` | `refreshToken` rỗng |

```bash
curl -X POST "$BASE_URL/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"raw-refresh-token"}'
```

```js
const refreshResponse = await fetch(`${BASE_URL}/v1/auth/refresh`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ refreshToken })
});
const refreshPayload = await refreshResponse.json();
if (!refreshResponse.ok) throw refreshPayload;
// Luôn thay cả hai giá trị vì refresh token được rotate.
storeTokens(refreshPayload.data.accessToken, refreshPayload.data.refreshToken);
```

### 2.3 Cách FE xử lý hết hạn

Khi API trả `401` với `error.code="AUTH_TOKEN_INVALID"`:

1. Thực hiện một request refresh duy nhất cho mọi request đang chờ (single-flight).
2. Lưu cả access token và refresh token mới.
3. Retry request ban đầu đúng một lần.
4. Nếu refresh cũng trả `401`, xóa session và đưa user về login. Không retry vô hạn.

Gateway trả đúng envelope sau khi thiếu/sai/hết hạn access token:

```json
{
  "success": false,
  "statusCode": 401,
  "error": {
    "code": "AUTH_TOKEN_INVALID",
    "message": "Authorization header is required or access token is invalid."
  },
  "meta": {
    "traceId": "...",
    "timestamp": "2026-08-11T10:00:00+07:00"
  }
}
```

Role không đúng trả `403 FORBIDDEN`, message `Access to this resource is forbidden.`. Downstream còn kiểm tra `operatorId`; operator khác tenant thường nhận `404` để không lộ resource.

## 3. Quy ước chung

### 3.1 Response wrapper

Success:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "meta": {
    "traceId": "...",
    "timestamp": "2026-08-11T10:00:00+07:00"
  }
}
```

`message` chỉ xuất hiện khi server đặt message; không nên assume luôn có.

Error:

```json
{
  "success": false,
  "statusCode": 409,
  "error": {
    "code": "TRIP_DRIVER_CONFLICT",
    "message": "DRIVER has an unavailable assignment window.",
    "fields": [
      { "field": "conflictReason", "message": "REPOSITION_REQUIRED" },
      { "field": "resourceRole", "message": "DRIVER" }
    ]
  },
  "meta": {
    "traceId": "...",
    "timestamp": "2026-08-11T10:00:00+07:00"
  }
}
```

`error.fields` là **array** `{field,message}`, không phải object map.

Để tài liệu không lặp lại hàng nghìn dòng wrapper, các JSON “Success” trong từng endpoint bên dưới mô tả chính xác phần `data`; response HTTP thực tế luôn bọc payload đó bằng envelope success ở trên (trừ `204 No Content`). Mọi endpoint có auth cũng có thể trả lỗi auth/role và lỗi hạ tầng tại mục 3.5, ngoài các domain error được liệt kê riêng ở endpoint.

### 3.2 Ngày giờ

- `DateTimeOffset` request: RFC 3339 phải có `Z` hoặc offset, ví dụ `2026-08-12T08:00:00+07:00`.
- Response public `/v1/*`: server chuyển `DateTimeOffset` sang `Asia/Ho_Chi_Minh`, ví dụ `2026-08-12T08:00:00+07:00`.
- `DateOnly`: `yyyy-MM-dd`.
- `TimeOnly`: dùng `HH:mm:ss`, ví dụ `08:00:00`.
- `dayOfWeek`: ISO weekday, `1=Monday`, ..., `7=Sunday`.
- Riêng `estimatedRecoveryDepartureAt` của vehicle substitution bắt buộc offset UTC `+00:00`/`Z`.

### 3.3 Idempotency-Key

Các mutation có ghi `Idempotency: Có` phải gửi:

```http
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

Key phải là UUID v4 canonical 36 ký tự. Mỗi thao tác mới dùng key mới; retry cùng thao tác giữ nguyên key và nguyên request.

| HTTP | Code | Nguyên nhân |
|---:|---|---|
| 422 | `IDEMPOTENCY_KEY_REQUIRED` | Thiếu/blank/nhiều hơn một header |
| 422 | `VALIDATION_ERROR` | Key không phải UUID v4 canonical |
| 422 | `IDEMPOTENCY_KEY_MISMATCH` | Dùng lại key với method/path/query/body khác |
| 409 | `IDEMPOTENCY_REQUEST_PENDING` | Request cùng key vẫn đang xử lý |

Response thành công được cache 86.400 giây; processing lock 120 giây. Các endpoint bodyless yêu cầu body thật sự rỗng; gửi `{}` có thể bị `422 VALIDATION_ERROR`.

### 3.4 Helper fetch dùng cho mọi ví dụ

```js
const BASE_URL = 'https://api.vietride.online';

async function apiFetch(path, { token, idempotencyKey, method = 'GET', body } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.error?.message ?? `HTTP ${response.status}`);
    error.status = response.status;
    error.code = payload?.error?.code;
    error.fields = payload?.error?.fields ?? [];
    error.traceId = payload?.meta?.traceId;
    throw error;
  }
  return payload?.data;
}
```

### 3.5 Lỗi hạ tầng chung

| HTTP | Code | Hành vi FE |
|---:|---|---|
| 400 | `INVALID_SORT_FIELD` | Sửa query sort, không retry |
| 401 | `AUTH_TOKEN_INVALID` | Refresh token theo flow trên |
| 403 | `FORBIDDEN` | Ẩn chức năng/đưa về màn không có quyền |
| 404 | `ROUTE_NOT_FOUND` | Sai Gateway path hoặc path chưa deploy; không nhầm với domain route |
| 422 | `VALIDATION_ERROR` | Map `error.fields` vào form |
| 429 | code từ exception filter | Backoff; ⚠️ source không chứng minh rõ raw proxy `/v1` có chạy Nest throttler nên cần xác nhận runtime |
| 500 | `INTERNAL_ERROR` | Hiển thị lỗi chung và log `traceId` |
| 502 | `UPSTREAM_UNAVAILABLE` | Gateway không kết nối được service; retry có backoff |
| 503 | `RESOURCE_TRAVEL_TIME_UNAVAILABLE` | Không cho submit; yêu cầu operator thử lại sau hoặc sửa dữ liệu tọa độ |

## 4. Rule availability thực tế

Backend yêu cầu cho từng resource dùng chung:

```text
next.start >= previous.end + 30 phút + Google Routes repositionTravelTime
```

Resource được bảo vệ:

- `DRIVER`: tài xế.
- `ASSISTANT`: phụ xe; conflict vẫn dùng code nhóm driver.
- `VEHICLE`: phương tiện.

Nguồn assignment: `DRIVER_SCHEDULE`, `TRIP`, `SHUTTLE_TRIP`.

Conflict reason:

| reason | Ý nghĩa |
|---|---|
| `TIME_OVERLAP` | Hai interval thời gian giao nhau |
| `TURNAROUND_REQUIRED` | Không overlap nhưng chưa đủ 30 phút tại cùng địa điểm/cùng Station |
| `REPOSITION_REQUIRED` | Chưa đủ 30 phút cộng thời gian chạy xe sang địa điểm kế tiếp |
| `RESOURCE_ACTIVE` | Resource đang thuộc một assignment `ACTIVE`; start chuyến sau bị chặn |

Các điểm chính đọc trực tiếp từ code:

- Cùng canonical Station hoặc cùng đúng cặp tọa độ: reposition = 0, vẫn cộng 30 phút.
- Khác địa điểm: gọi Google Routes `DRIVE`, `TRAFFIC_UNAWARE`, duration làm tròn lên phút.
- Không có tọa độ, Google chưa config, timeout, non-2xx hoặc response không có duration: fail closed `503 RESOURCE_TRAVEL_TIME_UNAVAILABLE`; transaction không ghi reservation dở dang.
- Engine kiểm tra interval overlap, assignment liền trước và liền sau. `earliestFeasibleStartAt` có thể là `null` nếu dời lịch vẫn không chen được trước assignment kế tiếp.
- DriverSchedule kiểm tra schedule lặp, tự-overlap, concrete Trip/Shuttle reservation và qua nửa đêm. Concrete Trip sinh trong rolling 30 ngày được recheck/reserve.
- Preview không tạo reservation và không giữ lock. Mutation thật luôn recheck trong transaction/lock; FE không được coi `available=true` là cam kết chắc chắn cho lần create sau.
- Cancel chuyển reservation sang `CANCELLED`; complete/disrupt release; start chuyển sang `ACTIVE`.
- Quan hệ driver-xe nằm trên assignment từng Trip/ShuttleTrip. Không có `Vehicle.currentDriverId` cố định.

## 5. Bảng tổng quan endpoint

| Method | Path | Role | Idempotency | Mô tả |
|---|---|---|---|---|
| POST | `/v1/auth/login` | Anonymous | Không | Lấy access token và refresh token |
| POST | `/v1/auth/refresh` | Anonymous | Không | Rotate refresh token và lấy token bundle mới |
| GET | `/v1/operator/driver-schedules` | STAFF, ADMIN | Không | Danh sách lịch lặp |
| POST | `/v1/operator/driver-schedules/availability-check` | ADMIN | Không | Preview conflict lịch lặp |
| POST | `/v1/operator/driver-schedules` | ADMIN | Không | Tạo lịch lặp |
| PATCH | `/v1/operator/driver-schedules/{id}?applyTo=...` | ADMIN | Có | Sửa schedule, tùy cascade Trip |
| PATCH | `/v1/operator/driver-schedules/{id}/crew` | ADMIN | Có | Alias đổi crew với `ALL_PENDING` |
| PATCH | `/v1/operator/driver-schedules/{id}/activate` | ADMIN | Không | Activate và generate Trip |
| PATCH | `/v1/operator/driver-schedules/{id}/deactivate` | ADMIN | Không | Deactivate schedule |
| DELETE | `/v1/operator/driver-schedules/{id}` | ADMIN | Có | Soft-delete khi chưa sinh Trip |
| GET | `/v1/operator/shuttle-requests` | STAFF, ADMIN | Không | Lấy nhóm booking chờ dispatch |
| POST | `/v1/operator/shuttle-requests/{mainTripId}/{bookingId}/cancel` | STAFF, ADMIN | Có | Cancel request chưa assign |
| POST | `/v1/operator/shuttle-trips/availability-check` | ADMIN | Không | Preview shuttle resource conflict |
| POST | `/v1/operator/shuttle-trips` | ADMIN | Có | Tạo ShuttleTrip và reserve |
| GET | `/v1/operator/shuttle-trips` | STAFF, ADMIN | Không | Lịch sử/danh sách ShuttleTrip |
| POST | `/v1/operator/shuttle-trips/{id}/cancel` | STAFF, ADMIN | Có | Cancel và giải phóng resource |
| PATCH | `/v1/operator/trips/{tripId}` | ADMIN | Có | Sửa route/vehicle/fare/notes và recheck |
| POST | `/v1/operator/trips/{tripId}/change-route` | ADMIN | Có | Đổi alternative route và recheck |
| POST | `/v1/operator/trips/{tripId}/substitute-vehicle` | ADMIN | Có | Tạo replacement Trip, đổi vehicle/crew |
| POST | `/v1/operator/trips/{tripId}/disrupt-no-substitution` | ADMIN | Có | Disrupt và release resource |
| POST | `/v1/operator/trips/{tripId}/cancel` | ADMIN | Có | Cancel trước khi chạy và release resource |
| GET | `/v1/operator/vehicles` | STAFF, ADMIN | Không | List xe kèm current/next assignment |
| GET | `/v1/operator/vehicles/{id}` | STAFF, ADMIN | Không | Detail xe kèm current/next assignment |
| GET | `/v1/driver/me/schedule` | DRIVER, ASSISTANT | Không | Main Trip được phân công |
| GET | `/v1/driver/trips/{tripId}/route` | DRIVER, ASSISTANT | Không | Route của Main Trip được phân công |
| GET | `/v1/driver/shuttle-trips` | DRIVER | Không | ShuttleTrip được phân công |
| GET | `/v1/driver/shuttle-trips/{id}/manifest` | DRIVER | Không | Manifest và thứ tự điểm |
| POST | `/v1/driver/trips/{tripId}/start` | DRIVER | Có, body rỗng | Start main Trip |
| POST | `/v1/driver/trips/{tripId}/complete` | DRIVER, ASSISTANT | Có, body rỗng | Complete main Trip |
| POST | `/v1/driver/shuttle-trips/{id}/start` | DRIVER | Có, body rỗng | Start ShuttleTrip |
| POST | `/v1/driver/shuttle-trips/{id}/stops/{order}/pickup` | DRIVER | Có, body rỗng | Pickup cả group |
| POST | `/v1/driver/shuttle-trips/{id}/stops/{order}/delivered` | DRIVER | Có, body rỗng | Delivered cả group |
| POST | `/v1/driver/shuttle-trips/{id}/stops/{order}/no-show` | DRIVER | Có | No-show cả group |
| POST | `/v1/driver/shuttle-trips/{id}/complete` | DRIVER | Có, body rỗng | Complete và release resource |

## 6. Schema dùng chung

### 6.1 `ResourceAvailabilityResult`

```json
{
  "available": false,
  "turnaroundMinutes": 30,
  "conflicts": [
    {
      "resourceRole": "DRIVER",
      "resourceId": "11111111-1111-4111-8111-111111111111",
      "reason": "REPOSITION_REQUIRED",
      "conflictingSourceType": "TRIP",
      "conflictingSourceId": "22222222-2222-4222-8222-222222222222",
      "sampleRequestedStartAt": "2026-08-12T10:01:00+07:00",
      "blockingUntil": "2026-08-12T12:30:00+07:00",
      "earliestFeasibleStartAt": "2026-08-12T12:30:00+07:00",
      "requiredTravelMinutes": 120,
      "turnaroundMinutes": 30
    }
  ],
  "hasMore": false
}
```

- Conflict được sort theo `sampleRequestedStartAt`, rồi role, rồi resource ID.
- Tối đa 100 item. `hasMore=true` nghĩa là còn conflict chưa trả.
- `earliestFeasibleStartAt=null` nghĩa là không tìm được start khả thi để vẫn nằm trước assignment sau.
- Khi `available=true`, `conflicts=[]`.

### 6.2 Conflict error của mutation

Mutation không trả `available=false`; nó hard-block `409`:

```json
{
  "success": false,
  "statusCode": 409,
  "error": {
    "code": "SHUTTLE_VEHICLE_CONFLICT",
    "message": "VEHICLE has an unavailable assignment window.",
    "fields": [
      { "field": "conflictReason", "message": "RESOURCE_ACTIVE" },
      { "field": "resourceRole", "message": "VEHICLE" },
      { "field": "resourceId", "message": "..." },
      { "field": "conflictingSourceType", "message": "TRIP" },
      { "field": "conflictingSourceId", "message": "..." },
      { "field": "blockingUntil", "message": "2026-08-12T10:00:00.0000000+00:00" }
    ]
  },
  "meta": { "traceId": "...", "timestamp": "2026-08-11T10:00:00+07:00" }
}
```

Code mapping:

- Main Trip/DriverSchedule: `TRIP_DRIVER_CONFLICT`, `TRIP_VEHICLE_CONFLICT`.
- ShuttleTrip: `SHUTTLE_DRIVER_CONFLICT`, `SHUTTLE_VEHICLE_CONFLICT`.
- `ASSISTANT` conflict dùng code `TRIP_DRIVER_CONFLICT` vì guard chỉ tách `VEHICLE` và non-vehicle.

### 6.3 `PagedResult<T>`

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalItems": 0,
  "totalPages": 0,
  "hasNextPage": false,
  "hasPreviousPage": false
}
```

### 6.4 Nguồn lấy đúng ID để submit

| Field | Phải lấy từ đâu | Không được dùng nhầm |
|---|---|---|
| `routeId` | `data.items[].id` của `GET /v1/operator/routes` | Station ID, alternative route ID |
| `vehicleId`, `replacementVehicleId` | `data.items[].id` của `GET /v1/operator/vehicles`; khi tạo assignment phải chọn xe active/usable theo rule endpoint mutation | Vehicle type ID, license plate |
| `driverUserId` | `data.items[].userId` của `GET /v1/operator/users?role=DRIVER&status=ACTIVE` | Driver profile/employee ID tự dựng; API list user này chỉ cho `OPERATOR_ADMIN` |
| `assistantUserId` | `data.items[].userId` của `GET /v1/operator/users?role=ASSISTANT&status=ACTIVE` | `driverUserId`; field nullable khi chuyến không có phụ xe |
| `mainTripId` | Group `data.items[].mainTripId` của `GET /v1/operator/shuttle-requests` hoặc Trip list của operator | Route ID/DriverSchedule ID |
| `orderedBookingIds` | `bookingGroups[].bookingId` trong **cùng** `mainTripId + direction` của `GET /v1/operator/shuttle-requests` | Ticket ID hoặc passenger user ID |
| `alternativeRouteId` | `data.items[].id` của `GET /v1/operator/routes/{routeId}/alternative-routes` | Main `routeId` |

`GET /v1/operator/users` thuộc Identity service; query hỗ trợ `page` (default 1, `>0`), `pageSize` (default 20, `1..100`), `search` (max 255), `sortBy=createdAt|email|displayName|role|status`, `sortDir=asc|desc`, `role=DRIVER|ASSISTANT|OPERATOR_STAFF` và enum `status`. Item trả `userId`, không trả field `id`.

## 7. Operator Admin Web - DriverSchedule

Tất cả URL trong phần này đi qua `{BASE_URL}` và cần `Authorization`. Gateway cho STAFF đi qua prefix, nhưng controller downstream chỉ cho STAFF ở endpoint list; các endpoint còn lại là ADMIN.

### 7.1 List DriverSchedule

**GET `/v1/operator/driver-schedules`** — role `OPERATOR_STAFF|OPERATOR_ADMIN`.

Query:

| Field | Type | Required | Default/validation |
|---|---|---:|---|
| `page` | integer | Không | `1`; source không có validator dương cho endpoint này, FE phải gửi `>=1` |
| `pageSize` | integer | Không | `20`; server cap tối đa `100`, FE phải gửi `>=1` |
| `routeId` | UUID | Không | Filter exact |
| `driverUserId` | UUID | Không | Filter exact driver |
| `isActive` | boolean | Không | Filter trạng thái |

Success `200`: `PagedResult<DriverScheduleDetailDto>`. Mỗi item có `id`, `operatorId`, `routeId`, `vehicleId`, `driverUserId`, `assistantUserId`, `dayOfWeek`, `departureTime`, `validFrom`, `validUntil`, `isActive`, `createdAt`, `updatedAt`, `route`, `vehicle`, `driver`, `assistant`, `baseFare`, `timeZone="Asia/Ho_Chi_Minh"`. Các object join có thể `null` nếu không resolve được.

```json
{
  "items": [
    {
      "id": "...",
      "operatorId": "...",
      "routeId": "...",
      "vehicleId": "...",
      "driverUserId": "...",
      "assistantUserId": null,
      "dayOfWeek": [1, 3, 5],
      "departureTime": "08:00:00",
      "validFrom": "2026-08-12",
      "validUntil": "2026-12-31",
      "isActive": true,
      "createdAt": "2026-08-11T10:00:00+07:00",
      "updatedAt": "2026-08-11T10:00:00+07:00",
      "route": null,
      "vehicle": null,
      "driver": null,
      "assistant": null,
      "baseFare": 150000,
      "timeZone": "Asia/Ho_Chi_Minh"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 1,
  "totalPages": 1,
  "hasNextPage": false,
  "hasPreviousPage": false
}
```

Errors: `401 AUTH_TOKEN_INVALID`, `403 FORBIDDEN`, `422 VALIDATION_ERROR` khi query không bind được; lỗi Identity upstream có thể được propagate. ⚠️ TODO: code list không đặt explicit mapping khi batch Identity profile lỗi.

```bash
curl --get "$BASE_URL/v1/operator/driver-schedules" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode "page=1" \
  --data-urlencode "pageSize=20" \
  --data-urlencode "isActive=true"
```

```js
const page = await apiFetch('/v1/operator/driver-schedules?page=1&pageSize=20&isActive=true', { token });
```

### 7.2 Preview availability DriverSchedule

**POST `/v1/operator/driver-schedules/availability-check`** — role `OPERATOR_ADMIN`, không cần `Idempotency-Key`.

Body:

| Field | Type | Required | Rule/code behavior |
|---|---|---:|---|
| `routeId` | UUID | Có | Không được empty; route phải thuộc operator |
| `vehicleId` | UUID/null | Không | Preview validator không kiểm tra empty/existence/active; nếu non-null thì engine dùng ID làm resource |
| `driverUserId` | UUID | Có | Không empty; preview không kiểm tra Identity role/operator/status |
| `assistantUserId` | UUID/null | Không | Nếu có phải khác `driverUserId`; preview không kiểm tra Identity role/operator/status |
| `dayOfWeek` | integer[] | Có | Không rỗng, mỗi số `1..7`, distinct |
| `departureTime` | time | Có theo request DTO | Dùng `HH:mm:ss` |
| `validFrom` | date | Có theo request DTO | `yyyy-MM-dd` |
| `validUntil` | date/null | Không | Nếu có phải `>= validFrom` |

```json
{
  "routeId": "10000000-0000-4000-8000-000000000001",
  "vehicleId": "20000000-0000-4000-8000-000000000001",
  "driverUserId": "30000000-0000-4000-8000-000000000001",
  "assistantUserId": "40000000-0000-4000-8000-000000000001",
  "dayOfWeek": [1, 3, 5],
  "departureTime": "08:00:00",
  "validFrom": "2026-08-12",
  "validUntil": "2026-12-31"
}
```

Success `200`: `ResourceAvailabilityResult`. `available=false` vẫn là HTTP `200`.

Endpoint errors:

| HTTP | Code | Khi nào |
|---:|---|---|
| 404 | `ROUTE_NOT_FOUND` | Route không tồn tại/không thuộc operator |
| 404 | `STATION_NOT_FOUND` | Thiếu origin/destination Station của route |
| 422 | `VALIDATION_ERROR` | Body/model/rule sai hoặc route không có duration > 0 |
| 503 | `RESOURCE_TRAVEL_TIME_UNAVAILABLE` | Thiếu tọa độ hoặc Google Routes không dùng được khi cần reposition |

```bash
curl -X POST "$BASE_URL/v1/operator/driver-schedules/availability-check" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"routeId":"10000000-0000-4000-8000-000000000001","vehicleId":"20000000-0000-4000-8000-000000000001","driverUserId":"30000000-0000-4000-8000-000000000001","assistantUserId":null,"dayOfWeek":[1,3,5],"departureTime":"08:00:00","validFrom":"2026-08-12","validUntil":"2026-12-31"}'
```

```js
const availability = await apiFetch('/v1/operator/driver-schedules/availability-check', {
  token, method: 'POST', body: scheduleDraft
});
```

### 7.3 Create DriverSchedule

**POST `/v1/operator/driver-schedules`** — role `OPERATOR_ADMIN`, không cần `Idempotency-Key` (explicit legacy exemption).

Body giống preview và thêm:

| Field | Type | Required | Rule |
|---|---|---:|---|
| `isActive` | boolean | Có theo DTO | Nếu `true`, chạy availability check và enqueue generation |
| `baseFare` | integer(int64)/null | Không | `>=0`; VND |

Khác preview: create validator **không bắt `dayOfWeek` distinct**. FE vẫn phải gửi distinct để dữ liệu sạch. Khi `isActive=false`, handler không chạy resource availability và không generate Trip.

Success `201`:

```json
{
  "id": "...",
  "operatorId": "...",
  "routeId": "...",
  "vehicleId": "...",
  "driverUserId": "...",
  "assistantUserId": null,
  "dayOfWeek": [1, 3, 5],
  "departureTime": "08:00:00",
  "validFrom": "2026-08-12",
  "validUntil": "2026-12-31",
  "isActive": true,
  "createdAt": "2026-08-11T10:00:00+07:00",
  "updatedAt": "2026-08-11T10:00:00+07:00",
  "baseFare": 150000,
  "timeZone": "Asia/Ho_Chi_Minh"
}
```

Errors: `404 ROUTE_NOT_FOUND`, `404 VEHICLE_NOT_FOUND`, `409 TRIP_DRIVER_CONFLICT`, `409 TRIP_VEHICLE_CONFLICT`, `422 VALIDATION_ERROR`, `503 RESOURCE_TRAVEL_TIME_UNAVAILABLE`, và eligibility/subscription errors do Identity trả (`402/403/409/503`, code được propagate). Driver/assistant phải đúng role và cùng operator; handler hiện **không kiểm tra user status ACTIVE** cho DriverSchedule.

```bash
curl -X POST "$BASE_URL/v1/operator/driver-schedules" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  --data '{"routeId":"10000000-0000-4000-8000-000000000001","vehicleId":"20000000-0000-4000-8000-000000000001","driverUserId":"30000000-0000-4000-8000-000000000001","assistantUserId":null,"dayOfWeek":[1,3,5],"departureTime":"08:00:00","validFrom":"2026-08-12","validUntil":null,"isActive":true,"baseFare":150000}'
```

```js
const created = await apiFetch('/v1/operator/driver-schedules', {
  token, method: 'POST', body: { ...scheduleDraft, isActive: true, baseFare: 150000 }
});
```

### 7.4 Update DriverSchedule

**PATCH `/v1/operator/driver-schedules/{id}?applyTo=FUTURE_ONLY|ALL_PENDING`** — role `OPERATOR_ADMIN`, `Idempotency-Key` bắt buộc.

Path: `id` là UUID bắt buộc. Query `applyTo` bắt buộc về mặt validation; server trim và uppercase.

Body patch disallow field lạ và phải có ít nhất một field:

| Field | Type | Có thể null | Rule |
|---|---|---:|---|
| `departureTime` | time | Không | `HH:mm:ss` |
| `dayOfWeek` | integer[] | Không | Không rỗng, mỗi số `1..7`; handler normalize sort/distinct |
| `driverUserId` | UUID | Không | Non-empty, đúng DRIVER cùng operator |
| `assistantUserId` | UUID/null | Có | `null` xóa assistant; non-null non-empty, đúng ASSISTANT cùng operator |
| `vehicleId` | UUID/null | Có | `null` xóa xe với `FUTURE_ONLY`; `ALL_PENDING` yêu cầu effective vehicle khác null |
| `validUntil` | date/null | Có | `null` bỏ end date; nếu có không trước `validFrom` |
| `isActive` | boolean | Không | null bị reject |
| `baseFare` | int64/null | Có | null xóa fare, non-null `>=0`; chỉ cho `FUTURE_ONLY` |

`FUTURE_ONLY`: chỉ sửa schedule cho generation tương lai; không sửa concrete Trip đã sinh. `ALL_PENDING`: cascade vào Trip liên kết có status `SCHEDULED|BOARDING`; đổi giờ reschedule Trip, đổi crew cập nhật crew, đổi xe swap xe, bỏ một weekday sẽ cancel Trip của weekday bị bỏ. `validUntil`/`isActive` không tự cancel concrete Trip đã sinh. Có booking `CONFIRMED` thì cả departure cũ và mới phải cách hiện tại ít nhất 2 giờ; đúng boundary 2 giờ được chấp nhận.

Success `200`: `DriverScheduleDto` cùng shape create.

Errors ngoài lỗi chung/conflict availability: `404 RESOURCE_NOT_FOUND`, `404 VEHICLE_NOT_FOUND`, `409 DRIVER_SCHEDULE_EDIT_TOO_LATE`, `409 TRIP_NOT_EDITABLE` (stale/concurrent/current status), `409 TRIP_VEHICLE_SWAP_HELD_SEAT_CONFLICT`, `409 TRIP_VEHICLE_SWAP_TOO_LATE`, `422 VALIDATION_ERROR`.

```bash
curl -X PATCH "$BASE_URL/v1/operator/driver-schedules/$SCHEDULE_ID?applyTo=ALL_PENDING" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" \
  --data '{"departureTime":"09:00:00","driverUserId":"30000000-0000-4000-8000-000000000002","assistantUserId":null,"vehicleId":"20000000-0000-4000-8000-000000000002"}'
```

```js
const updated = await apiFetch(`/v1/operator/driver-schedules/${scheduleId}?applyTo=ALL_PENDING`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'PATCH',
  body: { departureTime: '09:00:00', driverUserId: nextDriverId, assistantUserId: null, vehicleId: nextVehicleId }
});
```

### 7.5 Crew alias

**PATCH `/v1/operator/driver-schedules/{id}/crew`** — role `OPERATOR_ADMIN`, `Idempotency-Key` bắt buộc.

Body disallow field lạ:

```json
{
  "driverUserId": "30000000-0000-4000-8000-000000000002",
  "assistantUserId": null
}
```

`driverUserId` bắt buộc non-empty; `assistantUserId` optional/null, non-null phải non-empty. Endpoint chỉ là alias gọi canonical update với `applyTo=ALL_PENDING`, nên có toàn bộ behavior/error của `ALL_PENDING` và yêu cầu schedule có effective `vehicleId`.

Success `200`: `DriverScheduleDto`.

```bash
curl -X PATCH "$BASE_URL/v1/operator/driver-schedules/$SCHEDULE_ID/crew" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" \
  --data '{"driverUserId":"30000000-0000-4000-8000-000000000002","assistantUserId":null}'
```

```js
await apiFetch(`/v1/operator/driver-schedules/${scheduleId}/crew`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'PATCH',
  body: { driverUserId: nextDriverId, assistantUserId: null }
});
```

### 7.6 Activate, deactivate, delete

#### Activate

**PATCH `/v1/operator/driver-schedules/{id}/activate`**, ADMIN, không key, không body. Revalidate route/crew/availability; nếu đã active thì trả current DTO và không enqueue lại.

Success `200`: `DriverScheduleDto` cùng shape create, với `isActive=true`.

Errors: `404 RESOURCE_NOT_FOUND`, `404 ROUTE_NOT_FOUND`, `409 TRIP_DRIVER_CONFLICT`, `409 TRIP_VEHICLE_CONFLICT`, `422 VALIDATION_ERROR`, `503 RESOURCE_TRAVEL_TIME_UNAVAILABLE`, eligibility errors.

```bash
curl -X PATCH "$BASE_URL/v1/operator/driver-schedules/$SCHEDULE_ID/activate" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
await apiFetch(`/v1/operator/driver-schedules/${scheduleId}/activate`, { token, method: 'PATCH' });
```

#### Deactivate

**PATCH `/v1/operator/driver-schedules/{id}/deactivate`**, ADMIN, không key, không body. Behavior-idempotent; không cancel concrete Trip đã sinh.

Success `200`: `DriverScheduleDto` cùng shape create, với `isActive=false`.

Errors: `404 DRIVER_SCHEDULE_NOT_FOUND`, auth/role errors.

```bash
curl -X PATCH "$BASE_URL/v1/operator/driver-schedules/$SCHEDULE_ID/deactivate" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
await apiFetch(`/v1/operator/driver-schedules/${scheduleId}/deactivate`, { token, method: 'PATCH' });
```

#### Delete

**DELETE `/v1/operator/driver-schedules/{id}`**, ADMIN, key bắt buộc, không body. Chỉ soft-delete nếu chưa từng sinh Trip.

Success `200`: `{ "deleted": true }` trong `data`.

Errors: `404 DRIVER_SCHEDULE_NOT_FOUND`; `409 SCHEDULE_HAS_TRIPS` với field `tripCount`.

```bash
curl -X DELETE "$BASE_URL/v1/operator/driver-schedules/$SCHEDULE_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY"
```

```js
await apiFetch(`/v1/operator/driver-schedules/${scheduleId}`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'DELETE'
});
```

## 8. Operator Admin Web - Shuttle

### 8.1 List pending Shuttle requests

**GET `/v1/operator/shuttle-requests`** — role `OPERATOR_STAFF|OPERATOR_ADMIN`.

Query:

| Field | Type | Required | Default/behavior |
|---|---|---:|---|
| `page` | integer | Không | `1`; giá trị `<1` bị clamp thành `1` |
| `pageSize` | integer | Không | `20`; clamp vào `1..100` |

Success `200`:

```json
{
  "items": [
    {
      "mainTripId": "...",
      "routeName": "Sài Gòn - Đà Lạt",
      "direction": "INBOUND_TO_STATION",
      "departureDateTime": "2026-08-12T15:00:00+07:00",
      "hardCutoffAt": "2026-08-12T14:30:00+07:00",
      "stationId": "...",
      "stationName": "Bến xe Miền Tây",
      "pendingPassengerCount": 2,
      "bookingGroups": [
        {
          "bookingId": "...",
          "passengerCount": 2,
          "pickupAddress": "123 Nguyễn Văn A",
          "pickupLat": 10.75,
          "pickupLng": 106.67,
          "distanceToStationMeters": 2500,
          "requestedAt": "2026-08-11T09:00:00+07:00",
          "roadDistanceMeters": 3100,
          "passengers": [
            {
              "passengerUserId": "...",
              "displayName": "Passenger",
              "phone": "0900000000",
              "ticketIds": ["..."]
            }
          ]
        }
      ],
      "suggestedBookingOrder": ["..."]
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 1,
  "totalPages": 1,
  "hasNextPage": false,
  "hasPreviousPage": false
}
```

Cập nhật 2026-08-11 (BE commit `90ee9e97`): response đã là `PagedResult<ShuttleRequestTripGroup>`
đầy đủ `totalPages/hasNextPage/hasPreviousPage`, và mỗi group có thêm `routeName` để hiển thị thay
cho `mainTripId`. `bookingGroups[].passengers` luôn là mảng — chỉ `displayName`/`phone` có thể `null`
khi Identity không tìm được hồ sơ. Rỗng thì `items=[]`, `totalPages=0`, hai cờ đều `false`.

Errors: auth/role/tenant errors; upstream Identity profile có thể fail. Controller không khai báo validator riêng cho query vì đã clamp.

```bash
curl "$BASE_URL/v1/operator/shuttle-requests?page=1&pageSize=20" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const requests = await apiFetch('/v1/operator/shuttle-requests?page=1&pageSize=20', { token });
```

### 8.2 Preview Shuttle availability

**POST `/v1/operator/shuttle-trips/availability-check`** — role `OPERATOR_ADMIN`, không `Idempotency-Key`.

Body:

| Field | Type | Required | Rule |
|---|---|---:|---|
| `mainTripId` | UUID | Có | Non-empty, thuộc operator |
| `direction` | string | Có | Exact `INBOUND_TO_STATION` hoặc `OUTBOUND_FROM_STATION` |
| `driverUserId` | UUID | Có | Non-empty; preview không validate Identity role/status/tenant |
| `vehicleId` | UUID | Có | Non-empty; preview không validate vehicle existence/active |
| `scheduledDepartureTime` | RFC3339 | Có theo DTO | Có offset |
| `scheduledEndTime` | RFC3339 | Có | Phải sau departure |
| `orderedBookingIds` | UUID[] | Có | Không rỗng, non-empty UUID, distinct, đúng direction/mainTrip |

`orderedBookingIds` không chỉ là danh sách hành khách. Thứ tự quyết định snapshot endpoint cho availability:

- Inbound: start = pickup của booking đầu tiên; end = origin Station của main Trip.
- Outbound: start = destination Station của main Trip; end = pickup/dropoff point của booking cuối cùng.

```json
{
  "mainTripId": "10000000-0000-4000-8000-000000000001",
  "direction": "INBOUND_TO_STATION",
  "driverUserId": "30000000-0000-4000-8000-000000000001",
  "vehicleId": "20000000-0000-4000-8000-000000000001",
  "scheduledDepartureTime": "2026-08-12T13:30:00+07:00",
  "scheduledEndTime": "2026-08-12T14:20:00+07:00",
  "orderedBookingIds": [
    "50000000-0000-4000-8000-000000000001",
    "50000000-0000-4000-8000-000000000002"
  ]
}
```

Success `200`: `ResourceAvailabilityResult`; conflict vẫn trả `200 available=false`.

Endpoint errors:

| HTTP | Code | Khi nào |
|---:|---|---|
| 404 | `TRIP_NOT_FOUND` | Main Trip không có/khác operator |
| 404 | `STATION_NOT_FOUND` | Station của shuttle không có |
| 409 | `SHUTTLE_REQUEST_SET_CHANGED` | Booking ID không còn trong manifest đúng mainTrip/direction |
| 422 | `VALIDATION_ERROR` | Direction/time/list/UUID sai |
| 503 | `RESOURCE_TRAVEL_TIME_UNAVAILABLE` | Thiếu tọa độ hoặc Google Routes fail khi so với assignment khác địa điểm |

```bash
curl -X POST "$BASE_URL/v1/operator/shuttle-trips/availability-check" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  --data "$SHUTTLE_DRAFT_JSON"
```

```js
const shuttleAvailability = await apiFetch('/v1/operator/shuttle-trips/availability-check', {
  token, method: 'POST', body: shuttleDraft
});
```

### 8.3 Create ShuttleTrip

**POST `/v1/operator/shuttle-trips`** — role `OPERATOR_ADMIN`, `Idempotency-Key` bắt buộc.

Body giống preview và thêm:

| Field | Type | Required | Rule |
|---|---|---:|---|
| `notes` | string/null | Không | Tối đa 1.000 ký tự |

Create recheck availability trước transaction và dưới resource lock trong transaction. Ngoài availability, create còn validate:

- Main Trip phải `SCHEDULED`.
- Inbound phải dispatch trước hard cutoff; `scheduledEndTime` không được vượt quá `mainTrip.departureDateTime - 30 phút`.
- Outbound phải start từ `mainTrip.estimatedArrivalTime + 30 phút` trở đi.
- Vehicle phải thuộc operator, `isActive=true`, status `ACTIVE`.
- Driver phải thuộc operator, role `DRIVER`, status `ACTIVE`, có cả `displayName` và `phone`.
- Mọi booking group vẫn `PENDING_ASSIGNMENT` khi lock.
- Số passenger không vượt usable passenger seats.
- Mọi manifest phải có `roadDistanceMeters` và không vượt `SHUTTLE_MAX_DISTANCE_KM`. Từ 2026-08-11
  (BE commit `90ee9e97`) ngưỡng này là **10 km**: `roadDistanceMeters <= 10000` hợp lệ, lớn hơn trả
  `SHUTTLE_DISTANCE_EXCEEDED`. Đừng hardcode con số vào message hiển thị.

Success `201`:

```json
{
  "shuttleTripId": "...",
  "mainTripId": "...",
  "assignedPassengerCount": 2,
  "remainingPassengerCount": 0
}
```

Errors đầy đủ từ code của flow create:

| HTTP | Code | Nguyên nhân |
|---:|---|---|
| 402/403/409/503 | code Identity/subscription propagate | Operator hoặc shuttle entitlement không cho ghi/Identity unavailable |
| 404 | `TRIP_NOT_FOUND` | Main Trip không tồn tại/cross-tenant |
| 404 | `VEHICLE_NOT_FOUND` | Xe không tồn tại/inactive flag/cross-tenant |
| 404 | `DRIVER_NOT_FOUND` | Driver không active/đúng role/tenant hoặc thiếu displayName/phone |
| 409 | `BOOKING_TRIP_NOT_BOOKABLE` | Main Trip không còn `SCHEDULED` |
| 409 | `SHUTTLE_REQUEST_CUTOFF_PASSED` | Inbound cutoff đã qua |
| 409 | `SHUTTLE_REQUEST_SET_CHANGED` | Booking group đã đổi/đã được assign |
| 409 | `SHUTTLE_CAPACITY_EXCEEDED` | Quá capacity |
| 409 | `SHUTTLE_DRIVER_CONFLICT` | Driver trùng interval/turnaround/reposition/active |
| 409 | `SHUTTLE_VEHICLE_CONFLICT` | Xe không active hoặc trùng assignment |
| 422 | `SHUTTLE_DISTANCE_UNAVAILABLE` | Manifest thiếu road distance snapshot |
| 422 | `SHUTTLE_DISTANCE_EXCEEDED` | Vượt giới hạn km |
| 422 | `VALIDATION_ERROR` | Body, direction, schedule buffer, layout sai |
| 503 | `RESOURCE_TRAVEL_TIME_UNAVAILABLE` | Availability không tính được reposition |

```bash
curl -X POST "$BASE_URL/v1/operator/shuttle-trips" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" \
  --data '{"mainTripId":"10000000-0000-4000-8000-000000000001","direction":"INBOUND_TO_STATION","driverUserId":"30000000-0000-4000-8000-000000000001","vehicleId":"20000000-0000-4000-8000-000000000001","scheduledDepartureTime":"2026-08-12T13:30:00+07:00","scheduledEndTime":"2026-08-12T14:20:00+07:00","orderedBookingIds":["50000000-0000-4000-8000-000000000001"],"notes":null}'
```

```js
const shuttle = await apiFetch('/v1/operator/shuttle-trips', {
  token, idempotencyKey: crypto.randomUUID(), method: 'POST', body: { ...shuttleDraft, notes: null }
});
```

### 8.4 List ShuttleTrip

**GET `/v1/operator/shuttle-trips`** — role `OPERATOR_STAFF|OPERATOR_ADMIN`.

Query:

| Field | Type | Required | Default/validation |
|---|---|---:|---|
| `page` | integer | Không | `1`, clamp min `1` |
| `pageSize` | integer | Không | `20`, clamp `1..100` |
| `from` | date | Không | Nếu có phải `<=to`; `DateOnly.MaxValue` bị reject |
| `to` | date | Không | Nếu có phải `>=from`; `DateOnly.MaxValue` bị reject |
| `status` | comma-separated string | Không | `SCHEDULED,IN_PROGRESS,COMPLETED,CANCELLED`; trim + uppercase |

Success `200`: `PagedResult` với item:

```json
{
  "shuttleTripId": "...",
  "mainTripId": "...",
  "direction": "INBOUND_TO_STATION",
  "status": "SCHEDULED",
  "scheduledDepartureTime": "2026-08-12T13:30:00+07:00",
  "scheduledEndTime": "2026-08-12T14:20:00+07:00",
  "actualDepartureTime": null,
  "completedAt": null,
  "vehicle": { "id": "...", "licensePlate": "51B-123.45" },
  "driver": { "id": "...", "displayName": "Driver A", "phone": "0900000000" },
  "passengerCount": 2,
  "stopCount": 1
}
```

Errors: `422 VALIDATION_ERROR` cho date/status; auth/role errors; Identity upstream failure có thể trả service-unavailable code.

```bash
curl --get "$BASE_URL/v1/operator/shuttle-trips" -H "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode "page=1" --data-urlencode "pageSize=20" \
  --data-urlencode "status=SCHEDULED,IN_PROGRESS"
```

```js
const shuttlePage = await apiFetch('/v1/operator/shuttle-trips?page=1&pageSize=20&status=SCHEDULED%2CIN_PROGRESS', { token });
```

### 8.5 Cancel ShuttleTrip

**POST `/v1/operator/shuttle-trips/{shuttleTripId}/cancel`** — STAFF hoặc ADMIN, key bắt buộc.

Path `shuttleTripId`: UUID. Body:

```json
{ "reason": "Điều phối lại xe" }
```

`reason` phải non-blank; code không đặt max length tại endpoint này.

Success `200`:

```json
{
  "shuttleTripId": "...",
  "status": "CANCELLED",
  "changedPassengerCount": 2,
  "transitionedAt": "2026-08-11T10:00:00+07:00"
}
```

Nếu domain coi request cancel là no-op idempotent, `transitionedAt` có thể `null`. Cancel thành công chuyển reservation sang `CANCELLED` và giải phóng driver/vehicle cho assignment khác.

Errors: `404 SHUTTLE_TRIP_NOT_FOUND`, `409 SHUTTLE_TRIP_INVALID_STATE`, `422 VALIDATION_ERROR`, eligibility/subscription errors.

```bash
curl -X POST "$BASE_URL/v1/operator/shuttle-trips/$SHUTTLE_TRIP_ID/cancel" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" --data '{"reason":"Điều phối lại xe"}'
```

```js
await apiFetch(`/v1/operator/shuttle-trips/${shuttleTripId}/cancel`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'POST', body: { reason: 'Điều phối lại xe' }
});
```

### 8.6 Cancel Shuttle request chưa assign

**POST `/v1/operator/shuttle-requests/{mainTripId}/{bookingId}/cancel?direction=...`** — STAFF hoặc ADMIN, key bắt buộc.

Path `mainTripId`, `bookingId`: UUID. Query `direction` là string bắt buộc ở action; source không có validator enum riêng tại endpoint này. Body:

```json
{ "reason": "Hành khách đổi nhu cầu đưa đón" }
```

`reason` phải non-blank. Chỉ manifest còn `PENDING_ASSIGNMENT`, chưa có `shuttleTripId`, đúng `mainTripId + bookingId + direction` mới cancel được.

Success `200` dùng `ShuttleLifecycleResult`; vì chưa có ShuttleTrip, `shuttleTripId` là empty UUID:

```json
{
  "shuttleTripId": "00000000-0000-0000-0000-000000000000",
  "status": "CANCELLED",
  "changedPassengerCount": 2,
  "transitionedAt": "2026-08-11T10:00:00+07:00"
}
```

Errors: `404 TRIP_NOT_FOUND`, `409 SHUTTLE_REQUEST_NOT_CANCELLABLE`, `422 VALIDATION_ERROR`, eligibility/subscription errors. Direction sai nhưng bind được sẽ không match manifest và đi tới `SHUTTLE_REQUEST_NOT_CANCELLABLE`, không có `VALIDATION_ERROR` enum từ code hiện tại.

```bash
curl -X POST "$BASE_URL/v1/operator/shuttle-requests/$MAIN_TRIP_ID/$BOOKING_ID/cancel?direction=INBOUND_TO_STATION" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" --data '{"reason":"Hành khách đổi nhu cầu đưa đón"}'
```

```js
await apiFetch(`/v1/operator/shuttle-requests/${mainTripId}/${bookingId}/cancel?direction=INBOUND_TO_STATION`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'POST',
  body: { reason: 'Hành khách đổi nhu cầu đưa đón' }
});
```

## 9. Operator Admin Web - Trip mutation và Vehicle assignment

### 9.1 Edit concrete Trip

**PATCH `/v1/operator/trips/{tripId}`** — role `OPERATOR_ADMIN`, key bắt buộc.

Path `tripId`: UUID. Body disallow field lạ, ít nhất một field:

| Field | Type | Có thể null | Validation và trạng thái cho phép |
|---|---|---:|---|
| `baseFare` | int64 | Không | `>=0`; chỉ `SCHEDULED` |
| `notes` | string/null | Có | Non-null tối đa 2.000; `SCHEDULED\|BOARDING\|IN_PROGRESS` |
| `vehicleId` | UUID | Không | Non-empty, active, cùng operator; `SCHEDULED\|BOARDING` |
| `routeId` | UUID | Không | Non-empty, active, cùng operator; chỉ `SCHEDULED`, không có active booking |

**Không có** `departureDateTime`, `estimatedArrivalTime`, `driverUserId` hoặc `assistantUserId` trong endpoint này. FE gửi các field đó sẽ bị reject vì request DTO disallow unknown fields.

Khi đổi `vehicleId` hoặc `routeId`, handler refresh reservation và hard-block conflict interval/turnaround/reposition trong cùng transaction.

Ví dụ body:

```json
{
  "vehicleId": "20000000-0000-4000-8000-000000000002",
  "notes": "Đổi xe trước giờ khởi hành"
}
```

Success `200` trả đầy đủ `TripDetailDto`:

```json
{
  "tripId": "...",
  "operatorId": "...",
  "routeId": "...",
  "vehicleId": "...",
  "status": "SCHEDULED",
  "departureDateTime": "2026-08-12T08:00:00+07:00",
  "estimatedArrivalTime": "2026-08-12T10:00:00+07:00",
  "destinationArrivedAt": null,
  "baseFare": 150000,
  "originStation": { "id": "...", "name": "Hồ Chí Minh" },
  "destinationStation": { "id": "...", "name": "Cần Thơ" },
  "stops": [
    {
      "stopId": "...",
      "name": "Điểm dừng 1",
      "address": null,
      "latitude": 10.1,
      "longitude": 106.1,
      "isActive": true,
      "orderIndex": 1,
      "allowPickup": true,
      "allowDropoff": true,
      "status": "PENDING",
      "estimatedArrivalTime": "2026-08-12T09:00:00+07:00",
      "actualArrivalTime": null,
      "distanceFromOriginKm": 80.5,
      "fareFromThisStop": 100000,
      "effectiveFare": 100000,
      "surchargePercent": 0,
      "surchargeAmount": 0,
      "surchargePeriodId": null,
      "surchargePeriodName": null
    }
  ],
  "seatSummary": { "totalSeats": 40, "availableSeats": 40 },
  "returnRouteId": null,
  "fareBreakdown": {
    "baseFare": 150000,
    "stops": [
      {
        "stopId": "...",
        "fareFromThisStop": 100000,
        "surchargePercent": 0,
        "surchargeAmount": 0,
        "effectiveFareFromThisStop": 100000
      }
    ],
    "surchargePercent": 0,
    "surchargeAmount": 0,
    "effectiveBaseFare": 150000,
    "surchargePeriodId": null,
    "surchargePeriodName": null
  },
  "alternativeRouteId": null,
  "notes": "Đổi xe trước giờ khởi hành",
  "plannedEtaQuality": "FALLBACK",
  "surchargePercent": 0,
  "surchargeAmount": 0,
  "effectiveFare": 150000,
  "surchargePeriodId": null,
  "surchargePeriodName": null
}
```

Errors từ handler: `404 TRIP_NOT_FOUND`, `404 VEHICLE_NOT_FOUND`, `404 ROUTE_NOT_FOUND`, `409 TRIP_NOT_EDITABLE`, `409 TRIP_ROUTE_CHANGE_BOOKINGS_EXIST`, `409 TRIP_VEHICLE_CONFLICT`, `409 TRIP_DRIVER_CONFLICT`, `409 TRIP_VEHICLE_SWAP_HELD_SEAT_CONFLICT`, `409 TRIP_VEHICLE_SWAP_TOO_LATE`, `422 VEHICLE_NOT_ACTIVE`, `422 VALIDATION_ERROR`, `503 RESOURCE_TRAVEL_TIME_UNAVAILABLE`.

```bash
curl -X PATCH "$BASE_URL/v1/operator/trips/$TRIP_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" \
  --data '{"vehicleId":"20000000-0000-4000-8000-000000000002","notes":"Đổi xe trước giờ khởi hành"}'
```

```js
const trip = await apiFetch(`/v1/operator/trips/${tripId}`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'PATCH',
  body: { vehicleId: replacementVehicleId, notes: 'Đổi xe trước giờ khởi hành' }
});
```

### 9.2 Change Trip alternative route

**POST `/v1/operator/trips/{tripId}/change-route`** — role `OPERATOR_ADMIN`, key bắt buộc.

Body disallow field lạ:

```json
{ "alternativeRouteId": "60000000-0000-4000-8000-000000000001" }
```

`alternativeRouteId` bắt buộc, non-empty. Alternative route phải active, cùng operator và thuộc base `routeId` của Trip. Handler đổi destination assignment snapshot, rồi refresh availability trong transaction.

Admin lấy ID hợp lệ từ `GET /v1/operator/routes/{routeId}/alternative-routes`; không truyền `routeId` chính vào field này.

Success `200`:

```json
{
  "tripId": "...",
  "status": "SCHEDULED",
  "alternativeRouteId": "...",
  "affectedBookings": [
    {
      "bookingId": "...",
      "candidateStops": [
        {
          "stopId": "...",
          "stationId": null,
          "stationName": "Điểm dừng thay thế",
          "sequence": 1,
          "estimatedArrivalAt": "2026-08-12T09:15:00+07:00"
        }
      ]
    }
  ]
}
```

Mỗi candidate có đúng một trong `stopId` hoặc `stationId` non-null.

Errors: `404 TRIP_NOT_FOUND`, `404 ROUTE_NOT_FOUND`, `409 TRIP_NOT_EDITABLE`, resource conflict `TRIP_DRIVER_CONFLICT|TRIP_VEHICLE_CONFLICT`, `422 VALIDATION_ERROR`, `503 RESOURCE_TRAVEL_TIME_UNAVAILABLE`; Booking impact upstream có thể trả upstream error.

```bash
curl -X POST "$BASE_URL/v1/operator/trips/$TRIP_ID/change-route" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" --data '{"alternativeRouteId":"60000000-0000-4000-8000-000000000001"}'
```

```js
await apiFetch(`/v1/operator/trips/${tripId}/change-route`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'POST', body: { alternativeRouteId }
});
```

### 9.3 Substitute vehicle/crew khi Trip đang chạy

**POST `/v1/operator/trips/{tripId}/substitute-vehicle`** — role `OPERATOR_ADMIN`, key bắt buộc.

Body disallow field lạ:

| Field | Type | Required | Rule |
|---|---|---:|---|
| `replacementVehicleId` | UUID | Có | Non-empty, active, cùng operator |
| `estimatedRecoveryDepartureAt` | RFC3339 UTC | Có | Offset phải `00:00`, đồng thời phải sau `disruptedAt` do server lấy tại execution |
| `reason` | string | Có | Trim, non-blank, tối đa 500 |
| `notifyPassengers` | boolean | Không | Default `true` |
| `replacementCrew` | object/null | Không | Nếu bỏ qua, giữ crew của Trip cũ |
| `replacementCrew.driverId` | UUID | Có khi có object | Non-empty, active DRIVER cùng operator |
| `replacementCrew.assistantId` | UUID/null | Không | Non-empty nếu có, active ASSISTANT cùng operator |

```json
{
  "replacementVehicleId": "20000000-0000-4000-8000-000000000002",
  "estimatedRecoveryDepartureAt": "2026-08-12T04:30:00Z",
  "reason": "Xe chính gặp sự cố",
  "notifyPassengers": true,
  "replacementCrew": {
    "driverId": "30000000-0000-4000-8000-000000000002",
    "assistantId": null
  }
}
```

Chỉ Trip `IN_PROGRESS` được substitute. Trong cùng transaction: Trip cũ chuyển `DISRUPTED`, reservation cũ được release/truncate tại `disruptedAt`, Trip mới status `BOARDING` được tạo và reserve vehicle/crew mới.

Success `200`:

```json
{
  "substitutionId": "...",
  "oldTripId": "...",
  "oldTripStatus": "DISRUPTED",
  "newTripId": "...",
  "newTripStatus": "BOARDING",
  "newTripDepartureDateTime": "2026-08-12T11:30:00+07:00",
  "transferStatus": "QUEUED",
  "affectedBookingCount": 2,
  "affectedPassengerCount": 3,
  "pendingSeatAssignmentCount": 1
}
```

Errors: `404 TRIP_NOT_FOUND`, `404 VEHICLE_NOT_FOUND`, `409 TRIP_NOT_SUBSTITUTABLE`, `409 TRIP_VEHICLE_CONFLICT`, `409 TRIP_CREW_CONFLICT` (legacy exact-time precheck), `409 TRIP_DRIVER_CONFLICT` (interval engine), `422 VEHICLE_NOT_ACTIVE`, `422 VALIDATION_ERROR`, `503 RESOURCE_TRAVEL_TIME_UNAVAILABLE`, Booking/Identity upstream errors.

```bash
curl -X POST "$BASE_URL/v1/operator/trips/$TRIP_ID/substitute-vehicle" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" --data "$SUBSTITUTION_JSON"
```

```js
const substitution = await apiFetch(`/v1/operator/trips/${tripId}/substitute-vehicle`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'POST', body: substitutionDraft
});
```

### 9.4 Disrupt without substitution

**POST `/v1/operator/trips/{tripId}/disrupt-no-substitution`** — ADMIN, key bắt buộc.

Body disallow field lạ; `reason` non-blank, trim, tối đa 500:

```json
{ "reason": "Không có xe thay thế an toàn" }
```

Chỉ Trip `IN_PROGRESS`; terminal Trip bị `TRIP_ALREADY_TERMINAL`, non-IN_PROGRESS bị `TRIP_NOT_IN_PROGRESS`. Success release reservation tại `disruptedAt`.

```json
{
  "tripId": "...",
  "status": "DISRUPTED",
  "disruptedAt": "2026-08-12T10:05:00+07:00",
  "hasSubstitution": false,
  "reason": "Không có xe thay thế an toàn"
}
```

Errors: `404 TRIP_NOT_FOUND`, `409 TRIP_ALREADY_TERMINAL`, `409 TRIP_NOT_IN_PROGRESS`, `422 VALIDATION_ERROR`.

```bash
curl -X POST "$BASE_URL/v1/operator/trips/$TRIP_ID/disrupt-no-substitution" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" --data '{"reason":"Không có xe thay thế an toàn"}'
```

```js
await apiFetch(`/v1/operator/trips/${tripId}/disrupt-no-substitution`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'POST', body: { reason: 'Không có xe thay thế an toàn' }
});
```

### 9.5 Cancel concrete Trip

**POST `/v1/operator/trips/{tripId}/cancel`** — ADMIN, key bắt buộc.

Body `reason` non-blank, tối đa 500:

```json
{ "reason": "Hủy chuyến theo quyết định điều hành" }
```

Chỉ Trip `SCHEDULED|BOARDING`; cancel chuyển reservation sang `CANCELLED`.

Success `200`:

```json
{ "tripId": "...", "status": "CANCELLED" }
```

Errors: `404 TRIP_NOT_FOUND`, `409 TRIP_NOT_EDITABLE`, `422 VALIDATION_ERROR`; Booking/Parcel side effects được publish qua outbox, không làm thay đổi response shape này.

```bash
curl -X POST "$BASE_URL/v1/operator/trips/$TRIP_ID/cancel" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" --data '{"reason":"Hủy chuyến theo quyết định điều hành"}'
```

```js
await apiFetch(`/v1/operator/trips/${tripId}/cancel`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'POST', body: { reason: 'Hủy chuyến theo quyết định điều hành' }
});
```

### 9.6 List/detail Vehicle assignment

#### List

**GET `/v1/operator/vehicles`** — STAFF hoặc ADMIN.

| Query | Type | Required | Default/validation |
|---|---|---:|---|
| `page` | integer | Không | `1`, nếu có phải `>0` |
| `pageSize` | integer | Không | `20`, `1..100` |
| `search` | string | Không | Max 255 |
| `searchIn` | string | Không | Chỉ `licensePlate` |
| `sortBy` | string | Không | `licensePlate\|totalSeats\|status\|isActive\|createdAt\|updatedAt` |
| `sortDir` | string | Không | `asc\|desc`, default `desc` |

Success `200`: `PagedResult<VehicleDto>`.

#### Detail

**GET `/v1/operator/vehicles/{id}`** — STAFF hoặc ADMIN. Path `id`: UUID. `404 VEHICLE_NOT_FOUND` nếu không tồn tại/cross-tenant.

Vehicle sample đầy đủ cho cả list/detail:

```json
{
  "id": "...",
  "operatorId": "...",
  "vehicleTypeId": "...",
  "licensePlate": "51B-123.45",
  "seatLayoutJson": {
    "version": 1,
    "vehicleTypeCode": "BUS_40",
    "totalSeats": 40,
    "rows": 10,
    "cols": 4,
    "decks": 1,
    "aisles": [{ "afterCol": 2 }],
    "seats": [
      {
        "seatNumber": "A1",
        "row": 1,
        "col": 1,
        "deck": 1,
        "type": "STANDARD",
        "isWindow": true,
        "isAisle": false,
        "disabled": false
      }
    ]
  },
  "totalSeats": 40,
  "usablePassengerCapacity": 40,
  "maxCargoWeightKg": 1000.0,
  "maxCargoVolumeM3": 12.5,
  "imageUrls": null,
  "status": "ACTIVE",
  "isActive": true,
  "createdAt": "2026-08-01T10:00:00+07:00",
  "updatedAt": "2026-08-01T10:00:00+07:00",
  "currentAssignment": {
    "sourceType": "TRIP",
    "tripId": "...",
    "shuttleTripId": null,
    "driverUserId": "...",
    "plannedStartAt": "2026-08-12T08:00:00+07:00",
    "plannedEndAt": "2026-08-12T10:00:00+07:00",
    "status": "ACTIVE",
    "startStationId": "...",
    "endStationId": "..."
  },
  "nextAssignment": {
    "sourceType": "SHUTTLE_TRIP",
    "tripId": null,
    "shuttleTripId": "...",
    "driverUserId": "...",
    "plannedStartAt": "2026-08-12T13:00:00+07:00",
    "plannedEndAt": "2026-08-12T14:00:00+07:00",
    "status": "RESERVED",
    "startStationId": "...",
    "endStationId": null
  }
}
```

`currentAssignment` chỉ lấy reservation `ACTIVE`. `nextAssignment` lấy reservation `RESERVED` gần nhất có `plannedEndAt > now`. Cả hai nullable. `sourceType` chỉ `TRIP|SHUTTLE_TRIP`; `tripId` và `shuttleTripId` loại trừ nhau. `driverUserId` là driver của đúng assignment, không phải driver cố định của xe.

List errors: `400 INVALID_SORT_FIELD`, `422 VALIDATION_ERROR`, auth/role errors. Detail errors: `404 VEHICLE_NOT_FOUND`, auth/role errors.

```bash
curl --get "$BASE_URL/v1/operator/vehicles" -H "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode "page=1" --data-urlencode "pageSize=20" \
  --data-urlencode "sortBy=createdAt" --data-urlencode "sortDir=desc"

curl "$BASE_URL/v1/operator/vehicles/$VEHICLE_ID" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const vehicles = await apiFetch('/v1/operator/vehicles?page=1&pageSize=20&sortBy=createdAt&sortDir=desc', { token });
const vehicle = await apiFetch(`/v1/operator/vehicles/${vehicleId}`, { token });
```

## 10. Driver Mobile - Main Trip và Shuttle lifecycle

### 10.1 Main Trip schedule của driver/assistant

**GET `/v1/driver/me/schedule`** — role `DRIVER|ASSISTANT`.

Query:

| Field | Type | Required | Rule/default |
|---|---|---:|---|
| `from` | date | Không | Nếu truyền thì `to` cũng phải truyền; nếu bỏ, default ngày hiện tại VN |
| `to` | date | Không | Nếu truyền thì `from` cũng phải truyền, `to>=from`; nếu bỏ, default today + 14 ngày |

Success `200`:

```json
{
  "from": "2026-08-11",
  "to": "2026-08-25",
  "trips": [
    {
      "tripId": "...",
      "operatorId": "...",
      "routeId": "...",
      "vehicleId": "...",
      "departureDateTime": "2026-08-12T08:00:00+07:00",
      "estimatedArrivalTime": "2026-08-12T10:00:00+07:00",
      "status": "SCHEDULED",
      "assignmentRole": "DRIVER"
    }
  ]
}
```

`assignmentRole` là `DRIVER` nếu user trùng `driverUserId`, ngược lại là `ASSISTANT`. Status Trip có thể là `SCHEDULED|BOARDING|IN_PROGRESS|COMPLETED|CANCELLED|DISRUPTED` vì query không filter status.

Errors: `422 VALIDATION_ERROR` cho pair/range; auth/role errors.

```bash
curl --get "$BASE_URL/v1/driver/me/schedule" -H "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode "from=2026-08-11" --data-urlencode "to=2026-08-25"
```

```js
const mainSchedule = await apiFetch('/v1/driver/me/schedule?from=2026-08-11&to=2026-08-25', { token });
```

### 10.2 Route của Main Trip được assign

**GET `/v1/driver/trips/{tripId}/route`** — role `DRIVER|ASSISTANT`.

Path `tripId`: UUID non-empty. Caller phải là driver hoặc assistant của Trip.

Success `200`:

```json
{
  "tripId": "...",
  "routeId": "...",
  "pathPolyline": null,
  "originStation": {
    "stationId": "...",
    "name": "Hồ Chí Minh",
    "latitude": 10.75,
    "longitude": 106.67
  },
  "destinationStation": {
    "stationId": "...",
    "name": "Cần Thơ",
    "latitude": 10.03,
    "longitude": 105.78
  },
  "stops": [
    {
      "stopId": "...",
      "name": "Điểm dừng 1",
      "latitude": 10.5,
      "longitude": 106.2,
      "orderIndex": 1,
      "estimatedArrivalTime": "2026-08-12T09:00:00+07:00",
      "allowPickup": true,
      "allowDropoff": true
    }
  ]
}
```

Errors: `404 TRIP_NOT_FOUND`, `403 FORBIDDEN`, `422 VALIDATION_ERROR`, auth errors.

```bash
curl "$BASE_URL/v1/driver/trips/$TRIP_ID/route" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const route = await apiFetch(`/v1/driver/trips/${tripId}/route`, { token });
```

### 10.3 Shuttle assignments và manifest

#### Assignments

**GET `/v1/driver/shuttle-trips`** — chỉ `DRIVER`.

Query `from`, `to` là date optional độc lập; default `from=today`, `to=today+14`. `to>=from`; inclusive range tối đa 32 ngày (`to.DayNumber-from.DayNumber <=31`).

Success `200`:

```json
{
  "from": "2026-08-11",
  "to": "2026-08-25",
  "items": [
    {
      "shuttleTripId": "...",
      "mainTripId": "...",
      "direction": "INBOUND_TO_STATION",
      "status": "SCHEDULED",
      "vehicleId": "...",
      "licensePlate": "51B-123.45",
      "scheduledDepartureTime": "2026-08-12T13:30:00+07:00",
      "scheduledEndTime": "2026-08-12T14:20:00+07:00",
      "passengerCount": 2,
      "stopCount": 1
    }
  ]
}
```

Errors: `422 VALIDATION_ERROR`, auth/role errors.

```bash
curl "$BASE_URL/v1/driver/shuttle-trips?from=2026-08-11&to=2026-08-25" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const shuttleAssignments = await apiFetch('/v1/driver/shuttle-trips?from=2026-08-11&to=2026-08-25', { token });
```

#### Manifest

**GET `/v1/driver/shuttle-trips/{shuttleTripId}/manifest`** — chỉ assigned `DRIVER`.

Success `200`:

```json
{
  "shuttleTripId": "...",
  "mainTripId": "...",
  "direction": "INBOUND_TO_STATION",
  "status": "SCHEDULED",
  "stationId": "...",
  "stationName": "Bến xe Miền Tây",
  "stationLatitude": 10.75,
  "stationLongitude": 106.67,
  "scheduledDepartureTime": "2026-08-12T13:30:00+07:00",
  "scheduledEndTime": "2026-08-12T14:20:00+07:00",
  "stops": [
    {
      "pickupOrder": 1,
      "bookingId": "...",
      "ticketIds": ["..."],
      "passengerCount": 2,
      "pickupAddress": "123 Nguyễn Văn A",
      "pickupLatitude": 10.7,
      "pickupLongitude": 106.6,
      "status": "PENDING",
      "pickedUpAt": null,
      "deliveredAt": null,
      "passengerDisplayName": "Passenger",
      "passengerPhone": "0900000000"
    }
  ]
}
```

Errors: `404 SHUTTLE_TRIP_NOT_FOUND`, `404 SHUTTLE_STATION_NOT_FOUND`, `403 FORBIDDEN`, `409 SHUTTLE_MANIFEST_INCONSISTENT_STATUS`; Identity profile upstream có thể fail.

```bash
curl "$BASE_URL/v1/driver/shuttle-trips/$SHUTTLE_TRIP_ID/manifest" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const manifest = await apiFetch(`/v1/driver/shuttle-trips/${shuttleTripId}/manifest`, { token });
```

### 10.4 Start/complete Main Trip

#### Start Main Trip

**POST `/v1/driver/trips/{tripId}/start`** — chỉ assigned `DRIVER`, key bắt buộc, **body rỗng**.

Start activate reservation. Nếu resource còn thuộc assignment `ACTIVE` khác, Trip không đổi status, backend lưu alert dedupe và outbox event `trip.assignment.start_blocked`.

Success `200`:

```json
{
  "tripId": "...",
  "status": "IN_PROGRESS",
  "actualDepartureTime": "2026-08-12T08:00:10+07:00"
}
```

Errors: `404 TRIP_NOT_FOUND`, `403 FORBIDDEN`, `409 TRIP_INVALID_TRANSITION`, `409 TRIP_DRIVER_CONFLICT`, `409 TRIP_VEHICLE_CONFLICT`, có `error.fields.conflictReason=RESOURCE_ACTIVE` khi resource đang active; `503 RESOURCE_TRAVEL_TIME_UNAVAILABLE` có thể xảy ra nếu reservation bị thiếu và start phải tạo lại reservation.

```bash
curl -X POST "$BASE_URL/v1/driver/trips/$TRIP_ID/start" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY"
```

```js
await apiFetch(`/v1/driver/trips/${tripId}/start`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'POST'
});
```

#### Complete Main Trip

**POST `/v1/driver/trips/{tripId}/complete`** — assigned `DRIVER` hoặc assigned `ASSISTANT`, key bắt buộc, body rỗng.

Success release reservation:

```json
{
  "tripId": "...",
  "status": "COMPLETED",
  "completedAt": "2026-08-12T10:05:00+07:00",
  "completedByUserId": "..."
}
```

Errors: `404 TRIP_NOT_FOUND`, `403 FORBIDDEN`, `409 TRIP_INVALID_TRANSITION`.

```bash
curl -X POST "$BASE_URL/v1/driver/trips/$TRIP_ID/complete" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY"
```

```js
await apiFetch(`/v1/driver/trips/${tripId}/complete`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'POST'
});
```

### 10.5 Shuttle lifecycle

Tất cả endpoint phần này chỉ cho assigned `DRIVER` và yêu cầu operator/shuttle subscription vẫn cho write.

#### Start ShuttleTrip

**POST `/v1/driver/shuttle-trips/{shuttleTripId}/start`**, key bắt buộc, body rỗng.

```json
{
  "shuttleTripId": "...",
  "status": "IN_PROGRESS",
  "changedPassengerCount": 0,
  "transitionedAt": "2026-08-12T13:30:00+07:00"
}
```

Errors: `404 SHUTTLE_TRIP_NOT_FOUND`, `403 FORBIDDEN`, `409 SHUTTLE_TRIP_INVALID_STATE`, `409 SHUTTLE_DRIVER_CONFLICT`, `409 SHUTTLE_VEHICLE_CONFLICT`, `503 RESOURCE_TRAVEL_TIME_UNAVAILABLE` khi phải rebuild reservation, và eligibility/subscription errors.

```bash
curl -X POST "$BASE_URL/v1/driver/shuttle-trips/$SHUTTLE_TRIP_ID/start" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY"
```

```js
await apiFetch(`/v1/driver/shuttle-trips/${shuttleTripId}/start`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'POST'
});
```

#### Pickup group

**POST `/v1/driver/shuttle-trips/{shuttleTripId}/stops/{pickupOrder}/pickup`**, key bắt buộc, body rỗng. `pickupOrder` phải integer dương. Một call cập nhật toàn bộ passenger cùng order.

Success `200`:

```json
{
  "shuttleTripId": "...",
  "pickupOrder": 1,
  "pickedUpPassengerCount": 2,
  "pickedUpAt": "2026-08-12T13:45:00+07:00"
}
```

Errors: `404 SHUTTLE_TRIP_NOT_FOUND`, `404 SHUTTLE_PICKUP_NOT_FOUND`, `403 FORBIDDEN`, `409 SHUTTLE_TRIP_TERMINAL`, `409 SHUTTLE_TRIP_INVALID_STATE`, `409 SHUTTLE_PICKUP_NOT_PENDING`, `422 VALIDATION_ERROR`.

```bash
curl -X POST "$BASE_URL/v1/driver/shuttle-trips/$SHUTTLE_TRIP_ID/stops/1/pickup" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY"
```

```js
await apiFetch(`/v1/driver/shuttle-trips/${shuttleTripId}/stops/${pickupOrder}/pickup`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'POST'
});
```

#### Delivered group

**POST `/v1/driver/shuttle-trips/{shuttleTripId}/stops/{pickupOrder}/delivered`**, key bắt buộc, body rỗng.

Success `200`:

```json
{
  "shuttleTripId": "...",
  "status": "DELIVERED",
  "changedPassengerCount": 2,
  "transitionedAt": "2026-08-12T14:10:00+07:00"
}
```

Errors: `404 SHUTTLE_TRIP_NOT_FOUND`, `404 SHUTTLE_PASSENGER_NOT_FOUND`, `403 FORBIDDEN`, `409 SHUTTLE_TRIP_TERMINAL`, `409 SHUTTLE_TRIP_INVALID_STATE`, `409 SHUTTLE_PASSENGER_INVALID_STATE`, `422 VALIDATION_ERROR`.

```bash
curl -X POST "$BASE_URL/v1/driver/shuttle-trips/$SHUTTLE_TRIP_ID/stops/1/delivered" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY"
```

```js
await apiFetch(`/v1/driver/shuttle-trips/${shuttleTripId}/stops/${pickupOrder}/delivered`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'POST'
});
```

#### No-show group

**POST `/v1/driver/shuttle-trips/{shuttleTripId}/stops/{pickupOrder}/no-show`**, key bắt buộc.

Body `reason` non-blank; code không đặt max length:

```json
{ "reason": "Không liên lạc được hành khách" }
```

Success `200` là `ShuttleLifecycleResult` với `status="NO_SHOW"`. Errors giống delivered, thêm `422 VALIDATION_ERROR` nếu reason blank.

```bash
curl -X POST "$BASE_URL/v1/driver/shuttle-trips/$SHUTTLE_TRIP_ID/stops/1/no-show" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" --data '{"reason":"Không liên lạc được hành khách"}'
```

```js
await apiFetch(`/v1/driver/shuttle-trips/${shuttleTripId}/stops/${pickupOrder}/no-show`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'POST',
  body: { reason: 'Không liên lạc được hành khách' }
});
```

#### Complete ShuttleTrip

**POST `/v1/driver/shuttle-trips/{shuttleTripId}/complete`**, key bắt buộc, body rỗng.

Tất cả passenger phải ở trạng thái delivered, no-show hoặc cancelled. Success chuyển Trip sang `COMPLETED` và release driver/vehicle reservation.

```json
{
  "shuttleTripId": "...",
  "status": "COMPLETED",
  "changedPassengerCount": 0,
  "transitionedAt": "2026-08-12T14:20:00+07:00"
}
```

Errors: `404 SHUTTLE_TRIP_NOT_FOUND`, `403 FORBIDDEN`, `409 SHUTTLE_PASSENGERS_INCOMPLETE`, `409 SHUTTLE_TRIP_INVALID_STATE`, eligibility/subscription errors.

```bash
curl -X POST "$BASE_URL/v1/driver/shuttle-trips/$SHUTTLE_TRIP_ID/complete" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: $IDEMPOTENCY_KEY"
```

```js
await apiFetch(`/v1/driver/shuttle-trips/${shuttleTripId}/complete`, {
  token, idempotencyKey: crypto.randomUUID(), method: 'POST'
});
```

## 11. Flow tích hợp bắt buộc

### 11.1 Admin tạo DriverSchedule

1. Load route bằng `GET /v1/operator/routes`, xe bằng `GET /v1/operator/vehicles`, driver bằng `GET /v1/operator/users?role=DRIVER&status=ACTIVE`, assistant bằng query `role=ASSISTANT&status=ACTIVE`.
2. Gọi `POST /v1/operator/driver-schedules/availability-check` với đúng draft sẽ submit.
3. Nếu `available=false`, render toàn bộ conflict; dùng `resourceRole/resourceId` để highlight field, dùng `reason`, `blockingUntil`, `requiredTravelMinutes`, `earliestFeasibleStartAt` để giải thích.
4. Chỉ enable nút create khi preview `available=true`.
5. Gọi `POST /v1/operator/driver-schedules`. Create vẫn có thể trả `409` vì request khác thắng race sau preview; coi response mutation là authoritative.
6. Sau create active, poll/refetch list schedule và Trip list vì generation chạy qua background job.

### 11.2 Admin dispatch ShuttleTrip

1. `GET /v1/operator/shuttle-requests`.
2. Chọn một `mainTripId + direction`; không trộn booking của group khác.
3. Dùng `suggestedBookingOrder` làm thứ tự ban đầu hoặc gửi thứ tự operator đã chốt.
4. Chọn driver và vehicle, nhập `scheduledDepartureTime/scheduledEndTime` thỏa buffer main Trip.
5. Preview bằng `POST /v1/operator/shuttle-trips/availability-check` với đúng `orderedBookingIds` theo đúng thứ tự.
6. Nếu available, gọi `POST /v1/operator/shuttle-trips` bằng một UUID v4 key mới.
7. Nếu `SHUTTLE_REQUEST_SET_CHANGED`, refetch requests; không submit lại payload cũ.
8. Nếu resource conflict ở create, hiển thị conflict và bắt operator chọn resource/time khác; không có override.

### 11.3 Driver app hợp nhất lịch

Main Trip và ShuttleTrip là hai endpoint khác nhau. Driver app cần gọi cả:

- `/v1/driver/me/schedule`
- `/v1/driver/shuttle-trips`

Sau đó map về một view model client và sort theo `departureDateTime`/`scheduledDepartureTime`. Không dùng Main Trip list để suy ra ShuttleTrip.

### 11.4 Main Trip lifecycle

```text
SCHEDULED/BOARDING -> POST start -> IN_PROGRESS -> POST complete -> COMPLETED
```

- Chỉ driver start.
- Driver hoặc assistant được assign có thể complete.
- Không optimistic-update status trước khi server trả success.
- Với `RESOURCE_ACTIVE`, giữ nguyên UI status, hiển thị “resource đang chạy chuyến khác” và yêu cầu operator xử lý.

### 11.5 Shuttle lifecycle

```text
SCHEDULED -> start -> IN_PROGRESS
                     -> pickup từng group
                     -> delivered hoặc no-show từng group
                     -> complete -> COMPLETED
```

Complete trước khi toàn bộ passenger terminal trả `SHUTTLE_PASSENGERS_INCOMPLETE`; driver app phải refetch manifest, xử lý từng group rồi complete lại với idempotency key mới.

### 11.6 Quy tắc UI cho conflict

```js
function mapConflict(error) {
  const fields = Object.fromEntries((error.fields ?? []).map(x => [x.field, x.message]));
  return {
    code: error.code,
    reason: fields.conflictReason,
    resourceRole: fields.resourceRole,
    resourceId: fields.resourceId,
    conflictingSourceType: fields.conflictingSourceType,
    conflictingSourceId: fields.conflictingSourceId,
    blockingUntil: fields.blockingUntil
  };
}
```

Recommended copy theo code thực tế:

| Code/reason | FE action |
|---|---|
| `TIME_OVERLAP` | “Resource đang có chuyến trùng thời gian”; mở link tới source ID nếu màn hình hỗ trợ |
| `TURNAROUND_REQUIRED` | “Cần tối thiểu 30 phút nghỉ/chuyển giao tại cùng điểm” |
| `REPOSITION_REQUIRED` | Hiển thị thêm `requiredTravelMinutes` ở preview; chọn giờ/resource khác |
| `RESOURCE_ACTIVE` | Không retry start tự động; liên hệ operator để complete/disrupt/cancel assignment đang active |
| `RESOURCE_TRAVEL_TIME_UNAVAILABLE` | Disable submit, giữ draft, cho retry có kiểm soát; không biến thành warning |

## 12. Mapping trách nhiệm cho 3 FE dev/agent

### 12.1 Dev/agent Admin Web Operator

Owner chính của feature:

- Tích hợp toàn bộ endpoint mục 7, 8 và 9.
- Tạo component conflict dùng chung cho DriverSchedule và Shuttle; không chỉ check `409`, phải parse cả `available=false` trong preview `200`.
- Không cho STAFF thấy button create/update/activate schedule hoặc create shuttle; controller chỉ cho ADMIN dù Gateway prefix có union role.
- Luôn refetch sau mutation; không giữ `available=true` như cache/lock.
- Hiển thị `currentAssignment/nextAssignment` trong vehicle list/detail; link source theo `sourceType` và đúng ID nullable.
- Không thêm “force assign/admin override” vì backend không hỗ trợ.
- Khi Trip edit, không gửi time/crew field. Đổi crew concrete Trip chỉ có qua DriverSchedule `ALL_PENDING` hoặc `replacementCrew` của substitution theo API hiện có.

### 12.2 Dev/agent Driver Mobile

- Gọi và merge Main Trip schedule + Shuttle assignments như mục 11.3.
- Dùng manifest order do server trả; không tự sort theo khoảng cách rồi gửi lifecycle order khác.
- Với bodyless mutation, tuyệt đối không gửi `{}`.
- Mỗi tap action sinh UUID v4; nếu request timeout thì retry cùng key, không tạo key mới cho cùng action chưa biết kết quả.
- Start/complete chỉ update UI sau success.
- Handle đầy đủ `FORBIDDEN`, `*_INVALID_STATE`, `RESOURCE_ACTIVE`, `SHUTTLE_PASSENGERS_INCOMPLETE` và token refresh.
- Assistant chỉ thấy Main Trip schedule/route và có thể complete Main Trip; assistant không được gọi Shuttle endpoints hoặc Main Trip start.

### 12.3 Dev/agent Passenger Mobile

Trong feature availability này **không có endpoint mới dành cho PASSENGER**. Passenger app không được gọi `/v1/operator/*` hoặc `/v1/driver/*`.

Phần cần handle ở app passenger:

- Không assume driver/vehicle là cố định ở cấp Vehicle; hiển thị assignment từ booking/shuttle payload hiện có của passenger.
- Khi Trip bị cancel, đổi route, substitute hoặc ShuttleTrip bị cancel, refetch booking/trip context sau notification/event mà app đang consume.
- Shuttle tracking passenger nằm ở Tracking service và ngoài phạm vi endpoint availability của tài liệu này; không tự dựng URL từ operator/driver API.

⚠️ TODO: cần xác nhận thêm với owner Passenger Mobile endpoint/notification contract cụ thể đang dùng để lấy `shuttleTripId` sau assignment. Trip resource source chỉ publish outbox event; nó không định nghĩa màn hình/passenger API nhận event đó.

## 13. Happy case và exception case đã có test

### 13.1 Kết quả chạy lại trên checkout hiện tại

| Command/scope | Kết quả |
|---|---|
| `dotnet test ...VietRide.Trip.UnitTests.csproj -c Release --no-restore` | **PASS 726/726**, skip 0 |
| Integration filter `ResourceAvailabilityServiceIntegrationTests` | **PASS 13/13**, tổng 49,9 giây |
| Integration filter `ShuttlePersistenceIntegrationTests` | **PASS 8/8**, tổng 28 giây |
| Full Trip solution/integration aggregate | Lần chạy aggregate vượt timeout của tool; không ghi PASS. Các suite feature-targeted ở trên đã chạy sạch sau khi dừng testhost do lần timeout để lại. |

### 13.2 Case availability đã test và kết quả

| Loại | Case | Kết quả kỳ vọng đã assert |
|---|---|---|
| Happy | Main Trip 08:00-10:00, cùng Station, chuyến sau đúng 10:30 | Available; boundary đúng 30 phút được nhận |
| Exception | Chuyến sau 10:01 hoặc 10:29 cùng Station | `TURNAROUND_REQUIRED` |
| Exception | Interval giao nhau | `TIME_OVERLAP` được ưu tiên |
| Exception | Cần Thơ sang địa điểm khác, Google duration 60 phút | Earliest = previous end + 30 + 60; `REPOSITION_REQUIRED` |
| Exception | Earliest mới không còn fit trước assignment kế tiếp | `earliestFeasibleStartAt=null` |
| Happy/Exception | Cùng driver khác xe; khác driver cùng xe; assistant đổi role với driver | Driver, assistant và vehicle đều được bảo vệ cross-role |
| Exception | Google disabled | Unavailable, không gọi provider |
| Happy | Google duration có lẻ giây | Làm tròn lên whole minute |
| Exception | Google timeout/nonusable response | Fail closed `RESOURCE_TRAVEL_TIME_UNAVAILABLE` |
| Exception | Thiếu tọa độ Station/endpoint | Fail trước mutation, không có partial schedule/reservation |
| Exception | Main tạo trước Shuttle và Shuttle tạo trước Main | Cả hai order đều phát hiện conflict |
| Happy/Exception | Inbound manifest first point và outbound last point | Endpoint snapshot theo đúng direction/order |
| Exception | Shuttle-Shuttle cùng driver hoặc cùng xe | Hard-block; không chỉ kiểm tra main-vs-shuttle |
| Happy | Shuttle cancel/complete | Resource được release/cancel để assignment sau dùng được |
| Exception | Weekly schedule qua nửa đêm | Phát hiện overlap/turnaround đúng ngày kế tiếp |
| Exception | Driver schedule cross-role và nhiều driver | Assistant/driver shared identity vẫn conflict; resource khác hợp lệ |
| Happy | Schedule generation rolling 30 ngày | Sinh Trip + reservation |
| Exception | Generation gặp near-time conflict | Skip occurrence conflict, không ghi reservation overlap |
| Exception | Previous assignment còn `ACTIVE` khi start chuyến sau | Start rollback, Trip không đổi; alert/outbox dedupe |
| Happy | Previous Trip complete rồi start chuyến sau | Release resource và start sau thành công nếu rule cho phép |
| Happy | Cancel Trip trước start | Reservation chuyển cancelled và resource được giải phóng |
| Exception | Crew/vehicle/time mutation gây conflict | Trip và reservation rollback cùng nhau |
| Happy | Vehicle substitution | Reservation cũ truncate/release rồi replacement reserve trong một transaction |
| Exception | Hai request concurrent reserve cùng resource | Đúng một request thắng; DB không có overlap |
| Happy | Vehicle projection | Trả đúng current ACTIVE, nearest RESERVED và driver của assignment |

### 13.3 Case DriverSchedule/API/lifecycle đã có unit test

- Create validator: invalid weekday/date range, empty day list, negative `baseFare` bị reject.
- Activate: inactive -> active + enqueue; already active là no-op; conflict không enqueue; route thiếu duration bị validation; assistant sai role bị reject.
- Source hiện có test xác nhận assistant status không ACTIVE vẫn activate vì handler chỉ kiểm tra role/operator. Đây là hành vi hiện tại, không phải yêu cầu FE nên dựa vào.
- Update request phân biệt omitted và explicit `null`, reject unknown field; invalid `applyTo`, empty patch, null cho non-nullable, negative/`ALL_PENDING baseFare` bị reject.
- `FUTURE_ONLY` không mutate Trip cũ; `ALL_PENDING` cascade, lock/stale protection, rollback outbox, day removal cancel đúng Trip.
- Confirmed booking: đúng boundary 2 giờ cho phép; nhỏ hơn boundary reject `DRIVER_SCHEDULE_EDIT_TOO_LATE`.
- Start Main Trip: assigned driver success; mismatched driver forbidden; invalid state conflict; resource active giữ Trip unchanged và chỉ tạo một alert dedupe.
- Complete Main Trip: driver/assistant được assign success; mismatch forbidden; invalid state không có side effect.
- Shuttle domain/lifecycle: invalid schedule, start/complete state, deliver phải sau pickup, no-show phải có reason, cancel passenger idempotent.
- Shuttle persistence: fan-out/replay idempotency, dispatch-cutoff race atomic, pickup progression, assignment/manifest authorization/grouping, mixed status conflict.

## 14. Điểm FE phải lưu ý và TODO cần xác nhận

### 14.1 Behavior có thật nhưng dễ nối sai

- Preview là advisory, không reserve và không lock; mutation `409` luôn thắng preview `200`.
- Preview DriverSchedule không validate vehicle/user existence, role, status hoặc tenant. Preview Shuttle không validate driver/vehicle existence/status. Create/mutation mới validate các reference tương ứng.
- DriverSchedule create/activate hiện validate driver/assistant `role + operatorId`, **không validate status ACTIVE**. FE nên filter active user theo nguồn Identity của mình, nhưng không được hiểu preview là kiểm tra status.
- Không có preview riêng cho arbitrary concrete Main Trip edit/substitution/change-route. Những mutation đó trực tiếp recheck và trả hard error.
- `currentAssignment` không dựa vào đồng hồ; nó chỉ trả reservation đã transition sang `ACTIVE`. Một reservation đã tới giờ nhưng vẫn `RESERVED` có thể nằm ở `nextAssignment`.
- `validUntil=null` là lịch không có ngày kết thúc; backend kiểm tra recurrence bằng chu kỳ hữu hạn và concrete Trip rolling window, không materialize vô hạn.
- Error code conflict của assistant là `TRIP_DRIVER_CONFLICT`; dùng `error.fields.resourceRole` để phân biệt `DRIVER` với `ASSISTANT`.

### 14.2 TODO/release blocker

- ⚠️ TODO: deploy branch và xác nhận production OpenAPI có hai `/availability-check` endpoint trước khi FE bật feature flag.
- ⚠️ TODO: xác nhận public staging base URL.
- ⚠️ TODO: xác nhận runtime rate limiting cho raw proxied `/v1` routes. Config default là 120 request/phút nhưng source mount raw proxy trước Nest router nên tài liệu không cam kết các endpoint này thực sự nhận throttler guard.
- ⚠️ TODO: xác nhận bằng HTTP integration test hành vi khi JSON bỏ hẳn các primitive non-nullable nhưng không có explicit `.NotEmpty()` như `departureTime`, `validFrom`, `isActive` của create schedule và `scheduledDepartureTime` của preview Shuttle. FE phải luôn gửi các field trong sample, nhưng tài liệu không suy đoán error chính xác khi bỏ chúng.
- ⚠️ TODO: xác nhận contract Passenger Mobile nhận `shuttleTripId`/notification sau `trip.shuttle.assigned`; source Trip chỉ định nghĩa outbox event, không định nghĩa consumer-facing passenger endpoint trong feature này.

### 14.3 Checklist trước khi FE merge

- [ ] Base URL chỉ trỏ Gateway, không trỏ port 5002.
- [ ] Access token refresh single-flight.
- [ ] UUID v4 idempotency đúng và retry cùng key.
- [ ] Bodyless POST/PATCH không gửi `{}`.
- [ ] Parse wrapper `data`, không đọc payload trực tiếp từ root.
- [ ] Parse `error.fields` dạng array.
- [ ] Preview `available=false` được xử lý dù HTTP 200.
- [ ] Mutation `409` được coi authoritative sau preview.
- [ ] Hiển thị đúng timezone/offset; không tự append `Z` vào giờ VN.
- [ ] Admin STAFF/ADMIN UI permission khớp controller downstream.
- [ ] Driver app merge Main và Shuttle schedules.
- [ ] Production Swagger đã có endpoint mới trước khi bật UI.
