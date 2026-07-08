# API Voucher Service

Tài liệu này được lập từ code hiện tại của Booking service trong `apps/booking`, Gateway route table và shared .NET web libraries. Chỉ các hành vi nhìn thấy trong code được mô tả.

## Mục lục

- [Base URL](#base-url)
- [Xác thực và header chung](#xác-thực-và-header-chung)
- [Response envelope](#response-envelope)
- [Quy ước chung](#quy-ước-chung)
- [Tổng quan endpoint](#tổng-quan-endpoint)
- [Chi tiết endpoint](#chi-tiết-endpoint)
- [Mã lỗi theo code](#mã-lỗi-theo-code)
- [Flow và lưu ý đặc biệt](#flow-và-lưu-ý-đặc-biệt)

## Base URL

| Môi trường | Base URL | Nguồn |
|---|---:|---|
| Local direct Booking | `http://localhost:5003` | Booking service config/route convention |
| Production API | `https://api.vietride.online` | Gateway proxy giữ nguyên path `/v1/...` khi route tới Booking |

Các route voucher public/user/admin/operator đi qua Gateway tới `BOOKING_BASE_URL`. Internal endpoints dùng direct service-to-service call và `X-Internal-Auth`.

## Xác thực và header chung

| Loại endpoint | Auth | Header |
|---|---|---|
| Public promotions | Không yêu cầu auth qua Gateway. | Không bắt buộc |
| User-facing voucher | FE/Mobile gửi user access token tới Gateway. Gateway verify token và forward Booking bằng internal JWT. | `Authorization: Bearer <access_token>` |
| Admin/operator voucher | Cần user access token có role phù hợp. | `Authorization: Bearer <access_token>` |
| Internal voucher | Internal JWT HS256, issuer `vietride-gateway`, audience `vietride-internal`. | `X-Internal-Auth: Bearer <internal_jwt>` |
| Mutation có idempotency | Các endpoint tạo/cập nhật trạng thái có gọi `GetRequiredIdempotencyKey()` bắt buộc header này. | `Idempotency-Key: <unique-key>` |

Claims được controller đọc:

| Claim | Dùng cho |
|---|---|
| `sub` hoặc `ClaimTypes.NameIdentifier` | user id hiện tại |
| `operatorId` | scope operator cho operator voucher và consent |
| `role` hoặc `ClaimTypes.Role` | role authorization |

## Response envelope

Success được `ApiResponseResultFilter` wrap tự động:

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
      { "field": "name", "message": "name must not be empty." }
    ]
  },
  "meta": {
    "traceId": "req-123",
    "timestamp": "2026-07-05T10:00:00.0000000Z"
  }
}
```

## Quy ước chung

| Quy ước | Giá trị thực tế trong code |
|---|---|
| JSON casing | camelCase theo `JsonSerializerDefaults.Web`/ASP.NET Core mặc định |
| UUID | `Guid`, ví dụ `11111111-1111-4111-8111-111111111111` |
| DateTimeOffset JSON | ISO-8601 |
| Money | `long` VND, không decimal |
| Voucher type | `PERCENT_OFF`, `FIXED_AMOUNT` |
| Funding type | `VIETRIDE_FUNDED`, `OPERATOR_FUNDED` |
| Consent status | `PENDING`, `ACCEPTED`, `REJECTED` |
| Service | Thường là `BOOKING` hoặc `PARCEL`; handler normalize uppercase |
| Payment method | Ví dụ `VNPAY`, `WALLET`; handler normalize uppercase |

Discount:

- `PERCENT_OFF`: `orderAmount * value / 100`, làm tròn half-up theo `Money.FromDecimal`, không floor 1000.
- `FIXED_AMOUNT`: `min(value, orderAmount)`.
- Nếu có `maxDiscountAmount`, discount bị cap bởi giá trị đó.
- Discount không vượt quá `orderAmount`.

## Tổng quan endpoint

| Method | Path | Auth | Mô tả ngắn |
|---|---|---|---|
| GET | `/v1/promotions` | Public | Lấy promotion/voucher public theo service |
| GET | `/v1/vouchers/available` | User token | Lấy voucher user hiện tại có thể dùng |
| POST | `/v1/admin/vouchers` | `SYSTEM_ADMIN` | Admin tạo platform voucher |
| GET | `/v1/admin/vouchers` | `SYSTEM_ADMIN` | Admin list voucher |
| GET | `/v1/admin/vouchers/{voucherId}/consents` | `SYSTEM_ADMIN` | Admin xem consent của voucher |
| GET | `/v1/admin/campaigns` | `SYSTEM_ADMIN` | Admin list campaign |
| POST | `/v1/admin/campaigns` | `SYSTEM_ADMIN` | Admin tạo campaign |
| PATCH | `/v1/admin/campaigns/{campaignId}` | `SYSTEM_ADMIN` | Admin cập nhật campaign |
| POST | `/v1/admin/campaigns/{campaignId}/activate` | `SYSTEM_ADMIN` | Admin bật campaign |
| POST | `/v1/admin/campaigns/{campaignId}/deactivate` | `SYSTEM_ADMIN` | Admin tắt campaign |
| POST | `/v1/operator/vouchers` | `OPERATOR_ADMIN` | Operator tạo voucher của chính operator |
| PATCH | `/v1/operator/vouchers/{id}` | `OPERATOR_ADMIN` | Operator cập nhật voucher |
| DELETE | `/v1/operator/vouchers/{id}` | `OPERATOR_ADMIN` | Operator soft-delete voucher |
| POST | `/v1/operator/vouchers/{id}/activate` | `OPERATOR_ADMIN` | Operator bật voucher |
| POST | `/v1/operator/vouchers/{id}/deactivate` | `OPERATOR_ADMIN` | Operator tắt voucher |
| GET | `/v1/operator/voucher-consents` | `OPERATOR_ADMIN`, `OPERATOR_STAFF` | Operator list consent |
| POST | `/v1/operator/voucher-consents/{id}/accept` | `OPERATOR_ADMIN` | Operator accept consent |
| POST | `/v1/operator/voucher-consents/{id}/reject` | `OPERATOR_ADMIN` | Operator reject/revoke consent |
| POST | `/internal/v1/vouchers/validate` | Internal JWT | Internal validate voucher và tính discount |
| POST | `/internal/v1/vouchers/usages` | Internal JWT | Internal ghi nhận voucher usage |
| DELETE | `/internal/v1/vouchers/usages/by-reference` | Internal JWT | Internal xóa usage theo reference để compensate |
| GET | `/internal/v1/vouchers/available` | Internal JWT | Internal lấy voucher khả dụng cho user/operator/route |

## Chi tiết endpoint

### GET `/v1/promotions`

Public endpoint lấy promotion đang active theo service.

Query params:

| Tên | Kiểu | Bắt buộc | Rule |
|---|---|---:|---|
| `service` | string | Có | Handler normalize uppercase |

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "voucherId": "11111111-1111-4111-8111-111111111111",
      "code": "BOOK10",
      "name": "Giảm 10% vé xe",
      "type": "PERCENT_OFF",
      "value": 10,
      "applicableServices": ["BOOKING"],
      "validUntil": "2026-07-31T16:59:59Z"
    }
  ],
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T10:00:00.0000000Z" }
}
```

```bash
curl "http://localhost:5003/v1/promotions?service=BOOKING"
```

### GET `/v1/vouchers/available`

User lấy danh sách voucher có thể dùng trong checkout. Endpoint này preview voucher; checkout/internal validate vẫn là source of truth cuối cùng.

Auth: user token, Gateway route `authRequired: user`.

Query params:

| Tên | Kiểu | Bắt buộc | Rule |
|---|---|---:|---|
| `service` | string | Có | Ví dụ `BOOKING`, `PARCEL` |
| `tripId` | Guid? | Không | Nếu thiếu `operatorId`/`routeId`, handler có thể lookup trip để suy ra |
| `operatorId` | Guid? | Không | Cần có trực tiếp hoặc suy ra từ `tripId` |
| `routeId` | Guid? | Không | Cần có trực tiếp hoặc suy ra từ `tripId` |
| `paymentMethod` | string? | Không | Lọc theo applicable payment methods nếu voucher có cấu hình |
| `orderAmount` | long? | Không | Default `0`; ảnh hưởng min order và discount preview |

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "BOOK10",
      "name": "Giảm 10% vé xe",
      "type": "PERCENT_OFF",
      "value": 10,
      "minOrderAmount": 50000,
      "maxDiscountAmount": 20000,
      "discountAmount": 10000,
      "applicableServices": ["BOOKING"],
      "applicablePaymentMethods": ["VNPAY", "WALLET"],
      "validUntil": "2026-07-31T16:59:59Z"
    }
  ],
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T10:00:00.0000000Z" }
}
```

Nếu không đủ `operatorId`/`routeId` và không suy ra được từ `tripId`, handler trả list rỗng. Candidate được sort theo `validUntil` tăng dần và giới hạn 50 voucher.

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5003/v1/vouchers/available?service=BOOKING&tripId=22222222-2222-4222-8222-222222222222&paymentMethod=VNPAY&orderAmount=100000"
```

### POST `/v1/admin/vouchers`

Admin tạo platform voucher. `code` optional; nếu null thì auto-generate mã 8 ký tự uppercase base32.

Auth: `SYSTEM_ADMIN`. Header bắt buộc: `Idempotency-Key`.

Request body:

```json
{
  "code": "BOOK10",
  "name": "Giảm 10% vé xe",
  "type": "PERCENT_OFF",
  "value": 10,
  "minOrderAmount": 50000,
  "maxDiscountAmount": 20000,
  "totalUsageLimit": 1000,
  "perUserLimit": 1,
  "validFrom": "2026-07-01T00:00:00Z",
  "validUntil": "2026-07-31T16:59:59Z",
  "newUserOnly": false,
  "applicablePaymentMethods": ["VNPAY", "WALLET"],
  "applicableServices": ["BOOKING"],
  "applicableOperatorIds": ["33333333-3333-4333-8333-333333333333"],
  "applicableRouteIds": ["44444444-4444-4444-8444-444444444444"],
  "fundingType": "OPERATOR_FUNDED"
}
```

Validation chính:

| Field | Rule |
|---|---|
| `name` | NotEmpty, max 120 |
| `code` | optional, max 50 |
| `type` | `PERCENT_OFF` hoặc `FIXED_AMOUNT` |
| `fundingType` | `VIETRIDE_FUNDED` hoặc `OPERATOR_FUNDED` |
| `value` | `> 0` |
| `minOrderAmount` | `>= 0` |
| `maxDiscountAmount` | `> 0` nếu có |
| `totalUsageLimit`, `perUserLimit` | `> 0` nếu có |
| `validUntil` | phải sau `validFrom` |
| `applicableOperatorIds` | bắt buộc non-empty nếu `fundingType=OPERATOR_FUNDED` |

Success `201`:

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "code": "BOOK10",
    "name": "Giảm 10% vé xe",
    "type": "PERCENT_OFF",
    "value": 10,
    "fundingType": "OPERATOR_FUNDED",
    "ownerOperatorId": null,
    "isActive": true,
    "validFrom": "2026-07-01T00:00:00Z",
    "validUntil": "2026-07-31T16:59:59Z",
    "createdAt": "2026-07-05T10:00:00Z"
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T10:00:00.0000000Z" }
}
```

Errors trong code: `400 VALIDATION_ERROR`, `401/403`, `409 VOUCHER_CODE_CONFLICT`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`.

```bash
curl -X POST "http://localhost:5003/v1/admin/vouchers" \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: admin-voucher-create-001" -H "Content-Type: application/json" \
  -d '{"code":"BOOK10","name":"Giảm 10% vé xe","type":"PERCENT_OFF","value":10,"minOrderAmount":50000,"maxDiscountAmount":20000,"totalUsageLimit":1000,"perUserLimit":1,"validFrom":"2026-07-01T00:00:00Z","validUntil":"2026-07-31T16:59:59Z","newUserOnly":false,"applicablePaymentMethods":["VNPAY","WALLET"],"applicableServices":["BOOKING"],"applicableOperatorIds":["33333333-3333-4333-8333-333333333333"],"applicableRouteIds":["44444444-4444-4444-8444-444444444444"],"fundingType":"OPERATOR_FUNDED"}'
```

### GET `/v1/admin/vouchers`

Admin list non-soft-deleted vouchers.

Auth: `SYSTEM_ADMIN`.

Query params:

| Tên | Kiểu | Default | Rule |
|---|---|---:|---|
| `ownerOperatorId` | Guid? | null | Lọc theo owner operator |
| `fundingType` | string? | null | `VIETRIDE_FUNDED` hoặc `OPERATOR_FUNDED` |
| `isActive` | bool? | null | Lọc active/inactive |
| `page` | int | `1` | QueryOptions paging |
| `pageSize` | int | `20` | QueryOptions paging |
| `sortBy` | string? | null | `createdAt`, `validFrom`, `validUntil`, `code`, `name`, `isActive` |
| `sortDir` | string | `desc` | `asc` hoặc `desc` |

Success `200`: `PagedResult<VoucherListItem>`.

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": "11111111-1111-4111-8111-111111111111",
        "code": "BOOK10",
        "name": "Giảm 10% vé xe",
        "type": "PERCENT_OFF",
        "value": 10,
        "fundingType": "OPERATOR_FUNDED",
        "ownerOperatorId": null,
        "isActive": true,
        "validFrom": "2026-07-01T00:00:00Z",
        "validUntil": "2026-07-31T16:59:59Z",
        "createdAt": "2026-07-05T10:00:00Z"
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

Errors trong code: `401/403`, `422 INVALID_SORT_DIRECTION`, `422 INVALID_SORT_FIELD`, `422 VALIDATION_ERROR`.

### GET `/v1/admin/vouchers/{voucherId}/consents`

Admin xem mọi consent row của một voucher.

Auth: `SYSTEM_ADMIN`.

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "voucherId": "11111111-1111-4111-8111-111111111111",
    "items": [
      {
        "id": "55555555-5555-4555-8555-555555555555",
        "operatorId": "33333333-3333-4333-8333-333333333333",
        "voucherId": "11111111-1111-4111-8111-111111111111",
        "status": "PENDING",
        "requestedAt": "2026-07-05T10:00:00Z",
        "respondedAt": null,
        "respondedByUserId": null,
        "rejectReason": null
      }
    ]
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T10:00:00.0000000Z" }
}
```

Errors trong controller metadata/code: `401/403`, `404 VOUCHER_NOT_FOUND`.

### Admin campaign endpoints

Campaign endpoints dùng chung body:

```json
{
  "name": "Chiến dịch hè",
  "description": "Voucher mùa hè",
  "ownerOperatorId": null,
  "validFrom": "2026-07-01T00:00:00Z",
  "validUntil": "2026-07-31T16:59:59Z",
  "isActive": true,
  "voucherIds": ["11111111-1111-4111-8111-111111111111"]
}
```

Response `CampaignDto`:

```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "name": "Chiến dịch hè",
  "description": "Voucher mùa hè",
  "ownerOperatorId": null,
  "isActive": true,
  "validFrom": "2026-07-01T00:00:00Z",
  "validUntil": "2026-07-31T16:59:59Z",
  "createdAt": "2026-07-05T10:00:00Z"
}
```

Endpoints:

| Method | Path | Header | Response |
|---|---|---|---|
| GET | `/v1/admin/campaigns` | Không cần idempotency | `200` list `CampaignDto` |
| POST | `/v1/admin/campaigns` | `Idempotency-Key` | `201` `CampaignDto` |
| PATCH | `/v1/admin/campaigns/{campaignId}` | `Idempotency-Key` | `200` `CampaignDto` |
| POST | `/v1/admin/campaigns/{campaignId}/activate` | `Idempotency-Key` | `200` `CampaignDto` |
| POST | `/v1/admin/campaigns/{campaignId}/deactivate` | `Idempotency-Key` | `200` `CampaignDto` |

Errors trong code: `401/403`, `404 CAMPAIGN_NOT_FOUND`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`.

