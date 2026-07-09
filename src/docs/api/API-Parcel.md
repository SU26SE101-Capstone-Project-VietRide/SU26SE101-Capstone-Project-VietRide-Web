# API Parcel Service

TÃ i liá»‡u nÃ y Ä‘Æ°á»£c láº­p tá»« code hiá»‡n táº¡i cá»§a Parcel service trong `apps/parcel` vÃ  shared .NET web libraries. Chá»‰ cÃ¡c hÃ nh vi nhÃ¬n tháº¥y trong code Ä‘Æ°á»£c mÃ´ táº£; pháº§n chÆ°a Ä‘á»§ context Ä‘Æ°á»£c Ä‘Ã¡nh dáº¥u `âš ï¸ TODO: cáº§n xÃ¡c nháº­n thÃªm`.

## Má»¥c lá»¥c

- [Base URL](#base-url)
- [XÃ¡c thá»±c vÃ  header chung](#xÃ¡c-thá»±c-vÃ -header-chung)
- [Response envelope](#response-envelope)
- [Quy Æ°á»›c chung](#quy-Æ°á»›c-chung)
- [Tá»•ng quan endpoint](#tá»•ng-quan-endpoint)
- [Chi tiáº¿t endpoint](#chi-tiáº¿t-endpoint)
- [MÃ£ lá»—i theo code](#mÃ£-lá»—i-theo-code)

## Base URL

| MÃ´i trÆ°á»ng | Base URL | Nguá»“n |
|---|---:|---|
| Local direct Parcel | `http://localhost:5005` | `apps/parcel/src/VietRide.Parcel.Api/Properties/launchSettings.json` |
| Swagger production | `https://api.vietride.online/docs` | URL do user cung cáº¥p |
| Production API | `https://api.vietride.online` | URL Swagger do user cung cáº¥p; Gateway route table giá»¯ nguyÃªn path `/v1/...` khi proxy Parcel |

Service phá»¥ thuá»™c cáº¥u hÃ¬nh trong `appsettings.Development.json`: Trip `http://localhost:5002`, Booking `http://localhost:5003`, Payment `http://localhost:5004`, Identity `http://localhost:5001`.

## XÃ¡c thá»±c vÃ  header chung

| Loáº¡i endpoint | Auth | Header |
|---|---|---|
| User-facing cÃ³ `[Authorize]` | FE/Mobile gá»­i user access token tá»›i Gateway. Gateway verify RS256 báº±ng JWKS tá»« Identity (`issuer=vietride-identity`, `audience=vietride-api`), kiá»ƒm role theo route, rá»“i mint internal JWT vÃ  forward Parcel báº±ng `X-Internal-Auth`. | `Authorization: Bearer <access_token>` |
| Internal endpoint | Internal JWT HS256, issuer `vietride-gateway`, audience `vietride-internal`, secret `INTERNAL_JWT_SECRET`, clock skew 5 giÃ¢y. Token Ä‘á»c tá»« `X-Internal-Auth`, cÃ³ hoáº·c khÃ´ng cÃ³ prefix `Bearer `. | `X-Internal-Auth: Bearer <internal_jwt>` |
| Mutation cÃ³ `[RequireIdempotencyKey]` | Báº¯t buá»™c cÃ³ idempotency key. Thiáº¿u header tráº£ `422 VALIDATION_ERROR`. Middleware Redis xá»­ lÃ½ `POST`/`PATCH`: replay cÃ¹ng body, `422 IDEMPOTENCY_KEY_MISMATCH` náº¿u cÃ¹ng key khÃ¡c body, TTL 24h. | `Idempotency-Key: <unique-key>` |
| Correlation | Náº¿u cÃ³, response meta dÃ¹ng `X-Request-Id`; náº¿u khÃ´ng cÃ³ cÃ³ thá»ƒ rá»—ng hoáº·c trace id cá»§a ASP.NET tÃ¹y path. | `X-Request-Id: <request-id>` |

Claims Ä‘Æ°á»£c controller Ä‘á»c:

| Claim | DÃ¹ng cho |
|---|---|
| `sub` hoáº·c `ClaimTypes.NameIdentifier` | `userId` hiá»‡n táº¡i |
| `operatorId` | scope operator cho operator/assistant endpoints |
| `role` hoáº·c `ClaimTypes.Role` | role authorization |
| `permission` hoáº·c `permissions` | kiểm tra `CAN_OVERRIDE_CAPACITY` cho `/v1/operator/parcels/{parcelId}/override-capacity` |

## Response envelope

Success Ä‘Æ°á»£c `ApiResponseResultFilter` wrap tá»± Ä‘á»™ng, trá»« endpoint tráº£ file CSV vÃ  má»™t endpoint internal tracking Ä‘Ã£ tá»± wrap.

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

Model-binding lá»—i JSON/type/missing non-null field tráº£ HTTP `400` vá»›i `VALIDATION_ERROR`. FluentValidation vÃ  `CodedValidationException` tráº£ HTTP `422`.

## Quy Æ°á»›c chung

| Quy Æ°á»›c | GiÃ¡ trá»‹ thá»±c táº¿ trong code |
|---|---|
| JSON casing | camelCase theo `JsonSerializerDefaults.Web`/ASP.NET Core máº·c Ä‘á»‹nh |
| UUID | `Guid`, vÃ­ dá»¥ `11111111-1111-4111-8111-111111111111` |
| DateOnly query | `YYYY-MM-DD` |
| DateTimeOffset JSON | ISO-8601 |
| Parcel cargo dimensions | `lengthCm`, `widthCm`, `heightCm` tÃ­nh báº±ng cm; weight tÃ­nh báº±ng kg |
| Parcel cargo calculation | `volumeM3 = lengthCm * widthCm * heightCm / 1_000_000`; `dimWeightKg = lengthCm * widthCm * heightCm / DIM_WEIGHT_FACTOR`; `chargeableWeightKg = max(weightKg, dimWeightKg)` với `weightKg` là estimated hoặc actual theo ngữ cảnh |
| Parcel capacity | Check 2 trá»¥c Ä‘á»™c láº­p: volume vÃ  weight. Customer API khÃ´ng expose raw remaining capacity |
| Money | `long` VND, khÃ´ng decimal |
| `ParcelSizeCategory` | `SMALL`, `MEDIUM`, `LARGE`, `EXTRA_LARGE`; parse ignore-case á»Ÿ validator |
| `ParcelDeliveryMethod` | `TERMINAL_PICKUP` |
| `PaymentMethod` | `VNPAY`, `WALLET` |
| `PendingActionType` | `CAPACITY_EXCEEDED`, `RESERVE_FAILED`, `REFUND_CONFIRMATION`; dÃ¹ng khi `ParcelStatus = PENDING_OPERATOR_ACTION` |
| `ParcelStatus` | `PENDING_OPERATOR_REVIEW`, `PENDING_PAYMENT`, `PENDING`, `PENDING_ADDITIONAL_PAYMENT`, `LOADED`, `IN_TRANSIT`, `PENDING_TRANSFER_CONFIRM`, `TRANSFER_ESCALATED`, `UNLOADED`, `DELIVERED_PENDING_CONFIRM`, `DELIVERY_CONFIRMED`, `DELIVERY_REJECTED`, `RETURN_INITIATED`, `RETURNED`, `PENDING_OPERATOR_ACTION`, `CANCELLED`, `REJECTED`, `EXPIRED` |

## Tá»•ng quan endpoint

| Method | Path | MÃ´ táº£ ngáº¯n |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/ready` | Readiness |
| GET | `/v1/ping` | Ping Parcel |
| GET | `/v1/parcels/available-trips` | Passenger tÃ¬m chuyáº¿n cÃ³ thá»ƒ gá»­i hÃ ng |
| GET | `/v1/parcels/vouchers/available` | Passenger xem voucher cÃ³ thá»ƒ Ã¡p dá»¥ng cho parcel |
| POST | `/v1/parcels` | Passenger táº¡o parcel |
| GET | `/v1/parcels/received` | Passenger xem parcel mÃ¬nh nháº­n |
| GET | `/v1/parcels/{parcelId}` | Xem chi tiáº¿t parcel |
| POST | `/v1/parcels/delivery/confirm` | NgÆ°á»i nháº­n xÃ¡c nháº­n giao hÃ ng báº±ng token |
| POST | `/v1/parcels/delivery/reject` | NgÆ°á»i nháº­n tá»« chá»‘i giao hÃ ng báº±ng token |
| POST | `/v1/parcels/delivery/undo-reject` | Undo tá»« chá»‘i giao hÃ ng báº±ng token |
| GET | `/v1/operator/parcels/reports/summary` | Operator xem bÃ¡o cÃ¡o tá»•ng há»£p |
| GET | `/v1/operator/parcels/reports/export` | Operator export CSV |
| PATCH | `/v1/operator/parcels/{parcelId}/review` | Operator duyá»‡t/tá»« chá»‘i parcel |
| POST | `/v1/operator/parcels/{parcelId}/request-transfer` | Operator yÃªu cáº§u chuyá»ƒn parcel sang trip khÃ¡c |
| POST | `/v1/operator/parcels/{parcelId}/return` | Operator tráº£ hÃ ng |
| POST | `/v1/operator/parcels/{parcelId}/cancel` | Operator há»§y parcel |
| POST | `/v1/operator/parcels/{parcelId}/confirm-delivery` | Operator xÃ¡c nháº­n giao hÃ ng thá»§ cÃ´ng |
| POST | /v1/operator/parcels/{parcelId}/confirm-refund | Operator xac nhan refund khi reweigh thap hon uoc tinh |
| POST | /v1/operator/parcels/{parcelId}/override-capacity | Operator override capacity cho parcel can xu ly thu cong |
| PATCH | `/v1/operator/parcels/{parcelId}/status` | Operator override status, hiá»‡n chá»‰ há»— trá»£ `RETURNED` |
| POST | `/v1/operator/parcel-route-fares` | Operator admin táº¡o fare gá»­i hÃ ng theo route/size |
| GET | `/v1/operator/parcel-route-fares` | Operator admin/staff list fare |
| PATCH | `/v1/operator/parcel-route-fares/{routeId}/{sizeCategory}` | Operator admin cáº­p nháº­t fare |
| POST | `/v1/assistant/parcels/{parcelId}/reweigh` | Assistant cÃ¢n láº¡i parcel |
| POST | `/v1/assistant/parcels/{parcelId}/confirm-delivery` | Assistant xÃ¡c nháº­n giao hÃ ng thá»§ cÃ´ng |
| POST | `/v1/assistant/parcels/{parcelId}/unload` | Assistant unload parcel |
| POST | `/internal/v1/parcels/{parcelId}/mark-loaded` | Internal mark loaded |
| POST | `/internal/v1/parcels/{parcelId}/confirm-transfer` | Internal confirm transfer |
| GET | `/internal/v1/parcels/{parcelId}` | Internal láº¥y parcel snapshot |
| GET | `/internal/v1/parcels/{parcelId}/access-check` | Internal kiá»ƒm tra quyá»n truy cáº­p parcel |
| GET | `/internal/v1/trips/{tripId}/tracking-authorization/parcels` | Internal kiá»ƒm tra quyá»n tracking theo trip |

## Chi tiáº¿t endpoint

### GET `/health`

Liveness, khÃ´ng auth. Response khÃ´ng dÃ¹ng `ApiResponse` envelope.

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

Readiness, khÃ´ng auth. Cháº¡y health checks cÃ³ tag `ready` cho Postgres/Redis/RabbitMQ náº¿u config tÆ°Æ¡ng á»©ng tá»“n táº¡i.

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

Ping endpoint public, khÃ´ng auth.

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

Passenger tÃ¬m trip cÃ³ thá»ƒ gá»­i parcel.

Auth: `Authorization: Bearer <token>` role `PASSENGER`.

Query params:

| TÃªn | Kiá»ƒu | Báº¯t buá»™c | Default | Validation |
|---|---|---:|---:|---|
| `originStationId` | Guid | CÃ³ | - | NotEmpty |
| `destinationStationId` | Guid | CÃ³ | - | NotEmpty |
| `departureDate` | DateOnly | CÃ³ | - | NotEmpty, khÃ´ng pháº£i default |
| `lengthCm` | decimal | Có | - | `> 0` |
| `widthCm` | decimal | Có | - | `> 0` |
| `heightCm` | decimal | Có | - | `> 0` |
| `estimatedWeightKg` | decimal | CÃ³ | - | `> 0` |
| `sizeCategory` | string | CÃ³ | - | enum `ParcelSizeCategory`, ignore-case |
| `page` | int | KhÃ´ng | `1` | `>= 1` |
| `pageSize` | int | KhÃ´ng | `20` | `1..100` |

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
        "estimatedPriceVnd": 150000,
        "estimatedDepositVnd": 30000
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
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5005/v1/parcels/available-trips?originStationId=11111111-1111-4111-8111-111111111111&destinationStationId=22222222-2222-4222-8222-222222222222&departureDate=2026-07-05&lengthCm=30&widthCm=20&heightCm=15&estimatedWeightKg=2.5&sizeCategory=SMALL&page=1&pageSize=20"
```

```js
await fetch(`${baseUrl}/v1/parcels/available-trips?originStationId=${originStationId}&destinationStationId=${destinationStationId}&departureDate=2026-07-05&lengthCm=30&widthCm=20&heightCm=15&estimatedWeightKg=2.5&sizeCategory=SMALL`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());
```

### GET `/v1/parcels/vouchers/available`

Passenger láº¥y danh sÃ¡ch voucher cÃ³ thá»ƒ Ã¡p dá»¥ng cho parcel.

Auth: `Authorization: Bearer <token>` role `PASSENGER`.

Query params:

| TÃªn | Kiá»ƒu | Báº¯t buá»™c | Default | Validation |
|---|---|---:|---:|---|
| `tripId` | Guid | CÃ³ | - | Trip pháº£i tá»“n táº¡i |
| `sizeCategory` | string | CÃ³ | - | enum `ParcelSizeCategory`, ignore-case; `EXTRA_LARGE` tráº£ list rá»—ng |
| `paymentMethod` | string? | KhÃ´ng | null | Booking service lá»c theo payment method náº¿u cÃ³ |
| `orderAmount` | long? | KhÃ´ng | GiÃ¡ fare theo route/size | Với DIM flow nên truyền amount ước tính từ `available-trips`; nếu không truyền, Parcel fallback theo fare route/size đang cấu hình |

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "66666666-6666-4666-8666-666666666666",
      "code": "PARCEL10",
      "name": "Giáº£m 10% phÃ­ gá»­i hÃ ng",
      "type": "PERCENT",
      "value": 10,
      "minOrderAmount": 50000,
      "maxDiscountAmount": 20000,
      "discountAmount": 5000,
      "applicableServices": ["PARCEL"],
      "applicablePaymentMethods": ["VNPAY", "WALLET"],
      "validUntil": "2026-07-31T16:59:59Z"
    }
  ],
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T10:00:00.0000000Z" }
}
```

Errors trong code: `401/403` auth, `404 TRIP_NOT_FOUND`, `422 INVALID_SIZE_CATEGORY`, `503 TRIP_SERVICE_UNAVAILABLE`. Náº¿u Booking service khÃ´ng tráº£ `200`, Parcel tráº£ list rá»—ng.

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5005/v1/parcels/vouchers/available?tripId=11111111-1111-4111-8111-111111111111&sizeCategory=SMALL&paymentMethod=VNPAY"
```

```js
await fetch(`${baseUrl}/v1/parcels/vouchers/available?tripId=${tripId}&sizeCategory=SMALL&paymentMethod=VNPAY`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());
```

### POST `/v1/parcels`

Passenger táº¡o parcel.

Headers báº¯t buá»™c: `Authorization: Bearer <token>` role `PASSENGER`, `Idempotency-Key`.

Request body:

```json
{
  "tripId": "11111111-1111-4111-8111-111111111111",
  "dropoffStopId": "22222222-2222-4222-8222-222222222222",
  "bookingId": null,
  "itemName": "Ão khoÃ¡c",
  "description": "GÃ³i hÃ ng nhá»",
  "sizeCategory": "SMALL",
  "lengthCm": 30,
  "widthCm": 20,
  "heightCm": 15,
  "estimatedWeightKg": 2.5,
  "photoUrl": "https://example.com/photo.jpg",
  "recipient": {
    "fullName": "Nguyen Van A",
    "phoneNumber": "0900000000",
    "email": "a@example.com"
  },
  "deliveryMethod": "TERMINAL_PICKUP",
  "paymentMethod": "VNPAY",
  "voucherCode": "PARCEL10"
}
```

Validation:

| Field | Kiá»ƒu | Báº¯t buá»™c | Rule |
|---|---|---:|---|
| `tripId` | Guid | CÃ³ | NotEmpty |
| `dropoffStopId` | Guid? | KhÃ´ng | KhÃ´ng cÃ³ rule riÃªng |
| `bookingId` | Guid? | KhÃ´ng | KhÃ´ng cÃ³ rule riÃªng |
| `itemName` | string? | KhÃ´ng | KhÃ´ng cÃ³ rule riÃªng |
| `description` | string? | KhÃ´ng | max 2000 náº¿u khÃ´ng null |
| `sizeCategory` | string | CÃ³ | enum `ParcelSizeCategory`, ignore-case |
| `lengthCm` | decimal | Có | `> 0` |
| `widthCm` | decimal | Có | `> 0` |
| `heightCm` | decimal | Có | `> 0` |
| `estimatedWeightKg` | decimal | CÃ³ | `> 0` |
| `photoUrl` | string? | KhÃ´ng | KhÃ´ng cÃ³ rule riÃªng |
| `recipient.fullName` | string | CÃ³ | NotEmpty, max 255 |
| `recipient.phoneNumber` | string | CÃ³ | NotEmpty, max 20 |
| `recipient.email` | string? | KhÃ´ng | max 255, email náº¿u khÃ´ng null |
| `deliveryMethod` | string | CÃ³ | chá»‰ `TERMINAL_PICKUP` |
| `paymentMethod` | string | CÃ³ | `VNPAY` hoáº·c `WALLET` |
| `voucherCode` | string? | KhÃ´ng | Náº¿u cÃ³, Parcel gá»i Booking Ä‘á»ƒ validate voucher cho service `PARCEL`, operator, route, user, amount vÃ  payment method |

Success `201`:

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "parcelId": "33333333-3333-4333-8333-333333333333",
    "parcelCode": "PRC123456",
    "status": "PENDING_PAYMENT",
    "totalAmount": 45000,
    "originalDepositAmount": 50000,
    "discountAmount": 5000,
    "voucherCode": "PARCEL10",
    "paymentRedirectUrl": "https://payment.example/redirect"
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T10:00:00.0000000Z" }
}
```

`totalAmount` là số tiền cọc cần thanh toán sau khi trừ `discountAmount`; `originalDepositAmount` là tiền cọc gốc trước voucher. Tổng giá parcel theo DIM/chargeable weight được backend snapshot nội bộ và dùng lại ở bước reweigh/phụ thu/refund.

Errors trong code: `400 VALIDATION_ERROR` model binding, `401/403`, `403 USER_NOT_PASSENGER`, `403 USER_INACTIVE`, `403 FORBIDDEN`, `403 USER_FORBIDDEN`, `404 USER_NOT_FOUND`, `404 TRIP_NOT_FOUND`, `404 BOOKING_NOT_FOUND`, `409 BOOKING_NOT_FOR_THIS_TRIP`, `409 BOOKING_NOT_ATTACHABLE`, `409 TRIP_NOT_ACCEPTING_PARCEL`, `409 TRIP_CARGO_CAPACITY_EXCEEDED`, `409 PARCEL_CODE_COLLISION`, `422 VALIDATION_ERROR`, `422 INVALID_SIZE_CATEGORY`, `422 INVALID_DELIVERY_METHOD`, `422 DROP_OFF_STOP_NOT_FOUND`, `422 DROP_OFF_STOP_NOT_ALLOWED`, `422 FARE_NOT_CONFIGURED`, `422 VOUCHER_NOT_APPLICABLE`, `422 VOUCHER_USAGE_REJECTED`, `422 INSUFFICIENT_FUNDS`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 UPSTREAM_UNAVAILABLE`, `503 TRIP_SERVICE_UNAVAILABLE`, `503 BOOKING_SERVICE_UNAVAILABLE`, `503 PAYMENT_SERVICE_ERROR`.

```bash
curl -X POST "http://localhost:5005/v1/parcels" \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: parcel-create-001" -H "Content-Type: application/json" \
  -d '{"tripId":"11111111-1111-4111-8111-111111111111","dropoffStopId":null,"bookingId":null,"itemName":"Ão khoÃ¡c","description":"GÃ³i hÃ ng nhá»","sizeCategory":"SMALL","lengthCm":30,"widthCm":20,"heightCm":15,"estimatedWeightKg":2.5,"photoUrl":null,"recipient":{"fullName":"Nguyen Van A","phoneNumber":"0900000000","email":"a@example.com"},"deliveryMethod":"TERMINAL_PICKUP","paymentMethod":"VNPAY","voucherCode":"PARCEL10"}'
```

```js
await fetch(`${baseUrl}/v1/parcels`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": "parcel-create-001", "Content-Type": "application/json" },
  body: JSON.stringify(body)
}).then(r => r.json());
```

### GET `/v1/parcels/received`

Passenger láº¥y danh sÃ¡ch parcel mÃ  user hiá»‡n táº¡i lÃ  recipient.

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
        "originStation": { "id": "11111111-1111-4111-8111-111111111111", "name": "Báº¿n A" },
        "destinationStation": { "id": "22222222-2222-4222-8222-222222222222", "name": "Báº¿n B" },
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

Láº¥y chi tiáº¿t parcel. Auth báº¥t ká»³ role cÃ³ token; handler kiá»ƒm quyá»n báº±ng `userId`/`operatorId`.

Path params: `parcelId` Guid báº¯t buá»™c.

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
    "description": "GÃ³i hÃ ng nhá»",
    "sizeCategory": "SMALL",
    "estimatedWeightKg": 2.5,
    "actualWeightKg": null,
    "deliveryMethod": "TERMINAL_PICKUP",
    "depositAmount": 45000,
    "originalDepositAmount": 50000,
    "discountAmount": 5000,
    "voucherCode": "PARCEL10",
    "voucherUsageId": "77777777-7777-4777-8777-777777777777",
    "additionalAmount": 0,
    "createdAt": "2026-07-05T08:00:00Z",
    "loadedAt": null,
    "unloadedAt": null,
    "deliveredPendingConfirmAt": null,
    "confirmedAt": null,
    "rejectedAt": null,
    "originStationName": "Báº¿n A",
    "destinationStationName": "Báº¿n B",
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

CÃ¡c endpoint nÃ y `[AllowAnonymous]` nhÆ°ng váº«n báº¯t buá»™c `Idempotency-Key`.

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
{ "token": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "rejectionReason": "NgÆ°á»i nháº­n tá»« chá»‘i" }
```

Success data: `{ "parcelId": "...", "status": "DELIVERY_REJECTED", "rejectedAt": "...", "canUndoUntil": "..." }`.

Errors trong code: `400 PARCEL_DELIVERY_TOKEN_INVALID`, `400 PARCEL_DELIVERY_TOKEN_EXPIRED`, `400 PARCEL_DELIVERY_TOKEN_REVOKED`, `400 PARCEL_NOT_PENDING_CONFIRM`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`.

```bash
curl -X POST "http://localhost:5005/v1/parcels/delivery/reject" -H "Idempotency-Key: delivery-reject-001" -H "Content-Type: application/json" -d '{"token":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","rejectionReason":"NgÆ°á»i nháº­n tá»« chá»‘i"}'
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

Táº¥t cáº£ endpoint trong nhÃ³m nÃ y yÃªu cáº§u `Authorization: Bearer <token>` role `OPERATOR_ADMIN` hoáº·c `OPERATOR_STAFF`, vÃ  claim `operatorId`; náº¿u thiáº¿u `operatorId` tráº£ `403 FORBIDDEN`.

#### GET `/v1/operator/parcels/reports/summary`

Query: `from` DateOnly? optional, `to` DateOnly? optional. Náº¿u `from > to`, code nÃ©m `ArgumentException`, filter map thÃ nh `500 INTERNAL_ERROR`.

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

Query: `from` DateOnly? optional, `to` DateOnly? optional, `format` string? optional. Handler chá»‰ há»— trá»£ CSV; format khÃ¡c nÃ©m `ArgumentException`, filter map thÃ nh `500 INTERNAL_ERROR`.

Success `200` content type tá»« handler, file download CSV, khÃ´ng wrap envelope.

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

Validation: `decision` must be `APPROVED` or `REJECTED`; khi `APPROVED`, `paymentMethod` NotEmpty vÃ  lÃ  `WALLET`/`VNPAY`, `depositAmount > 0`; khi `REJECTED`, `reason` NotEmpty.

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

Body: `{ "returnReason": "KhÃ´ng giao Ä‘Æ°á»£c" }`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_TRANSITION`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_NOT_FOUND`, `503 TRIP_CARGO_CAPACITY_EXCEEDED`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/return" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: return-001" -H "Content-Type: application/json" -d '{"returnReason":"KhÃ´ng giao Ä‘Æ°á»£c"}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/${parcelId}/return`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ returnReason }) }).then(r => r.json());
```

#### POST `/v1/operator/parcels/{parcelId}/cancel`

Body: `{ "reason": "KhÃ¡ch yÃªu cáº§u há»§y", "refundChoice": "AUTO" }`.

`refundChoice` lÃ  string optional. Enum trong code: `FULL_REFUND`, `POLICY_REFUND`, `NO_REFUND`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_TRANSITION`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 INVALID_REFUND_CHOICE`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_NOT_FOUND`, `503 TRIP_CARGO_CAPACITY_EXCEEDED`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/cancel" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: cancel-001" -H "Content-Type: application/json" -d '{"reason":"KhÃ¡ch yÃªu cáº§u há»§y","refundChoice":null}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/${parcelId}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ reason, refundChoice: null }) }).then(r => r.json());
```

#### POST `/v1/operator/parcels/{parcelId}/confirm-refund`

Auth role `OPERATOR_ADMIN` hoặc `OPERATOR_STAFF`, claim `operatorId`, `Idempotency-Key`.

Chỉ hợp lệ khi parcel đang `PENDING_OPERATOR_ACTION` và `PendingActionType = REFUND_CONFIRMATION`.

Body:

```json
{ "reason": "Confirmed actual cargo is smaller than estimated" }
```

Success data: `{ "parcelId": "...", "parcelCode": "PRC123456", "status": "PENDING", "tripId": "..." }`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_PENDING_ACTION`, `409 INVALID_REFUND_AMOUNT`, `409 RACE_LOST`, `422 IDEMPOTENCY_KEY_MISMATCH`.

