# API Parcel Service

Tài liệu này được lập từ code hiện tại của Parcel service trong `apps/parcel` và shared .NET web libraries. Chỉ các hành vi nhìn thấy trong code được mô tả; phần chưa đủ context được đánh dấu `⚠️ TODO: cần xác nhận thêm`.

## Mục lục

- [Base URL](#base-url)
- [Xác thực và header chung](#xác-thực-và-header-chung)
- [Response envelope](#response-envelope)
- [Quy ước chung](#quy-ước-chung)
- [Tổng quan endpoint](#tổng-quan-endpoint)
- [Chi tiết endpoint](#chi-tiết-endpoint)
- [Mã lỗi theo code](#mã-lỗi-theo-code)
- [Luồng Parcel Settlement v2](#luồng-parcel-settlement-v2)

## Base URL

| Môi trường | Base URL | Nguồn |
|---|---:|---|
| Local direct Parcel | `http://localhost:5005` | `apps/parcel/src/VietRide.Parcel.Api/Properties/launchSettings.json` |
| Swagger production | `https://api.vietride.online/docs` | URL do user cung cấp |
| Production API | `https://api.vietride.online` | URL Swagger do user cung cấp; Gateway route table giữ nguyên path `/v1/...` khi proxy Parcel |

Service phụ thuộc cấu hình trong `appsettings.Development.json`: Trip `http://localhost:5002`, Booking `http://localhost:5003`, Payment `http://localhost:5004`, Identity `http://localhost:5001`.

## Xác thực và header chung

| Loại endpoint | Auth | Header |
|---|---|---|
| User-facing có `[Authorize]` | FE/Mobile gửi user access token tới Gateway. Gateway verify RS256 bằng JWKS từ Identity (`issuer=vietride-identity`, `audience=vietride-api`), kiểm role theo route, rồi mint internal JWT và forward Parcel bằng `X-Internal-Auth`. | `Authorization: Bearer <access_token>` |
| Internal endpoint | Internal JWT HS256, issuer `vietride-gateway`, audience `vietride-internal`, secret `INTERNAL_JWT_SECRET`, clock skew 5 giây. Token đọc từ `X-Internal-Auth`, có hoặc không có prefix `Bearer `. | `X-Internal-Auth: Bearer <internal_jwt>` |
| Mutation có `[RequireIdempotencyKey]` | Bắt buộc có idempotency key. Thiếu header trả `422 VALIDATION_ERROR`. Middleware Redis xử lý `POST`/`PATCH`: replay cùng body, `422 IDEMPOTENCY_KEY_MISMATCH` nếu cùng key khác body, TTL 24h. | `Idempotency-Key: <unique-key>` |
| Correlation | Nếu có, response meta dùng `X-Request-Id`; nếu không có có thể rỗng hoặc trace id của ASP.NET tùy path. | `X-Request-Id: <request-id>` |

Claims được controller đọc:

| Claim | Dùng cho |
|---|---|
| `sub` hoặc `ClaimTypes.NameIdentifier` | `userId` hiện tại |
| `operatorId` | scope operator cho operator/assistant endpoints |
| `role` hoặc `ClaimTypes.Role` | role authorization |
| `permission` hoặc `permissions` | kiểm tra `CAN_OVERRIDE_CAPACITY` cho `/v1/operator/parcels/{parcelId}/override-capacity` |

## Response envelope

Success được `ApiResponseResultFilter` wrap tự động, trừ endpoint trả file CSV và một endpoint internal tracking đã tự wrap.

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

Model-binding lỗi JSON/type/missing non-null field trả HTTP `400` với `VALIDATION_ERROR`. FluentValidation và `CodedValidationException` trả HTTP `422`.

## Quy ước chung

| Quy ước | Giá trị thực tế trong code |
|---|---|
| JSON casing | camelCase theo `JsonSerializerDefaults.Web`/ASP.NET Core mặc định |
| UUID | `Guid`, ví dụ `11111111-1111-4111-8111-111111111111` |
| DateOnly query | `YYYY-MM-DD` |
| DateTimeOffset JSON | ISO-8601 |
| Parcel cargo dimensions | `lengthCm`, `widthCm`, `heightCm` tính bằng cm; weight tính bằng kg |
| Parcel cargo calculation | `volumeM3 = lengthCm * widthCm * heightCm / 1_000_000`; `dimWeightKg = lengthCm * widthCm * heightCm / DIM_WEIGHT_FACTOR`; `chargeableWeightKg = max(weightKg, dimWeightKg)` với `weightKg` là estimated hoặc actual theo ngữ cảnh |
| Parcel capacity | Check 2 trục độc lập: volume và weight. Customer API không expose raw remaining capacity |
| Money | `long` VND, không decimal |
| `ParcelSizeCategory` | `SMALL`, `MEDIUM`, `LARGE`, `EXTRA_LARGE`; parse ignore-case ở validator |
| `ParcelDeliveryMethod` | `TERMINAL_PICKUP` |
| `PaymentMethod` | `VNPAY`, `WALLET` |
| `PendingActionType` | `CAPACITY_EXCEEDED`, `RESERVE_FAILED`, `REFUND_CONFIRMATION`; dùng khi `ParcelStatus = PENDING_OPERATOR_ACTION` |
| `ParcelStatus` | `PENDING_OPERATOR_REVIEW`, `PENDING_PAYMENT`, `PENDING`, `PENDING_ADDITIONAL_PAYMENT`, `RESERVED`, `CHECKED_IN`, `PENDING_FINAL_PAYMENT`, `READY_TO_LOAD`, `LOADED`, `IN_TRANSIT`, `PENDING_TRANSFER_CONFIRM`, `TRANSFER_ESCALATED`, `UNLOADED`, `DELIVERED_PENDING_CONFIRM`, `DELIVERY_CONFIRMED`, `DELIVERY_REJECTED`, `RETURN_INITIATED`, `RETURNED`, `PENDING_OPERATOR_ACTION`, `CANCELLED`, `REJECTED`, `EXPIRED` |

## Tổng quan endpoint

| Method | Path | Mô tả ngắn |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/ready` | Readiness |
| GET | `/v1/ping` | Ping Parcel |
| GET | `/v1/parcels/available-trips` | Passenger tìm chuyến có thể gửi hàng |
| GET | `/v1/parcels/vouchers/available` | Passenger xem voucher có thể áp dụng cho parcel |
| POST | `/v1/parcels` | Passenger tạo parcel |
| POST | `/v1/parcels/{parcelId}/deposit-payment` | Passenger bắt đầu thanh toán cọc 20% |
| POST | `/v1/parcels/{parcelId}/final-payment` | Passenger thanh toán số dư sau khi cân thực tế |
| GET | `/v1/parcels/received` | Passenger xem parcel mình nhận |
| GET | `/v1/parcels/sent` | Passenger xem parcel mình đã gửi |
| GET | `/v1/parcels/{parcelId}` | Xem chi tiết parcel |
| POST | `/v1/parcels/delivery/confirm` | Người nhận xác nhận giao hàng bằng token |
| POST | `/v1/parcels/delivery/reject` | Người nhận từ chối giao hàng bằng token |
| POST | `/v1/parcels/delivery/undo-reject` | Undo từ chối giao hàng bằng token |
| GET | `/v1/operator/parcels` | Operator lấy danh sách Parcel theo tenant, trạng thái và chuyến |
| GET | `/v1/operator/parcels/reports/summary` | Operator xem báo cáo tổng hợp |
| GET | `/v1/operator/parcels/reports/export` | Operator export CSV |
| PATCH | `/v1/operator/parcels/{parcelId}/review` | Operator duyệt/từ chối parcel |
| POST | `/v1/operator/parcels/{parcelId}/request-transfer` | Operator yêu cầu chuyển parcel sang trip khác |
| POST | `/v1/operator/parcels/{parcelId}/return` | Operator trả hàng |
| POST | `/v1/operator/parcels/{parcelId}/cancel` | Operator hủy parcel |
| POST | `/v1/operator/parcels/{parcelId}/confirm-delivery` | Operator xác nhận giao hàng thủ công |
| POST | `/v1/operator/parcels/{parcelId}/confirm-refund` | Operator xác nhận refund khi reweigh thấp hơn ước tính |
| POST | `/v1/operator/parcels/{parcelId}/override-capacity` | Operator override capacity cho parcel cần xử lý thủ công |
| PATCH | `/v1/operator/parcels/{parcelId}/status` | Operator override status, hiện chỉ hỗ trợ `RETURNED` |
| POST | `/v1/operator/parcel-route-fares` | Operator admin tạo fare gửi hàng theo route/size |
| GET | `/v1/operator/parcel-route-fares` | Operator admin/staff list fare |
| PATCH | `/v1/operator/parcel-route-fares/{routeId}/{sizeCategory}` | Operator admin cập nhật fare |
| GET | `/v1/assistant/trips/{tripId}/parcels` | Assistant xem danh sách parcel theo chuyến được phân công |
| POST | `/v1/assistant/parcels/{parcelId}/check-in` | Assistant check-in parcel tại bến |
| POST | `/v1/assistant/parcels/{parcelId}/reweigh` | Assistant cân lại parcel |
| POST | `/v1/assistant/parcels/{parcelId}/load` | Assistant xác nhận xếp parcel lên xe |
| POST | `/v1/assistant/parcels/{parcelId}/deliver` | Assistant bàn giao parcel cho người nhận |
| POST | `/v1/assistant/parcels/{parcelId}/confirm-delivery` | Assistant xác nhận giao hàng thủ công |
| POST | `/v1/assistant/parcels/{parcelId}/unload` | Assistant unload parcel |
| POST | `/internal/v1/parcels/{parcelId}/mark-loaded` | Internal mark loaded |
| POST | `/internal/v1/parcels/{parcelId}/confirm-transfer` | Internal confirm transfer |
| GET | `/internal/v1/parcels/{parcelId}` | Internal lấy parcel snapshot |
| GET | `/internal/v1/parcels/{parcelId}/access-check` | Internal kiểm tra quyền truy cập parcel |
| GET | `/internal/v1/trips/{tripId}/tracking-authorization/parcels` | Internal kiểm tra quyền tracking theo trip |

## Chi tiết endpoint

### GET `/health`

Liveness, không auth. Response không dùng `ApiResponse` envelope.

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

Readiness, không auth. Chạy health checks có tag `ready` cho Postgres/Redis/RabbitMQ nếu config tương ứng tồn tại.

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

Ping endpoint public, không auth.

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

Passenger tìm chuyến có thể nhận parcel theo tuyến, ngày đi và kích thước hàng ước tính.

Auth: `Authorization: Bearer <token>` role `PASSENGER`.

Query params:

| Tên | Kiểu | Bắt buộc | Default | Validation |
|---|---|---:|---:|---|
| `originStationId` | Guid | Có | - | NotEmpty |
| `destinationStationId` | Guid | Có | - | NotEmpty |
| `departureDate` | DateOnly | Có | - | NotEmpty, không phải default |
| `lengthCm` | decimal | Có | - | `> 0` |
| `widthCm` | decimal | Có | - | `> 0` |
| `heightCm` | decimal | Có | - | `> 0` |
| `estimatedWeightKg` | decimal | Có | - | `> 0` |
| `sizeCategory` | string? | Không | null | Legacy hint; nếu truyền thì phải là `ParcelSizeCategory`. Backend không dùng hint này để suy ra size, chọn fare hoặc lọc chuyến. |
| `page` | int | Không | `1` | `>= 1` |
| `pageSize` | int | Không | `20` | `1..100` |

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
        "status": "SCHEDULED",
        "operatorId": "33333333-3333-4333-8333-333333333333",
        "operatorName": "VietRide Operator",
        "originStation": {
          "id": "44444444-4444-4444-8444-444444444444",
          "name": "Bến đi"
        },
        "destinationStation": {
          "id": "55555555-5555-4555-8555-555555555555",
          "name": "Bến đến"
        },
        "departureDateTime": "2026-07-05T08:00:00+07:00",
        "estimatedArrivalTime": "2026-07-05T16:00:00+07:00",
        "estimatedPriceVnd": 150000,
        "depositPercent": 20,
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

Ý nghĩa các field bổ sung:

| Field | Mô tả |
|---|---|
| `status` | Trạng thái Trip hiện tại; chỉ chuyến `SCHEDULED` hoặc `BOARDING` thỏa bộ lọc mới được trả về. |
| `operatorId` | ID nhà xe sở hữu Trip/Route. |
| `originStation`, `destinationStation` | Snapshot `{ id, name }` để FE dựng card. Route có Station bị thiếu, inactive hoặc soft-delete sẽ bị loại. |
| `estimatedArrivalTime` | ETA của Trip. |
| `depositPercent` | Phần trăm cọc đã resolve theo policy Route/Operator và dùng để tính `estimatedDepositVnd`. |

Backend tự tính thông tin hàng từ bốn số đo FE gửi:

```text
volumeM3 = lengthCm * widthCm * heightCm / 1_000_000
dimWeightKg = lengthCm * widthCm * heightCm / DIM_WEIGHT_FACTOR
chargeableWeightKg = max(estimatedWeightKg, dimWeightKg)
```

`ParcelSizeCategory` được suy ra từ `chargeableWeightKg`: `SMALL` đến 5 kg, `MEDIUM` trên 5 đến 15 kg, `LARGE` trên 15 đến 30 kg, còn lại là `EXTRA_LARGE`. Vì vậy FE không cần tự tính hoặc gửi `sizeCategory` khi tìm chuyến. Nếu vẫn gửi hint cũ, giá trị đó không làm thay đổi size backend đã suy ra.

#### Điều kiện để một chuyến xuất hiện

Tất cả điều kiện sau phải đồng thời thỏa mãn:

1. Route đúng `originStationId` và `destinationStationId`, đang active và chưa bị soft-delete.
2. Cả ga đi và ga đến đang active và chưa bị soft-delete.
3. Trip thuộc Route trên, có status `SCHEDULED` hoặc `BOARDING`, và giờ khởi hành nằm trong `departureDate` theo múi giờ `+07:00`.
4. Trip có cấu hình cả `maxCargoWeightKg` và `maxCargoVolumeM3`. Giá trị null được xem là sức chứa bằng 0.
5. Sức chứa còn lại đủ cả hai trục:

   ```text
   availableWeightKg = maxCargoWeightKg - reservedParcelWeightKg - totalLoadedWeightKg
   availableVolumeM3 = maxCargoVolumeM3 - reservedParcelVolumeM3 - totalLoadedVolumeM3
   ```

6. Operator đã cấu hình `ParcelRouteFare` cho đúng cặp `(routeId, derivedSizeCategory)`. Thiếu fare thì Parcel loại chuyến khỏi kết quả dù Trip còn tải.

Để Passenger tìm được chuyến, phía Operator cần có Route/Station hợp lệ, tạo Trip với cargo weight và volume, sau đó cấu hình fare Parcel cho từng size muốn nhận. Endpoint tìm chuyến hiện không có bước riêng yêu cầu bật subscription `enable_parcel`.

Response public không serialize `availableCargoWeightKg`, `availableCargoVolumeM3` hoặc alias nội bộ
`priceVnd`. Backend vẫn dùng hai giá trị cargo để chỉ trả chuyến đủ đồng thời weight và volume;
pagination, ordering và công thức capacity không thay đổi.

Errors trong code: `401/403` auth, `422 VALIDATION_ERROR` (bao gồm legacy `sizeCategory` không hợp lệ), `404 OPERATOR_NOT_FOUND`, `503 TRIP_SEARCH_UNAVAILABLE`, `503 OPERATOR_LOOKUP_UNAVAILABLE`.

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5005/v1/parcels/available-trips?originStationId=11111111-1111-4111-8111-111111111111&destinationStationId=22222222-2222-4222-8222-222222222222&departureDate=2026-07-05&lengthCm=30&widthCm=20&heightCm=15&estimatedWeightKg=2.5&page=1&pageSize=20"
```

```js
await fetch(`${baseUrl}/v1/parcels/available-trips?originStationId=${originStationId}&destinationStationId=${destinationStationId}&departureDate=2026-07-05&lengthCm=30&widthCm=20&heightCm=15&estimatedWeightKg=2.5`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());
```

### GET `/v1/parcels/vouchers/available`

Passenger lấy danh sách voucher có thể áp dụng cho parcel.

Auth: `Authorization: Bearer <token>` role `PASSENGER`.

Query params:

| Tên | Kiểu | Bắt buộc | Default | Validation |
|---|---|---:|---:|---|
| `tripId` | Guid | Có | - | Trip phải tồn tại |
| `sizeCategory` | string | Có | - | enum `ParcelSizeCategory`, ignore-case; `EXTRA_LARGE` trả list rỗng |
| `paymentMethod` | string? | Không | null | Booking service lọc theo payment method nếu có |
| `orderAmount` | long? | Không | Giá fare theo route/size | Với DIM flow nên truyền amount ước tính từ `available-trips`; nếu không truyền, Parcel fallback theo fare route/size đang cấu hình |

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "66666666-6666-4666-8666-666666666666",
      "code": "PARCEL10",
      "name": "Giảm 10% phí gửi hàng",
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

Errors trong code: `401/403` auth, `404 TRIP_NOT_FOUND`, `422 INVALID_SIZE_CATEGORY`, `503 TRIP_SERVICE_UNAVAILABLE`. Nếu Booking service không trả `200`, Parcel trả list rỗng.

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5005/v1/parcels/vouchers/available?tripId=11111111-1111-4111-8111-111111111111&sizeCategory=SMALL&paymentMethod=VNPAY"
```

```js
await fetch(`${baseUrl}/v1/parcels/vouchers/available?tripId=${tripId}&sizeCategory=SMALL&paymentMethod=VNPAY`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());
```

### POST `/v1/parcels`

Passenger tạo parcel.

Headers bắt buộc: `Authorization: Bearer <token>` role `PASSENGER`, `Idempotency-Key`.

Request body:

```json
{
  "tripId": "11111111-1111-4111-8111-111111111111",
  "dropoffStopId": "22222222-2222-4222-8222-222222222222",
  "bookingId": null,
  "itemName": "Áo khoác",
  "description": "Gói hàng nhỏ",
  "sizeCategory": "SMALL",
  "lengthCm": 30,
  "widthCm": 20,
  "heightCm": 15,
  "estimatedWeightKg": 2.5,
  "photoUrl": "https://storage.googleapis.com/{bucket}/parcels/{senderUserId}/photo.webp",
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

| Field | Kiểu | Bắt buộc | Rule |
|---|---|---:|---|
| `tripId` | Guid | Có | NotEmpty |
| `dropoffStopId` | Guid? | Không | Không có rule riêng |
| `bookingId` | Guid? | Không | Không có rule riêng |
| `itemName` | string? | Không | Không có rule riêng |
| `description` | string? | Không | max 2000 nếu không null |
| `sizeCategory` | string | Có | Field tương thích ngược, phải là `ParcelSizeCategory`. Với Settlement v2, backend vẫn tự suy ra size từ `chargeableWeightKg`; hint này không quyết định giá hoặc size persist. |
| `lengthCm` | decimal | Có | `> 0` |
| `widthCm` | decimal | Có | `> 0` |
| `heightCm` | decimal | Có | `> 0` |
| `estimatedWeightKg` | decimal | Có | `> 0` |
| `photoUrl` | string? | Không | Blank được chuẩn hóa thành null; nếu có phải là absolute HTTPS URL tối đa 2.048 ký tự, thuộc Firebase/Google Storage bucket cấu hình và object path `parcels/{senderUserId}/...` của chính người gửi. FE upload trực tiếp; backend chỉ lưu URL. |
| `recipient.fullName` | string | Có | NotEmpty, max 255 |
| `recipient.phoneNumber` | string | Có | NotEmpty, max 20 |
| `recipient.email` | string? | Không | max 255, email nếu không null |
| `deliveryMethod` | string | Có | chỉ `TERMINAL_PICKUP` |
| `paymentMethod` | string | Có | `VNPAY` hoặc `WALLET`; dùng khi validate voucher lúc tạo. Việc charge cọc chỉ bắt đầu ở endpoint `deposit-payment`. |
| `voucherCode` | string? | Không | Nếu có, Parcel gọi Booking để validate voucher cho service `PARCEL`, operator, route, user, amount và payment method |

Success `201`:

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "parcelId": "33333333-3333-4333-8333-333333333333",
    "parcelCode": "PRC123456",
    "status": "PENDING_PAYMENT",
    "estimatedSizeCategory": "SMALL",
    "estimatedGrossPriceVnd": 10000,
    "discountAmountVnd": 1000,
    "estimatedTotalPriceVnd": 9000,
    "depositPercent": 20,
    "depositRequiredVnd": 1800,
    "depositPaidVnd": 0,
    "voucherCode": "PARCEL10",
    "settlementPolicyVersion": 2
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T10:00:00.0000000Z" }
}
```

`POST /v1/parcels` chỉ tạo Parcel và snapshot giá/policy; không reserve cargo lâu dài và không gọi Payment để charge ngay. Parcel thường vào `PENDING_PAYMENT`; riêng `EXTRA_LARGE` vào `PENDING_OPERATOR_REVIEW` trước.

Settlement v2 tính giá ước tính như sau:

```text
estimatedGrossPriceVnd = max(
  minimumPriceVnd,
  round(chargeableWeightKg * pricePerKgVnd)
)
estimatedTotalPriceVnd =
  estimatedGrossPriceVnd - min(discountAmountVnd, estimatedGrossPriceVnd)
depositRequiredVnd = round(estimatedTotalPriceVnd * 20 / 100)
```

Không làm tròn trọng lượng lên kilogram nguyên. Ví dụ `3,2 kg × 1.000đ/kg = 3.200đ` trước khi áp dụng minimum price và voucher. Voucher không bao giờ làm tổng giá âm.

Errors trong code: `400 VALIDATION_ERROR` model binding, `401/403`, `403 USER_NOT_PASSENGER`, `403 USER_INACTIVE`, `403 FORBIDDEN`, `403 USER_FORBIDDEN`, `404 USER_NOT_FOUND`, `404 TRIP_NOT_FOUND`, `404 BOOKING_NOT_FOUND`, `409 BOOKING_NOT_FOR_THIS_TRIP`, `409 BOOKING_NOT_ATTACHABLE`, `409 TRIP_NOT_ACCEPTING_PARCEL`, `409 PARCEL_CHECK_IN_CLOSED`, `409 PARCEL_CODE_COLLISION`, `422 VALIDATION_ERROR`, `422 INVALID_SIZE_CATEGORY`, `422 INVALID_DELIVERY_METHOD`, `422 DROP_OFF_STOP_NOT_FOUND`, `422 DROP_OFF_STOP_NOT_ALLOWED`, `422 FARE_NOT_CONFIGURED`, `422 VOUCHER_NOT_APPLICABLE`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 UPSTREAM_UNAVAILABLE`, `503 TRIP_SERVICE_UNAVAILABLE`, `503 BOOKING_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/parcels" \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: parcel-create-001" -H "Content-Type: application/json" \
  -d '{"tripId":"11111111-1111-4111-8111-111111111111","dropoffStopId":null,"bookingId":null,"itemName":"Áo khoác","description":"Gói hàng nhỏ","sizeCategory":"SMALL","lengthCm":30,"widthCm":20,"heightCm":15,"estimatedWeightKg":2.5,"photoUrl":null,"recipient":{"fullName":"Nguyen Van A","phoneNumber":"0900000000","email":"a@example.com"},"deliveryMethod":"TERMINAL_PICKUP","paymentMethod":"VNPAY","voucherCode":"PARCEL10"}'
```

```js
await fetch(`${baseUrl}/v1/parcels`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": "parcel-create-001", "Content-Type": "application/json" },
  body: JSON.stringify(body)
}).then(r => r.json());
```

### POST `/v1/parcels/{parcelId}/deposit-payment`

Passenger bắt đầu thanh toán tiền cọc sau khi Parcel đã ở `PENDING_PAYMENT`. Với `EXTRA_LARGE`, phải chờ Operator duyệt trước rồi mới gọi endpoint này.

Headers bắt buộc: `Authorization: Bearer <token>` role `PASSENGER`, `Idempotency-Key`.

Body:

```json
{ "paymentMethod": "VNPAY" }
```

`paymentMethod` chỉ nhận `WALLET` hoặc `VNPAY`. Chỉ sender của Parcel được thanh toán.

Trước khi tạo payment, Parcel atomically reserve cargo ước tính bên Trip. Đây là soft hold trong tối đa 15 phút và luôn bị chặn bởi `latestCheckInAt`:

```text
paymentDueAt = min(now + 15 phút, latestCheckInAt)
```

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "parcelId": "33333333-3333-4333-8333-333333333333",
    "status": "PENDING_PAYMENT",
    "depositPaymentId": "66666666-6666-4666-8666-666666666666",
    "depositRequiredVnd": 1800,
    "depositPaidVnd": 0,
    "paymentDueAt": "2026-07-05T08:15:00Z",
    "paymentRedirectUrl": "https://payment.example/redirect"
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T08:00:00Z" }
}
```

Nếu `depositRequiredVnd = 0`, backend không tạo payment; Parcel chuyển thẳng sang `RESERVED` và response có `depositPaymentId`, `paymentDueAt`, `paymentRedirectUrl` bằng null.

Payment success đúng hạn chuyển `PENDING_PAYMENT → RESERVED` và ghi `depositPaidVnd`. Payment fail/expire chuyển sang `EXPIRED` và release cargo hold. Voucher chỉ được consume khi cọc được công nhận thành công.

Errors chính: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS`, `409 PAYMENT_ALREADY_STARTED`, `409 PARCEL_CHECK_IN_CLOSED`, `409 TRIP_CARGO_CAPACITY_EXCEEDED`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 VOUCHER_NOT_APPLICABLE`, `422 INSUFFICIENT_FUNDS`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_SERVICE_UNAVAILABLE`, `503 BOOKING_SERVICE_UNAVAILABLE`, `503 PAYMENT_SERVICE_ERROR`.

```bash
curl -X POST "http://localhost:5005/v1/parcels/$PARCEL_ID/deposit-payment" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: deposit-001" -H "Content-Type: application/json" -d '{"paymentMethod":"VNPAY"}'
```

### POST `/v1/parcels/{parcelId}/final-payment`

Passenger thanh toán phần còn lại sau khi Assistant check-in và cân thực tế. Endpoint chỉ nhận Parcel `PENDING_FINAL_PAYMENT` và luôn dùng `balanceRequiredVnd - balancePaidVnd` do server tính; FE không gửi amount.

Headers bắt buộc: `Authorization: Bearer <token>` role `PASSENGER`, `Idempotency-Key`.

Body:

```json
{ "paymentMethod": "WALLET" }
```

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "parcelId": "33333333-3333-4333-8333-333333333333",
    "status": "PENDING_FINAL_PAYMENT",
    "balancePaymentId": "77777777-7777-4777-8777-777777777777",
    "balanceRequiredVnd": 7200,
    "balancePaidVnd": 0,
    "finalPaymentDeadline": "2026-07-05T09:20:00Z",
    "paymentRedirectUrl": null
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-05T09:00:00Z" }
}
```

Payment success có `paidAt < finalPaymentDeadline` chuyển Parcel sang `READY_TO_LOAD`. `paidAt >= deadline` không được cộng vào `balancePaidVnd`; Payment Service chịu trách nhiệm theo dõi capture/refund khoản trả muộn.

Errors chính: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS`, `409 PAYMENT_ALREADY_STARTED`, `409 FINAL_PAYMENT_DEADLINE_PASSED`, `409 BALANCE_ALREADY_PAID`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 INSUFFICIENT_FUNDS`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 PAYMENT_SERVICE_ERROR`.

```bash
curl -X POST "http://localhost:5005/v1/parcels/$PARCEL_ID/final-payment" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: final-payment-001" -H "Content-Type: application/json" -d '{"paymentMethod":"WALLET"}'
```

### GET `/v1/parcels/received`

Passenger lấy danh sách parcel mà user hiện tại là recipient.

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
        "originStation": { "id": "11111111-1111-4111-8111-111111111111", "name": "Bến A" },
        "destinationStation": { "id": "22222222-2222-4222-8222-222222222222", "name": "Bến B" },
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

### GET `/v1/parcels/sent`

Passenger lấy lịch sử Parcel mình đã gửi. Auth role `PASSENGER`.

Query: `status` optional; `from`, `to` optional theo `YYYY-MM-DD`; `page` mặc định `1`; `pageSize` mặc định `20`, tối đa `100`.

Response là `PagedResult<SentParcelHistoryItemDto>`, mỗi item gồm `parcelId`, `parcelCode`, `tripId`, `status`, `createdAt`, `totalAmount`, thông tin tuyến/chuyến, `bookingId`, người nhận, `sizeCategory`, `photoUrl`, `deliveryMethod`.

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5005/v1/parcels/sent?status=READY_TO_LOAD&page=1&pageSize=20"
```

### GET `/v1/parcels/{parcelId}`

Lấy chi tiết parcel. Auth bất kỳ role có token; handler kiểm quyền bằng `userId`/`operatorId`.

Path params: `parcelId` Guid bắt buộc.

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "parcelId": "33333333-3333-4333-8333-333333333333",
    "parcelCode": "PRC123456",
    "status": "PENDING_FINAL_PAYMENT",
    "senderUserId": "44444444-4444-4444-8444-444444444444",
    "recipientUserId": null,
    "recipientName": "Nguyen Van A",
    "recipientPhone": "0900000000",
    "operatorId": "55555555-5555-4555-8555-555555555555",
    "tripId": "11111111-1111-4111-8111-111111111111",
    "dropoffStopId": null,
    "description": "Gói hàng nhỏ",
    "photoUrl": "https://storage.googleapis.com/vietride.appspot.com/parcels/44444444-4444-4444-8444-444444444444/photo.webp",
    "sizeCategory": "SMALL",
    "estimatedWeightKg": 2.5,
    "actualWeightKg": 3.2,
    "deliveryMethod": "TERMINAL_PICKUP",
    "depositAmount": 500,
    "originalDepositAmount": 500,
    "discountAmount": 0,
    "voucherCode": null,
    "voucherUsageId": null,
    "additionalAmount": 0,
    "estimatedSizeCategory": "SMALL",
    "actualSizeCategory": "SMALL",
    "estimatedLengthCm": 30,
    "estimatedWidthCm": 20,
    "estimatedHeightCm": 15,
    "estimatedVolumeM3": 0.009,
    "estimatedDimWeightKg": 1.5,
    "estimatedChargeableWeightKg": 2.5,
    "actualLengthCm": 32,
    "actualWidthCm": 20,
    "actualHeightCm": 15,
    "actualVolumeM3": 0.0096,
    "actualDimWeightKg": 1.6,
    "actualChargeableWeightKg": 3.2,
    "estimatedGrossPriceVnd": 2500,
    "finalGrossPriceVnd": 3200,
    "discountAmountVnd": 0,
    "estimatedTotalPriceVnd": 2500,
    "finalTotalPriceVnd": 3200,
    "depositPercent": 20,
    "depositRequiredVnd": 500,
    "depositPaidVnd": 500,
    "balanceRequiredVnd": 2700,
    "balancePaidVnd": 0,
    "refundDueVnd": 0,
    "refundedAmountVnd": 0,
    "forfeitedDepositVnd": 0,
    "depositPaymentId": "66666666-6666-4666-8666-666666666666",
    "balancePaymentId": null,
    "loadCutoffAt": "2026-07-05T09:50:00Z",
    "latestCheckInAt": "2026-07-05T09:30:00Z",
    "checkedInAt": "2026-07-05T09:00:00Z",
    "checkedInByUserId": "88888888-8888-4888-8888-888888888888",
    "reweighedAt": "2026-07-05T09:02:00Z",
    "reweighedByUserId": "88888888-8888-4888-8888-888888888888",
    "finalPaymentDeadline": "2026-07-05T09:32:00Z",
    "pricePerKgVnd": 1000,
    "minimumPriceVnd": 1000,
    "dimWeightFactor": 6000,
    "settlementPolicyVersion": 2,
    "createdAt": "2026-07-05T08:00:00Z",
    "loadedAt": null,
    "unloadedAt": null,
    "deliveredPendingConfirmAt": null,
    "confirmedAt": null,
    "rejectedAt": null,
    "originStationName": "Bến A",
    "destinationStationName": "Bến B",
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

Các endpoint này `[AllowAnonymous]` nhưng vẫn bắt buộc `Idempotency-Key`.

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
{ "token": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "rejectionReason": "Người nhận từ chối" }
```

Success data: `{ "parcelId": "...", "status": "DELIVERY_REJECTED", "rejectedAt": "...", "canUndoUntil": "..." }`.

Errors trong code: `400 PARCEL_DELIVERY_TOKEN_INVALID`, `400 PARCEL_DELIVERY_TOKEN_EXPIRED`, `400 PARCEL_DELIVERY_TOKEN_REVOKED`, `400 PARCEL_NOT_PENDING_CONFIRM`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`.

```bash
curl -X POST "http://localhost:5005/v1/parcels/delivery/reject" -H "Idempotency-Key: delivery-reject-001" -H "Content-Type: application/json" -d '{"token":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","rejectionReason":"Người nhận từ chối"}'
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

Tất cả endpoint trong nhóm này yêu cầu `Authorization: Bearer <token>` role `OPERATOR_ADMIN` hoặc `OPERATOR_STAFF`, và claim `operatorId`; nếu thiếu `operatorId` trả `403 FORBIDDEN`.

#### GET `/v1/operator/parcels`

Operator lấy danh sách đơn thuộc chính `operatorId` trong JWT. FE không truyền và không thể override tenant scope.

Query optional:

| Field | Rule |
|---|---|
| `status` | `ParcelStatus`, ignore-case |
| `tripId` | Guid khác empty |
| `pendingActionType` | `PendingActionType`, ignore-case |
| `page` | Mặc định `1`, phải `>= 1` |
| `pageSize` | Mặc định `20`, từ `1..100` |

Success `200` là `PagedResult<OperatorParcelListItemResponse>`. Mỗi item gồm mã đơn, trạng thái, trip/sender/recipient, estimated/actual size và chargeable weight, các khoản deposit/balance/refund/forfeiture, deadline, pending action, `photoUrl`, `createdAt`. Kết quả sắp xếp mới nhất trước.

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5005/v1/operator/parcels?status=PENDING_OPERATOR_REVIEW&page=1&pageSize=20"
```

Errors: `403 FORBIDDEN`, `422 VALIDATION_ERROR`.

#### GET `/v1/operator/parcels/reports/summary`

Query: `from` DateOnly? optional, `to` DateOnly? optional. Nếu `from > to`, code ném `ArgumentException`, filter map thành `500 INTERNAL_ERROR`.

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

Query: `from` DateOnly? optional, `to` DateOnly? optional, `format` string? optional. Handler chỉ hỗ trợ CSV; format khác ném `ArgumentException`, filter map thành `500 INTERNAL_ERROR`.

Success `200` content type từ handler, file download CSV, không wrap envelope.

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
{ "decision": "APPROVED", "reason": null }
```

Validation: `decision` phải là `APPROVED` hoặc `REJECTED`; `reason` bắt buộc khi từ chối. Endpoint không nhận giá cọc hoặc payment method vì giá và cọc 20% đã được backend snapshot lúc tạo Parcel.

Approve chuyển `PENDING_OPERATOR_REVIEW → PENDING_PAYMENT` và trả `depositRequiredVnd`; Passenger tiếp tục gọi `deposit-payment`. Operator chủ động từ chối chuyển sang `REJECTED`. Nếu không review trong 24 giờ, background job chuyển sang `CANCELLED` với reason `OPERATOR_REVIEW_TIMEOUT`; chưa thu tiền nên không có refund.

Success approve:

```json
{ "parcelId": "...", "parcelCode": "PRC123456", "status": "PENDING_PAYMENT", "depositRequiredVnd": 1800 }
```

Errors trong code: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS`, `409 ALREADY_REVIEWED`, `409 RACE_LOST`, `422 INVALID_DECISION`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`.

```bash
curl -X PATCH "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/review" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: review-001" -H "Content-Type: application/json" -d '{"decision":"APPROVED","reason":null}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/${parcelId}/review`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ decision: "APPROVED", reason: null }) }).then(r => r.json());
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

Body: `{ "returnReason": "Không giao được" }`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_TRANSITION`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_NOT_FOUND`, `503 TRIP_CARGO_CAPACITY_EXCEEDED`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/return" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: return-001" -H "Content-Type: application/json" -d '{"returnReason":"Không giao được"}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/${parcelId}/return`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ returnReason }) }).then(r => r.json());
```

#### POST `/v1/operator/parcels/{parcelId}/cancel`

Body: `{ "reason": "Khách yêu cầu hủy", "refundChoice": "AUTO" }`.

`refundChoice` là string optional. Enum trong code: `FULL_REFUND`, `POLICY_REFUND`, `NO_REFUND`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_TRANSITION`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 INVALID_REFUND_CHOICE`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_NOT_FOUND`, `503 TRIP_CARGO_CAPACITY_EXCEEDED`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/cancel" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: cancel-001" -H "Content-Type: application/json" -d '{"reason":"Khách yêu cầu hủy","refundChoice":null}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/${parcelId}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ reason, refundChoice: null }) }).then(r => r.json());
```

#### POST `/v1/operator/parcels/{parcelId}/confirm-refund`

Auth role `OPERATOR_ADMIN` hoặc `OPERATOR_STAFF`, claim `operatorId`, `Idempotency-Key`.

Chỉ hợp lệ khi parcel đang `PENDING_OPERATOR_ACTION` và `PendingActionType = REFUND_CONFIRMATION`.

Đây là recovery flow tương thích legacy. Settlement v2 không chờ Operator confirm khi giá cuối giảm; reweigh tự enqueue refund và cho Parcel tiếp tục `READY_TO_LOAD`.

Body:

```json
{ "reason": "Confirmed actual cargo is smaller than estimated" }
```

Success data: `{ "parcelId": "...", "parcelCode": "PRC123456", "status": "PENDING", "tripId": "..." }` cho record legacy.

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

Success data trả trạng thái resume đã lưu: `PENDING_FINAL_PAYMENT` hoặc `READY_TO_LOAD` với Settlement v2; record legacy có thể trả `PENDING`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_PENDING_ACTION`, `409 TRIP_CARGO_CAPACITY_EXCEEDED`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_NOT_FOUND`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/override-capacity" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: override-capacity-001" -H "Content-Type: application/json" -d '{"reason":"Driver approved loading within manual buffer"}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/${parcelId}/override-capacity`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }).then(r => r.json());
```

#### POST `/v1/operator/parcels/{parcelId}/confirm-delivery`

Body: `{ "note": "Đã xác nhận tại quầy" }`. Validation: `note` NotEmpty, max 500.

Success data: `{ "parcelId": "...", "status": "DELIVERY_CONFIRMED", "confirmedAt": "..." }`.

Errors: `400 PARCEL_NOT_PENDING_CONFIRM`, `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`.

```bash
curl -X POST "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/confirm-delivery" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: manual-confirm-001" -H "Content-Type: application/json" -d '{"note":"Đã xác nhận tại quầy"}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcels/${parcelId}/confirm-delivery`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ note }) }).then(r => r.json());
```

#### PATCH `/v1/operator/parcels/{parcelId}/status`

Body: `{ "targetStatus": "RETURNED", "reason": "Đã hoàn tất trả hàng" }`. Validation: `targetStatus` NotEmpty, `reason` NotEmpty. Handler chỉ hỗ trợ target status `RETURNED`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_TRANSITION`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`.

```bash
curl -X PATCH "http://localhost:5005/v1/operator/parcels/$PARCEL_ID/status" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: status-001" -H "Content-Type: application/json" -d '{"targetStatus":"RETURNED","reason":"Đã hoàn tất trả hàng"}'
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