### POST `/v1/operator/vouchers`

Operator admin tạo operator-owned voucher. Server luôn force `fundingType=OPERATOR_FUNDED`, `ownerOperatorId=caller.operatorId`, self-consented và không fan-out consent.

Auth: `OPERATOR_ADMIN`. Header bắt buộc: `Idempotency-Key`.

Request body:

```json
{
  "code": "OP10",
  "name": "Operator giảm 10%",
  "type": "PERCENT_OFF",
  "value": 10,
  "minOrderAmount": 50000,
  "maxDiscountAmount": 20000,
  "totalUsageLimit": 100,
  "perUserLimit": 1,
  "validFrom": "2026-07-01T00:00:00Z",
  "validUntil": "2026-07-31T16:59:59Z",
  "applicableRouteIds": ["44444444-4444-4444-8444-444444444444"],
  "fundingType": "OPERATOR_FUNDED"
}
```

Success `201`:

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "code": "OP10",
    "name": "Operator giảm 10%",
    "type": "PERCENT_OFF",
    "value": 10,
    "fundingType": "OPERATOR_FUNDED",
    "ownerOperatorId": "33333333-3333-4333-8333-333333333333",
    "isActive": true,
    "validFrom": "2026-07-01T00:00:00Z",
    "validUntil": "2026-07-31T16:59:59Z",
    "createdAt": "2026-07-05T10:00:00Z"
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T10:00:00.0000000Z" }
}
```

Errors trong code: `400 VALIDATION_ERROR`, `401/403`, `409 VOUCHER_CODE_CONFLICT`, `422 VALIDATION_ERROR`, `422 VOUCHER_FORBIDDEN_FUNDING`, `422 IDEMPOTENCY_KEY_MISMATCH`.

### PATCH `/v1/operator/vouchers/{id}`

Operator admin cập nhật partial voucher của chính operator.

Auth: `OPERATOR_ADMIN`. Không yêu cầu `Idempotency-Key`.

Body tất cả field đều optional; `null` nghĩa là giữ nguyên:

```json
{
  "name": "Operator giảm 15%",
  "value": 15,
  "minOrderAmount": 50000,
  "maxDiscountAmount": 30000,
  "totalUsageLimit": 200,
  "perUserLimit": 2,
  "validFrom": "2026-07-01T00:00:00Z",
  "validUntil": "2026-08-31T16:59:59Z",
  "applicableRouteIds": ["44444444-4444-4444-8444-444444444444"]
}
```

Freeze-on-first-use:

- Khi voucher chưa có usage: các field mutable đều có thể sửa.
- Khi đã có usage: `value`, `minOrderAmount`, `maxDiscountAmount`, `validFrom` bị khóa.
- `validUntil` chỉ được kéo dài, không được rút ngắn.
- `totalUsageLimit`, `perUserLimit` chỉ được nới lỏng: tăng hoặc set unlimited; không được siết lại.
- `name` và `applicableRouteIds` vẫn có thể sửa.

Success `200` data: `id`, `code`, `name`, `type`, `value`, `fundingType`, `ownerOperatorId`, `isActive`, `validFrom`, `validUntil`.

Errors trong code: `400 VALIDATION_ERROR`, `401/403`, `404 VOUCHER_NOT_FOUND`, `409 VOUCHER_LOCKED`, `422 VALIDATION_ERROR`.

### DELETE `/v1/operator/vouchers/{id}`

Soft-delete operator-owned voucher. Cross-operator access trả `404 VOUCHER_NOT_FOUND`. Behavior-idempotent với voucher đã soft-deleted.

Auth: `OPERATOR_ADMIN`. Không yêu cầu `Idempotency-Key`.

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "deletedAt": "2026-07-05T10:00:00Z"
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T10:00:00.0000000Z" }
}
```

