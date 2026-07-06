# API Tracking Service

## Mục lục

- [Nguồn kiểm tra](#nguồn-kiểm-tra)
- [Base URL](#base-url)
- [Xác thực chung](#xác-thực-chung)
- [Response envelope](#response-envelope)
- [Quy ước chung](#quy-ước-chung)
- [Tổng quan endpoint](#tổng-quan-endpoint)
- [Health](#health)
- [Readiness](#readiness)
- [Get latest trip location](#get-latest-trip-location)
- [Get trip GPS trail](#get-trip-gps-trail)
- [Get trip ETA](#get-trip-eta)
- [Realtime Socket.IO](#realtime-socketio)
- [Swagger / OpenAPI](#swagger--openapi)
- [Rà soát sau khi tạo](#rà-soát-sau-khi-tạo)

## Nguồn kiểm tra

Tài liệu này chỉ ghi nhận hành vi có trong source code local của Tracking service:

- `apps/tracking/src/main.ts`
- `apps/tracking/src/app/*.ts`
- `apps/tracking/src/config/env.schema.ts`
- `apps/tracking/src/auth/*.ts`
- `apps/tracking/src/authorization/*.ts`
- `apps/tracking/src/tracking-data/**/*.ts`
- `apps/tracking/src/location/**/*.ts`
- `libs/shared/nest-common/src/**/*.ts`
- `libs/shared/contracts/src/dtos/query-options.ts`
- `apps/gateway/src/config/routes.ts`
- `apps/gateway/src/config/env.schema.ts`
- `infra/docker/docker-compose.yml`
- `.env.example`

⚠️ TODO: cần xác nhận thêm Swagger production tại `https://api.vietride.online/docs` vì nguồn online không được fetch thành công trong lần rà soát này.

## Base URL

| Môi trường | REST qua Gateway | REST trực tiếp Tracking | Socket.IO | Nguồn |
|---|---|---|---|---|
| Production public | `https://api.vietride.online` | ⚠️ TODO: cần xác nhận thêm | `https://api.vietride.online` với path `/tracking/socket.io` nếu Nginx bật route này | User cung cấp URL Swagger; Nginx prod có route socket |
| Local Gateway | `http://localhost:3000` | N/A | N/A | `GATEWAY_PORT=3000`, `TRACKING_BASE_URL=http://tracking:3001` |
| Local direct service | N/A | `http://localhost:3001` | `http://localhost:3001` với path `/tracking/socket.io` | `PORT` default `3001`, `TRACKING_PORT=3001` |
| Docker network | `http://gateway:3000` | `http://tracking:3001` | `http://tracking:3001` với path `/tracking/socket.io` | `docker-compose.yml` |

Tracking service không gọi `app.setGlobalPrefix()`. Các route controller dùng path đầy đủ như `/v1/tracking/trips`.

## Xác thực chung

### User access token

Tracking REST và Socket.IO xác thực bằng User Access Token RS256 do Identity phát hành.

| Thuộc tính | Giá trị thực tế trong code |
|---|---|
| Header REST | `Authorization: Bearer <accessToken>` |
| Socket.IO auth | `auth: { "token": "<accessToken>" }` hoặc handshake header `Authorization: Bearer <accessToken>` |
| Algorithm | `RS256` |
| Issuer default | `vietride-identity` |
| Audience default | `vietride-api` |
| JWKS URL default | `http://identity:5001/v1/.well-known/jwks.json` |
| Local public key override | `USER_JWT_PUBLIC_KEY` nếu env có |
| Clock tolerance | 5 giây |
| Required claims | `sub`, `role` hoặc `roles` |
| Optional claim | `operatorId` |

Nếu token thiếu, sai format, invalid signature, sai issuer/audience, thiếu `sub`, hoặc thiếu role thì REST trả `401 UNAUTHORIZED`. Socket.IO connect bị reject với message `UNAUTHORIZED`.

### Tracking authorization theo trip

Sau khi verify token, Tracking gọi downstream authorization provider bằng internal JWT:

| User role | Downstream được gọi | Scope hợp lệ |
|---|---|---|
| `DRIVER` | Trip service | `DRIVER` |
| `ASSISTANT` | Trip service | `ASSISTANT` |
| `OPERATOR_ADMIN`, `OPERATOR_STAFF` | Trip service | `OPERATOR` |
| `PASSENGER` | Booking service, sau đó Parcel service nếu Booking không allow | `BOOKING_OWNER`, `PARCEL_SENDER`, `PARCEL_RECIPIENT` |
| Role khác | Không gọi downstream | `ACCESS_DENIED` |

Internal JWT downstream dùng header:

```http
X-Internal-Auth: Bearer <hs256-internal-jwt>
```

Env liên quan:

| Env | Default |
|---|---|
| `INTERNAL_JWT_SECRET` | optional trong Tracking env, nhưng signer sẽ lỗi nếu dùng mà thiếu hoặc dưới 32 ký tự |
| `INTERNAL_JWT_TTL_SEC` | `120` |
| `TRIP_SERVICE_BASE_URL` | `http://trip:5002` |
| `BOOKING_SERVICE_BASE_URL` | `http://booking:5003` |
| `PARCEL_SERVICE_BASE_URL` | `http://parcel:5005` |
| `TRIP_TRACKING_AUTH_PATH` | `/internal/v1/trips/:tripId/tracking-authorization` |
| `BOOKING_TRACKING_AUTH_PATH` | `/internal/v1/trips/:tripId/tracking-authorization/bookings` |
| `PARCEL_TRACKING_AUTH_PATH` | `/internal/v1/trips/:tripId/tracking-authorization/parcels` |
| `TRACKING_AUTH_HTTP_TIMEOUT_MS` | `2000` |

## Response envelope

HTTP success được global `ApiResponseInterceptor` wrap:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "meta": {
    "traceId": "req-a1b2c3d4",
    "timestamp": "2026-06-19T12:00:00.000Z"
  }
}
```

HTTP error được global `ApiResponseExceptionFilter` wrap:

```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "fields": [
      {
        "field": "tripId",
        "message": "Invalid uuid"
      }
    ]
  },
  "meta": {
    "traceId": "req-a1b2c3d4",
    "timestamp": "2026-06-19T12:00:00.000Z"
  }
}
```

`traceId` lấy từ header `x-request-id` nếu có; nếu không middleware sinh UUID và echo lại response header `X-Request-Id`.

## Quy ước chung

| Quy ước | Giá trị |
|---|---|
| Date-time | ISO 8601 string, Zod `z.string().datetime()` |
| UUID | Zod `z.string().uuid()` |
| REST auth fail | `401`, `error.code = UNAUTHORIZED` |
| Validation fail do Zod pipe | `400`, `error.code = VALIDATION_FAILED` |
| Unexpected error | `500`, `error.code = INTERNAL_ERROR` nếu không có `errorCode` riêng |
| Rate limit | Tracking service không wire throttler trong `AppModule`; Gateway env có default `RATE_LIMIT_DEFAULT_PER_MIN=120`, nhưng route-level behavior cần xác nhận ở Gateway runtime |
| Idempotency-Key | Không áp dụng cho các REST GET của Tracking; Socket.IO `gps:update` không đọc `Idempotency-Key` |
| CORS Socket.IO | `TRACKING_CORS_ORIGIN`, default `*`; production sẽ crash startup nếu `NODE_ENV=production` và origin vẫn là `*` |

## Tổng quan endpoint

| Method / Protocol | Path | Mô tả ngắn |
|---|---|---|
| `GET` | `/health` | Liveness probe của Tracking service |
| `GET` | `/ready` | Readiness probe kiểm tra Prisma, Redis, RabbitMQ |
| `GET` | `/v1/tracking/trips/:tripId/latest` | Lấy vị trí mới nhất của trip từ Redis |
| `GET` | `/v1/tracking/trips/:tripId/trail` | Lấy GPS trail từ Postgres có phân trang |
| `GET` | `/v1/tracking/trips/:tripId/eta` | Lấy ETA theo stop từ Redis |
| Socket.IO | `/tracking/socket.io`, event `joinTripTracking` | Join room tracking của trip |
| Socket.IO | `/tracking/socket.io`, event `gps:update` | Driver/assistant gửi GPS update realtime |
| Socket.IO broadcast | `gps:update` | Server broadcast GPS update vào room `trip:<tripId>` |
| Socket.IO broadcast | `eta:update` | Server broadcast ETA update nếu ETA engine trả update |
| Socket.IO broadcast | `trip:statusChanged` | Server broadcast khi trip delay detection đánh dấu delayed |
| `GET` | `/docs` | Swagger UI trực tiếp trên Tracking service |
| `GET` | `/docs-json` | OpenAPI JSON trực tiếp trên Tracking service |
| `GET` | `/api-specs/tracking` | Gateway proxy tới Tracking `/docs-json` |

## Health

### 1. Tên chức năng

Tracking liveness probe.

### 2. Method + Full URL

```http
GET http://localhost:3001/health
GET https://api.vietride.online/health
```

### 3. Mô tả

Kiểm tra process Tracking còn sống. Endpoint không kiểm tra dependency.

### 4. Headers bắt buộc

Không có.

### 5. Path Params

Không có.

### 6. Query Params

Không có.

### 7. Request Body

Không có.

### 8. Response thành công

HTTP status: `200`.

Do global interceptor, response thực tế là envelope:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "status": "ok",
    "service": "tracking"
  },
  "meta": {
    "traceId": "req-a1b2c3d4",
    "timestamp": "2026-06-19T12:00:00.000Z"
  }
}
```

| Field | Kiểu | Mô tả |
|---|---|---|
| `data.status` | string | Luôn là `ok` |
| `data.service` | string | Luôn là `tracking` |

### 9. Response lỗi

Không có lỗi domain riêng trong controller. Nếu lỗi ngoài dự kiến:

```json
{
  "success": false,
  "statusCode": 500,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Unexpected error"
  },
  "meta": {
    "traceId": "req-a1b2c3d4",
    "timestamp": "2026-06-19T12:00:00.000Z"
  }
}
```

### 10. Ví dụ gọi thực tế

```bash
curl -i "http://localhost:3001/health"
```

```js
const res = await fetch('http://localhost:3001/health');
const body = await res.json();
console.log(body);
```

### 11. Lưu ý đặc biệt

Endpoint này không cần token và không kiểm tra DB/Redis/RabbitMQ.

## Readiness

### 1. Tên chức năng

Tracking readiness probe.

### 2. Method + Full URL

```http
GET http://localhost:3001/ready
```

### 3. Mô tả

Kiểm tra Tracking có kết nối được Prisma/Postgres, Redis và RabbitMQ hay không.

### 4. Headers bắt buộc

Không có.

### 5. Path Params

Không có.

### 6. Query Params

Không có.

### 7. Request Body

Không có.

### 8. Response thành công

HTTP status: `200`.

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "status": "ok",
    "service": "tracking",
    "dependencies": {
      "prisma": "ok",
      "redis": "ok",
      "rabbitmq": "ok"
    }
  },
  "meta": {
    "traceId": "req-a1b2c3d4",
    "timestamp": "2026-06-19T12:00:00.000Z"
  }
}
```

| Field | Kiểu | Mô tả |
|---|---|---|
| `data.status` | string | Luôn là `ok` nếu ready |
| `data.service` | string | Luôn là `tracking` |
| `data.dependencies.prisma` | string | `ok` nếu `$queryRaw SELECT 1` thành công |
| `data.dependencies.redis` | string | `ok` nếu Redis `PING` thành công |
| `data.dependencies.rabbitmq` | string | `ok` nếu tạo và đóng RabbitMQ channel thành công |

### 9. Response lỗi

| HTTP | `error.code` | Nguyên nhân trong code |
|---|---|---|
| `503` | `TRACKING_DEPENDENCY_UNAVAILABLE` | Prisma, Redis hoặc RabbitMQ readiness check fail |
| `500` | `INTERNAL_ERROR` | Lỗi ngoài dự kiến |

```json
{
  "success": false,
  "statusCode": 503,
  "error": {
    "code": "TRACKING_DEPENDENCY_UNAVAILABLE",
    "message": "Tracking dependency readiness check failed"
  },
  "meta": {
    "traceId": "req-a1b2c3d4",
    "timestamp": "2026-06-19T12:00:00.000Z"
  }
}
```

### 10. Ví dụ gọi thực tế

```bash
curl -i "http://localhost:3001/ready"
```

```js
const res = await fetch('http://localhost:3001/ready');
const body = await res.json();
console.log(body);
```

### 11. Lưu ý đặc biệt

Endpoint này không cần token.

## Get latest trip location

### 1. Tên chức năng

Lấy vị trí mới nhất của một trip.

### 2. Method + Full URL

```http
GET https://api.vietride.online/v1/tracking/trips/:tripId/latest
GET http://localhost:3000/v1/tracking/trips/:tripId/latest
GET http://localhost:3001/v1/tracking/trips/:tripId/latest
```

### 3. Mô tả

Đọc Redis key `tracking:latest:<tripId>`, parse bằng `UpdateLocationSchema`, và trả về vị trí mới nhất. Nếu Redis không có key, JSON hỏng hoặc payload không pass schema thì trả `latest: null`.

### 4. Headers bắt buộc

| Header | Bắt buộc | Mô tả |
|---|---:|---|
| `Authorization` | Có | `Bearer <accessToken>` |
| `x-request-id` | Không | Nếu có sẽ được dùng làm `meta.traceId` và response header `X-Request-Id` |

### 5. Path Params

| Tên | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `tripId` | string | Có | UUID |

### 6. Query Params

Không có.

### 7. Request Body

Không có.

### 8. Response thành công

HTTP status: `200`.

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "latest": {
      "tripId": "11111111-1111-4111-8111-111111111111",
      "latitude": 10.762622,
      "longitude": 106.660172,
      "speedKmh": 42,
      "headingDeg": 90,
      "recordedAt": "2026-06-03T10:00:00.000Z"
    }
  },
  "meta": {
    "traceId": "req-a1b2c3d4",
    "timestamp": "2026-06-19T12:00:00.000Z"
  }
}
```

Nếu chưa có vị trí hợp lệ:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "latest": null
  },
  "meta": {
    "traceId": "req-a1b2c3d4",
    "timestamp": "2026-06-19T12:00:00.000Z"
  }
}
```

| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---:|---|
| `data.latest` | object/null | Có | Vị trí mới nhất hoặc `null` |
| `data.latest.tripId` | string | Có nếu `latest != null` | UUID trip |
| `data.latest.latitude` | number | Có nếu `latest != null` | `-90 <= latitude <= 90` |
| `data.latest.longitude` | number | Có nếu `latest != null` | `-180 <= longitude <= 180` |
| `data.latest.speedKmh` | number | Không | `>= 0` |
| `data.latest.headingDeg` | number | Không | `0 <= headingDeg <= 360` |
| `data.latest.recordedAt` | string | Có nếu `latest != null` | ISO 8601 datetime |

### 9. Response lỗi

| HTTP | `error.code` | Nguyên nhân trong code |
|---|---|---|
| `400` | `VALIDATION_FAILED` | `tripId` không phải UUID |
| `401` | `UNAUTHORIZED` | Thiếu bearer token hoặc token invalid |
| `403` | `ACCESS_DENIED` hoặc lỗi authorization khác từ adapter | User không có quyền xem trip |
| `404` | `TRIP_NOT_FOUND` | Downstream authorization provider báo trip không tồn tại |
| `503` | `TRACKING_AUTH_UNAVAILABLE` | Downstream authorization provider timeout, 401, 5xx hoặc response không parse được |
| `500` | `INTERNAL_ERROR` | Lỗi ngoài dự kiến, ví dụ Redis client throw |

```json
{
  "success": false,
  "statusCode": 401,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing bearer token"
  },
  "meta": {
    "traceId": "req-a1b2c3d4",
    "timestamp": "2026-06-19T12:00:00.000Z"
  }
}
```

### 10. Ví dụ gọi thực tế

```bash
curl -i \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-request-id: req-demo-latest" \
  "https://api.vietride.online/v1/tracking/trips/11111111-1111-4111-8111-111111111111/latest"
```

```js
const accessToken = process.env.ACCESS_TOKEN;
const tripId = '11111111-1111-4111-8111-111111111111';

const res = await fetch(`https://api.vietride.online/v1/tracking/trips/${tripId}/latest`, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'x-request-id': 'req-demo-latest',
  },
});

const body = await res.json();
console.log(body);
```

### 11. Lưu ý đặc biệt

GPS latest được ghi bởi Socket.IO `gps:update` vào Redis với TTL 300 giây.

## Get trip GPS trail

### 1. Tên chức năng

Lấy lịch sử GPS trail của một trip.

### 2. Method + Full URL

```http
GET https://api.vietride.online/v1/tracking/trips/:tripId/trail
GET http://localhost:3000/v1/tracking/trips/:tripId/trail
GET http://localhost:3001/v1/tracking/trips/:tripId/trail
```

### 3. Mô tả

Đọc bảng `gpsTrail` qua Prisma, filter theo `tripId`, optional `from`/`to`, sort theo `recordedAt`, và trả kết quả phân trang.

### 4. Headers bắt buộc

| Header | Bắt buộc | Mô tả |
|---|---:|---|
| `Authorization` | Có | `Bearer <accessToken>` |
| `x-request-id` | Không | Correlation id |

### 5. Path Params

| Tên | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `tripId` | string | Có | UUID |

### 6. Query Params

| Tên | Kiểu | Bắt buộc | Default | Validation / xử lý |
|---|---|---:|---|---|
| `from` | string | Không | Không có | ISO 8601 datetime |
| `to` | string | Không | Không có | ISO 8601 datetime |
| `page` | number | Không | `1` | Coerce number, integer, min `1` |
| `pageSize` | number | Không | `20` | Coerce number, integer, transform clamp `1..100` |
| `sortBy` | string enum | Không | `recordedAt` | Chỉ nhận `recordedAt` |
| `sortDir` | string enum | Không | `asc` | `asc` hoặc `desc` |

Rule bổ sung: nếu cả `from` và `to` cùng có thì `from <= to`; nếu sai trả validation error message `from must be before or equal to to`.

### 7. Request Body

Không có.

### 8. Response thành công

HTTP status: `200`.

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": "55555555-5555-4555-8555-555555555555",
        "tripId": "11111111-1111-4111-8111-111111111111",
        "latitude": 10.762622,
        "longitude": 106.660172,
        "speedKmh": 40,
        "headingDeg": 89,
        "recordedAt": "2026-06-03T10:00:00.000Z"
      },
      {
        "id": "66666666-6666-4666-8666-666666666666",
        "tripId": "11111111-1111-4111-8111-111111111111",
        "latitude": 10.763,
        "longitude": 106.661,
        "recordedAt": "2026-06-03T10:05:00.000Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "totalItems": 2,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "meta": {
    "traceId": "req-a1b2c3d4",
    "timestamp": "2026-06-19T12:00:00.000Z"
  }
}
```

| Field | Kiểu | Bắt buộc | Mô tả |
|---|---|---:|---|
| `data.items` | array | Có | Danh sách GPS points |
| `data.items[].id` | string | Có | ID row GPS trail |
| `data.items[].tripId` | string | Có | UUID trip |
| `data.items[].latitude` | number | Có | Latitude |
| `data.items[].longitude` | number | Có | Longitude |
| `data.items[].speedKmh` | number | Không | Omit nếu DB `NULL` |
| `data.items[].headingDeg` | number | Không | Omit nếu DB `NULL` |
| `data.items[].recordedAt` | string | Có | ISO datetime |
| `data.page` | number | Có | Page hiện tại sau parse |
| `data.pageSize` | number | Có | Page size sau clamp |
| `data.totalItems` | number | Có | Tổng số row match filter |
| `data.totalPages` | number | Có | `Math.ceil(totalItems / pageSize)` |
| `data.hasNextPage` | boolean | Có | `page < totalPages` |
| `data.hasPreviousPage` | boolean | Có | `page > 1` |

### 9. Response lỗi

| HTTP | `error.code` | Nguyên nhân trong code |
|---|---|---|
| `400` | `VALIDATION_FAILED` | `tripId`, `from`, `to`, `sortBy`, `sortDir`, `page` invalid hoặc `from > to` |
| `401` | `UNAUTHORIZED` | Thiếu bearer token hoặc token invalid |
| `403` | `ACCESS_DENIED` hoặc lỗi authorization khác từ adapter | User không có quyền xem trip |
| `404` | `TRIP_NOT_FOUND` | Downstream authorization provider báo trip không tồn tại |
| `503` | `TRACKING_AUTH_UNAVAILABLE` | Downstream authorization provider unavailable |
| `500` | `INTERNAL_ERROR` | Lỗi ngoài dự kiến, ví dụ Prisma query fail |

### 10. Ví dụ gọi thực tế

```bash
curl -i \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://api.vietride.online/v1/tracking/trips/11111111-1111-4111-8111-111111111111/trail?from=2026-06-03T09%3A00%3A00.000Z&to=2026-06-03T11%3A00%3A00.000Z&page=1&pageSize=20&sortBy=recordedAt&sortDir=asc"
```

```js
const accessToken = process.env.ACCESS_TOKEN;
const tripId = '11111111-1111-4111-8111-111111111111';
const url = new URL(`https://api.vietride.online/v1/tracking/trips/${tripId}/trail`);
url.searchParams.set('from', '2026-06-03T09:00:00.000Z');
url.searchParams.set('to', '2026-06-03T11:00:00.000Z');
url.searchParams.set('page', '1');
url.searchParams.set('pageSize', '20');
url.searchParams.set('sortBy', 'recordedAt');
url.searchParams.set('sortDir', 'asc');

const res = await fetch(url, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

const body = await res.json();
console.log(body);
```

### 11. Lưu ý đặc biệt

`pageSize=0` hoặc số âm không lỗi sau transform; schema clamp về tối thiểu `1`. `pageSize > 100` clamp về `100`.

## Get trip ETA

### 1. Tên chức năng

Lấy ETA của trip tới một stop.

### 2. Method + Full URL

```http
GET https://api.vietride.online/v1/tracking/trips/:tripId/eta?stopId=:stopId
GET http://localhost:3000/v1/tracking/trips/:tripId/eta?stopId=:stopId
GET http://localhost:3001/v1/tracking/trips/:tripId/eta?stopId=:stopId
```

### 3. Mô tả

Đọc Redis key `tracking:eta:<tripId>:<stopId>`, parse bằng `EtaResponseSchema`, và trả về ETA. Nếu Redis không có key, JSON hỏng hoặc payload không pass schema thì trả `eta: null`.

### 4. Headers bắt buộc

| Header | Bắt buộc | Mô tả |
|---|---:|---|
| `Authorization` | Có | `Bearer <accessToken>` |
| `x-request-id` | Không | Correlation id |

### 5. Path Params

| Tên | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `tripId` | string | Có | UUID |

### 6. Query Params

| Tên | Kiểu | Bắt buộc | Default | Validation |
|---|---|---:|---|---|
| `stopId` | string | Có | Không có | UUID |

### 7. Request Body

Không có.

### 8. Response thành công

HTTP status: `200`.

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "eta": {
      "tripId": "11111111-1111-4111-8111-111111111111",
      "stopId": "22222222-2222-4222-8222-222222222222",
      "etaMinutes": 12,
      "estimatedArrivalTime": "2026-06-03T10:13:00.000Z",
      "distanceMeters": 8500,
      "updatedAt": "2026-06-03T10:01:00.000Z"
    }
  },
  "meta": {
    "traceId": "req-a1b2c3d4",
    "timestamp": "2026-06-19T12:00:00.000Z"
  }
}
```

Nếu chưa có ETA hợp lệ:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "eta": null
  },
  "meta": {
    "traceId": "req-a1b2c3d4",
    "timestamp": "2026-06-19T12:00:00.000Z"
  }
}
```

| Field | Kiểu | Bắt buộc | Validation nguồn |
|---|---|---:|---|
| `data.eta` | object/null | Có | `null` nếu không có cache hợp lệ |
| `data.eta.tripId` | string | Có nếu `eta != null` | UUID |
| `data.eta.stopId` | string | Có nếu `eta != null` | UUID |
| `data.eta.etaMinutes` | number | Có nếu `eta != null` | integer positive |
| `data.eta.estimatedArrivalTime` | string | Có nếu `eta != null` | ISO datetime |
| `data.eta.distanceMeters` | number | Có nếu `eta != null` | integer nonnegative |
| `data.eta.updatedAt` | string | Có nếu `eta != null` | ISO datetime |

### 9. Response lỗi

| HTTP | `error.code` | Nguyên nhân trong code |
|---|---|---|
| `400` | `VALIDATION_FAILED` | `tripId` hoặc `stopId` không phải UUID; thiếu `stopId` |
| `401` | `UNAUTHORIZED` | Thiếu bearer token hoặc token invalid |
| `403` | `ACCESS_DENIED` hoặc lỗi authorization khác từ adapter | User không có quyền xem trip |
| `404` | `TRIP_NOT_FOUND` | Downstream authorization provider báo trip không tồn tại |
| `503` | `TRACKING_AUTH_UNAVAILABLE` | Downstream authorization provider unavailable |
| `500` | `INTERNAL_ERROR` | Lỗi ngoài dự kiến, ví dụ Redis client throw |

### 10. Ví dụ gọi thực tế

```bash
curl -i \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://api.vietride.online/v1/tracking/trips/11111111-1111-4111-8111-111111111111/eta?stopId=22222222-2222-4222-8222-222222222222"
```

```js
const accessToken = process.env.ACCESS_TOKEN;
const tripId = '11111111-1111-4111-8111-111111111111';
const stopId = '22222222-2222-4222-8222-222222222222';

const res = await fetch(`https://api.vietride.online/v1/tracking/trips/${tripId}/eta?stopId=${stopId}`, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

const body = await res.json();
console.log(body);
```

### 11. Lưu ý đặc biệt

ETA cache được cập nhật bởi detection chain sau `gps:update`; nếu chưa có cache thì API vẫn trả `200` với `eta: null`.

## Realtime Socket.IO

### Kết nối Socket.IO

#### 1. Tên chức năng

Kết nối realtime Tracking.

#### 2. Method + Full URL

```text
Socket.IO websocket path: /tracking/socket.io
Local direct: http://localhost:3001
Production public: https://api.vietride.online
```

Gateway source ghi chú `/tracking/socket.io/*` không đi qua Gateway route table; Nginx proxy direct tới `tracking:3001`.

#### 3. Mô tả

Socket.IO gateway dùng path `/tracking/socket.io`. Middleware handshake verify User Access Token trước khi cho connect.

#### 4. Headers / auth bắt buộc

| Cách truyền token | Bắt buộc | Mô tả |
|---|---:|---|
| `auth.token` | Có, nếu không dùng header | Access token raw, không kèm `Bearer ` |
| `Authorization` header | Có, nếu không dùng `auth.token` | `Bearer <accessToken>` |

#### 5. Path Params

Không có.

#### 6. Query Params

Socket.IO tự dùng query nội bộ. Code Tracking không đọc query params nghiệp vụ.

#### 7. Request Body

Không có body HTTP. Payload nằm trong từng event.

#### 8. Response thành công

Socket connected.

#### 9. Response lỗi

| Giai đoạn | Error | Nguyên nhân |
|---|---|---|
| `connect_error` | `UNAUTHORIZED` | Thiếu token hoặc token invalid |

#### 10. Ví dụ gọi thực tế

`curl` không phù hợp để test Socket.IO websocket protocol đầy đủ. Có thể kiểm tra HTTP handshake path tồn tại, nhưng không thay thế Socket.IO client:

```bash
curl -i "http://localhost:3001/tracking/socket.io/?EIO=4&transport=polling"
```

```js
import { io } from 'socket.io-client';

const socket = io('https://api.vietride.online', {
  path: '/tracking/socket.io',
  auth: {
    token: process.env.ACCESS_TOKEN,
  },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('connected', socket.id);
});

socket.on('connect_error', (error) => {
  console.error(error.message);
});
```

#### 11. Lưu ý đặc biệt

Production `TRACKING_CORS_ORIGIN` không được là `*`; nếu không app crash khi startup.

### Event: joinTripTracking

#### 1. Tên chức năng

Join room theo trip để nhận tracking realtime.

#### 2. Method + Full URL

```text
Socket.IO emit event joinTripTracking trên path /tracking/socket.io
```

#### 3. Mô tả

Validate `tripId`, kiểm tra quyền tracking qua downstream authorization provider, sau đó join room `trip:<tripId>`.

#### 4. Headers bắt buộc

Token đã bắt buộc ở bước connect.

#### 5. Path Params

Không có.

#### 6. Query Params

Không có.

#### 7. Request Body

```json
{
  "tripId": "11111111-1111-4111-8111-111111111111"
}
```

| Field | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `tripId` | string | Có | UUID |

#### 8. Response thành công

Ack:

```json
{
  "success": true,
  "tripId": "11111111-1111-4111-8111-111111111111",
  "room": "trip:11111111-1111-4111-8111-111111111111",
  "scope": "BOOKING_OWNER"
}
```

| Field | Kiểu | Mô tả |
|---|---|---|
| `success` | boolean | `true` |
| `tripId` | string | Trip đã join |
| `room` | string | `trip:<tripId>` |
| `scope` | string | Scope từ authorization adapter |

#### 9. Response lỗi

| Ack `error` | Nguyên nhân |
|---|---|
| `VALIDATION_ERROR` | Payload không pass schema, message là `Invalid tripId` |
| `UNAUTHORIZED` | Socket không có `socket.data.user` |
| `TRIP_NOT_FOUND` | Authorization provider báo trip không tồn tại |
| `ACCESS_DENIED` | User không có quyền hoặc scope thiếu |
| `TRACKING_AUTH_UNAVAILABLE` | Authorization provider unavailable |

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid tripId"
}
```

#### 10. Ví dụ gọi thực tế

```bash
curl -i "http://localhost:3001/tracking/socket.io/?EIO=4&transport=polling"
```

```js
const ack = await socket.timeout(5000).emitWithAck('joinTripTracking', {
  tripId: '11111111-1111-4111-8111-111111111111',
});

console.log(ack);
```

#### 11. Lưu ý đặc biệt

Passenger có thể được allow qua Booking hoặc Parcel. Driver/assistant/operator đi qua Trip authorization.

### Event: gps:update

#### 1. Tên chức năng

Gửi GPS update realtime.

#### 2. Method + Full URL

```text
Socket.IO emit event gps:update trên path /tracking/socket.io
```

#### 3. Mô tả

Chỉ `DRIVER` hoặc `ASSISTANT` được gửi. Tracking validate payload, kiểm tra quyền trip, ghi latest vào Redis, push buffer GPS, đánh dấu active trip, broadcast `gps:update` cho room `trip:<tripId>`, rồi chạy detection chain async.

#### 4. Headers bắt buộc

Token đã bắt buộc ở bước connect.

#### 5. Path Params

Không có.

#### 6. Query Params

Không có.

#### 7. Request Body

```json
{
  "tripId": "11111111-1111-4111-8111-111111111111",
  "latitude": 10.762622,
  "longitude": 106.660172,
  "speedKmh": 42,
  "headingDeg": 90,
  "recordedAt": "2026-06-03T10:00:00.000Z"
}
```

| Field | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `tripId` | string | Có | UUID |
| `latitude` | number | Có | min `-90`, max `90` |
| `longitude` | number | Có | min `-180`, max `180` |
| `speedKmh` | number | Không | min `0` |
| `headingDeg` | number | Không | min `0`, max `360` |
| `recordedAt` | string | Có | ISO 8601 datetime |

#### 8. Response thành công

Ack:

```json
{
  "success": true
}
```

Broadcast `gps:update` tới room:

```json
{
  "tripId": "11111111-1111-4111-8111-111111111111",
  "latitude": 10.762622,
  "longitude": 106.660172,
  "speedKmh": 42,
  "headingDeg": 90,
  "recordedAt": "2026-06-03T10:00:00.000Z"
}
```

Nếu ETA engine trả update, server broadcast `eta:update`:

```json
{
  "tripId": "11111111-1111-4111-8111-111111111111",
  "stopId": "44444444-4444-4444-8444-444444444444",
  "etaMinutes": 12,
  "estimatedArrivalTime": "2026-06-03T10:12:00.000Z",
  "distanceMeters": 8000,
  "updatedAt": "2026-06-03T10:00:01.000Z",
  "delayed": false
}
```

Nếu delay detection đánh dấu delayed, server broadcast `trip:statusChanged`:

```json
{
  "tripId": "11111111-1111-4111-8111-111111111111",
  "stopId": "44444444-4444-4444-8444-444444444444",
  "status": "DELAYED",
  "delayMinutes": 35,
  "updatedAt": "2026-06-03T10:00:01.000Z"
}
```

#### 9. Response lỗi

| Ack `error` | Nguyên nhân |
|---|---|
| `VALIDATION_ERROR` | Payload invalid, message là `Invalid GPS payload` |
| `UNAUTHORIZED` | Socket không có `socket.data.user` |
| `ACCESS_DENIED` | Role không phải `DRIVER`/`ASSISTANT`, hoặc authorization scope không phải `DRIVER`/`ASSISTANT` |
| `TRIP_NOT_FOUND` | Authorization provider báo trip không tồn tại |
| `TRACKING_AUTH_UNAVAILABLE` | Authorization provider unavailable |
| `TRACKING_UNAVAILABLE` | Redis write fail trong `LocationService.recordLocation()` |

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid GPS payload"
}
```

#### 10. Ví dụ gọi thực tế

```bash
curl -i "http://localhost:3001/tracking/socket.io/?EIO=4&transport=polling"
```

```js
socket.on('gps:update', (event) => {
  console.log('gps update', event);
});

socket.on('eta:update', (event) => {
  console.log('eta update', event);
});

socket.on('trip:statusChanged', (event) => {
  console.log('trip status changed', event);
});

const ack = await socket.timeout(5000).emitWithAck('gps:update', {
  tripId: '11111111-1111-4111-8111-111111111111',
  latitude: 10.762622,
  longitude: 106.660172,
  speedKmh: 42,
  headingDeg: 90,
  recordedAt: new Date().toISOString(),
});

console.log(ack);
```

#### 11. Lưu ý đặc biệt

Ack `success: true` trả về sau khi Redis write thành công. Detection chain chạy async sau ack; lỗi detection chain chỉ log, không đổi ack đã trả.

## Swagger / OpenAPI

| URL | Mô tả | Auth |
|---|---|---|
| `http://localhost:3001/docs` | Swagger UI trực tiếp Tracking | Không thấy guard trong code |
| `http://localhost:3001/docs-json` | OpenAPI JSON trực tiếp Tracking | Không thấy guard trong code |
| `http://localhost:3000/api-specs/tracking` | Gateway proxy tới `/docs-json` | `authRequired: none` |
| `https://api.vietride.online/docs` | Swagger production theo URL user cung cấp | ⚠️ TODO: cần xác nhận thêm route production trỏ tới aggregate docs hay service docs |

`TRACKING_SWAGGER_ENABLED` có trong env schema nhưng `main.ts` hiện không dùng biến này; Swagger luôn được setup.

## Rà soát sau khi tạo

Đã rà soát source và đối chiếu:

- Controller REST chỉ có 3 endpoint Tracking data: `latest`, `trail`, `eta`.
- App controller có 2 endpoint health: `/health`, `/ready`.
- Socket gateway chỉ có 2 incoming events: `joinTripTracking`, `gps:update`.
- Socket gateway có 3 outgoing broadcasts có trong code: `gps:update`, `eta:update`, `trip:statusChanged`.
- Tất cả validation rules trong tài liệu lấy từ Zod schemas: `TripIdParamSchema`, `TrailQuerySchema`, `EtaQuerySchema`, `JoinTripTrackingSchema`, `UpdateLocationSchema`, `EtaResponseSchema`, `QueryOptionsSchema`.
- Response envelope lấy từ `ApiResponseInterceptor` và `ApiResponseExceptionFilter`.
- Error codes liệt kê từ guard, readiness service, socket gateway, authorization adapter và global fallback filter.
- Không đưa field nào không thấy trong DTO/schema/service/test.