Validation: `routeId` NotEmpty; `sizeCategory` NotEmpty + valid enum; `priceVnd >= 1000`; `effectiveFrom` NotEmpty; nếu có `effectiveUntil` thì phải `> effectiveFrom`.

Luồng FE và ownership:

1. FE gọi `GET /v1/operator/routes`, chọn Route có `isActive=true` và gửi nguyên giá trị `id` vào `routeId` của request này.
2. Parcel xác minh ownership qua Trip internal endpoint
   `GET /internal/v1/routes/{routeId}/ownership?operatorId={operatorId}` với `X-Internal-Auth`.
3. Trip chỉ trả raw `200 { routeId, operatorId }` khi Route tồn tại, active, chưa soft-delete và thuộc đúng Operator.
4. Route missing, inactive, soft-delete hoặc thuộc Operator khác đều được che thành `404 ROUTE_NOT_FOUND`.
5. Lỗi HTTP/transport khác từ Trip trả `503 ROUTE_OWNERSHIP_UNVERIFIABLE`; real stack không fallback sang dev stub.

Success `201` data: `routeId`, `sizeCategory`, `operatorId`, `priceVnd`, `effectiveFrom`, `effectiveUntil`, `createdAt`, `updatedAt`.

Errors: `403 FORBIDDEN`, `404 ROUTE_NOT_FOUND`, `409 FARE_ALREADY_EXISTS`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 ROUTE_OWNERSHIP_UNVERIFIABLE`.

```bash
curl -X POST "http://localhost:5005/v1/operator/parcel-route-fares" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: fare-create-001" -H "Content-Type: application/json" -d '{"routeId":"22222222-2222-4222-8222-222222222222","sizeCategory":"SMALL","priceVnd":50000,"effectiveFrom":"2026-07-05T00:00:00Z","effectiveUntil":null}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcel-route-fares`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
```

#### GET `/v1/operator/parcel-route-fares`

Auth role `OPERATOR_ADMIN` hoặc `OPERATOR_STAFF`.

Query: `routeId` Guid? optional, `sizeCategory` string? optional, `page` default `1`, `pageSize` default `20`. Handler validate `page >= 1`, `pageSize 1..100`, `sizeCategory` valid enum nếu có.

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

Validation: ít nhất một field update phải được gửi; `priceVnd >= 1000` nếu có. `effectiveFrom/effectiveUntil` parse theo `DateTimeOffset`; handler có kiểm `effectiveUntil > effectiveFrom` khi đủ dữ liệu.

Ownership được xác minh lại với Trip theo cùng quy tắc của endpoint create.

Errors: `403 FORBIDDEN`, `404 ROUTE_NOT_FOUND`, `404 FARE_NOT_FOUND`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 ROUTE_OWNERSHIP_UNVERIFIABLE`.

