# Tài liệu API Notification — VietRide

Tài liệu này được rà soát từ source code hiện tại của Notification service, Gateway route table, DTO Zod, guard xác thực, Prisma schema và shared `ApiResponse` filter/interceptor. Chỉ mô tả hành vi có trong code.

> Cập nhật lần cuối: **2026-07-28** — đã đồng bộ toàn bộ kết quả T1–T9/Phase 10: Unicode, event coverage, recipient policy, Parcel Settlement v2, idempotency, retry/DLQ, FCM/email recovery, bảo mật log và real-stack E2E.

## Table of Contents

1. [Base URL](#base-url)
2. [Cơ Chế Xác Thực Chung](#cơ-chế-xác-thực-chung)
3. [Response Envelope Chung](#response-envelope-chung)
4. [Quy Ước Chung](#quy-ước-chung)
5. [Tổng Quan Endpoint](#tổng-quan-endpoint)
6. [Chi Tiết Endpoint](#chi-tiết-endpoint)
7. [Event, Routing Key và Chính Sách Người Nhận](#event-routing-key-và-chính-sách-người-nhận)
8. [Luồng Push và Payload Mobile](#luồng-push-và-payload-mobile)
9. [Độ Tin Cậy Delivery và Idempotency](#độ-tin-cậy-delivery-và-idempotency)
10. [Tích Hợp FE/Mobile](#tích-hợp-femobile)
11. [Verification T1–T9](#verification-t1t9)
12. [Lưu Ý Flow Và Hành Vi Đặc Biệt](#lưu-ý-flow-và-hành-vi-đặc-biệt)
13. [Rà Soát Lại Với Code](#rà-soát-lại-với-code)

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
PARCEL_REVIEW_REQUESTED | PARCEL_REVIEW_APPROVED | PARCEL_FINAL_PAYMENT_REQUIRED |
PARCEL_SETTLEMENT_RECOVERED | VOUCHER_CONSENT_REQUESTED | VOUCHER_CONSENT_ACCEPTED |
VOUCHER_CONSENT_REJECTED | SUBSCRIPTION_LIMIT_EXCEEDED | SUBSCRIPTION_USAGE_WARNING |
SUBSCRIPTION_TRIAL_EXPIRING | SUBSCRIPTION_EXPIRED | SUBSCRIPTION_APPROVED |
SUBSCRIPTION_PAYMENT_PENDING_WARN | SUBSCRIPTION_PAYMENT_AUTO_REVERTED |
INVOICE_ISSUED | DRIVER_SCHEDULE_EDITED | PAYOUT_PROCESSED | PAYOUT_FAILED |
OPERATOR_APPROVED | OPERATOR_SUSPENDED | OPERATOR_REGISTRATION_SUBMITTED |
TRIP_ASSIGNED | TRIP_ASSIGNMENT_REMOVED | OPERATOR_ANNOUNCEMENT |
SHUTTLE_ASSIGNED | SHUTTLE_UNFULFILLED | SHUTTLE_WARNING |
DRIVER_STOP_DEPARTED_WITH_PENDING
```

```text
EmailTemplateKey =
AUTH_OTP | SET_INITIAL_PASSWORD | PARCEL_DELIVERY_LINK |
OPERATOR_SUBSCRIPTION_NOTICE | INVOICE_NOTICE
```

```text
EmailDeliveryStatus = PENDING | SENDING | SENT | FAILED | RETRYING
NotificationDeliveryStatus = PENDING | SENT | FAILED | RETRYING | VALIDATED
DevicePlatform = IOS | ANDROID | WEB
```

## Tổng Quan Endpoint

| Method | Full URL qua Gateway | Full URL trực tiếp Notification | Auth | Mô tả ngắn |
|---|---|---|---|---|
| GET | N/A | `/health` | Không | Liveness probe |
| GET | N/A | `/ready` | Không | Readiness probe Prisma/Redis/RabbitMQ |
| GET | `/v1/notifications` | `/v1/notifications` | User JWT | Lấy danh sách notification của user hiện tại |
| POST | `/v1/notifications/:notificationId/read` | `/v1/notifications/:notificationId/read` | User JWT | Mark notification của user hiện tại là đã đọc |
| POST | `/v1/operator/notifications` | `/v1/operator/notifications` | User JWT: `OPERATOR_ADMIN`, `OPERATOR_STAFF` | Gửi thông báo điều hành đến crew của một chuyến hoặc toàn operator |
| POST | N/A | `/internal/v1/emails` | Internal JWT | Enqueue email delivery nội bộ |

Không có endpoint công khai để tạo một notification tùy ý cho bất kỳ user nào. Ngoài endpoint thông báo điều hành có kiểm soát role/scope, notification được tạo bởi service/consumer nội bộ.

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
        "title": "Đặt vé thành công",
        "body": "Vé #VR-1024 đã được xác nhận.",
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

Endpoint nội bộ để enqueue email delivery qua Notification service. Endpoint kiểm tra `Idempotency-Key` UUID v4, render template, tạo hoặc lấy lại row `email_deliveries` theo durable dedupe key, rồi enqueue worker email bằng job ID xác định.

Gateway route table hiện không expose `/internal/v1/emails`; gọi trực tiếp service hoặc qua mạng nội bộ.

**Headers bắt buộc**

| Header | Bắt buộc | Giá trị | Ghi chú |
|---|---:|---|---|
| `X-Internal-Auth` | Có | `Bearer <internal_jwt>` | HS256 internal JWT |
| `Idempotency-Key` | Có | UUID v4 | Retry cùng thao tác phải giữ nguyên key; key khác tạo thao tác mới |
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
| `dedupeKey` | string | Không | Trim, 1–200 ký tự. Nếu bỏ trống, controller dùng `http-email:<Idempotency-Key>` |
| `toEmail` | string | Có | Email hợp lệ |
| `templateKey` | enum | Có | Một trong `EmailTemplateKey` |
| `templateData` | object record | Có | `z.record(z.unknown())`; phải là object JSON |

Template renderer yêu cầu thêm field trong `templateData` theo `templateKey`:

| `templateKey` | Field bắt buộc theo renderer | Field optional/default |
|---|---|---|
| `AUTH_OTP` | `otpCode` hoặc `code` | `ttlMinutes` default `"10"`; `purpose` default `"xác thực"` |
| `SET_INITIAL_PASSWORD` | `setPasswordUrl` hoặc `setInitialPasswordUrl` | Không có |
| `PARCEL_DELIVERY_LINK` | `deliveryUrl` | `parcelCode` default `"kiện hàng"` |
| `OPERATOR_SUBSCRIPTION_NOTICE` | `message` | `title` default `"Thông báo gói dịch vụ VietRide"`; `actionUrl` optional |
| `INVOICE_NOTICE` | Không có | `invoiceNumber` default `"hóa đơn mới"`; `amountVnd`; `invoiceUrl` |

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

HTTP `422` khi thiếu hoặc gửi sai định dạng `Idempotency-Key`:

| Trường hợp | `error.code` | `error.message`/ý nghĩa |
|---|---|---|
| Thiếu hoặc chỉ có khoảng trắng | `IDEMPOTENCY_KEY_REQUIRED` | Bắt buộc gửi header `Idempotency-Key` |
| Không phải UUID v4 | `VALIDATION_ERROR` | `Idempotency-Key must be a UUID v4` |

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
  -H "Idempotency-Key: 11111111-1111-4111-8111-111111111111" \
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
    "Idempotency-Key": "11111111-1111-4111-8111-111111111111",
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
      "Idempotency-Key": "11111111-1111-4111-8111-111111111111",
      "x-request-id": "req-internal-email-001"
    }
  }
);

console.log(data);
```

**Lưu ý đặc biệt**

Endpoint bắt buộc `Idempotency-Key` UUID v4. Nếu body không truyền `dedupeKey`, controller dùng `http-email:<Idempotency-Key>`; retry cùng key nhận lại cùng delivery và không tạo email audit trùng. `PENDING`, `RETRYING` hoặc `SENDING` không chắc chắn sẽ được enqueue/reconcile lại; `SENT` không gửi lại.

### 6. Gửi thông báo điều hành

**Method + URL**

```http
POST https://api.vietride.online/v1/operator/notifications
POST http://localhost:3000/v1/operator/notifications
```

Gateway yêu cầu User JWT có role `OPERATOR_ADMIN` hoặc `OPERATOR_STAFF` và vẫn forward bearer token xuống Notification service để service kiểm tra lại claim. Endpoint không dành cho passenger, driver hoặc assistant.

**Headers bắt buộc**

| Header | Giá trị | Mô tả |
|---|---|---|
| `Authorization` | `Bearer <access_token>` | User JWT của operator admin/staff. Claim `operatorId` phải có giá trị UUID. |
| `Idempotency-Key` | UUID v4 | Bắt buộc; cùng actor và key sẽ nhận lại kết quả trước đó trong 24 giờ. |
| `Content-Type` | `application/json` | Bắt buộc khi gửi body. |

**Request body**

```json
{
  "scope": "TRIP",
  "tripId": "8e45aabb-9b59-455f-a255-a897c2d18d21",
  "title": "Điều chỉnh giờ tập trung",
  "body": "Vui lòng có mặt trước giờ xuất bến 15 phút."
}
```

| Field | Kiểu | Bắt buộc | Quy tắc |
|---|---|---:|---|
| `scope` | `TRIP` hoặc `OPERATOR` | Có | `TRIP`: gửi cho crew hiện tại của một chuyến. `OPERATOR`: gửi cho toàn bộ driver/assistant active của operator. |
| `tripId` | UUID | Có điều kiện | Bắt buộc khi `scope=TRIP`; không được gửi khi `scope=OPERATOR`. |
| `title` | string | Có | Trim, từ 1 đến 120 ký tự. |
| `body` | string | Có | Trim, từ 1 đến 500 ký tự. |

**Response thành công — `202 Accepted`**

```json
{
  "success": true,
  "statusCode": 202,
  "data": {
    "announcementId": "14a28c5a-0435-4189-818c-af5259c9958b",
    "recipientCount": 2
  },
  "meta": {
    "traceId": "req-operator-announcement-001",
    "timestamp": "2026-07-11T14:55:00.000Z"
  }
}
```

Khi `scope=TRIP`, Notification gọi internal Trip API để lấy crew snapshot, đồng thời kiểm tra chuyến thuộc caller operator. Khi `scope=OPERATOR`, Notification gọi Identity internal API để lấy các user active có role `DRIVER` hoặc `ASSISTANT` của caller operator. Không có recipient hợp lệ trả `422 NOTIFICATION_RECIPIENTS_NOT_FOUND`.

Các lỗi chính: `400 VALIDATION_FAILED` khi body không hợp lệ; `400 IDEMPOTENCY_KEY_MISMATCH` khi tái sử dụng key với body khác; `403 FORBIDDEN` khi role/operator scope không hợp lệ; `404 TRIP_NOT_FOUND` khi trip không tồn tại hoặc không thuộc operator; `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` khi cùng key đang được xử lý; `422 IDEMPOTENCY_KEY_REQUIRED` khi thiếu key; `422 VALIDATION_ERROR` khi key không phải UUID v4; `422 NOTIFICATION_RECIPIENTS_NOT_FOUND` khi không tìm thấy crew active.

## Event, Routing Key và Chính Sách Người Nhận

RabbitMQ dùng topic exchange `vietride.events`. Routing key chuẩn là `<service>.<aggregate>.<verb_past>`. Mọi notification tạo từ event có durable dedupe theo routing key, message/event identity, người nhận và `NotificationType`.

### Các event v1 quan trọng

| Routing key | Người nhận | `NotificationType`/hành vi chính |
|---|---|---|
| `identity.operator.registration_submitted` | Tất cả System Admin active | `OPERATOR_REGISTRATION_SUBMITTED` |
| `identity.operator.approved` / `identity.operator.suspended` | Operator Admin active của nhà xe | `OPERATOR_APPROVED` / `OPERATOR_SUSPENDED` |
| `identity.subscription.usage_warning` | Operator Admin active của nhà xe | `SUBSCRIPTION_USAGE_WARNING`; producer phát một lần khi crossing 80% theo resource/kỳ |
| `identity.otp.requested` | Email được chỉ định | Chỉ tạo email OTP durable, không tạo in-app notification |
| `payment.wallet.credited` / `payment.wallet.debited` | `userId` trong event | `WALLET_CREDITED` / `WALLET_DEBITED` |
| `booking.voucher.consent_requested` | Operator Admin active của nhà xe | `VOUCHER_CONSENT_REQUESTED` |
| `trip.trip.route_changed` | Crew hiện tại và hành khách thuộc booking bị ảnh hưởng | `TRIP_ROUTE_CHANGED`; không broadcast cho toàn bộ hành khách ngoài danh sách affected |
| `trip.trip.schedule_changed` | Crew hiện tại | `TRIP_SCHEDULE_CHANGED`; passenger notification đi qua các Booking event riêng |
| `trip.trip.delayed` | Hành khách bị ảnh hưởng và Operator Admin phù hợp | `TRIP_DELAYED` |
| `parcel.parcel.review_requested` | Operator Admin của nhà xe | `PARCEL_REVIEW_REQUESTED` |
| `parcel.parcel.review_approved` | Người gửi | `PARCEL_REVIEW_APPROVED` |
| `parcel.parcel.final_payment_requested` | Người gửi | `PARCEL_FINAL_PAYMENT_REQUIRED` |
| `parcel.parcel.settlement_recovered` | Người gửi | `PARCEL_SETTLEMENT_RECOVERED` |
| `parcel.parcel.cancelled` | Người gửi theo policy review-timeout | `PARCEL_REJECTED` |
| `parcel.parcel.auto_rejected` | Người gửi theo policy check-in/final-payment timeout | `PARCEL_REJECTED`; payload giữ reason, số cọc bị giữ và refund nếu có |

Các Parcel event còn lại (`created`, `loaded`, `unloaded`, delivery, transfer, return, pending operator action) dùng snapshot Parcel và policy riêng theo từng routing key; không fan-out mặc định đồng thời cho sender và registered recipient.

Không có Notification event `rag.document.approved`; RAG `ingest_requested` là work item nội bộ của RAG, không phải thông báo người dùng.

### Fail-closed recipient resolution

Notification resolve người nhận qua internal API của Booking, Trip, Parcel và Identity. Timeout, `401/403`, `5xx`, response sai ADR envelope hoặc payload malformed đều được xem là dependency failure và message được retry; không được biến thành danh sách người nhận rỗng hợp lệ. Parcel terminal row vẫn phải resolve được snapshot.

## Luồng Push và Payload Mobile

### Event Trip assignment/crew

| Routing key | Producer | Người nhận | Hành vi Notification |
|---|---|---|---|
| `trip.trip.assigned` | Trip generation | `driverUserId`, `assistantUserId` nếu có | Tạo notification `TRIP_ASSIGNED` cho từng crew member. |
| `trip.trip.crew_changed` | API đổi crew | Crew mới và crew bị gỡ | Crew mới nhận `TRIP_ASSIGNED`; crew bị gỡ nhận `TRIP_ASSIGNMENT_REMOVED`; crew không đổi không nhận lại notification. |

Payload `trip.trip.assigned`:

```json
{
  "tripId": "uuid",
  "operatorId": "uuid",
  "driverUserId": "uuid",
  "assistantUserId": "uuid hoặc null",
  "routeName": "Sài Gòn - Đà Lạt",
  "vehiclePlateNumber": "51B-123.45",
  "departureDateTime": "2026-07-12T01:00:00+00:00"
}
```

Payload `trip.trip.crew_changed` dùng cùng snapshot và có thêm `oldDriverUserId`, `oldAssistantUserId`. Consumer dùng routing key + RabbitMQ message ID làm idempotency identity; notification mỗi recipient có dedupe key riêng.

Mỗi push FCM có notification title/body và object `data` chỉ chứa string. Mobile dùng `data.type` để route màn hình:

| Điều kiện | `data.type` |
|---|---|
| `TRIP_ASSIGNED` | `TRIP_ASSIGNED` |
| Các notification trip/stop/vehicle còn lại | `TRIP_UPDATE` |
| Notification parcel | `PARCEL_UPDATE` |
| Các loại còn lại, gồm announcement | `NOTIFICATION` |

`data.notificationType` luôn giữ NotificationType chi tiết để FE/mobile hiển thị nội dung hoặc xử lý nghiệp vụ đặc thù. Các key `notificationId`, `type`, `notificationType` là key hệ thống.

Ví dụ payload mà mobile nhận:

```json
{
  "notification": {
    "title": "Phân công chuyến mới",
    "body": "Bạn được phân công chuyến Sài Gòn - Đà Lạt (51B-123.45)."
  },
  "data": {
    "notificationId": "uuid",
    "type": "TRIP_ASSIGNED",
    "notificationType": "TRIP_ASSIGNED",
    "tripId": "uuid",
    "operatorId": "uuid",
    "routeName": "Sài Gòn - Đà Lạt",
    "vehiclePlateNumber": "51B-123.45",
    "departureDateTime": "2026-07-12T01:00:00+00:00"
  }
}
```

## Độ Tin Cậy Delivery và Idempotency

| Thành phần | Hành vi hiện tại |
|---|---|
| RabbitMQ consumer | Durable processed marker + processing lock; chỉ mark processed sau khi DB/BullMQ thành công hoặc chủ đích drop payload malformed. Cùng message ID nhưng payload khác bị từ chối. |
| Retry/DLQ | Transient failure đi qua delayed retry có giới hạn. Khi hết retry, original message chỉ được ACK sau khi broker confirm publish vào DLQ. |
| In-app notification | Unique `dedupe_key` đảm bảo replay không tạo row trùng cho cùng event/người nhận/type. |
| DB → BullMQ recovery | Nếu DB persist thành công nhưng queue add thất bại, replay/reconciliation enqueue lại job xác định từ cùng DB row. |
| FCM | Job ID xác định theo notification; kiểm tra token blacklist ngay trước mỗi lần gửi; token invalid được deactivate; delivery audit dùng `PENDING/RETRYING/SENT/FAILED/VALIDATED`. |
| Email | Durable dedupe key; trạng thái `PENDING → SENDING → SENT/RETRYING/FAILED`; lease `SENDING` stale được reclaim. CAS dùng timestamp PostgreSQL đầy đủ microsecond để worker cũ không ghi đè lease mới. |
| Unicode | Toàn bộ title/body/email subject/text/HTML do hệ thống sinh dùng tiếng Việt đầy đủ dấu. Placeholder động được giữ nguyên; nội dung operator nhập không bị tự sửa. |
| Bảo mật | Sentry `sendDefaultPii=false`; log/Sentry scrub JWT, FCM token, email, signed URL và raw payload nhạy cảm. |

Không backfill notification lịch sử. Khi triển khai schema/event mới, môi trường được clear/reset theo quyết định dự án.

## Tích Hợp FE/Mobile

### Đăng ký FCM token

Đây là API của Identity nhưng là điều kiện để mobile nhận push từ Notification service:

```http
POST /v1/auth/device-token
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "fcmToken": "token do Firebase Messaging cấp",
  "platform": "ANDROID"
}
```

`platform` nhận `ANDROID`, `IOS` hoặc `WEB`. Mobile gọi API này sau login, sau khi Firebase token đổi và sau khi user cấp notification permission. Khi logout hoặc user tắt nhận thông báo, gọi `DELETE /v1/auth/device-token` theo API Identity.

### Hành vi FE/mobile nên thực hiện

1. Khi app foreground hoặc user mở push, đọc `data.notificationId` và gọi `GET /v1/notifications` để lấy lịch sử/in-app state chính xác.
2. Route theo `data.type`: `TRIP_ASSIGNED` mở chi tiết chuyến; `TRIP_UPDATE` mở chuyến; `PARCEL_UPDATE` mở kiện hàng; `NOTIFICATION` mở inbox thông báo.
3. Dùng `data.notificationType` khi cần phân biệt chi tiết, ví dụ `TRIP_ASSIGNMENT_REMOVED` để gỡ chuyến khỏi danh sách công việc local.
4. Khi user đọc notification trong inbox, gọi `POST /v1/notifications/{notificationId}/read`; endpoint thành công trả `204 No Content`.
5. Không xem FCM là source of truth: app có thể bị mất push khi offline, vì vậy inbox `GET /v1/notifications` luôn là nguồn hiển thị chính.

## Verification T1–T9

Lệnh real-stack chọn lọc:

```bash
npm run e2e:notification-v1
```

Matrix này khởi tạo PostgreSQL, Redis, RabbitMQ, Notification, Gateway và dependency fixture cô lập; kiểm tra crash/redelivery, durable idempotency, passenger route/delay, crew/operator fan-out, Parcel review/timeout/recovery, producer mới, retry → DLQ, DB → queue recovery và Unicode qua Gateway.

Verification chuẩn:

```bash
npx nx run notification:lint
npx nx run notification:test -- --runInBand
npx nx run notification:test:e2e -- --runInBand
npx nx run notification:build
npx nx run notification-e2e:e2e
npx nx run gateway-e2e:e2e
git diff --check
```

Kết quả nghiệm thu ngày 2026-07-28: lint `0` error; unit `233/233`; component E2E `22/22`; Gateway E2E cô lập `2/2`; build và real-stack Notification v1 matrix đều pass.

## Lưu Ý Flow Và Hành Vi Đặc Biệt

1. Notification in-app không được tạo bằng REST endpoint public tùy ý. `NotificationsService.createNotification()` được dùng bởi consumer/service nội bộ; `POST /v1/operator/notifications` là ngoại lệ có kiểm soát role, operator scope và Idempotency-Key. FCM job luôn được enqueue sau khi lấy notification, kể cả khi dedupe key trả về row đã tồn tại.
2. `POST /v1/notifications/:notificationId/read` chống IDOR bằng `findFirst({ id, userId })`; notification không thuộc user hiện tại trả 404 như không tồn tại.
3. `PATCH /v1/notifications/:id` không tồn tại trong controller hiện tại.
4. Token user hết hạn hoặc invalid:
   - Qua Gateway: thường nhận `401 AUTH_TOKEN_INVALID`.
   - Gọi trực tiếp service: nhận `401 UNAUTHORIZED`.
   FE/mobile nên refresh token bằng Identity service rồi retry request gốc.
5. Gateway route `/v1/notifications` không yêu cầu role cụ thể, nhưng phone gate ở Gateway có thể chặn role `PASSENGER` nếu claim `hasPhone` không phải `true`. Route `/v1/operator/notifications` chỉ cho `OPERATOR_ADMIN` và `OPERATOR_STAFF`.
6. Service có Swagger trực tiếp ở `/docs`; Gateway aggregator ở `/docs`.
7. Internal email enqueue bắt buộc `Idempotency-Key` UUID v4, tạo/lấy lại delivery durable rồi worker nền xử lý SendGrid.
8. Dependency recipient lookup lỗi phải retry/fail closed; FE không nên suy luận rằng không có notification chỉ vì một dependency tạm thời unavailable.
9. Không backfill nội dung notification lịch sử; Unicode đầy đủ áp dụng cho notification mới được tạo sau thay đổi.

## Rà Soát Lại Với Code

Đã đối chiếu lại với các file chính:

| Hạng mục | File đã kiểm tra | Kết luận |
|---|---|---|
| Gateway route | `apps/gateway/src/config/routes.ts` | Expose `/v1/notifications`, `/v1/operator/notifications` và `/api-specs/notification` cho Notification qua Gateway |
| Notification module | `apps/notification/src/app/app.module.ts`, `apps/notification/src/notifications/notifications.module.ts` | Controller được đăng ký: `HealthController`, `ReadyController`, `NotificationsController`, `OperatorNotificationsController`, `InternalEmailsController` |
| Controller HTTP | `notifications.controller.ts`, `operator-notifications.controller.ts`, `internal-emails.controller.ts`, `health.controller.ts`, `ready.controller.ts` | Endpoint thật đúng như bảng tổng quan |
| DTO/Zod | `list-notifications-query.dto.ts`, `notification-param.dto.ts`, `create-email-send.dto.ts`, `create-operator-announcement.dto.ts` | Validation/default đã ghi theo schema |
| Auth | `user-jwt-auth.guard.ts`, `user-jwt.verifier.ts`, `internal-jwt-auth.guard.ts` | Header/token/issuer/audience/claim đã ghi theo code |
| Response envelope | `ApiResponseInterceptor`, `ApiResponseExceptionFilter`, `ZodValidationPipe` | Success/error shape và validation fields đã ghi theo code |
| DB enum/response fields | `apps/notification/prisma/schema.prisma`, `notifications.service.ts` | Đồng bộ đầy đủ Notification type v1, `EmailDeliveryStatus.SENDING` và `NotificationDeliveryStatus.VALIDATED` |
| Event registry/consumer | `libs/shared/contracts/src/events/**`, `*-events.constants.ts`, `*-events.consumer.ts` | Đồng bộ producer facts, routing key, Zod payload, durable idempotency và recipient policy T1–T8 |
| Push/email worker | `fcm-push.worker.ts`, `email-send.worker.ts`, `notifications.repository.ts` | FCM blacklist/deactivate, DB→queue recovery, email lease reclaim và microsecond-safe CAS |
| Retry/DLQ | `libs/shared/nest-rabbitmq/src/rabbitmq.consumer.ts` | Delayed retry giới hạn; chỉ ACK original sau broker-confirmed DLQ publish |
| Bảo mật/observability | `notification-logger.ts`, `notification-sentry*.ts`, `main.ts` | Pino + Sentry, không gửi PII mặc định và scrub dữ liệu nhạy cảm |
| Real-stack acceptance | `scripts/run-notification-idempotency-e2e.mjs`, `infra/docker/docker-compose.notification-idempotency-e2e.yml` | Bao phủ crash/redelivery, recipient fan-out, Parcel, producer mới, DLQ, recovery và Gateway Unicode |

⚠️ TODO: cần xác nhận thêm exact production exposure cho direct Notification service và exact runtime `429` message từ `@nestjs/throttler`; source hiện chỉ cho biết rate limit và status/code mapping.