Errors trong code: `401/403`, `404 VOUCHER_NOT_FOUND`.

### POST `/v1/operator/vouchers/{id}/activate`

Auth: `OPERATOR_ADMIN`. Không yêu cầu `Idempotency-Key`.

Success data:

```json
{ "id": "11111111-1111-4111-8111-111111111111", "isActive": true }
```

Errors trong code: `401/403`, `404 VOUCHER_NOT_FOUND`.

### POST `/v1/operator/vouchers/{id}/deactivate`

Auth: `OPERATOR_ADMIN`. Không yêu cầu `Idempotency-Key`.

Success data:

```json
{ "id": "11111111-1111-4111-8111-111111111111", "isActive": false }
```

Errors trong code: `401/403`, `404 VOUCHER_NOT_FOUND`.

### GET `/v1/operator/voucher-consents`

Operator xem consent thuộc `operatorId` của mình.

Auth: `OPERATOR_ADMIN` hoặc `OPERATOR_STAFF`.

Query params:

| Tên | Kiểu | Bắt buộc | Rule |
|---|---|---:|---|
| `status` | string? | Không | Nếu có phải parse được consent status |

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": "55555555-5555-4555-8555-555555555555",
        "voucherId": "11111111-1111-4111-8111-111111111111",
        "voucherCode": "BOOK10",
        "voucherType": "PERCENT_OFF",
        "voucherValue": 10,
        "validFrom": "2026-07-01T00:00:00Z",
        "validUntil": "2026-07-31T16:59:59Z",
        "minOrderAmount": 50000,
        "maxDiscountAmount": 20000,
        "applicableRouteIds": ["44444444-4444-4444-8444-444444444444"],
        "status": "PENDING",
        "requestedAt": "2026-07-05T10:00:00Z",
        "respondedAt": null,
        "respondedByUserId": null
      }
    ]
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T10:00:00.0000000Z" }
}
```

Errors trong code: `401/403`, `422 INVALID_STATUS`.

### POST `/v1/operator/voucher-consents/{id}/accept`

Accept consent từ `PENDING` sang `ACCEPTED`.

Auth: `OPERATOR_ADMIN`. Header bắt buộc: `Idempotency-Key`.

Success `200` data:

```json
{ "id": "55555555-5555-4555-8555-555555555555", "status": "ACCEPTED" }
```

Errors trong code: `401/403`, `403 FORBIDDEN`, `409 CONSENT_NOT_PENDING`, `422 IDEMPOTENCY_KEY_MISMATCH`.

### POST `/v1/operator/voucher-consents/{id}/reject`

Reject consent `PENDING` hoặc revoke consent `ACCEPTED` sang `REJECTED`. Revoking không rollback discount của booking đã confirmed.

Auth: `OPERATOR_ADMIN`. Header bắt buộc: `Idempotency-Key`.

Request body optional:

```json
{ "reason": "Không tham gia chiến dịch này" }
```

Success `200` data:

```json
{ "id": "55555555-5555-4555-8555-555555555555", "status": "REJECTED" }
```

Errors trong code: `401/403`, `403 FORBIDDEN`, `409 CONSENT_ALREADY_REJECTED`, `422 IDEMPOTENCY_KEY_MISMATCH`.

### POST `/internal/v1/vouchers/validate`

Internal endpoint validate voucher và tính discount.

Auth: `X-Internal-Auth: Bearer <internal_jwt>`.

Request body:

```json
{
  "voucherCode": "BOOK10",
  "operatorId": "33333333-3333-4333-8333-333333333333",
  "routeId": "44444444-4444-4444-8444-444444444444",
  "userId": "77777777-7777-4777-8777-777777777777",
  "orderAmount": 100000,
  "service": "BOOKING",
  "paymentMethod": "VNPAY"
}
```

Success `200` data:

```json
{ "voucherId": "11111111-1111-4111-8111-111111111111", "discountAmount": 10000 }
```

Errors trong code: `401 AUTH_TOKEN_INVALID`, `404 VOUCHER_NOT_FOUND`, `422 VOUCHER_EXPIRED`, `422 VOUCHER_NOT_APPLICABLE`, `422 VOUCHER_PAYMENT_METHOD_NOT_APPLICABLE`, `422 VOUCHER_NEW_USER_ONLY`, `422 VOUCHER_MIN_ORDER_NOT_MET`, `422 VOUCHER_USAGE_LIMIT_REACHED`, `422 VOUCHER_USER_LIMIT_REACHED`.

### POST `/internal/v1/vouchers/usages`

Internal endpoint ghi nhận voucher usage theo reference.

Auth: `X-Internal-Auth`. Header bắt buộc: `Idempotency-Key`.

Request body:

```json
{
  "voucherId": "11111111-1111-4111-8111-111111111111",
  "userId": "77777777-7777-4777-8777-777777777777",
  "referenceType": "PARCEL",
  "referenceId": "88888888-8888-4888-8888-888888888888",
  "discountAmount": 10000
}
```

Success `201` data:

```json
{ "usageId": "99999999-9999-4999-8999-999999999999" }
```

Errors trong code: `401 AUTH_TOKEN_INVALID`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`.

