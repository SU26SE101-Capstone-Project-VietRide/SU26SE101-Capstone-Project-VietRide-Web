# Parcel API — Hướng dẫn tích hợp Frontend/Mobile/Admin

> Được audit từ routes, controllers, request records, FluentValidation, handlers, domain enums, middleware và env trên source ngày 2026-08-12. Các giá trị UUID/tên/giá trong JSON là dữ liệu minh họa; tên field và behavior bám đúng code.

## Mục lục

- [Môi trường, auth và envelope](#môi-trường-auth-và-envelope)
- [Idempotency và lỗi chung](#idempotency-và-lỗi-chung)
- [Endpoint inventory](#endpoint-inventory)
- [Location/station hierarchy](#locationstation-hierarchy)
- [Flow Passenger gửi parcel](#flow-passenger-gửi-parcel)
- [Passenger Parcel API](#passenger-parcel-api)
- [Delivery token API](#delivery-token-api)
- [Assistant/Driver operational API](#assistantdriver-operational-api)
- [Operator/Admin Parcel API](#operatoradmin-parcel-api)
- [Request/response schema dùng chung](#requestresponse-schema-dùng-chung)
- [Error code theo nhóm](#error-code-theo-nhóm)
- [Phân công 3 FE agent](#phân-công-3-fe-agent)
- [Checklist](#checklist)

## Môi trường, auth và envelope

| Môi trường | Base URL |
|---|---|
| Production REST | `https://api.vietride.online` |
| Local qua Gateway | `http://localhost:3000` |
| Parcel Service trực tiếp, chỉ debug BE | `http://localhost:5005` |
| Trip Service trực tiếp, chỉ debug location | `http://localhost:5002` |
| Swagger | `https://api.vietride.online/docs` |

FE gọi tất cả public endpoint qua Gateway. Không gọi `/internal/v1/*`, không gửi `X-Internal-Auth`.

Các endpoint có auth dùng:

```http
Authorization: Bearer <accessToken>
```

Access token lấy từ `POST /v1/auth/login`, RS256, mặc định 900 giây. Khi hết hạn, refresh đúng một lần qua `POST /v1/auth/refresh`, rồi retry request gốc một lần.

Success envelope:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "meta": {
    "traceId": "00-...",
    "timestamp": "2026-08-12T16:00:00+07:00"
  }
}
```

Error envelope:

```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more validation errors occurred.",
    "fields": {
      "estimatedWeightKg": ["'Estimated Weight Kg' must be greater than '0'."]
    }
  },
  "meta": {
    "traceId": "00-...",
    "timestamp": "2026-08-12T16:00:00+07:00"
  }
}
```

Quy ước:

- Public JSON dùng `camelCase`.
- Money là integer VND (`int64`), không dùng decimal cho tiền.
- Timestamp public là ISO 8601 có offset `+07:00`; input timestamp phải có `Z`/offset.
- Date-only dùng `YYYY-MM-DD`.
- Pagination dùng `{items,page,pageSize,totalItems,totalPages,hasNextPage,hasPreviousPage}`.
- Gateway rate limit mặc định `120 request / 60 giây / IP / route`.
- Operator role cần claim `operatorStatus=APPROVED`; Passenger cần hoàn tất phone profile, nếu không Gateway trả `AUTH_PHONE_REQUIRED`.

## Idempotency và lỗi chung

Tất cả mutation được đánh dấu idempotency cần:

```http
Idempotency-Key: 2cfb8d76-50eb-4ac4-9e60-15b43d66bb67
```

Key phải là UUID v4, format D 36 ký tự. Một thao tác logical tạo key một lần; retry timeout/network giữ nguyên key và body.

| HTTP | Code | Ý nghĩa |
|---:|---|---|
| 401 | `AUTH_TOKEN_INVALID` | Gateway thiếu/hỏng/hết hạn token |
| 403 | `FORBIDDEN` | Sai role/scope/ownership |
| 403 | `AUTH_PHONE_REQUIRED` | Passenger chưa có phone profile |
| 403 | `OPERATOR_SUSPENDED` | Operator bị suspend |
| 409 | `IDEMPOTENCY_REQUEST_PENDING` | Cùng request đang xử lý |
| 422 | `IDEMPOTENCY_KEY_REQUIRED` | Thiếu header |
| 422 | `VALIDATION_ERROR` | Key sai UUID v4 hoặc request validation lỗi |
| 422 | `IDEMPOTENCY_KEY_MISMATCH` | Tái dùng key cho request khác |
| 429 | `RATE_LIMITED` | Vượt rate limit |
| 500 | `INTERNAL_ERROR` | Exception không được map |
| 503 | `UPSTREAM_UNAVAILABLE` | Gateway/downstream không sẵn sàng |

## Endpoint inventory

### Location + Passenger

| Method | Path | Role | Mô tả |
|---|---|---|---|
| `GET` | `/v1/locations` | Public | Lấy root/leaf location hierarchy |
| `GET` | `/v1/stations/search` | Public | Search station, hỗ trợ `locationScopeCode` |
| `GET` | `/v1/parcels/available-trips` | Passenger | Search trip có fare/cargo phù hợp và nhận quote |
| `GET` | `/v1/parcels/vouchers/available` | Passenger | Voucher khả dụng cho quote/trip |
| `POST` | `/v1/parcels` | Passenger | Tạo parcel `PENDING_PAYMENT` |
| `POST` | `/v1/parcels/{parcelId}/deposit-payment` | Passenger sender | Bắt đầu thanh toán deposit |
| `POST` | `/v1/parcels/{parcelId}/final-payment` | Passenger sender | Thanh toán balance sau reweigh |
| `GET` | `/v1/parcels/sent` | Passenger | Parcel đã gửi |
| `GET` | `/v1/parcels/received` | Passenger | Parcel được link theo recipient email |
| `GET` | `/v1/parcels/{parcelId}` | Authorized related user/operator | Chi tiết parcel |
| `GET` | `/v1/passenger/history` | Passenger | History ticket/parcel và `trackingTarget` |

### Service diagnostic

| Method | Path | Role | Mô tả |
|---|---|---|---|
| `GET` | `/v1/ping` | Anonymous, BE debug | Ping trực tiếp Parcel Service; không phải route FE qua Gateway |

### Anonymous delivery token

| Method | Path | Auth |
|---|---|---|
| `POST` | `/v1/parcels/delivery/confirm` | Anonymous + token body + idempotency |
| `POST` | `/v1/parcels/delivery/reject` | Anonymous + token body + idempotency |
| `POST` | `/v1/parcels/delivery/undo-reject` | Anonymous + token body + idempotency |

### Assistant/Driver

| Method | Path | Role |
|---|---|---|
| `GET` | `/v1/assistant/trips/{tripId}/parcels` | Assistant |
| `POST` | `/v1/assistant/trips/{tripId}/parcels/qr-scan` | Assistant |
| `POST` | `/v1/assistant/parcels/{parcelId}/load` | Assistant |
| `POST` | `/v1/assistant/parcels/{parcelId}/check-in` | Assistant |
| `POST` | `/v1/assistant/parcels/{parcelId}/reweigh` | Assistant |
| `POST` | `/v1/assistant/parcels/{parcelId}/confirm-delivery` | Assistant |
| `POST` | `/v1/assistant/parcels/{parcelId}/unload` | Assistant |
| `POST` | `/v1/assistant/parcels/{parcelId}/deliver` | Assistant |
| `POST` | `/v1/crew/parcels/{parcelId}/confirm-transfer` | Driver/Assistant |
| `POST` | `/v1/crew/parcels/{parcelId}/manual-confirm` | Driver/Assistant |
| `POST` | `/v1/crew/parcels/{parcelId}/resend-delivery-email` | Driver/Assistant |

### Operator

| Method | Path | Role |
|---|---|---|
| `POST` | `/v1/operator/parcel-route-fares` | Admin |
| `GET` | `/v1/operator/parcel-route-fares` | Admin/Staff |
| `PATCH` | `/v1/operator/parcel-route-fares/{routeId}/{sizeCategory}` | Admin |
| `PUT` | `/v1/operator/parcel-route-fares/{routeId}/batch` | Admin |
| `GET` | `/v1/operator/parcels` | Admin/Staff |
| `GET` | `/v1/operator/parcels/{parcelId}` | Admin/Staff |
| `GET` | `/v1/operator/parcels/reports/summary` | Admin/Staff |
| `GET` | `/v1/operator/parcels/reports/export` | Admin/Staff |
| `PATCH` | `/v1/operator/parcels/{parcelId}/review` | Admin/Staff |
| `POST` | `/v1/operator/parcels/{parcelId}/request-transfer` | Admin/Staff |
| `POST` | `/v1/operator/parcels/{parcelId}/return` | Admin/Staff |
| `POST` | `/v1/operator/parcels/{parcelId}/cancel` | Admin/Staff |
| `POST` | `/v1/operator/parcels/{parcelId}/confirm-refund` | Admin/Staff |
| `POST` | `/v1/operator/parcels/{parcelId}/override-capacity` | Admin hoặc user có permission `CAN_OVERRIDE_CAPACITY` |
| `POST` | `/v1/operator/parcels/{parcelId}/confirm-delivery` | Admin/Staff |
| `POST` | `/v1/operator/parcels/{parcelId}/manual-confirm` | Admin/Staff |
| `POST` | `/v1/operator/parcels/{parcelId}/resend-delivery-email` | Admin/Staff |
| `PATCH` | `/v1/operator/parcels/{parcelId}/status` | Admin/Staff |
| `GET` | `/v1/operator/parcel-stats` | Admin |
| `GET` | `/v1/operator/reports/parcels/export` | Admin/Staff |

## Location/station hierarchy

### 1. List locations

`GET /v1/locations` — public.

Query:

| Field | Kiểu | Bắt buộc | Hành vi |
|---|---|---:|---|
| `parentCode` | string | Không | Thiếu: trả active top-level; có: parent phải active và top-level, trả active direct children |
| `search` | string | Không | Accent-insensitive contains trên `code` hoặc `name` |
| `type` | string | Không | Case-insensitive: `PROVINCE`, `MUNICIPALITY`, `WARD`, `COMMUNE`, `SPECIAL_ZONE` |

Kết quả order `sortOrder`, rồi `name`.

```bash
curl "https://api.vietride.online/v1/locations?parentCode=79&search=phuong"
```

```js
const response = await fetch(`${API}/v1/locations?parentCode=79`);
const body = await response.json();
```

Response `200`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "60000000-0000-4000-8000-000000000001",
      "code": "79123",
      "name": "Phường Bến Thành",
      "type": "WARD",
      "parentId": "60000000-0000-4000-8000-000000000000",
      "parentCode": "79",
      "parentName": "Thành phố Hồ Chí Minh",
      "isActive": true,
      "sortOrder": 10,
      "createdAt": "2026-08-12T08:00:00+07:00",
      "updatedAt": "2026-08-12T08:00:00+07:00"
    }
  ],
  "meta": { "traceId": "00-...", "timestamp": "2026-08-12T16:00:00+07:00" }
}
```

`422 VALIDATION_ERROR`: type không hỗ trợ; `parentCode` không tồn tại/inactive/không phải root.

### 2. Search stations

`GET /v1/stations/search` — public.

Phải có ít nhất một trong `q`, `city`, `ward`, `locationId`, `locationScopeCode`.

| Field | Kiểu | Bắt buộc | Rule |
|---|---|---:|---|
| `q` | string | Có điều kiện | Name contains, accent-insensitive |
| `city` | string | Có điều kiện | Exact sau trim |
| `ward` | string | Có điều kiện | Exact sau trim |
| `locationId` | UUID | Có điều kiện | Exact location ID, không mở rộng hierarchy |
| `locationScopeCode` | string | Có điều kiện | Regex đúng 2 hoặc 5 digit; không được đi cùng `locationId` |

`locationScopeCode` semantics:

- Root code 2 digit: stations gắn trực tiếp root **và** stations thuộc active direct leaf.
- Leaf code 5 digit: exact leaf.
- Unknown, inactive hoặc hierarchy type không khớp length → `422 VALIDATION_ERROR`.
- `q`, `city`, `ward` tiếp tục narrow kết quả sau scope.
- Không có pagination và repository không khai báo ordering cho station search; FE không được phụ thuộc vào thứ tự trả về.

```bash
curl "https://api.vietride.online/v1/stations/search?locationScopeCode=79&q=ben%20xe"
```

```js
const qs = new URLSearchParams({ locationScopeCode: rootCode, q: keyword });
const response = await fetch(`${API}/v1/stations/search?${qs}`);
const body = await response.json();
```

Response item:

```json
{
  "id": "20000000-0000-4000-8000-000000000001",
  "name": "Bến xe Miền Tây",
  "locationId": "60000000-0000-4000-8000-000000000001",
  "city": "Thành phố Hồ Chí Minh",
  "ward": "Phường An Lạc",
  "latitude": 10.7408,
  "longitude": 106.6183,
  "addressStreet": "395 Kinh Dương Vương",
  "supportsShuttle": true
}
```

`locationId`, `ward`, tọa độ, `addressStreet` nullable.

### 3. Parcel Service ping — chỉ dùng khi debug BE

`GET /v1/ping`

Endpoint này nằm trong Parcel Service và không cần header, path/query param hay body. Nó không được khai báo thành route public riêng trong Gateway; FE không dùng `https://api.vietride.online/v1/ping`. Khi debug service local, gọi trực tiếp `http://localhost:5005/v1/ping`.

```bash
curl "http://localhost:5005/v1/ping"
```

```js
const response = await fetch('http://localhost:5005/v1/ping');
const ping = await response.json();
```

Response `200` là JSON raw, không bọc `ApiResponse`:

```json
{
  "service": "Parcel",
  "status": "ok",
  "timestamp": "2026-08-12T07:30:00.0000000Z"
}
```

Controller không có nhánh lỗi nghiệp vụ riêng; lỗi kết nối/service không chạy là lỗi hạ tầng, không có `error.code` từ endpoint này.

## Flow Passenger gửi parcel

1. Gọi `/v1/locations`, sau đó `/v1/stations/search?locationScopeCode=...`; giữ `station.id` để search trip.
2. Gọi `/v1/parcels/available-trips` với dimensions + weight. Dùng `estimatedSizeCategory`, giá/deposit và `quoteToken` từ BE.
3. Nếu cần voucher, gọi `/v1/parcels/vouchers/available` với `quoteToken`.
4. Gọi `POST /v1/parcels` với cùng trip/station-derived inputs, dimensions, weight, category và token. `quoteToken` optional trong rollout hiện tại nhưng nên gửi khi có.
5. Create thành công mới chỉ ở `PENDING_PAYMENT`; gọi deposit-payment riêng.
6. Với `WALLET`, xử lý ngay response. Với `VNPAY`, Mobile bắt buộc `paymentReturnMode: "MOBILE_SDK"`; dùng `vnpaySdk`, không dựa vào web return URL.
7. Sau crew check-in/reweigh, nếu status thành `PENDING_FINAL_PAYMENT`, gọi final-payment trước deadline.
8. Theo dõi `/sent`, `/received`, detail và Tracking API bằng `tripId` + target phù hợp.

BE tự liên kết người nhận:

- FE chỉ gửi `recipient.email`, không có field public `recipientUserId`.
- BE trim/lowercase và lookup exact non-deleted Identity user.
- Không tìm thấy/deleted → lưu `recipientUserId: null`, create vẫn thành công.
- Identity transport/5xx/shape sai → `503 UPSTREAM_UNAVAILABLE`, không tạo parcel dở dang.
- Khi link thành công, recipient thấy parcel trong `/received`, được authorize tracking và nhận notification.

## Passenger Parcel API

### 1. Available trips + quote

`GET /v1/parcels/available-trips` — role `PASSENGER`.

Query:

| Field | Kiểu | Bắt buộc | Validation/default |
|---|---|---:|---|
| `originStationId` | UUID | Có | non-empty |
| `destinationStationId` | UUID | Có | non-empty |
| `departureDate` | date | Có | `YYYY-MM-DD`, non-default |
| `lengthCm` | decimal | Có | `>0` |
| `widthCm` | decimal | Có | `>0` |
| `heightCm` | decimal | Có | `>0` |
| `estimatedWeightKg` | decimal | Có | `>0` |
| `sizeCategory` | string | Không | Nếu có: case-insensitive enum `SMALL|MEDIUM|LARGE|EXTRA_LARGE` |
| `page` | int | Không | `1`, `>=1` |
| `pageSize` | int | Không | `20`, `1..100` |

Category canonical được BE tính từ `chargeableWeightKg = max(weightKg, length*width*height/DIM factor)`:

- `<=5`: `SMALL`
- `<=15`: `MEDIUM`
- `<=30`: `LARGE`
- `>30`: `EXTRA_LARGE`

`sizeCategory` query không điều khiển phép tính canonical trong handler; FE phải tin `estimatedSizeCategory` response.

```bash
curl "https://api.vietride.online/v1/parcels/available-trips?originStationId=$ORIGIN_ID&destinationStationId=$DESTINATION_ID&departureDate=2026-08-13&lengthCm=40&widthCm=30&heightCm=25&estimatedWeightKg=8&page=1&pageSize=20" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const qs = new URLSearchParams({
  originStationId, destinationStationId, departureDate: '2026-08-13',
  lengthCm: '40', widthCm: '30', heightCm: '25', estimatedWeightKg: '8',
  page: '1', pageSize: '20',
});
const result = await api(`/v1/parcels/available-trips?${qs}`, { token: accessToken });
```

Response `200` item:

```json
{
  "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
  "routeId": "10000000-0000-4000-8000-000000000001",
  "status": "SCHEDULED",
  "operatorId": "70000000-0000-4000-8000-000000000001",
  "operatorName": "VietRide Express",
  "originStation": { "id": "20000000-0000-4000-8000-000000000001", "name": "Bến xe Miền Tây" },
  "destinationStation": { "id": "20000000-0000-4000-8000-000000000002", "name": "Bến xe Cần Thơ" },
  "departureDateTime": "2026-08-13T08:00:00+07:00",
  "estimatedArrivalTime": "2026-08-13T12:00:00+07:00",
  "estimatedPriceVnd": 180000,
  "depositPercent": 20,
  "estimatedDepositVnd": 36000,
  "quoteToken": "<opaque-payload.signature>",
  "quoteExpiresAt": "2026-08-12T16:10:00+07:00",
  "estimatedSizeCategory": "MEDIUM",
  "estimatedGrossPriceVnd": 180000,
  "estimatedDiscountVnd": 0
}
```

Response bọc trong PagedResult. Fare-ineligible routes được loại trước count/pagination; order Trip là `departureDateTime`, rồi `tripId`. Route eligible rỗng trả page rỗng hợp lệ. Quote TTL default 600 giây.

Errors: `422 VALIDATION_ERROR`; `404 OPERATOR_NOT_FOUND`; `503 TRIP_SEARCH_UNAVAILABLE`, `OPERATOR_LOOKUP_UNAVAILABLE`; auth/common errors.

### 2. Available vouchers

`GET /v1/parcels/vouchers/available` — Passenger.

| Query | Kiểu | Bắt buộc | Rule |
|---|---|---:|---|
| `tripId` | UUID | Có | Trip tồn tại |
| `sizeCategory` | string | Có | Enum case-insensitive |
| `paymentMethod` | string | Không | Chuyển tiếp Booking voucher lookup |
| `orderAmount` | int64 | Không | Legacy; nếu có token phải bằng token `estimatedGrossPriceVnd` |
| `quoteToken` | string | Không | Opaque token từ available-trips |

```bash
curl --get "https://api.vietride.online/v1/parcels/vouchers/available" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode "tripId=$TRIP_ID" \
  --data-urlencode "sizeCategory=MEDIUM" \
  --data-urlencode "paymentMethod=WALLET" \
  --data-urlencode "quoteToken=$QUOTE_TOKEN"
```

```js
const qs = new URLSearchParams({ tripId, sizeCategory, paymentMethod, quoteToken });
const vouchers = (await api(`/v1/parcels/vouchers/available?${qs}`, { token: accessToken })).data;
```

Response item:

```json
{
  "id": "80000000-0000-4000-8000-000000000001",
  "code": "PARCEL20",
  "name": "Giảm parcel",
  "type": "FIXED_AMOUNT",
  "value": 20000,
  "minOrderAmount": 100000,
  "maxDiscountAmount": null,
  "discountAmount": 20000,
  "applicableServices": ["PARCEL"],
  "applicablePaymentMethods": ["WALLET", "VNPAY"],
  "validUntil": "2026-08-31T23:59:59+07:00"
}
```

Errors từ handler: `422 INVALID_SIZE_CATEGORY`, `404 TRIP_NOT_FOUND`, `503 TRIP_SERVICE_UNAVAILABLE`; quote errors `409 PARCEL_QUOTE_INVALID|PARCEL_QUOTE_EXPIRED|PARCEL_QUOTE_STALE|PARCEL_QUOTE_MISMATCH`.

### 3. Create parcel

`POST /v1/parcels` — Passenger, `Idempotency-Key` bắt buộc.

Body đầy đủ:

```json
{
  "tripId": "7bfeff50-34df-4662-8625-ad36947d1474",
  "dropoffStopId": null,
  "bookingId": null,
  "itemName": "Tài liệu",
  "description": "Không gấp",
  "sizeCategory": "MEDIUM",
  "lengthCm": 40,
  "widthCm": 30,
  "heightCm": 25,
  "estimatedWeightKg": 8,
  "photoUrl": null,
  "recipient": {
    "fullName": "Trần Thị B",
    "phoneNumber": "0901234567",
    "email": "recipient@example.com"
  },
  "deliveryMethod": "TERMINAL_PICKUP",
  "paymentMethod": "WALLET",
  "voucherCode": null,
  "quoteToken": "<token-from-available-trips>"
}
```

Validation:

- `tripId` non-empty; Trip phải `SCHEDULED` hoặc `BOARDING`.
- `recipient.fullName`: required, max 255; `phoneNumber`: required, max 20 và còn đi qua `PhoneNumber.Normalize`; `email`: optional, email format, max 255.
- `sizeCategory`: required enum; dimensions/weight đều `>0`. Khi có quote token, request dimensions, weight, category, sender, trip/route/operator/station pair phải khớp token.
- `deliveryMethod` case-sensitive và hiện chỉ `TERMINAL_PICKUP`.
- `paymentMethod` case-sensitive `WALLET|VNPAY`.
- `description` max 2000; `itemName` không có FluentValidation max riêng. Handler ghép `itemName + "\n" + description` nếu cả hai có.
- `photoUrl`: optional; phải là owned Firebase URL dưới prefix `parcels/{senderUserId}/`.
- `quoteToken`: optional, max 16384.
- `dropoffStopId`: nếu có phải thuộc trip và `allowDropoff=true`.
- `bookingId`: nếu có phải thuộc sender, cùng trip, status `CONFIRMED`, có active ticket.

```bash
curl -X POST "https://api.vietride.online/v1/parcels" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 60cb1c88-a844-46c5-9f62-8e10af85c84d" \
  -d @parcel-create.json
```

```js
const created = await api('/v1/parcels', {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(), body: createPayload,
});
```

Response `201`:

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "parcelId": "90000000-0000-4000-8000-000000000001",
    "parcelCode": "VR-PCL-20260812-ABCDEFGH",
    "status": "PENDING_PAYMENT",
    "estimatedSizeCategory": "MEDIUM",
    "estimatedGrossPriceVnd": 180000,
    "discountAmountVnd": 0,
    "estimatedTotalPriceVnd": 180000,
    "depositPercent": 20,
    "depositRequiredVnd": 36000,
    "depositPaidVnd": 0,
    "voucherCode": null,
    "settlementPolicyVersion": 2
  },
  "meta": { "traceId": "00-...", "timestamp": "2026-08-12T16:00:00+07:00" }
}
```

Deposit cố định 20% của total sau discount theo settlement policy v2. Operator pricing-policy row không thay đổi percent này.

Errors chính:

- 402: `SUBSCRIPTION_EXPIRED` — operator subscription đã `EXPIRED` hoặc `CANCELLED`.
- 403: `USER_FORBIDDEN`, `USER_NOT_PASSENGER`, `USER_INACTIVE`, `BOOKING_NOT_OWNED_BY_SENDER`, `SUBSCRIPTION_MODULE_DISABLED`.
- 404: `USER_NOT_FOUND`, `BOOKING_NOT_FOUND`, `TRIP_NOT_FOUND`, `RESOURCE_NOT_FOUND` khi không có operator subscription.
- 409: `BOOKING_NOT_FOR_THIS_TRIP`, `BOOKING_NOT_ATTACHABLE`, `TRIP_NOT_ACCEPTING_PARCEL`, `PARCEL_CHECK_IN_CLOSED`, `PARCEL_CODE_COLLISION`, quote errors.
- 422: `VALIDATION_ERROR`, `VALIDATION_FAILED`, `DROP_OFF_STOP_NOT_FOUND`, `DROP_OFF_STOP_NOT_ALLOWED`, `INVALID_DELIVERY_METHOD`, `INVALID_SIZE_CATEGORY`, `FARE_NOT_CONFIGURED`, `VOUCHER_NOT_APPLICABLE`.
- 503: `UPSTREAM_UNAVAILABLE`, `BOOKING_SERVICE_UNAVAILABLE`, `TRIP_SERVICE_UNAVAILABLE`.

Quote error mapping:

| HTTP | Code | Xử lý FE |
|---:|---|---|
| 409 | `PARCEL_QUOTE_INVALID` | Không retry token; search trip lại |
| 409 | `PARCEL_QUOTE_EXPIRED` | Search trip lại; TTL default 600s |
| 409 | `PARCEL_QUOTE_STALE` | Fare/DIM/settlement policy đổi; search lại |
| 409 | `PARCEL_QUOTE_MISMATCH` | Payload FE không khớp quote; sửa state hoặc search lại |

### 4. Deposit payment

`POST /v1/parcels/{parcelId}/deposit-payment` — Passenger sender, idempotency.

Body:

```json
{ "paymentMethod": "VNPAY", "paymentReturnMode": "MOBILE_SDK" }
```

`paymentMethod` case-sensitive `WALLET|VNPAY`. Với `VNPAY`, thiếu return mode → `426 MOBILE_APP_UPDATE_REQUIRED`; khác `MOBILE_SDK` → `422 PAYMENT_RETURN_MODE_INVALID`. Với `WALLET`, `paymentReturnMode` được bỏ qua.

```bash
curl -X POST "https://api.vietride.online/v1/parcels/$PARCEL_ID/deposit-payment" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 9919cac0-ca88-4709-8609-caf5f403597c" \
  -d '{"paymentMethod":"VNPAY","paymentReturnMode":"MOBILE_SDK"}'
```

```js
const payment = await api(`/v1/parcels/${parcelId}/deposit-payment`, {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(),
  body: { paymentMethod: 'VNPAY', paymentReturnMode: 'MOBILE_SDK' },
});
```

Response `200`:

```json
{
  "parcelId": "90000000-0000-4000-8000-000000000001",
  "status": "PENDING_PAYMENT",
  "depositPaymentId": "91000000-0000-4000-8000-000000000001",
  "depositRequiredVnd": 36000,
  "depositPaidVnd": 0,
  "paymentDueAt": "2026-08-12T16:15:00+07:00",
  "paymentRedirectUrl": null,
  "paymentReturnMode": "MOBILE_SDK",
  "vnpaySdk": { "tmnCode": "...", "scheme": "...", "isSandbox": true }
}
```

Object trên nằm trong `data`. Zero-deposit có thể activate ngay với `depositPaymentId/paymentDueAt/paymentRedirectUrl=null`.

Errors: `403 FORBIDDEN`; `404 PARCEL_NOT_FOUND`; `409 INVALID_STATUS|PAYMENT_ALREADY_STARTED|PARCEL_CHECK_IN_CLOSED|RACE_LOST|TRIP_CARGO_CAPACITY_EXCEEDED|PARCEL_CARGO_RECOVERY_IN_PROGRESS`; `422 INSUFFICIENT_FUNDS|VOUCHER_NOT_APPLICABLE|PAYMENT_RETURN_MODE_INVALID`; `426 MOBILE_APP_UPDATE_REQUIRED`; `503 PAYMENT_SERVICE_ERROR|VNPAY_MOBILE_SDK_DISABLED|BOOKING_SERVICE_UNAVAILABLE|TRIP_SERVICE_UNAVAILABLE|TRIP_NOT_FOUND`. `TRIP_NOT_FOUND` được nhánh cargo reservation map thành lỗi dependency 503.

Nếu payment start lỗi sau reserve cargo, BE thử release đồng bộ; Trip tạm lỗi thì ghi durable RELEASE để retry. FE không tự gọi internal cargo release.

### 5. Final payment

`POST /v1/parcels/{parcelId}/final-payment` — Passenger sender, idempotency. Body/return mode giống deposit.

```bash
curl -X POST "https://api.vietride.online/v1/parcels/$PARCEL_ID/final-payment" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 8dc86fd0-31cd-4884-8375-a02ca4c77f1e" \
  -d '{"paymentMethod":"WALLET","paymentReturnMode":null}'
```

```js
await api(`/v1/parcels/${parcelId}/final-payment`, {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(),
  body: { paymentMethod: 'WALLET', paymentReturnMode: null },
});
```

Response data:

```json
{
  "parcelId": "90000000-0000-4000-8000-000000000001",
  "status": "PENDING_FINAL_PAYMENT",
  "balancePaymentId": "91000000-0000-4000-8000-000000000002",
  "balanceRequiredVnd": 24000,
  "balancePaidVnd": 0,
  "finalPaymentDeadline": "2026-08-13T07:20:00+07:00",
  "paymentRedirectUrl": null,
  "paymentReturnMode": null,
  "vnpaySdk": null
}
```

Errors: `403 FORBIDDEN`; `404 PARCEL_NOT_FOUND`; `409 INVALID_STATUS|PAYMENT_ALREADY_STARTED|FINAL_PAYMENT_DEADLINE_PASSED|BALANCE_ALREADY_PAID|RACE_LOST`; `422 INSUFFICIENT_FUNDS|PAYMENT_RETURN_MODE_INVALID`; `426 MOBILE_APP_UPDATE_REQUIRED`; `503 PAYMENT_SERVICE_ERROR|VNPAY_MOBILE_SDK_DISABLED`.

### 6. Sent, received, detail, history

#### `GET /v1/parcels/sent`

Query `status?` case-insensitive toàn bộ `ParcelStatus`; `from?`/`to?` RFC3339 timestamp, `from<=to`; `page=1`, `pageSize=20`, range 1..100.

```bash
curl "https://api.vietride.online/v1/parcels/sent?status=IN_TRANSIT&page=1&pageSize=20" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const sent = await api('/v1/parcels/sent?status=IN_TRANSIT&page=1&pageSize=20', { token: accessToken });
```

Item: `{parcelId,parcelCode,tripId,status,createdAt,totalAmount,originName?,destinationName?,departureDateTime?,estimatedArrivalTime?,bookingId?,recipientName,sizeCategory,photoUrl?,deliveryMethod}`. Query lỗi → `422 VALIDATION_ERROR`.

#### `GET /v1/parcels/received`

Query `page=1`, `pageSize=20`, validation 1..100. Chỉ parcel có `recipientUserId` bằng JWT user mới xuất hiện.

```bash
curl "https://api.vietride.online/v1/parcels/received?page=1&pageSize=20" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const received = await api('/v1/parcels/received?page=1&pageSize=20', { token: accessToken });
```

Item: `{parcelId,parcelCode,status,originStation?,destinationStation?,eta?,senderUserId,recipientName?,sizeCategory,createdAt,operatorId,tripId}`. `eta` ở đây là Trip static `estimatedArrivalTime`, không phải dynamic Tracking ETA. Trip lookup lỗi/not-found được handler bỏ qua và station/eta trở thành null; controller Swagger liệt kê 503 nhưng handler hiện không ném 503 cho từng lookup này.

#### `GET /v1/parcels/{parcelId}`

Authorized nếu caller là sender, linked recipient hoặc cùng operator.

```bash
curl "https://api.vietride.online/v1/parcels/$PARCEL_ID" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const detail = await api(`/v1/parcels/${parcelId}`, { token: accessToken });
```

Response `ParcelDetailResponse` được liệt kê đầy đủ ở phần schema. Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`. `originStationName`, `destinationStationName`, `eta` chỉ được điền nếu Trip snapshot lookup thành công; `eta` là static trip arrival.

#### `GET /v1/passenger/history`

| Query | Rule |
|---|---|
| `type` | Required thực tế; `TICKET|PARCEL`, case-insensitive |
| `status` | Optional; phải hợp lệ theo type |
| `from`,`to` | Optional RFC3339, ordered |
| `page`,`pageSize` | `1`, `20`; page >=1, size 1..100 |

```bash
curl "https://api.vietride.online/v1/passenger/history?type=PARCEL&page=1&pageSize=20" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const history = await api('/v1/passenger/history?type=PARCEL&page=1&pageSize=20', { token: accessToken });
```

Item: `{type,id,code,tripId,status,createdAt,totalAmount,originName?,destinationName?,departureDateTime?,estimatedArrivalTime?,ticket?,parcel?,paymentRedirectUrl?,trackingTarget?}`. Với `type=TICKET`, `ticket` là `{bookingGroupId?,tripDirection?,routeName?,tickets}` và mỗi item `tickets` là `{ticketId,ticketCode,seatNumber,status,paidAmount}`. `trackingTarget` shape `{kind,stopId?,stationId?}` dùng để chọn Dynamic ETA. Errors `422 VALIDATION_ERROR`, upstream ticket history có thể `502`.

## Delivery token API

Ba endpoint này `[AllowAnonymous]`: không cần Bearer, nhưng cần delivery token UUID trong body và `Idempotency-Key` UUID v4. Không đặt delivery token trong URL/query.

### 1. Confirm

`POST /v1/parcels/delivery/confirm`

```json
{ "token": "92000000-0000-4000-8000-000000000001" }
```

```bash
curl -X POST "https://api.vietride.online/v1/parcels/delivery/confirm" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: a7c20fbe-2e40-4515-8661-8b716bcd796a" \
  -d '{"token":"92000000-0000-4000-8000-000000000001"}'
```

```js
await api('/v1/parcels/delivery/confirm', {
  method: 'POST', idempotencyKey: crypto.randomUUID(), body: { token },
});
```

Response data:

```json
{
  "parcelId": "90000000-0000-4000-8000-000000000001",
  "status": "DELIVERY_CONFIRMED",
  "confirmedAt": "2026-08-13T12:10:00+07:00"
}
```

### 2. Reject

`POST /v1/parcels/delivery/reject`

`rejectionReason` sau trim bắt buộc 1..500.

```bash
curl -X POST "https://api.vietride.online/v1/parcels/delivery/reject" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 731e0a39-e726-4e52-9217-a36df4ebddf2" \
  -d '{"token":"92000000-0000-4000-8000-000000000001","rejectionReason":"Kiện hàng bị móp"}'
```

```js
await api('/v1/parcels/delivery/reject', {
  method: 'POST', idempotencyKey: crypto.randomUUID(),
  body: { token, rejectionReason: reason.trim() },
});
```

Response data:

```json
{
  "parcelId": "90000000-0000-4000-8000-000000000001",
  "status": "DELIVERY_REJECTED",
  "rejectedAt": "2026-08-13T12:10:00+07:00",
  "canUndoUntil": "2026-08-13T12:25:00+07:00"
}
```

### 3. Undo reject

`POST /v1/parcels/delivery/undo-reject`

Chỉ trong 15 phút kể từ `rejectedAt`.

```bash
curl -X POST "https://api.vietride.online/v1/parcels/delivery/undo-reject" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 7ee16294-7387-48ca-b5b3-49316a25aadb" \
  -d '{"token":"92000000-0000-4000-8000-000000000001"}'
```

```js
await api('/v1/parcels/delivery/undo-reject', {
  method: 'POST', idempotencyKey: crypto.randomUUID(), body: { token },
});
```

Response data: `{ "parcelId": "...", "status": "DELIVERED_PENDING_CONFIRM", "undoneAt": "...+07:00" }`.

Delivery errors:

| HTTP | Code | Nguyên nhân |
|---:|---|---|
| 400 | `PARCEL_DELIVERY_TOKEN_INVALID` | Token không tồn tại hoặc parcel không còn tồn tại |
| 400 | `PARCEL_DELIVERY_TOKEN_EXPIRED` | Token hết hạn |
| 400 | `PARCEL_DELIVERY_TOKEN_REVOKED` | Token bị revoke |
| 400 | `PARCEL_NOT_PENDING_CONFIRM` | Confirm/reject khi parcel không ở `DELIVERED_PENDING_CONFIRM` |
| 400 | `PARCEL_NOT_DELIVERY_REJECTED` | Undo khi status không phải `DELIVERY_REJECTED` |
| 400 | `PARCEL_DELIVERY_REJECTED_WINDOW_EXPIRED` | Quá cửa sổ undo 15 phút |
| 409 | `RACE_LOST` | Status bị thay đổi đồng thời |
| 422 | `VALIDATION_ERROR` | Token/key/reason invalid |
| 429 | `RATE_LIMITED` | Quá nhiều lần thử theo token hash; code có 429 dù một số Swagger annotation chưa liệt kê |

## Assistant/Driver operational API

### Quy ước chung

- `/v1/assistant/*`: chỉ `ASSISTANT`, token phải có `operatorId`.
- `/v1/crew/*`: `DRIVER` hoặc `ASSISTANT`; handler còn kiểm tra crew assignment/scope theo trip.
- Tất cả mutation bên dưới cần `Idempotency-Key`, trừ QR scan là read-only và cố ý skip idempotency.
- Photo evidence tối đa 3 URL, phải là owned Firebase object dưới `parcel-ops/{operatorId}/{uploaderUserId}/{parcelId}/`.

### 1. List parcel theo trip

`GET /v1/assistant/trips/{tripId}/parcels`

Query thường dùng: `?page=1&pageSize=20`.

`tripId` UUID; `page>=1`, `pageSize 1..100`.

```bash
curl "https://api.vietride.online/v1/assistant/trips/$TRIP_ID/parcels?page=1&pageSize=20" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const list = await api(`/v1/assistant/trips/${tripId}/parcels?page=1&pageSize=20`, { token: accessToken });
```

Item:

```json
{
  "parcelId": "90000000-0000-4000-8000-000000000001",
  "parcelCode": "VR-PCL-20260812-ABCDEFGH",
  "status": "READY_TO_LOAD",
  "recipientName": "Trần Thị B",
  "recipientPhone": "0901234567",
  "dropoffStopId": null,
  "sizeCategory": "MEDIUM",
  "estimatedSizeCategory": "MEDIUM",
  "actualSizeCategory": "MEDIUM",
  "estimatedWeightKg": 8,
  "actualWeightKg": 8.2,
  "balanceRequiredVnd": 0,
  "balancePaidVnd": 0,
  "finalPaymentDeadline": null,
  "description": "Tài liệu\nKhông gấp",
  "photoUrl": null
}
```

Errors: `403 FORBIDDEN`, `422 VALIDATION_ERROR`, `503 TRIP_SERVICE_UNAVAILABLE`.

### 2. QR scan read-only

`POST /v1/assistant/trips/{tripId}/parcels/qr-scan`, body `{ "parcelCode": "VR-PCL-20260812-ABCDEFGH" }`.

Parcel code regex: `VR-PCL-\d{8}-[A-HJ-NP-Z2-9]{8}` hoặc legacy `VRP-\d{8}-[A-Z0-9]{8}`.

```bash
curl -X POST "https://api.vietride.online/v1/assistant/trips/$TRIP_ID/parcels/qr-scan" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"parcelCode":"VR-PCL-20260812-ABCDEFGH"}'
```

```js
await api(`/v1/assistant/trips/${tripId}/parcels/qr-scan`, {
  method: 'POST', token: accessToken, body: { parcelCode },
});
```

Response data: `{parcelId,parcelCode,status,tripId,recipientName,sizeCategory,photoUrl}`. Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `422 VALIDATION_ERROR`, `503 TRIP_SERVICE_UNAVAILABLE`.

### 3. Check-in

`POST /v1/assistant/parcels/{parcelId}/check-in`

Body `{ "tripId": "<uuid>", "parcelCode": "...", "photoUrls": ["https://..."] }`.

```bash
curl -X POST "https://api.vietride.online/v1/assistant/parcels/$PARCEL_ID/check-in" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: f7085a28-3f92-4188-ad18-5dad663b0a86" \
  -d '{"tripId":"7bfeff50-34df-4662-8625-ad36947d1474","parcelCode":"VR-PCL-20260812-ABCDEFGH","photoUrls":null}'
```

```js
await api(`/v1/assistant/parcels/${parcelId}/check-in`, {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(),
  body: { tripId, parcelCode, photoUrls },
});
```

Response data: `{parcelId,parcelCode,status,checkedInAt,latestCheckInAt}`. Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS|PARCEL_CHECK_IN_CLOSED|RACE_LOST`, `422 VALIDATION_ERROR|VALIDATION_FAILED`, `503 TRIP_SERVICE_UNAVAILABLE`.

### 4. Reweigh

`POST /v1/assistant/parcels/{parcelId}/reweigh`

Body bốn decimal đều `>0`: `actualLengthCm`, `actualWidthCm`, `actualHeightCm`, `actualWeightKg`.

```bash
curl -X POST "https://api.vietride.online/v1/assistant/parcels/$PARCEL_ID/reweigh" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 474b9cbd-347e-4df6-9358-135c6cc68c57" \
  -d '{"actualLengthCm":40,"actualWidthCm":30,"actualHeightCm":25,"actualWeightKg":8.2}'
```

```js
await api(`/v1/assistant/parcels/${parcelId}/reweigh`, {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(), body: actualCargo,
});
```

Response data: `{parcelId,parcelCode,status,actualSizeCategory,actualChargeableWeightKg,finalGrossPriceVnd,discountAmountVnd,finalTotalPriceVnd,depositPaidVnd,balanceRequiredVnd,refundDueVnd,finalPaymentDeadline}`.

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS|PARCEL_LOAD_CUTOFF_PASSED|RACE_LOST`, `422 VALIDATION_ERROR`, `503 TRIP_NOT_FOUND|TRIP_SERVICE_UNAVAILABLE`.

Nếu cargo mới vượt sức chứa, endpoint vẫn trả thành công: Parcel chuyển sang `PENDING_OPERATOR_ACTION` với pending action `CAPACITY_EXCEEDED` để Operator xử lý. Chuỗi `SETTLEMENT_PRICE_DECREASE` chỉ là refund reason/idempotency reference nội bộ, không phải `error.code` trả FE.

### 5. Load

`POST /v1/assistant/parcels/{parcelId}/load`, body `{tripId,parcelCode}`. Request disallow unknown JSON members.

```bash
curl -X POST "https://api.vietride.online/v1/assistant/parcels/$PARCEL_ID/load" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 790d6982-d06b-4cc1-a784-46e302a0831f" \
  -d '{"tripId":"7bfeff50-34df-4662-8625-ad36947d1474","parcelCode":"VR-PCL-20260812-ABCDEFGH"}'
```

```js
await api(`/v1/assistant/parcels/${parcelId}/load`, {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(), body: { tripId, parcelCode },
});
```

Response data `{parcelId,parcelCode,status}`. Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS`, `503 TRIP_CARGO_CAPACITY_EXCEEDED|TRIP_NOT_FOUND|TRIP_SERVICE_UNAVAILABLE`.

### 6. Unload

`POST /v1/assistant/parcels/{parcelId}/unload`, không body.

```bash
curl -X POST "https://api.vietride.online/v1/assistant/parcels/$PARCEL_ID/unload" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: 3b058866-d6e3-4223-a05e-f9f9d83035e4"
```

```js
await api(`/v1/assistant/parcels/${parcelId}/unload`, {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(),
});
```

Response `{parcelId,parcelCode,status}`. Errors: `403 FORBIDDEN`; `404 PARCEL_NOT_FOUND|TRIP_NOT_FOUND`; `409 INVALID_STATUS`; `422 DESTINATION_TERMINAL_NOT_ARRIVED|DROP_OFF_STOP_NOT_ARRIVED|DROP_OFF_STOP_NOT_ALLOWED|DROP_OFF_STOP_NOT_FOUND`; `503 TRIP_CARGO_CAPACITY_EXCEEDED|TRIP_SERVICE_UNAVAILABLE`.

### 7. Deliver

`POST /v1/assistant/parcels/{parcelId}/deliver`; body được phép rỗng hoặc `{ "photoUrls": [...] }`.

```bash
curl -X POST "https://api.vietride.online/v1/assistant/parcels/$PARCEL_ID/deliver" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 5c045507-2ddf-49f7-ad88-4856bdfe88c2" -d '{"photoUrls":null}'
```

```js
await api(`/v1/assistant/parcels/${parcelId}/deliver`, {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(), body: { photoUrls },
});
```

Response `{parcelId,parcelCode,status,deliveredPendingConfirmAt}`. Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS`, `422 VALIDATION_ERROR|VALIDATION_FAILED`, `503 TRIP_SERVICE_UNAVAILABLE`. `VALIDATION_FAILED` là code riêng khi Firebase URL không thuộc object prefix của actor/parcel; các lỗi validation khác dùng `VALIDATION_ERROR`.

### 8. Manual confirm delivery

Hai path cùng command/response:

- `POST /v1/assistant/parcels/{parcelId}/confirm-delivery` — Assistant.
- `POST /v1/crew/parcels/{parcelId}/manual-confirm` — Driver/Assistant.

Body chấp nhận alias `{ "confirmNote": "..." }` hoặc `{ "note": "..." }`; `confirmNote` được ưu tiên; resolved note sau trim bắt buộc và max 500.

```bash
curl -X POST "https://api.vietride.online/v1/crew/parcels/$PARCEL_ID/manual-confirm" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 09a8c2ce-3134-4c54-a903-c849f4b2c4aa" \
  -d '{"confirmNote":"Người nhận xác nhận trực tiếp tại bến"}'
```

```js
await api(`/v1/crew/parcels/${parcelId}/manual-confirm`, {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(),
  body: { confirmNote: note.trim() },
});
```

Ví dụ tương đương cho path Assistant:

```bash
curl -X POST "https://api.vietride.online/v1/assistant/parcels/$PARCEL_ID/confirm-delivery" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 3807192b-03c9-475c-889d-37dbd75d79d8" \
  -d '{"confirmNote":"Người nhận xác nhận trực tiếp tại bến"}'
```

```js
await api(`/v1/assistant/parcels/${parcelId}/confirm-delivery`, {
  method: 'POST',
  token: accessToken,
  idempotencyKey: crypto.randomUUID(),
  body: { confirmNote: note.trim() },
});
```

Response `{parcelId,status,confirmedAt}`. Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `400 PARCEL_NOT_PENDING_CONFIRM`, `409 RESOURCE_CONFLICT`, `422 VALIDATION_ERROR`, `503 TRIP_SERVICE_UNAVAILABLE`.

### 9. Confirm transfer

`POST /v1/crew/parcels/{parcelId}/confirm-transfer`, body `{ "parcelCode": "..." }`.

```bash
curl -X POST "https://api.vietride.online/v1/crew/parcels/$PARCEL_ID/confirm-transfer" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: e1fb9ad8-d108-478a-9183-93d6a98401a8" \
  -d '{"parcelCode":"VR-PCL-20260812-ABCDEFGH"}'
```

```js
await api(`/v1/crew/parcels/${parcelId}/confirm-transfer`, {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(), body: { parcelCode },
});
```

Response `OperationalParcelResponse`. Errors: `403 FORBIDDEN`; `404 PARCEL_NOT_FOUND|TRIP_NOT_FOUND|PARCEL_CARGO_NOT_FOUND`; `409 PARCEL_NOT_TRANSFERABLE|PARCEL_TRANSFER_CONFIRMATION_DEADLINE_PASSED|PARCEL_CARGO_RECOVERY_IN_PROGRESS|TRIP_CARGO_TRANSFER_CONFLICT`; `422 VALIDATION_ERROR|TRIP_CARGO_CAPACITY_EXCEEDED`; `503 TRIP_SERVICE_UNAVAILABLE`.

### 10. Resend delivery email

`POST /v1/crew/parcels/{parcelId}/resend-delivery-email`, không body.

```bash
curl -X POST "https://api.vietride.online/v1/crew/parcels/$PARCEL_ID/resend-delivery-email" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: 7c072cc3-bdcb-41cc-9048-5c173e77b3e9"
```

```js
await api(`/v1/crew/parcels/${parcelId}/resend-delivery-email`, {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(),
});
```

Response `{parcelId,status,expiresAt}`. Errors: `403 FORBIDDEN`; `404 PARCEL_NOT_FOUND`; `400 PARCEL_NOT_PENDING_CONFIRM|PARCEL_DELIVERY_REJECTED_WINDOW_EXPIRED`; `409 RESOURCE_CONFLICT`; `422 PARCEL_RECIPIENT_EMAIL_REQUIRED`; `503 TRIP_SERVICE_UNAVAILABLE`.

## Operator/Admin Parcel API

### Route fares

Active fare window trong pricing code: `effectiveFrom <= pricingAt < effectiveUntil`; `effectiveUntil=null` là open-ended.

#### 1. Create fare

`POST /v1/operator/parcel-route-fares` — Admin, idempotency.

Body: `routeId` UUID; `sizeCategory` enum; `priceVnd >= 1000`; `effectiveFrom` required timestamp; `effectiveUntil` optional nhưng nếu có phải sau from.

```bash
curl -X POST "https://api.vietride.online/v1/operator/parcel-route-fares" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 21c737df-e016-4654-bbcf-e35169d9f98d" \
  -d '{"routeId":"10000000-0000-4000-8000-000000000001","sizeCategory":"MEDIUM","priceVnd":15000,"effectiveFrom":"2026-08-12T00:00:00+07:00","effectiveUntil":null}'
```

```js
await api('/v1/operator/parcel-route-fares', {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(), body: fare,
});
```

Response `201` data `{routeId,sizeCategory,operatorId,priceVnd,effectiveFrom,effectiveUntil,createdAt,updatedAt}`.

Errors: `403 FORBIDDEN`, `404 ROUTE_NOT_FOUND`, `409 FARE_ALREADY_EXISTS`, `422 INVALID_SIZE_CATEGORY|VALIDATION_ERROR`, `503 ROUTE_OWNERSHIP_UNVERIFIABLE`.

#### 2. List fares

`GET /v1/operator/parcel-route-fares`

Query: `routeId?` UUID, `sizeCategory?` case-insensitive enum, `page=1`, `pageSize=20` (1..100).

```bash
curl "https://api.vietride.online/v1/operator/parcel-route-fares?routeId=$ROUTE_ID&page=1&pageSize=20" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
await api(`/v1/operator/parcel-route-fares?routeId=${routeId}&page=1&pageSize=20`, { token: accessToken });
```

Response là PagedResult của fare response. Errors thực tế từ handler: `422 INVALID_SIZE_CATEGORY|VALIDATION_ERROR`, ngoài auth errors; Swagger controller chỉ annotation 403.

#### 3. Update fare

`PATCH /v1/operator/parcel-route-fares/{routeId}/{sizeCategory}` — Admin, idempotency.

Body `{priceVnd?,effectiveFrom?,effectiveUntil?}`; phải có ít nhất một field non-null theo command validator; `priceVnd>=1000`. Nếu cả effectiveFrom/effectiveUntil tạo window không hợp lệ → `422 VALIDATION_ERROR`.

```bash
curl -X PATCH "https://api.vietride.online/v1/operator/parcel-route-fares/$ROUTE_ID/MEDIUM" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 4ca4f851-b61d-4288-8b37-199d174d4af5" -d '{"priceVnd":16000}'
```

```js
await api(`/v1/operator/parcel-route-fares/${routeId}/MEDIUM`, {
  method: 'PATCH', token: accessToken, idempotencyKey: crypto.randomUUID(), body: { priceVnd: 16000 },
});
```

Errors: `404 ROUTE_NOT_FOUND|FARE_NOT_FOUND`, `422 INVALID_SIZE_CATEGORY|VALIDATION_ERROR`, `503 ROUTE_OWNERSHIP_UNVERIFIABLE`.

#### 4. Batch upsert fares

`PUT /v1/operator/parcel-route-fares/{routeId}/batch` — Admin, idempotency.

Body: `effectiveFrom` required; `effectiveUntil` optional và sau from; `items` required 1..4, unique category; mỗi category enum, `priceVnd>0` (batch validator không áp minimum 1000 như create/update).

```json
{
  "effectiveFrom": "2026-08-12T00:00:00+07:00",
  "effectiveUntil": null,
  "items": [
    { "sizeCategory": "SMALL", "priceVnd": 10000 },
    { "sizeCategory": "MEDIUM", "priceVnd": 15000 },
    { "sizeCategory": "LARGE", "priceVnd": 22000 },
    { "sizeCategory": "EXTRA_LARGE", "priceVnd": 30000 }
  ]
}
```

```bash
curl -X PUT "https://api.vietride.online/v1/operator/parcel-route-fares/$ROUTE_ID/batch" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: b917f53c-175d-46e8-956d-d83317f98bad" -d @fare-batch.json
```

```js
await api(`/v1/operator/parcel-route-fares/${routeId}/batch`, {
  method: 'PUT', token: accessToken, idempotencyKey: crypto.randomUUID(), body: batch,
});
```

Response `{routeId,items:[{sizeCategory,priceVnd,effectiveFrom,effectiveUntil,created}]}`. Errors `404 ROUTE_NOT_FOUND`, `422 INVALID_SIZE_CATEGORY|VALIDATION_ERROR`, `503 ROUTE_OWNERSHIP_UNVERIFIABLE`.

### Operator list/detail

#### 1. List

`GET /v1/operator/parcels`

Query:

| Field | Rule |
|---|---|
| `status` | Optional, case-insensitive `ParcelStatus` |
| `tripId` | Optional non-empty UUID |
| `pendingActionType` | Optional: `CAPACITY_EXCEEDED|RESERVE_FAILED|REFUND_CONFIRMATION` |
| `page` | default 1, >=1 |
| `pageSize` | default 20, 1..100 |

```bash
curl "https://api.vietride.online/v1/operator/parcels?status=PENDING_OPERATOR_ACTION&page=1&pageSize=20" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
await api('/v1/operator/parcels?status=PENDING_OPERATOR_ACTION&page=1&pageSize=20', { token: accessToken });
```

Response item fields:

`parcelId`, `parcelCode`, `status`, `tripId`, `senderUserId`, `recipientName`, `recipientPhone`, `estimatedSizeCategory`, `actualSizeCategory?`, `estimatedChargeableWeightKg`, `actualChargeableWeightKg?`, `depositRequiredVnd`, `depositPaidVnd`, `balanceRequiredVnd`, `balancePaidVnd`, `refundDueVnd`, `forfeitedDepositVnd`, `latestCheckInAt?`, `loadCutoffAt?`, `finalPaymentDeadline?`, `pendingActionType?`, `pendingActionReason?`, `photoUrl?`, `createdAt`, `trip?`, `route?`, `sender?`, `recipient?`, `sizeCategory`, `description?`, `estimatedWeightKg`, `actualWeightKg?`, `estimatedVolumeM3`, `actualVolumeM3?`, `estimatedTotalPriceVnd`, `finalTotalPriceVnd`, `discountAmountVnd`, `refundedAmountVnd`, `updatedAt`.

Nested projection: `trip` là `{tripId,status?,departureAt?,arrivalEstimate?,vehicle?}`; `vehicle` là `{vehicleId,licensePlate}`; `sender`/`recipient` là `{userId?,displayName?,phone?}`. Các object này nullable khi upstream projection không có dữ liệu.

Trip/Identity projection lỗi → `503 UPSTREAM_UNAVAILABLE`. Query lỗi → `422 VALIDATION_ERROR`.

#### 2. Detail

`GET /v1/operator/parcels/{parcelId}`; repository query đã scope operator, vì vậy khác tenant/not found cùng `404 PARCEL_NOT_FOUND`.

```bash
curl "https://api.vietride.online/v1/operator/parcels/$PARCEL_ID" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
await api(`/v1/operator/parcels/${parcelId}`, { token: accessToken });
```

Detail gồm toàn bộ list item và thêm:

`operatorId`, `recipientUserId?`, `dropoffStopId?`, `senderEmail?`, `recipientEmail?`, `checkInPhotoUrls?`, `deliveryPhotoUrls?`, `deliveryMethod`, legacy money fields `depositAmount/originalDepositAmount/discountAmount/additionalAmount`, `voucherCode?`, `voucherUsageId?`, full estimated/actual dimensions + DIM weights, `estimatedGrossPriceVnd`, `finalGrossPriceVnd`, `depositPercent`, `depositPaymentId?`, `balancePaymentId?`, `checkedInAt?`, `checkedInByUserId?`, `reweighedAt?`, `reweighedByUserId?`, `pricePerKgVnd`, `minimumPriceVnd`, `dimWeightFactor`, `settlementPolicyVersion`, `loadedAt?`, `loadedByUserId?`, `unloadedAt?`, `deliveredPendingConfirmAt?`, `confirmedAt?`, `confirmedByUserId?`, `rejectedAt?`, `pendingActionResumeStatus?`, `rejectionReason?`, `cancellationReason?`, `reviewDecision?`, `reviewedAt?`, `reviewedByUserId?`, `transferTargetTripId?`, `transferRequestedAt?`, `transferConfirmedAt?`, `transferConfirmedByUserId?`, `returnReason?`, `returnedAt?`, `returnedByUserId?` và `statusHistory[]`.

`statusHistory` item `{status,occurredAt,actorType,actorId?,source,reason?}`, order `occurredAt`, rồi DB id. Errors: `404 PARCEL_NOT_FOUND`, `503 UPSTREAM_UNAVAILABLE`.

### Review và operational actions

Các endpoint này hiện tồn tại trong code dù create settlement v2 trực tiếp tạo `PENDING_PAYMENT`; review chỉ hợp lệ với dữ liệu đang ở `PENDING_OPERATOR_REVIEW`.

#### 1. Review

`PATCH /v1/operator/parcels/{parcelId}/review`, idempotency. Body `{decision:"APPROVED|REJECTED",reason?}`; enum validator case-sensitive, reason required khi `REJECTED`.

```bash
curl -X PATCH "https://api.vietride.online/v1/operator/parcels/$PARCEL_ID/review" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 46884e8b-c932-4418-bfbb-f22a284064e5" -d '{"decision":"REJECTED","reason":"Không nhận loại hàng này"}'
```

```js
await api(`/v1/operator/parcels/${parcelId}/review`, {
  method: 'PATCH', token: accessToken, idempotencyKey: crypto.randomUUID(),
  body: { decision: 'REJECTED', reason },
});
```

Response `{parcelId,parcelCode,status,depositRequiredVnd?}`. Errors `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS|ALREADY_REVIEWED|RACE_LOST`, `422 INVALID_DECISION|FARE_NOT_CONFIGURED|VALIDATION_ERROR`.

#### 2. Request transfer

`POST /v1/operator/parcels/{parcelId}/request-transfer`; body `{targetTripId,reason?}` nhưng handler thực tế trim và bắt buộc reason 1..500. Parcel status chỉ `LOADED|IN_TRANSIT`; target khác current trip và cùng operator.

```bash
curl -X POST "https://api.vietride.online/v1/operator/parcels/$PARCEL_ID/request-transfer" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: a55cb460-6379-45e9-acd6-c3bec2643680" \
  -d '{"targetTripId":"7bfeff50-34df-4662-8625-ad36947d1475","reason":"Xe hiện tại gián đoạn"}'
```

```js
await api(`/v1/operator/parcels/${parcelId}/request-transfer`, {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(),
  body: { targetTripId, reason },
});
```

Errors: `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND|TRIP_NOT_FOUND`, `409 INVALID_STATUS|INVALID_TRANSFER_TARGET|TRIP_CARGO_TRANSFER_CONFLICT|RACE_LOST|PARCEL_CARGO_RECOVERY_IN_PROGRESS`, `422 VALIDATION_ERROR`, `503 TRIP_SERVICE_UNAVAILABLE`.

#### 3. Return / status override

- `POST /v1/operator/parcels/{parcelId}/return`, body `{returnReason}` sau trim 1..500.
- `PATCH /v1/operator/parcels/{parcelId}/status`, body `{targetStatus:"RETURNED",reason}`; chỉ hỗ trợ đúng `RETURNED`, reason required.

```bash
curl -X POST "https://api.vietride.online/v1/operator/parcels/$PARCEL_ID/return" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: ce8a725b-686b-4c93-b911-94f230dcf2da" -d '{"returnReason":"Không thể tiếp tục giao"}'
```

```js
await api(`/v1/operator/parcels/${parcelId}/status`, {
  method: 'PATCH', token: accessToken, idempotencyKey: crypto.randomUUID(),
  body: { targetStatus: 'RETURNED', reason: 'Đã hoàn hàng về bến' },
});
```

```js
await api(`/v1/operator/parcels/${parcelId}/return`, {
  method: 'POST',
  token: accessToken,
  idempotencyKey: crypto.randomUUID(),
  body: { returnReason: 'Không thể tiếp tục giao' },
});
```

```bash
curl -X PATCH "https://api.vietride.online/v1/operator/parcels/$PARCEL_ID/status" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 41989c83-89d1-484b-a52c-8c5ec5e077df" \
  -d '{"targetStatus":"RETURNED","reason":"Đã hoàn hàng về bến"}'
```

Return chỉ chấp nhận status `PENDING_OPERATOR_ACTION|TRANSFER_ESCALATED`. Errors `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS|INVALID_TRANSITION|TRIP_CARGO_TRANSFER_CONFLICT|PARCEL_CARGO_RECOVERY_IN_PROGRESS`, `422 VALIDATION_ERROR`, `503 TRIP_SERVICE_UNAVAILABLE`.

#### 4. Manual cancel

`POST /v1/operator/parcels/{parcelId}/cancel`; body `{reason,refundChoice?}`. Reason trim 1..500. `refundChoice` default `POLICY`; canonical `FULL|POLICY|NO`; aliases `FULL_REFUND|POLICY_REFUND|NO_REFUND` cũng được handler nhận.

```bash
curl -X POST "https://api.vietride.online/v1/operator/parcels/$PARCEL_ID/cancel" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 6200bb70-b99e-47ae-8aae-3d408b877565" \
  -d '{"reason":"Chuyến bị hủy","refundChoice":"FULL"}'
```

```js
await api(`/v1/operator/parcels/${parcelId}/cancel`, {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(),
  body: { reason, refundChoice: 'FULL' },
});
```

Chỉ pre-load statuses theo classifier. Errors `404 PARCEL_NOT_FOUND`, `409 INVALID_STATUS|RACE_LOST`, `422 VALIDATION_ERROR|INVALID_REFUND_CHOICE`, `503 UPSTREAM_UNAVAILABLE|TRIP_SERVICE_UNAVAILABLE|TRIP_CARGO_TRANSFER_CONFLICT`.

#### 5. Confirm refund

`POST /v1/operator/parcels/{parcelId}/confirm-refund`, body `{reason?}`; reason chỉ trim để event, không có validation length trong handler.

```bash
curl -X POST "https://api.vietride.online/v1/operator/parcels/$PARCEL_ID/confirm-refund" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: de9009e1-b7fe-4466-9a0b-021f4d453fd4" -d '{"reason":"Đã đối soát"}'
```

```js
await api(`/v1/operator/parcels/${parcelId}/confirm-refund`, {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(), body: { reason },
});
```

Chỉ khi status `PENDING_OPERATOR_ACTION`, action `REFUND_CONFIRMATION`, refund amount >0. Errors `404 PARCEL_NOT_FOUND`, `409 INVALID_PENDING_ACTION|INVALID_REFUND_AMOUNT|RACE_LOST`.

#### 6. Override capacity

`POST /v1/operator/parcels/{parcelId}/override-capacity`; role Admin hoặc permission `CAN_OVERRIDE_CAPACITY`; body `{reason}` non-whitespace.

```bash
curl -X POST "https://api.vietride.online/v1/operator/parcels/$PARCEL_ID/override-capacity" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: c1bbaec8-de77-4121-b2b0-d02296a5f192" -d '{"reason":"Đã kiểm tra khoang hàng thực tế"}'
```

```js
await api(`/v1/operator/parcels/${parcelId}/override-capacity`, {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(), body: { reason },
});
```

Chỉ action `CAPACITY_EXCEEDED|RESERVE_FAILED`. Errors `403 FORBIDDEN`, `404 PARCEL_NOT_FOUND`, `409 INVALID_PENDING_ACTION|TRIP_CARGO_CAPACITY_EXCEEDED|RACE_LOST`, `422 VALIDATION_ERROR`, `503 TRIP_NOT_FOUND|TRIP_SERVICE_UNAVAILABLE`.

#### 7. Operator manual delivery confirm

Hai endpoint đồng nghĩa trong controller hiện tại:

- `POST /v1/operator/parcels/{parcelId}/confirm-delivery`
- `POST /v1/operator/parcels/{parcelId}/manual-confirm`

Body/note/response/error giống crew manual-confirm.

```bash
curl -X POST "https://api.vietride.online/v1/operator/parcels/$PARCEL_ID/manual-confirm" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 1d28cdb9-a4ca-4dd3-b01f-d52a6b8d3ceb" -d '{"confirmNote":"Xác nhận qua biên bản tại bến"}'
```

```js
await api(`/v1/operator/parcels/${parcelId}/manual-confirm`, {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(),
  body: { confirmNote: note },
});
```

Ví dụ tương đương cho alias `confirm-delivery`:

```bash
curl -X POST "https://api.vietride.online/v1/operator/parcels/$PARCEL_ID/confirm-delivery" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 4a00ec4c-5ecf-4a61-90f2-2070286f8b6c" \
  -d '{"confirmNote":"Xác nhận qua biên bản tại bến"}'
```

```js
await api(`/v1/operator/parcels/${parcelId}/confirm-delivery`, {
  method: 'POST',
  token: accessToken,
  idempotencyKey: crypto.randomUUID(),
  body: { confirmNote: note },
});
```

#### 8. Operator resend delivery email

`POST /v1/operator/parcels/{parcelId}/resend-delivery-email`, không body; behavior/response/error giống crew resend.

```bash
curl -X POST "https://api.vietride.online/v1/operator/parcels/$PARCEL_ID/resend-delivery-email" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Idempotency-Key: f1ed7ae0-7587-4ac5-a0c1-254ad66b42fd"
```

```js
await api(`/v1/operator/parcels/${parcelId}/resend-delivery-email`, {
  method: 'POST', token: accessToken, idempotencyKey: crypto.randomUUID(),
});
```

Tất cả action trên trả `OperationalParcelResponse` trừ review/manual-confirm/resend. Schema operational: `{parcelId,parcelCode,status,tripId?,transferTargetTripId?,transferConfirmedAt?,returnReason?,returnedAt?,refundChoice?,refundAmount?}`.

### Stats và reports

#### 1. Parcel stats

`GET /v1/operator/parcel-stats` — Admin.

`from`, `to` đều required date; `from<=to`; max 366 ngày inclusive. `groupBy` required `status|route`, case-insensitive. `limit` chỉ áp dụng route, default 10 và được clamp `1..100`.

```bash
curl "https://api.vietride.online/v1/operator/parcel-stats?from=2026-08-01&to=2026-08-12&groupBy=status" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
await api('/v1/operator/parcel-stats?from=2026-08-01&to=2026-08-12&groupBy=status', { token: accessToken });
```

Response `{items,totalParcels}`. Status item `{key,count,routeId:null,routeName:null,parcelCount:null}`; route item `{key:null,count:null,routeId,routeName,parcelCount}`. Invalid query → `422 VALIDATION_ERROR`.

#### 2. Summary

`GET /v1/operator/parcels/reports/summary`

Query tùy chọn: `?from=YYYY-MM-DD&to=YYYY-MM-DD`.

Both optional; `to` default today Vietnam; `from` default `to.AddDays(-30)` — tức 31 calendar dates inclusive. Nếu `from > to`, handler ném `ArgumentException`; global exception filter hiện map thành `500 INTERNAL_ERROR` với message chung `An unexpected error occurred`.

```bash
curl "https://api.vietride.online/v1/operator/parcels/reports/summary?from=2026-08-01&to=2026-08-12" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
await api('/v1/operator/parcels/reports/summary?from=2026-08-01&to=2026-08-12', { token: accessToken });
```

Response `{operatorId,from,to,totalParcels,totalLoaded,totalDelivered,totalRejected,totalReturned,grossParcelRevenueVnd,parcelRefundsVnd,netParcelRevenueVnd,source}`; source `ParcelStats|ParcelsFallback`. Payment revenue lỗi → `503`.

#### 3. CSV report

`GET /v1/operator/parcels/reports/export`

Query tùy chọn: `?from=...&to=...&format=csv`. Range defaults như summary; format optional nhưng nếu có chỉ `csv`. `from > to` hoặc `format` khác `csv` hiện đi qua `ArgumentException` và trả `500 INTERNAL_ERROR`. Response thành công là file `text/csv`, không phải ApiResponse JSON.

```bash
curl -OJ "https://api.vietride.online/v1/operator/parcels/reports/export?from=2026-08-01&to=2026-08-12&format=csv" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const response = await fetch(`${API}/v1/operator/parcels/reports/export?from=2026-08-01&to=2026-08-12&format=csv`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const blob = await response.blob();
```

#### 4. XLSX report

`GET /v1/operator/reports/parcels/export`

Query tùy chọn: `?from=...&to=...`. Both optional; default 30 inclusive Vietnam calendar days; allowed 1..92 inclusive; `to != DateOnly.MaxValue`. Invalid → `422 REPORT_RANGE_INVALID`. Response XLSX binary, không envelope.

```bash
curl -OJ "https://api.vietride.online/v1/operator/reports/parcels/export?from=2026-08-01&to=2026-08-12" -H "Authorization: Bearer $ACCESS_TOKEN"
```

```js
const response = await fetch(`${API}/v1/operator/reports/parcels/export?from=2026-08-01&to=2026-08-12`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const xlsx = await response.blob();
```

## Request/response schema dùng chung

### Fetch helper copy-paste

```js
const API = 'https://api.vietride.online';

async function api(path, {
  method = 'GET', token, idempotencyKey, body,
} = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw payload;
  return payload;
}
```

### ParcelStatus enum

```text
PENDING_OPERATOR_REVIEW
PENDING_PAYMENT
PENDING
PENDING_ADDITIONAL_PAYMENT
RESERVED
CHECKED_IN
PENDING_FINAL_PAYMENT
READY_TO_LOAD
LOADED
IN_TRANSIT
PENDING_TRANSFER_CONFIRM
TRANSFER_ESCALATED
UNLOADED
DELIVERED_PENDING_CONFIRM
DELIVERY_CONFIRMED
DELIVERY_REJECTED
RETURN_INITIATED
RETURNED
PENDING_OPERATOR_ACTION
CANCELLED
REJECTED
EXPIRED
```

Không suy trạng thái bằng index hoặc “status gần giống”; switch exact string.

### `ParcelDetailResponse`

| Nhóm | Field | Kiểu/nullable | Ý nghĩa |
|---|---|---|---|
| Identity | `parcelId`, `parcelCode`, `status` | UUID, string, enum | Parcel identity/state |
| Parties | `senderUserId`, `recipientUserId?`, `recipientName?`, `recipientPhone?` | UUID/string | Logical recipient link nullable |
| Scope | `operatorId`, `tripId`, `dropoffStopId?` | UUID | Trip/operator/dropoff |
| Content | `description?`, `photoUrl?`, `checkInPhotoUrls?`, `deliveryPhotoUrls?` | string/array | Parcel/evidence photos |
| Cargo legacy/current | `sizeCategory`, `estimatedSizeCategory`, `actualSizeCategory?` | enum string | Current field và settlement snapshots |
| Cargo | `estimatedWeightKg`, `actualWeightKg?` | decimal | Physical weight |
| Dimensions | `estimatedLengthCm`, `estimatedWidthCm`, `estimatedHeightCm`, `actualLengthCm?`, `actualWidthCm?`, `actualHeightCm?` | decimal | Kích thước |
| Derived | `estimatedVolumeM3`, `estimatedDimWeightKg`, `estimatedChargeableWeightKg`, `actualVolumeM3?`, `actualDimWeightKg?`, `actualChargeableWeightKg?` | decimal | Giá trị BE tính |
| Legacy money | `depositAmount`, `originalDepositAmount`, `discountAmount`, `additionalAmount` | int64 VND | Fields tương thích contract cũ |
| Settlement v2 | `estimatedGrossPriceVnd`, `finalGrossPriceVnd`, `discountAmountVnd`, `estimatedTotalPriceVnd`, `finalTotalPriceVnd` | int64 VND | Pricing snapshot |
| Deposit/balance | `depositPercent`, `depositRequiredVnd`, `depositPaidVnd`, `balanceRequiredVnd`, `balancePaidVnd` | decimal/int64 | Settlement amounts |
| Refund | `refundDueVnd`, `refundedAmountVnd`, `forfeitedDepositVnd` | int64 | Refund/forfeit |
| Voucher | `voucherCode?`, `voucherUsageId?` | string/UUID | Voucher snapshot |
| Payment | `depositPaymentId?`, `balancePaymentId?` | UUID | Cross-service logical IDs |
| Deadlines | `loadCutoffAt?`, `latestCheckInAt?`, `finalPaymentDeadline?` | timestamp | Server deadlines |
| Operations | `checkedInAt?`, `checkedInByUserId?`, `reweighedAt?`, `reweighedByUserId?`, `loadedAt?`, `unloadedAt?`, `deliveredPendingConfirmAt?`, `confirmedAt?`, `rejectedAt?` | timestamp/UUID | Lifecycle audit |
| Pricing policy | `pricePerKgVnd`, `minimumPriceVnd`, `dimWeightFactor`, `settlementPolicyVersion` | int64/decimal/int | Persisted quote snapshot |
| Display | `originStationName?`, `destinationStationName?`, `eta?` | string/timestamp | Trip snapshot read; `eta` là static destination estimate |
| Other | `deliveryMethod`, `createdAt` | string/timestamp | Current code only supports terminal pickup at create |

### Response schema operational

| DTO | Fields exact |
|---|---|
| `ParcelRouteFareResponse` | `routeId,sizeCategory,operatorId,priceVnd,effectiveFrom,effectiveUntil,createdAt,updatedAt` |
| `BatchParcelRouteFareItemResponse` | `sizeCategory,priceVnd,effectiveFrom,effectiveUntil,created` |
| `ReviewParcelResponse` | `parcelId,parcelCode,status,depositRequiredVnd?` |
| `OperationalParcelResponse` | `parcelId,parcelCode,status,tripId?,transferTargetTripId?,transferConfirmedAt?,returnReason?,returnedAt?,refundChoice?,refundAmount?` |
| `ManualConfirmDeliveryResponse` | `parcelId,status,confirmedAt` |
| `ResendDeliveryEmailResponse` | `parcelId,status,expiresAt` |
| `CheckInParcelResponse` | `parcelId,parcelCode,status,checkedInAt,latestCheckInAt` |
| `ReweighParcelResponse` | `parcelId,parcelCode,status,actualSizeCategory,actualChargeableWeightKg,finalGrossPriceVnd,discountAmountVnd,finalTotalPriceVnd,depositPaidVnd,balanceRequiredVnd,refundDueVnd,finalPaymentDeadline?` |
| `MarkParcelLoadedResponse` | `parcelId,parcelCode,status` |
| `UnloadParcelResponse` | `parcelId,parcelCode,status` |
| `DeliverParcelResponse` | `parcelId,parcelCode,status,deliveredPendingConfirmAt` |

### Quote contract và dữ liệu FE không được tự diễn giải

Quote token là opaque HMAC token, TTL mặc định 600 giây. Payload server ký gồm version, sender, trip/route/operator/station pair, dimensions/weight/derived cargo/category, fare identity/window/version, DIM policy, settlement policy, price/deposit timestamps và random `jti`.

FE:

- Không decode token để ra business state.
- Không sửa token.
- Không tự đổi category, dimensions, trip hoặc price sau khi lấy quote.
- Khi chọn voucher, create response mới là số tiền authoritative có discount.
- Payment sau create dùng persisted quote snapshot; không lấy giá live mới để hiển thị amount cần trả.
- Legacy create không có token vẫn được code hỗ trợ trong rollout hiện tại, nhưng có rủi ro fare đổi giữa search/create; FE mới nên gửi token.

## Error code theo nhóm

Mẫu error dùng cho mọi code:

```json
{
  "success": false,
  "statusCode": 409,
  "error": {
    "code": "INVALID_STATUS",
    "message": "Parcel is in status 'LOADED'."
  },
  "meta": {
    "traceId": "00-...",
    "timestamp": "2026-08-12T16:00:00+07:00"
  }
}
```

| Nhóm | Code từ source |
|---|---|
| Quote | `PARCEL_QUOTE_INVALID`, `PARCEL_QUOTE_EXPIRED`, `PARCEL_QUOTE_STALE`, `PARCEL_QUOTE_MISMATCH` |
| Search/lookups | `TRIP_SEARCH_UNAVAILABLE`, `OPERATOR_LOOKUP_UNAVAILABLE`, `OPERATOR_NOT_FOUND`, `TRIP_SERVICE_UNAVAILABLE`, `BOOKING_SERVICE_UNAVAILABLE`, `UPSTREAM_UNAVAILABLE` |
| Create | `USER_NOT_FOUND`, `USER_FORBIDDEN`, `USER_NOT_PASSENGER`, `USER_INACTIVE`, `BOOKING_NOT_FOUND`, `BOOKING_NOT_OWNED_BY_SENDER`, `BOOKING_NOT_FOR_THIS_TRIP`, `BOOKING_NOT_ATTACHABLE`, `TRIP_NOT_FOUND`, `TRIP_NOT_ACCEPTING_PARCEL`, `DROP_OFF_STOP_NOT_FOUND`, `DROP_OFF_STOP_NOT_ALLOWED`, `PARCEL_CHECK_IN_CLOSED`, `FARE_NOT_CONFIGURED`, `VOUCHER_NOT_APPLICABLE`, `PARCEL_CODE_COLLISION`, `SUBSCRIPTION_EXPIRED`, `SUBSCRIPTION_MODULE_DISABLED`, `RESOURCE_NOT_FOUND` |
| Payment | `INVALID_STATUS`, `PAYMENT_ALREADY_STARTED`, `INSUFFICIENT_FUNDS`, `PAYMENT_SERVICE_ERROR`, `MOBILE_APP_UPDATE_REQUIRED`, `PAYMENT_RETURN_MODE_INVALID`, `VNPAY_MOBILE_SDK_DISABLED`, `FINAL_PAYMENT_DEADLINE_PASSED`, `BALANCE_ALREADY_PAID`, `RACE_LOST` |
| Cargo/recovery | `TRIP_CARGO_CAPACITY_EXCEEDED`, `TRIP_CARGO_TRANSFER_CONFLICT`, `PARCEL_CARGO_NOT_FOUND`, `PARCEL_CARGO_RECOVERY_IN_PROGRESS`, `INVALID_TRANSFER_TARGET`, `PARCEL_NOT_TRANSFERABLE`, `PARCEL_TRANSFER_CONFIRMATION_DEADLINE_PASSED` |
| Operations | `PARCEL_NOT_FOUND`, `PARCEL_LOAD_CUTOFF_PASSED`, `DESTINATION_TERMINAL_NOT_ARRIVED`, `DROP_OFF_STOP_NOT_ARRIVED`, `INVALID_PENDING_ACTION`, `INVALID_REFUND_AMOUNT`, `INVALID_REFUND_CHOICE`, `INVALID_TRANSITION`, `RESOURCE_CONFLICT` |
| Delivery token | `PARCEL_DELIVERY_TOKEN_INVALID`, `PARCEL_DELIVERY_TOKEN_EXPIRED`, `PARCEL_DELIVERY_TOKEN_REVOKED`, `PARCEL_NOT_PENDING_CONFIRM`, `PARCEL_NOT_DELIVERY_REJECTED`, `PARCEL_DELIVERY_REJECTED_WINDOW_EXPIRED`, `PARCEL_RECIPIENT_EMAIL_REQUIRED` |
| Fare | `INVALID_SIZE_CATEGORY`, `FARE_ALREADY_EXISTS`, `FARE_NOT_FOUND`, `ROUTE_NOT_FOUND`, `ROUTE_OWNERSHIP_UNVERIFIABLE` |
| Reports | `REPORT_RANGE_INVALID`, `VALIDATION_ERROR` |

Một số exception dependency dùng code `TRIP_NOT_FOUND` nhưng status 503 trong cargo adapter; FE phải dùng cả HTTP status và `error.code`, không giả định một code luôn có đúng một status xuyên mọi endpoint.

## Phân công 3 FE agent

### Agent Mobile Passenger

- Location hierarchy: `/v1/locations` → `/v1/stations/search` với `locationScopeCode`; bỏ logic city/ward cũ nếu đang dùng nó như hierarchy ID.
- Full quote/create/payment flow; giữ quote token cùng form state, refresh quote khi 4 quote error xuất hiện.
- Không tự tính category/gross/deposit; render `depositPercent=20`/amount từ server.
- Gửi `recipient.email`, không có `recipientUserId` public.
- Sent/received/detail/history; phân biệt static `eta` trong Parcel DTO với dynamic ETA từ Tracking.
- Delivery link page nếu nằm trong Mobile/WebView: token body + idempotency, handle undo 15 phút.
- Tracking parcel: dùng `tripId`, `dropoffStopId` hoặc `trackingTarget` để chọn shared ETA cache.

### Agent Mobile Driver

- Assistant account: list trip parcels, QR scan, check-in, reweigh, load, unload, deliver.
- Driver/Assistant: confirm transfer, manual confirm, resend email.
- Upload evidence đúng Firebase owned prefix trước khi gửi URL; max 3.
- Điều khiển UI theo `status`, deadlines và error code; không optimistic-transition khi mutation chưa trả success.
- Khi reweigh trả `PENDING_FINAL_PAYMENT`, thông báo passenger; không cho load khi chưa `READY_TO_LOAD`.
- Kết hợp parcel operations với Trip start/end và Tracking socket; không gọi internal cargo API.

### Agent Admin/Operator Web

- Fare CRUD/batch cho đủ `EXTRA_LARGE`; staff read-only fare, admin mutation.
- Operator parcel list/detail, filter pending action, status history.
- Review chỉ hiển thị cho record thực sự `PENDING_OPERATOR_REVIEW`; settlement v2 create hiện thường vào `PENDING_PAYMENT`.
- Transfer/return/cancel/refund/capacity override/manual delivery/email flows; permission gate `CAN_OVERRIDE_CAPACITY`.
- Stats, CSV, XLSX: xử lý binary response riêng, không parse ApiResponse khi HTTP 200 file.
- Kết hợp Tracking/fleet ETA nhưng không dùng `ParcelDetailResponse.eta` như dynamic ETA.

### Ownership chung giữa 3 agent

- Cùng dùng một shared `ApiResponse` parser, token refresh mutex và idempotency utility.
- Cùng generate type từ field camelCase trong tài liệu/source; không copy tên DB snake_case.
- Cùng map `ParcelStatus` exhaustive và có default “unknown state” để app không crash khi BE thêm trạng thái additive.
- ETA/Tracking implementation chi tiết nằm trong `API-ETA-Tracking.md`.

## Checklist

- [ ] Station search dùng `locationScopeCode`; không gửi cùng `locationId`.
- [ ] Root scope giữ được cả station legacy gắn root và station gắn leaf.
- [ ] Available-trip form gửi dimensions/weight dương; UI dùng `estimatedSizeCategory` của BE.
- [ ] Quote token được giữ opaque, không decode/sửa; refresh đúng 4 quote errors.
- [ ] Create và voucher dùng cùng trip/dimensions/category/token.
- [ ] Recipient link chỉ qua normalized email; FE không gửi `recipientUserId`.
- [ ] Sau create gọi deposit-payment; không hiểu `paymentMethod` trong create là payment đã start.
- [ ] VNPay Mobile luôn gửi `paymentReturnMode: MOBILE_SDK` và dùng `vnpaySdk`.
- [ ] Không reprice payment từ fare hiện tại; dùng persisted amounts.
- [ ] Mutation giữ cùng idempotency key/body khi retry.
- [ ] Driver evidence URL đúng owned Firebase prefix, tối đa 3.
- [ ] Delivery token không nằm trong URL/query/log.
- [ ] `/received` chỉ có recipient đã link; unknown email không tự match theo phone/name.
- [ ] Parcel DTO `eta` là static trip estimate; dynamic stop/station ETA lấy Tracking API/socket.
- [ ] Export CSV/XLSX xử lý Blob, không gọi `response.json()` khi 200.
- [ ] Không gọi internal Trip cargo reserve/release/transfer từ FE.