```bash
curl -X POST "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/confirm-refund" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: confirm-refund-001" -H "Content-Type: application/json" -d '{"reason":"Confirmed actual cargo is smaller than estimated"}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/${parcelId}/confirm-refund`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }).then(r => r.json());
```

#### POST `/v1/operator/parcels/{parcelId}/override-capacity`

Auth role `OPERATOR_ADMIN`, hoặc `OPERATOR_STAFF` có permission claim `CAN_OVERRIDE_CAPACITY`, claim `operatorId`, `Idempotency-Key`.

Chỉ hợp lệ khi parcel đang `PENDING_OPERATOR_ACTION` và `PendingActionType` là `CAPACITY_EXCEEDED` hoặc `RESERVE_FAILED`. Override là per-parcel, không mutate `Trip.MaxCargoVolumeM3`/`Trip.MaxCargoWeightKg`.

Body:

```json
{ "reason": "Driver approved loading within manual buffer" }
```

Success data: `{ "parcelId": "...", "parcelCode": "PRC123456", "status": "PENDING", "tripId": "..." }`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_PENDING_ACTION`, `409 TRIP_CARGO_CAPACITY_EXCEEDED`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_NOT_FOUND`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/override-capacity" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: override-capacity-001" -H "Content-Type: application/json" -d '{"reason":"Driver approved loading within manual buffer"}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/${parcelId}/override-capacity`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }).then(r => r.json());
```

#### POST `/v1/operator/parcels/{parcelId}/confirm-delivery`

Body: `{ "note": "ÄÃ£ xÃ¡c nháº­n táº¡i quáº§y" }`. Validation: `note` NotEmpty, max 500.

Success data: `{ "parcelId": "...", "status": "DELIVERY_CONFIRMED", "confirmedAt": "..." }`.

Errors: `400 PARCEL_NOT_PENDING_CONFIRM`, `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`.

```bash
curl -X POST "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/confirm-delivery" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: manual-confirm-001" -H "Content-Type: application/json" -d '{"note":"ÄÃ£ xÃ¡c nháº­n táº¡i quáº§y"}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/${parcelId}/confirm-delivery`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ note }) }).then(r => r.json());
```

#### PATCH `/v1/operator/parcels/{parcelId}/status`

Body: `{ "targetStatus": "RETURNED", "reason": "ÄÃ£ hoÃ n táº¥t tráº£ hÃ ng" }`. Validation: `targetStatus` NotEmpty, `reason` NotEmpty. Handler chá»‰ há»— trá»£ target status `RETURNED`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_TRANSITION`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`.

```bash
curl -X PATCH "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/status" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: status-001" -H "Content-Type: application/json" -d '{"targetStatus":"RETURNED","reason":"ÄÃ£ hoÃ n táº¥t tráº£ hÃ ng"}'
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