### DELETE `/internal/v1/vouchers/usages/by-reference`

Internal compensation endpoint xóa physical usage theo reference.

Auth: `X-Internal-Auth`. Header bắt buộc: `Idempotency-Key`.

Query params:

| Tên | Kiểu | Bắt buộc |
|---|---|---:|
| `referenceType` | string | Có |
| `referenceId` | Guid | Có |

Success `204`: no body.

```bash
curl -X DELETE "http://localhost:5003/internal/v1/vouchers/usages/by-reference?referenceType=PARCEL&referenceId=88888888-8888-4888-8888-888888888888" \
  -H "X-Internal-Auth: Bearer $INTERNAL_JWT" -H "Idempotency-Key: voucher-usage-delete-001"
```

### GET `/internal/v1/vouchers/available`

Internal endpoint lấy voucher khả dụng cho service khác, đang được Parcel dùng.

Auth: `X-Internal-Auth`.

Query params:

| Tên | Kiểu | Bắt buộc |
|---|---|---:|
| `userId` | Guid | Có |
| `service` | string | Có |
| `operatorId` | Guid | Có |
| `routeId` | Guid | Có |
| `paymentMethod` | string? | Không |
| `orderAmount` | long? | Không |

Success `200`: list `AvailableVoucherItem`, cùng shape với `GET /v1/vouchers/available`.