```bash
curl -X PATCH "http://localhost:5005/v1/operator/parcel-route-fares/$ROUTE_ID/SMALL" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: fare-update-001" -H "Content-Type: application/json" -d '{"priceVnd":60000,"effectiveFrom":null,"effectiveUntil":null}'
```

```js
await fetch(`${baseUrl}/v1/operator/parcel-route-fares/${routeId}/SMALL`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ priceVnd: 60000, effectiveFrom: null, effectiveUntil: null }) }).then(r => r.json());
```

### Assistant endpoints

Tất cả yêu cầu `Authorization: Bearer <token>` role `ASSISTANT`, claim `operatorId`, và `Idempotency-Key`.

#### GET `/v1/assistant/trips/{tripId}/parcels`

Assistant lấy danh sách parcel của chuyến được phân công để có `parcelId` cho các thao tác nghiệp vụ. Endpoint read-only, không yêu cầu `Idempotency-Key`.

Auth: `Authorization: Bearer <token>` role `ASSISTANT`. Backend kiểm tra Assistant đang được gán cho `tripId` qua Trip service; thiếu `operatorId`, không được phân công hoặc trip không tồn tại đều trả `403 FORBIDDEN` để không lộ dữ liệu.

Query params:

| Tên | Kiểu | Bắt buộc | Default | Validation |
|---|---|---:|---:|---|
| `page` | int | Không | `1` | `>= 1` |
| `pageSize` | int | Không | `20` | `1..100` |