Validation: `routeId` NotEmpty; `sizeCategory` NotEmpty + valid enum; `priceVnd >= 1000`; `effectiveFrom` NotEmpty; náº¿u cÃ³ `effectiveUntil` thÃ¬ pháº£i `> effectiveFrom`.

Success `201` data: `routeId`, `sizeCategory`, `operatorId`, `priceVnd`, `effectiveFrom`, `effectiveUntil`, `createdAt`, `updatedAt`.

Errors: `403 FORBIDDEN`, `404 ROUTE_NOT_FOUND`, `409 PARCEL_ROUTE_FARE_EXISTS`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/operator/parcel-route-fares" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: fare-create-001" -H "Content-Type: application/json" -d '{"routeId":"22222222-2222-4222-8222-222222222222","sizeCategory":"SMALL","priceVnd":50000,"effectiveFrom":"2026-07-05T00:00:00Z","effectiveUntil":null}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcel-route-fares`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
```

#### GET `/v1/operator/parcel-route-fares`

Auth role `OPERATOR_ADMIN` hoáº·c `OPERATOR_STAFF`.

Query: `routeId` Guid? optional, `sizeCategory` string? optional, `page` default `1`, `pageSize` default `20`. Handler validate `page >= 1`, `pageSize 1..100`, `sizeCategory` valid enum náº¿u cÃ³.

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

Validation: Ã­t nháº¥t má»™t field update pháº£i Ä‘Æ°á»£c gá»­i; `priceVnd >= 1000` náº¿u cÃ³. `effectiveFrom/effectiveUntil` parse theo `DateTimeOffset`; handler cÃ³ kiá»ƒm `effectiveUntil > effectiveFrom` khi Ä‘á»§ dá»¯ liá»‡u.

Errors: `403 FORBIDDEN`, `404 ROUTE_NOT_FOUND`, `404 PARCEL_ROUTE_FARE_NOT_FOUND`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X PATCH "http://localhost:5005/v1/operator/parcel-route-fares/$ROUTE_ID/SMALL" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: fare-update-001" -H "Content-Type: application/json" -d '{"priceVnd":60000,"effectiveFrom":null,"effectiveUntil":null}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcel-route-fares/${routeId}/SMALL`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ priceVnd: 60000, effectiveFrom: null, effectiveUntil: null }) }).then(r => r.json());
```

### Assistant endpoints

Táº¥t cáº£ yÃªu cáº§u `Authorization: Bearer <token>` role `ASSISTANT`, claim `operatorId`, vÃ  `Idempotency-Key`.

#### POST `/v1/assistant/parcels/{parcelId}/reweigh`

Body:

```json
{
  "actualLengthCm": 32,
  "actualWidthCm": 21,
  "actualHeightCm": 16,
  "actualWeightKg": 3.2,
  "actualSizeCategory": "MEDIUM",
  "paymentMethod": "WALLET"
}
```

Validation: `actualLengthCm > 0`, `actualWidthCm > 0`, `actualHeightCm > 0`, `actualWeightKg > 0`, `actualSizeCategory` NotEmpty, `paymentMethod` `WALLET`/`VNPAY`.

Success data: `parcelId`, `parcelCode`, `status`, `actualChargeableWeightKg`, `totalPriceVnd`, `additionalAmount`, `refundAmount`, `paymentRedirectUrl`.

Capacity is handled before pricing. If actual cargo exceeds trip capacity, status becomes `PENDING_OPERATOR_ACTION` with `PendingActionType = CAPACITY_EXCEEDED`. If actual price is lower outside tolerance, status becomes `PENDING_OPERATOR_ACTION` with `PendingActionType = REFUND_CONFIRMATION`. If actual price is higher outside tolerance, status becomes `PENDING_ADDITIONAL_PAYMENT`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS`, `409 RACE_LOST`, `409 TRIP_CARGO_CAPACITY_EXCEEDED`, `422 INVALID_SIZE_CATEGORY`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 PAYMENT_SERVICE_ERROR`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/assistant/parcels/$PARCEL_ID/reweigh" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: reweigh-001" -H "Content-Type: application/json" -d '{"actualLengthCm":32,"actualWidthCm":21,"actualHeightCm":16,"actualWeightKg":3.2,"actualSizeCategory":"MEDIUM","paymentMethod":"WALLET"}'
```