## Mã lỗi theo code

| HTTP | Code | Nguyên nhân |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Model binding JSON/type/missing field |
| 401 | `AUTH_TOKEN_INVALID` | Internal JWT thiếu/sai |
| 401 | `UNAUTHORIZED` | Thiếu/sai user auth hoặc claim user/operator invalid |
| 403 | `FORBIDDEN` | Không có quyền hoặc consent không thuộc operator |
| 404 | `VOUCHER_NOT_FOUND` | Không tìm thấy voucher, voucher inactive, hoặc bị che do tenant isolation |
| 404 | `CAMPAIGN_NOT_FOUND` | Không tìm thấy campaign |
| 409 | `VOUCHER_CODE_CONFLICT` | Code voucher đã tồn tại trong non-deleted voucher |
| 409 | `VOUCHER_LOCKED` | Voucher đã có usage nên field bị khóa hoặc chỉ được nới lỏng |
| 409 | `CONSENT_NOT_PENDING` | Accept consent khi consent không còn PENDING |
| 409 | `CONSENT_ALREADY_REJECTED` | Reject/revoke consent khi consent đã REJECTED |
| 422 | `VALIDATION_ERROR` | FluentValidation hoặc thiếu `Idempotency-Key` |
| 422 | `INVALID_SORT_DIRECTION` | `sortDir` không phải `asc`/`desc` |
| 422 | `INVALID_SORT_FIELD` | `sortBy` không thuộc whitelist |
| 422 | `INVALID_STATUS` | Consent status query không hợp lệ |
| 422 | `VOUCHER_FORBIDDEN_FUNDING` | Operator voucher gửi fundingType khác `OPERATOR_FUNDED` |
| 422 | `VOUCHER_EXPIRED` | Voucher ngoài cửa sổ `validFrom..validUntil` |
| 422 | `VOUCHER_NOT_APPLICABLE` | Voucher không áp dụng cho service/operator/route hoặc thiếu consent accepted |
| 422 | `VOUCHER_PAYMENT_METHOD_NOT_APPLICABLE` | Voucher không áp dụng cho payment method |
| 422 | `VOUCHER_NEW_USER_ONLY` | Voucher chỉ dành cho user chưa có booking confirmed |
| 422 | `VOUCHER_MIN_ORDER_NOT_MET` | `orderAmount` chưa đạt `minOrderAmount` |
| 422 | `VOUCHER_USAGE_LIMIT_REACHED` | Đã đạt tổng usage limit |
| 422 | `VOUCHER_USER_LIMIT_REACHED` | User đã đạt per-user limit |
| 422 | `IDEMPOTENCY_KEY_MISMATCH` | Reuse idempotency key với body khác |
| 500 | `INTERNAL_ERROR` | Exception không map rõ |

## Flow và lưu ý đặc biệt

- Passenger/FE có thể gọi `GET /v1/vouchers/available` để preview voucher trước khi tạo booking.
- Parcel không gọi trực tiếp user endpoint mà dùng `GET /internal/v1/vouchers/available`, `POST /internal/v1/vouchers/validate`, `POST /internal/v1/vouchers/usages`, và compensation `DELETE /internal/v1/vouchers/usages/by-reference`.
- `OPERATOR_FUNDED` platform voucher do admin tạo cần `applicableOperatorIds`; các operator liên quan phải accept consent trước khi voucher áp dụng được.
- Operator-created voucher luôn là `OPERATOR_FUNDED`, `ownerOperatorId` là operator của caller, tự consent và không cần admin consent fan-out.
- Voucher inactive được che thành `VOUCHER_NOT_FOUND`.
- `code`, `type`, `fundingType`, `ownerOperatorId` là immutable trong operator update.
- Soft-delete operator voucher set `deleted_at`; code có thể được reuse theo comment controller.