Success `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "parcelId": "11111111-1111-4111-8111-111111111111",
        "parcelCode": "VR-PCL-20260518-P7K3D9Q2",
        "status": "LOADED",
        "recipientName": "Nguyen Van A",
        "recipientPhone": "+84900000000",
        "dropoffStopId": "22222222-2222-4222-8222-222222222222",
        "sizeCategory": "SMALL",
        "estimatedSizeCategory": "SMALL",
        "actualSizeCategory": "SMALL",
        "estimatedWeightKg": 2.5,
        "actualWeightKg": 3.2,
        "balanceRequiredVnd": 2700,
        "balancePaidVnd": 0,
        "finalPaymentDeadline": "2026-07-05T09:32:00Z",
        "description": "Gói hàng nhỏ",
        "photoUrl": "https://storage.googleapis.com/vietride.appspot.com/parcels/44444444-4444-4444-8444-444444444444/photo.webp"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "meta": { "traceId": "req-123", "timestamp": "2026-07-11T10:00:00.0000000Z" }
}
```

Parcel được lọc theo cả `tripId` và `operatorId` của caller, bỏ qua Parcel đã soft-delete, sắp xếp mới nhất trước. Status được trả nguyên và app tự quyết định cách hiển thị.

```bash
curl "http://localhost:5005/v1/assistant/trips/$TRIP_ID/parcels?page=1&pageSize=20" -H "Authorization: Bearer $TOKEN"
```

