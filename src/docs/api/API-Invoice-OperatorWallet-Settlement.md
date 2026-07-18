# API Invoice, OperatorWallet và Settlement

Tài liệu này được lập từ code hiện tại của Identity, Trip, Payment, Gateway và shared contracts sau Day 38. Chỉ hành vi nhìn thấy trong code được mô tả. Các endpoint bên dưới dùng production Gateway `https://api.vietride.online`, trừ khi ghi rõ là internal hoặc direct service.

## Mục lục

- [Base URL](#base-url)
- [Xác thực và header chung](#xác-thực-và-header-chung)
- [Response envelope](#response-envelope)
- [Quy ước và enum](#quy-ước-và-enum)
- [Tổng quan endpoint](#tổng-quan-endpoint)
- [Query, filter và sort](#query-filter-và-sort)
- [Chi tiết endpoint](#chi-tiết-endpoint)
- [Internal endpoint hỗ trợ](#internal-endpoint-hỗ-trợ)
- [Integration events](#integration-events)
- [Mã lỗi theo code](#mã-lỗi-theo-code)
- [Business flow và lưu ý](#business-flow-và-lưu-ý)

## Base URL

| Môi trường | Base URL | Ghi chú |
|---|---|---|
| Production qua Gateway | `https://api.vietride.online` | FE/Mobile chỉ gọi URL này |
| Identity direct local | `http://localhost:5001` | Subscription API |
| Trip direct local | `http://localhost:5002` | Complete Trip API |
| Payment direct local | `http://localhost:5004` | Invoice, wallet, ledger và settlement API |
| Swagger production | `https://api.vietride.online/docs` | Swagger qua Gateway/deployment hiện hành |

Invoice PDF production được lưu trong Firebase Storage bucket `vietride-204c0.firebasestorage.app`, object path `invoices/{operatorId}/{invoiceId}.pdf`. API không trả object path trực tiếp cho client.

## Xác thực và header chung

| Loại endpoint | Role | Header |
|---|---|---|
| Operator Invoice | `OPERATOR_ADMIN` | `Authorization: Bearer <access_token>` |
| Operator wallet/ledger/settlement read | `OPERATOR_ADMIN`, `OPERATOR_STAFF` | `Authorization: Bearer <access_token>` |
| Subscription upgrade | `OPERATOR_ADMIN` | Bearer token và `Idempotency-Key` |
| Complete Trip | `DRIVER`, `ASSISTANT` | Bearer token và `Idempotency-Key` |
| Admin financial/Invoice mutation | `SYSTEM_ADMIN` | Bearer token và `Idempotency-Key` |
| Internal endpoint | Internal JWT HS256 | `X-Internal-Auth: Bearer <internal_jwt>` |

Gateway xác thực user JWT RS256, kiểm tra role và mint internal JWT khi proxy xuống service. Operator scope chỉ lấy từ claim `operatorId`/`operator_id`; API không nhận `operatorId` từ query cho các endpoint operator.

Mutation yêu cầu `Idempotency-Key`:

```http
Idempotency-Key: <unique-key-tối-đa-100-ký-tự>
```

Replay cùng key và cùng request trả lại response đã lưu. Dùng cùng key với request khác trả `IDEMPOTENCY_KEY_MISMATCH`. Redis giữ idempotency record 24 giờ theo middleware hiện hành. Subscription upgrade giới hạn key tối đa 100 ký tự; các mutation còn lại trong tài liệu yêu cầu key không rỗng.

## Response envelope

Success:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "meta": {
    "traceId": "req-123",
    "timestamp": "2026-07-14T10:00:00Z"
  }
}
```

Error:

```json
{
  "success": false,
  "statusCode": 409,
  "error": {
    "code": "TRIP_SETTLEMENT_ALREADY_SETTLED",
    "message": "Settlement is already terminal.",
    "fields": null
  },
  "meta": {
    "traceId": "req-123",
    "timestamp": "2026-07-14T10:00:00Z"
  }
}
```

Paged response dùng shape:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalItems": 0,
  "totalPages": 0,
  "hasNextPage": false,
  "hasPreviousPage": false
}
```

Các ví dụ success trong phần chi tiết bên dưới chỉ hiển thị object bên trong `data` để dễ đọc, trừ khi ví dụ ghi rõ full envelope.

## Quy ước và enum

| Quy ước | Giá trị trong code |
|---|---|
| JSON casing | camelCase |
| UUID | `Guid` |
| Thời gian | ISO-8601 `DateTimeOffset` |
| Money | `long` VND, không dùng số thập phân |
| Billing period | `MONTHLY`, `YEARLY` |
| Subscription payment method | `WALLET`, `VNPAY` |
| Invoice status | `DRAFT`, `ISSUED`, `CANCELLED` |
| PDF generation status | `PENDING`, `PROCESSING`, `FAILED`, `COMPLETED` |
| Settlement status | `PENDING_HOLD`, `ELIGIBLE`, `SETTLED`, `CANCELLED` |
| Settlement method | `AUTO_WEEKLY`, `ADMIN_MANUAL` |
| Wallet transaction type | `CREDIT`, `DEBIT` |
| Operator wallet reference | `TRIP_SETTLEMENT`, `ADJUSTMENT`, `SUBSCRIPTION_PAYMENT` |
| Ledger entry type | `BOOKING_REVENUE`, `PARCEL_REVENUE`, `BOOKING_REFUND`, `PARCEL_REFUND`, `VOUCHER_VIETRIDE_FUNDED_CREDIT`, `VOUCHER_OPERATOR_FUNDED_AUDIT`, `ADJUSTMENT` |
| Ledger reference | `BOOKING`, `PARCEL`, `VOUCHER_USAGE`, `MANUAL` |

Enum filter hiện parse phân biệt hoa/thường. Client phải gửi đúng dạng UPPER_SNAKE_CASE.

## Tổng quan endpoint

| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/v1/operator/subscription` | `OPERATOR_ADMIN` | Xem subscription hiện tại, usage và pending upgrade |
| GET | `/v1/operator/subscription-plans` | `OPERATOR_ADMIN` | Lấy danh sách plan active để chọn `planId` |
| POST | `/v1/operator/subscription/upgrade` | `OPERATOR_ADMIN` | Thanh toán upgrade bằng WALLET hoặc tạo VNPay redirect |
| POST | `/v1/driver/trips/{tripId}/complete` | `DRIVER`, `ASSISTANT` | Hoàn tất Trip và phát terminal event |
| GET | `/v1/operator/wallet` | `OPERATOR_ADMIN`, `OPERATOR_STAFF` | Xem OperatorWallet và tiền đang hold/eligible |
| GET | `/v1/operator/wallet/transactions` | `OPERATOR_ADMIN`, `OPERATOR_STAFF` | Lịch sử OperatorWallet |
| GET | `/v1/operator/trip-settlements` | `OPERATOR_ADMIN`, `OPERATOR_STAFF` | Danh sách settlement của operator |
| GET | `/v1/operator/ledger` | `OPERATOR_ADMIN`, `OPERATOR_STAFF` | Revenue/refund/adjustment ledger |
| GET | `/v1/operator/invoices` | `OPERATOR_ADMIN` | Danh sách Invoice subscription |
| GET | `/v1/operator/invoices/{invoiceId}` | `OPERATOR_ADMIN` | Chi tiết Invoice |
| GET | `/v1/operator/invoices/{invoiceId}/download` | `OPERATOR_ADMIN` | Sinh signed URL mới, TTL tối đa 60 phút |
| GET | `/v1/admin/trip-settlements` | `SYSTEM_ADMIN` | Query settlement toàn hệ thống và stuck filter |
| POST | `/v1/admin/trip-settlements/{settlementId}/settle` | `SYSTEM_ADMIN` | Settle thủ công |
| GET | `/v1/admin/platform-wallet` | `SYSTEM_ADMIN` | Xem PlatformWallet |
| GET | `/v1/admin/platform-wallet/transactions` | `SYSTEM_ADMIN` | Lịch sử PlatformWallet |
| POST | `/v1/admin/platform-wallet/adjust` | `SYSTEM_ADMIN` | Điều chỉnh PlatformWallet |
| POST | `/v1/admin/operators/{operatorId}/wallet/adjust` | `SYSTEM_ADMIN` | Điều chỉnh OperatorWallet |
| POST | `/v1/admin/invoices/{invoiceId}/retry` | `SYSTEM_ADMIN` | Retry Invoice PDF thất bại |

## Query, filter và sort

Query chung cho các list endpoint:

| Query | Kiểu | Default | Rule |
|---|---|---:|---|
| `page` | int | `1` | `>= 1` |
| `pageSize` | int | `20` | `1..100` |
| `from` | ISO-8601? | null | Lọc `createdAt >= from` |
| `to` | ISO-8601? | null | Lọc `createdAt <= to`; phải `>= from` |
| `sortDir` | string | `desc` | Chỉ `asc`, `desc` viết thường |

Sort whitelist:

| Endpoint | `sortBy` hợp lệ |
|---|---|
| Wallet transactions | `createdAt`, `amount` |
| Ledger | `createdAt`, `amount` |
| Settlement | `createdAt`, `eligibleAt`, `settledAt`, `netAmount` |
| Invoice | `createdAt`, `issuedAt`, `amount`, `invoiceNumber` |

Filter riêng:

- Wallet transactions: `type`, `referenceType`.
- Ledger: `tripId`, `entryType`, `referenceType`.
- Operator settlement: `status`, `tripId`.
- Invoice: `status`.
- Admin settlement: `operatorId`, `status`, `tripId`, `stuckOnly`, `severity=HIGH|WARNING`.
- `HIGH` khi `failureCount >= 3` **hoặc** settlement eligible quá 21 ngày; `WARNING` là phần stuck còn lại.

Unsupported enum/filter trả `400 INVALID_FILTER`; unsupported `sortBy` trả `400 INVALID_SORT_FIELD`.

## Chi tiết endpoint

### GET `/v1/operator/subscription-plans`

Frontend gọi endpoint này để lấy `planId` hợp lệ trước khi upgrade.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/v1/operator/subscription-plans"
```

Mỗi plan trả:

```json
{
  "planId": "38000000-0000-4000-8000-000000000001",
  "name": "BUSINESS",
  "description": "Gói dành cho nhà xe đang vận hành",
  "pricePerMonth": 199000,
  "pricePerYear": 1990000,
  "limits": {
    "maxVehicles": 50,
    "maxDrivers": 100,
    "maxAssistants": 100,
    "maxOperatorUsers": 20,
    "maxRoutes": 100,
    "maxTripsPerMonth": 1000
  },
  "modules": {
    "enableParcel": true,
    "enableShuttle": true,
    "enableRag": true
  },
  "isActive": true
}
```

### GET `/v1/operator/subscription`

Trả subscription, plan hiện tại, usage và `pendingUpgrade` nếu có. Operator scope lấy từ JWT.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/v1/operator/subscription"
```

Các field chính: `subscriptionId`, `status`, `billingPeriod`, `startedAt`, `expiresAt`, `plan`, `usage`, `pendingUpgrade`. `pendingUpgrade` chứa `upgradeAttemptId`, `targetPlanId`, `billingPeriod`, `amount`, `paymentId`, `dueAt`.

### POST `/v1/operator/subscription/upgrade`

Header bắt buộc: Bearer token role `OPERATOR_ADMIN`, `Idempotency-Key`, `Content-Type: application/json`.

WALLET request:

```json
{
  "planId": "38000000-0000-4000-8000-000000000001",
  "billingPeriod": "MONTHLY",
  "paymentMethod": "WALLET",
  "returnUrl": null
}
```

WALLET success `200`:

```json
{
  "subscriptionId": "38000000-0000-4000-8000-000000000002",
  "upgradeAttemptId": "38000000-0000-4000-8000-000000000003",
  "status": "ACTIVE",
  "paymentId": "38000000-0000-4000-8000-000000000004",
  "amount": 199000,
  "billingPeriod": "MONTHLY",
  "paymentRedirectUrl": null,
  "dueAt": null,
  "invoiceStatus": "PENDING"
}
```

VNPAY request phải có absolute `returnUrl`:

```json
{
  "planId": "38000000-0000-4000-8000-000000000001",
  "billingPeriod": "YEARLY",
  "paymentMethod": "VNPAY",
  "returnUrl": "https://operator.example.com/subscription/payment-result"
}
```

VNPAY success `202` trả `status=PENDING_PAYMENT`, `paymentRedirectUrl` khác null, `dueAt` khác null và `invoiceStatus=null`. Invoice chỉ được tạo sau callback VNPay thành công.

```bash
curl -X POST "$BASE_URL/v1/operator/subscription/upgrade" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: subscription-wallet-001" \
  -H "Content-Type: application/json" \
  -d '{"planId":"38000000-0000-4000-8000-000000000001","billingPeriod":"MONTHLY","paymentMethod":"WALLET","returnUrl":null}'
```

Rule quan trọng:

- `returnUrl` bắt buộc với VNPAY và phải null/không gửi với WALLET.
- WALLET atomically DEBIT OperatorWallet và CREDIT PlatformWallet.
- WALLET không đủ tiền trả `402 WALLET_INSUFFICIENT_BALANCE`.
- WALLET và VNPay cùng phát canonical event để tạo Invoice.

### POST `/v1/driver/trips/{tripId}/complete`

Không có request body. Caller phải là driver hoặc assistant được gán cho Trip đang `IN_PROGRESS`.

Success `200`:

```json
{
  "tripId": "38000000-0000-4000-8000-000000000010",
  "status": "COMPLETED",
  "completedAt": "2026-07-14T10:00:00Z"
}
```

```bash
curl -X POST "$BASE_URL/v1/driver/trips/$TRIP_ID/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: complete-trip-001"
```

Success commit Trip status, audit actor và `trip.trip.completed` Outbox trong cùng transaction boundary của request. Trip không `IN_PROGRESS` trả `409 TRIP_ALREADY_TERMINAL`.

### GET `/v1/operator/wallet`

Success `200`:

```json
{
  "operatorId": "38000000-0000-4000-8000-000000000020",
  "balance": 1250000,
  "pendingHoldAmount": 450000,
  "eligibleAmount": 300000,
  "updatedAt": "2026-07-14T10:00:00Z"
}
```

`pendingHoldAmount` là tổng ledger của các Trip `PENDING_HOLD`, không phải balance đã credit. `eligibleAmount` là tổng `netAmount` của settlement `ELIGIBLE`. GET không lazy-create wallet; chưa có wallet trả `404 OPERATOR_WALLET_NOT_FOUND`.

```bash
curl -H "Authorization: Bearer $TOKEN" "$BASE_URL/v1/operator/wallet"
```

### GET `/v1/operator/wallet/transactions`

Ví dụ:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/v1/operator/wallet/transactions?type=CREDIT&referenceType=TRIP_SETTLEMENT&page=1&pageSize=20&sortBy=createdAt&sortDir=desc"
```

Item response:

```json
{
  "transactionId": "38000000-0000-4000-8000-000000000021",
  "type": "CREDIT",
  "amount": 300000,
  "balanceBefore": 950000,
  "balanceAfter": 1250000,
  "referenceType": "TRIP_SETTLEMENT",
  "referenceId": "38000000-0000-4000-8000-000000000022",
  "note": "Trip settlement",
  "createdAt": "2026-07-14T10:00:00Z"
}
```

### GET `/v1/operator/trip-settlements`

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/v1/operator/trip-settlements?status=ELIGIBLE&page=1&pageSize=20&sortBy=eligibleAt&sortDir=asc"
```

Item response:

```json
{
  "settlementId": "38000000-0000-4000-8000-000000000022",
  "tripId": "38000000-0000-4000-8000-000000000010",
  "status": "ELIGIBLE",
  "eligibleAt": "2026-07-21T10:00:00Z",
  "netAmount": 300000,
  "settlementMethod": null,
  "settledAt": null,
  "createdAt": "2026-07-14T10:00:01Z"
}
```

Một Trip terminal giữ cùng một settlement row xuyên suốt `PENDING_HOLD -> ELIGIBLE -> SETTLED|CANCELLED`.

### GET `/v1/operator/ledger`

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/v1/operator/ledger?tripId=$TRIP_ID&entryType=BOOKING_REVENUE&page=1&pageSize=20"
```

Item response:

```json
{
  "ledgerEntryId": "38000000-0000-4000-8000-000000000023",
  "tripId": "38000000-0000-4000-8000-000000000010",
  "entryType": "BOOKING_REVENUE",
  "amount": 300000,
  "referenceType": "BOOKING",
  "referenceId": "38000000-0000-4000-8000-000000000024",
  "createdAt": "2026-07-14T09:00:00Z"
}
```

Refund ledger có `amount` âm. `VOUCHER_OPERATOR_FUNDED_AUDIT` có thể có amount bằng `0` vì chỉ phục vụ audit.

### GET `/v1/operator/invoices`

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/v1/operator/invoices?status=ISSUED&page=1&pageSize=20&sortBy=issuedAt&sortDir=desc"
```

Item response:

```json
{
  "invoiceId": "38000000-0000-4000-8000-000000000030",
  "invoiceNumber": "VR-INV-202607-000001",
  "paymentId": "38000000-0000-4000-8000-000000000004",
  "status": "ISSUED",
  "amount": 199000,
  "billingPeriod": "MONTHLY",
  "periodFrom": "2026-07-14T10:00:00Z",
  "periodTo": "2026-08-14T10:00:00Z",
  "pdfGenerationStatus": "COMPLETED",
  "createdAt": "2026-07-14T10:00:01Z",
  "issuedAt": "2026-07-14T10:00:03Z"
}
```

### GET `/v1/operator/invoices/{invoiceId}`

Chỉ trả Invoice thuộc operator trong JWT. Cross-tenant được che bằng `404 INVOICE_NOT_FOUND`.

Success `200` bổ sung `planName`, buyer snapshot và stable URLs:

```json
{
  "invoiceId": "38000000-0000-4000-8000-000000000030",
  "invoiceNumber": "VR-INV-202607-000001",
  "paymentId": "38000000-0000-4000-8000-000000000004",
  "status": "ISSUED",
  "amount": 199000,
  "billingPeriod": "MONTHLY",
  "periodFrom": "2026-07-14T10:00:00Z",
  "periodTo": "2026-08-14T10:00:00Z",
  "pdfGenerationStatus": "COMPLETED",
  "createdAt": "2026-07-14T10:00:01Z",
  "issuedAt": "2026-07-14T10:00:03Z",
  "planName": "BUSINESS",
  "buyerSnapshot": {
    "name": "Nhà xe A",
    "businessRegistrationNumber": "REG-001",
    "taxCode": "TAX-001",
    "contactEmail": "billing@example.test",
    "contactPhone": "+84900000000",
    "addressStreet": "123 Nguyễn Huệ",
    "addressWard": null,
    "addressDistrict": "Quận 1",
    "addressProvince": "TP.HCM"
  },
  "invoiceWebUrl": "https://operator.example.com/invoices/38000000-0000-4000-8000-000000000030",
  "downloadApiUrl": "https://api.vietride.online/v1/operator/invoices/38000000-0000-4000-8000-000000000030/download"
}
```

`downloadApiUrl` là endpoint protected, không phải Firebase signed URL.

### GET `/v1/operator/invoices/{invoiceId}/download`

Success `200`:

```json
{
  "downloadUrl": "https://storage.googleapis.com/<redacted-signed-url>",
  "expiresAt": "2026-07-14T11:00:00Z"
}
```

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/v1/operator/invoices/$INVOICE_ID/download"
```

Mỗi request hợp lệ sinh signed URL mới. URL không được persist, đưa vào event hoặc log. Rate limit là 10 request/phút cho mỗi user/invoice. Invoice chưa `ISSUED` hoặc PDF chưa `COMPLETED` trả `500 INVOICE_PDF_GENERATION_FAILED`.

### GET `/v1/admin/trip-settlements`

```bash
curl -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  "$BASE_URL/v1/admin/trip-settlements?stuckOnly=true&severity=HIGH&page=1&pageSize=100&sortBy=eligibleAt&sortDir=asc"
```

Item response:

```json
{
  "settlementId": "38000000-0000-4000-8000-000000000040",
  "tripId": "38000000-0000-4000-8000-000000000041",
  "operatorId": "38000000-0000-4000-8000-000000000020",
  "status": "ELIGIBLE",
  "eligibleAt": "2026-06-20T10:00:00Z",
  "netAmount": 500000,
  "settlementMethod": null,
  "settledAt": null,
  "createdAt": "2026-06-13T10:00:00Z",
  "failureCount": 3,
  "activeFailureCode": "PLATFORM_WALLET_INSUFFICIENT_BALANCE",
  "severity": "HIGH"
}
```

### POST `/v1/admin/trip-settlements/{settlementId}/settle`

Không có request body. Bắt buộc `Idempotency-Key`.

```bash
curl -X POST "$BASE_URL/v1/admin/trip-settlements/$SETTLEMENT_ID/settle" \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  -H "Idempotency-Key: manual-settle-001"
```

Success `200`:

```json
{
  "settlementId": "38000000-0000-4000-8000-000000000040",
  "tripId": "38000000-0000-4000-8000-000000000041",
  "operatorId": "38000000-0000-4000-8000-000000000020",
  "netAmount": 500000,
  "status": "SETTLED",
  "settlementMethod": "ADMIN_MANUAL",
  "settledAt": "2026-07-14T10:00:00Z"
}
```

Transaction atomically DEBIT PlatformWallet, CREDIT OperatorWallet, ghi transaction, cập nhật settlement và tạo Outbox event. Không đủ PlatformWallet balance trả `500 PLATFORM_WALLET_INSUFFICIENT_BALANCE`, settlement vẫn `ELIGIBLE`.

### GET `/v1/admin/platform-wallet`

Success `200`:

```json
{
  "platformWalletId": "38000000-0000-4000-8000-000000000050",
  "balance": 10000000,
  "updatedAt": "2026-07-14T10:00:00Z"
}
```

### GET `/v1/admin/platform-wallet/transactions`

Query giống wallet transaction operator. `referenceType` có thể là:

```text
BOOKING_PAYMENT_HOLD
PARCEL_PAYMENT_HOLD
PARCEL_ADDITIONAL_PAYMENT_HOLD
BOOKING_REFUND
PARCEL_REFUND
TRIP_SETTLEMENT
SUBSCRIPTION_PAYMENT
MANUAL_ADJUSTMENT
```

```bash
curl -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  "$BASE_URL/v1/admin/platform-wallet/transactions?type=DEBIT&referenceType=TRIP_SETTLEMENT&page=1&pageSize=20"
```

### POST `/v1/admin/platform-wallet/adjust`

Request:

```json
{
  "type": "CREDIT",
  "amount": 1000000,
  "note": "Đối soát thủ công ngày 2026-07-14"
}
```

Validation: `type=CREDIT|DEBIT`, `amount > 0`, `note` không rỗng và tối đa 500 ký tự.

```bash
curl -X POST "$BASE_URL/v1/admin/platform-wallet/adjust" \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  -H "Idempotency-Key: platform-adjust-001" \
  -H "Content-Type: application/json" \
  -d '{"type":"CREDIT","amount":1000000,"note":"Đối soát thủ công"}'
```

Success `200` trả `transactionId`, `type`, `amount`, `balanceBefore`, `balanceAfter`, `referenceType=MANUAL_ADJUSTMENT`, `referenceId=null`, `note`, `createdAt`.

### POST `/v1/admin/operators/{operatorId}/wallet/adjust`

Body và validation giống PlatformWallet adjustment. Success `200` có `referenceType=ADJUSTMENT`. DEBIT không được làm OperatorWallet âm.

```bash
curl -X POST "$BASE_URL/v1/admin/operators/$OPERATOR_ID/wallet/adjust" \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  -H "Idempotency-Key: operator-adjust-001" \
  -H "Content-Type: application/json" \
  -d '{"type":"DEBIT","amount":50000,"note":"Điều chỉnh theo biên bản OPS-001"}'
```

Concurrent request dùng optimistic concurrency. Sau ba lần CAS thất bại trả `409 WALLET_CONCURRENT_UPDATE`.

### POST `/v1/admin/invoices/{invoiceId}/retry`

Không có request body. Bắt buộc `Idempotency-Key`.

```bash
curl -X POST "$BASE_URL/v1/admin/invoices/$INVOICE_ID/retry" \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  -H "Idempotency-Key: invoice-retry-001"
```

Success `202`:

```json
{
  "invoiceId": "38000000-0000-4000-8000-000000000030",
  "pdfGenerationStatus": "PENDING",
  "attemptsUsed": 1
}
```

Chỉ Invoice `DRAFT + FAILED` và chưa dùng đủ 5 attempts mới retry được. Retry không reset attempt count. Hai key khác nhau cùng retry, một request thắng; request thua trả `409 INVOICE_RETRY_ALREADY_PENDING`.

## Internal endpoint hỗ trợ

Các endpoint này không dành cho FE/Mobile và không được expose như API public thông thường.

| Method | Direct service path | Mục đích |
|---|---|---|
| GET | Payment `/internal/v1/payments/context-readiness` | Kiểm tra Phase-A legacy context trước khi bật enforcement |
| GET | Booking `/internal/v1/bookings/payment-context/{referenceType}/{referenceId}` | Hydrate trusted booking allocation snapshot |
| GET | Parcel `/internal/v1/parcels/payment-context/{referenceType}/{referenceId}` | Hydrate trusted parcel allocation snapshot |

Readiness response:

```json
{
  "readyForPhaseB": true,
  "pendingRedirectWithoutContext": 0,
  "succeededWithoutContext": 0,
  "quarantined": 1
}
```

`Day38E2eJobsController` dưới `/internal/e2e/day38/jobs/*` chỉ hoạt động khi environment là Development và `Day38E2E:Enabled=true`; production trả `404`. Không dùng endpoint này cho vận hành production.

## Integration events

Exchange: `vietride.events`, topic routing key `<service>.<aggregate>.<verb_past>`. Producer Outbox và business mutation commit trong cùng local transaction; consumer dedupe theo `eventId`.

| Routing key | Producer | Consumer chính | Mục đích |
|---|---|---|---|
| `identity.operator.approved` | Identity | Payment | Bootstrap OperatorWallet |
| `payment.payment.succeeded` | Payment | Downstream services | Canonical payment success kèm trusted allocation context |
| `payment.payment.refunded` | Payment | Downstream services | Canonical refund kèm trusted context |
| `trip.trip.completed` | Trip | Payment | Tạo settlement marker |
| `trip.trip.disrupted` | Trip | Payment | Tạo settlement marker; `hasSubstitution` audit-only trong Payment |
| `payment.subscription.payment_succeeded` | Payment | Identity, Invoice pipeline | Kích hoạt subscription và tạo Invoice cho WALLET/VNPay |
| `payment.invoice.issued` | Payment | Notification | Push, in-app và email Invoice |
| `payment.trip_settlement.completed` | Payment | Notification | Báo OperatorWallet đã được credit |

`payment.invoice.issued` payload không chứa Firebase signed URL:

```json
{
  "eventId": "38000000-0000-4000-8000-000000000060",
  "occurredAt": "2026-07-14T10:00:03Z",
  "invoiceId": "38000000-0000-4000-8000-000000000030",
  "invoiceNumber": "VR-INV-202607-000001",
  "operatorId": "38000000-0000-4000-8000-000000000020",
  "amount": 199000,
  "invoiceWebUrl": "https://operator.example.com/invoices/38000000-0000-4000-8000-000000000030",
  "downloadApiUrl": "https://api.vietride.online/v1/operator/invoices/38000000-0000-4000-8000-000000000030/download"
}
```

`payment.trip_settlement.completed` dùng field canonical `netAmount`, không dùng alias `amount`.

## Mã lỗi theo code

| HTTP | Code | Nguyên nhân |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Pagination, sort direction hoặc date range không hợp lệ |
| 400 | `INVALID_FILTER` | Enum/severity filter không được hỗ trợ |
| 400 | `INVALID_SORT_FIELD` | `sortBy` không thuộc whitelist |
| 401 | `UNAUTHORIZED` | Thiếu/sai access token hoặc claim bắt buộc |
| 403 | `FORBIDDEN` | Sai role, thiếu operator scope hoặc caller không được gán Trip |
| 402 | `WALLET_INSUFFICIENT_BALANCE` | OperatorWallet không đủ tiền trả subscription |
| 404 | `INVOICE_NOT_FOUND` | Invoice không tồn tại hoặc thuộc tenant khác |
| 404 | `OPERATOR_WALLET_NOT_FOUND` | OperatorWallet chưa tồn tại |
| 404 | `RESOURCE_NOT_FOUND` | OperatorWallet/admin target không tồn tại |
| 404 | `TRIP_NOT_FOUND` | Không tìm thấy Trip |
| 404 | `TRIP_SETTLEMENT_NOT_FOUND` | Không tìm thấy settlement |
| 409 | `SUBSCRIPTION_PAYMENT_PENDING` | Subscription đã có upgrade payment đang pending |
| 409 | `SUBSCRIPTION_NOT_UPGRADABLE` | Subscription không ở ACTIVE/EXPIRED |
| 409 | `SUBSCRIPTION_PAYMENT_STATE_CHANGED` | State đổi trong lúc tạo payment |
| 409 | `TRIP_ALREADY_TERMINAL` | Complete Trip không còn IN_PROGRESS |
| 409 | `TRIP_SETTLEMENT_NOT_ELIGIBLE` | Settlement chưa qua hold window |
| 409 | `TRIP_SETTLEMENT_ALREADY_SETTLED` | Settlement đã SETTLED/CANCELLED |
| 409 | `INVOICE_RETRY_ALREADY_PENDING` | PDF đang PENDING/PROCESSING hoặc race retry thua |
| 409 | `INVOICE_RETRY_NOT_ALLOWED` | Invoice issued/cancelled hoặc đã đủ 5 attempts |
| 409 | `WALLET_CONCURRENT_UPDATE` | Optimistic concurrency retry đã cạn |
| 422 | `VALIDATION_ERROR` | Body/field không hợp lệ |
| 422 | `IDEMPOTENCY_KEY_REQUIRED` | Thiếu `Idempotency-Key` ở Day-38 public mutation |
| 422 | `IDEMPOTENCY_KEY_MISMATCH` | Cùng key nhưng request khác |
| 422 | `SUBSCRIPTION_PLAN_INACTIVE` | Plan đã inactive |
| 422 | `SUBSCRIPTION_PLAN_NOT_PAYABLE` | Plan không có giá phải trả |
| 429 | `RATE_LIMIT_EXCEEDED` | Quá 10 lần download/phút/user/invoice |
| 500 | `INVOICE_PDF_GENERATION_FAILED` | Invoice/PDF chưa sẵn sàng để download |
| 500 | `PLATFORM_WALLET_INSUFFICIENT_BALANCE` | PlatformWallet không đủ tiền settle; transaction rollback |
| 500 | `INTERNAL_ERROR` | Exception chưa có mapping cụ thể |

Model binding JSON sai kiểu có thể trả HTTP `400 VALIDATION_ERROR`; FluentValidation và coded validation thường trả `422`.

## Business flow và lưu ý

### Subscription -> Invoice

1. Operator admin gọi upgrade bằng WALLET hoặc VNPay.
2. WALLET success ngay; VNPay chờ callback hợp lệ.
3. Payment phát `payment.subscription.payment_succeeded` đúng một lần theo idempotency/outbox.
4. Invoice pipeline tạo một Invoice theo `UNIQUE(payment_id)` và cấp số `VR-INV-yyyyMM-XXXXXX` bằng PostgreSQL counter atomic.
5. PDF chạy `PENDING -> PROCESSING -> COMPLETED`; chỉ sau upload thành công Invoice mới thành `ISSUED`.
6. `payment.invoice.issued` kích hoạt push, in-app và email cho OPERATOR_ADMIN.
7. Frontend mở `invoiceWebUrl`, sau đó gọi protected `downloadApiUrl` để nhận signed URL 60 phút.

PDF retry tối đa 5 attempts. Stale `PROCESSING` sau 15 phút được recovery nhưng attempt đã claim vẫn được tính, không có attempt miễn phí.

### Trip -> Settlement

1. Driver/assistant complete Trip hoặc Trip đi vào disrupted terminal flow.
2. Payment tạo tối đa một settlement theo `(operatorId, tripId)` ở `PENDING_HOLD`.
3. `eligibleAt = terminalAt + 7 ngày`.
4. Eligibility job chạy `0 19 * * *` UTC, tức 02:00 ICT.
5. Weekly settlement chạy `0 2 * * 1` UTC, tức 09:00 ICT thứ Hai.
6. Settle recompute net từ ledger tại thời điểm settle; không freeze amount từ lúc tạo marker.
7. Thành công: PlatformWallet DEBIT bằng OperatorWallet CREDIT bằng `netAmount`.
8. Net không dương chuyển settlement sang `CANCELLED`; không credit wallet.

Thiếu PlatformWallet balance giữ settlement `ELIGIBLE`, tăng failure metadata và retry vào các tuần sau. Alert dùng Redis key `payment:settlement_insufficient:{settlementId}` với TTL 24 giờ.

### Tenant isolation và bảo mật

- Operator ID luôn lấy từ JWT; không tin operator ID do client gửi.
- Operator B không đọc Invoice, wallet, ledger hoặc settlement của Operator A.
- Invoice cross-tenant trả 404 để không leak sự tồn tại.
- Signed URL không lưu database, event hoặc structured log.
- Notification không log email, phone, full payload hoặc signed URL.
- Shuttle/booking/parcel revenue không bị trừ platform fee trong Day 38; subscription fee là sản phẩm SaaS riêng và được CREDIT PlatformWallet.

### Ngoài phạm vi

- Bank withdrawal/payout ra tài khoản ngân hàng.
- Hóa đơn điện tử pháp lý từ nhà cung cấp được cấp phép.
- Frontend Invoice UI.
- Platform fee trên booking/parcel settlement.