```js
await fetch(`${baseUrl}/v1/assistant/parcels/${parcelId}/reweigh`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ actualLengthCm: 32, actualWidthCm: 21, actualHeightCm: 16, actualWeightKg: 3.2, actualSizeCategory: "MEDIUM", paymentMethod: "WALLET" }) }).then(r => r.json());
```

#### POST `/v1/assistant/parcels/{parcelId}/confirm-delivery`

Giá»‘ng operator manual confirm delivery. Body `{ "note": "ÄÃ£ xÃ¡c nháº­n táº¡i quáº§y" }`. Errors giá»‘ng endpoint operator tÆ°Æ¡ng á»©ng.

```bash
curl -X POST "http://localhost:5005/v1/assistant/parcels/$PARCEL_ID/confirm-delivery" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: assistant-confirm-001" -H "Content-Type: application/json" -d '{"note":"ÄÃ£ xÃ¡c nháº­n táº¡i quáº§y"}'
```

```js
await fetch(`${baseUrl}/v1/assistant/parcels/${parcelId}/confirm-delivery`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ note }) }).then(r => r.json());
```

#### POST `/v1/assistant/parcels/{parcelId}/unload`

KhÃ´ng cÃ³ body. Success data: `{ "parcelId": "...", "parcelCode": "PRC123456", "status": "DELIVERED_PENDING_CONFIRM" }`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `404 TRIP_NOT_FOUND`, `409 INVALID_STATUS`, `409 RACE_LOST`, `422 DROP_OFF_STOP_NOT_FOUND`, `422 DROP_OFF_STOP_NOT_ALLOWED`, `422 DROP_OFF_STOP_NOT_ARRIVED`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_SERVICE_UNAVAILABLE`, `503 TRIP_CARGO_CAPACITY_EXCEEDED`.

```bash
curl -X POST "http://localhost:5005/v1/assistant/parcels/$PARCEL_ID/unload" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: unload-001"
```

```js
await fetch(`${baseUrl}/v1/assistant/parcels/${parcelId}/unload`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key } }).then(r => r.json());
```

### Internal endpoints

Táº¥t cáº£ endpoint internal yÃªu cáº§u `X-Internal-Auth: Bearer <internal_jwt>`.

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

Success data: `{ "parcelId": "...", "allowed": true, "role": "SENDER" }`. `role` cÃ³ thá»ƒ lÃ  `SENDER`, `RECIPIENT`, `OPERATOR`, `NONE`.

Errors: `401 AUTH_TOKEN_INVALID`, `404 PARCEL_NOT_FOUND`.

```bash
curl -H "X-Internal-Auth: Bearer $INTERNAL_JWT" "http://localhost:5005/internal/v1/parcels/$PARCEL_ID/access-check?userId=$USER_ID"
```

```js
await fetch(`${baseUrl}/internal/v1/parcels/${parcelId}/access-check?userId=${userId}`, { headers: { "X-Internal-Auth": `Bearer ${internalJwt}` } }).then(r => r.json());
```

#### GET `/internal/v1/trips/{tripId}/tracking-authorization/parcels`

Query: `userId` Guid? optional, `role` string? optional, `operatorId` Guid? optional.

Success data: `{ "allowed": true, "scope": "OPERATOR", "error": null }`. `scope` khi allowed cÃ³ thá»ƒ lÃ  `OPERATOR`, `PARCEL_SENDER`, `PARCEL_RECIPIENT`.

Errors: `401 AUTH_TOKEN_INVALID`. Khi khÃ´ng Ä‘á»§ quyá»n theo parcel/trip, handler tráº£ `200` vá»›i `{ "allowed": false, "scope": null, "error": "ACCESS_DENIED" }`.

```bash
curl -H "X-Internal-Auth: Bearer $INTERNAL_JWT" "http://localhost:5005/internal/v1/trips/$TRIP_ID/tracking-authorization/parcels?userId=$USER_ID&role=PASSENGER"
```

```js
await fetch(`${baseUrl}/internal/v1/trips/${tripId}/tracking-authorization/parcels?userId=${userId}&role=PASSENGER`, { headers: { "X-Internal-Auth": `Bearer ${internalJwt}` } }).then(r => r.json());
```

## MÃ£ lá»—i theo code

CÃ¡c mÃ£ dÆ°á»›i Ä‘Ã¢y xuáº¥t hiá»‡n trá»±c tiáº¿p trong Parcel/API/shared code Ä‘Ã£ Ä‘á»c:

| HTTP | Code | NguyÃªn nhÃ¢n |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Model binding JSON/type/missing field |
| 400 | `PARCEL_DELIVERY_TOKEN_INVALID` | Delivery token khÃ´ng tá»“n táº¡i |
| 400 | `PARCEL_DELIVERY_TOKEN_EXPIRED` | Delivery token háº¿t háº¡n |
| 400 | `PARCEL_DELIVERY_TOKEN_REVOKED` | Delivery token Ä‘Ã£ revoke |
| 400 | `PARCEL_NOT_PENDING_CONFIRM` | Parcel khÃ´ng á»Ÿ tráº¡ng thÃ¡i chá» xÃ¡c nháº­n giao |
| 400 | `PARCEL_NOT_DELIVERY_REJECTED` | Undo reject khi parcel khÃ´ng á»Ÿ tráº¡ng thÃ¡i rejected |
| 400 | `PARCEL_DELIVERY_REJECTED_WINDOW_EXPIRED` | Háº¿t cá»­a sá»• undo reject |
| 401 | `AUTH_TOKEN_INVALID` | Internal JWT thiáº¿u/sai |
| 401 | `UNAUTHORIZED` | Thiáº¿u/sai user auth hoáº·c claim user id invalid |
| 403 | `FORBIDDEN` | KhÃ´ng cÃ³ quyá»n, thiáº¿u `operatorId`, hoáº·c operator khÃ´ng sá»Ÿ há»¯u parcel/trip |
| 403 | `USER_NOT_PASSENGER` | User táº¡o parcel khÃ´ng pháº£i passenger |
| 403 | `USER_INACTIVE` | User inactive |
| 404 | `PARCEL_NOT_FOUND` | KhÃ´ng tÃ¬m tháº¥y parcel hoáº·c parcel code/trip mismatch bá»‹ che thÃ nh not found |
| 404 | `TRIP_NOT_FOUND` | KhÃ´ng tÃ¬m tháº¥y trip |
| 404 | `ROUTE_NOT_FOUND` | KhÃ´ng tÃ¬m tháº¥y route khi thao tÃ¡c fare |
| 404 | `PARCEL_ROUTE_FARE_NOT_FOUND` | KhÃ´ng tÃ¬m tháº¥y fare route/size |
| 404 | `USER_NOT_FOUND` | KhÃ´ng tÃ¬m tháº¥y user |
| 404 | `BOOKING_NOT_FOUND` | KhÃ´ng tÃ¬m tháº¥y booking |
| 404 | `OPERATOR_NOT_FOUND` | KhÃ´ng tÃ¬m tháº¥y operator khi enrich available trips |
| 403 | `USER_FORBIDDEN` | Identity service khÃ´ng cho phÃ©p lookup user |
| 409 | `INVALID_STATUS` | Tráº¡ng thÃ¡i hiá»‡n táº¡i khÃ´ng cho phÃ©p thao tÃ¡c |
| 409 | `INVALID_TRANSITION` | Chuyá»ƒn tráº¡ng thÃ¡i khÃ´ng há»£p lá»‡ |
| 409 | `INVALID_TRANSFER_TARGET` | Trip chuyá»ƒn khÃ´ng há»£p lá»‡ |
| 409 | `RACE_LOST` | Optimistic/concurrent update tháº¥t báº¡i |
| 409 | `PARCEL_ROUTE_FARE_EXISTS` | Fare route/size Ä‘Ã£ tá»“n táº¡i |
| 409 | `BOOKING_NOT_FOR_THIS_TRIP` | Booking khÃ´ng thuá»™c trip request |
| 409 | `BOOKING_NOT_ATTACHABLE` | Booking khÃ´ng confirmed hoáº·c khÃ´ng cÃ³ active ticket Ä‘á»ƒ gáº¯n parcel |
| 409 | `TRIP_NOT_ACCEPTING_PARCEL` | Trip khÃ´ng á»Ÿ tráº¡ng thÃ¡i nháº­n parcel |
| 409 | `TRIP_CARGO_CAPACITY_EXCEEDED` | VÆ°á»£t táº£i cargo |
| 409 | `PARCEL_CODE_COLLISION` | KhÃ´ng táº¡o Ä‘Æ°á»£c mÃ£ parcel duy nháº¥t sau sá»‘ láº§n thá»­ tá»‘i Ä‘a |
| 422 | `VALIDATION_ERROR` | FluentValidation hoáº·c validation thá»§ cÃ´ng |
| 422 | `INVALID_SIZE_CATEGORY` | Size category khÃ´ng há»£p lá»‡ |
| 422 | `INVALID_DELIVERY_METHOD` | Delivery method khÃ´ng há»£p lá»‡ |
| 422 | `INVALID_DECISION` | Review decision khÃ´ng há»£p lá»‡ |
| 422 | `INVALID_REFUND_CHOICE` | Refund choice khÃ´ng há»£p lá»‡ |
| 409 | `INVALID_PENDING_ACTION` | Pending action hiện tại không khớp endpoint operator đang gọi |
| 409 | `INVALID_REFUND_AMOUNT` | Parcel không có refund amount hợp lệ để confirm |
| 422 | `ADDITIONAL_PAYMENT_NOT_REQUIRED` | Reweigh khÃ´ng cáº§n thanh toÃ¡n thÃªm |
| 422 | `FARE_NOT_CONFIGURED` | ChÆ°a cáº¥u hÃ¬nh fare parcel cho route/size |
| 422 | `VOUCHER_NOT_APPLICABLE` | Voucher khÃ´ng há»£p lá»‡ hoáº·c khÃ´ng Ã¡p dá»¥ng Ä‘Æ°á»£c cho parcel |
| 422 | `VOUCHER_USAGE_REJECTED` | Booking service tá»« chá»‘i ghi nháº­n lÆ°á»£t dÃ¹ng voucher |
| 422 | `INSUFFICIENT_FUNDS` | Wallet khÃ´ng Ä‘á»§ sá»‘ dÆ° khi thanh toÃ¡n parcel |
| 422 | `DROP_OFF_STOP_NOT_FOUND` | KhÃ´ng tÃ¬m tháº¥y stop unload |
| 422 | `DROP_OFF_STOP_NOT_ALLOWED` | Stop khÃ´ng cho drop-off |
| 422 | `DROP_OFF_STOP_NOT_ARRIVED` | Stop chÆ°a arrived |
| 422 | `IDEMPOTENCY_KEY_MISMATCH` | Reuse idempotency key vá»›i body khÃ¡c |
| 503 | `UPSTREAM_UNAVAILABLE` | Identity service lá»—i transport/dependency |
| 503 | `TRIP_SERVICE_UNAVAILABLE` | Lá»—i transport/dependency trip service |
| 503 | `TRIP_SEARCH_UNAVAILABLE` | Trip search lá»—i transport |
| 503 | `OPERATOR_LOOKUP_UNAVAILABLE` | Identity/operator lookup lá»—i |
| 503 | `USER_LOOKUP_UNAVAILABLE` | User lookup lá»—i |
| 503 | `BOOKING_SERVICE_UNAVAILABLE` | Booking service lá»—i |
| 503 | `PAYMENT_SERVICE_ERROR` | Payment service lá»—i khi charge parcel |
| 503 | `PAYMENT_SERVICE_UNAVAILABLE` | Payment service lá»—i |
| 500 | `INTERNAL_ERROR` | Exception khÃ´ng map rÃµ, vÃ­ dá»¥ `ArgumentException` á»Ÿ report format/date |

## Flow vÃ  lÆ°u Ã½ Ä‘áº·c biá»‡t

- Passenger thường gọi `GET /v1/parcels/available-trips` trước với `lengthCm`, `widthCm`, `heightCm`, `estimatedWeightKg`; backend tính `volumeM3`, `dimWeightKg`, `chargeableWeightKg`, check trip đủ cả volume và weight, rồi trả price/deposit estimate nhưng không expose raw remaining capacity cho customer.
- Passenger có thể gọi `GET /v1/parcels/vouchers/available` để chọn voucher, sau đó `POST /v1/parcels`; khi có `voucherCode`, Parcel validate voucher qua Booking với service `PARCEL`; nếu hợp lệ thì `totalAmount = originalDepositAmount - discountAmount` trên tiền cọc và ghi `voucherUsageId`.
- Sau payment succeeded, Parcel reserve cargo idempotently ở Trip. Reserve fail chuyển parcel sang `PENDING_OPERATOR_ACTION` với `PendingActionType = RESERVE_FAILED`.
- Khi assistant reweigh/re-measure tại bến, capacity được xử lý trước pricing. Nếu pass hoặc auto-overflow pass thì Trip ledger update từ estimated sang actual ngay, sau đó mới xét tolerance/phụ thu/refund.
- `PENDING_OPERATOR_ACTION` luôn phải đọc thêm `PendingActionType`: `CAPACITY_EXCEEDED` dùng `override-capacity`, `REFUND_CONFIRMATION` dùng `confirm-refund`, `RESERVE_FAILED` cần operator reject/reschedule/override theo flow recovery.
- Parcel táº¡o báº±ng `paymentMethod=VNPAY` cÃ³ thá»ƒ tráº£ `paymentRedirectUrl`; `WALLET` cÃ³ thá»ƒ tráº£ null tÃ¹y handler Payment. Náº¿u charge Payment tháº¥t báº¡i sau khi ghi voucher usage, Parcel gá»i Booking Ä‘á»ƒ bÃ¹ trá»«/xÃ³a usage theo reference parcel.
- `EXTRA_LARGE` Ä‘ang tráº£ list voucher rá»—ng á»Ÿ endpoint available voucher vÃ  Ä‘i flow `PENDING_OPERATOR_REVIEW`.
- Operator review `APPROVED` cáº§n `depositAmount` vÃ  `paymentMethod`; `REJECTED` cáº§n `reason`.
- Delivery public dÃ¹ng `token` dáº¡ng Guid, khÃ´ng dÃ¹ng Authorization header, nhÆ°ng báº¯t buá»™c `Idempotency-Key`.
- Internal endpoints dÃ¹ng `X-Internal-Auth`, khÃ´ng dÃ¹ng `Authorization`.
- Parcel service khÃ´ng tá»± rate-limit. Khi Ä‘i qua Gateway, request chá»‹u global rate limit `120 req / 60s` theo `RATE_LIMIT_DEFAULT_PER_MIN`, Redis-backed máº·c Ä‘á»‹nh; `THROTTLER_STORAGE_DISABLE_REDIS=1` chuyá»ƒn sang in-memory.