```js
await fetch(`${baseUrl}/v1/assistant/trips/${tripId}/parcels?page=1&pageSize=20`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());
```

#### POST `/v1/assistant/parcels/{parcelId}/check-in`

Assistant xác nhận sender đã mang đúng Parcel tới bến. Chỉ Assistant được phân công đúng `tripId`/`operatorId` mới được thao tác.

Body:

```json
{
  "tripId": "11111111-1111-4111-8111-111111111111",
  "parcelCode": "PRC123456"
}
```

Chỉ nhận Parcel `RESERVED`, đúng trip/code và trước `latestCheckInAt`. Thành công chuyển `RESERVED → CHECKED_IN`:

```json
{
  "parcelId": "33333333-3333-4333-8333-333333333333",
  "parcelCode": "PRC123456",
  "status": "CHECKED_IN",
  "checkedInAt": "2026-07-05T09:00:00Z",
  "latestCheckInAt": "2026-07-05T09:30:00Z"
}
```

Nếu hết hạn mà Parcel vẫn `RESERVED`, settlement timeout chuyển sang `REJECTED`, reason `CHECK_IN_TIMEOUT`, ghi `forfeitedDepositVnd = depositPaidVnd` và release cargo hold.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS`, `409 PARCEL_CHECK_IN_CLOSED`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/assistant/parcels/$PARCEL_ID/check-in" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: check-in-001" -H "Content-Type: application/json" -d '{"tripId":"11111111-1111-4111-8111-111111111111","parcelCode":"PRC123456"}'
```

