# VietRide Notification API Documentation

Tài liệu này được rà soát từ source code hiện tại của Notification service, Gateway route table, DTO Zod, guard xác thực, Prisma schema và shared `ApiResponse` filter/interceptor. Chỉ mô tả hành vi có trong code.

## Table of Contents

1. [Base URL](#base-url)
2. [Cơ Chế Xác Thực Chung](#cơ-chế-xác-thực-chung)
3. [Response Envelope Chung](#response-envelope-chung)
4. [Quy Ước Chung](#quy-ước-chung)
5. [Tổng Quan Endpoint](#tổng-quan-endpoint)
6. [Chi Tiết Endpoint](#chi-tiết-endpoint)
7. [Lưu Ý Flow Và Hành Vi Đặc Biệt](#lưu-ý-flow-và-hành-vi-đặc-biệt)
8. [Rà Soát Lại Với Code](#rà-soát-lại-với-code)

## Base URL

| Môi trường | Base URL | Ghi chú từ code/config |
|---|---:|---|
| Production public | `https://api.vietride.online` | User cung cấp Swagger URL `https://api.vietride.online/docs`. Source không chứa biến production public URL. |
| Local Gateway | `http://localhost:3000` | `.env`: `GATEWAY_PORT=3000`; Gateway route `/v1/notifications` forward tới `NOTIFICATION_BASE_URL`. |
| Local Notification direct | `http://localhost:3002` | Notification `PORT` default `3002`; `.env`: `NOTIFICATION_BASE_URL=http://localhost:3002`, `NOTIFICATION_PORT=3002`. |
| Docker service network | `http://notification:3002` | `.env.example`/docker compose dùng `NOTIFICATION_BASE_URL=http://notification:3002`. |

Swagger runtime:

| URL | Mô tả |
|---|---|
| `https://api.vietride.online/docs` | Swagger aggregator qua Gateway, user cung cấp. |
| `http://localhost:3000/docs` | Swagger aggregator local Gateway. |
| `http://localhost:3000/api-specs/notification` | Gateway proxy tới Notification `/docs-json`. |
| `http://localhost:3002/docs` | Swagger UI trực tiếp Notification service. |
| `http://localhost:3002/docs-json` | OpenAPI JSON trực tiếp Notification service do `SwaggerModule.setup('docs', ...)` tạo. |

## Cơ Chế Xác Thực Chung

### User JWT

Các endpoint người dùng của Notification dùng:

```http
Authorization: Bearer <access_token>
```

Guard trong Notification service xác thực bằng `jose.jwtVerify`:

| Thuộc tính | Giá trị từ code/env |
|---|---|
| Thuật toán | RS256 |
| JWKS URL | `JWT_PUBLIC_KEY_URL`, default `http://identity:5001/v1/.well-known/jwks.json`; `.env` local là `http://localhost:5001/v1/.well-known/jwks.json` |
| Issuer | `JWT_ISSUER`, default `vietride-identity` |
| Audience | `JWT_AUDIENCE`, default `vietride-api` |
| Clock tolerance | 5 giây |
| Claim bắt buộc | `sub`; `role` hoặc phần tử đầu tiên của `roles` |
| Claim optional | `operatorId` |

Khi đi qua Gateway, `/v1/notifications` cũng bị Gateway verify user JWT trước, sau đó Gateway vẫn forward header `Authorization` xuống Notification service vì route có `forwardUserAuthorization: true`.

### Internal JWT

Endpoint internal email dùng:

```http
X-Internal-Auth: Bearer <internal_jwt>
```

Guard trong Notification service xác thực:

| Thuộc tính | Giá trị từ code |
|---|---|
| Header | `X-Internal-Auth` |
| Thuật toán | HS256 |
| Secret | `INTERNAL_JWT_SECRET`, tối thiểu 32 ký tự theo schema |
| Issuer | `vietride-gateway` |
| Audience | `vietride-internal` |
| Claim bắt buộc | `sub` |
| Claim optional | `role`, `operatorId`, `reqId` |

Gateway mint internal JWT với TTL default `INTERNAL_JWT_TTL_SEC=120`.

## Response Envelope Chung

Success HTTP response được `ApiResponseInterceptor` bọc, trừ `204 No Content`.

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "meta": {
    "traceId": "req_01HZY7B9Q6Y8Y4J4XJ4Z6X9YQ8",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

Error HTTP response được `ApiResponseExceptionFilter` bọc:

```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "fields": [
      {
        "field": "pageSize",
        "message": "Number must be less than or equal to 100"
      }
    ]
  },
  "meta": {
    "traceId": "req_01HZY7B9Q6Y8Y4J4XJ4Z6X9YQ8",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

`traceId` lấy từ header `x-request-id` hoặc request context. Nếu không có, Gateway/Correlation middleware có thể tạo UUID.

## Quy Ước Chung

| Quy ước | Giá trị |
|---|---|
| Date-time | ISO 8601 string từ `Date.toISOString()`, ví dụ `2026-06-17T09:30:00.000Z` |
| UUID | Zod `z.string().uuid()` hoặc DB UUID |
| Validation | Zod qua `ZodValidationPipe`; lỗi trả `400 VALIDATION_FAILED` |
| Rate limit qua Gateway | `120` request / `60` giây / IP theo `RATE_LIMIT_DEFAULT_PER_MIN`, Redis-backed nếu không disable |
| Gateway auth fail | `401 AUTH_TOKEN_INVALID` |
| Notification direct auth fail | `401 UNAUTHORIZED` |
| Gateway upstream down | `502 UPSTREAM_UNAVAILABLE` |
| Gateway route không match | `404 ROUTE_NOT_FOUND` |

Enums từ `apps/notification/prisma/schema.prisma`:

```text
NotificationType =
BOOKING_CONFIRMED | BOOKING_CANCELLED | BOOKING_DISRUPTED | BOOKING_REFUNDED |
PASSENGER_NO_SHOW | TRIP_BOARDING_REMINDER | TRIP_VEHICLE_APPROACHING |
TRIP_ROUTE_CHANGED | TRIP_SCHEDULE_CHANGED | TRIP_CANCELLED | TRIP_DELAYED |
TRIP_DISRUPTED | STOP_DISABLED | VEHICLE_SUBSTITUTED | VEHICLE_SWAPPED |
PARCEL_LOADED | PARCEL_IN_TRANSIT | PARCEL_DELIVERED_PENDING_CONFIRM |
PARCEL_REJECTED | PARCEL_RETURNED | WALLET_CREDITED | WALLET_DEBITED |
INCIDENT_REPORTED | OFF_ROUTE_ALERT | TRIP_DELAYED_ALERT | CARGO_NEAR_FULL_ALERT |
PARCEL_REVIEW_REQUESTED | VOUCHER_CONSENT_REQUESTED | VOUCHER_CONSENT_ACCEPTED |
VOUCHER_CONSENT_REJECTED | SUBSCRIPTION_LIMIT_EXCEEDED |
SUBSCRIPTION_TRIAL_EXPIRING | SUBSCRIPTION_EXPIRED | SUBSCRIPTION_APPROVED |
SUBSCRIPTION_PAYMENT_PENDING_WARN | SUBSCRIPTION_PAYMENT_AUTO_REVERTED |
DRIVER_SCHEDULE_EDITED | PAYOUT_PROCESSED | PAYOUT_FAILED |
OPERATOR_APPROVED | OPERATOR_SUSPENDED
```

```text
EmailTemplateKey =
AUTH_OTP | SET_INITIAL_PASSWORD | PARCEL_DELIVERY_LINK |
OPERATOR_SUBSCRIPTION_NOTICE | INVOICE_NOTICE
```

```text
EmailDeliveryStatus = PENDING | SENT | FAILED | RETRYING
NotificationDeliveryStatus = PENDING | SENT | FAILED | RETRYING
DevicePlatform = IOS | ANDROID | WEB
```

## Tổng Quan Endpoint

| Method | Full URL qua Gateway | Full URL trực tiếp Notification | Auth | Mô tả ngắn |
|---|---|---|---|---|
| GET | N/A | `/health` | Không | Liveness probe |
| GET | N/A | `/ready` | Không | Readiness probe Prisma/Redis/RabbitMQ |
| GET | `/v1/notifications` | `/v1/notifications` | User JWT | Lấy danh sách notification của user hiện tại |
| POST | `/v1/notifications/:notificationId/read` | `/v1/notifications/:notificationId/read` | User JWT | Mark notification của user hiện tại là đã đọc |
| POST | N/A | `/internal/v1/emails` | Internal JWT | Enqueue email delivery nội bộ |

Không có controller route HTTP để tạo notification. Notification được tạo từ service/consumer nội bộ, không expose REST create trong controller hiện tại.

## Chi Tiết Endpoint

### 1. Liveness Probe

**Method + Full URL**

```http
GET http://localhost:3002/health
```

**Mô tả**

Kiểm tra service process còn sống. Controller trả object cố định.

**Headers bắt buộc**

Không có.

**Path Params**

Không có.

**Query Params**

Không có.

**Request Body**

Không có.

**Response thành công**

HTTP `200`

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "status": "ok",
    "service": "notification"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

| Field | Kiểu | Mô tả |
|---|---|---|
| `data.status` | string | Luôn là `ok` |
| `data.service` | string | Luôn là `notification` |

**Response lỗi**

Trong controller không throw lỗi riêng. Lỗi không mong đợi sẽ được filter map thành:

```json
{
  "success": false,
  "statusCode": 500,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Unexpected error"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

**curl**

```bash
curl -i "http://localhost:3002/health"
```

**fetch**

```js
const res = await fetch("http://localhost:3002/health");
const json = await res.json();
console.log(res.status, json);
```

**Lưu ý đặc biệt**

Gateway route table hiện không khai báo `/v1/notification/health`; endpoint này gọi trực tiếp service.

### 2. Readiness Probe

**Method + Full URL**

```http
GET http://localhost:3002/ready
```

**Mô tả**

Kiểm tra service sẵn sàng bằng cách ping 3 dependency: Prisma/Postgres, Redis, RabbitMQ.

**Headers bắt buộc**

Không có.

**Path Params**

Không có.

**Query Params**

Không có.

**Request Body**

Không có.

**Response thành công**

HTTP `200`

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "status": "ok",
    "service": "notification",
    "dependencies": {
      "prisma": "ok",
      "redis": "ok",
      "rabbitmq": "ok"
    }
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

| Field | Kiểu | Mô tả |
|---|---|---|
| `data.status` | string | Luôn là `ok` nếu pass |
| `data.service` | string | Luôn là `notification` |
| `data.dependencies.prisma` | string | `ok` nếu `SELECT 1` pass |
| `data.dependencies.redis` | string | `ok` nếu Redis `PING` pass |
| `data.dependencies.rabbitmq` | string | `ok` nếu tạo/đóng channel RabbitMQ pass |

**Response lỗi**

HTTP `503` khi một trong các dependency fail:

```json
{
  "success": false,
  "statusCode": 503,
  "error": {
    "code": "NOTIFICATION_DEPENDENCY_UNAVAILABLE",
    "message": "Notification dependency readiness check failed"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

Lỗi không mong đợi khác:

```json
{
  "success": false,
  "statusCode": 500,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Unexpected error"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

**curl**

```bash
curl -i "http://localhost:3002/ready"
```

**fetch**

```js
const res = await fetch("http://localhost:3002/ready");
const json = await res.json();
console.log(res.status, json);
```

**Lưu ý đặc biệt**

Không yêu cầu auth. Gateway route table hiện không khai báo readiness cho Notification.

### 3. List Notifications Của User Hiện Tại

**Method + Full URL**

```http
GET https://api.vietride.online/v1/notifications
GET http://localhost:3000/v1/notifications
GET http://localhost:3002/v1/notifications
```

**Mô tả**

Lấy lịch sử in-app notification thuộc user trong access token hiện tại. Repository filter theo `userId` lấy từ claim `sub`, có phân trang, sort và filter unread.

**Headers bắt buộc**

| Header | Bắt buộc | Giá trị | Ghi chú |
|---|---:|---|---|
| `Authorization` | Có | `Bearer <access_token>` | User access token RS256 |
| `x-request-id` | Không | string | Nếu gửi, được dùng làm `meta.traceId`/response header |

**Path Params**

Không có.

**Query Params**

| Tên | Kiểu sau parse | Bắt buộc | Default | Validation |
|---|---|---:|---|---|
| `unreadOnly` | boolean | Không | `false` | Chấp nhận `true`, `false`, boolean thật; giá trị khác fail |
| `page` | number | Không | `1` | Coerce number, integer, `min(1)` |
| `pageSize` | number | Không | `20` | Coerce number, integer, `min(1)`, `max(100)` |
| `sortBy` | string enum | Không | `createdAt` | `createdAt`, `readAt`, `type` |
| `sortDir` | string enum | Không | `desc` | `asc`, `desc` |

**Request Body**

Không có.

**Response thành công**

HTTP `200`

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": "7e7d44b8-3d84-4dd5-b0a2-1f445de7c701",
        "userId": "11111111-1111-4111-8111-111111111111",
        "type": "BOOKING_CONFIRMED",
        "title": "Dat ve thanh cong",
        "body": "Ve #VR-1024 da duoc xac nhan.",
        "data": {
          "bookingId": "22222222-2222-4222-8222-222222222222",
          "bookingCode": "VR-1024"
        },
        "readAt": null,
        "createdAt": "2026-06-17T09:20:00.000Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

| Field | Kiểu | Mô tả |
|---|---|---|
| `data.items[].id` | UUID string | Notification id |
| `data.items[].userId` | UUID string | User owner id từ DB |
| `data.items[].type` | string | `NotificationType` enum |
| `data.items[].title` | string | Notification title |
| `data.items[].body` | string | Notification body |
| `data.items[].data` | unknown/null | JSON data; service trả `null` nếu DB null |
| `data.items[].readAt` | ISO date-time/null | Thời điểm đã đọc |
| `data.items[].createdAt` | ISO date-time | Thời điểm tạo |
| `data.page` | number | Page sau parse |
| `data.pageSize` | number | Page size sau parse |
| `data.totalItems` | number | Tổng row matching filter |
| `data.totalPages` | number | `Math.ceil(totalItems / pageSize)` |
| `data.hasNextPage` | boolean | `page < totalPages` |
| `data.hasPreviousPage` | boolean | `page > 1` |

**Response lỗi**

HTTP `400` khi query không qua Zod validation:

```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "fields": [
      {
        "field": "pageSize",
        "message": "Number must be less than or equal to 100"
      }
    ]
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

HTTP `401` khi gọi trực tiếp Notification service thiếu token:

```json
{
  "success": false,
  "statusCode": 401,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing bearer token"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

HTTP `401` khi gọi trực tiếp Notification service token sai/hết hạn/claim thiếu:

```json
{
  "success": false,
  "statusCode": 401,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid bearer token"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

HTTP `401` khi đi qua Gateway token thiếu/sai/hết hạn:

```json
{
  "success": false,
  "statusCode": 401,
  "error": {
    "code": "AUTH_TOKEN_INVALID",
    "message": "Authorization header is required or access token is invalid."
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

HTTP `403` khi đi qua Gateway và role `PASSENGER` chưa hoàn tất phone profile:

```json
{
  "success": false,
  "statusCode": 403,
  "error": {
    "code": "AUTH_PHONE_REQUIRED",
    "message": "Vui lòng hoàn tất hồ sơ trước khi tiếp tục."
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

HTTP `429` khi Gateway rate limit:

```json
{
  "success": false,
  "statusCode": 429,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too Many Requests"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

⚠️ TODO: cần xác nhận thêm exact `message` của `ThrottlerGuard` ở runtime, vì source filter chỉ xác định default code cho status 429.

HTTP `500` khi lỗi hệ thống ngoài các nhánh trên. `message` lấy từ `exception.message` nếu exception là `Error`; nếu không có message thì mới là `"Unexpected error"`:

```json
{
  "success": false,
  "statusCode": 500,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Unexpected error"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

HTTP `502` khi đi qua Gateway và Notification upstream unavailable:

```json
{
  "success": false,
  "statusCode": 502,
  "error": {
    "code": "UPSTREAM_UNAVAILABLE",
    "message": "Upstream service unavailable"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

**curl**

```bash
curl -i "https://api.vietride.online/v1/notifications?unreadOnly=true&page=1&pageSize=20&sortBy=createdAt&sortDir=desc" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-request-id: req-notification-list-001"
```

**fetch**

```js
const url = new URL("https://api.vietride.online/v1/notifications");
url.searchParams.set("unreadOnly", "true");
url.searchParams.set("page", "1");
url.searchParams.set("pageSize", "20");
url.searchParams.set("sortBy", "createdAt");
url.searchParams.set("sortDir", "desc");

const res = await fetch(url, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "x-request-id": "req-notification-list-001"
  }
});
const json = await res.json();
console.log(res.status, json);
```

**axios**

```js
import axios from "axios";

const { data } = await axios.get("https://api.vietride.online/v1/notifications", {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "x-request-id": "req-notification-list-001"
  },
  params: {
    unreadOnly: true,
    page: 1,
    pageSize: 20,
    sortBy: "createdAt",
    sortDir: "desc"
  }
});

console.log(data);
```

**Lưu ý đặc biệt**

Không có role guard trong Notification controller. Nếu gọi qua Gateway, route `/v1/notifications` yêu cầu user JWT nhưng không cấu hình `requiredRoles`.

### 4. Mark Notification Là Đã Đọc

**Method + Full URL**

```http
POST https://api.vietride.online/v1/notifications/:notificationId/read
POST http://localhost:3000/v1/notifications/:notificationId/read
POST http://localhost:3002/v1/notifications/:notificationId/read
```

**Mô tả**

Mark notification thuộc user hiện tại là đã đọc. Service chỉ update nếu notification tồn tại và `userId` khớp claim `sub`. Nếu notification đã đọc trước đó, service không update lại và vẫn trả `204`.

**Headers bắt buộc**

| Header | Bắt buộc | Giá trị | Ghi chú |
|---|---:|---|---|
| `Authorization` | Có | `Bearer <access_token>` | User access token RS256 |
| `x-request-id` | Không | string | Trace id |

**Path Params**

| Tên | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `notificationId` | string | Có | UUID |

**Query Params**

Không có.

**Request Body**

Không có. Controller không đọc body.

**Response thành công**

HTTP `204 No Content`

Không có JSON body. `ApiResponseInterceptor` bỏ qua envelope cho status 204.

**Response lỗi**

HTTP `400` khi `notificationId` không phải UUID:

```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "fields": [
      {
        "field": "notificationId",
        "message": "Invalid uuid"
      }
    ]
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

HTTP `401` khi thiếu/sai token trực tiếp Notification service:

```json
{
  "success": false,
  "statusCode": 401,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing bearer token"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

HTTP `401` khi token invalid trực tiếp Notification service:

```json
{
  "success": false,
  "statusCode": 401,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid bearer token"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

HTTP `401` khi đi qua Gateway token thiếu/sai/hết hạn:

```json
{
  "success": false,
  "statusCode": 401,
  "error": {
    "code": "AUTH_TOKEN_INVALID",
    "message": "Authorization header is required or access token is invalid."
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

HTTP `403` khi đi qua Gateway và role `PASSENGER` chưa hoàn tất phone profile:

```json
{
  "success": false,
  "statusCode": 403,
  "error": {
    "code": "AUTH_PHONE_REQUIRED",
    "message": "Vui lòng hoàn tất hồ sơ trước khi tiếp tục."
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

HTTP `404` khi notification không tồn tại hoặc không thuộc user hiện tại:

```json
{
  "success": false,
  "statusCode": 404,
  "error": {
    "code": "NOTIFICATION_NOT_FOUND",
    "message": "Notification 7e7d44b8-3d84-4dd5-b0a2-1f445de7c701 not found"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

HTTP `429` qua Gateway khi rate limit:

```json
{
  "success": false,
  "statusCode": 429,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too Many Requests"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

⚠️ TODO: cần xác nhận thêm exact `message` của `ThrottlerGuard` ở runtime.

HTTP `500` khi lỗi hệ thống. `message` lấy từ `exception.message` nếu exception là `Error`; nếu không có message thì mới là `"Unexpected error"`:

```json
{
  "success": false,
  "statusCode": 500,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Unexpected error"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

HTTP `502` qua Gateway khi upstream unavailable:

```json
{
  "success": false,
  "statusCode": 502,
  "error": {
    "code": "UPSTREAM_UNAVAILABLE",
    "message": "Upstream service unavailable"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

**curl**

```bash
curl -i -X POST "https://api.vietride.online/v1/notifications/7e7d44b8-3d84-4dd5-b0a2-1f445de7c701/read" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-request-id: req-notification-read-001"
```

**fetch**

```js
const notificationId = "7e7d44b8-3d84-4dd5-b0a2-1f445de7c701";
const res = await fetch(`https://api.vietride.online/v1/notifications/${notificationId}/read`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "x-request-id": "req-notification-read-001"
  }
});

if (res.status === 204) {
  console.log("Marked as read");
} else {
  console.log(res.status, await res.json());
}
```

**axios**

```js
import axios from "axios";

const notificationId = "7e7d44b8-3d84-4dd5-b0a2-1f445de7c701";
await axios.post(
  `https://api.vietride.online/v1/notifications/${notificationId}/read`,
  undefined,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-request-id": "req-notification-read-001"
    }
  }
);
```

**Lưu ý đặc biệt**

Route cũ `PATCH /v1/notifications/:id` không có trong controller hiện tại; e2e test hiện xác nhận PATCH trả 404.

### 5. Enqueue Internal Email Delivery

**Method + Full URL**

```http
POST http://localhost:3002/internal/v1/emails
```

**Mô tả**

Endpoint nội bộ để enqueue email delivery qua Notification service. Endpoint render template trước, tạo row `email_deliveries` với status mặc định `PENDING`, rồi enqueue worker email.

Gateway route table hiện không expose `/internal/v1/emails`; gọi trực tiếp service hoặc qua mạng nội bộ.

**Headers bắt buộc**

| Header | Bắt buộc | Giá trị | Ghi chú |
|---|---:|---|---|
| `X-Internal-Auth` | Có | `Bearer <internal_jwt>` | HS256 internal JWT |
| `Content-Type` | Có | `application/json` | JSON body |
| `x-request-id` | Không | string | Trace id |

**Path Params**

Không có.

**Query Params**

Không có.

**Request Body**

```json
{
  "notificationId": "7e7d44b8-3d84-4dd5-b0a2-1f445de7c701",
  "toEmail": "operator@example.com",
  "templateKey": "OPERATOR_SUBSCRIPTION_NOTICE",
  "templateData": {
    "message": "Gói dịch vụ của bạn sắp hết hạn.",
    "title": "Thông báo gói dịch vụ VietRide",
    "actionUrl": "https://vietride.online/operator/subscription"
  }
}
```

| Field | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `notificationId` | string/null | Không | Nếu có: UUID; cho phép `null` |
| `toEmail` | string | Có | Email hợp lệ |
| `templateKey` | enum | Có | Một trong `EmailTemplateKey` |
| `templateData` | object record | Có | `z.record(z.unknown())`; phải là object JSON |

Template renderer yêu cầu thêm field trong `templateData` theo `templateKey`:

| `templateKey` | Field bắt buộc theo renderer | Field optional/default |
|---|---|---|
| `AUTH_OTP` | `otpCode` hoặc `code` | `ttlMinutes` default `"10"`; `purpose` default `"xac thuc"` |
| `SET_INITIAL_PASSWORD` | `setPasswordUrl` hoặc `setInitialPasswordUrl` | Không có |
| `PARCEL_DELIVERY_LINK` | `deliveryUrl` | `parcelCode` default `"kien hang"` |
| `OPERATOR_SUBSCRIPTION_NOTICE` | `message` | `title` default `"Thong bao goi dich vu VietRide"`; `actionUrl` optional |
| `INVOICE_NOTICE` | Không có | `invoiceNumber` default `"hoa don moi"`; `amountVnd`; `invoiceUrl` |

Lưu ý: thiếu field bắt buộc của renderer hiện ném `Error` thường và trở thành HTTP `500 INTERNAL_ERROR`, không phải `400`.

**Response thành công**

HTTP `202`

```json
{
  "success": true,
  "statusCode": 202,
  "data": {
    "id": "3a64c7a7-b320-496a-a2f9-96b0248a9735",
    "toEmail": "operator@example.com",
    "templateKey": "OPERATOR_SUBSCRIPTION_NOTICE",
    "status": "PENDING",
    "createdAt": "2026-06-17T09:25:00.000Z"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

| Field | Kiểu | Mô tả |
|---|---|---|
| `data.id` | UUID string | Email delivery id |
| `data.toEmail` | string | Người nhận email |
| `data.templateKey` | string | Template enum |
| `data.status` | string | Status từ DB, mặc định `PENDING` |
| `data.createdAt` | ISO date-time | Thời điểm tạo delivery |

**Response lỗi**

HTTP `400` khi body không qua Zod validation:

```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "fields": [
      {
        "field": "toEmail",
        "message": "Invalid email"
      }
    ]
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

HTTP `401` khi thiếu internal token:

```json
{
  "success": false,
  "statusCode": 401,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing internal bearer token"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

HTTP `401` khi internal token sai/hết hạn/không có `sub`:

```json
{
  "success": false,
  "statusCode": 401,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid internal bearer token"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

HTTP `500` khi renderer thiếu field bắt buộc hoặc lỗi hệ thống. Với lỗi thiếu field template, renderer ném `Error` nên `message` là chuỗi lỗi cụ thể như ví dụ dưới:

```json
{
  "success": false,
  "statusCode": 500,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "EMAIL_TEMPLATE_MISSING_MESSAGE"
  },
  "meta": {
    "traceId": "4df359ec-91b3-4d52-9c5b-c651aa7c4b6b",
    "timestamp": "2026-06-17T09:30:00.000Z"
  }
}
```

⚠️ TODO: cần xác nhận thêm với team có muốn thiếu biến template trả `400 VALIDATION_FAILED` thay vì `500 INTERNAL_ERROR` không. Code hiện tại trả 500.

**curl**

```bash
curl -i -X POST "http://localhost:3002/internal/v1/emails" \
  -H "X-Internal-Auth: Bearer $INTERNAL_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-request-id: req-internal-email-001" \
  --data '{
    "notificationId": null,
    "toEmail": "operator@example.com",
    "templateKey": "OPERATOR_SUBSCRIPTION_NOTICE",
    "templateData": {
      "message": "Gói dịch vụ của bạn sắp hết hạn.",
      "title": "Thông báo gói dịch vụ VietRide",
      "actionUrl": "https://vietride.online/operator/subscription"
    }
  }'
```

**fetch**

```js
const res = await fetch("http://localhost:3002/internal/v1/emails", {
  method: "POST",
  headers: {
    "X-Internal-Auth": `Bearer ${internalToken}`,
    "Content-Type": "application/json",
    "x-request-id": "req-internal-email-001"
  },
  body: JSON.stringify({
    notificationId: null,
    toEmail: "operator@example.com",
    templateKey: "OPERATOR_SUBSCRIPTION_NOTICE",
    templateData: {
      message: "Gói dịch vụ của bạn sắp hết hạn.",
      title: "Thông báo gói dịch vụ VietRide",
      actionUrl: "https://vietride.online/operator/subscription"
    }
  })
});

const json = await res.json();
console.log(res.status, json);
```

**axios**

```js
import axios from "axios";

const { data } = await axios.post(
  "http://localhost:3002/internal/v1/emails",
  {
    notificationId: null,
    toEmail: "operator@example.com",
    templateKey: "OPERATOR_SUBSCRIPTION_NOTICE",
    templateData: {
      message: "Gói dịch vụ của bạn sắp hết hạn.",
      title: "Thông báo gói dịch vụ VietRide",
      actionUrl: "https://vietride.online/operator/subscription"
    }
  },
  {
    headers: {
      "X-Internal-Auth": `Bearer ${internalToken}`,
      "x-request-id": "req-internal-email-001"
    }
  }
);

console.log(data);
```

**Lưu ý đặc biệt**

Endpoint này không có idempotency key trong controller/service. Gọi lại cùng body sẽ tạo email delivery mới nếu DB/queue xử lý thành công.

## Lưu Ý Flow Và Hành Vi Đặc Biệt

1. Notification in-app không được tạo bằng REST endpoint public. `NotificationsService.createNotification()` được dùng bởi consumer/service nội bộ và enqueue FCM nếu row mới được tạo.
2. `POST /v1/notifications/:notificationId/read` chống IDOR bằng `findFirst({ id, userId })`; notification không thuộc user hiện tại trả 404 như không tồn tại.
3. `PATCH /v1/notifications/:id` không tồn tại trong controller hiện tại.
4. Token user hết hạn hoặc invalid:
   - Qua Gateway: thường nhận `401 AUTH_TOKEN_INVALID`.
   - Gọi trực tiếp service: nhận `401 UNAUTHORIZED`.
   FE/mobile nên refresh token bằng Identity service rồi retry request gốc.
5. Gateway route `/v1/notifications` không yêu cầu role cụ thể, nhưng phone gate ở Gateway có thể chặn role `PASSENGER` nếu claim `hasPhone` không phải `true`.
6. Service có Swagger trực tiếp ở `/docs`; Gateway aggregator ở `/docs`.
7. Internal email enqueue chỉ tạo delivery `PENDING`; gửi thật do worker nền xử lý SendGrid.

## Rà Soát Lại Với Code

Đã đối chiếu lại với các file chính:

| Hạng mục | File đã kiểm tra | Kết luận |
|---|---|---|
| Gateway route | `apps/gateway/src/config/routes.ts` | Chỉ expose `/v1/notifications` và `/api-specs/notification` cho Notification qua Gateway |
| Notification module | `apps/notification/src/app/app.module.ts`, `apps/notification/src/notifications/notifications.module.ts` | Controller được đăng ký: `HealthController`, `ReadyController`, `NotificationsController`, `InternalEmailsController` |
| Controller HTTP | `notifications.controller.ts`, `internal-emails.controller.ts`, `health.controller.ts`, `ready.controller.ts` | Endpoint thật đúng như bảng tổng quan |
| DTO/Zod | `list-notifications-query.dto.ts`, `notification-param.dto.ts`, `create-email-send.dto.ts` | Validation/default đã ghi theo schema |
| Auth | `user-jwt-auth.guard.ts`, `user-jwt.verifier.ts`, `internal-jwt-auth.guard.ts` | Header/token/issuer/audience/claim đã ghi theo code |
| Response envelope | `ApiResponseInterceptor`, `ApiResponseExceptionFilter`, `ZodValidationPipe` | Success/error shape và validation fields đã ghi theo code |
| DB enum/response fields | `apps/notification/prisma/schema.prisma`, `notifications.service.ts` | Enum và response DTO đã ghi theo code |

⚠️ TODO: cần xác nhận thêm exact production exposure cho direct Notification service và exact runtime `429` message từ `@nestjs/throttler`; source hiện chỉ cho biết rate limit và status/code mapping.
