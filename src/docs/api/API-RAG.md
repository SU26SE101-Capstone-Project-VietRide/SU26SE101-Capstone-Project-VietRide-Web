# VietRide RAG Service API

Tài liệu này được lập từ source code hiện tại của `apps/rag`, `apps/gateway` và các shared NestJS libs. Chỉ ghi các endpoint RAG thực sự được đăng ký trong `AppModule`/module tree.

## Mục Lục

- [Base URL](#base-url)
- [Xác thực chung](#xác-thực-chung)
- [Response envelope](#response-envelope)
- [Quy ước chung](#quy-ước-chung)
- [Tổng quan endpoint](#tổng-quan-endpoint)
- [Health](#health)
- [RAG Chat](#rag-chat)
- [RAG Feedback](#rag-feedback)
- [RAG Documents](#rag-documents)
- [RAG Runtime Config Admin](#rag-runtime-config-admin)

## Base URL

| Môi trường | Base URL public qua Gateway | Base URL trực tiếp service RAG | Nguồn trong code/config |
|---|---:|---:|---|
| Local Gateway | `http://localhost:3000` | `http://localhost:3003` | `GATEWAY_PORT=3000`, `RAG_BASE_URL=http://localhost:3003`, `PORT` RAG default `3003` |
| Docker nội bộ | `http://gateway:3000` | `http://rag:3003` | `.env.example`, `infra/docker/docker-compose.yml` |
| Production hiện có | `https://api.vietride.online` | Không expose trực tiếp trong source | User cung cấp Swagger URL `https://api.vietride.online/docs` |

Swagger RAG service được mount tại `/docs` trên service RAG. Qua Gateway có route spec `/api-specs/rag` rewrite tới `/docs-json`.

## Xác thực chung

Frontend/Mobile gọi Gateway bằng user access token:

```http
Authorization: Bearer <accessToken>
```

Gateway xác thực user JWT bằng RS256 JWKS:

| Thuộc tính | Giá trị trong code |
|---|---|
| JWKS default | `http://identity:5001/v1/.well-known/jwks.json` |
| issuer | `vietride-identity` |
| audience | `vietride-api` |
| algorithms | `RS256` |
| clockTolerance | `5` giây |

Sau khi token hợp lệ, Gateway mint internal JWT HS256 TTL mặc định `120` giây và forward xuống RAG:

```http
X-Internal-Auth: Bearer <internalJwt>
X-Request-Id: <request-id>
```

RAG service chỉ kiểm tra `X-Internal-Auth` bằng `InternalJwtAuthGuard`:

| Internal JWT claim/header | Rule |
|---|---|
| header | `X-Internal-Auth: Bearer <jwt>` |
| issuer | `vietride-gateway` |
| audience | `vietride-internal` |
| algorithm | `HS256` |
| secret env | `INTERNAL_JWT_SECRET` |
| required claim | `sub` |
| optional claims | `role`, `operatorId`, `reqId` |

Public client không tự tạo `X-Internal-Auth`; header này do Gateway tạo. Nếu gọi trực tiếp `http://localhost:3003`, phải có internal JWT hợp lệ.

Gateway RBAC cho RAG:

| Prefix | Gateway auth | Gateway role gate |
|---|---|---|
| `/v1/rag` | user JWT bắt buộc | Không có role gate ở Gateway |
| `/v1/admin/rag-config` | user JWT bắt buộc | `SYSTEM_ADMIN` |

Service-level role rules:

| API | Role được chấp nhận |
|---|---|
| Chat | `PASSENGER`, `SYSTEM_ADMIN`, `DRIVER`, `ASSISTANT`, `OPERATOR_STAFF`, `OPERATOR_ADMIN`; các role operator-scoped phải có `operatorId` claim |
| Feedback create | Caller phải là owner của conversation/message |
| Feedback list | `SYSTEM_ADMIN` |
| Documents | `SYSTEM_ADMIN` |
| Runtime config admin | `SYSTEM_ADMIN` |

## Response envelope

Các response HTTP thành công thông thường được `ApiResponseInterceptor` wrap:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "meta": {
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

Response lỗi được `RagSentryExceptionFilter`/`ApiResponseExceptionFilter` wrap:

```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "fields": [
      { "field": "message", "message": "String must contain at least 1 character(s)" }
    ]
  },
  "meta": {
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

Riêng `POST /v1/rag/chat` trả `text/event-stream`, không trả JSON envelope khi thành công.

## Quy ước chung

| Quy ước | Giá trị |
|---|---|
| Date/time | ISO 8601 string từ `Date.toISOString()` trong response DTO hoặc `Date` object được JSON serialize |
| UUID | Zod `z.string().uuid()` hoặc Nest `ParseUUIDPipe` |
| Error code | `UPPER_SNAKE_CASE` |
| Validation | Zod qua `ZodValidationPipe`; lỗi code `VALIDATION_FAILED` |
| Upload file field | `file` |
| Upload hard cap ở Multer | `10 * 1024 * 1024` bytes |
| Upload runtime max default | `documents.max_file_bytes = 5 * 1024 * 1024` bytes |
| Upload extension default | `.txt`, `.md`, `.markdown` |
| Upload MIME default | `text/plain`, `text/markdown`, `text/x-markdown`, `application/octet-stream` |
| Chat rate limit window | 1 giờ |
| Chat rate limit default | user/passenger/admin: `20`/giờ, operator-scoped roles: `200`/giờ |

Gateway có thể trả lỗi trước khi request tới RAG:

| Status | code | Nguyên nhân |
|---:|---|---|
| 401 | `AUTH_TOKEN_INVALID` | Thiếu/sai/expired `Authorization` user JWT ở Gateway |
| 403 | `FORBIDDEN` | Không đủ role ở Gateway, áp dụng cho `/v1/admin/rag-config` |
| 403 | `AUTH_PHONE_REQUIRED` | `PASSENGER` chưa hoàn tất phone profile theo Gateway gate |
| 404 | `ROUTE_NOT_FOUND` | Không có route Gateway |
| 502 | `UPSTREAM_UNAVAILABLE` | Gateway không gọi được RAG upstream |

## Tổng quan endpoint

| Method | Public path qua Gateway | Mô tả ngắn |
|---|---|---|
| GET | `/health` | Liveness probe của RAG khi gọi trực tiếp service |
| GET | `/ready` | Readiness probe của RAG khi gọi trực tiếp service |
| POST | `/v1/rag/chat` | Chat RAG dạng SSE |
| POST | `/v1/rag/messages/:messageId/feedback` | Tạo/cập nhật feedback cho assistant message |
| GET | `/v1/rag/feedback` | Admin xem danh sách feedback |
| GET | `/v1/rag/documents` | Admin xem danh sách document knowledge base |
| POST | `/v1/rag/documents` | Upload document knowledge base, auto approve và enqueue ingest |
| PUT | `/v1/rag/documents/:documentId/approve` | Approve document đang `PENDING_REVIEW` |
| GET | `/v1/admin/rag-config` | Admin list runtime config |
| POST | `/v1/admin/rag-config/reload` | Admin reload runtime config cache |
| GET | `/v1/admin/rag-config/:key` | Admin xem chi tiết config key |
| PATCH | `/v1/admin/rag-config/:key` | Admin cập nhật config key |
| GET | `/v1/admin/rag-config/:key/history` | Admin xem lịch sử config key |
| POST | `/v1/admin/rag-config/:key/rollback` | Admin rollback config key |

## Health

### GET `/health`

Liveness probe trực tiếp của RAG service. Controller này không có guard.

**Headers bắt buộc:** Không có.

**Path/Query/Body:** Không có.

**Response 200**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "status": "ok",
    "service": "rag"
  },
  "meta": {
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

**Lỗi:** Không có lỗi custom trong controller. Lỗi runtime chưa được code đặc tả: ⚠️ TODO: cần xác nhận thêm.

```bash
curl -s http://localhost:3003/health
```

```js
const res = await fetch('http://localhost:3003/health');
console.log(await res.json());
```

### GET `/ready`

Readiness probe trực tiếp của RAG service, kiểm tra Prisma, Redis, RabbitMQ, Cloudinary config và OpenRouter embedding probe.

**Headers bắt buộc:** Không có.

**Path/Query/Body:** Không có.

**Response 200**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "status": "ok",
    "service": "rag",
    "dependencies": {
      "prisma": "ok",
      "redis": "ok",
      "rabbitmq": "ok",
      "cloudinary": "ok",
      "openrouter": "ok"
    }
  },
  "meta": {
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

**Response lỗi**

| Status | code | Nguyên nhân |
|---:|---|---|
| 503 | `RAG_DEPENDENCY_UNAVAILABLE` | HTTP response thực tế khi bất kỳ dependency readiness nào fail: Prisma, Redis, RabbitMQ, Cloudinary config hoặc OpenRouter embedding probe. Source: `apps/rag/src/app/readiness.service.ts:34-48`. |

Lưu ý debug: `checkCloudinaryConfig()` có ném nội bộ `RAG_STORAGE_CONFIG_UNAVAILABLE` tại `apps/rag/src/app/readiness.service.ts:76-87`, và `EmbeddingDimensionProbeService.probe()` có thể ném nội bộ `RAG_EMBEDDING_DIMENSION_MISMATCH` tại `apps/rag/src/embedding/embedding-dimension-probe.service.ts:15-27`. Tuy nhiên cả hai đều nằm trong `Promise.all(...)` của `ReadinessService.check()` và bị `catch` chung đổi thành HTTP response `RAG_DEPENDENCY_UNAVAILABLE`.

```json
{
  "success": false,
  "statusCode": 503,
  "error": {
    "code": "RAG_DEPENDENCY_UNAVAILABLE",
    "message": "RAG dependency readiness check failed"
  },
  "meta": {
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

```bash
curl -s http://localhost:3003/ready
```

```js
const res = await fetch('http://localhost:3003/ready');
console.log(await res.json());
```

## RAG Chat

### POST `/v1/rag/chat`

Chat với knowledge base RAG, response thành công là SSE.

**Headers bắt buộc khi gọi qua Gateway**

| Header | Bắt buộc | Giá trị |
|---|---|---|
| `Authorization` | Có | `Bearer <accessToken>` |
| `Content-Type` | Có | `application/json` |

**Headers bắt buộc khi gọi trực tiếp RAG**

| Header | Bắt buộc | Giá trị |
|---|---|---|
| `X-Internal-Auth` | Có | `Bearer <internalJwt>` |
| `Content-Type` | Có | `application/json` |

**Request body**

```json
{
  "conversationId": "11111111-1111-4111-8111-111111111111",
  "message": "Tôi có thể hủy vé như thế nào?",
  "operatorId": "22222222-2222-4222-8222-222222222222"
}
```

| Field | Kiểu | Bắt buộc | Validation/rule |
|---|---|---:|---|
| `conversationId` | string UUID | Không | Nếu có phải là UUID; conversation phải tồn tại và thuộc caller |
| `message` | string | Có | `trim()`, min `1`, max `4000` trong DTO; thêm runtime limit `RAG_MAX_MESSAGE_CHARS` default `4000` |
| `operatorId` | string UUID | Không | Chỉ `SYSTEM_ADMIN` được gửi; dùng scope retrieval theo operator |

**Response 200 `text/event-stream`**

```text
event: token
data: {"content":"Xin chào"}

event: done
data: {"conversationId":"...","userMessageId":"...","assistantMessageId":"...","citedChunkIds":["..."]}
```

SSE events:

| Event | data fields |
|---|---|
| `token` | `content: string` |
| `done` | `conversationId: string`, `userMessageId: string`, `assistantMessageId: string`, `citedChunkIds: string[]` |
| `error` | `code: string`, `message: string`; hiện stream catch trả `RAG_PROVIDER_UNAVAILABLE` |

**Response lỗi trước khi stream bắt đầu**

| Status | code | Nguyên nhân |
|---:|---|---|
| 400 | `VALIDATION_FAILED` | Body sai Zod schema |
| 400 | `RAG_MESSAGE_TOO_LONG` | `message.length` vượt `RAG_MAX_MESSAGE_CHARS` runtime |
| 401 | `UNAUTHORIZED` | Thiếu/sai internal bearer token khi tới RAG |
| 403 | `INSUFFICIENT_ROLE` | Thiếu role hoặc role không được chat |
| 403 | `RAG_OPERATOR_SCOPE_FORBIDDEN` | Non-`SYSTEM_ADMIN` gửi `operatorId` |
| 403 | `RAG_OPERATOR_SCOPE_REQUIRED` | `DRIVER`/`ASSISTANT`/`OPERATOR_STAFF`/`OPERATOR_ADMIN` thiếu `operatorId` claim |
| 403 | `RAG_CONVERSATION_FORBIDDEN` | Conversation không thuộc caller hoặc scope operator không khớp |
| 403 | `RAG_CONVERSATION_SCOPE_MISMATCH` | `SYSTEM_ADMIN` cố đổi operator scope của conversation cũ |
| 404 | `RAG_CONVERSATION_NOT_FOUND` | `conversationId` không tồn tại |
| 429 | `RAG_RATE_LIMIT_EXCEEDED` | Vượt Redis rate limit theo giờ |
| 503 | `RAG_PROVIDER_RATE_LIMITED` | OpenRouter provider rate-limited khi embed trước stream |
| 503 | `RAG_PROVIDER_UNAVAILABLE` | OpenRouter/provider unavailable trước stream |
| 503 | `RAG_PROVIDER_INVALID_RESPONSE` | Embedding provider trả response không hợp lệ |
| 503 | `RAG_PROVIDER_CIRCUIT_OPEN` | Provider circuit đang mở |

```json
{
  "success": false,
  "statusCode": 403,
  "error": {
    "code": "RAG_OPERATOR_SCOPE_FORBIDDEN",
    "message": "Only SYSTEM_ADMIN can specify operatorId"
  },
  "meta": {
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

**curl**

```bash
curl -N -X POST "http://localhost:3000/v1/rag/chat" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Tôi có thể hủy vé như thế nào?"}'
```

**fetch**

```js
const res = await fetch('http://localhost:3000/v1/rag/chat', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ message: 'Tôi có thể hủy vé như thế nào?' }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  console.log(decoder.decode(value, { stream: true }));
}
```

**Lưu ý đặc biệt**

- Flow feedback cần `assistantMessageId` từ event `done`.
- `PASSENGER` chỉ retrieve document `PUBLIC`.
- Operator-scoped roles retrieve `PUBLIC` + `OPERATOR` và bị ràng scope `operatorId`.
- `SYSTEM_ADMIN` retrieve `PUBLIC` + `OPERATOR` + `ADMIN`.
- Khi token hết hạn, Gateway trả `401 AUTH_TOKEN_INVALID`; client cần refresh token qua Identity flow, không retry trực tiếp RAG.

## RAG Feedback

### POST `/v1/rag/messages/:messageId/feedback`

Tạo hoặc cập nhật feedback cho một assistant RAG message.

**Headers bắt buộc:** `Authorization: Bearer <accessToken>`, `Content-Type: application/json`.

**Path params**

| Param | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `messageId` | string UUID | Có | Zod `z.string().uuid()` |

**Request body**

```json
{
  "rating": 1
}
```

| Field | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `rating` | number | Có | integer, min `-1`, max `1`, không được `0`; giá trị hợp lệ thực tế: `-1`, `1` |

**Response 201**

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "33333333-3333-4333-8333-333333333333",
    "messageId": "44444444-4444-4444-8444-444444444444",
    "conversationId": "55555555-5555-4555-8555-555555555555",
    "userId": "66666666-6666-4666-8666-666666666666",
    "rating": 1,
    "queryRewritten": null,
    "chunkIds": [],
    "responseLength": 120,
    "createdAt": "2026-07-05T10:00:00.000Z",
    "updatedAt": "2026-07-05T10:00:00.000Z"
  },
  "meta": {
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

**Response lỗi**

| Status | code | Nguyên nhân |
|---:|---|---|
| 400 | `VALIDATION_FAILED` | `messageId` hoặc body không hợp lệ |
| 401 | `UNAUTHORIZED` | Thiếu/sai internal bearer token khi tới RAG |
| 403 | `INSUFFICIENT_ROLE` | Thiếu `sub` hoặc `role` trong internal JWT |
| 403 | `RAG_FEEDBACK_FORBIDDEN` | Message/conversation không thuộc caller |
| 404 | `RAG_MESSAGE_NOT_FOUND` | Không tìm thấy message |
| 422 | `RAG_FEEDBACK_ASSISTANT_ONLY` | Message không phải role `ASSISTANT` |
| 500 | `INTERNAL_ERROR` | Lỗi không được catch cụ thể |

```bash
curl -X POST "http://localhost:3000/v1/rag/messages/$ASSISTANT_MESSAGE_ID/feedback" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rating":1}'
```

```js
const res = await fetch(`http://localhost:3000/v1/rag/messages/${assistantMessageId}/feedback`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ rating: 1 }),
});
console.log(await res.json());
```

### GET `/v1/rag/feedback`

Admin audit danh sách feedback.

**Headers bắt buộc:** `Authorization: Bearer <SYSTEM_ADMIN accessToken>`.

**Query params**

| Param | Kiểu | Bắt buộc | Default | Validation |
|---|---|---:|---:|---|
| `page` | number | Không | `1` | coerced number, int, positive |
| `pageSize` | number | Không | `20` | coerced number, int, positive, max `100` |
| `sortBy` | string | Không | `createdAt` | enum `createdAt`, `rating` |
| `sortDir` | string | Không | `desc` | enum `asc`, `desc` |

**Response 200**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": "33333333-3333-4333-8333-333333333333",
        "messageId": "44444444-4444-4444-8444-444444444444",
        "conversationId": "55555555-5555-4555-8555-555555555555",
        "userId": "66666666-6666-4666-8666-666666666666",
        "rating": 1,
        "queryRewritten": null,
        "chunkIds": [],
        "responseLength": 120,
        "createdAt": "2026-07-05T10:00:00.000Z",
        "updatedAt": "2026-07-05T10:00:00.000Z",
        "message": {
          "id": "44444444-4444-4444-8444-444444444444",
          "role": "ASSISTANT",
          "content": "Nội dung trả lời",
          "citedChunkIds": [],
          "createdAt": "2026-07-05T10:00:00.000Z"
        },
        "conversation": {
          "id": "55555555-5555-4555-8555-555555555555",
          "userId": "66666666-6666-4666-8666-666666666666",
          "operatorId": null,
          "role": "PASSENGER"
        }
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
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

**Response lỗi**

| Status | code | Nguyên nhân |
|---:|---|---|
| 400 | `VALIDATION_FAILED` | Query không hợp lệ |
| 401 | `UNAUTHORIZED` | Thiếu/sai internal bearer token khi tới RAG |
| 403 | `INSUFFICIENT_ROLE` | Thiếu `sub` hoặc `role` |
| 403 | `RAG_ADMIN_REQUIRED` | Role không phải `SYSTEM_ADMIN` |
| 500 | `INTERNAL_ERROR` | Lỗi không được catch cụ thể |

```bash
curl "http://localhost:3000/v1/rag/feedback?page=1&pageSize=20&sortBy=createdAt&sortDir=desc" \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN"
```

```js
const res = await fetch('http://localhost:3000/v1/rag/feedback?page=1&pageSize=20', {
  headers: { Authorization: `Bearer ${systemAdminToken}` },
});
console.log(await res.json());
```

## RAG Documents

### GET `/v1/rag/documents`

Admin audit danh sách document knowledge base.

**Headers bắt buộc:** `Authorization: Bearer <SYSTEM_ADMIN accessToken>`.

**Query params**

| Query | Kiểu | Bắt buộc | Default | Rule |
|---|---|---:|---|---|
| `page` | number | Không | `1` | Số nguyên dương |
| `pageSize` | number | Không | `20` | Số nguyên dương, tối đa `100` |
| `sortBy` | string | Không | `createdAt` | `createdAt`, `updatedAt`, `title`, `status`, `ingestStatus` |
| `sortDir` | string | Không | `desc` | `asc`, `desc` |
| `status` | string | Không |  | `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `ARCHIVED` |
| `ingestStatus` | string | Không |  | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `accessLevel` | string | Không |  | `PUBLIC`, `OPERATOR`, `ADMIN` |
| `category` | string | Không |  | `CUSTOMER_SUPPORT`, `OPERATOR_POLICY`, `PLATFORM_ADMIN` |
| `documentType` | string | Không |  | `FAQ`, `POLICY`, `SOP`, `GUIDE`, `TERMS` |
| `operatorId` | string UUID | Không |  | Lọc document theo operator |
| `q` | string | Không |  | Tìm trong `title`, `fileName`, `description` |

**Response 200**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": "77777777-7777-4777-8777-777777777777",
        "title": "Chính sách hủy vé",
        "description": null,
        "storagePath": "documents/88888888-8888-4888-8888-888888888888.md",
        "fileName": "policy.md",
        "mimeType": "text/markdown",
        "fileSize": "1024",
        "fileType": "MARKDOWN",
        "accessLevel": "PUBLIC",
        "operatorId": null,
        "category": "CUSTOMER_SUPPORT",
        "documentType": "POLICY",
        "audienceRoles": [],
        "language": "vi",
        "status": "APPROVED",
        "ingestStatus": "COMPLETED",
        "createdAt": "2026-07-05T10:00:00.000Z",
        "updatedAt": "2026-07-05T10:00:00.000Z",
        "approvedAt": "2026-07-05T10:00:00.000Z"
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
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

**Response lỗi**

| Status | code | Nguyên nhân |
|---:|---|---|
| 400 | `VALIDATION_FAILED` | Query không hợp lệ |
| 401 | `UNAUTHORIZED` | Thiếu/sai internal bearer token khi tới RAG |
| 403 | `INSUFFICIENT_ROLE` | Không phải `SYSTEM_ADMIN` |
| 500 | `INTERNAL_ERROR` | Lỗi không được catch cụ thể |

```bash
curl "http://localhost:3000/v1/rag/documents?page=1&pageSize=20&status=APPROVED&sortBy=createdAt&sortDir=desc" \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN"
```

```js
const res = await fetch('http://localhost:3000/v1/rag/documents?page=1&pageSize=20', {
  headers: { Authorization: `Bearer ${systemAdminToken}` },
});
console.log(await res.json());
```

### POST `/v1/rag/documents`

Upload document knowledge base, auto approve và tạo outbox event `rag.document.ingest_requested`.

**Headers bắt buộc:** `Authorization: Bearer <SYSTEM_ADMIN accessToken>`. Không set tay `Content-Type` khi dùng `FormData`; client tự set multipart boundary.

**Request body multipart/form-data**

| Field | Kiểu | Bắt buộc | Validation/rule |
|---|---|---:|---|
| `file` | binary | Có | Multer field `file`; hard cap `10MiB`; runtime max default `5MiB`; extension default `.txt`, `.md`, `.markdown`; MIME default `text/plain`, `text/markdown`, `text/x-markdown`, `application/octet-stream` |
| `title` | string | Có | `trim()`, min `1`, max `500` |
| `description` | string | Không | `''` thành `undefined`, sau đó `trim()` |
| `accessLevel` | string | Có | enum `PUBLIC`, `OPERATOR`, `ADMIN` |
| `operatorId` | string UUID | Không | `''` hoặc `'null'` thành `undefined` |
| `category` | string | Có | enum `CUSTOMER_SUPPORT`, `OPERATOR_POLICY`, `PLATFORM_ADMIN` |
| `documentType` | string | Có | enum `FAQ`, `POLICY`, `SOP`, `GUIDE`, `TERMS` |
| `audienceRoles` | string hoặc array | Không | CSV string hoặc JSON array string; default `[]`; item string min `1` |
| `language` | string | Không | literal `vi`, default `vi` |

Taxonomy rules:

| accessLevel | Rule |
|---|---|
| `PUBLIC` | `category` phải là `CUSTOMER_SUPPORT`, không được có `operatorId` |
| `OPERATOR` | `category` phải là `OPERATOR_POLICY` |
| `ADMIN` | `category` phải là `PLATFORM_ADMIN` |

**Response 201**

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "77777777-7777-4777-8777-777777777777",
    "title": "Chính sách hủy vé",
    "description": null,
    "storagePath": "documents/88888888-8888-4888-8888-888888888888.md",
    "fileName": "policy.md",
    "mimeType": "text/markdown",
    "fileSize": "1024",
    "fileType": "MARKDOWN",
    "accessLevel": "PUBLIC",
    "operatorId": null,
    "category": "CUSTOMER_SUPPORT",
    "documentType": "POLICY",
    "audienceRoles": [],
    "language": "vi",
    "status": "APPROVED",
    "ingestStatus": "PENDING",
    "previewUrl": "https://...",
    "createdAt": "2026-07-05T10:00:00.000Z",
    "updatedAt": "2026-07-05T10:00:00.000Z",
    "approvedAt": "2026-07-05T10:00:00.000Z"
  },
  "meta": {
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

**Response lỗi**

| Status | code | Nguyên nhân |
|---:|---|---|
| 400 | `VALIDATION_FAILED` | Multipart fields sai Zod schema |
| 400 | `RAG_DOCUMENT_FILE_REQUIRED` | Thiếu file |
| 400 | `RAG_DOCUMENT_FILE_INVALID_SIZE` | File size `<=0` hoặc vượt runtime `documents.max_file_bytes` |
| 400 | `RAG_DOCUMENT_FILE_INVALID_TYPE` | MIME/extension không nằm trong runtime config |
| 400 | `RAG_DOCUMENT_TAXONOMY_INVALID` | `accessLevel`/`category`/`operatorId` không đúng taxonomy |
| 401 | `UNAUTHORIZED` | Thiếu/sai internal bearer token khi tới RAG |
| 403 | `INSUFFICIENT_ROLE` | Không phải `SYSTEM_ADMIN` |
| 503 | `RAG_STORAGE_UNAVAILABLE` | Cloudinary upload/signed URL lỗi |
| 503 | `RAG_STORAGE_INVALID_RESPONSE` | Cloudinary trả response không hợp lệ |
| 500 | `INTERNAL_ERROR` | Lỗi không được catch cụ thể |

⚠️ TODO: cần xác nhận thêm shape lỗi Multer khi vượt hard cap `10MiB`; source chỉ cấu hình `FileInterceptor` limit, không có filter riêng.

```bash
curl -X POST "http://localhost:3000/v1/rag/documents" \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  -F "file=@./policy.md;type=text/markdown" \
  -F "title=Chính sách hủy vé" \
  -F "accessLevel=PUBLIC" \
  -F "category=CUSTOMER_SUPPORT" \
  -F "documentType=POLICY" \
  -F "audienceRoles=[]" \
  -F "language=vi"
```

```js
const form = new FormData();
form.append('file', fileInput.files[0]);
form.append('title', 'Chính sách hủy vé');
form.append('accessLevel', 'PUBLIC');
form.append('category', 'CUSTOMER_SUPPORT');
form.append('documentType', 'POLICY');
form.append('audienceRoles', '[]');
form.append('language', 'vi');

const res = await fetch('http://localhost:3000/v1/rag/documents', {
  method: 'POST',
  headers: { Authorization: `Bearer ${systemAdminToken}` },
  body: form,
});
console.log(await res.json());
```

### PUT `/v1/rag/documents/:documentId/approve`

Approve document đang `PENDING_REVIEW`, set `status=APPROVED`, `ingestStatus=PENDING`, tạo outbox event ingest.

**Headers bắt buộc:** `Authorization: Bearer <SYSTEM_ADMIN accessToken>`.

**Path params**

| Param | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `documentId` | string UUID | Có | Nest `ParseUUIDPipe` |

**Request body:** Không có.

**Response 200**

Trả `KnowledgeDocumentResponse` giống upload nhưng thường không có `previewUrl`.

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "77777777-7777-4777-8777-777777777777",
    "title": "Chính sách hủy vé",
    "description": null,
    "storagePath": "documents/file.md",
    "fileName": "policy.md",
    "mimeType": "text/markdown",
    "fileSize": "1024",
    "fileType": "MARKDOWN",
    "accessLevel": "PUBLIC",
    "operatorId": null,
    "category": "CUSTOMER_SUPPORT",
    "documentType": "POLICY",
    "audienceRoles": [],
    "language": "vi",
    "status": "APPROVED",
    "ingestStatus": "PENDING",
    "createdAt": "2026-07-05T10:00:00.000Z",
    "updatedAt": "2026-07-05T10:00:00.000Z",
    "approvedAt": "2026-07-05T10:00:00.000Z"
  },
  "meta": {
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

**Response lỗi**

| Status | code | Nguyên nhân |
|---:|---|---|
| 400 | `BAD_REQUEST` | UUID path sai. Controller dùng `ParseUUIDPipe` tại `apps/rag/src/documents/documents.controller.ts:100-104`; pipe không gắn `errorCode`, nên `ApiResponseExceptionFilter` fallback status 400 thành `BAD_REQUEST` tại `libs/shared/nest-common/src/filters/api-response-exception.filter.ts:73-79` và `:111-115`. |
| 401 | `UNAUTHORIZED` | Thiếu/sai internal bearer token khi tới RAG |
| 403 | `INSUFFICIENT_ROLE` | Không phải `SYSTEM_ADMIN` |
| 404 | `RAG_DOCUMENT_NOT_FOUND` | Không tìm thấy document |
| 409 | `RAG_DOCUMENT_STATUS_CONFLICT` | Document không ở `PENDING_REVIEW` |
| 500 | `INTERNAL_ERROR` | Lỗi không được catch cụ thể |

```bash
curl -X PUT "http://localhost:3000/v1/rag/documents/$DOCUMENT_ID/approve" \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN"
```

```js
const res = await fetch(`http://localhost:3000/v1/rag/documents/${documentId}/approve`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${systemAdminToken}` },
});
console.log(await res.json());
```

## RAG Runtime Config Admin

Runtime config keys trong code:

| key | valueType | editableGroup | riskLevel | requiresRestart |
|---|---|---|---|---|
| `chat.system_prompt` | `template` | `admin` | `medium` | `false` |
| `chat.no_context_text` | `string` | `admin` | `low` | `false` |
| `chat.no_summary_text` | `string` | `admin` | `low` | `false` |
| `chat.insufficient_context_message` | `string` | `admin` | `low` | `false` |
| `intent.off_topic_refusal` | `string` | `admin` | `low` | `false` |
| `intent.classifier_prompt` | `template` | `admin` | `medium` | `false` |
| `intent.in_scope_terms` | `string_list` | `admin` | `low` | `false` |
| `intent.off_topic_terms` | `string_list` | `admin` | `low` | `false` |
| `query_rewrite.prompt` | `template` | `admin` | `medium` | `false` |
| `summary.prompt` | `template` | `admin` | `medium` | `false` |
| `rerank.prompt` | `template` | `admin` | `medium` | `false` |
| `documents.allowed_extensions` | `string_list` | `admin` | `low` | `false` |
| `documents.allowed_mime_types` | `string_list` | `admin` | `low` | `false` |
| `documents.max_file_bytes` | `number` | `admin` | `low` | `false` |

Validation khi update:

| valueType | Rule |
|---|---|
| `string` | string trim, length `1..1000` |
| `template` | string trim, length `20..8000`, một số key bắt buộc placeholder |
| `string_list` | array string, sau trim bỏ rỗng, unique, số item `1..100`, mỗi item max `100` |
| `number` | integer trong khoảng riêng của key; `documents.max_file_bytes` từ `1048576` đến `10485760` |

Placeholder bắt buộc:

| key | Placeholder bắt buộc |
|---|---|
| `chat.system_prompt` | `{conversation_summary}`, `{retrieved_context}` |
| `summary.prompt` | `{max_summary_chars}` |
| `rerank.prompt` | `{rerank_final_limit}` |

### GET `/v1/admin/rag-config`

List tất cả runtime config keys.

**Headers bắt buộc:** `Authorization: Bearer <SYSTEM_ADMIN accessToken>`.

**Response 200**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "key": "documents.max_file_bytes",
      "value": 5242880,
      "valueType": "number",
      "editableGroup": "admin",
      "riskLevel": "low",
      "requiresRestart": false,
      "description": "Knowledge document max upload size in bytes.",
      "updatedByUserId": null,
      "updatedAt": null
    }
  ],
  "meta": {
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

**Lỗi:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_ROLE`, `500 INTERNAL_ERROR`.

```bash
curl "http://localhost:3000/v1/admin/rag-config" \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN"
```

```js
const res = await fetch('http://localhost:3000/v1/admin/rag-config', {
  headers: { Authorization: `Bearer ${systemAdminToken}` },
});
console.log(await res.json());
```

### POST `/v1/admin/rag-config/reload`

Reload runtime config cache trong process hiện tại.

**Headers bắt buộc:** `Authorization: Bearer <SYSTEM_ADMIN accessToken>`.

**Request body:** Không có.

**Response 201**

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "reloaded": true
  },
  "meta": {
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

**Lỗi:** `401 UNAUTHORIZED`, `403 INSUFFICIENT_ROLE`, `500 INTERNAL_ERROR`.

```bash
curl -X POST "http://localhost:3000/v1/admin/rag-config/reload" \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN"
```

```js
const res = await fetch('http://localhost:3000/v1/admin/rag-config/reload', {
  method: 'POST',
  headers: { Authorization: `Bearer ${systemAdminToken}` },
});
console.log(await res.json());
```

### GET `/v1/admin/rag-config/:key`

Get một config key kèm history.

**Headers bắt buộc:** `Authorization: Bearer <SYSTEM_ADMIN accessToken>`.

**Path params**

| Param | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `key` | string | Có | min `1`, max `120` |

**Response 200**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "key": "documents.max_file_bytes",
    "value": 5242880,
    "valueType": "number",
    "editableGroup": "admin",
    "riskLevel": "low",
    "requiresRestart": false,
    "description": "Knowledge document max upload size in bytes.",
    "updatedByUserId": null,
    "updatedAt": null,
    "history": [
      {
        "id": "99999999-9999-4999-8999-999999999999",
        "key": "documents.max_file_bytes",
        "oldValue": 5242880,
        "newValue": 6291456,
        "changedByUserId": "66666666-6666-4666-8666-666666666666",
        "reason": "Tăng giới hạn",
        "changedAt": "2026-07-05T10:00:00.000Z"
      }
    ]
  },
  "meta": {
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

**Lỗi:** `400 VALIDATION_FAILED`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_ROLE`, `404 RUNTIME_CONFIG_NOT_FOUND`, `500 INTERNAL_ERROR`.

```bash
curl "http://localhost:3000/v1/admin/rag-config/documents.max_file_bytes" \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN"
```

```js
const key = encodeURIComponent('documents.max_file_bytes');
const res = await fetch(`http://localhost:3000/v1/admin/rag-config/${key}`, {
  headers: { Authorization: `Bearer ${systemAdminToken}` },
});
console.log(await res.json());
```

### PATCH `/v1/admin/rag-config/:key`

Update một config key.

**Headers bắt buộc:** `Authorization: Bearer <SYSTEM_ADMIN accessToken>`, `Content-Type: application/json`.

**Path params**

| Param | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `key` | string | Có | min `1`, max `120`; phải nằm trong registry |

**Request body**

```json
{
  "value": 6291456,
  "reason": "Tăng giới hạn upload tài liệu RAG"
}
```

| Field | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `value` | unknown | Có | DTO nhận mọi kiểu, sau đó validate theo registry key |
| `reason` | string | Không | `trim()`, min `1`, max `500` |

**Response 200**

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "key": "documents.max_file_bytes",
    "value": 6291456,
    "valueType": "number",
    "editableGroup": "admin",
    "riskLevel": "low",
    "requiresRestart": false,
    "description": "Knowledge document max upload size in bytes.",
    "updatedByUserId": "66666666-6666-4666-8666-666666666666",
    "updatedAt": "2026-07-05T10:00:00.000Z"
  },
  "meta": {
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

**Response lỗi**

| Status | code | Nguyên nhân |
|---:|---|---|
| 400 | `VALIDATION_FAILED` | Path/body không đạt Zod schema |
| 400 | `RUNTIME_CONFIG_INVALID_VALUE` | `value` sai rule của key |
| 401 | `UNAUTHORIZED` | Thiếu/sai internal bearer token khi tới RAG |
| 403 | `INSUFFICIENT_ROLE` | Không phải `SYSTEM_ADMIN` |
| 403 | `RUNTIME_CONFIG_READONLY` | Key `editableGroup=readonly`; hiện registry không có key readonly |
| 404 | `RUNTIME_CONFIG_NOT_FOUND` | Key không nằm trong registry |
| 500 | `INTERNAL_ERROR` | Lỗi không được catch cụ thể |

```bash
curl -X PATCH "http://localhost:3000/v1/admin/rag-config/documents.max_file_bytes" \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":6291456,"reason":"Tăng giới hạn upload tài liệu RAG"}'
```

```js
const res = await fetch('http://localhost:3000/v1/admin/rag-config/documents.max_file_bytes', {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${systemAdminToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    value: 6291456,
    reason: 'Tăng giới hạn upload tài liệu RAG',
  }),
});
console.log(await res.json());
```

### GET `/v1/admin/rag-config/:key/history`

List history của một config key.

**Headers bắt buộc:** `Authorization: Bearer <SYSTEM_ADMIN accessToken>`.

**Path params:** `key` string min `1`, max `120`.

**Response 200**

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "99999999-9999-4999-8999-999999999999",
      "key": "documents.max_file_bytes",
      "oldValue": 5242880,
      "newValue": 6291456,
      "changedByUserId": "66666666-6666-4666-8666-666666666666",
      "reason": "Tăng giới hạn",
      "changedAt": "2026-07-05T10:00:00.000Z"
    }
  ],
  "meta": {
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

**Lỗi:** `400 VALIDATION_FAILED`, `401 UNAUTHORIZED`, `403 INSUFFICIENT_ROLE`, `404 RUNTIME_CONFIG_NOT_FOUND`, `500 INTERNAL_ERROR`.

```bash
curl "http://localhost:3000/v1/admin/rag-config/documents.max_file_bytes/history" \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN"
```

```js
const res = await fetch('http://localhost:3000/v1/admin/rag-config/documents.max_file_bytes/history', {
  headers: { Authorization: `Bearer ${systemAdminToken}` },
});
console.log(await res.json());
```

### POST `/v1/admin/rag-config/:key/rollback`

Rollback một config key về `oldValue` của một history entry; nếu `oldValue` null thì dùng default value của registry.

**Headers bắt buộc:** `Authorization: Bearer <SYSTEM_ADMIN accessToken>`, `Content-Type: application/json`.

**Path params:** `key` string min `1`, max `120`.

**Request body**

```json
{
  "historyId": "99999999-9999-4999-8999-999999999999"
}
```

| Field | Kiểu | Bắt buộc | Validation |
|---|---|---:|---|
| `historyId` | string UUID | Có | Zod `z.string().uuid()` |

**Response 201**

Trả `RuntimeConfigItem` sau rollback.

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "key": "documents.max_file_bytes",
    "value": 5242880,
    "valueType": "number",
    "editableGroup": "admin",
    "riskLevel": "low",
    "requiresRestart": false,
    "description": "Knowledge document max upload size in bytes.",
    "updatedByUserId": "66666666-6666-4666-8666-666666666666",
    "updatedAt": "2026-07-05T10:00:00.000Z"
  },
  "meta": {
    "traceId": "req-abc",
    "timestamp": "2026-07-05T10:00:00.000Z"
  }
}
```

**Response lỗi**

| Status | code | Nguyên nhân |
|---:|---|---|
| 400 | `VALIDATION_FAILED` | Path/body không đạt Zod schema |
| 400 | `RUNTIME_CONFIG_INVALID_VALUE` | Value rollback không còn hợp lệ theo registry hiện tại |
| 401 | `UNAUTHORIZED` | Thiếu/sai internal bearer token khi tới RAG |
| 403 | `INSUFFICIENT_ROLE` | Không phải `SYSTEM_ADMIN` |
| 403 | `RUNTIME_CONFIG_READONLY` | Key readonly |
| 404 | `RUNTIME_CONFIG_NOT_FOUND` | Key không nằm trong registry |
| 404 | `RUNTIME_CONFIG_HISTORY_NOT_FOUND` | Không tìm thấy historyId trong history của key |
| 500 | `INTERNAL_ERROR` | Lỗi không được catch cụ thể |

```bash
curl -X POST "http://localhost:3000/v1/admin/rag-config/documents.max_file_bytes/rollback" \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"historyId":"99999999-9999-4999-8999-999999999999"}'
```

```js
const res = await fetch('http://localhost:3000/v1/admin/rag-config/documents.max_file_bytes/rollback', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${systemAdminToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ historyId }),
});
console.log(await res.json());
```