#### POST `/v1/assistant/parcels/{parcelId}/reweigh`

Body:

```json
{
  "actualLengthCm": 32,
  "actualWidthCm": 21,
  "actualHeightCm": 16,
  "actualWeightKg": 3.2
}
```

Validation: cả bốn số đo phải `> 0`. FE không gửi `actualSizeCategory`, giá hoặc payment method; backend tự tính lại volume, DIM weight, chargeable weight, size và giá cuối.

Success `200` khi phát sinh số dư:

```json
{
  "parcelId": "33333333-3333-4333-8333-333333333333",
  "parcelCode": "PRC123456",
  "status": "PENDING_FINAL_PAYMENT",
  "actualSizeCategory": "SMALL",
  "actualChargeableWeightKg": 3.2,
  "finalGrossPriceVnd": 3200,
  "discountAmountVnd": 0,
  "finalTotalPriceVnd": 3200,
  "depositPaidVnd": 500,
  "balanceRequiredVnd": 2700,
  "refundDueVnd": 0,
  "finalPaymentDeadline": "2026-07-05T09:32:00Z"
}
```

Công thức:

```text
finalGrossPriceVnd = max(minimumPriceVnd, round(actualChargeableWeightKg * pricePerKgVnd))
finalTotalPriceVnd = finalGrossPriceVnd - min(discountAmountVnd, finalGrossPriceVnd)
balanceRequiredVnd = max(0, finalTotalPriceVnd - depositPaidVnd)
refundDueVnd = max(0, depositPaidVnd - finalTotalPriceVnd)
```

Capacity thực tế được cập nhật từ estimated reservation sang actual reservation trước khi chốt trạng thái:

- Đủ capacity và `balanceRequiredVnd > 0` → `PENDING_FINAL_PAYMENT`.
- Đủ capacity và không còn balance → `READY_TO_LOAD`.
- `refundDueVnd > 0` → vẫn `READY_TO_LOAD`, đồng thời enqueue refund request idempotent; refund không chặn load.
- Không đủ capacity → `PENDING_OPERATOR_ACTION/CAPACITY_EXCEEDED`; hệ thống giữ `pendingActionResumeStatus` để sau khi Operator override có thể quay lại `PENDING_FINAL_PAYMENT` hoặc `READY_TO_LOAD`.

Chỉ reweigh Parcel `CHECKED_IN` và phải trước `loadCutoffAt`. `finalPaymentDeadline = min(now + 30 phút, loadCutoffAt)`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS`, `409 PARCEL_LOAD_CUTOFF_PASSED`, `409 RACE_LOST`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/assistant/parcels/$PARCEL_ID/reweigh" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: reweigh-001" -H "Content-Type: application/json" -d '{"actualLengthCm":32,"actualWidthCm":21,"actualHeightCm":16,"actualWeightKg":3.2}'
```

```js
await fetch(`${baseUrl}/v1/assistant/parcels/${parcelId}/reweigh`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ actualLengthCm: 32, actualWidthCm: 21, actualHeightCm: 16, actualWeightKg: 3.2 }) }).then(r => r.json());
```

#### POST `/v1/assistant/parcels/{parcelId}/load`

Assistant scan Parcel để xếp lên xe. Body:

```json
{
  "tripId": "11111111-1111-4111-8111-111111111111",
  "parcelCode": "PRC123456"
}
```

Chỉ `READY_TO_LOAD` mới được load. Backend xác minh Assistant đúng trip/operator, chuyển sang `LOADED`, cập nhật Trip cargo ledger từ reserved sang loaded và phát outbox event. Success:

```json
{ "parcelId": "...", "parcelCode": "PRC123456", "status": "LOADED" }
```

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS`, `422 IDEMPOTENCY_KEY_REQUIRED`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_NOT_FOUND`, `503 TRIP_CARGO_CAPACITY_EXCEEDED`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/assistant/parcels/$PARCEL_ID/load" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: 99999999-9999-4999-8999-999999999999" -H "Content-Type: application/json" -d '{"tripId":"11111111-1111-4111-8111-111111111111","parcelCode":"PRC123456"}'
```

#### POST `/v1/assistant/parcels/{parcelId}/confirm-delivery`

Giống operator manual confirm delivery. Body `{ "note": "Đã xác nhận tại quầy" }`. Errors giống endpoint operator tương ứng.

```bash
curl -X POST "http://localhost:5005/v1/assistant/parcels/$PARCEL_ID/confirm-delivery" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: assistant-confirm-001" -H "Content-Type: application/json" -d '{"note":"Đã xác nhận tại quầy"}'
```

```js
await fetch(`${baseUrl}/v1/assistant/parcels/${parcelId}/confirm-delivery`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ note }) }).then(r => r.json());
```

#### POST `/v1/assistant/parcels/{parcelId}/unload`

Khi Trip phát event bắt đầu chạy, Parcel `LOADED` được chuyển sang `IN_TRANSIT`. Endpoint unload chỉ nhận `IN_TRANSIT`, yêu cầu Trip đã đến drop-off stop tương ứng hoặc destination terminal, sau đó release actual loaded cargo khỏi Trip ledger.

Không có body. Success data: `{ "parcelId": "...", "parcelCode": "PRC123456", "status": "UNLOADED" }`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `404 TRIP_NOT_FOUND`, `409 INVALID_STATUS`, `409 RACE_LOST`, `422 DROP_OFF_STOP_NOT_FOUND`, `422 DROP_OFF_STOP_NOT_ALLOWED`, `422 DROP_OFF_STOP_NOT_ARRIVED`, `422 DESTINATION_TERMINAL_NOT_ARRIVED`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_SERVICE_UNAVAILABLE`, `503 TRIP_CARGO_CAPACITY_EXCEEDED`.

```bash
curl -X POST "http://localhost:5005/v1/assistant/parcels/$PARCEL_ID/unload" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: unload-001"
```

```js
await fetch(`${baseUrl}/v1/assistant/parcels/${parcelId}/unload`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key } }).then(r => r.json());
```

#### POST `/v1/assistant/parcels/{parcelId}/deliver`

Assistant bàn giao Parcel đã unload cho người nhận. Không có body. Chỉ Assistant được phân công đúng trip/operator và Parcel `UNLOADED` mới được thao tác.

Success:

```json
{
  "parcelId": "33333333-3333-4333-8333-333333333333",
  "parcelCode": "PRC123456",
  "status": "DELIVERED_PENDING_CONFIRM",
  "deliveredPendingConfirmAt": "2026-07-05T16:00:00Z"
}
```

