# VietRide Trip Service — API Documentation

> **Nguồn kiểm chứng:** source code hiện tại trong `apps/trip`, route/auth proxy trong `apps/gateway`, shared web filters trong `libs/dotnet`, và OpenAPI production tại `https://api.vietride.online/api-specs/trip` (đối chiếu ngày 2026-07-10). Tài liệu mô tả hành vi code, không bổ sung endpoint/field từ API contract.

## Mục lục

- [1. Môi trường và base URL](#1-môi-trường-và-base-url)
- [2. Xác thực, phân quyền, rate limit](#2-xác-thực-phân-quyền-rate-limit)
- [3. Quy ước request/response](#3-quy-ước-requestresponse)
- [4. Tổng quan 59 endpoint](#4-tổng-quan-59-endpoint)
- [5. Public, passenger, driver và admin API](#5-public-passenger-driver-và-admin-api)
- [6. Operator API](#6-operator-api)
- [7. Internal service-to-service API](#7-internal-service-to-service-api)
- [8. Data schemas](#8-data-schemas)
- [9. Error catalog và flow](#9-error-catalog-và-flow)

## 1. Môi trường và base URL

| Môi trường | Base URL | Nguồn |
|---|---|---|
| Production qua Gateway | `https://api.vietride.online` | URL Swagger được cung cấp; spec được proxy tại `/api-specs/trip` |
| Local qua Gateway | `http://localhost:3000` | `GATEWAY_PORT=3000` mặc định |
| Local gọi thẳng Trip | `http://localhost:5002` | `TRIP_BASE_URL` mặc định và service port |
| Docker nội bộ | `http://trip:5002` | Docker/Gateway runtime; không dành cho FE/Mobile |

Không tìm thấy base URL staging được cố định trong config. **⚠️ TODO: cần xác nhận thêm** nếu đội dự án có staging URL được inject ngoài repo.

Swagger UI production: <https://api.vietride.online/docs>. OpenAPI JSON Trip: <https://api.vietride.online/api-specs/trip>.

Trong ví dụ:

```bash
BASE_URL=https://api.vietride.online
ACCESS_TOKEN='<RS256 user access token>'
```

## 2. Xác thực, phân quyền, rate limit

### User API (Frontend/Mobile)

- Gửi `Authorization: Bearer <ACCESS_TOKEN>`.
- Token là JWT **RS256**, issuer `vietride-identity`, audience `vietride-api`; Gateway chỉ chấp nhận thuật toán RS256 và cho lệch đồng hồ 5 giây.
- Gateway lấy JWKS từ `JWT_PUBLIC_KEY_URL` (mặc định local: `http://identity:5001/v1/.well-known/jwks.json`).
- Gateway xác thực token, kiểm tra role/phone gate, tạo internal JWT HS256 TTL mặc định 120 giây rồi gửi xuống Trip bằng `X-Internal-Auth`. Header user `Authorization` bị loại trước khi proxy.
- Token thiếu/hết hạn/sai trả `401 AUTH_TOKEN_INVALID`. Client phải dùng API refresh của Identity; Trip không có endpoint refresh token.
- Passenger có claim `hasPhone` khác `true` bị Gateway chặn `403 AUTH_PHONE_REQUIRED` trên các API không thuộc whitelist.

### Internal API

- Chỉ service backend gửi `X-Internal-Auth: Bearer <HS256 JWT>`.
- Token phải có issuer `vietride-gateway`, audience `vietride-internal`, thuật toán HS256; clock skew 5 giây.
- FE/Mobile không gọi các path `/internal/v1/**` qua public Gateway vì route table Gateway không đăng ký các path này.

### Role

| Nhóm | Role được code cho phép |
|---|---|
| Public | Không token: locations, station search, trip search, ping |
| Trip detail/seat map | Mọi user đã xác thực |
| Driver schedule | `DRIVER`, `ASSISTANT` |
| Operator read | `OPERATOR_ADMIN`, `OPERATOR_STAFF` |
| Operator write routes/stops/vehicles/trip operation | `OPERATOR_ADMIN` |
| Operator station create/link | `OPERATOR_ADMIN`, `OPERATOR_STAFF` |
| Admin locations | `SYSTEM_ADMIN` |

Mọi operator API còn yêu cầu claim `operatorId` là UUID hợp lệ; thiếu claim trả `403 FORBIDDEN`.

### Rate limit và idempotency

- Gateway cấu hình Redis-backed throttle mặc định `120 request / 60 giây`; giá trị thực tế có thể đổi bằng `RATE_LIMIT_DEFAULT_PER_MIN`. **⚠️ TODO: cần xác nhận thêm** response 429 thực tế của raw proxy, vì source không có test response envelope cho trường hợp này.
- Các mutation có đánh dấu `Idempotency-Key` yêu cầu header không rỗng; thiếu trả `422 VALIDATION_ERROR`. Trip middleware cache response không phải 5xx trong 24 giờ theo key + SHA-256 body; cùng key/cùng body replay response, cùng key/khác body trả `422 IDEMPOTENCY_KEY_MISMATCH`.
- Riêng `lock-seats` còn dùng key trong seat-lock store và có thể trả `409 IDEMPOTENCY_REQUEST_PENDING` hoặc `409 IDEMPOTENCY_KEY_MISMATCH`.

## 3. Quy ước request/response

- JSON dùng camelCase (`PropertyNamingPolicy` mặc định của ASP.NET Web JSON).
- UUID là chuỗi canonical, ví dụ `11111111-1111-1111-1111-111111111111`.
- `DateOnly`: `YYYY-MM-DD`; `TimeOnly`: `HH:mm:ss`; `DateTimeOffset`: ISO-8601 có timezone, response timestamp UTC dạng round-trip.
- Tiền VND là JSON integer/int64 (`baseFare`, `fareFromThisStop`), không phải decimal.
- `decimal` trong C# xuất hiện trong OpenAPI production là `number/double`.
- Route constraint `{id:guid}` sai định dạng không match controller và thường thành 404 tại ASP.NET/Gateway; code không định nghĩa error code riêng cho trường hợp này.
- Body JSON malformed/type mismatch/model binding failure: HTTP 400 `VALIDATION_ERROR`. FluentValidation/business validation: HTTP 422.
- `error.fields[].field` **không được normalize về camelCase**: FluentValidation/`nameof(...)` có thể trả `Name`, `OriginStationId`, `EstimatedWeightKg`; manual handler errors có thể là `name`, `originStationId`, `estimatedWeightKg` hoặc `Idempotency-Key`. Consumer phải hiển thị/map key đúng như response, không tự giả định casing.
- Query param không ghi mặc định trong action nhưng handler phân trang dùng `page=1`, `pageSize=20`, tối đa 100, trừ nơi ghi khác.

### Success envelope

Mọi `ObjectResult` thành công được global result filter bọc; endpoint tự bọc không bị bọc lần hai. `204` không có body. Hai internal lookup/snapshot trả raw DTO theo controller.

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "meta": {
    "traceId": "8f2d7b2e-9a12-4db9-a68a-f2ea0896c910",
    "timestamp": "2026-07-10T08:30:00.0000000Z"
  }
}
```

`message` bị bỏ nếu null. Response tạo mới dùng `statusCode: 201`.

### Error envelope

```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more validation errors occurred.",
    "fields": [{ "field": "name", "message": "'Name' must not be empty." }]
  },
  "meta": {
    "traceId": "8f2d7b2e-9a12-4db9-a68a-f2ea0896c910",
    "timestamp": "2026-07-10T08:30:00.0000000Z"
  }
}
```

`fields` bị bỏ nếu exception không có field errors. Mapping chung: 400 `BadRequestException`; 401 auth; 403 forbidden; 404 not found; 409 conflict; 422 validation; 429 too-many-requests; exception khác 500 `INTERNAL_ERROR` với message `An unexpected error occurred`. Gateway upstream lỗi trả 502 `UPSTREAM_UNAVAILABLE`.

## 4. Tổng quan 59 endpoint

| # | Method | Path | Auth/role | Mô tả |
|---:|---|---|---|---|
| H1 | GET | `/v1/trip/health` → Trip `/health` | Public | Liveness qua Gateway |
| H2 | GET | Trip direct `/ready` | Direct Trip only | Readiness dependency checks |
| 1 | GET | `/v1/ping` | Direct Trip only | Ping; Gateway chưa đăng ký route |
| 2 | GET | `/v1/locations` | Public | Danh mục location active |
| 3 | GET | `/v1/stations/search` | Public | Tìm station |
| 4 | GET | `/v1/trips/search` | Public | Tìm chuyến |
| 5 | GET | `/v1/trips/{tripId}` | User | Chi tiết chuyến |
| 6 | GET | `/v1/trips/{tripId}/seat-map` | User | Sơ đồ ghế |
| 7 | GET | `/v1/driver/me/schedule` | Driver/Assistant | Lịch được phân công |
| 8–11 | GET/POST/PATCH/DELETE | `/v1/admin/locations[/{id}]` | System admin | Quản trị location |
| 12 | POST | `/v1/operator/stations` | Operator read roles | Tạo/link station |
| 13–16 | POST/GET/PATCH | `/v1/operator/stops[/{id}]` | Operator | Quản lý stop |
| 17–27 | POST/GET/PATCH/PUT/DELETE | `/v1/operator/routes/**` | Operator | Route, stop, fare, alternative route |
| 28–30 | PATCH/PUT/DELETE | `/v1/operator/alternative-routes/{id}[/**]` | Operator admin | Sửa geometry/deactivate alternative route |
| 31–34 | POST/GET/PATCH | `/v1/operator/vehicles[/{id}]` | Operator | Quản lý xe |
| 35 | GET | `/v1/vehicle-types` | Operator | Danh mục loại xe |
| 36–37 | POST/PATCH | `/v1/operator/driver-schedules[/{id}/activate]` | Operator admin | Lịch tài xế |
| 38–41 | GET/POST | `/v1/operator/trips/{tripId}/**` | Operator | Cargo/arrive/substitute/disrupt |
| 42 | GET | `/internal/v1/stations/{id}` | Internal JWT | Station snapshot |
| 43 | GET | `/internal/v1/stops/{id}` | Internal JWT | Stop snapshot |
| 44–56 | GET/POST | `/internal/v1/trips/**` | Internal JWT | Snapshot, parcel, tracking, seat, cargo |
| 57 | POST | `/internal/v1/trips/round-trip/lock-seats` | Internal JWT | Lock ghế khứ hồi |

## 5. Public, passenger, driver và admin API

Quy ước ví dụ JavaScript cho GET (các endpoint dưới chỉ thay URL):

```js
const response = await fetch(`${BASE_URL}/v1/locations`, {
  headers: ACCESS_TOKEN ? { Authorization: `Bearer ${ACCESS_TOKEN}` } : {}
});
const result = response.status === 204 ? null : await response.json();
if (!response.ok) throw result;
```

### 5.0 Health và readiness — 2 endpoint ngoài Swagger

Hai endpoint được map bằng `MapHealthChecks`, không phải controller nên không xuất hiện trong OpenAPI Trip.

#### Liveness — `GET /v1/trip/health` qua Gateway, rewrite tới Trip `/health`

Public; không header/param/body. Không chạy dependency check. Thành công `200` raw JSON (không `ApiResponse` vì health path được miễn wrapper):

```json
{"status":"ok","service":"Trip"}
```

```bash
curl -sS "$BASE_URL/v1/trip/health"
```

```js
const health=await fetch(`${BASE_URL}/v1/trip/health`).then(r=>r.json());
```

#### Readiness — `GET /ready` direct Trip only

Không header/param/body. Gateway không đăng ký `/ready` hoặc `/v1/trip/ready`. Endpoint chạy các probe có tag `ready`: Postgres nếu có connection string, Redis/RabbitMQ nếu env tương ứng được cấu hình. HTTP mặc định của health middleware: 200 khi Healthy, 503 khi Unhealthy. Body raw:

```json
{"status":"healthy","service":"Trip","totalDurationMs":12.34,"checks":[{"name":"postgres","status":"healthy","durationMs":10.2,"description":null,"error":null}]}
```

Danh sách `checks` phụ thuộc env runtime; source không cố định số lượng. Error không dùng `ApiResponse` envelope.

```bash
curl -sS "http://localhost:5002/ready"
```

```js
const ready=await fetch('http://localhost:5002/ready').then(async r=>({ok:r.ok,body:await r.json()}));
```

### 5.1 Ping — `GET /v1/ping` (direct Trip only)

Public ở Trip process, không header/param/body. Gateway route table **không đăng ký `/v1/ping`**, nên `https://api.vietride.online/v1/ping` trả Gateway `404 ROUTE_NOT_FOUND`; chỉ gọi được qua direct service URL/network nội bộ, ví dụ local `http://localhost:5002/v1/ping`. Thành công `200` và được result filter bọc; data là object service/status/timestamp. Error action chỉ có lỗi hạ tầng 500.

```json
{"success":true,"statusCode":200,"data":{"service":"Trip","status":"ok","timestamp":"2026-07-10T08:30:00Z"},"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS "http://localhost:5002/v1/ping"
```

```js
const ping = await fetch('http://localhost:5002/v1/ping').then(r => r.json());
```

### 5.2 Danh mục location — `GET /v1/locations`

Public; không param/body. Trả `200 ApiResponse<LocationDto[]>`, chỉ location active và chưa soft-delete.

```json
{"success":true,"statusCode":200,"data":[{"id":"11111111-1111-1111-1111-111111111111","code":"HCM","name":"Thành phố Hồ Chí Minh","type":"MUNICIPALITY","isActive":true,"sortOrder":1,"createdAt":"2026-07-01T00:00:00Z","updatedAt":"2026-07-01T00:00:00Z"}],"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS "$BASE_URL/v1/locations"
```

```js
const locations = await fetch(`${BASE_URL}/v1/locations`).then(r => r.json());
```

### 5.3 Tìm station — `GET /v1/stations/search`

Public. Query: `q` string **bắt buộc theo FluentValidation**, không rỗng; `city`, `province` string optional, không có default. Không body. `200 ApiResponse<StationSearchResult[]>`; `422 VALIDATION_ERROR` khi `q` thiếu/rỗng.

```json
{"success":true,"statusCode":200,"data":[{"id":"11111111-1111-1111-1111-111111111111","name":"Bến xe Miền Đông","locationId":"22222222-2222-2222-2222-222222222222","city":"Thủ Đức","province":"Hồ Chí Minh","latitude":10.802,"longitude":106.746,"addressStreet":"292 Đinh Bộ Lĩnh","supportsShuttle":false}],"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS --get "$BASE_URL/v1/stations/search" --data-urlencode "q=Miền Đông" --data-urlencode "city=Thủ Đức"
```

```js
const qs = new URLSearchParams({q: 'Miền Đông', city: 'Thủ Đức'});
const stations = await fetch(`${BASE_URL}/v1/stations/search?${qs}`).then(r => r.json());
```

### 5.4 Tìm chuyến — `GET /v1/trips/search`

Public. Không body. Phải cung cấp **một cặp đầy đủ** `originStationId` + `destinationStationId` (UUID khác nhau, khác empty UUID) **hoặc** `originLocationCode` + `destinationLocationCode` (mỗi code tối đa 20 ký tự). `departureDate` (`YYYY-MM-DD`) và `passengerCount` (integer > 0) bắt buộc; `allowAlongRoutePickup` boolean optional. Code không nhận page/pageSize; handler trả page result theo truy vấn repository.

Thành công `200 ApiResponse<SearchTripsResult>`; `422 VALIDATION_ERROR`; handler còn có thể trả `403 FORBIDDEN` hoặc `422 VALIDATION_ERROR` nếu internal operator lookup từ Identity từ chối/thất bại.

```json
{"success":true,"statusCode":200,"data":{"items":[{"tripId":"11111111-1111-1111-1111-111111111111","operatorId":"22222222-2222-2222-2222-222222222222","operatorName":"VietRide Express","routeId":"33333333-3333-3333-3333-333333333333","departureDateTime":"2026-07-11T08:00:00+07:00","estimatedArrivalTime":"2026-07-11T14:00:00+07:00","originStation":{"id":"44444444-4444-4444-4444-444444444444","name":"Bến A"},"destinationStation":{"id":"55555555-5555-5555-5555-555555555555","name":"Bến B"},"availableSeats":20,"baseFare":250000,"allowAlongRoutePickup":true,"allowAlongRouteDropoff":true}],"page":1,"pageSize":20,"totalItems":1,"totalPages":1,"hasNextPage":false,"hasPreviousPage":false},"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS --get "$BASE_URL/v1/trips/search" --data-urlencode "originStationId=44444444-4444-4444-4444-444444444444" --data-urlencode "destinationStationId=55555555-5555-5555-5555-555555555555" --data-urlencode "departureDate=2026-07-11" --data-urlencode "passengerCount=2" --data-urlencode "allowAlongRoutePickup=true"
```

```js
const qs = new URLSearchParams({originStationId:'44444444-4444-4444-4444-444444444444',destinationStationId:'55555555-5555-5555-5555-555555555555',departureDate:'2026-07-11',passengerCount:'2',allowAlongRoutePickup:'true'});
const trips = await fetch(`${BASE_URL}/v1/trips/search?${qs}`).then(r => r.json());
```

### 5.5 Chi tiết chuyến — `GET /v1/trips/{tripId}`

Header `Authorization` bắt buộc; `tripId` path UUID bắt buộc; không query/body. `200 ApiResponse<TripDetailDto>` (schema đầy đủ ở §8); `401 AUTH_TOKEN_INVALID`; `404 TRIP_NOT_FOUND`.

```json
{"success":true,"statusCode":200,"data":{"tripId":"11111111-1111-1111-1111-111111111111","operatorId":"22222222-2222-2222-2222-222222222222","routeId":"33333333-3333-3333-3333-333333333333","vehicleId":"44444444-4444-4444-4444-444444444444","status":"SCHEDULED","departureDateTime":"2026-07-11T08:00:00+07:00","estimatedArrivalTime":"2026-07-11T14:00:00+07:00","baseFare":250000,"originStation":{"id":"55555555-5555-5555-5555-555555555555","name":"Bến A"},"destinationStation":{"id":"66666666-6666-6666-6666-666666666666","name":"Bến B"},"stops":[],"seatSummary":{"totalSeats":40,"availableSeats":20},"returnRouteId":null,"fareBreakdown":{"baseFare":250000,"stops":[]}},"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/trips/11111111-1111-1111-1111-111111111111"
```

```js
const detail = await fetch(`${BASE_URL}/v1/trips/11111111-1111-1111-1111-111111111111`,{headers:{Authorization:`Bearer ${ACCESS_TOKEN}`}}).then(r=>r.json());
```

### 5.6 Sơ đồ ghế — `GET /v1/trips/{tripId}/seat-map`

Auth và path giống 5.5. `200 ApiResponse<TripSeatMapDto>`; `401 AUTH_TOKEN_INVALID`; `404 TRIP_NOT_FOUND`.

```json
{"success":true,"statusCode":200,"data":{"tripId":"11111111-1111-1111-1111-111111111111","vehicleType":"BUS","seats":[{"seatNumber":"A1","status":"AVAILABLE","type":"STANDARD","row":1,"col":1,"deck":1}]},"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/trips/11111111-1111-1111-1111-111111111111/seat-map"
```

```js
const map = await fetch(`${BASE_URL}/v1/trips/11111111-1111-1111-1111-111111111111/seat-map`,{headers:{Authorization:`Bearer ${ACCESS_TOKEN}`}}).then(r=>r.json());
```

### 5.7 Lịch của driver/assistant — `GET /v1/driver/me/schedule`

Auth role `DRIVER` hoặc `ASSISTANT`. Query `from`, `to` đều optional nhưng phải cùng có hoặc cùng vắng; format date; `to >= from`. Khi cùng vắng, handler dùng hôm nay theo UTC+7 đến hôm nay + 14 ngày (inclusive). `200 ApiResponse<GetMyDriverScheduleResult>`; 401; 403; `422 VALIDATION_ERROR`.

```json
{"success":true,"statusCode":200,"data":{"from":"2026-07-10","to":"2026-07-17","trips":[{"tripId":"11111111-1111-1111-1111-111111111111","operatorId":"22222222-2222-2222-2222-222222222222","routeId":"33333333-3333-3333-3333-333333333333","vehicleId":"44444444-4444-4444-4444-444444444444","departureDateTime":"2026-07-11T08:00:00+07:00","estimatedArrivalTime":"2026-07-11T14:00:00+07:00","status":"SCHEDULED","assignmentRole":"DRIVER"}]},"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/driver/me/schedule?from=2026-07-10&to=2026-07-17"
```

```js
const schedule=await fetch(`${BASE_URL}/v1/driver/me/schedule?from=2026-07-10&to=2026-07-17`,{headers:{Authorization:`Bearer ${ACCESS_TOKEN}`}}).then(r=>r.json());
```

### 5.8 Admin locations — 4 endpoint

Tất cả yêu cầu `SYSTEM_ADMIN` và `Authorization`. `LocationDto` như 5.2.

| Method + URL | Params/body và validation | Success | Code lỗi từ code |
|---|---|---|---|
| `GET /v1/admin/locations` | query optional `page>0` (default 1), `pageSize=1..100` (default 20), `search` max 255, `isActive` boolean | 200 paged `LocationDto` | 401, 403, 422 |
| `POST /v1/admin/locations` | body bên dưới; `isActive` mặc định true | 201 `LocationDto` | 401, 403, 409 `LOCATION_CODE_CONFLICT`, 422 |
| `PATCH /v1/admin/locations/{id}` | UUID; mọi body field optional | 200 `LocationDto` | 401, 403, 404 `LOCATION_NOT_FOUND`, 409 `LOCATION_CODE_CONFLICT`, 422 |
| `DELETE /v1/admin/locations/{id}` | UUID; deactivate, không hard-delete | 200 `LocationDto` với `isActive:false` | 401, 403, 404 `LOCATION_NOT_FOUND` |

Create body: `code` required non-empty, max 20, regex `^[A-Za-z0-9_-]+$`; `name` required max 100; `type` required case-insensitive `PROVINCE|MUNICIPALITY`; `sortOrder` optional integer >=0; `isActive` optional boolean. Patch áp dụng cùng rule khi field khác null.

```json
{"code":"HCM","name":"Thành phố Hồ Chí Minh","type":"MUNICIPALITY","sortOrder":1,"isActive":true}
```

Success create/patch/delete có dạng:

```json
{"success":true,"statusCode":201,"data":{"id":"11111111-1111-1111-1111-111111111111","code":"HCM","name":"Thành phố Hồ Chí Minh","type":"MUNICIPALITY","isActive":true,"sortOrder":1,"createdAt":"2026-07-10T08:30:00Z","updatedAt":"2026-07-10T08:30:00Z"},"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS -X POST "$BASE_URL/v1/admin/locations" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"code":"HCM","name":"Thành phố Hồ Chí Minh","type":"MUNICIPALITY","sortOrder":1,"isActive":true}'
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/admin/locations?page=1&pageSize=20&isActive=true"
curl -sS -X PATCH "$BASE_URL/v1/admin/locations/11111111-1111-1111-1111-111111111111" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"name":"TP. Hồ Chí Minh"}'
curl -sS -X DELETE "$BASE_URL/v1/admin/locations/11111111-1111-1111-1111-111111111111" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const adminCall=(path,init={})=>fetch(`${BASE_URL}${path}`,{...init,headers:{Authorization:`Bearer ${ACCESS_TOKEN}`,...(init.body?{'Content-Type':'application/json'}:{}),...init.headers}}).then(r=>r.json());
await adminCall('/v1/admin/locations?page=1&pageSize=20');
await adminCall('/v1/admin/locations',{method:'POST',body:JSON.stringify({code:'HCM',name:'Thành phố Hồ Chí Minh',type:'MUNICIPALITY',sortOrder:1,isActive:true})});
await adminCall('/v1/admin/locations/11111111-1111-1111-1111-111111111111',{method:'PATCH',body:JSON.stringify({name:'TP. Hồ Chí Minh'})});
await adminCall('/v1/admin/locations/11111111-1111-1111-1111-111111111111',{method:'DELETE'});
```

## 6. Operator API

Các endpoint trong mục này luôn cần `Authorization`. Ví dụ helper copy-paste:

```js
async function api(path, {method='GET', body, idempotencyKey}={}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      ...(body ? {'Content-Type':'application/json'} : {}),
      ...(idempotencyKey ? {'Idempotency-Key':idempotencyKey} : {})
    },
    ...(body ? {body: JSON.stringify(body)} : {})
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw payload;
  return payload;
}
```

### 6.1 Tạo hoặc link operator station — `POST /v1/operator/stations`

Role `OPERATOR_ADMIN|OPERATOR_STAFF`. Hai nhánh body loại trừ nhau:

- **Link:** `stationId` UUID khác empty là bắt buộc; `displayNameOverride` max 255, `counterLocation` max 255, `contactPhone` max 20, `instructions` max 4000 optional. Các field tạo station bị bỏ qua bởi mapping.
- **Create:** không có `stationId`; `name` required max 255; `city`, `province` required max 100; `latitude`, `longitude` required nhưng source **không giới hạn range**; `addressStreet` max 500; `contactPhone` max 20; `contactEmail` max 255 và email hợp lệ; `operatingHours`, `facilities` là JSON bất kỳ nhưng chuỗi raw sau serialize max 4000; `supportsShuttle` là boolean non-nullable, nếu thiếu model binder dùng `false`; `locationId` UUID optional; `locationCode` max 20 optional. Nếu có locationId/code, handler kiểm tra logical FK active.

```json
{"stationId":null,"displayNameOverride":null,"counterLocation":"Quầy 1","contactPhone":"0901234567","instructions":"Có mặt trước 30 phút","name":"Bến xe A","city":"Thủ Đức","province":"Hồ Chí Minh","latitude":10.802,"longitude":106.746,"addressStreet":"292 Đinh Bộ Lĩnh","contactEmail":"station@example.com","operatingHours":{"mon":"05:00-22:00"},"facilities":["WC"],"supportsShuttle":false,"locationId":null,"locationCode":"HCM"}
```

`201` nếu tạo station mới không warning; `200` khi link hoặc response có warning. Data: `{operatorId,stationId,isActive,warning:{code,message}|null,nearbyStations:StationSearchResult[]}`. Lỗi: 401; 403 `FORBIDDEN`; 404 `STATION_NOT_FOUND` ở nhánh link; 422 `VALIDATION_ERROR` (bao gồm operator/location logical FK). 

Trước khi tạo, handler tìm station active cách tọa độ nhập **nhỏ hơn 100 m**. Nếu có, handler **không tạo/link**, trả 200 với chỉ `warning.code="STATION_DUPLICATE_NEARBY"`, message `A nearby active station already exists. Link an existing station instead.` và `nearbyStations`; các field `operatorId`, `stationId`, `isActive` bị omit vì null.

```bash
curl -sS -X POST "$BASE_URL/v1/operator/stations" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"name":"Bến xe A","city":"Thủ Đức","province":"Hồ Chí Minh","latitude":10.802,"longitude":106.746,"supportsShuttle":false,"locationCode":"HCM"}'
```

```js
const station=await api('/v1/operator/stations',{method:'POST',body:{name:'Bến xe A',city:'Thủ Đức',province:'Hồ Chí Minh',latitude:10.802,longitude:106.746,supportsShuttle:false,locationCode:'HCM'}});
```

### 6.2 Stops — 4 endpoint

`POST/PATCH` chỉ `OPERATOR_ADMIN`; `GET` cho cả operator roles. `StopDto`: `{id,operatorId,name,description,latitude,longitude,address,googlePlaceId,isActive,createdAt,updatedAt,locationId}`; nullable field có thể là null.

| Endpoint | Params/body | Success | Lỗi có trong code |
|---|---|---|---|
| `POST /v1/operator/stops` | body create bên dưới | 201 `StopDto` | 401, 403, 422 |
| `GET /v1/operator/stops` | `page>0` default 1; `pageSize=1..100` default 20; `search` max 255 | 200 paged `StopDto` | 401, 403, 422 |
| `GET /v1/operator/stops/{id}` | path UUID | 200 `StopDto` | 401, 403, 404 `STOP_NOT_FOUND` |
| `PATCH /v1/operator/stops/{id}` | path UUID; body patch | 200 `StopDto` | 401, 403, 404 `STOP_NOT_FOUND`, 422 |

Create: `name` required max 255; `latitude` required `[-90,90]`; `longitude` required `[-180,180]`; `description` max 4000; `address` max 500; `googlePlaceId` max 255; `locationId` UUID optional, `locationCode` max 20 optional. Patch có `name,latitude,longitude,description,address,googlePlaceId` optional và cùng giới hạn; patch không đổi location. Logical location không tồn tại/inactive trả `422 VALIDATION_ERROR`.

```json
{"name":"Điểm đón Q1","latitude":10.776,"longitude":106.7,"description":"Cổng chính","address":"Quận 1","googlePlaceId":null,"locationId":null,"locationCode":"HCM"}
```

```json
{"success":true,"statusCode":201,"data":{"id":"11111111-1111-1111-1111-111111111111","operatorId":"22222222-2222-2222-2222-222222222222","name":"Điểm đón Q1","description":"Cổng chính","latitude":10.776,"longitude":106.7,"address":"Quận 1","googlePlaceId":null,"isActive":true,"createdAt":"2026-07-10T08:30:00Z","updatedAt":"2026-07-10T08:30:00Z","locationId":null},"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS -X POST "$BASE_URL/v1/operator/stops" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"name":"Điểm đón Q1","latitude":10.776,"longitude":106.7}'
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/operator/stops?page=1&pageSize=20&search=Q1"
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/operator/stops/11111111-1111-1111-1111-111111111111"
curl -sS -X PATCH "$BASE_URL/v1/operator/stops/11111111-1111-1111-1111-111111111111" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"description":"Cổng phụ"}'
```

```js
await api('/v1/operator/stops',{method:'POST',body:{name:'Điểm đón Q1',latitude:10.776,longitude:106.7}});
await api('/v1/operator/stops?page=1&pageSize=20&search=Q1');
await api('/v1/operator/stops/11111111-1111-1111-1111-111111111111');
await api('/v1/operator/stops/11111111-1111-1111-1111-111111111111',{method:'PATCH',body:{description:'Cổng phụ'}});
```

### 6.3 Routes cơ bản — 5 endpoint

`POST/PATCH/PUT` chỉ `OPERATOR_ADMIN`; GET cho cả operator roles.

| Endpoint | Input | Success | Lỗi từ code |
|---|---|---|---|
| `POST /v1/operator/routes` | create body | 201 `RouteDto` | 401,403,404 `STATION_NOT_FOUND|ROUTE_NOT_FOUND`,422 |
| `GET /v1/operator/routes` | `page>0` default 1, `pageSize=1..100` default 20, `search` optional | 200 paged `RouteListItemDto` | 401,403,422 |
| `GET /v1/operator/routes/{id}` | UUID | 200 `RouteDto` | 401,403,404 `ROUTE_NOT_FOUND` |
| `PATCH /v1/operator/routes/{id}` | patch body | 200 `RouteDto` | 401,403,404 `ROUTE_NOT_FOUND`,422 |
| `PUT /v1/operator/routes/{id}/geometry` | `{pathPolyline}` | 200 `RouteDto` | 401,403,404 `ROUTE_NOT_FOUND`,422 geometry codes |

Create validation: `name` required max 255; origin/destination UUID required, phải khác nhau và operator phải có active station link với cả hai; `returnRouteId` optional non-empty UUID thuộc cùng operator và active; `baseFare` integer >=0; `totalDistanceKm` optional >=0; `estimatedDurationMinutes` optional >=0; `isActive` optional, null/omitted tạo route active còn `false` deactivate ngay. Money giữ nguyên đến đơn vị đồng, không làm tròn nghìn. Patch fields optional; để xóa `returnRouteId`, gửi rõ `"returnRouteId":null` (request theo dõi field presence). Geometry `pathPolyline` nullable: null/blank xóa geometry; nếu có, Google encoded polyline tối đa 100 KiB, 2..10,000 points, lat/lng hợp lệ và mọi station/stop cách line không quá 500m. Lỗi geometry: `ROUTE_GEOMETRY_TOO_LARGE`, `ROUTE_GEOMETRY_INVALID`, `ROUTE_GEOMETRY_STOP_MISMATCH` (422).

```json
{"name":"HCM - Đà Lạt","originStationId":"11111111-1111-1111-1111-111111111111","destinationStationId":"22222222-2222-2222-2222-222222222222","returnRouteId":null,"baseFare":250000,"totalDistanceKm":310.5,"estimatedDurationMinutes":360,"isActive":true}
```

```json
{"success":true,"statusCode":201,"data":{"id":"33333333-3333-3333-3333-333333333333","operatorId":"44444444-4444-4444-4444-444444444444","name":"HCM - Đà Lạt","originStationId":"11111111-1111-1111-1111-111111111111","destinationStationId":"22222222-2222-2222-2222-222222222222","returnRouteId":null,"baseFare":250000,"totalDistanceKm":310.5,"estimatedDurationMinutes":360,"pathPolyline":null,"isActive":true,"createdAt":"2026-07-10T08:30:00Z","updatedAt":"2026-07-10T08:30:00Z"},"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS -X POST "$BASE_URL/v1/operator/routes" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"name":"HCM - Đà Lạt","originStationId":"11111111-1111-1111-1111-111111111111","destinationStationId":"22222222-2222-2222-2222-222222222222","baseFare":250000,"totalDistanceKm":310.5,"estimatedDurationMinutes":360,"isActive":true}'
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/operator/routes?page=1&pageSize=20&search=Đà%20Lạt"
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/operator/routes/33333333-3333-3333-3333-333333333333"
curl -sS -X PATCH "$BASE_URL/v1/operator/routes/33333333-3333-3333-3333-333333333333" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"baseFare":260000}'
curl -sS -X PUT "$BASE_URL/v1/operator/routes/33333333-3333-3333-3333-333333333333/geometry" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"pathPolyline":"_p~iF~ps|U_ulLnnqC_mqNvxq`@"}'
```

```js
await api('/v1/operator/routes',{method:'POST',body:{name:'HCM - Đà Lạt',originStationId:'11111111-1111-1111-1111-111111111111',destinationStationId:'22222222-2222-2222-2222-222222222222',baseFare:250000,totalDistanceKm:310.5,estimatedDurationMinutes:360,isActive:true}});
await api('/v1/operator/routes?page=1&pageSize=20&search='+encodeURIComponent('Đà Lạt'));
await api('/v1/operator/routes/33333333-3333-3333-3333-333333333333');
await api('/v1/operator/routes/33333333-3333-3333-3333-333333333333',{method:'PATCH',body:{baseFare:260000}});
await api('/v1/operator/routes/33333333-3333-3333-3333-333333333333/geometry',{method:'PUT',body:{pathPolyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@'}});
```

### 6.4 Route stops — 2 endpoint

Role `OPERATOR_ADMIN`.

- `POST /v1/operator/routes/{id}/stops`: body dưới. `stopId` UUID required; `orderIndex>0`; `estimatedDurationFromOriginMinutes>=0`; `distanceFromOriginKm` optional >=0; `allowPickup`, `allowDropoff` optional và mỗi field default `true`; ít nhất một flag phải true. `201 ApiResponse<RouteStopDto>`. Lỗi 401/403, 404 `ROUTE_NOT_FOUND|STOP_NOT_FOUND`, 422 `ROUTE_STOP_FLAGS_INVALID|ROUTE_STOP_ORDER_CONFLICT|VALIDATION_ERROR`.
- `DELETE /v1/operator/routes/{id}/stops/{stopId}`: hai UUID; `200` data `{"deleted":true}`. Lỗi 401/403, 404 `ROUTE_NOT_FOUND|STOP_NOT_FOUND`, 422 validation.

```json
{"stopId":"55555555-5555-5555-5555-555555555555","orderIndex":1,"estimatedDurationFromOriginMinutes":60,"distanceFromOriginKm":50.5,"allowPickup":true,"allowDropoff":true}
```

```json
{"success":true,"statusCode":201,"data":{"routeId":"33333333-3333-3333-3333-333333333333","stopId":"55555555-5555-5555-5555-555555555555","orderIndex":1,"estimatedDurationFromOriginMinutes":60,"distanceFromOriginKm":50.5,"allowPickup":true,"allowDropoff":true,"createdAt":"2026-07-10T08:30:00Z","updatedAt":"2026-07-10T08:30:00Z"},"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS -X POST "$BASE_URL/v1/operator/routes/33333333-3333-3333-3333-333333333333/stops" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"stopId":"55555555-5555-5555-5555-555555555555","orderIndex":1,"estimatedDurationFromOriginMinutes":60,"distanceFromOriginKm":50.5}'
curl -sS -X DELETE "$BASE_URL/v1/operator/routes/33333333-3333-3333-3333-333333333333/stops/55555555-5555-5555-5555-555555555555" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
await api('/v1/operator/routes/33333333-3333-3333-3333-333333333333/stops',{method:'POST',body:{stopId:'55555555-5555-5555-5555-555555555555',orderIndex:1,estimatedDurationFromOriginMinutes:60,distanceFromOriginKm:50.5}});
await api('/v1/operator/routes/33333333-3333-3333-3333-333333333333/stops/55555555-5555-5555-5555-555555555555',{method:'DELETE'});
```

### 6.5 Fare templates — 2 endpoint

POST chỉ admin; GET cả operator roles.

- `POST /v1/operator/routes/{id}/fare-templates`: `stopId` UUID; `fareFromThisStop` int64 >=0; `effectiveFrom` date-time required/non-default; `effectiveUntil` optional và lớn hơn from. Stop phải nằm trên route và time window không overlap. `201 ApiResponse<RouteStopFareTemplateDto>`. Lỗi 401/403, 404 `ROUTE_NOT_FOUND|STOP_NOT_FOUND`, 422 `VALIDATION_ERROR`.
- `GET /v1/operator/routes/{id}/fare-templates?page=1&pageSize=20`: UUID, page >0, pageSize 1..100; `200` paged DTO. Lỗi 401/403, 404 `ROUTE_NOT_FOUND`, 422.

```json
{"stopId":"55555555-5555-5555-5555-555555555555","fareFromThisStop":120000,"effectiveFrom":"2026-07-10T00:00:00+07:00","effectiveUntil":null}
```

```json
{"success":true,"statusCode":201,"data":{"id":"66666666-6666-6666-6666-666666666666","routeId":"33333333-3333-3333-3333-333333333333","stopId":"55555555-5555-5555-5555-555555555555","fareFromThisStop":120000,"effectiveFrom":"2026-07-10T00:00:00+07:00","effectiveUntil":null,"createdAt":"2026-07-10T08:30:00Z","updatedAt":"2026-07-10T08:30:00Z"},"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS -X POST "$BASE_URL/v1/operator/routes/33333333-3333-3333-3333-333333333333/fare-templates" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"stopId":"55555555-5555-5555-5555-555555555555","fareFromThisStop":120000,"effectiveFrom":"2026-07-10T00:00:00+07:00","effectiveUntil":null}'
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/operator/routes/33333333-3333-3333-3333-333333333333/fare-templates?page=1&pageSize=20"
```

```js
await api('/v1/operator/routes/33333333-3333-3333-3333-333333333333/fare-templates',{method:'POST',body:{stopId:'55555555-5555-5555-5555-555555555555',fareFromThisStop:120000,effectiveFrom:'2026-07-10T00:00:00+07:00',effectiveUntil:null}});
await api('/v1/operator/routes/33333333-3333-3333-3333-333333333333/fare-templates?page=1&pageSize=20');
```

### 6.6 Alternative routes — 5 endpoint

Create/update/geometry/delete admin; list cả operator roles.

| Endpoint | Success | Lỗi nghiệp vụ |
|---|---|---|
| `POST /v1/operator/routes/{id}/alternative-routes` | 201 `AlternativeRouteDto` | 404 route/station/stop; 422 limit/validation |
| `GET /v1/operator/routes/{id}/alternative-routes?page&pageSize` | 200 paged `AlternativeRouteListItemDto` | 404 `ROUTE_NOT_FOUND`; 422 page |
| `PATCH /v1/operator/alternative-routes/{id}` | 200 `AlternativeRouteDto` | 404 route/station/stop; 422 |
| `PUT /v1/operator/alternative-routes/{id}/geometry` | 200 `AlternativeRouteDto` | 404 route; 422 geometry |
| `DELETE /v1/operator/alternative-routes/{id}` | 200 data `{"isActive":false}` | 404 `ROUTE_NOT_FOUND` |

Mọi endpoint còn có 401/403. Create body: `name` required max 255; `description` optional; `destinationStationId` UUID; `totalDistanceKm>=0` optional; `estimatedDurationMinutes>=0` optional; `stops` non-null array. Mỗi stop: `stopId` UUID, `orderIndex>0`, duration >=0, distance optional >=0. Patch dùng field presence: chỉ gửi field muốn đổi; có thể gửi null cho nullable field; **không gửi các property `hasName`, `hasDescription`, ...** dù Swagger reflection hiện lộ chúng — controller tự thiết lập các flag này khi JSON property tương ứng có mặt. Tối đa 2 alternative route active: `422 ALTERNATIVE_ROUTE_LIMIT_EXCEEDED`. Geometry theo rule §6.3.

```json
{"name":"Đường tránh QL20","description":"Dùng khi đèo đóng","destinationStationId":"22222222-2222-2222-2222-222222222222","totalDistanceKm":320.0,"estimatedDurationMinutes":390,"stops":[{"stopId":"55555555-5555-5555-5555-555555555555","orderIndex":1,"estimatedDurationFromOriginMinutes":70,"distanceFromOriginKm":55.0}]}
```

```json
{"success":true,"statusCode":201,"data":{"id":"77777777-7777-7777-7777-777777777777","routeId":"33333333-3333-3333-3333-333333333333","name":"Đường tránh QL20","description":"Dùng khi đèo đóng","destinationStationId":"22222222-2222-2222-2222-222222222222","totalDistanceKm":320.0,"estimatedDurationMinutes":390,"pathPolyline":null,"isActive":true,"stops":[],"createdAt":"2026-07-10T08:30:00Z","updatedAt":"2026-07-10T08:30:00Z"},"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS -X POST "$BASE_URL/v1/operator/routes/33333333-3333-3333-3333-333333333333/alternative-routes" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"name":"Đường tránh QL20","destinationStationId":"22222222-2222-2222-2222-222222222222","stops":[]}'
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/operator/routes/33333333-3333-3333-3333-333333333333/alternative-routes?page=1&pageSize=20"
curl -sS -X PATCH "$BASE_URL/v1/operator/alternative-routes/77777777-7777-7777-7777-777777777777" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"description":null,"isActive":true}'
curl -sS -X PUT "$BASE_URL/v1/operator/alternative-routes/77777777-7777-7777-7777-777777777777/geometry" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"pathPolyline":"_p~iF~ps|U_ulLnnqC_mqNvxq`@"}'
curl -sS -X DELETE "$BASE_URL/v1/operator/alternative-routes/77777777-7777-7777-7777-777777777777" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
await api('/v1/operator/routes/33333333-3333-3333-3333-333333333333/alternative-routes',{method:'POST',body:{name:'Đường tránh QL20',destinationStationId:'22222222-2222-2222-2222-222222222222',stops:[]}});
await api('/v1/operator/routes/33333333-3333-3333-3333-333333333333/alternative-routes?page=1&pageSize=20');
await api('/v1/operator/alternative-routes/77777777-7777-7777-7777-777777777777',{method:'PATCH',body:{description:null,isActive:true}});
await api('/v1/operator/alternative-routes/77777777-7777-7777-7777-777777777777/geometry',{method:'PUT',body:{pathPolyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@'}});
await api('/v1/operator/alternative-routes/77777777-7777-7777-7777-777777777777',{method:'DELETE'});
```

### 6.7 Vehicles — 4 endpoint

POST/PATCH admin; GET cả operator roles.

| Endpoint | Input | Success | Lỗi |
|---|---|---|---|
| `POST /v1/operator/vehicles` | create body | 201 `VehicleDto` | 404 `VEHICLE_TYPE_NOT_FOUND`; 422 validation/license conflict |
| `GET /v1/operator/vehicles` | query list | 200 paged `VehicleDto` | 400 `INVALID_SORT_FIELD`; 422 query validation |
| `GET /v1/operator/vehicles/{id}` | UUID | 200 `VehicleDto` | 404 `VEHICLE_NOT_FOUND` |
| `PATCH /v1/operator/vehicles/{id}` | patch body | 200 `VehicleDto` | 404 vehicle/type; 422 validation/license conflict |

Mọi endpoint còn có 401/403. Create: `vehicleTypeId` UUID required; `licensePlate` required max 20; `seatLayoutJson` object required; `totalSeats>0`; cargo max optional >=0. Seat layout shape: `{version:int,vehicleTypeCode:string,totalSeats:int,rows:int,cols:int,decks:int,aisles:[{afterCol:int}],seats:[{seatNumber,row,col,deck,type,isWindow,isAisle,disabled}]}`. Handler kiểm tra `seatLayoutJson.totalSeats == seats.length == request totalSeats` và `seatNumber` unique (ordinal/case-sensitive); các field layout khác không có validator riêng trong code. Patch field optional; gửi `seatLayoutJson:null` **không xóa** mà trả 422 vì layout required; gửi null rõ cho `maxCargoWeightKg`/`maxCargoVolumeM3` thì xóa capacity tương ứng; không gửi các `has...` reflection fields. `status` dùng converter riêng và nhận/trả JSON string `ACTIVE|MAINTENANCE|OFF_DUTY|RETIRED`.

List: `page` default 1 >0; `pageSize` default 20, 1..100; `search` max 255; `searchIn` chỉ `licensePlate`; `sortDir` `asc|desc`; `sortBy` cho phép `licensePlate,totalSeats,status,isActive,createdAt,updatedAt`, default handler là `createdAt`; sort field khác trả 400.

```json
{"vehicleTypeId":"11111111-1111-1111-1111-111111111111","licensePlate":"51B-12345","seatLayoutJson":{"version":1,"vehicleTypeCode":"BUS","totalSeats":1,"rows":1,"cols":1,"decks":1,"aisles":[],"seats":[{"seatNumber":"A1","row":1,"col":1,"deck":1,"type":"STANDARD","isWindow":true,"isAisle":false,"disabled":false}]},"totalSeats":1,"maxCargoWeightKg":500.0,"maxCargoVolumeM3":5.0}
```

```json
{"success":true,"statusCode":201,"data":{"id":"22222222-2222-2222-2222-222222222222","operatorId":"33333333-3333-3333-3333-333333333333","vehicleTypeId":"11111111-1111-1111-1111-111111111111","licensePlate":"51B-12345","seatLayoutJson":{"version":1,"vehicleTypeCode":"BUS","totalSeats":1,"rows":1,"cols":1,"decks":1,"aisles":[],"seats":[{"seatNumber":"A1","row":1,"col":1,"deck":1,"type":"STANDARD","isWindow":true,"isAisle":false,"disabled":false}]},"totalSeats":1,"maxCargoWeightKg":500.0,"maxCargoVolumeM3":5.0,"status":"ACTIVE","isActive":true,"createdAt":"2026-07-10T08:30:00Z","updatedAt":"2026-07-10T08:30:00Z"},"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS -X POST "$BASE_URL/v1/operator/vehicles" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"vehicleTypeId":"11111111-1111-1111-1111-111111111111","licensePlate":"51B-12345","seatLayoutJson":{"version":1,"vehicleTypeCode":"BUS","totalSeats":1,"rows":1,"cols":1,"decks":1,"aisles":[],"seats":[{"seatNumber":"A1","row":1,"col":1,"deck":1,"type":"STANDARD","isWindow":true,"isAisle":false,"disabled":false}]},"totalSeats":1,"maxCargoWeightKg":500,"maxCargoVolumeM3":5}'
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/operator/vehicles?page=1&pageSize=20&search=51B&searchIn=licensePlate&sortBy=createdAt&sortDir=desc"
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/operator/vehicles/22222222-2222-2222-2222-222222222222"
curl -sS -X PATCH "$BASE_URL/v1/operator/vehicles/22222222-2222-2222-2222-222222222222" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"maxCargoWeightKg":600}'
```

```js
const vehicleBody={vehicleTypeId:'11111111-1111-1111-1111-111111111111',licensePlate:'51B-12345',seatLayoutJson:{version:1,vehicleTypeCode:'BUS',totalSeats:1,rows:1,cols:1,decks:1,aisles:[],seats:[{seatNumber:'A1',row:1,col:1,deck:1,type:'STANDARD',isWindow:true,isAisle:false,disabled:false}]},totalSeats:1,maxCargoWeightKg:500,maxCargoVolumeM3:5};
await api('/v1/operator/vehicles',{method:'POST',body:vehicleBody});
await api('/v1/operator/vehicles?page=1&pageSize=20&search=51B&searchIn=licensePlate&sortBy=createdAt&sortDir=desc');
await api('/v1/operator/vehicles/22222222-2222-2222-2222-222222222222');
await api('/v1/operator/vehicles/22222222-2222-2222-2222-222222222222',{method:'PATCH',body:{maxCargoWeightKg:600}});
```

### 6.8 Vehicle types — `GET /v1/vehicle-types`

Role cả hai operator. Query: page default 1 >0; pageSize default 20, 1..100; search max 255; `searchIn` comma-separated chỉ `code,displayName`; `sortDir=asc|desc`; `sortBy` cho phép `code,displayName,defaultSeatCount,isSystemDefined,createdAt,updatedAt`, field khác trả `400 INVALID_SORT_FIELD`. `200` paged `VehicleTypeDto`; lỗi 401,403,400,422.

```json
{"success":true,"statusCode":200,"data":{"items":[{"id":"11111111-1111-1111-1111-111111111111","code":"BUS","displayName":"Xe khách","estimatedPassengerLuggageKgPerSeat":10,"defaultSeatCount":40,"isSystemDefined":true,"isActive":true,"createdAt":"2026-07-10T08:30:00Z","updatedAt":"2026-07-10T08:30:00Z"}],"page":1,"pageSize":20,"totalItems":1,"totalPages":1,"hasNextPage":false,"hasPreviousPage":false},"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/vehicle-types?page=1&pageSize=20&search=BUS&searchIn=code,displayName&sortBy=code&sortDir=asc"
```

```js
await api('/v1/vehicle-types?page=1&pageSize=20&search=BUS&searchIn=code%2CdisplayName&sortBy=code&sortDir=asc');
```

### 6.9 Driver schedules — 2 endpoint

Role `OPERATOR_ADMIN`.

- `POST /v1/operator/driver-schedules`: body dưới. `routeId`, `driverUserId` required UUID; vehicle/assistant optional nhưng nếu có không được empty UUID; `dayOfWeek` non-empty, mỗi số 1..7; `departureTime` time; `validFrom` date; `validUntil` optional và >= from; `isActive` boolean. `201 DriverScheduleDto`. Lỗi 401/403, 404 `ROUTE_NOT_FOUND|VEHICLE_NOT_FOUND|RESOURCE_NOT_FOUND` (assigned-user validation có thể trả lỗi từ Identity), 409 `TRIP_DRIVER_CONFLICT`, 422 `VALIDATION_ERROR`.
- `PATCH /v1/operator/driver-schedules/{id}/activate`: UUID, không body. `200 DriverScheduleDto`; lỗi 401/403, 404 `RESOURCE_NOT_FOUND|ROUTE_NOT_FOUND`, 409 `TRIP_DRIVER_CONFLICT`, 422 `VALIDATION_ERROR`.

```json
{"routeId":"11111111-1111-1111-1111-111111111111","vehicleId":"22222222-2222-2222-2222-222222222222","driverUserId":"33333333-3333-3333-3333-333333333333","assistantUserId":null,"dayOfWeek":[1,3,5],"departureTime":"08:00:00","validFrom":"2026-07-10","validUntil":null,"isActive":true}
```

```json
{"success":true,"statusCode":201,"data":{"id":"44444444-4444-4444-4444-444444444444","operatorId":"55555555-5555-5555-5555-555555555555","routeId":"11111111-1111-1111-1111-111111111111","vehicleId":"22222222-2222-2222-2222-222222222222","driverUserId":"33333333-3333-3333-3333-333333333333","assistantUserId":null,"dayOfWeek":[1,3,5],"departureTime":"08:00:00","validFrom":"2026-07-10","validUntil":null,"isActive":true,"createdAt":"2026-07-10T08:30:00Z","updatedAt":"2026-07-10T08:30:00Z"},"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS -X POST "$BASE_URL/v1/operator/driver-schedules" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"routeId":"11111111-1111-1111-1111-111111111111","vehicleId":"22222222-2222-2222-2222-222222222222","driverUserId":"33333333-3333-3333-3333-333333333333","assistantUserId":null,"dayOfWeek":[1,3,5],"departureTime":"08:00:00","validFrom":"2026-07-10","validUntil":null,"isActive":true}'
curl -sS -X PATCH "$BASE_URL/v1/operator/driver-schedules/44444444-4444-4444-4444-444444444444/activate" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
await api('/v1/operator/driver-schedules',{method:'POST',body:{routeId:'11111111-1111-1111-1111-111111111111',vehicleId:'22222222-2222-2222-2222-222222222222',driverUserId:'33333333-3333-3333-3333-333333333333',assistantUserId:null,dayOfWeek:[1,3,5],departureTime:'08:00:00',validFrom:'2026-07-10',validUntil:null,isActive:true}});
await api('/v1/operator/driver-schedules/44444444-4444-4444-4444-444444444444/activate',{method:'PATCH'});
```

### 6.10 Operator trip operations — 4 endpoint

`GET` cả operator roles; mutations chỉ admin và đều bắt buộc `Idempotency-Key`.

| Endpoint | Body | Success | Lỗi từ code |
|---|---|---|---|
| `GET /v1/operator/trips/{tripId}/cargo-capacity` | none | 200 `CargoCapacityDto` | 403 ownership, 404 `TRIP_NOT_FOUND` |
| `POST /v1/operator/trips/{tripId}/stops/{stopId}/arrive` | none | 200 `{tripId,stopId,status,actualArrivalTime}` | 404 trip/stop; 409 `INVALID_TRIP_STATUS|TRIP_STOP_ALREADY_FINALIZED`; 422 missing key |
| `POST /v1/operator/trips/{tripId}/substitute-vehicle` | `{newVehicleId,newDriverUserId,newAssistantUserId,reason}` | 200 `{oldTripId,newTripId,status}` | 403 ownership; 404 trip; 409 domain conflict; 422 missing key |
| `POST /v1/operator/trips/{tripId}/disrupt-no-substitution` | `{reason}` | 200 `{tripId,status,traveledRatio}` | 403 ownership; 404 trip; 409 domain conflict; 422 missing key |

Path UUID bắt buộc. Request record không có FluentValidator riêng cho substitute/disrupt; model binding yêu cầu các non-nullable UUID/string về mặt kiểu, nhưng validation chi tiết của `reason` ngoài domain không được khai báo. **⚠️ TODO: cần xác nhận thêm** exact 409 code/message từ domain cho hai operation cuối vì handler không remap exception domain tại vị trí đọc được.

```json
{"success":true,"statusCode":200,"data":{"tripId":"11111111-1111-1111-1111-111111111111","reservedWeightKg":100.0,"reservedVolumeM3":1.0,"loadedWeightKg":20.0,"loadedVolumeM3":0.2,"maxCargoWeightKg":500.0,"maxCargoVolumeM3":5.0,"availableWeightKg":400.0,"availableVolumeM3":4.0,"percentFull":20.0},"meta":{"traceId":"...","timestamp":"2026-07-10T08:30:00Z"}}
```

```bash
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/operator/trips/11111111-1111-1111-1111-111111111111/cargo-capacity"
curl -sS -X POST "$BASE_URL/v1/operator/trips/11111111-1111-1111-1111-111111111111/stops/22222222-2222-2222-2222-222222222222/arrive" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: arrive-111-222"
curl -sS -X POST "$BASE_URL/v1/operator/trips/11111111-1111-1111-1111-111111111111/substitute-vehicle" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: sub-111" -H "Content-Type: application/json" --data '{"newVehicleId":"33333333-3333-3333-3333-333333333333","newDriverUserId":"44444444-4444-4444-4444-444444444444","newAssistantUserId":null,"reason":"Vehicle breakdown"}'
curl -sS -X POST "$BASE_URL/v1/operator/trips/11111111-1111-1111-1111-111111111111/disrupt-no-substitution" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: disrupt-111" -H "Content-Type: application/json" --data '{"reason":"No replacement vehicle"}'
```

```js
await api('/v1/operator/trips/11111111-1111-1111-1111-111111111111/cargo-capacity');
await api('/v1/operator/trips/11111111-1111-1111-1111-111111111111/stops/22222222-2222-2222-2222-222222222222/arrive',{method:'POST',idempotencyKey:'arrive-111-222'});
await api('/v1/operator/trips/11111111-1111-1111-1111-111111111111/substitute-vehicle',{method:'POST',idempotencyKey:'sub-111',body:{newVehicleId:'33333333-3333-3333-3333-333333333333',newDriverUserId:'44444444-4444-4444-4444-444444444444',newAssistantUserId:null,reason:'Vehicle breakdown'}});
await api('/v1/operator/trips/11111111-1111-1111-1111-111111111111/disrupt-no-substitution',{method:'POST',idempotencyKey:'disrupt-111',body:{reason:'No replacement vehicle'}});
```

## 7. Internal service-to-service API

> Không dùng public `BASE_URL`. Các ví dụ giả định service có network access đến `TRIP_INTERNAL_URL=http://trip:5002` và token do backend mint đúng issuer/audience/secret.

```bash
TRIP_INTERNAL_URL=http://trip:5002
INTERNAL_JWT='<HS256 internal JWT>'
```

```js
async function internal(path,{method='GET',body,idempotencyKey}={}) {
  const response=await fetch(`${TRIP_INTERNAL_URL}${path}`,{method,headers:{'X-Internal-Auth':`Bearer ${INTERNAL_JWT}`,...(body?{'Content-Type':'application/json'}:{}),...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const payload=response.status===204?null:await response.json();
  if(!response.ok) throw payload;
  return payload;
}
```

Tất cả internal endpoint có thể trả `401 AUTH_TOKEN_INVALID`; path UUID bắt buộc. Gateway không expose các path này.

### 7.1 Internal station — `GET /internal/v1/stations/{id}`

Không query/body. Thành công `200` **raw** `InternalStationDto` (global filter không bọc vì DTO type/result behavior hiện tại được controller công bố raw; OpenAPI production cũng raw): `{id,name,slug,city,province,latitude,longitude,isActive,createdAt,updatedAt}`. Lỗi 404 `STATION_NOT_FOUND`.

```bash
curl -sS -H "X-Internal-Auth: Bearer $INTERNAL_JWT" "$TRIP_INTERNAL_URL/internal/v1/stations/11111111-1111-1111-1111-111111111111"
```

```js
await internal('/internal/v1/stations/11111111-1111-1111-1111-111111111111');
```

### 7.2 Internal stop — `GET /internal/v1/stops/{id}`

Không query/body. `200` raw `{id,operatorId,name,description,latitude,longitude,address,googlePlaceId,isActive,createdAt,updatedAt}`; `404 STOP_NOT_FOUND`.

```bash
curl -sS -H "X-Internal-Auth: Bearer $INTERNAL_JWT" "$TRIP_INTERNAL_URL/internal/v1/stops/11111111-1111-1111-1111-111111111111"
```

```js
await internal('/internal/v1/stops/11111111-1111-1111-1111-111111111111');
```

### 7.3 Trip snapshot — `GET /internal/v1/trips/{tripId}`

Không query/body. `200` raw `InternalTripSnapshotDto`:

```json
{"tripId":"11111111-1111-1111-1111-111111111111","operatorId":"22222222-2222-2222-2222-222222222222","routeId":"33333333-3333-3333-3333-333333333333","vehicleId":"44444444-4444-4444-4444-444444444444","status":"SCHEDULED","departureDateTime":"2026-07-11T08:00:00+07:00","estimatedArrivalTime":"2026-07-11T14:00:00+07:00","baseFare":250000,"originStation":{"id":"55555555-5555-5555-5555-555555555555","name":"Bến A"},"destinationStation":{"id":"66666666-6666-6666-6666-666666666666","name":"Bến B"},"stops":[],"seatSummary":{"totalSeats":40,"availableSeats":20},"returnRouteId":null,"driverUserId":"77777777-7777-7777-7777-777777777777","assistantUserId":null}
```

Lỗi `404 TRIP_NOT_FOUND` (trip/route/station snapshot thiếu đều dùng code này).

```bash
curl -sS -H "X-Internal-Auth: Bearer $INTERNAL_JWT" "$TRIP_INTERNAL_URL/internal/v1/trips/11111111-1111-1111-1111-111111111111"
```

```js
await internal('/internal/v1/trips/11111111-1111-1111-1111-111111111111');
```

### 7.4 Parcel availability — `GET /internal/v1/trips/parcel-availability`

Query required theo non-nullable action params: `originStationId`, `destinationStationId` UUID; `departureDate` date; `estimatedWeightKg>0`; `estimatedVolumeM3>0`; `sizeCategory` string; `page` default 1 nhưng handler normalize min 1; `pageSize` default 20 và clamp 1..100. `sizeCategory` được truyền vào query nhưng handler hiện **không dùng để lọc**. Ngày được coi là UTC+7 `[00:00, ngày kế)` rồi đổi UTC. Chỉ trip `SCHEDULED|BOARDING` đủ cả weight/volume.

`200` raw paged `{items:[{tripId,routeId,operatorId,operatorName,departureDateTime,availableCargoWeightKg,availableCargoVolumeM3}],page,pageSize,totalItems,totalPages,hasNextPage,hasPreviousPage}`. `422 VALIDATION_ERROR` cho weight/volume <=0; model-binding sai/thiếu trả 400.

```bash
curl -sS -G "$TRIP_INTERNAL_URL/internal/v1/trips/parcel-availability" -H "X-Internal-Auth: Bearer $INTERNAL_JWT" --data-urlencode "originStationId=11111111-1111-1111-1111-111111111111" --data-urlencode "destinationStationId=22222222-2222-2222-2222-222222222222" --data-urlencode "departureDate=2026-07-11" --data-urlencode "estimatedWeightKg=10" --data-urlencode "estimatedVolumeM3=0.1" --data-urlencode "sizeCategory=MEDIUM" --data-urlencode "page=1" --data-urlencode "pageSize=20"
```

```js
const p=new URLSearchParams({originStationId:'11111111-1111-1111-1111-111111111111',destinationStationId:'22222222-2222-2222-2222-222222222222',departureDate:'2026-07-11',estimatedWeightKg:'10',estimatedVolumeM3:'0.1',sizeCategory:'MEDIUM',page:'1',pageSize:'20'}); await internal(`/internal/v1/trips/parcel-availability?${p}`);
```

### 7.5 Tracking authorization — `GET /internal/v1/trips/{tripId}/tracking-authorization`

Query optional: `userId` UUID, `role` string, `operatorId` UUID. `200 ApiResponse<{allowed:boolean,scope:string|null,error:string|null}>`. Allowed khi: role DRIVER và user là driver; ASSISTANT và user là assistant; OPERATOR_ADMIN/OPERATOR_STAFF và operatorId khớp. Không khớp vẫn 200 với `{allowed:false,error:"ACCESS_DENIED"}`. `404 TRIP_NOT_FOUND`.

```bash
curl -sS -G "$TRIP_INTERNAL_URL/internal/v1/trips/11111111-1111-1111-1111-111111111111/tracking-authorization" -H "X-Internal-Auth: Bearer $INTERNAL_JWT" --data-urlencode "userId=77777777-7777-7777-7777-777777777777" --data-urlencode "role=DRIVER"
```

```js
await internal('/internal/v1/trips/11111111-1111-1111-1111-111111111111/tracking-authorization?userId=77777777-7777-7777-7777-777777777777&role=DRIVER');
```

### 7.6 Tracking route stops — `GET /internal/v1/trips/{tripId}/route-stops`

Không query/body. `200 ApiResponse<{stops:[{stopId,latitude,longitude,sequence,alertRecipientUserIds:string[],estimatedArrivalTime}]}>`; `404 TRIP_NOT_FOUND|STOP_NOT_FOUND`.

```bash
curl -sS -H "X-Internal-Auth: Bearer $INTERNAL_JWT" "$TRIP_INTERNAL_URL/internal/v1/trips/11111111-1111-1111-1111-111111111111/route-stops"
```

```js
await internal('/internal/v1/trips/11111111-1111-1111-1111-111111111111/route-stops');
```

### 7.7 Tracking geometry — `GET /internal/v1/trips/{tripId}/route-geometry`

Không query/body. `200 ApiResponse<{tripId,points:[{latitude,longitude}],alertRecipientUserIds:string[]}>`; `404 TRIP_NOT_FOUND|STOP_NOT_FOUND` (geometry invalid cũng được handler map thành `TRIP_NOT_FOUND`).

```bash
curl -sS -H "X-Internal-Auth: Bearer $INTERNAL_JWT" "$TRIP_INTERNAL_URL/internal/v1/trips/11111111-1111-1111-1111-111111111111/route-geometry"
```

```js
await internal('/internal/v1/trips/11111111-1111-1111-1111-111111111111/route-geometry');
```

### 7.8 Lock seats — `POST /internal/v1/trips/{tripId}/lock-seats`

Header `Idempotency-Key` bắt buộc. Body: `seatNumbers` non-empty array; mỗi string non-empty max 20; `holdOwnerId` UUID non-empty; `ttlSeconds` optional integer >0. **Code validator không đặt max TTL cho one-way lock.**

```json
{"seatNumbers":["A1","A2"],"holdOwnerId":"22222222-2222-2222-2222-222222222222","ttlSeconds":600}
```

`200 ApiResponse<{seatLockToken,lockedSeats,expiresAt}>`. Lỗi: 404 `TRIP_NOT_FOUND`; 409 `BOOKING_TRIP_NOT_BOOKABLE|IDEMPOTENCY_REQUEST_PENDING|IDEMPOTENCY_KEY_MISMATCH|BOOKING_SEAT_UNAVAILABLE`; 422 validation/missing key.

```bash
curl -sS -X POST "$TRIP_INTERNAL_URL/internal/v1/trips/11111111-1111-1111-1111-111111111111/lock-seats" -H "X-Internal-Auth: Bearer $INTERNAL_JWT" -H "Idempotency-Key: booking-222-lock" -H "Content-Type: application/json" --data '{"seatNumbers":["A1","A2"],"holdOwnerId":"22222222-2222-2222-2222-222222222222","ttlSeconds":600}'
```

```js
await internal('/internal/v1/trips/11111111-1111-1111-1111-111111111111/lock-seats',{method:'POST',idempotencyKey:'booking-222-lock',body:{seatNumbers:['A1','A2'],holdOwnerId:'22222222-2222-2222-2222-222222222222',ttlSeconds:600}});
```

### 7.9 Release seats — `POST /internal/v1/trips/{tripId}/release-seats`

Body `{seatLockToken:uuid,seatNumbers:string[]}`. Không có FluentValidator cho command/request trong source; repository/store quyết định no-op/behavior. Thành công `204`, không body. Controller chỉ khai báo 401; exception bất ngờ theo global 500. **⚠️ TODO: cần xác nhận thêm** behavior khi token/seat không tồn tại vì handler không phát sinh coded exception.

```bash
curl -i -X POST "$TRIP_INTERNAL_URL/internal/v1/trips/11111111-1111-1111-1111-111111111111/release-seats" -H "X-Internal-Auth: Bearer $INTERNAL_JWT" -H "Content-Type: application/json" --data '{"seatLockToken":"33333333-3333-3333-3333-333333333333","seatNumbers":["A1","A2"]}'
```

```js
await internal('/internal/v1/trips/11111111-1111-1111-1111-111111111111/release-seats',{method:'POST',body:{seatLockToken:'33333333-3333-3333-3333-333333333333',seatNumbers:['A1','A2']}});
```

### 7.10 Book seats — `POST /internal/v1/trips/{tripId}/book-seats`

Body `{seatLockToken:uuid,bookingId:uuid,passengerSeatAssignments:[{passengerId:uuid,seatNumber:string}]}`. Không FluentValidator riêng. Thành công `204`. Lỗi 404 `TRIP_NOT_FOUND`; 409 `BOOKING_SEAT_UNAVAILABLE` với field errors chứa seat number; 401.

```bash
curl -i -X POST "$TRIP_INTERNAL_URL/internal/v1/trips/11111111-1111-1111-1111-111111111111/book-seats" -H "X-Internal-Auth: Bearer $INTERNAL_JWT" -H "Content-Type: application/json" --data '{"seatLockToken":"33333333-3333-3333-3333-333333333333","bookingId":"44444444-4444-4444-4444-444444444444","passengerSeatAssignments":[{"passengerId":"55555555-5555-5555-5555-555555555555","seatNumber":"A1"}]}'
```

```js
await internal('/internal/v1/trips/11111111-1111-1111-1111-111111111111/book-seats',{method:'POST',body:{seatLockToken:'33333333-3333-3333-3333-333333333333',bookingId:'44444444-4444-4444-4444-444444444444',passengerSeatAssignments:[{passengerId:'55555555-5555-5555-5555-555555555555',seatNumber:'A1'}]}});
```

### 7.11 Cargo capacity — `GET /internal/v1/trips/{tripId}/cargo/capacity`

Không query/body. `200 ApiResponse<CargoCapacityDto>` như §6.10; `404 TRIP_NOT_FOUND`.

```bash
curl -sS -H "X-Internal-Auth: Bearer $INTERNAL_JWT" "$TRIP_INTERNAL_URL/internal/v1/trips/11111111-1111-1111-1111-111111111111/cargo/capacity"
```

```js
await internal('/internal/v1/trips/11111111-1111-1111-1111-111111111111/cargo/capacity');
```

### 7.12–7.15 Cargo mutations — reserve, remeasure, load, release

Endpoint:

- `POST /internal/v1/trips/{tripId}/cargo/reserve`
- `POST /internal/v1/trips/{tripId}/cargo/remeasure`
- `POST /internal/v1/trips/{tripId}/cargo/load`
- `POST /internal/v1/trips/{tripId}/cargo/release`

Tất cả yêu cầu `Idempotency-Key`. Body model giống nhau: `{parcelId:uuid,weightKg:number,volumeM3:number,allowCapacityOverflow:boolean,idempotencyKey:string|null}`. Field body `idempotencyKey` **không được controller dùng**; header mới có hiệu lực middleware. Release repository chỉ nhận tripId/parcelId nên weight/volume/allowOverflow trong body bị bỏ qua ở handler release, dù model binding vẫn nhận.

Thành công `200 ApiResponse<CargoCapacityDto>`. Lỗi chung: 404 `TRIP_NOT_FOUND`; 422 missing key, `VALIDATION_ERROR` khi repository ném out-of-range; reserve/remeasure/load có 409 `TRIP_CARGO_CAPACITY_EXCEEDED`. Controller không công bố 422 cho cargo nhưng filter thực tế có thể trả 422 như trên.

```json
{"parcelId":"22222222-2222-2222-2222-222222222222","weightKg":10.5,"volumeM3":0.1,"allowCapacityOverflow":false,"idempotencyKey":null}
```

```bash
curl -sS -X POST "$TRIP_INTERNAL_URL/internal/v1/trips/11111111-1111-1111-1111-111111111111/cargo/reserve" -H "X-Internal-Auth: Bearer $INTERNAL_JWT" -H "Idempotency-Key: parcel-222-reserve" -H "Content-Type: application/json" --data '{"parcelId":"22222222-2222-2222-2222-222222222222","weightKg":10.5,"volumeM3":0.1,"allowCapacityOverflow":false}'
curl -sS -X POST "$TRIP_INTERNAL_URL/internal/v1/trips/11111111-1111-1111-1111-111111111111/cargo/remeasure" -H "X-Internal-Auth: Bearer $INTERNAL_JWT" -H "Idempotency-Key: parcel-222-remeasure" -H "Content-Type: application/json" --data '{"parcelId":"22222222-2222-2222-2222-222222222222","weightKg":11,"volumeM3":0.12,"allowCapacityOverflow":false}'
curl -sS -X POST "$TRIP_INTERNAL_URL/internal/v1/trips/11111111-1111-1111-1111-111111111111/cargo/load" -H "X-Internal-Auth: Bearer $INTERNAL_JWT" -H "Idempotency-Key: parcel-222-load" -H "Content-Type: application/json" --data '{"parcelId":"22222222-2222-2222-2222-222222222222","weightKg":11,"volumeM3":0.12,"allowCapacityOverflow":false}'
curl -sS -X POST "$TRIP_INTERNAL_URL/internal/v1/trips/11111111-1111-1111-1111-111111111111/cargo/release" -H "X-Internal-Auth: Bearer $INTERNAL_JWT" -H "Idempotency-Key: parcel-222-release" -H "Content-Type: application/json" --data '{"parcelId":"22222222-2222-2222-2222-222222222222","weightKg":0,"volumeM3":0,"allowCapacityOverflow":false}'
```

```js
const cargo={parcelId:'22222222-2222-2222-2222-222222222222',weightKg:10.5,volumeM3:0.1,allowCapacityOverflow:false};
await internal('/internal/v1/trips/11111111-1111-1111-1111-111111111111/cargo/reserve',{method:'POST',idempotencyKey:'parcel-222-reserve',body:cargo});
await internal('/internal/v1/trips/11111111-1111-1111-1111-111111111111/cargo/remeasure',{method:'POST',idempotencyKey:'parcel-222-remeasure',body:{...cargo,weightKg:11,volumeM3:0.12}});
await internal('/internal/v1/trips/11111111-1111-1111-1111-111111111111/cargo/load',{method:'POST',idempotencyKey:'parcel-222-load',body:{...cargo,weightKg:11,volumeM3:0.12}});
await internal('/internal/v1/trips/11111111-1111-1111-1111-111111111111/cargo/release',{method:'POST',idempotencyKey:'parcel-222-release',body:{...cargo,weightKg:0,volumeM3:0}});
```

### 7.16 Lock ghế khứ hồi — `POST /internal/v1/trips/round-trip/lock-seats`

Header `Idempotency-Key` bắt buộc/nonblank (trim trước gửi handler). Body: outbound/return mỗi leg có UUID trip khác nhau và non-empty `seatNumbers` với từng string non-empty; `holdOwnerId` UUID; `ttlSeconds` optional integer `1..1800`.

```json
{"outbound":{"tripId":"11111111-1111-1111-1111-111111111111","seatNumbers":["A1"]},"return":{"tripId":"22222222-2222-2222-2222-222222222222","seatNumbers":["B1"]},"holdOwnerId":"33333333-3333-3333-3333-333333333333","ttlSeconds":600}
```

`200 ApiResponse<{outbound:{tripId,seatLockToken,lockedSeats,expiresAt},return:{...}}>`; 404 `TRIP_NOT_FOUND`; 409 `BOOKING_TRIP_NOT_BOOKABLE|BOOKING_SEAT_UNAVAILABLE`; 422 `VALIDATION_ERROR` (bao gồm hai leg cùng trip hoặc thiếu key).

```bash
curl -sS -X POST "$TRIP_INTERNAL_URL/internal/v1/trips/round-trip/lock-seats" -H "X-Internal-Auth: Bearer $INTERNAL_JWT" -H "Idempotency-Key: roundtrip-333" -H "Content-Type: application/json" --data '{"outbound":{"tripId":"11111111-1111-1111-1111-111111111111","seatNumbers":["A1"]},"return":{"tripId":"22222222-2222-2222-2222-222222222222","seatNumbers":["B1"]},"holdOwnerId":"33333333-3333-3333-3333-333333333333","ttlSeconds":600}'
```

```js
await internal('/internal/v1/trips/round-trip/lock-seats',{method:'POST',idempotencyKey:'roundtrip-333',body:{outbound:{tripId:'11111111-1111-1111-1111-111111111111',seatNumbers:['A1']},return:{tripId:'22222222-2222-2222-2222-222222222222',seatNumbers:['B1']},holdOwnerId:'33333333-3333-3333-3333-333333333333',ttlSeconds:600}});
```

## 8. Data schemas

Các JSON mẫu phía trên dùng giá trị minh họa nhưng giữ đúng field/type/nullable shape từ DTO. Bảng này là index để consumer không phải suy ra field từ prose.

### Pagination

| Field | Type | Ý nghĩa |
|---|---|---|
| `items` | array | Item của trang hiện tại |
| `page` | integer | Trang 1-based |
| `pageSize` | integer | Kích thước trang |
| `totalItems` | integer/int64 | Tổng item |
| `totalPages` | integer | Tổng trang |
| `hasNextPage` | boolean | Còn trang sau |
| `hasPreviousPage` | boolean | Có trang trước |

### Public/passenger DTO

| DTO | Field chính xác |
|---|---|
| `LocationDto` | `id:uuid`, `code:string`, `name:string`, `type:string`, `isActive:boolean`, `sortOrder:int`, `createdAt:date-time`, `updatedAt:date-time` |
| `StationSearchResult` | `id:uuid`, `name:string`, `locationId:uuid?`, `city:string`, `province:string`, `latitude:number`, `longitude:number`, `addressStreet:string?`, `supportsShuttle:boolean` |
| `SearchTripItem` | `tripId`, `operatorId`, `operatorName`, `routeId`, `departureDateTime`, `estimatedArrivalTime`, `originStation:{id,name}`, `destinationStation:{id,name}`, `availableSeats:int`, `baseFare:int64`, `allowAlongRoutePickup:boolean`, `allowAlongRouteDropoff:boolean` |
| `TripDetailDto` | `tripId`, `operatorId`, `routeId`, `vehicleId`, `status`, `departureDateTime`, `estimatedArrivalTime`, `baseFare`, `originStation`, `destinationStation`, `stops:TripStopDto[]`, `seatSummary`, `returnRouteId?`, `fareBreakdown` |
| Public `TripStopDto` | `stopId`, `orderIndex`, `allowPickup`, `allowDropoff`, `estimatedArrivalTime`, `distanceFromOriginKm?`, `fareFromThisStop?` |
| `TripFareBreakdownDto` | `baseFare:int64`, `stops:[{stopId,fareFromThisStop}]` |
| `TripSeatMapDto` | `tripId`, `vehicleType`, `seats:[{seatNumber,status,type,row,col,deck}]` |

### Operator DTO

| DTO | Field chính xác |
|---|---|
| `StopDto` | `id`, `operatorId`, `name`, `description?`, `latitude`, `longitude`, `address?`, `googlePlaceId?`, `isActive`, `createdAt`, `updatedAt`, `locationId?` |
| `RouteDto` | `id`, `operatorId`, `name`, `originStationId`, `destinationStationId`, `returnRouteId?`, `baseFare`, `totalDistanceKm?`, `estimatedDurationMinutes?`, `pathPolyline?`, `isActive`, `createdAt`, `updatedAt` |
| `RouteListItemDto` | như RouteDto nhưng không có `pathPolyline` |
| Operator `RouteStopDto` | `routeId`, `stopId`, `orderIndex`, `estimatedDurationFromOriginMinutes`, `distanceFromOriginKm?`, `allowPickup`, `allowDropoff`, `createdAt`, `updatedAt` |
| `RouteStopFareTemplateDto` | `id`, `routeId`, `stopId`, `fareFromThisStop`, `effectiveFrom`, `effectiveUntil?`, `createdAt`, `updatedAt` |
| `AlternativeRouteDto` | `id`, `routeId`, `name`, `description?`, `destinationStationId`, `totalDistanceKm?`, `estimatedDurationMinutes?`, `pathPolyline?`, `isActive`, `stops`, `createdAt`, `updatedAt` |
| `AlternativeRouteStopDto` | `alternativeRouteId`, `stopId`, `orderIndex`, `estimatedDurationFromOriginMinutes`, `distanceFromOriginKm?`, `createdAt`, `updatedAt` |
| `VehicleDto` | `id`, `operatorId`, `vehicleTypeId`, `licensePlate`, `seatLayoutJson?`, `totalSeats`, `maxCargoWeightKg?`, `maxCargoVolumeM3?`, `status`, `isActive`, `createdAt`, `updatedAt` |
| `VehicleTypeDto` | `id`, `code`, `displayName`, `estimatedPassengerLuggageKgPerSeat`, `defaultSeatCount`, `isSystemDefined`, `isActive`, `createdAt`, `updatedAt` |
| `DriverScheduleDto` | `id`, `operatorId`, `routeId`, `vehicleId?`, `driverUserId`, `assistantUserId?`, `dayOfWeek:int[]`, `departureTime`, `validFrom`, `validUntil?`, `isActive`, `createdAt`, `updatedAt` |
| `CargoCapacityDto` | `tripId`, `reservedWeightKg`, `reservedVolumeM3`, `loadedWeightKg`, `loadedVolumeM3`, `maxCargoWeightKg`, `maxCargoVolumeM3`, `availableWeightKg`, `availableVolumeM3`, `percentFull` |

### Enum/string values được code chứng minh

| Field | Values |
|---|---|
| Trip `status` | `SCHEDULED`, `BOARDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `DISRUPTED` |
| Seat `status` | `AVAILABLE`, `HELD`, `BOOKED`, `UNAVAILABLE` |
| Seat `type` | `STANDARD`, `SLEEPER_LOWER`, `SLEEPER_UPPER`, `VIP`, `DRIVER_AREA` |
| Trip stop `status` | `PENDING`, `ARRIVED`, `SKIPPED` |
| Vehicle `status` request/response | `ACTIVE`, `MAINTENANCE`, `OFF_DUTY`, `RETIRED` |
| Location `type` | `PROVINCE`, `MUNICIPALITY` |
| Driver schedule `dayOfWeek` | integer 1..7; source validator không ghi tên ngày tương ứng |

## 9. Error catalog và flow

### Error codes quan sát trực tiếp trong Trip/Gateway code

| HTTP | Code | Điều kiện |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | JSON/model binding sai kiểu/thiếu value bắt buộc |
| 400 | `INVALID_SORT_FIELD` | `sortBy` ngoài allow-list vehicle/vehicle-type |
| 401 | `AUTH_TOKEN_INVALID` | User/internal token thiếu, sai hoặc hết hạn |
| 401 | `UNAUTHORIZED` | `UnauthorizedAccessException`, ví dụ claim `sub` không parse được trong service |
| 403 | `FORBIDDEN` | Sai role, thiếu operator scope, ownership sai hoặc Identity từ chối |
| 403 | `AUTH_PHONE_REQUIRED` | Passenger chưa hoàn tất phone profile, do Gateway |
| 404 | `ROUTE_NOT_FOUND`, `STATION_NOT_FOUND`, `STOP_NOT_FOUND`, `LOCATION_NOT_FOUND`, `VEHICLE_NOT_FOUND`, `VEHICLE_TYPE_NOT_FOUND`, `TRIP_NOT_FOUND`, `TRIP_STOP_NOT_FOUND`, `RESOURCE_NOT_FOUND` | Aggregate/reference tương ứng không tồn tại hoặc bị tenant filter che |
| 404 | `ROUTE_NOT_FOUND` | Alternative route handler cũng dùng code này |
| 409 | `LOCATION_CODE_CONFLICT` | Trùng location code active/non-deleted |
| 409 | `TRIP_DRIVER_CONFLICT` | Driver có active schedule xung đột |
| 409 | `BOOKING_TRIP_NOT_BOOKABLE` | Trip status không cho lock |
| 409 | `BOOKING_SEAT_UNAVAILABLE` | Ghế không thể lock/book |
| 409 | `IDEMPOTENCY_REQUEST_PENDING`, `IDEMPOTENCY_KEY_MISMATCH` | Seat-lock idempotency conflict |
| 409 | `TRIP_CARGO_CAPACITY_EXCEEDED` | Cargo vượt capacity/domain rule |
| 409 | `INVALID_TRIP_STATUS`, `TRIP_STOP_ALREADY_FINALIZED` | Mark arrived không hợp lệ |
| 422 | `VALIDATION_ERROR` | FluentValidation/business field validation |
| 422 | `ALTERNATIVE_ROUTE_LIMIT_EXCEEDED` | Hơn 2 alternative route active |
| 422 | `ROUTE_STOP_FLAGS_INVALID`, `ROUTE_STOP_ORDER_CONFLICT` | Route stop flags/order sai |
| 422 | `ROUTE_GEOMETRY_TOO_LARGE`, `ROUTE_GEOMETRY_INVALID`, `ROUTE_GEOMETRY_STOP_MISMATCH` | Geometry không hợp lệ |
| 422 | `IDEMPOTENCY_KEY_MISMATCH` | Middleware key dùng lại với body khác |
| 429 | code từ `TooManyRequestsException` hoặc Gateway throttle | Rate limit; exact Gateway body cần xác nhận |
| 500 | `INTERNAL_ERROR` | Exception chưa được map |
| 502 | `UPSTREAM_UNAVAILABLE` | Gateway không kết nối được Trip |

Ngoài các code trên, handler substitute/disrupt có thể để domain exception đi tới `500 INTERNAL_ERROR`; tài liệu không tự đặt code 409 khi source không remap rõ.

### Flow khuyến nghị theo dependency thật

1. Public app tải `/v1/locations` và tìm station bằng `/v1/stations/search`.
2. Tìm trip bằng `/v1/trips/search`.
3. Sau đăng nhập, lấy `/v1/trips/{tripId}` và `/seat-map`.
4. Booking service (không phải FE) gọi internal lock ghế, tạo booking/payment, sau đó `book-seats`; khi hủy/timeout gọi `release-seats`.
5. Operator tạo station/stop → route → route stops/fare templates → vehicle → driver schedule. Trip được generate bởi background job; source không expose HTTP tạo trip trực tiếp.
6. Operation có `Idempotency-Key`: retry phải giữ nguyên key **và raw body**. Nếu client serialize body khác thứ tự/khoảng trắng, SHA-256 middleware khác và có thể bị mismatch dù JSON semantic giống nhau.

### Rà soát cuối

- Source có **17 controller / 57 HTTP action** và **2 health endpoint** được map trong `Program.cs`; bảng và phần chi tiết tài liệu phủ đủ **59/59** endpoint runtime.
- Method/path được đối chiếu với attributes controller và OpenAPI production.
- Request field lấy từ API request records/action params; rule lấy từ FluentValidation, manual handler validation, route constraints và idempotency filter.
- Response field lấy từ DTO records và OpenAPI schema production.
- Error code lấy từ Gateway/auth/filter/handler; điểm không chứng minh được đã đánh dấu `⚠️ TODO: cần xác nhận thêm` thay vì suy đoán.
