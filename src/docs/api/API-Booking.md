# VietRide Booking Service — API Documentation

> Tài liệu được trích xuất từ code đang có trong `apps/booking`, Gateway và các thư viện dùng chung; đối chiếu với OpenAPI production tại `https://api.vietride.online/api-specs/booking` ngày 2026-07-10. Khi code không xác định được một hợp đồng ổn định, tài liệu ghi rõ TODO thay vì suy đoán.

## Mục lục

- [1. Môi trường và Base URL](#1-môi-trường-và-base-url)
- [2. Xác thực, phân quyền và headers](#2-xác-thực-phân-quyền-và-headers)
- [3. Response, lỗi và quy ước chung](#3-response-lỗi-và-quy-ước-chung)
- [4. Bảng tổng quan endpoint](#4-bảng-tổng-quan-endpoint)
- [5. Public và passenger APIs](#5-public-và-passenger-apis)
- [6. Driver và assistant APIs](#6-driver-và-assistant-apis)
- [7. Operator APIs](#7-operator-apis)
- [8. System admin APIs](#8-system-admin-apis)
- [9. Internal service-to-service APIs](#9-internal-service-to-service-apis)
- [10. Health và diagnostics](#10-health-và-diagnostics)
- [11. Flow và lưu ý tích hợp](#11-flow-và-lưu-ý-tích-hợp)

## 1. Môi trường và Base URL

| Môi trường | Base URL dành cho client | Nguồn trong code |
|---|---|---|
| Production | `https://api.vietride.online` | URL Swagger do người dùng cung cấp; Gateway công khai `/docs` |
| Staging | ⚠️ TODO: cần xác nhận thêm | Không có staging public URL trong `.env`, `.env.example`, appsettings hoặc Gateway config |
| Local qua Gateway | `http://localhost:3000` | `GATEWAY_PORT=3000` |
| Local gọi thẳng Booking | `http://localhost:5003` | `launchSettings.json`, `BOOKING_PORT=5003` |
| Docker nội bộ | `http://booking:5003` | `BOOKING_BASE_URL` trong `.env.example` |

Swagger aggregator: `https://api.vietride.online/docs`. OpenAPI Booking: `https://api.vietride.online/api-specs/booking`.

Client Web/Mobile phải dùng Gateway. Các URL `/internal/*`, `/ready`, `/v1/ping` không có route công khai tương ứng trong bảng route Gateway; chỉ gọi trực tiếp trong mạng nội bộ. Riêng liveness Booking được Gateway đổi đường dẫn từ `GET /v1/booking/health` sang `GET /health`.

## 2. Xác thực, phân quyền và headers

### 2.1 User Access Token

- Client lấy access token từ Identity API (không thuộc phạm vi tài liệu này), rồi gửi `Authorization: Bearer <accessToken>` tới Gateway.
- Gateway kiểm tra JWT bằng JWKS, thuật toán `RS256`, issuer `vietride-identity`, audience `vietride-api`, clock tolerance 5 giây.
- Thiếu, sai hoặc hết hạn token: Gateway trả `401 AUTH_TOKEN_INVALID`. Client cần gọi flow refresh của Identity rồi thử lại; Booking không có endpoint refresh.
- Gateway xóa `Authorization` trước khi chuyển tới Booking, ký JWT nội bộ `HS256` (issuer `vietride-gateway`, audience `vietride-internal`, TTL mặc định 120 giây) và gắn `X-Internal-Auth: Bearer <jwt>`.
- Role đọc từ claim `role`. Tenant operator đọc từ `operatorId`; user id đọc từ `sub`.
- Passenger có `hasPhone` khác `true` bị Gateway chặn `403 AUTH_PHONE_REQUIRED` trên các Booking API yêu cầu token.

### 2.2 Internal JWT

Các endpoint `/internal/*` yêu cầu:

```http
X-Internal-Auth: Bearer <HS256_INTERNAL_JWT>
```

Token phải có issuer `vietride-gateway`, audience `vietride-internal`, chữ ký dùng `INTERNAL_JWT_SECRET`, còn hạn với clock skew 5 giây. Header cũng chấp nhận token không có tiền tố `Bearer`, nhưng nên luôn dùng đúng dạng trên. Không gửi internal token từ client.

### 2.3 Headers chung

| Header | Khi nào bắt buộc | Ý nghĩa |
|---|---|---|
| `Authorization: Bearer ...` | Mọi API client không ghi Anonymous | User access token gửi tới Gateway |
| `X-Internal-Auth: Bearer ...` | Mọi `/internal/*` khi gọi trực tiếp | Internal JWT |
| `Content-Type: application/json` | Request có JSON body | ASP.NET JSON model binding |
| `Idempotency-Key` | Các endpoint được đánh dấu | Chuỗi khác rỗng; code không đặt min/max/regex |
| `X-Request-Id` | Optional | Gateway giữ hoặc sinh UUID; response trả lại header này và dùng làm `meta.traceId` |

Idempotency middleware chỉ xử lý `POST` và `PATCH`, lưu response khác 5xx trong Redis 24 giờ theo key `booking:idem:<key>`. Cùng key + cùng raw body trả lại response cũ; cùng key + body khác trả `422 IDEMPOTENCY_KEY_MISMATCH`. `DELETE /v1/admin/vouchers/{id}` bắt buộc header ở controller nhưng middleware không cache DELETE.

## 3. Response, lỗi và quy ước chung

### 3.1 Success wrapper của API client

Mọi success controller không thuộc `/internal/*`, `/health*` được bọc tự động:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "meta": {
    "traceId": "b3f0c7b2-0d19-43ae-8877-9fcba2ee62b0",
    "timestamp": "2026-07-10T10:30:00.0000000Z"
  }
}
```

`message` chỉ xuất hiện nếu code truyền giá trị khác `null`; các Booking controller hiện không truyền message. `204` không có body. `/internal/*` thành công là raw payload, trừ hai endpoint internal tracking tự tạo wrapper.

### 3.2 Error wrapper

```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more validation errors occurred.",
    "fields": [
      { "field": "paymentMethod", "message": "paymentMethod must be one of: WALLET, VNPAY." }
    ]
  },
  "meta": {
    "traceId": "b3f0c7b2-0d19-43ae-8877-9fcba2ee62b0",
    "timestamp": "2026-07-10T10:30:00.0000000Z"
  }
}
```

`fields` bị lược bỏ khi không có lỗi theo field. Lỗi malformed JSON/type mismatch từ model binding là `400 VALIDATION_ERROR`. FluentValidation là `422`; error code custom trên từng rule hiện vẫn được gom thành top-level `VALIDATION_ERROR` bởi `ValidationBehavior`, vì vậy ví dụ rule `BOOKING_MAX_SEATS_EXCEEDED` trong validator không tự trở thành top-level code; handler có guard riêng trả đúng `BOOKING_MAX_SEATS_EXCEEDED`.

### 3.3 Lỗi chung có thể xảy ra

| HTTP | `error.code` | Khi xảy ra |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | JSON sai cú pháp, sai kiểu, model binding thất bại |
| 401 | `AUTH_TOKEN_INVALID` | Gateway hoặc internal JWT handler không nhận/không xác thực được token |
| 401 | `UNAUTHORIZED` | Claim `sub`/`operatorId` mà controller cần bị thiếu hoặc không phải UUID |
| 403 | `FORBIDDEN` | Role không được phép hoặc caller không được gán cho trip/resource |
| 403 | `AUTH_PHONE_REQUIRED` | Passenger chưa hoàn tất phone profile tại Gateway |
| 404 | `ROUTE_NOT_FOUND` | Không có prefix được Gateway đăng ký |
| 422 | `IDEMPOTENCY_KEY_MISMATCH` | Tái sử dụng key với raw body khác |
| 500 | `INTERNAL_ERROR` | Exception không được map cụ thể; message client luôn là `An unexpected error occurred` |
| 502 | `UPSTREAM_UNAVAILABLE` | Gateway không kết nối được Booking |

ASP.NET route constraint `:guid` có thể làm route không match nếu UUID sai. ⚠️ TODO: cần xác nhận thêm body production của trường hợp 404 do route constraint, vì code không tự tạo error envelope cho nhánh này.

### 3.4 Kiểu dữ liệu và format

- JSON dùng camelCase.
- UUID là chuỗi canonical, ví dụ `550e8400-e29b-41d4-a716-446655440000`.
- `DateTimeOffset` là ISO 8601 date-time có offset; response thường UTC. `DateOnly` query/response có dạng `YYYY-MM-DD`.
- Tiền VND là JSON integer (`long`/int64), không phải decimal. `Money.FromRaw` giữ nguyên tới đơn vị đồng; kết quả phần trăm dùng `Money.FromDecimal` và làm tròn tới đồng gần nhất với `MidpointRounding.AwayFromZero` (không floor 1.000).
- Enum truyền dạng chuỗi. Nơi validator dùng `OrdinalIgnoreCase` chấp nhận không phân biệt hoa/thường; response trả enum in hoa.
- Query object của ASP.NET xuất hiện trong Swagger với PascalCase, nhưng model binding không phân biệt hoa/thường; ví dụ dùng camelCase trong tài liệu.
- Không có nullable reference enforcement ở model binder cho phần lớn DTO class; validation thực tế được mô tả từng endpoint.

### 3.5 Biến dùng trong ví dụ

```bash
BASE_URL="https://api.vietride.online"
ACCESS_TOKEN="<RS256_USER_ACCESS_TOKEN>"
INTERNAL_BASE_URL="http://booking:5003"
INTERNAL_TOKEN="<HS256_INTERNAL_JWT>"
```

JavaScript examples giả định đã có `BASE_URL`, `ACCESS_TOKEN`, `INTERNAL_BASE_URL`, `INTERNAL_TOKEN`.

## 4. Bảng tổng quan endpoint

| Method | Path | Auth/role | Mô tả |
|---|---|---|---|
| GET | `/v1/promotions` | Anonymous | Danh sách promotion đang hiệu lực |
| GET | `/v1/vouchers/available` | User | Voucher khả dụng cho user/context |
| POST | `/v1/bookings` | PASSENGER | Đặt vé một chiều |
| POST | `/v1/bookings/round-trip` | PASSENGER | Đặt vé khứ hồi |
| POST | `/v1/bookings/{bookingId}/edit-pickup` | PASSENGER | Đổi điểm đón |
| POST | `/v1/bookings/{bookingId}/edit-dropoff` | PASSENGER | Đổi điểm trả |
| POST | `/v1/bookings/{bookingId}/cancel` | PASSENGER | Hủy booking |
| GET | `/v1/bookings/trips/{tripId}/manifest` | DRIVER, ASSISTANT | Manifest hành khách |
| POST | `/v1/bookings/trips/{tripId}/boarding/passenger/{passengerRecordId}` | DRIVER, ASSISTANT | Tick đã lên xe |
| POST | `/v1/bookings/trips/{tripId}/boarding/qr-scan` | DRIVER, ASSISTANT | Quét ticket/booking code |
| GET | `/v1/operator/booking-stats` | OPERATOR_ADMIN, OPERATOR_STAFF | Thống kê operator |
| GET | `/v1/operator/voucher-consents` | OPERATOR_ADMIN, OPERATOR_STAFF | Danh sách consent |
| POST | `/v1/operator/voucher-consents/{id}/accept` | OPERATOR_ADMIN | Chấp nhận consent |
| POST | `/v1/operator/voucher-consents/{id}/reject` | OPERATOR_ADMIN | Từ chối/thu hồi consent |
| POST | `/v1/operator/vouchers` | OPERATOR_ADMIN | Tạo voucher operator |
| GET | `/v1/operator/vouchers` | OPERATOR_ADMIN | Danh sách voucher operator |
| PATCH | `/v1/operator/vouchers/{id}` | OPERATOR_ADMIN | Sửa voucher operator |
| DELETE | `/v1/operator/vouchers/{id}` | OPERATOR_ADMIN | Soft-delete voucher operator |
| POST | `/v1/operator/vouchers/{id}/activate` | OPERATOR_ADMIN | Kích hoạt voucher |
| POST | `/v1/operator/vouchers/{id}/deactivate` | OPERATOR_ADMIN | Vô hiệu voucher |
| GET | `/v1/admin/booking-stats/aggregate` | SYSTEM_ADMIN | Thống kê toàn nền tảng |
| GET | `/v1/admin/campaigns` | SYSTEM_ADMIN | Danh sách campaign |
| POST | `/v1/admin/campaigns` | SYSTEM_ADMIN | Tạo campaign |
| PATCH | `/v1/admin/campaigns/{campaignId}` | SYSTEM_ADMIN | Cập nhật campaign |
| POST | `/v1/admin/campaigns/{campaignId}/activate` | SYSTEM_ADMIN | Kích hoạt campaign |
| POST | `/v1/admin/campaigns/{campaignId}/deactivate` | SYSTEM_ADMIN | Vô hiệu campaign |
| POST | `/v1/admin/vouchers` | SYSTEM_ADMIN | Tạo voucher platform |
| GET | `/v1/admin/vouchers` | SYSTEM_ADMIN | Danh sách voucher platform |
| PATCH | `/v1/admin/vouchers/{id}` | SYSTEM_ADMIN | Sửa voucher platform |
| DELETE | `/v1/admin/vouchers/{id}` | SYSTEM_ADMIN | Soft-delete voucher platform |
| GET | `/v1/admin/vouchers/{voucherId}/consents` | SYSTEM_ADMIN | Consent của voucher |
| GET | `/internal/v1/bookings/{bookingId}` | Internal JWT | Snapshot booking |
| GET | `/internal/v1/trips/{tripId}/tracking-authorization/bookings` | Internal JWT | Quyền tracking |
| GET | `/internal/v1/trips/{tripId}/stops/{stopId}/pickup-bookings` | Internal JWT | Booking đón tại stop |
| POST | `/internal/v1/vouchers/validate` | Internal JWT | Validate voucher |
| POST | `/internal/v1/vouchers/usages` | Internal JWT | Ghi usage |
| DELETE | `/internal/v1/vouchers/usages/by-reference` | Internal JWT | Xóa usage theo reference |
| GET | `/internal/v1/vouchers/available` | Internal JWT | Voucher khả dụng nội bộ |
| GET | `/v1/ping` | Anonymous/direct | Ping service |
| GET | `/health` | Anonymous/direct | Liveness |
| GET | `/ready` | Anonymous/direct | Readiness dependencies |
| GET | `/v1/booking/health` | Anonymous/Gateway | Alias Gateway tới `/health` |

## 5. Public và passenger APIs

### 5.1 Lấy promotions — `GET /v1/promotions`

Trả tối đa 20 voucher thuộc campaign và voucher đều active, chưa soft-delete, đang trong thời gian hiệu lực và có `applicableServices` chứa service đã chuẩn hóa uppercase.

| Query | Kiểu | Bắt buộc | Default/rule |
|---|---|---:|---|
| `service` | string | Có, non-nullable action parameter | Không có enum/length validator; code trim rồi uppercase; thiếu/sai binding trả `400 VALIDATION_ERROR` |

Headers: không yêu cầu auth. Body: không có.

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "voucherId": "11111111-1111-1111-1111-111111111111",
      "code": "SUMMER20",
      "name": "Summer sale",
      "type": "PERCENT_OFF",
      "value": 20,
      "applicableServices": ["BOOKING"],
      "validUntil": "2026-08-31T23:59:59+07:00"
    }
  ],
  "meta": { "traceId": "...", "timestamp": "2026-07-10T10:30:00.0000000Z" }
}
```

`voucherId` UUID voucher; `type` là `PERCENT_OFF|FIXED_AMOUNT`; `value` là phần trăm hoặc VND theo type; `validUntil` là hạn voucher (không phải hạn campaign). Lỗi: `400 VALIDATION_ERROR` nếu thiếu/sai query; các lỗi chung; `500 INTERNAL_ERROR` nếu lỗi DB/unmapped.

```bash
curl "$BASE_URL/v1/promotions?service=BOOKING"
```

```js
const promotionResponse = await fetch(`${BASE_URL}/v1/promotions?service=BOOKING`);
const promotions = await promotionResponse.json();
```

### 5.2 Voucher khả dụng — `GET /v1/vouchers/available`

Preview voucher theo user và context. Nếu có `tripId` mà thiếu `operatorId`/`routeId`, service thử lấy snapshot trip; nếu cuối cùng vẫn thiếu một trong hai thì trả mảng rỗng. Endpoint lấy tối đa 50 candidate theo `validUntil`, bỏ qua voucher fail validation.

Headers: `Authorization`. Body: không có.

| Query | Kiểu | Bắt buộc | Default/rule |
|---|---|---:|---|
| `service` | string | Có, non-nullable action parameter | Uppercase sau trim; thiếu/sai binding trả 400 |
| `tripId` | UUID? | Không | Dùng resolve operator/route |
| `operatorId` | UUID? | Không | Phải resolve được để có kết quả |
| `routeId` | UUID? | Không | Phải resolve được để có kết quả |
| `paymentMethod` | string? | Không | Uppercase; không có enum validator ở endpoint preview |
| `orderAmount` | int64? | Không | Default `0`; giữ nguyên tới đơn vị đồng, phải không âm nếu đi vào `Money.FromRaw` |

```json
{
  "success": true,
  "statusCode": 200,
  "data": [{
    "id": "11111111-1111-1111-1111-111111111111",
    "code": "SUMMER20",
    "name": "Summer sale",
    "type": "PERCENT_OFF",
    "value": 20,
    "minOrderAmount": 100000,
    "maxDiscountAmount": 50000,
    "discountAmount": 40000,
    "applicableServices": ["BOOKING"],
    "applicablePaymentMethods": ["WALLET", "VNPAY"],
    "validUntil": "2026-08-31T23:59:59+07:00"
  }],
  "meta": { "traceId": "...", "timestamp": "2026-07-10T10:30:00.0000000Z" }
}
```

`discountAmount` là preview tính từ `orderAmount`; các field tiền là VND int64. Lỗi: common 400/401/403/500/502; endpoint nuốt các lỗi voucher eligibility thay vì trả lỗi.

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/vouchers/available?service=BOOKING&tripId=22222222-2222-2222-2222-222222222222&paymentMethod=WALLET&orderAmount=200000"
```

```js
const available = await fetch(`${BASE_URL}/v1/vouchers/available?service=BOOKING&tripId=22222222-2222-2222-2222-222222222222&paymentMethod=WALLET&orderAmount=200000`, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }).then(r => r.json());
```

### 5.3 Tạo booking một chiều — `POST /v1/bookings`

Tạo booking 1–5 ghế, lock seat 10 phút, áp voucher nếu có, tạo payment. WALLET thành công thì book seat và xác nhận ngay; VNPAY trả redirect và booking ở `PENDING_PAYMENT`.

Headers: `Authorization`, `Content-Type`. `Idempotency-Key` **không được controller kiểm tra**, nhưng nếu client gửi thì middleware thực hiện idempotency. Gateway chỉ cho role `PASSENGER`.

| Body field | Kiểu | Bắt buộc/rule |
|---|---|---|
| `tripId` | UUID | Có, khác empty UUID |
| `pickup` | object | Có về logic; đúng một trong `stationId`, `stopId` |
| `pickup.stationId` | UUID? | XOR với `pickup.stopId` |
| `pickup.stopId` | UUID? | XOR với `pickup.stationId` |
| `dropoff` | object? | Optional; nhiều nhất một trong `stationId`, `stopId` |
| `seats` | array | 1–5 phần tử |
| `seats[].seatNumber` | string | Không rỗng, max 10 |
| `seats[].passenger.fullName` | string | Không rỗng, max 100 |
| `seats[].passenger.phoneNumber` | string | Không rỗng, max 20 |
| `seats[].passenger.idNumber` | string | Không rỗng, max 20 |
| `voucherCode` | string? | Optional; không có length validator ở request này |
| `paymentMethod` | string | `WALLET|VNPAY`, không phân biệt hoa thường |

```json
{
  "tripId": "22222222-2222-2222-2222-222222222222",
  "pickup": { "stationId": "33333333-3333-3333-3333-333333333333", "stopId": null },
  "dropoff": { "stationId": null, "stopId": "44444444-4444-4444-4444-444444444444" },
  "seats": [{
    "seatNumber": "A1",
    "passenger": { "fullName": "Nguyen Van A", "phoneNumber": "0901234567", "idNumber": "079203001234" }
  }],
  "voucherCode": "SUMMER20",
  "paymentMethod": "WALLET"
}
```

Success `201`:

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "bookingId": "55555555-5555-5555-5555-555555555555",
    "bookingCode": "VR-20260710-ABCDEFG2",
    "status": "CONFIRMED",
    "totalAmount": 160000,
    "discountAmount": 40000,
    "paymentRedirectUrl": null,
    "tickets": [{
      "ticketId": "66666666-6666-6666-6666-666666666666",
      "ticketCode": "VT-20260710-ABCDEFGH",
      "seatNumber": "A1",
      "status": "ISSUED",
      "fareAmount": 200000,
      "discountAmount": 40000,
      "paidAmount": 160000
    }]
  },
  "meta": { "traceId": "...", "timestamp": "2026-07-10T10:30:00.0000000Z" }
}
```

`paymentRedirectUrl` chỉ có thể khác null theo response Payment; tickets chứa amount từng ghế. PII được validate rồi không persist trong Booking schema.

Lỗi endpoint: `404 TRIP_NOT_FOUND`, `404 VOUCHER_NOT_FOUND`; `409 BOOKING_TRIP_NOT_BOOKABLE`, `BOOKING_SEAT_UNAVAILABLE`, `PAYMENT_INSUFFICIENT_WALLET`; `422 VALIDATION_ERROR`, `BOOKING_MAX_SEATS_EXCEEDED`, `VOUCHER_EXPIRED`, `VOUCHER_NOT_APPLICABLE`, `VOUCHER_NEW_USER_ONLY`, `VOUCHER_MIN_ORDER_NOT_MET`, `VOUCHER_USAGE_LIMIT_REACHED`, `VOUCHER_USER_LIMIT_REACHED`; `500 INTERNAL_ERROR` khi Trip/Payment transport lỗi hoặc exception không map; cùng các lỗi chung auth/Gateway. Handler checkout không truyền `paymentMethod` vào voucher service nên `VOUCHER_PAYMENT_METHOD_NOT_APPLICABLE` không phát sinh từ endpoint này dù request có `paymentMethod`.

```bash
curl -X POST "$BASE_URL/v1/bookings" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: booking-20260710-001" --data '{"tripId":"22222222-2222-2222-2222-222222222222","pickup":{"stationId":"33333333-3333-3333-3333-333333333333","stopId":null},"dropoff":{"stationId":null,"stopId":"44444444-4444-4444-4444-444444444444"},"seats":[{"seatNumber":"A1","passenger":{"fullName":"Nguyen Van A","phoneNumber":"0901234567","idNumber":"079203001234"}}],"voucherCode":"SUMMER20","paymentMethod":"WALLET"}'
```

```js
const booking = await fetch(`${BASE_URL}/v1/bookings`, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'booking-20260710-001' }, body: JSON.stringify({ tripId: '22222222-2222-2222-2222-222222222222', pickup: { stationId: '33333333-3333-3333-3333-333333333333', stopId: null }, dropoff: { stationId: null, stopId: '44444444-4444-4444-4444-444444444444' }, seats: [{ seatNumber: 'A1', passenger: { fullName: 'Nguyen Van A', phoneNumber: '0901234567', idNumber: '079203001234' } }], voucherCode: 'SUMMER20', paymentMethod: 'WALLET' }) }).then(r => r.json());
```

### 5.4 Tạo booking khứ hồi — `POST /v1/bookings/round-trip`

Headers: `Authorization`, `Content-Type`, `Idempotency-Key` (bắt buộc, non-blank). Role `PASSENGER`. Mỗi leg dùng cùng rules `tripId`, pickup XOR, dropoff tối đa một, seats 1–5 và PII length như endpoint 5.3. `paymentMethod=WALLET|VNPAY`; `voucherCode` optional. Code không có validator `IdempotencyKey` trong validator nhưng handler sử dụng và controller bắt buộc header.

```json
{
  "outbound": {
    "tripId": "22222222-2222-2222-2222-222222222222",
    "pickup": { "stationId": "33333333-3333-3333-3333-333333333333", "stopId": null },
    "dropoff": { "stationId": null, "stopId": "44444444-4444-4444-4444-444444444444" },
    "seats": [{ "seatNumber": "A1", "passenger": { "fullName": "Nguyen Van A", "phoneNumber": "0901234567", "idNumber": "079203001234" } }]
  },
  "return": {
    "tripId": "77777777-7777-7777-7777-777777777777",
    "pickup": { "stationId": "88888888-8888-8888-8888-888888888888", "stopId": null },
    "dropoff": { "stationId": "33333333-3333-3333-3333-333333333333", "stopId": null },
    "seats": [{ "seatNumber": "B1", "passenger": { "fullName": "Nguyen Van A", "phoneNumber": "0901234567", "idNumber": "079203001234" } }]
  },
  "voucherCode": "SUMMER20",
  "paymentMethod": "WALLET"
}
```

Success `201` có `bookingGroupId`, `grandTotal`, `paymentRedirectUrl`, và hai object `outbound`/`return`; mỗi object có `bookingId`, `bookingCode`, `totalAmount`, `discountAmount`, `tickets` với đúng field ticket như 5.3. Không có field `status` ở cấp booking leg.

```json
{"success":true,"statusCode":201,"data":{"bookingGroupId":"99999999-9999-9999-9999-999999999999","outbound":{"bookingId":"55555555-5555-5555-5555-555555555555","bookingCode":"VR-20260710-ABCDEFG2","totalAmount":160000,"discountAmount":40000,"tickets":[{"ticketId":"66666666-6666-6666-6666-666666666666","ticketCode":"VT-20260710-ABCDEFGH","seatNumber":"A1","status":"ISSUED","fareAmount":200000,"discountAmount":40000,"paidAmount":160000}]},"return":{"bookingId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","bookingCode":"VR-20260710-HGFEDCB2","totalAmount":180000,"discountAmount":20000,"tickets":[{"ticketId":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","ticketCode":"VT-20260710-HGFEDCBA","seatNumber":"B1","status":"ISSUED","fareAmount":200000,"discountAmount":20000,"paidAmount":180000}]},"grandTotal":340000,"paymentRedirectUrl":null},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

Lỗi: toàn bộ lỗi create booking/voucher ở 5.3, cộng `422 ROUTE_RETURN_NOT_CONFIGURED`, `422 BOOKING_ROUND_TRIP_INVALID`; `409 BOOKING_SEAT_UNAVAILABLE`, `BOOKING_TRIP_NOT_BOOKABLE`, `PAYMENT_INSUFFICIENT_WALLET`; `404 TRIP_NOT_FOUND`; `500 INTERNAL_ERROR` transport/unmapped. `VOUCHER_MIN_ORDER_NOT_MET` riêng từng leg bị catch và leg đó nhận discount 0, không trả lỗi.

```bash
curl -X POST "$BASE_URL/v1/bookings/round-trip" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: roundtrip-001" --data '{"outbound":{"tripId":"22222222-2222-2222-2222-222222222222","pickup":{"stationId":"33333333-3333-3333-3333-333333333333","stopId":null},"dropoff":{"stationId":null,"stopId":"44444444-4444-4444-4444-444444444444"},"seats":[{"seatNumber":"A1","passenger":{"fullName":"Nguyen Van A","phoneNumber":"0901234567","idNumber":"079203001234"}}]},"return":{"tripId":"77777777-7777-7777-7777-777777777777","pickup":{"stationId":"88888888-8888-8888-8888-888888888888","stopId":null},"dropoff":{"stationId":"33333333-3333-3333-3333-333333333333","stopId":null},"seats":[{"seatNumber":"B1","passenger":{"fullName":"Nguyen Van A","phoneNumber":"0901234567","idNumber":"079203001234"}}]},"voucherCode":"SUMMER20","paymentMethod":"WALLET"}'
```

```js
const roundTripBody = { outbound: { tripId: '22222222-2222-2222-2222-222222222222', pickup: { stationId: '33333333-3333-3333-3333-333333333333', stopId: null }, dropoff: { stationId: null, stopId: '44444444-4444-4444-4444-444444444444' }, seats: [{ seatNumber: 'A1', passenger: { fullName: 'Nguyen Van A', phoneNumber: '0901234567', idNumber: '079203001234' } }] }, return: { tripId: '77777777-7777-7777-7777-777777777777', pickup: { stationId: '88888888-8888-8888-8888-888888888888', stopId: null }, dropoff: { stationId: '33333333-3333-3333-3333-333333333333', stopId: null }, seats: [{ seatNumber: 'B1', passenger: { fullName: 'Nguyen Van A', phoneNumber: '0901234567', idNumber: '079203001234' } }] }, voucherCode: 'SUMMER20', paymentMethod: 'WALLET' };
const roundTrip = await fetch(`${BASE_URL}/v1/bookings/round-trip`, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'roundtrip-001' }, body: JSON.stringify(roundTripBody) }).then(r => r.json());
```

### 5.5 Đổi điểm đón — `POST /v1/bookings/{bookingId}/edit-pickup`

Path `bookingId`: UUID bắt buộc. Headers: Authorization, Content-Type, Idempotency-Key. Body: `pickup` phải có đúng một UUID `stationId|stopId`; `paymentMethod` bắt buộc `WALLET|VNPAY` dù v1 chỉ cho thay đổi không đổi giá.

```json
{"pickup":{"stationId":null,"stopId":"44444444-4444-4444-4444-444444444444"},"paymentMethod":"WALLET"}
```

Success `200`:

```json
{"success":true,"statusCode":200,"data":{"bookingId":"55555555-5555-5555-5555-555555555555","pickup":{"stationId":null,"stopId":"44444444-4444-4444-4444-444444444444"},"fareDelta":0,"refundAmount":0,"paymentRedirectUrl":null},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

Lỗi: `404 BOOKING_NOT_FOUND|TRIP_NOT_FOUND|STOP_NOT_FOUND`; `403 FORBIDDEN` không phải owner; `409 BOOKING_CUTOFF_EXCEEDED` nếu không CONFIRMED hoặc còn dưới 2 giờ tới departure, `BOOKING_EDIT_PICKUP_PRICE_CHANGED`; `422 STOP_NOT_PICKUP_ALLOWED|VALIDATION_ERROR`; lỗi chung.

```bash
curl -X POST "$BASE_URL/v1/bookings/55555555-5555-5555-5555-555555555555/edit-pickup" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: edit-pickup-001" --data '{"pickup":{"stationId":null,"stopId":"44444444-4444-4444-4444-444444444444"},"paymentMethod":"WALLET"}'
```

```js
const editedPickup = await fetch(`${BASE_URL}/v1/bookings/${bookingId}/edit-pickup`, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'edit-pickup-001' }, body: JSON.stringify({ pickup: { stationId: null, stopId }, paymentMethod: 'WALLET' }) }).then(r => r.json());
```

### 5.6 Đổi điểm trả — `POST /v1/bookings/{bookingId}/edit-dropoff`

Path `bookingId`: UUID bắt buộc. Headers: Authorization, Content-Type, Idempotency-Key. Body `dropoff` phải cung cấp đúng một UUID `stationId|stopId`.

```json
{"dropoff":{"stationId":null,"stopId":"44444444-4444-4444-4444-444444444444"}}
```

Success `200`: `data={bookingId,dropoff:{stationId,stopId},fareDelta}`; code luôn trả `fareDelta: 0`.

```json
{"success":true,"statusCode":200,"data":{"bookingId":"55555555-5555-5555-5555-555555555555","dropoff":{"stationId":null,"stopId":"44444444-4444-4444-4444-444444444444"},"fareDelta":0},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

Lỗi: `404 BOOKING_NOT_FOUND|TRIP_NOT_FOUND|STATION_NOT_FOUND|STOP_NOT_FOUND`; `403 FORBIDDEN`; `409 BOOKING_CUTOFF_EXCEEDED` (không CONFIRMED hoặc dưới 2 giờ); `422 STOP_NOT_DROPOFF_ALLOWED|VALIDATION_ERROR`; lỗi chung.

```bash
curl -X POST "$BASE_URL/v1/bookings/$BOOKING_ID/edit-dropoff" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: edit-dropoff-001" --data '{"dropoff":{"stationId":null,"stopId":"44444444-4444-4444-4444-444444444444"}}'
```

```js
const editedDropoff = await fetch(`${BASE_URL}/v1/bookings/${bookingId}/edit-dropoff`, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'edit-dropoff-001' }, body: JSON.stringify({ dropoff: { stationId: null, stopId } }) }).then(r => r.json());
```

### 5.7 Hủy booking — `POST /v1/bookings/{bookingId}/cancel`

Path UUID bắt buộc. Headers: Authorization, Content-Type, Idempotency-Key. Body chỉ chấp nhận chính xác `reason: "USER_INITIATED"`.

```json
{"reason":"USER_INITIATED"}
```

Success `200`: `refundAmount` là preview theo cancellation policy; refund thực tế bất đồng bộ qua event. `refundMethod` do handler trả chuỗi `WALLET`.

```json
{"success":true,"statusCode":200,"data":{"bookingId":"55555555-5555-5555-5555-555555555555","status":"CANCELLED","refundAmount":160000,"refundMethod":"WALLET"},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

Lỗi: `404 BOOKING_NOT_FOUND|TRIP_NOT_FOUND`; `403 FORBIDDEN`; `409 BOOKING_NOT_CANCELLABLE` nếu status không `CONFIRMED|PENDING_PAYMENT`, trip status không cho hủy hoặc race status; `422 VALIDATION_ERROR`; lỗi chung.

```bash
curl -X POST "$BASE_URL/v1/bookings/$BOOKING_ID/cancel" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: cancel-001" --data '{"reason":"USER_INITIATED"}'
```

```js
const cancelled = await fetch(`${BASE_URL}/v1/bookings/${bookingId}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'cancel-001' }, body: JSON.stringify({ reason: 'USER_INITIATED' }) }).then(r => r.json());
```

## 6. Driver và assistant APIs

> Gateway route table có cả `/v1/bookings` (PASSENGER) trước `/v1/bookings/trips` (DRIVER/ASSISTANT), nhưng matcher dùng longest prefix nên các endpoint dưới đây áp đúng role driver/assistant.

### 6.1 Manifest trip — `GET /v1/bookings/trips/{tripId}/manifest`

Path `tripId` UUID bắt buộc; headers Authorization; body/query không có. Chỉ driver/assistant được gán đúng trip.

```json
{"success":true,"statusCode":200,"data":{"items":[{"passengerRecordId":"11111111-1111-1111-1111-111111111111","ticketId":"22222222-2222-2222-2222-222222222222","ticketCode":"VT-20260710-ABCDEFGH","seatNumber":"A1","bookingCode":"VR-20260710-ABCDEFG2","pickupStop":"33333333-3333-3333-3333-333333333333","boardingStatus":"PENDING"}]},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

`pickupStop` nullable (terminal origin); items được order theo pickup point. Lỗi `404 TRIP_NOT_FOUND`, `403 FORBIDDEN`, `422 VALIDATION_ERROR`, lỗi auth/common.

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/bookings/trips/$TRIP_ID/manifest"
```

```js
const manifest = await fetch(`${BASE_URL}/v1/bookings/trips/${tripId}/manifest`, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }).then(r => r.json());
```

### 6.2 Tick passenger boarded — `POST /v1/bookings/trips/{tripId}/boarding/passenger/{passengerRecordId}`

Hai path param đều UUID bắt buộc. Headers Authorization và Idempotency-Key; không có body.

```json
{"success":true,"statusCode":200,"data":{"passengerRecordId":"11111111-1111-1111-1111-111111111111","boardingStatus":"BOARDED","boardedAt":"2026-07-10T10:30:00+07:00","boardedAtStopId":"33333333-3333-3333-3333-333333333333","ticketId":"22222222-2222-2222-2222-222222222222","ticketCode":"VT-20260710-ABCDEFGH","ticketStatus":"USED"},"meta":{"traceId":"...","timestamp":"2026-07-10T03:30:00.0000000Z"}}
```

`boardedAtStopId` nullable. Lỗi `404 TRIP_NOT_FOUND|BOOKING_NOT_FOUND|TICKET_NOT_FOUND`; `403 FORBIDDEN`; `409 TICKET_NOT_BOARDABLE|BOOKING_PASSENGER_ALREADY_BOARDED`; `422 BOOKING_NOT_FOR_THIS_TRIP|VALIDATION_ERROR`; lỗi chung/idempotency mismatch.

```bash
curl -X POST "$BASE_URL/v1/bookings/trips/$TRIP_ID/boarding/passenger/$PASSENGER_RECORD_ID" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: board-001"
```

```js
const boarded = await fetch(`${BASE_URL}/v1/bookings/trips/${tripId}/boarding/passenger/${passengerRecordId}`, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Idempotency-Key': 'board-001' } }).then(r => r.json());
```

### 6.3 Quét QR/code — `POST /v1/bookings/trips/{tripId}/boarding/qr-scan`

Path `tripId` UUID. Headers Authorization, Content-Type. Body phải có chính xác một trong hai field:

| Field | Kiểu | Rule |
|---|---|---|
| `ticketCode` | string? | XOR; regex `^VT-\d{8}-[0-9A-HJ-NP-TV-Z]{8}$` |
| `bookingCode` | string? | XOR; regex `^VR-\d{8}-[A-Z2-7]{8}$` |

```json
{"ticketCode":"VT-20260710-ABCDEFGH","bookingCode":null}
```

Success `200`: `data.items[]` gồm `passengerRecordId`, `ticketId`, `ticketCode`, `seatNumber`, `boardingStatus`. Booking code có thể trả nhiều passenger.

```json
{"success":true,"statusCode":200,"data":{"items":[{"passengerRecordId":"11111111-1111-1111-1111-111111111111","ticketId":"22222222-2222-2222-2222-222222222222","ticketCode":"VT-20260710-ABCDEFGH","seatNumber":"A1","boardingStatus":"PENDING"}]},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

Lỗi `404 TRIP_NOT_FOUND|BOOKING_NOT_FOUND` (code không tồn tại, booking không CONFIRMED, ticket không `ISSUED|USED`, hoặc không resolve được passenger); `403 FORBIDDEN`; `422 BOOKING_NOT_FOR_THIS_TRIP|VALIDATION_ERROR`; lỗi chung.

```bash
curl -X POST "$BASE_URL/v1/bookings/trips/$TRIP_ID/boarding/qr-scan" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"ticketCode":"VT-20260710-ABCDEFGH","bookingCode":null}'
```

```js
const scan = await fetch(`${BASE_URL}/v1/bookings/trips/${tripId}/boarding/qr-scan`, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ticketCode: 'VT-20260710-ABCDEFGH', bookingCode: null }) }).then(r => r.json());
```

## 7. Operator APIs

### 7.1 Booking stats — `GET /v1/operator/booking-stats`

Headers Authorization. Role `OPERATOR_ADMIN|OPERATOR_STAFF`; operator id lấy từ `operator_id` rồi fallback `operatorId`. Không có body.

| Query | Kiểu | Bắt buộc | Default/rule |
|---|---|---:|---|
| `from` | date? | Không | `YYYY-MM-DD` |
| `to` | date? | Không | `YYYY-MM-DD` |
| `groupBy` | string? | Không | Default `date`; chỉ `date` (case-insensitive) |

```json
{"success":true,"statusCode":200,"data":{"items":[{"operatorId":"11111111-1111-1111-1111-111111111111","date":"2026-07-10","totalBookings":20,"totalRevenue":4000000,"totalCancellations":2,"totalNoShows":1,"totalPartialNoShows":1,"totalCompleted":16}]},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

Lỗi `422 VALIDATION_ERROR` groupBy khác date; `403 FORBIDDEN` role/thiếu operator claim (action `Forbid()`); lỗi common/model binding.

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/operator/booking-stats?from=2026-07-01&to=2026-07-10&groupBy=date"
```

```js
const stats = await fetch(`${BASE_URL}/v1/operator/booking-stats?from=2026-07-01&to=2026-07-10&groupBy=date`, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }).then(r => r.json());
```

### 7.2 List voucher consents — `GET /v1/operator/voucher-consents`

Headers Authorization; roles admin/staff. Query `status` optional, enum case-insensitive `PENDING|ACCEPTED|REJECTED`. Tenant lấy từ claim `operatorId`.

```json
{"success":true,"statusCode":200,"data":{"items":[{"id":"11111111-1111-1111-1111-111111111111","voucherId":"22222222-2222-2222-2222-222222222222","voucherCode":"SUMMER20","voucherType":"PERCENT_OFF","voucherValue":20,"validFrom":"2026-07-01T00:00:00+07:00","validUntil":"2026-08-31T23:59:59+07:00","minOrderAmount":100000,"maxDiscountAmount":50000,"applicableRouteIds":["33333333-3333-3333-3333-333333333333"],"status":"PENDING","requestedAt":"2026-07-01T00:00:00+07:00","respondedAt":null,"respondedByUserId":null}]},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

Lỗi `422 INVALID_STATUS`, `401 UNAUTHORIZED` nếu claims không parse, và common auth.

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/operator/voucher-consents?status=PENDING"
```

```js
const consents = await fetch(`${BASE_URL}/v1/operator/voucher-consents?status=PENDING`, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }).then(r => r.json());
```

### 7.3 Accept consent — `POST /v1/operator/voucher-consents/{id}/accept`

Path `id` UUID; headers Authorization + Idempotency-Key; role OPERATOR_ADMIN; không body. Success `200` data `{id,status}` với status `ACCEPTED`.

```json
{"success":true,"statusCode":200,"data":{"id":"11111111-1111-1111-1111-111111111111","status":"ACCEPTED"},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

Lỗi `403 FORBIDDEN` nếu consent không tồn tại hoặc khác operator (code cố ý không phân biệt), `409 CONSENT_NOT_PENDING`, `422 VALIDATION_ERROR` header/id empty, common auth/idempotency.

```bash
curl -X POST "$BASE_URL/v1/operator/voucher-consents/$CONSENT_ID/accept" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: consent-accept-001"
```

```js
const accepted = await fetch(`${BASE_URL}/v1/operator/voucher-consents/${consentId}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Idempotency-Key': 'consent-accept-001' } }).then(r => r.json());
```

### 7.4 Reject/revoke consent — `POST /v1/operator/voucher-consents/{id}/reject`

Path/header/role như 7.3. Body nullable; `reason` optional nullable string, max 2000. PENDING hoặc ACCEPTED chuyển REJECTED.

```json
{"reason":"Không áp dụng chiến dịch này"}
```

Success data `{id,status:"REJECTED"}`. Lỗi `403 FORBIDDEN`, `409 CONSENT_ALREADY_REJECTED`, `422 VALIDATION_ERROR`, common.

```bash
curl -X POST "$BASE_URL/v1/operator/voucher-consents/$CONSENT_ID/reject" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: consent-reject-001" --data '{"reason":"Không áp dụng chiến dịch này"}'
```

```js
const rejected = await fetch(`${BASE_URL}/v1/operator/voucher-consents/${consentId}/reject`, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'consent-reject-001' }, body: JSON.stringify({ reason: 'Không áp dụng chiến dịch này' }) }).then(r => r.json());
```

### 7.5 Tạo operator voucher — `POST /v1/operator/vouchers`

Headers Authorization, Content-Type, Idempotency-Key; role OPERATOR_ADMIN.

| Body | Kiểu | Rule |
|---|---|---|
| `code` | string? | Optional; max 50; null/blank auto-generate 8 ký tự |
| `name` | string | Có; 1–120 |
| `type` | string | `PERCENT_OFF|FIXED_AMOUNT` |
| `value` | int64 | >0; code không giới hạn PERCENT_OFF <=100 |
| `minOrderAmount` | int64 | >=0 |
| `maxDiscountAmount` | int64? | >0 nếu có |
| `totalUsageLimit`, `perUserLimit` | int32? | >0 nếu có |
| `validFrom`, `validUntil` | date-time | until > from |
| `applicableServices` | string[]? | Nếu có phải non-empty, chỉ BOOKING/PARCEL; null default BOOKING |
| `applicableRouteIds` | UUID[]? | Optional; không validate empty UUID |
| `fundingType` | string? | Null hoặc OPERATOR_FUNDED; value khác trả error |

```json
{"code":"OP20","name":"Operator sale","type":"PERCENT_OFF","value":20,"minOrderAmount":100000,"maxDiscountAmount":50000,"totalUsageLimit":100,"perUserLimit":1,"validFrom":"2026-07-10T00:00:00+07:00","validUntil":"2026-08-10T23:59:59+07:00","applicableServices":["BOOKING"],"applicableRouteIds":["33333333-3333-3333-3333-333333333333"],"fundingType":"OPERATOR_FUNDED"}
```

Success `201` data fields: `id,code,name,type,value,fundingType,ownerOperatorId,isActive,validFrom,validUntil,createdAt`. `ownerOperatorId` từ token, `isActive=true`.

```json
{"success":true,"statusCode":201,"data":{"id":"11111111-1111-1111-1111-111111111111","code":"OP20","name":"Operator sale","type":"PERCENT_OFF","value":20,"fundingType":"OPERATOR_FUNDED","ownerOperatorId":"22222222-2222-2222-2222-222222222222","isActive":true,"validFrom":"2026-07-10T00:00:00+07:00","validUntil":"2026-08-10T23:59:59+07:00","createdAt":"2026-07-10T10:30:00+07:00"},"meta":{"traceId":"...","timestamp":"2026-07-10T03:30:00.0000000Z"}}
```

Lỗi `409 VOUCHER_CODE_CONFLICT`; `422 VOUCHER_FORBIDDEN_FUNDING|VALIDATION_ERROR`; `500 INTERNAL_ERROR` nếu auto-generate hết retry; common.

```bash
curl -X POST "$BASE_URL/v1/operator/vouchers" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: voucher-create-001" --data '{"code":"OP20","name":"Operator sale","type":"PERCENT_OFF","value":20,"minOrderAmount":100000,"maxDiscountAmount":50000,"totalUsageLimit":100,"perUserLimit":1,"validFrom":"2026-07-10T00:00:00+07:00","validUntil":"2026-08-10T23:59:59+07:00","applicableServices":["BOOKING"],"applicableRouteIds":[],"fundingType":"OPERATOR_FUNDED"}'
```

```js
const operatorVoucherBody = { code: 'OP20', name: 'Operator sale', type: 'PERCENT_OFF', value: 20, minOrderAmount: 100000, maxDiscountAmount: 50000, totalUsageLimit: 100, perUserLimit: 1, validFrom: '2026-07-10T00:00:00+07:00', validUntil: '2026-08-10T23:59:59+07:00', applicableServices: ['BOOKING'], applicableRouteIds: [], fundingType: 'OPERATOR_FUNDED' };
const createdVoucher = await fetch(`${BASE_URL}/v1/operator/vouchers`, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'voucher-create-001' }, body: JSON.stringify(operatorVoucherBody) }).then(r => r.json());
```

### 7.6 List operator vouchers — `GET /v1/operator/vouchers`

Headers Authorization; role admin. Query: `isActive:boolean?`, `page:int=1`, `pageSize:int=20`, `sortBy?` (`createdAt|validFrom|validUntil|code|name|isActive`, case-sensitive), `sortDir:string=desc` (`asc|desc`, case-insensitive). `QueryOptions` chuẩn hóa `page<1` thành 1; clamp `pageSize` vào 1–100.

Success `200` data pagination `{items,page,pageSize,totalItems,totalPages,hasNextPage,hasPreviousPage}`. Mỗi item gồm `id,code,name,type,value,minOrderAmount,maxDiscountAmount,totalUsageLimit,perUserLimit,newUserOnly,applicableServices,applicablePaymentMethods,applicableOperatorIds,applicableRouteIds,fundingType,ownerOperatorId,isActive,validFrom,validUntil,createdAt`.

```json
{"success":true,"statusCode":200,"data":{"items":[],"page":1,"pageSize":20,"totalItems":0,"totalPages":0,"hasNextPage":false,"hasPreviousPage":false},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

Lỗi `422 INVALID_SORT_DIRECTION|INVALID_SORT_FIELD|VALIDATION_ERROR`; common auth.

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/operator/vouchers?page=1&pageSize=20&sortBy=createdAt&sortDir=desc"
```

```js
const vouchers = await fetch(`${BASE_URL}/v1/operator/vouchers?page=1&pageSize=20&sortBy=createdAt&sortDir=desc`, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }).then(r => r.json());
```

### 7.7 Sửa operator voucher — `PATCH /v1/operator/vouchers/{id}`

Path UUID; headers Authorization + Content-Type. Controller không bắt buộc Idempotency-Key; nếu gửi thì middleware vẫn cache PATCH. Tất cả field optional: `name` 1–120, `value>0`, `minOrderAmount>=0`, `maxDiscountAmount>0`, `totalUsageLimit>0`, `perUserLimit>0`, `validFrom`, `validUntil` (chỉ validator until>from khi gửi cả hai), `applicableRouteIds:UUID[]?`. Null nghĩa giữ nguyên, không phải xóa cap.

```json
{"name":"Operator sale updated","validUntil":"2026-09-10T23:59:59+07:00","applicableRouteIds":["33333333-3333-3333-3333-333333333333"]}
```

Success `200` data `id,code,name,type,value,fundingType,ownerOperatorId,isActive,validFrom,validUntil`. Lỗi `404 VOUCHER_NOT_FOUND`; `409 VOUCHER_LOCKED` sau lần dùng đầu khi đổi economic field/validFrom, rút ngắn validUntil hoặc siết limits; `422 VALIDATION_ERROR`; `500 INTERNAL_ERROR` nếu effective dates invalid nhưng validator không bắt được khi chỉ gửi một đầu; common.

```bash
curl -X PATCH "$BASE_URL/v1/operator/vouchers/$VOUCHER_ID" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" --data '{"name":"Operator sale updated","validUntil":"2026-09-10T23:59:59+07:00"}'
```

```js
const updatedVoucher = await fetch(`${BASE_URL}/v1/operator/vouchers/${voucherId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Operator sale updated', validUntil: '2026-09-10T23:59:59+07:00' }) }).then(r => r.json());
```

### 7.8 Xóa/kích hoạt/vô hiệu operator voucher

Ba endpoint đều path `id` UUID, Authorization, role OPERATOR_ADMIN, không body, không bắt buộc Idempotency-Key. Cross-operator hoặc không tồn tại trả `404 VOUCHER_NOT_FOUND`.

| Chức năng | Method + URL | Success data |
|---|---|---|
| Soft-delete | `DELETE /v1/operator/vouchers/{id}` | `{ "id": UUID, "deletedAt": date-time }` |
| Activate | `POST /v1/operator/vouchers/{id}/activate` | `{ "id": UUID, "isActive": true }` |
| Deactivate | `POST /v1/operator/vouchers/{id}/deactivate` | `{ "id": UUID, "isActive": false }` |

Mỗi response là wrapper success `200` chuẩn. Delete đã soft-delete là behavior-idempotent; activate/deactivate cũng behavior-idempotent. Lỗi: `404 VOUCHER_NOT_FOUND`, auth/common, `500 INTERNAL_ERROR` DB.

```json
{"success":true,"statusCode":200,"data":{"id":"11111111-1111-1111-1111-111111111111","deletedAt":"2026-07-10T10:30:00+07:00"},"meta":{"traceId":"...","timestamp":"2026-07-10T03:30:00.0000000Z"}}
```

Với activate/deactivate, cùng wrapper nhưng `data` lần lượt là `{"id":"...","isActive":true}` và `{"id":"...","isActive":false}`.

```bash
curl -X DELETE "$BASE_URL/v1/operator/vouchers/$VOUCHER_ID" -H "Authorization: Bearer $ACCESS_TOKEN"
curl -X POST "$BASE_URL/v1/operator/vouchers/$VOUCHER_ID/activate" -H "Authorization: Bearer $ACCESS_TOKEN"
curl -X POST "$BASE_URL/v1/operator/vouchers/$VOUCHER_ID/deactivate" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const deletedVoucher = await fetch(`${BASE_URL}/v1/operator/vouchers/${voucherId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }).then(r => r.json());
const activatedVoucher = await fetch(`${BASE_URL}/v1/operator/vouchers/${voucherId}/activate`, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }).then(r => r.json());
const deactivatedVoucher = await fetch(`${BASE_URL}/v1/operator/vouchers/${voucherId}/deactivate`, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }).then(r => r.json());
```

## 8. System admin APIs

### 8.1 Aggregate booking stats — `GET /v1/admin/booking-stats/aggregate`

Authorization SYSTEM_ADMIN. Query `from:date?`, `to:date?`, `groupBy:string?` default `operator`, chỉ `operator|date` case-insensitive. Không body.

```json
{"success":true,"statusCode":200,"data":{"items":[{"operatorId":"11111111-1111-1111-1111-111111111111","operatorName":"VietRide Operator","date":null,"totalBookings":20,"totalRevenue":4000000,"totalCancellations":2,"totalNoShows":1,"totalPartialNoShows":1,"totalCompleted":16}]},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

Lỗi `422 VALIDATION_ERROR` groupBy; 400 date binding; auth/common.

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/admin/booking-stats/aggregate?from=2026-07-01&to=2026-07-10&groupBy=operator"
```

```js
const adminStats = await fetch(`${BASE_URL}/v1/admin/booking-stats/aggregate?from=2026-07-01&to=2026-07-10&groupBy=operator`, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }).then(r => r.json());
```

### 8.2 List campaigns — `GET /v1/admin/campaigns`

Authorization SYSTEM_ADMIN; không params/body. Success `200` data array item gồm `id,name,description,ownerOperatorId,isActive,validFrom,validUntil,createdAt`; description/owner nullable. Repository chỉ query non-soft-deleted.

```json
{"success":true,"statusCode":200,"data":[{"id":"11111111-1111-1111-1111-111111111111","name":"Summer 2026","description":"Campaign tháng 7","ownerOperatorId":null,"isActive":true,"validFrom":"2026-07-01T00:00:00+07:00","validUntil":"2026-08-31T23:59:59+07:00","createdAt":"2026-06-30T10:00:00+07:00"}],"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

Lỗi auth/common/DB 500.

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/admin/campaigns"
```

```js
const campaigns = await fetch(`${BASE_URL}/v1/admin/campaigns`, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }).then(r => r.json());
```

### 8.3 Tạo/cập nhật campaign

| Chức năng | Method + URL | Idempotency |
|---|---|---|
| Tạo | `POST /v1/admin/campaigns` | Bắt buộc |
| Cập nhật | `PATCH /v1/admin/campaigns/{campaignId}` | Bắt buộc |

Authorization SYSTEM_ADMIN, Content-Type JSON. Cả hai dùng cùng DTO (không phải partial):

| Body | Kiểu | Model default / rule thực tế |
|---|---|---|
| `name` | string | Default `""`; domain yêu cầu non-blank; không max length trong code |
| `description` | string? | Optional; trim, blank thành null; không max length |
| `ownerOperatorId` | UUID? | Create dùng; Patch bỏ qua field này |
| `validFrom`, `validUntil` | date-time | until > from |
| `isActive` | bool | Default true; Create bỏ qua và luôn active; Patch dùng |
| `voucherIds` | UUID[] | Default `[]`; không validator UUID empty/tồn tại |

```json
{"name":"Summer 2026","description":"Campaign tháng 7","ownerOperatorId":null,"validFrom":"2026-07-01T00:00:00+07:00","validUntil":"2026-08-31T23:59:59+07:00","isActive":true,"voucherIds":["22222222-2222-2222-2222-222222222222"]}
```

Create success `201`, Patch `200`; data là Campaign DTO ở 8.2. Patch lỗi `404 CAMPAIGN_NOT_FOUND`. Name blank hoặc date range sai ném `ArgumentException` và hiện map `500 INTERNAL_ERROR` (không phải 422). FK/DB errors cũng 500. Lỗi header `422 VALIDATION_ERROR`, auth/common/idempotency mismatch.

```json
{"success":true,"statusCode":201,"data":{"id":"11111111-1111-1111-1111-111111111111","name":"Summer 2026","description":"Campaign tháng 7","ownerOperatorId":null,"isActive":true,"validFrom":"2026-07-01T00:00:00+07:00","validUntil":"2026-08-31T23:59:59+07:00","createdAt":"2026-07-10T10:30:00+07:00"},"meta":{"traceId":"...","timestamp":"2026-07-10T03:30:00.0000000Z"}}
```

PATCH có cùng shape, `statusCode: 200`.

```bash
curl -X POST "$BASE_URL/v1/admin/campaigns" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: campaign-create-001" --data '{"name":"Summer 2026","description":"Campaign tháng 7","ownerOperatorId":null,"validFrom":"2026-07-01T00:00:00+07:00","validUntil":"2026-08-31T23:59:59+07:00","isActive":true,"voucherIds":[]}'
curl -X PATCH "$BASE_URL/v1/admin/campaigns/$CAMPAIGN_ID" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: campaign-update-001" --data '{"name":"Summer 2026","description":"Campaign tháng 7","ownerOperatorId":null,"validFrom":"2026-07-01T00:00:00+07:00","validUntil":"2026-08-31T23:59:59+07:00","isActive":true,"voucherIds":[]}'
```

```js
const campaignBody = { name: 'Summer 2026', description: 'Campaign tháng 7', ownerOperatorId: null, validFrom: '2026-07-01T00:00:00+07:00', validUntil: '2026-08-31T23:59:59+07:00', isActive: true, voucherIds: [] };
const createdCampaign = await fetch(`${BASE_URL}/v1/admin/campaigns`, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'campaign-create-001' }, body: JSON.stringify(campaignBody) }).then(r => r.json());
const updatedCampaign = await fetch(`${BASE_URL}/v1/admin/campaigns/${campaignId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'campaign-update-001' }, body: JSON.stringify(campaignBody) }).then(r => r.json());
```

### 8.4 Activate/deactivate campaign

`POST /v1/admin/campaigns/{campaignId}/activate` và `/deactivate`; UUID path, Authorization, Idempotency-Key, không body. Success `200` Campaign DTO với `isActive` tương ứng. Lỗi `404 CAMPAIGN_NOT_FOUND`, `422 VALIDATION_ERROR` thiếu key, auth/common.

```json
{"success":true,"statusCode":200,"data":{"id":"11111111-1111-1111-1111-111111111111","name":"Summer 2026","description":"Campaign tháng 7","ownerOperatorId":null,"isActive":true,"validFrom":"2026-07-01T00:00:00+07:00","validUntil":"2026-08-31T23:59:59+07:00","createdAt":"2026-06-30T10:00:00+07:00"},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

Deactivate có cùng shape với `isActive:false`.

```bash
curl -X POST "$BASE_URL/v1/admin/campaigns/$CAMPAIGN_ID/activate" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: campaign-activate-001"
curl -X POST "$BASE_URL/v1/admin/campaigns/$CAMPAIGN_ID/deactivate" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: campaign-deactivate-001"
```

```js
const activeCampaign = await fetch(`${BASE_URL}/v1/admin/campaigns/${campaignId}/activate`, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Idempotency-Key': 'campaign-activate-001' } }).then(r => r.json());
const inactiveCampaign = await fetch(`${BASE_URL}/v1/admin/campaigns/${campaignId}/deactivate`, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Idempotency-Key': 'campaign-deactivate-001' } }).then(r => r.json());
```

### 8.5 Tạo admin voucher — `POST /v1/admin/vouchers`

Authorization SYSTEM_ADMIN, Content-Type, Idempotency-Key. Body giống operator voucher 7.5 và thêm:

- `newUserOnly:boolean` default false.
- `applicablePaymentMethods:string[]?`: validator chỉ từng item `WALLET|VNPAY`; mảng rỗng được phép và nghĩa mọi method.
- `applicableServices:string[]?`: nếu non-null phải non-empty, items BOOKING/PARCEL; null default BOOKING.
- `applicableOperatorIds:UUID[]?`: bắt buộc non-null và non-empty khi `fundingType=OPERATOR_FUNDED`.
- `fundingType`: bắt buộc `VIETRIDE_FUNDED|OPERATOR_FUNDED` case-insensitive.

```json
{"code":"SUMMER20","name":"Summer sale","type":"PERCENT_OFF","value":20,"minOrderAmount":100000,"maxDiscountAmount":50000,"totalUsageLimit":1000,"perUserLimit":1,"validFrom":"2026-07-01T00:00:00+07:00","validUntil":"2026-08-31T23:59:59+07:00","newUserOnly":false,"applicablePaymentMethods":["WALLET","VNPAY"],"applicableServices":["BOOKING"],"applicableOperatorIds":null,"applicableRouteIds":null,"fundingType":"VIETRIDE_FUNDED"}
```

Success `201` data `id,code,name,type,value,fundingType,ownerOperatorId(null),isActive,validFrom,validUntil,createdAt`. Lỗi `409 VOUCHER_CODE_CONFLICT`; `422 VALIDATION_ERROR`; `500 INTERNAL_ERROR` auto-code retries/DB; common.

```json
{"success":true,"statusCode":201,"data":{"id":"11111111-1111-1111-1111-111111111111","code":"SUMMER20","name":"Summer sale","type":"PERCENT_OFF","value":20,"fundingType":"VIETRIDE_FUNDED","ownerOperatorId":null,"isActive":true,"validFrom":"2026-07-01T00:00:00+07:00","validUntil":"2026-08-31T23:59:59+07:00","createdAt":"2026-07-10T10:30:00+07:00"},"meta":{"traceId":"...","timestamp":"2026-07-10T03:30:00.0000000Z"}}
```

```bash
curl -X POST "$BASE_URL/v1/admin/vouchers" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: admin-voucher-create-001" --data '{"code":"SUMMER20","name":"Summer sale","type":"PERCENT_OFF","value":20,"minOrderAmount":100000,"maxDiscountAmount":50000,"totalUsageLimit":1000,"perUserLimit":1,"validFrom":"2026-07-01T00:00:00+07:00","validUntil":"2026-08-31T23:59:59+07:00","newUserOnly":false,"applicablePaymentMethods":["WALLET","VNPAY"],"applicableServices":["BOOKING"],"applicableOperatorIds":null,"applicableRouteIds":null,"fundingType":"VIETRIDE_FUNDED"}'
```

```js
const adminVoucherBody = { code: 'SUMMER20', name: 'Summer sale', type: 'PERCENT_OFF', value: 20, minOrderAmount: 100000, maxDiscountAmount: 50000, totalUsageLimit: 1000, perUserLimit: 1, validFrom: '2026-07-01T00:00:00+07:00', validUntil: '2026-08-31T23:59:59+07:00', newUserOnly: false, applicablePaymentMethods: ['WALLET', 'VNPAY'], applicableServices: ['BOOKING'], applicableOperatorIds: null, applicableRouteIds: null, fundingType: 'VIETRIDE_FUNDED' };
const adminVoucher = await fetch(`${BASE_URL}/v1/admin/vouchers`, { method: 'POST', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'admin-voucher-create-001' }, body: JSON.stringify(adminVoucherBody) }).then(r => r.json());
```

### 8.6 List admin vouchers — `GET /v1/admin/vouchers`

Authorization SYSTEM_ADMIN. Query như 7.6, thêm `fundingType?=VIETRIDE_FUNDED|OPERATOR_FUNDED`; `isActive?`; defaults page 1/pageSize 20/sortDir desc. Chỉ platform voucher (`ownerOperatorId=null`) và non-soft-deleted.

Response pagination/item chính xác như 7.6. Lỗi `422 INVALID_SORT_DIRECTION|INVALID_SORT_FIELD|VALIDATION_ERROR` (funding type), common.

```json
{"success":true,"statusCode":200,"data":{"items":[],"page":1,"pageSize":20,"totalItems":0,"totalPages":0,"hasNextPage":false,"hasPreviousPage":false},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/admin/vouchers?fundingType=VIETRIDE_FUNDED&page=1&pageSize=20&sortBy=createdAt&sortDir=desc"
```

```js
const adminVouchers = await fetch(`${BASE_URL}/v1/admin/vouchers?fundingType=VIETRIDE_FUNDED&page=1&pageSize=20&sortBy=createdAt&sortDir=desc`, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }).then(r => r.json());
```

### 8.7 Sửa admin voucher — `PATCH /v1/admin/vouchers/{id}`

UUID path, Authorization, Content-Type, Idempotency-Key. Tất cả optional: `name`, `value`, `minOrderAmount`, `maxDiscountAmount`, `totalUsageLimit`, `perUserLimit`, `validFrom`, `validUntil`, `newUserOnly`, `applicablePaymentMethods`, `applicableServices`, `applicableRouteIds`. Rules như validators mô tả ở 7.7/8.5; services non-null phải non-empty. Null nghĩa giữ hiện tại.

Success `200` data `id,code,name,type,value,fundingType,ownerOperatorId,isActive,validFrom,validUntil,newUserOnly,applicablePaymentMethods,applicableServices,applicableRouteIds`. Lỗi `404 VOUCHER_NOT_FOUND`; `409 VOUCHER_LOCKED` rules như 7.7; `422 VALIDATION_ERROR`; possible `500 INTERNAL_ERROR` effective domain invalid; common.

```json
{"success":true,"statusCode":200,"data":{"id":"11111111-1111-1111-1111-111111111111","code":"SUMMER20","name":"Summer sale updated","type":"PERCENT_OFF","value":20,"fundingType":"VIETRIDE_FUNDED","ownerOperatorId":null,"isActive":true,"validFrom":"2026-07-01T00:00:00+07:00","validUntil":"2026-08-31T23:59:59+07:00","newUserOnly":false,"applicablePaymentMethods":["WALLET","VNPAY"],"applicableServices":["BOOKING"],"applicableRouteIds":[]},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

```bash
curl -X PATCH "$BASE_URL/v1/admin/vouchers/$VOUCHER_ID" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: admin-voucher-update-001" --data '{"name":"Summer sale updated"}'
```

```js
const patchedAdminVoucher = await fetch(`${BASE_URL}/v1/admin/vouchers/${voucherId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'admin-voucher-update-001' }, body: JSON.stringify({ name: 'Summer sale updated' }) }).then(r => r.json());
```

### 8.8 Xóa admin voucher — `DELETE /v1/admin/vouchers/{id}`

UUID path, Authorization, Idempotency-Key bắt buộc; không body. Success `200` data `{id,deletedAt}`. Chỉ platform voucher addressable; operator voucher trả `404 VOUCHER_NOT_FOUND`. Delete đã xóa trả lại timestamp cũ. Middleware không cache DELETE nên idempotency chỉ do domain behavior.

```json
{"success":true,"statusCode":200,"data":{"id":"11111111-1111-1111-1111-111111111111","deletedAt":"2026-07-10T10:30:00+07:00"},"meta":{"traceId":"...","timestamp":"2026-07-10T03:30:00.0000000Z"}}
```

```bash
curl -X DELETE "$BASE_URL/v1/admin/vouchers/$VOUCHER_ID" -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: admin-voucher-delete-001"
```

```js
const deletedAdminVoucher = await fetch(`${BASE_URL}/v1/admin/vouchers/${voucherId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Idempotency-Key': 'admin-voucher-delete-001' } }).then(r => r.json());
```

### 8.9 Consent theo voucher — `GET /v1/admin/vouchers/{voucherId}/consents`

UUID path, Authorization SYSTEM_ADMIN; không query/body. Success `200`:

```json
{"success":true,"statusCode":200,"data":{"voucherId":"22222222-2222-2222-2222-222222222222","items":[{"id":"11111111-1111-1111-1111-111111111111","operatorId":"33333333-3333-3333-3333-333333333333","voucherId":"22222222-2222-2222-2222-222222222222","status":"PENDING","requestedAt":"2026-07-01T00:00:00+07:00","respondedAt":null,"respondedByUserId":null,"rejectReason":null}]},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

Code handler không kiểm tra voucher tồn tại; voucher không tồn tại có thể trả `200` với `items:[]`, mặc dù controller khai báo Swagger 404. Do đó không tài liệu hóa `VOUCHER_NOT_FOUND`. Lỗi `422 VALIDATION_ERROR` empty UUID (route UUID all-zero vẫn match), auth/common.

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/v1/admin/vouchers/$VOUCHER_ID/consents"
```

```js
const adminConsents = await fetch(`${BASE_URL}/v1/admin/vouchers/${voucherId}/consents`, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }).then(r => r.json());
```

## 9. Internal service-to-service APIs

> Dùng `INTERNAL_BASE_URL` và `X-Internal-Auth`, không qua public Gateway route table.

### 9.1 Booking snapshot — `GET /internal/v1/bookings/{bookingId}`

UUID path; internal header; không query/body. Success `200` **raw**:

```json
{"bookingId":"55555555-5555-5555-5555-555555555555","userId":"11111111-1111-1111-1111-111111111111","tripId":"22222222-2222-2222-2222-222222222222","status":"CONFIRMED","activeTicketCount":1,"tickets":[{"ticketId":"66666666-6666-6666-6666-666666666666","ticketCode":"VT-20260710-ABCDEFGH","seatNumber":"A1","status":"ISSUED"}]}
```

Lỗi vẫn wrapper: `401 AUTH_TOKEN_INVALID`, `404 BOOKING_NOT_FOUND`, `422 VALIDATION_ERROR`, `500 INTERNAL_ERROR`.

```bash
curl -H "X-Internal-Auth: Bearer $INTERNAL_TOKEN" "$INTERNAL_BASE_URL/internal/v1/bookings/$BOOKING_ID"
```

```js
const snapshot = await fetch(`${INTERNAL_BASE_URL}/internal/v1/bookings/${bookingId}`, { headers: { 'X-Internal-Auth': `Bearer ${INTERNAL_TOKEN}` } }).then(r => r.json());
```

### 9.2 Tracking authorization — `GET /internal/v1/trips/{tripId}/tracking-authorization/bookings`

Path UUID; internal auth. Query `userId:UUID?`, `role:string?`, không validation. Success `200` được action tự bọc: `data.allowed:boolean`, `scope:string?`, `error:string?`.

```json
{"success":true,"statusCode":200,"data":{"allowed":true,"scope":"BOOKING_OWNER","error":null},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

Handler chỉ cho role `PASSENGER` (case-insensitive) có `userId` và có booking thuộc trip ở một trong các status `CONFIRMED|COMPLETED|DISRUPTED|PARTIAL_NO_SHOW`, đồng thời có ticket `ISSUED|USED`. Khi đạt điều kiện trả `allowed:true,scope:"BOOKING_OWNER",error:null`; mọi trường hợp còn lại trả `allowed:false,scope:null,error:"ACCESS_DENIED"`. Không ném business error. Lỗi auth/model binding/500.

```bash
curl -H "X-Internal-Auth: Bearer $INTERNAL_TOKEN" "$INTERNAL_BASE_URL/internal/v1/trips/$TRIP_ID/tracking-authorization/bookings?userId=$USER_ID&role=PASSENGER"
```

```js
const authorization = await fetch(`${INTERNAL_BASE_URL}/internal/v1/trips/${tripId}/tracking-authorization/bookings?userId=${userId}&role=PASSENGER`, { headers: { 'X-Internal-Auth': `Bearer ${INTERNAL_TOKEN}` } }).then(r => r.json());
```

### 9.3 Pickup bookings — `GET /internal/v1/trips/{tripId}/stops/{stopId}/pickup-bookings`

Hai UUID path; internal auth; không query/body. Success được action tự bọc; `data.bookings[]` fields `bookingId`, `passengerUserId` nullable, `stopId`, `status`, `pickupStatus` nullable (default constructor null; repository projection có thể set).

```json
{"success":true,"statusCode":200,"data":{"bookings":[{"bookingId":"55555555-5555-5555-5555-555555555555","passengerUserId":"11111111-1111-1111-1111-111111111111","stopId":"33333333-3333-3333-3333-333333333333","status":"CONFIRMED","pickupStatus":null}]},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

Lỗi auth/model binding/500; code không ném 404 khi không có booking, trả array rỗng.

```bash
curl -H "X-Internal-Auth: Bearer $INTERNAL_TOKEN" "$INTERNAL_BASE_URL/internal/v1/trips/$TRIP_ID/stops/$STOP_ID/pickup-bookings"
```

```js
const pickups = await fetch(`${INTERNAL_BASE_URL}/internal/v1/trips/${tripId}/stops/${stopId}/pickup-bookings`, { headers: { 'X-Internal-Auth': `Bearer ${INTERNAL_TOKEN}` } }).then(r => r.json());
```

### 9.4 Validate voucher — `POST /internal/v1/vouchers/validate`

Internal auth + JSON. Không có FluentValidator riêng; non-nullable value types thiếu sẽ bind default empty/0.

```json
{"voucherCode":"SUMMER20","operatorId":"11111111-1111-1111-1111-111111111111","routeId":"22222222-2222-2222-2222-222222222222","userId":"33333333-3333-3333-3333-333333333333","orderAmount":200000,"service":"BOOKING","paymentMethod":"WALLET"}
```

Success raw `200`: `{"voucherId":"...","discountAmount":40000}`. Lỗi `404 VOUCHER_NOT_FOUND`; `422 VOUCHER_EXPIRED|VOUCHER_NOT_APPLICABLE|VOUCHER_PAYMENT_METHOD_NOT_APPLICABLE|VOUCHER_NEW_USER_ONLY|VOUCHER_MIN_ORDER_NOT_MET|VOUCHER_USAGE_LIMIT_REACHED|VOUCHER_USER_LIMIT_REACHED`; `500 INTERNAL_ERROR` cho null `service`/domain/unmapped; auth/400 binding.

```bash
curl -X POST "$INTERNAL_BASE_URL/internal/v1/vouchers/validate" -H "X-Internal-Auth: Bearer $INTERNAL_TOKEN" -H "Content-Type: application/json" --data '{"voucherCode":"SUMMER20","operatorId":"11111111-1111-1111-1111-111111111111","routeId":"22222222-2222-2222-2222-222222222222","userId":"33333333-3333-3333-3333-333333333333","orderAmount":200000,"service":"BOOKING","paymentMethod":"WALLET"}'
```

```js
const validateVoucherBody = { voucherCode: 'SUMMER20', operatorId: '11111111-1111-1111-1111-111111111111', routeId: '22222222-2222-2222-2222-222222222222', userId: '33333333-3333-3333-3333-333333333333', orderAmount: 200000, service: 'BOOKING', paymentMethod: 'WALLET' };
const validated = await fetch(`${INTERNAL_BASE_URL}/internal/v1/vouchers/validate`, { method: 'POST', headers: { 'X-Internal-Auth': `Bearer ${INTERNAL_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(validateVoucherBody) }).then(r => r.json());
```

### 9.5 Record voucher usage — `POST /internal/v1/vouchers/usages`

Internal auth, JSON, Idempotency-Key. Fields: `voucherId:UUID`, `userId:UUID`, `referenceType:string`, `referenceId:UUID`, `discountAmount:int64`; không validator ở command. Code trim + uppercase `referenceType`; không parse/giới hạn enum ở application/domain. DDL mô tả `BOOKING` hoặc `PARCEL` và column dài tối đa 20, nhưng không có CHECK constraint trong code.

```json
{"voucherId":"11111111-1111-1111-1111-111111111111","userId":"22222222-2222-2222-2222-222222222222","referenceType":"PARCEL","referenceId":"33333333-3333-3333-3333-333333333333","discountAmount":40000}
```

Success raw `201`: `{"usageId":"44444444-4444-4444-4444-444444444444"}`. Lỗi `422 VALIDATION_ERROR` thiếu key; `500 INTERNAL_ERROR` voucher không tồn tại, discount âm, reference quá dài/DB error; auth/400/idempotency mismatch.

```bash
curl -X POST "$INTERNAL_BASE_URL/internal/v1/vouchers/usages" -H "X-Internal-Auth: Bearer $INTERNAL_TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: parcel-voucher-usage-001" --data '{"voucherId":"11111111-1111-1111-1111-111111111111","userId":"22222222-2222-2222-2222-222222222222","referenceType":"PARCEL","referenceId":"33333333-3333-3333-3333-333333333333","discountAmount":40000}'
```

```js
const voucherUsageBody = { voucherId: '11111111-1111-1111-1111-111111111111', userId: '22222222-2222-2222-2222-222222222222', referenceType: 'PARCEL', referenceId: '33333333-3333-3333-3333-333333333333', discountAmount: 40000 };
const usage = await fetch(`${INTERNAL_BASE_URL}/internal/v1/vouchers/usages`, { method: 'POST', headers: { 'X-Internal-Auth': `Bearer ${INTERNAL_TOKEN}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'parcel-voucher-usage-001' }, body: JSON.stringify(voucherUsageBody) }).then(r => r.json());
```

### 9.6 Delete usage by reference — `DELETE /internal/v1/vouchers/usages/by-reference`

Internal auth + Idempotency-Key. Query `referenceType:string` và `referenceId:UUID` đều là non-nullable action parameters; repository trim + uppercase reference type, không enum-parse. Success `204`, body rỗng. Middleware không idempotency-cache DELETE; compensation repository behavior không ném nếu không tìm thấy.

Lỗi `422 VALIDATION_ERROR` thiếu key; `500 INTERNAL_ERROR` nếu `referenceType` null làm `Trim()` lỗi hoặc DB lỗi; 400 UUID/type binding; auth.

```bash
curl -X DELETE "$INTERNAL_BASE_URL/internal/v1/vouchers/usages/by-reference?referenceType=PARCEL&referenceId=$PARCEL_ID" -H "X-Internal-Auth: Bearer $INTERNAL_TOKEN" -H "Idempotency-Key: parcel-voucher-delete-001"
```

```js
const deleteUsageResponse = await fetch(`${INTERNAL_BASE_URL}/internal/v1/vouchers/usages/by-reference?referenceType=PARCEL&referenceId=${parcelId}`, { method: 'DELETE', headers: { 'X-Internal-Auth': `Bearer ${INTERNAL_TOKEN}`, 'Idempotency-Key': 'parcel-voucher-delete-001' } }); // status 204
```

### 9.7 Internal available vouchers — `GET /internal/v1/vouchers/available`

Internal auth. Required query by value/action signature: `userId:UUID`, `service:string`, `operatorId:UUID`, `routeId:UUID`; optional `paymentMethod:string?`, `orderAmount:int64?` default 0. Success raw array item đúng schema AvailableVoucherItem ở 5.2, không wrapper. Endpoint nuốt voucher eligibility errors; lỗi auth/400/500.

```json
[{"id":"11111111-1111-1111-1111-111111111111","code":"SUMMER20","name":"Summer sale","type":"PERCENT_OFF","value":20,"minOrderAmount":100000,"maxDiscountAmount":50000,"discountAmount":40000,"applicableServices":["PARCEL"],"applicablePaymentMethods":["WALLET"],"validUntil":"2026-08-31T23:59:59+07:00"}]
```

```bash
curl -H "X-Internal-Auth: Bearer $INTERNAL_TOKEN" "$INTERNAL_BASE_URL/internal/v1/vouchers/available?userId=$USER_ID&service=PARCEL&operatorId=$OPERATOR_ID&routeId=$ROUTE_ID&paymentMethod=WALLET&orderAmount=200000"
```

```js
const internalAvailable = await fetch(`${INTERNAL_BASE_URL}/internal/v1/vouchers/available?userId=${userId}&service=PARCEL&operatorId=${operatorId}&routeId=${routeId}&paymentMethod=WALLET&orderAmount=200000`, { headers: { 'X-Internal-Auth': `Bearer ${INTERNAL_TOKEN}` } }).then(r => r.json());
```

## 10. Health và diagnostics

### 10.1 Ping — `GET /v1/ping`

`AllowAnonymous`, direct Booking only (Gateway không đăng ký prefix). Không params/body/header. Vì không phải internal/health, success được wrapper:

```json
{"success":true,"statusCode":200,"data":{"service":"Booking","status":"ok","timestamp":"2026-07-10T10:30:00Z"},"meta":{"traceId":"...","timestamp":"2026-07-10T10:30:00.0000000Z"}}
```

```bash
curl "$INTERNAL_BASE_URL/v1/ping"
```

```js
const ping = await fetch(`${INTERNAL_BASE_URL}/v1/ping`).then(r => r.json());
```

### 10.2 Liveness — `GET /health` và Gateway alias `GET /v1/booking/health`

Anonymous, không dependency checks, raw body `200`:

```json
{"status":"ok","service":"Booking"}
```

```bash
curl "$INTERNAL_BASE_URL/health"
curl "$BASE_URL/v1/booking/health"
```

```js
const health = await fetch(`${BASE_URL}/v1/booking/health`).then(r => r.json());
```

### 10.3 Readiness — `GET /ready`

Direct only. Chạy probes có tag `ready`: Postgres luôn có vì connection string cấu hình; Redis/RabbitMQ chỉ được đăng ký nếu `REDIS_HOST`/`RABBITMQ_HOST` tồn tại. Status HTTP do HealthChecks middleware quyết định (`200` Healthy, mặc định `503` Unhealthy/Degraded).

```json
{"status":"healthy","service":"Booking","totalDurationMs":12.34,"checks":[{"name":"postgres","status":"healthy","durationMs":10.5,"description":null,"error":null}]}
```

Mỗi check có `name,status,durationMs,description,error`; các field cuối nullable.

```bash
curl "$INTERNAL_BASE_URL/ready"
```

```js
const readyResponse = await fetch(`${INTERNAL_BASE_URL}/ready`);
const readiness = await readyResponse.json();
```

## 11. Flow và lưu ý tích hợp

1. Login/refresh tại Identity để có RS256 access token; hoàn tất phone profile trước khi passenger gọi Booking.
2. Search/select trip tại Trip Service, giữ `tripId` và seat numbers.
3. Có thể preview `/v1/vouchers/available`; checkout vẫn là nguồn quyết định cuối vì availability có thể đổi.
4. Gọi create booking với một Idempotency-Key ổn định cho một intent. Không tái dùng key cho body khác.
5. WALLET có thể trả `CONFIRMED` ngay. VNPAY có `paymentRedirectUrl`; mở URL và chờ payment event xác nhận booking. Booking API hiện không có GET history/detail dành cho passenger trong source code.
6. Cancel refund bất đồng bộ; response chỉ là preview, không chứng minh ví đã được credit.
7. Edit pickup/dropoff chỉ booking CONFIRMED và trước departure ít nhất 2 giờ; pickup chỉ cho price-neutral.
8. QR scan không tự tick boarded; sau scan phải gọi endpoint tick passenger riêng với Idempotency-Key.
9. Voucher operator-created luôn `OPERATOR_FUNDED`; voucher admin `OPERATOR_FUNDED` cần consent theo operator.
10. Rate limit: Gateway cấu hình `120 request/60s` qua Nest Throttler, nhưng proxy Booking được gắn dạng raw Express middleware trước Nest router/guard. Theo luồng code hiện tại, không có bằng chứng ThrottlerGuard chạy trên các request proxy Booking. Không giả định Booking endpoints bị rate limit; ⚠️ TODO: cần xác nhận bằng integration test production nếu hạ tầng reverse proxy ngoài code có limit riêng.

### Checklist rà soát đã thực hiện

- Đối chiếu toàn bộ 15 controller Booking và hai health endpoints được map ngoài controller.
- Đối chiếu 39 OpenAPI operations production với route/method trong source; không thấy route controller lệch.
- Đối chiếu request DTO, FluentValidation, handler business checks, domain exceptions, response records và global filters.
- Đối chiếu Gateway prefix ordering, JWT verification/signing, RBAC/phone gate, proxy errors và environment defaults.
- Phân biệt chính xác success wrapper client, raw internal success, explicit internal tracking wrapper, 204 và raw health response.