Backend tạo delivery token có hiệu lực 48 giờ và phát event để Notification gửi cho người nhận. Người nhận dùng public endpoint `delivery/confirm` hoặc `delivery/reject`; Assistant/Operator chỉ dùng `confirm-delivery` cho xác nhận thủ công.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS`, `422 VALIDATION_ERROR`, `422 IDEMPOTENCY_KEY_MISMATCH`, `503 TRIP_SERVICE_UNAVAILABLE`.

```bash
curl -X POST "http://localhost:5005/v1/assistant/parcels/$PARCEL_ID/deliver" -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: deliver-001"
```

### Internal endpoints

Tất cả endpoint internal yêu cầu `X-Internal-Auth: Bearer <internal_jwt>`.

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

Success data: `{ "parcelId": "...", "allowed": true, "role": "SENDER" }`. `role` có thể là `SENDER`, `RECIPIENT`, `OPERATOR`, `NONE`.

Errors: `401 AUTH_TOKEN_INVALID`, `404 PARCEL_NOT_FOUND`.

```bash
curl -H "X-Internal-Auth: Bearer $INTERNAL_JWT" "http://localhost:5005/internal/v1/parcels/$PARCEL_ID/access-check?userId=$USER_ID"
```

```js
await fetch(`${baseUrl}/internal/v1/parcels/${parcelId}/access-check?userId=${userId}`, { headers: { "X-Internal-Auth": `Bearer ${internalJwt}` } }).then(r => r.json());
```

#### GET `/internal/v1/trips/{tripId}/tracking-authorization/parcels`

Query: `userId` Guid? optional, `role` string? optional, `operatorId` Guid? optional.

Success data: `{ "allowed": true, "scope": "OPERATOR", "error": null }`. `scope` khi allowed có thể là `OPERATOR`, `PARCEL_SENDER`, `PARCEL_RECIPIENT`.

Errors: `401 AUTH_TOKEN_INVALID`. Khi không đủ quyền theo parcel/trip, handler trả `200` với `{ "allowed": false, "scope": null, "error": "ACCESS_DENIED" }`.

```bash
curl -H "X-Internal-Auth: Bearer $INTERNAL_JWT" "http://localhost:5005/internal/v1/trips/$TRIP_ID/tracking-authorization/parcels?userId=$USER_ID&role=PASSENGER"
```

```js
await fetch(`${baseUrl}/internal/v1/trips/${tripId}/tracking-authorization/parcels?userId=${userId}&role=PASSENGER`, { headers: { "X-Internal-Auth": `Bearer ${internalJwt}` } }).then(r => r.json());
```

## Mã lỗi theo code

Các mã dưới đây xuất hiện trực tiếp trong Parcel/API/shared code đã đọc:

| HTTP | Code | Nguyên nhân |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Model binding JSON/type/missing field |
| 400 | `PARCEL_DELIVERY_TOKEN_INVALID` | Delivery token không tồn tại |
| 400 | `PARCEL_DELIVERY_TOKEN_EXPIRED` | Delivery token hết hạn |
| 400 | `PARCEL_DELIVERY_TOKEN_REVOKED` | Delivery token đã revoke |
| 400 | `PARCEL_NOT_PENDING_CONFIRM` | Parcel không ở trạng thái chờ xác nhận giao |
| 400 | `PARCEL_NOT_DELIVERY_REJECTED` | Undo reject khi parcel không ở trạng thái rejected |
| 400 | `PARCEL_DELIVERY_REJECTED_WINDOW_EXPIRED` | Hết cửa sổ undo reject |
| 401 | `AUTH_TOKEN_INVALID` | Internal JWT thiếu/sai |
| 401 | `UNAUTHORIZED` | Thiếu/sai user auth hoặc claim user id invalid |
| 403 | `FORBIDDEN` | Không có quyền, thiếu `operatorId`, hoặc operator không sở hữu parcel/trip |
| 403 | `USER_NOT_PASSENGER` | User tạo parcel không phải passenger |
| 403 | `USER_INACTIVE` | User inactive |
| 404 | `PARCEL_NOT_FOUND` | Không tìm thấy parcel hoặc parcel code/trip mismatch bị che thành not found |
| 404 | `TRIP_NOT_FOUND` | Không tìm thấy trip |
| 404 | `ROUTE_NOT_FOUND` | Route missing, inactive, soft-delete hoặc không thuộc Operator khi tạo/cập nhật fare |
| 404 | `FARE_NOT_FOUND` | Không tìm thấy fare route/size thuộc Operator khi cập nhật |
| 404 | `USER_NOT_FOUND` | Không tìm thấy user |
| 404 | `BOOKING_NOT_FOUND` | Không tìm thấy booking |
| 404 | `OPERATOR_NOT_FOUND` | Không tìm thấy operator khi enrich available trips |
| 403 | `USER_FORBIDDEN` | Identity service không cho phép lookup user |
| 409 | `INVALID_STATUS` | Trạng thái hiện tại không cho phép thao tác |
| 409 | `INVALID_TRANSITION` | Chuyển trạng thái không hợp lệ |
| 409 | `INVALID_TRANSFER_TARGET` | Trip chuyển không hợp lệ |
| 409 | `RACE_LOST` | Optimistic/concurrent update thất bại |
| 409 | `FARE_ALREADY_EXISTS` | Fare route/size đã tồn tại |
| 409 | `BOOKING_NOT_FOR_THIS_TRIP` | Booking không thuộc trip request |
| 409 | `BOOKING_NOT_ATTACHABLE` | Booking không confirmed hoặc không có active ticket để gắn parcel |
| 409 | `TRIP_NOT_ACCEPTING_PARCEL` | Trip không ở trạng thái nhận parcel |
| 409 | `TRIP_CARGO_CAPACITY_EXCEEDED` | Vượt tải cargo |
| 409 | `PARCEL_CODE_COLLISION` | Không tạo được mã parcel duy nhất sau số lần thử tối đa |
| 409 | `ALREADY_REVIEWED` | Parcel `EXTRA_LARGE` đã được review |
| 409 | `PAYMENT_ALREADY_STARTED` | Payment cho phase hiện tại đã được tạo |
| 409 | `PARCEL_CHECK_IN_CLOSED` | Đã qua hạn tạo/check-in hoặc không còn đủ settlement window |
| 409 | `FINAL_PAYMENT_DEADLINE_PASSED` | Đã qua hạn thanh toán số dư |
| 409 | `BALANCE_ALREADY_PAID` | Số dư đã được thanh toán đủ |
| 409 | `PARCEL_LOAD_CUTOFF_PASSED` | Đã qua thời điểm chốt xếp hàng |
| 422 | `VALIDATION_ERROR` | FluentValidation hoặc validation thủ công |
| 422 | `INVALID_SIZE_CATEGORY` | Size category không hợp lệ |
| 422 | `INVALID_DELIVERY_METHOD` | Delivery method không hợp lệ |
| 422 | `INVALID_DECISION` | Review decision không hợp lệ |
| 422 | `INVALID_REFUND_CHOICE` | Refund choice không hợp lệ |
| 409 | `INVALID_PENDING_ACTION` | Pending action hiện tại không khớp endpoint operator đang gọi |
| 409 | `INVALID_REFUND_AMOUNT` | Parcel không có refund amount hợp lệ để confirm |
| 422 | `ADDITIONAL_PAYMENT_NOT_REQUIRED` | Reweigh không cần thanh toán thêm |
| 422 | `FARE_NOT_CONFIGURED` | Chưa cấu hình fare parcel cho route/size |
| 422 | `VOUCHER_NOT_APPLICABLE` | Voucher không hợp lệ hoặc không áp dụng được cho parcel |
| 422 | `VOUCHER_USAGE_REJECTED` | Booking service từ chối ghi nhận lượt dùng voucher |
| 422 | `INSUFFICIENT_FUNDS` | Wallet không đủ số dư khi thanh toán parcel |
| 422 | `DROP_OFF_STOP_NOT_FOUND` | Không tìm thấy stop unload |
| 422 | `DROP_OFF_STOP_NOT_ALLOWED` | Stop không cho drop-off |
| 422 | `DROP_OFF_STOP_NOT_ARRIVED` | Stop chưa arrived |
| 422 | `DESTINATION_TERMINAL_NOT_ARRIVED` | Trip chưa đến bến cuối để unload |
| 422 | `IDEMPOTENCY_KEY_REQUIRED` | Mutation thiếu `Idempotency-Key` |
| 422 | `IDEMPOTENCY_KEY_MISMATCH` | Reuse idempotency key với body khác |
| 503 | `UPSTREAM_UNAVAILABLE` | Identity service lỗi transport/dependency |
| 503 | `TRIP_SERVICE_UNAVAILABLE` | Lỗi transport/dependency trip service |
| 503 | `TRIP_SEARCH_UNAVAILABLE` | Trip search lỗi transport |
| 503 | `ROUTE_OWNERSHIP_UNVERIFIABLE` | Không thể xác minh ownership Route do Trip trả lỗi khác 200/404 hoặc lỗi transport |
| 503 | `OPERATOR_LOOKUP_UNAVAILABLE` | Identity/operator lookup lỗi |
| 503 | `USER_LOOKUP_UNAVAILABLE` | User lookup lỗi |
| 503 | `BOOKING_SERVICE_UNAVAILABLE` | Booking service lỗi |
| 503 | `PAYMENT_SERVICE_ERROR` | Payment service lỗi khi charge parcel |
| 503 | `PAYMENT_SERVICE_UNAVAILABLE` | Payment service lỗi |
| 500 | `INTERNAL_ERROR` | Exception không map rõ, ví dụ `ArgumentException` ở report format/date |

## Luồng Parcel Settlement v2

### A-Z happy path

1. Operator chuẩn bị Route/Station active, Trip `SCHEDULED` hoặc `BOARDING` có `maxCargoWeightKg` và `maxCargoVolumeM3`, rồi cấu hình `ParcelRouteFare` cho Route/size muốn nhận.
2. Passenger gọi `available-trips` với tuyến, ngày, kích thước và cân nặng ước tính. Backend tự tính volume, DIM weight, chargeable weight và size; FE không cần gửi `sizeCategory` ở bước tìm chuyến.
3. Passenger chọn Trip/voucher và gọi `POST /v1/parcels`. Backend snapshot giá/policy. Parcel thường vào `PENDING_PAYMENT`; `EXTRA_LARGE` vào `PENDING_OPERATOR_REVIEW`.
4. Nếu là `EXTRA_LARGE`, Operator approve để chuyển sang `PENDING_PAYMENT`. Operator reject → `REJECTED`; không review trong 24 giờ → `CANCELLED/OPERATOR_REVIEW_TIMEOUT`.
5. Passenger gọi `deposit-payment`. Parcel reserve estimated cargo làm soft hold, sau đó Payment tạo khoản cọc 20%.
6. Cọc thành công đúng hạn → `RESERVED`. Payment fail/expire → `EXPIRED` và release soft hold.
7. Sender mang hàng ra bến. Assistant scan đúng trip/code và check-in trước hạn: `RESERVED → CHECKED_IN`.
8. Assistant cân/đo thực tế. Backend cập nhật Trip reservation từ estimated sang actual, tính lại giá cuối, balance và refund.
9. Nếu còn số dư → `PENDING_FINAL_PAYMENT`; Passenger gọi `final-payment`. Nếu cọc đã đủ giá cuối → `READY_TO_LOAD`. Nếu giá cuối thấp hơn cọc → `READY_TO_LOAD` đồng thời yêu cầu refund.
10. Thanh toán số dư đúng hạn → `READY_TO_LOAD`. Assistant scan load → `LOADED`; Trip cargo ledger chuyển reservation thành loaded cargo.
11. Trip bắt đầu chạy → `IN_TRANSIT`. Đến đúng stop/bến cuối, Assistant unload → `UNLOADED` và release actual cargo khỏi Trip ledger.
12. Assistant deliver → `DELIVERED_PENDING_CONFIRM`, token xác nhận có hiệu lực 48 giờ. Người nhận confirm → `DELIVERY_CONFIRMED`; reject → `DELIVERY_REJECTED`; có thể undo reject trong cửa sổ nghiệp vụ hiện có.

### Công thức tiền

```text
volumeM3 = lengthCm * widthCm * heightCm / 1_000_000
dimWeightKg = lengthCm * widthCm * heightCm / dimWeightFactor
chargeableWeightKg = max(weightKg, dimWeightKg)

grossPriceVnd = max(
  minimumPriceVnd,
  round(chargeableWeightKg * pricePerKgVnd)
)
totalPriceVnd = grossPriceVnd - min(discountAmountVnd, grossPriceVnd)

depositRequiredVnd = round(estimatedTotalPriceVnd * 20 / 100)
balanceRequiredVnd = max(0, finalTotalPriceVnd - depositPaidVnd)
refundDueVnd = max(0, depositPaidVnd - finalTotalPriceVnd)
```

Money persist theo đồng, phần thập phân tiền được làm tròn `AwayFromZero`. Trọng lượng giữ đến hai chữ số thập phân, không ceil lên kilogram nguyên. Voucher được cap bằng gross price nên estimated/final total không âm.

### Deadline

| Deadline | Công thức hiện tại | Hết hạn |
|---|---|---|
| `loadCutoffAt` | `departureAt - 10 phút` | Chặn reweigh mới và là trần của final-payment deadline; endpoint load hiện guard bằng trạng thái `READY_TO_LOAD` |
| `latestCheckInAt` | `min(departureAt - 30 phút, loadCutoffAt - 10 phút)` | `RESERVED` chưa check-in bị `REJECTED`, mất toàn bộ cọc và release hold |
| Deposit payment | `min(now + 15 phút, latestCheckInAt)` | Payment fail/expire chuyển `EXPIRED`, release soft hold |
| `finalPaymentDeadline` | `min(reweighedAt + 30 phút, loadCutoffAt)` | `PENDING_FINAL_PAYMENT` bị `REJECTED`, mất toàn bộ cọc và release actual reservation |
| Operator review | 24 giờ từ lúc tạo | `PENDING_OPERATOR_REVIEW → CANCELLED`, reason `OPERATOR_REVIEW_TIMEOUT` |

Settlement/review timeout jobs quét mỗi 5 phút, nên thời điểm persist trạng thái có thể sau deadline vài phút; quyền thanh toán vẫn được đánh giá bằng `paidAt` so với deadline gốc.

### State transition chính

| Từ trạng thái | Trigger/điều kiện | Sang trạng thái | Tiền và capacity |
|---|---|---|---|
| - | Create size thường | `PENDING_PAYMENT` | Snapshot estimated price, chưa thu tiền |
| - | Create `EXTRA_LARGE` | `PENDING_OPERATOR_REVIEW` | Chờ Operator, chưa thu tiền |
| `PENDING_OPERATOR_REVIEW` | Operator approve | `PENDING_PAYMENT` | Giữ nguyên cọc 20% backend đã tính |
| `PENDING_OPERATOR_REVIEW` | Operator reject | `REJECTED` | Không refund vì chưa thu tiền |
| `PENDING_OPERATOR_REVIEW` | Quá 24 giờ | `CANCELLED` | Lỗi timeout phía Operator, chưa thu tiền |
| `PENDING_PAYMENT` | Start deposit | `PENDING_PAYMENT` | Reserve estimated cargo, tạo payment có deadline |
| `PENDING_PAYMENT` | Deposit success đúng hạn | `RESERVED` | Ghi `depositPaidVnd`, consume voucher |
| `PENDING_PAYMENT` | Payment fail/expire | `EXPIRED` | Release estimated cargo |
| `RESERVED` | Assistant check-in đúng hạn | `CHECKED_IN` | Giữ cargo reservation |
| `RESERVED` | Quá `latestCheckInAt` | `REJECTED` | `forfeitedDepositVnd = depositPaidVnd`, release cargo |
| `CHECKED_IN` | Reweigh, đủ capacity, còn balance | `PENDING_FINAL_PAYMENT` | Trip reservation đổi estimated → actual |
| `CHECKED_IN` | Reweigh, không còn balance | `READY_TO_LOAD` | Nếu thừa cọc thì enqueue refund |
| `CHECKED_IN` | Actual cargo vượt capacity | `PENDING_OPERATOR_ACTION` | `CAPACITY_EXCEEDED`, lưu trạng thái cần resume |
| `PENDING_OPERATOR_ACTION` | Operator override capacity thành công | `PENDING_FINAL_PAYMENT` hoặc `READY_TO_LOAD` | Resume theo kết quả settlement đã tính |
| `PENDING_FINAL_PAYMENT` | Balance success với `paidAt < deadline` | `READY_TO_LOAD` | Ghi `balancePaidVnd` |
| `PENDING_FINAL_PAYMENT` | Quá deadline | `REJECTED` | Mất cọc, release actual cargo |
| `READY_TO_LOAD` | Assistant load | `LOADED` | Trip reservation → loaded cargo |
| `LOADED` | Trip started event | `IN_TRANSIT` | Hàng đang trên chuyến |
| `IN_TRANSIT` | Assistant unload đúng stop/bến | `UNLOADED` | Release loaded cargo khỏi Trip ledger |
| `UNLOADED` | Assistant deliver | `DELIVERED_PENDING_CONFIRM` | Tạo token xác nhận 48 giờ |
| `DELIVERED_PENDING_CONFIRM` | Recipient/manual confirm | `DELIVERY_CONFIRMED` | Hoàn tất giao |
| `DELIVERED_PENDING_CONFIRM` | Recipient reject | `DELIVERY_REJECTED` | Chờ undo/return flow |

`PENDING`, `PENDING_ADDITIONAL_PAYMENT` và một số transition cũ vẫn còn để đọc dữ liệu legacy/recovery. Settlement v2 happy path dùng `RESERVED`, `CHECKED_IN`, `PENDING_FINAL_PAYMENT`, `READY_TO_LOAD`.

### Race callback và timeout

- Điều kiện hợp lệ là `paidAt < deadline`; callback tới Parcel sau deadline không tự biến khoản thanh toán đúng hạn thành late payment.
- Deposit callback đúng hạn nhưng tới sau khi Parcel đã `EXPIRED`: backend thử restore estimated cargo. Nếu Trip vẫn nhận và còn trước `latestCheckInAt` → `RESERVED`; nếu không còn phục vụ được → `CANCELLED` và refund khoản cọc đã thu.
- Balance callback đúng hạn nhưng timeout đã chuyển Parcel thành `REJECTED/FINAL_PAYMENT_TIMEOUT`: backend hủy forfeiture và thử restore actual cargo. Nếu Trip còn phục vụ được trước `loadCutoffAt` → `READY_TO_LOAD`; nếu không → `CANCELLED` và refund toàn bộ `depositPaidVnd + balance payment`.
- Khoản balance có `paidAt >= finalPaymentDeadline` không được cộng vào `balancePaidVnd`. Payment Service tự theo dõi capture/refund khoản trả muộn.

### Refund

- Reweigh làm giá cuối thấp hơn cọc: Parcel ghi `refundDueVnd`, chuyển `READY_TO_LOAD` và enqueue `RefundRequested` qua outbox với idempotency key theo `parcelId + settlement reason`. Refund không chặn load.
- Payment xử lý refund; event wallet credited `PARCEL_REFUND` cập nhật dần `refundedAmountVnd`, không được vượt `refundDueVnd`.
- Callback đúng hạn nhưng hệ thống không còn phục vụ được cũng dùng cùng outbox refund flow và key theo nguyên nhân `PAYMENT_CALLBACK_DELAY_CANNOT_SERVE`.

### Capacity và policy snapshot

- Tìm chuyến và reserve đều kiểm tra weight + volume. Trip sở hữu capacity ledger; Parcel sở hữu pricing và settlement status.
- `deposit-payment` tạo estimated reservation. Reweigh thay bằng actual reservation. Load chuyển actual reservation sang loaded cargo. Unload release loaded cargo.
- Parcel snapshot `estimatedSizeCategory`, `pricePerKgVnd`, `minimumPriceVnd`, `dimWeightFactor`, `depositPercent`, deadline và `settlementPolicyVersion`. Record đã dùng policy version không bị tính lại khi cấu hình thay đổi.
- Migration gắn dữ liệu cũ `settlementPolicyVersion = 1`, backfill các field tiền không âm, map `PENDING → RESERVED` và `PENDING_ADDITIONAL_PAYMENT → PENDING_FINAL_PAYMENT`; không hồi tố `forfeitedDepositVnd` cho dữ liệu legacy. Parcel mới dùng version `2`.

### Lưu ý tích hợp

- `EXTRA_LARGE` không có voucher và luôn qua `PENDING_OPERATOR_REVIEW`.
- Ảnh là một `photoUrl` optional. FE upload trực tiếp Firebase Storage, Parcel chỉ validate URL/bucket/ownership path và lưu URL. Firebase Storage Rules chịu trách nhiệm giới hạn 5 MB và MIME `image/jpeg`, `image/png`, `image/webp`.
- Delivery public dùng token Guid, không dùng Authorization, nhưng vẫn bắt buộc `Idempotency-Key`.
- Internal endpoints dùng `X-Internal-Auth`, không dùng `Authorization`.
- Parcel service không tự rate-limit. Khi đi qua Gateway, request chịu global rate limit `120 req / 60s` theo `RATE_LIMIT_DEFAULT_PER_MIN`.
